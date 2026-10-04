-- Keep every ranked position from future snapshots. Existing snapshots remain unchanged.
alter table public.release_rank_daily drop constraint if exists release_rank_daily_rank_check;
alter table public.release_rank_daily add constraint release_rank_daily_rank_check check (rank >= 1);

create or replace function public.capture_release_rank_daily(p_force boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  local_now timestamp := now() at time zone 'Asia/Tbilisi';
  chart_date date := local_now::date;
begin
  if not p_force and extract(hour from local_now) <> 0 then return; end if;
  if exists (select 1 from public.release_rank_daily where snapshot_date = chart_date) then return; end if;

  insert into public.release_rank_daily (snapshot_date, release_id, rank, overall_score)
  select chart_date, ranked.id::text, ranked.rank::integer, ranked.overall_score
  from (
    select id, overall_score,
      row_number() over (order by overall_score desc, id asc) as rank
    from public.releases
    where is_active = true and overall_score > 0
  ) ranked
  on conflict do nothing;
end $$;

revoke all on function public.capture_release_rank_daily(boolean) from public, anon, authenticated;

drop function public.top15_chart_meta();
create function public.top15_chart_meta()
returns table (
  chart text,
  release_id text,
  chart_rank integer,
  chart_score integer,
  previous_rank integer,
  has_previous boolean,
  top3_days integer,
  votes integer,
  baseline_date date,
  first_rank integer,
  first_date date
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
  join public.releases release on release.id::text = r.release_id::text
  where release.is_active = true and r.created_at >= now() - interval '7 days'
    and r.total_score > 0
), weekly_votes as (
  select release_id, round(avg(total_score))::integer as chart_score,
    count(*)::integer as votes
  from weekly_ballots
  where vote_rank = 1
  group by release_id
  having count(*) >= 3
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
  select s.rank, s.snapshot_date
  from public.release_rank_daily s
  where s.release_id = a.release_id
  order by s.snapshot_date asc
  limit 1
) first_snapshot on true
where a.chart_rank <= 15
union all
select 'weekly'::text, w.release_id, w.chart_rank, w.chart_score,
  null::integer, false, 0, w.votes, null::date, null::integer, null::date
from weekly w
where w.chart_rank <= 15;
$$;

revoke all on function public.top15_chart_meta() from public;
grant execute on function public.top15_chart_meta() to anon, authenticated;
