const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { PGlite } = require('@electric-sql/pglite');

const migration = readFileSync(path.join(__dirname, '../supabase/migrations/20261009000000_rating_quorum_moderation.sql'), 'utf8');
const ids = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);

test('three distinct verified votes publish a score and moderation reverses it', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      create table public.profiles(id uuid primary key, role text not null, is_verified boolean not null);
      insert into public.profiles values
        ('${ids[0]}', 'admin', true),
        ('${ids[1]}', 'user', true),
        ('${ids[2]}', 'user', true),
        ('${ids[3]}', 'user', false);
      create table public.releases(
        id bigint primary key, title text not null default 'ტრეკი', artist_name text not null default '',
        cover_url text, release_type text, parent_id text, track_number integer,
        created_at timestamptz not null default now(), is_active boolean not null default true,
        overall_score integer not null default 0, community_score integer not null default 0,
        critics_score integer not null default 0, value_tier text not null default 'ვერცხლი'
      );
      insert into public.releases(id) values (1);
      create table public.reviews(
        id bigint generated always as identity primary key,
        release_id bigint not null references public.releases(id),
        user_id uuid not null references public.profiles(id),
        total_score integer not null, created_at timestamptz not null default now()
      );
      create table public.artists(
        id uuid primary key, name text not null, photo_url text, is_active boolean not null default true
      );
      create table public.artist_releases(artist_id uuid references public.artists(id), release_id bigint references public.releases(id));
      create table public.release_rank_daily(snapshot_date date, release_id text, rank integer);
      create function public.on_release_review_changed() returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          perform public.refresh_release_scores(old.release_id::text);
          return old;
        end if;
        perform public.refresh_release_scores(new.release_id::text);
        return new;
      end;
      $$;
      grant usage on schema public, auth to anon, authenticated;
      grant select, update on public.reviews to authenticated;
    `);
    await db.exec(migration);

    const score = async () => (await db.query('select overall_score, preliminary_score, eligible_voter_count from public.releases where id = 1')).rows[0];
    await db.query('insert into public.reviews(release_id, user_id, total_score) values (1, $1, 90)', [ids[1]]);
    await db.query('insert into public.reviews(release_id, user_id, total_score) values (1, $1, 90)', [ids[1]]);
    assert.deepEqual(await score(), { overall_score: 0, preliminary_score: 90, eligible_voter_count: 1 });

    await db.query('insert into public.reviews(release_id, user_id, total_score) values (1, $1, 80)', [ids[2]]);
    await db.query('insert into public.reviews(release_id, user_id, total_score) values (1, $1, 70)', [ids[3]]);
    assert.deepEqual(await score(), { overall_score: 0, preliminary_score: 85, eligible_voter_count: 2 });

    await db.query('update public.profiles set is_verified = true where id = $1', [ids[3]]);
    assert.deepEqual(await score(), { overall_score: 80, preliminary_score: 80, eligible_voter_count: 3 });

    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids[1]]);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.moderate_review_score($1, true, $2)', ['3', 'საეჭვო შეფასება']));
    await assert.rejects(db.query('update public.reviews set excluded_from_score = true where id = 3'));
    await db.exec('reset role');

    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids[0]]);
    await db.exec('set role authenticated');
    await db.query('select public.moderate_review_score($1, true, $2)', ['3', 'საეჭვო შეფასება']);
    await db.exec('reset role');
    assert.deepEqual(await score(), { overall_score: 0, preliminary_score: 80, eligible_voter_count: 2 });
    assert.equal((await db.query('select count(*)::integer as count from public.review_score_moderation')).rows[0].count, 1);

    await db.exec('set role authenticated');
    await db.query('select public.moderate_review_score($1, false, $2)', ['3', 'შეფასება გადამოწმებულია']);
    await db.exec('reset role');
    assert.deepEqual(await score(), { overall_score: 80, preliminary_score: 80, eligible_voter_count: 3 });
    assert.equal((await db.query('select count(*)::integer as count from public.review_score_moderation')).rows[0].count, 2);
  } finally {
    await db.close();
  }
});
