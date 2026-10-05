const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { PGlite } = require('@electric-sql/pglite');

const migrations = [
  '20261003000000_reaction_studio.sql',
  '20261004000000_reaction_featured_comment.sql',
  '20261005000007_reaction_artist_chart.sql',
  '20261005000008_reaction_comment_persist.sql',
].map((file) => readFileSync(path.join(__dirname, '../supabase/migrations', file), 'utf8'));
const adminId = '00000000-0000-4000-8000-000000000001';
const readerId = '00000000-0000-4000-8000-000000000002';

test('studio chart switch is admin-only and appears in the OBS session view', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      create table public.profiles(id uuid primary key, role text not null);
      insert into public.profiles values ('${adminId}', 'admin'), ('${readerId}', 'user');
      create table public.releases(
        id bigint primary key, title text not null, artist_name text not null,
        cover_url text, release_type text, parent_id text, track_number integer,
        overall_score integer, created_at timestamptz not null default now()
      );
      insert into public.releases(id, title, artist_name) values
        (1, 'ტრეკი', 'არტისტი'), (2, 'სხვა ტრეკი', 'არტისტი');
      grant usage on schema public, auth to anon, authenticated;
    `);
    for (const migration of migrations) await db.exec(migration);

    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [adminId]);
    await db.exec('set role authenticated');
    const session = (await db.query("select public.reaction_session_create('1') as value")).rows[0].value;
    assert.ok(session.id);
    assert.ok(session.token);
    assert.equal((await db.query('select public.reaction_session_view($1::uuid) as value', [session.token])).rows[0].value.chart_type, 'tracks');

    assert.equal((await db.query("select public.reaction_session_set_chart($1::uuid, 'artists') as changed", [session.id])).rows[0].changed, true);
    await db.exec('reset role');
    await db.exec('set role anon');
    assert.equal((await db.query('select public.reaction_session_view($1::uuid) as value', [session.token])).rows[0].value.chart_type, 'artists');
    await assert.rejects(db.query("select public.reaction_session_set_chart($1::uuid, 'tracks')", [session.id]), (error) => error.code === '42501');

    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [readerId]);
    await db.exec('set role authenticated');
    await assert.rejects(db.query("select public.reaction_session_set_chart($1::uuid, 'tracks')", [session.id]));
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [adminId]);
    await db.exec('set role authenticated');
    await assert.rejects(db.query("select public.reaction_session_set_chart($1::uuid, 'invalid')", [session.id]));
    assert.equal((await db.query('select public.reaction_session_view($1::uuid) as value', [session.token])).rows[0].value.chart_type, 'artists');

    assert.equal((await db.query("select public.reaction_session_set_comment($1::uuid, 'მაყურებელი', 'კომენტარი', true) as changed", [session.id])).rows[0].changed, true);
    assert.equal((await db.query("select public.reaction_session_update($1::uuid, '2', 'intro', null, array[5, 5, 5, 5], 3, true) as changed", [session.id])).rows[0].changed, true);
    const changedView = (await db.query('select public.reaction_session_view($1::uuid) as value', [session.token])).rows[0].value;
    assert.equal(changedView.release.id, 2);
    assert.deepEqual(changedView.comment, { author: 'მაყურებელი', text: 'კომენტარი', visible: false });
  } finally { await db.close(); }
});
