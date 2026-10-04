-- Daily standings are immutable evidence for movement and time in the top three.
create table if not exists public.release_rank_daily (
  snapshot_date date not null,
  release_id text not null,
  rank integer not null check (rank between 1 and 15),
  overall_score integer not null,
  primary key (snapshot_date, release_id),
  unique (snapshot_date, rank)
);

create index if not exists release_rank_daily_release_date_idx
  on public.release_rank_daily (release_id, snapshot_date desc);

alter table public.release_rank_daily enable row level security;
revoke all on public.release_rank_daily from anon, authenticated;

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
  where ranked.rank <= 15
  on conflict do nothing;
end $$;

revoke all on function public.capture_release_rank_daily(boolean) from public, anon, authenticated;
-- Migration-day baseline. It is a real snapshot, not reconstructed history.
select public.capture_release_rank_daily(true);

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('stage90-daily-top15', '0 * * * *',
      'select public.capture_release_rank_daily()');
  end if;
exception when undefined_function or insufficient_privilege then
  raise notice 'Register hourly call to public.capture_release_rank_daily() in production scheduler';
end $$;

create or replace function public.top15_chart_meta()
returns table (
  chart text,
  release_id text,
  chart_rank integer,
  chart_score integer,
  previous_rank integer,
  has_previous boolean,
  top3_days integer,
  votes integer
)
language sql stable security definer set search_path = public, pg_temp as $$
with chart_day as (
  select (now() at time zone 'Asia/Tbilisi')::date as today
), previous_day as (
  select snapshot_date
  from public.release_rank_daily, chart_day
  where snapshot_date = chart_day.today - 1
  limit 1
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
  select release_id,
    round(avg(total_score))::integer as chart_score,
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
  old.rank, exists(select 1 from previous_day),
  case when a.chart_rank <= 3 then 1 + (
    select count(*)::integer from (
      select s.snapshot_date,
        row_number() over (order by s.snapshot_date desc)::integer as day_number
      from public.release_rank_daily s, chart_day
      where s.release_id = a.release_id and s.snapshot_date < chart_day.today and s.rank <= 3
    ) consecutive, chart_day
    where consecutive.snapshot_date = chart_day.today - consecutive.day_number
  ) else 0 end,
  null::integer
from all_time a
left join previous_day pd on true
left join public.release_rank_daily old
  on old.snapshot_date = pd.snapshot_date and old.release_id = a.release_id
where a.chart_rank <= 15
union all
select 'weekly'::text, w.release_id, w.chart_rank, w.chart_score,
  null::integer, false, 0, w.votes
from weekly w
where w.chart_rank <= 15;
$$;

revoke all on function public.top15_chart_meta() from public;
grant execute on function public.top15_chart_meta() to anon, authenticated;
