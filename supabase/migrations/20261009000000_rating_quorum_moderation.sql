begin;

alter table public.reviews
  add column excluded_from_score boolean not null default false;
alter table public.releases
  add column preliminary_score integer not null default 0,
  add column eligible_voter_count integer not null default 0;

create table public.review_score_moderation (
  id bigint generated always as identity primary key,
  review_id text not null,
  moderator_id uuid not null references public.profiles(id),
  excluded boolean not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  created_at timestamptz not null default now()
);
create index review_score_moderation_review_idx
  on public.review_score_moderation (review_id, created_at desc);
alter table public.review_score_moderation enable row level security;
revoke all on public.review_score_moderation from public, anon, authenticated;
grant select on public.review_score_moderation to authenticated;
create policy review_score_moderation_admin_read on public.review_score_moderation
  for select to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create or replace function public.protect_review_score_moderation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.excluded_from_score is distinct from old.excluded_from_score
    and current_setting('stage90.moderating_score', true) is distinct from 'on' then
    raise exception 'Rating exclusion requires administrator moderation';
  end if;
  return new;
end;
$$;
create trigger protect_review_score_moderation
  before update of excluded_from_score on public.reviews
  for each row execute function public.protect_review_score_moderation();

create or replace function public.moderate_review_score(
  p_review_id text, p_excluded boolean, p_reason text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target_id text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Administrator access required';
  end if;
  if p_excluded is null or char_length(btrim(coalesce(p_reason, ''))) not between 3 and 1000 then
    raise exception 'A moderation reason is required';
  end if;
  select id::text into target_id from public.reviews
    where id::text = p_review_id for update;
  if target_id is null then raise exception 'Review not found'; end if;
  perform set_config('stage90.moderating_score', 'on', true);
  update public.reviews set excluded_from_score = p_excluded where id::text = target_id;
  perform set_config('stage90.moderating_score', 'off', true);
  insert into public.review_score_moderation(review_id, moderator_id, excluded, reason)
    values (target_id, auth.uid(), p_excluded, btrim(p_reason));
end;
$$;
revoke all on function public.moderate_review_score(text, boolean, text) from public, anon, authenticated;
grant execute on function public.moderate_review_score(text, boolean, text) to authenticated;

create or replace function public.refresh_release_scores(target_release_id text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  average_score integer;
  community integer;
  media integer;
  voters integer;
  published_score integer;
  computed_tier text;
  score_column text;
begin
  with latest_ballots as (
    select distinct on (review.user_id)
      review.total_score, profile.role
    from public.reviews review
    join public.profiles profile on profile.id = review.user_id
    where review.release_id::text = target_release_id
      and review.excluded_from_score = false
      and (profile.is_verified = true or profile.role = 'admin')
      and review.total_score between 1 and 90
    order by review.user_id, review.created_at desc, review.id desc
  )
  select round(avg(total_score))::integer,
    round(avg(total_score) filter (where role in ('user', 'author', 'admin')))::integer,
    round(avg(total_score) filter (where role = 'media'))::integer,
    count(*)::integer
  into average_score, community, media, voters
  from latest_ballots;

  published_score := case when voters >= 3 then coalesce(average_score, 0) else 0 end;
  computed_tier := case
    when published_score >= 85 then 'ლალი'
    when published_score >= 75 then 'საფირონი'
    when published_score >= 65 then 'ზურმუხტი'
    when published_score >= 50 then 'ოქრო'
    else 'ვერცხლი'
  end;

  update public.releases set
    overall_score = published_score,
    preliminary_score = coalesce(average_score, 0),
    eligible_voter_count = voters
  where id::text = target_release_id;

  foreach score_column in array array['community_score', 'score_community'] loop
    if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'releases' and column_name = score_column) then
      execute format('update public.releases set %I = $2 where id::text = $1', score_column)
        using target_release_id, coalesce(community, 0);
    end if;
  end loop;
  foreach score_column in array array['critics_score', 'score_critics'] loop
    if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'releases' and column_name = score_column) then
      execute format('update public.releases set %I = $2 where id::text = $1', score_column)
        using target_release_id, coalesce(media, 0);
    end if;
  end loop;
  if exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'releases' and column_name = 'value_tier') then
    update public.releases set value_tier = computed_tier where id::text = target_release_id;
  end if;
end;
$$;

drop trigger if exists recalculate_release_scores on public.reviews;
create trigger recalculate_release_scores
  after insert or update of release_id, user_id, total_score, excluded_from_score or delete on public.reviews
  for each row execute function public.on_release_review_changed();

create or replace function public.on_reviewer_role_changed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare reviewed_release_id text;
begin
  if new.role is distinct from old.role or new.is_verified is distinct from old.is_verified then
    for reviewed_release_id in
      select distinct review.release_id::text from public.reviews review where review.user_id = new.id
    loop
      perform public.refresh_release_scores(reviewed_release_id);
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists recalculate_release_scores_for_role on public.profiles;
create trigger recalculate_release_scores_for_role
  after update of role, is_verified on public.profiles
  for each row execute function public.on_reviewer_role_changed();

