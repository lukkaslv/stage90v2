const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { PGlite } = require('@electric-sql/pglite');

const studioMigration = readFileSync(path.join(__dirname, '../supabase/migrations/20261003000000_reaction_studio.sql'), 'utf8');
const momentsMigration = readFileSync(path.join(__dirname, '../supabase/migrations/20261007000001_reaction_private_moments.sql'), 'utf8');
const adminId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';

test('private reaction moments belong only to the session admin and never appear in OBS data', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      create table public.profiles(id uuid primary key, role text not null);
      insert into public.profiles values ('${adminId}', 'admin'), ('${otherId}', 'user');
      create table public.releases(
        id bigint primary key, title text not null, artist_name text not null,
        cover_url text, release_type text, parent_id text, track_number integer,
        overall_score integer, created_at timestamptz not null default now()
      );
      insert into public.releases(id, title, artist_name, parent_id) values
        (1, 'ალბომი', 'არტისტი', null), (2, 'ტრეკი', 'არტისტი', '1'),
        (3, 'სხვა ტრეკი', 'არტისტი', null);
      grant usage on schema public, auth to anon, authenticated;
    `);
    await db.exec(studioMigration);
    await db.exec(momentsMigration);

    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [adminId]);
    await db.exec('set role authenticated');
    const session = (await db.query("select public.reaction_session_create('1') as value")).rows[0].value;
    await db.query(`insert into public.reaction_private_moments
      (session_id, admin_id, release_id, track_id, cue, note, position_seconds)
      values ($1::uuid, $2::uuid, '1', '2', 'feeling', 'ხმის ცვლილება', 84)`, [session.id, adminId]);
    const own = await db.query('select note, position_seconds from public.reaction_private_moments');
    assert.deepEqual(own.rows, [{ note: 'ხმის ცვლილება', position_seconds: 84 }]);
    await assert.rejects(db.query(`insert into public.reaction_private_moments
      (session_id, admin_id, release_id, track_id, cue)
      values ($1::uuid, $2::uuid, '1', '3', 'story')`, [session.id, adminId]));
    const obs = (await db.query('select public.reaction_session_view($1::uuid) as value', [session.token])).rows[0].value;
    assert.equal(obs.moments, undefined);

    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [otherId]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.reaction_private_moments')).rows.length, 0);
    await assert.rejects(db.query(`insert into public.reaction_private_moments
      (session_id, admin_id, release_id, cue)
      values ($1::uuid, $2::uuid, '1', 'story')`, [session.id, otherId]));

    await db.exec('reset role');
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.reaction_private_moments'));
  } finally { await db.close(); }
});
