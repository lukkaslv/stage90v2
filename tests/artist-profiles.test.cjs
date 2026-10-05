const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { PGlite } = require('@electric-sql/pglite');

const migration = readFileSync(path.join(__dirname, '../supabase/migrations/20261005000005_artist_profiles.sql'), 'utf8');
const adminId = '00000000-0000-4000-8000-000000000001';
const readerId = '00000000-0000-4000-8000-000000000002';

// Disposable PostgreSQL only. No sample records or fixtures enter the application/database.
async function database(idType, legacy = false) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create table public.profiles(id uuid primary key, role text not null);
    insert into public.profiles values ('${adminId}', 'admin'), ('${readerId}', 'user');
    create table public.releases(
      id ${idType} primary key, title text not null default 'ტრეკი', artist_name text not null default '',
      cover_url text, release_type text default 'სინგლი', parent_id text, track_number integer,
      is_active boolean default true, overall_score integer not null default 0,
      created_at timestamptz not null default now()
    );
    alter table public.releases enable row level security;
    create policy release_read on public.releases for select using (is_active);
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select on public.releases to anon, authenticated;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant select, insert, delete on storage.objects to anon, authenticated;
  `);
  if (legacy) await db.exec(`
    create table public.artists(
      id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
      image_url text, bio text, role_tag text not null default 'artist', spotify_id text,
      verified_profile_id uuid, created_at timestamptz not null default now()
    );
    insert into public.artists(name, slug, image_url) values ('არსებული არტისტი', 'existing-artist', 'https://example.com/portrait.png');
  `);
  await db.exec(migration);
  return db;
}

async function asRole(db, role, id = '') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec(`set role ${role}`);
}

async function save(db, { id = null, name = 'არტისტი', links = [], version = null, active = true } = {}) {
  const result = await db.query(`select public.save_artist_profile($1::uuid,$2,'','', '{}'::jsonb,$3,$4::text[],$5::timestamptz) as id`, [id, name, active, links, version]);
  return result.rows[0].id;
}

for (const idType of ['uuid', 'bigint']) {
  test(`artist totals deduplicate album tracks and reorder immediately (${idType} release IDs)`, async () => {
    const db = await database(idType);
    try {
      const ids = Array.from({ length: 5 }, (_, index) => idType === 'uuid' ? `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` : String(index + 1));
      await db.query(`insert into public.releases(id, release_type, overall_score) values ($1, 'ალბომი', 90), ($2, 'ტრეკი', 85), ($3, 'ტრეკი', 80), ($4, 'სინგლი', 0), ($5, 'სინგლი', 90)`, ids);
      await db.query(`update public.releases set parent_id = $1 where id::text in ($2, $3)`, ids.slice(0, 3));
      await db.query(`update public.releases set is_active = false where id::text = $1`, [ids[4]]);
      await asRole(db, 'authenticated', adminId);
      const first = await save(db, { name: 'პირველი', links: ids });
      const second = await save(db, { name: 'მეორე', links: [ids[1]] });
      const unranked = await save(db, { name: 'შეუფასებელი', links: [ids[3]] });
      let ranks = (await db.query('select * from public.artist_rankings order by rank nulls last')).rows;
      assert.equal(ranks[0].id, first);
      assert.equal(Number(ranks[0].total_score), 165);
      assert.equal(Number(ranks[0].average_score), 82.5);
      assert.equal(ranks[0].rated_track_count, 2);
      assert.equal(ranks[0].track_count, 3);
      assert.equal(ranks[0].release_count, 4);
      assert.equal(ranks.find((row) => row.id === second).total_score, 85);
      assert.equal(ranks.find((row) => row.id === unranked).rank, null);

      // A changed real score drives the view without a cached refresh/job.
      await db.exec('reset role');
      await db.query('update public.releases set overall_score = 90 where id::text = $1', [ids[3]]);
      ranks = (await db.query('select * from public.artist_rankings order by rank')).rows;
      assert.equal(ranks[1].id, unranked);
      assert.equal(ranks[2].id, second);
      await db.query('update public.releases set is_active = false where id::text = $1', [ids[0]]);
      // Explicit track links survive hiding the linked album, with no duplication.
      assert.equal((await db.query('select total_score from public.artist_rankings where id = $1', [first])).rows[0].total_score, 255);
      await db.query('delete from public.releases where id::text = $1', [ids[1]]);
      assert.equal((await db.query('select count(*)::integer as n from public.artist_releases where release_id::text = $1', [ids[1]])).rows[0].n, 0);
      assert.equal((await db.query('select rank from public.artist_rankings where id = $1', [second])).rows[0].rank, null);
    } finally { await db.close(); }
  });
}

test('legacy artist directory is preserved and saving is atomic with concurrent-edit protection', async () => {
  const db = await database('uuid', true);
  try {
    const legacy = (await db.query('select * from public.artists')).rows[0];
    assert.equal(legacy.slug, 'existing-artist');
    assert.equal(legacy.photo_url, 'https://example.com/portrait.png');
    assert.equal(legacy.bio, '');
    await asRole(db, 'authenticated', adminId);
    const created = await save(db);
    assert.ok((await db.query('select slug from public.artists where id = $1', [created])).rows[0].slug);
    await save(db, { id: legacy.id, name: 'ახალი სახელი', version: legacy.updated_at });
    await assert.rejects(save(db, { id: legacy.id, name: 'დაგვიანებული ცვლილება', version: legacy.updated_at }), (error) => error.code === '40001');
    await assert.rejects(save(db, { name: 'არასწორი რელიზი', links: ['missing'] }), (error) => error.code === '22023');
    const rows = (await db.query('select id, name from public.artists')).rows;
    assert.equal(rows.length, 2);
    assert.equal(rows.find((row) => row.id === legacy.id).name, 'ახალი სახელი');
  } finally { await db.close(); }
});

test('public visibility and admin-only artist and portrait mutations are enforced by PostgreSQL', async () => {
  const db = await database('uuid');
  try {
    await asRole(db, 'authenticated', adminId);
    const publicId = await save(db);
    await save(db, { active: false, name: 'დამალული' });
    await db.exec("insert into storage.objects(bucket_id, name) values ('artist-photos', 'portrait.png')");
    await asRole(db, 'authenticated', readerId);
    assert.equal((await db.query('select count(*)::integer as n from public.artists')).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::integer as n from public.artist_rankings')).rows[0].n, 1);
    await assert.rejects(save(db), (error) => error.code === '42501');
    await assert.rejects(db.exec("insert into public.artists(name) values ('უნებართვო')"), (error) => error.code === '42501');
    assert.equal((await db.query('delete from public.artists where id = $1 returning id', [publicId])).rows.length, 0);
    await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values ('artist-photos','unauthorized.png')"), (error) => error.code === '42501');
    assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 0);
    await asRole(db, 'anon');
    assert.equal((await db.query('select count(*)::integer as n from public.artists')).rows[0].n, 1);
    await assert.rejects(save(db), (error) => error.code === '42501');
  } finally { await db.close(); }
});

test('album inheritance follows catalog changes, unlinking and deterministic score ties', async () => {
  const db = await database('bigint');
  try {
    await db.exec("insert into public.releases(id,release_type,overall_score,parent_id) values (1,'album',90,null),(2,'track',70,'1'),(3,'track',70,'1'),(4,'single',70,null)");
    await asRole(db, 'authenticated', adminId);
    const first = await save(db, { name: 'ალბომის არტისტი', links: ['1'] });
    const second = await save(db, { name: 'სინგლის არტისტი', links: ['4'] });
    assert.equal((await db.query('select total_score from public.artist_rankings where id=$1', [first])).rows[0].total_score, 140);
    await db.exec('reset role');
    await db.exec("insert into public.releases(id,release_type,overall_score,parent_id) values (5,'track',80,'1')");
    assert.equal((await db.query('select total_score from public.artist_rankings where id=$1', [first])).rows[0].total_score, 220);
    await db.exec('update public.releases set is_active=false where id=1');
    assert.equal((await db.query('select total_score from public.artist_rankings where id=$1', [first])).rows[0].total_score, 0);
    await db.exec('update public.releases set is_active=true where id=1');
    await asRole(db, 'authenticated', adminId);
    const before = (await db.query('select updated_at from public.artists where id=$1', [first])).rows[0];
    await save(db, { id: first, version: before.updated_at, links: ['2'] });
    const tied = (await db.query('select id, total_score from public.artist_rankings order by rank')).rows;
    assert.deepEqual(tied.map((row) => row.id), [first, second]);
    assert.deepEqual(tied.map((row) => row.total_score), [70, 70]);
    const version = (await db.query('select updated_at from public.artists where id=$1', [first])).rows[0].updated_at;
    await assert.rejects(save(db, { id: first, version, links: ['missing'] }));
    assert.equal((await db.query('select release_id from public.artist_releases where artist_id=$1', [first])).rows[0].release_id, 2);
  } finally { await db.close(); }
});
