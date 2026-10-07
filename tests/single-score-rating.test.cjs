const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { PGlite } = require('@electric-sql/pglite');

const migrationNames = [
  '20261003000000_reaction_studio.sql',
  '20261003000001_reaction_obs_rating.sql',
  '20261004000000_reaction_featured_comment.sql',
  '20261005000007_reaction_artist_chart.sql',
  '20261007000000_single_score_rating.sql',
];
const adminId = '00000000-0000-4000-8000-000000000001';

test('one score flows from OBS to review and tier averages', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      create table public.profiles(id uuid primary key, role text not null);
      insert into public.profiles values ('${adminId}', 'admin');
      create table public.releases(
        id bigint primary key, title text not null, artist_name text not null,
        cover_url text, release_type text, parent_id text, track_number integer,
        overall_score integer, created_at timestamptz not null default now(),
        is_active boolean not null default true
      );
      insert into public.releases(id, title, artist_name) values (1, 'ტრეკი', 'არტისტი');
      create table public.reviews(
        id bigint generated always as identity primary key,
        release_id bigint not null references public.releases(id), user_id uuid not null references public.profiles(id),
        title text not null, content text not null, rhymes integer not null, structure integer not null,
        style integer not null, individuality integer not null, vibe integer not null,
        scoring_model text, total_score integer not null, is_media_review boolean not null default false,
        created_at timestamptz not null default now(),
        constraint reviews_content_check check (char_length(content) between 300 and 8500 or (content = '' and scoring_model = 'experience_v1'))
      );
      grant usage on schema public, auth to anon, authenticated;
    `);
    for (const name of migrationNames) await db.exec(readFileSync(path.join(__dirname, '../supabase/migrations', name), 'utf8'));

    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [adminId]);
    await db.exec('set role authenticated');
    const session = (await db.query("select public.reaction_session_create('1') as value")).rows[0].value;
    assert.equal((await db.query('select public.reaction_session_view($1::uuid) as value', [session.token])).rows[0].value.score, 45);
    assert.equal((await db.query("select public.reaction_session_update($1::uuid, '1', 'score', null, 85, true) as changed", [session.id])).rows[0].changed, true);
    await db.exec('reset role');
    await db.exec('set role anon');
    assert.equal((await db.query('select public.reaction_session_view($1::uuid) as value', [session.token])).rows[0].value.score, 85);
    assert.equal((await db.query('select public.reaction_session_submit_rating($1::uuid, 90) as saved', [session.token])).rows[0].saved, true);
    await db.exec('reset role');
    const review = (await db.query('select total_score, scoring_model, rhymes, structure, style, individuality, vibe from public.reviews')).rows[0];
    assert.deepEqual(review, { total_score: 90, scoring_model: 'holistic_v1', rhymes: null, structure: null, style: null, individuality: null, vibe: null });
    await db.exec(`
      insert into public.profiles values
        ('00000000-0000-4000-8000-000000000002', 'user'),
        ('00000000-0000-4000-8000-000000000003', 'user'),
        ('00000000-0000-4000-8000-000000000004', 'user');
      insert into public.reviews(release_id, user_id, title, content, rhymes, structure, style, individuality, vibe, scoring_model, total_score)
      select 1, id, 'შეფასება', '', null, null, null, null, null, 'holistic_v1',
        case when id::text like '%0002' then 90 else 40 end
      from public.profiles where role = 'user';
    `);
    assert.equal((await db.query('select round(avg(total_score))::integer as score from public.reviews')).rows[0].score, 65);
    await assert.rejects(db.query('select public.reaction_session_rate($1::uuid, 91)', [session.token]));
  } finally { await db.close(); }
});