do $$
declare release_id text;
begin
  for release_id in select id::text from public.releases loop
    perform public.refresh_release_scores(release_id);
  end loop;
end;
$$;

create or replace view public.artist_release_catalog with (security_invoker = true) as
with linked as (
  select ar.artist_id, r.id as release_id
  from public.artist_releases ar join public.releases r on r.id = ar.release_id where r.is_active
  union
  select ar.artist_id, track.id
  from public.artist_releases ar
  join public.releases album on album.id = ar.release_id and album.is_active
  join public.releases track on track.parent_id::text = album.id::text and track.is_active
), catalog as (
  select a.id as artist_id, a.name as artist_display_name, a.photo_url as artist_photo_url,
    r.id as release_id, r.title, r.artist_name, r.cover_url, r.release_type,
    r.parent_id, r.track_number, r.created_at, r.overall_score,
    lower(trim(coalesce(r.release_type, ''))) not in ('album', 'ალბომი', 'ep', 'ეპი', 'mixtape', 'მიქსტეიპი')
      and not exists (select 1 from public.releases child where child.parent_id::text = r.id::text) as is_scoring_track
  from linked l join public.artists a on a.id = l.artist_id and a.is_active
  join public.releases r on r.id = l.release_id
)
select catalog.*, catalog.is_scoring_track and catalog.overall_score > 0 as score_counted,
  r.preliminary_score, r.eligible_voter_count
from catalog join public.releases r on r.id = catalog.release_id;

-- Existing weekly charts must observe the same moderation and verification rules.
create or replace function public.top15_chart_meta()
returns table (
  chart text, release_id text, chart_rank integer, chart_score integer,
  previous_rank integer, has_previous boolean, top3_days integer, votes integer,
  baseline_date date, first_rank integer, first_date date
)
language sql stable security definer set search_path = public, pg_temp as $$
with chart_day as (
  select (now() at time zone 'Asia/Tbilisi')::date as today
), baseline_day as (
  select max(snapshot_date) as snapshot_date
  from public.release_rank_daily, chart_day
  where snapshot_date <= chart_day.today
), all_time as (
  select r.id::text as release_id, r.overall_score as chart_score,
    row_number() over (order by r.overall_score desc, r.id asc)::integer as chart_rank
  from public.releases r
  where r.is_active = true and r.overall_score > 0
), weekly_ballots as (
  select r.release_id::text as release_id, r.total_score,
    row_number() over (partition by r.release_id, r.user_id order by r.created_at desc, r.id desc) as vote_rank
  from public.reviews r
  join public.profiles profile on profile.id = r.user_id
  join public.releases release on release.id::text = r.release_id::text
  where release.is_active = true and release.overall_score > 0
    and r.created_at >= now() - interval '7 days'
    and r.total_score between 1 and 90 and r.excluded_from_score = false
    and (profile.is_verified = true or profile.role = 'admin')
), weekly_votes as (
  select release_id, round(avg(total_score))::integer as chart_score,
    count(*)::integer as votes
  from weekly_ballots where vote_rank = 1
  group by release_id having count(*) >= 3
), weekly as (
  select release_id, chart_score, votes,
    row_number() over (order by chart_score desc, votes desc, release_id asc)::integer as chart_rank
  from weekly_votes
)
select 'all_time'::text, a.release_id, a.chart_rank, a.chart_score,
  old.rank, baseline.snapshot_date is not null,
  case when a.chart_rank <= 3 then 1 + (
    select count(*)::integer from (
      select s.snapshot_date,
        row_number() over (order by s.snapshot_date desc)::integer as day_number
      from public.release_rank_daily s, chart_day
      where s.release_id = a.release_id and s.snapshot_date < chart_day.today and s.rank <= 3
    ) consecutive, chart_day
    where consecutive.snapshot_date = chart_day.today - consecutive.day_number
  ) else 0 end,
  null::integer, baseline.snapshot_date, first_snapshot.rank, first_snapshot.snapshot_date
from all_time a
cross join baseline_day baseline
left join public.release_rank_daily old
  on old.snapshot_date = baseline.snapshot_date and old.release_id = a.release_id
left join lateral (
  select s.rank, s.snapshot_date from public.release_rank_daily s
  where s.release_id = a.release_id order by s.snapshot_date asc limit 1
) first_snapshot on true
where a.chart_rank <= 15
union all
select 'weekly'::text, w.release_id, w.chart_rank, w.chart_score,
  null::integer, false, 0, w.votes, null::date, null::integer, null::date
from weekly w where w.chart_rank <= 15;
$$;

notify pgrst, 'reload schema';
commit;
