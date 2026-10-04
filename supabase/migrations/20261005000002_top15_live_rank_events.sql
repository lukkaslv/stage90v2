-- Record actual rank transitions, including a release leaving and re-entering the chart.
create table if not exists public.release_rank_live_state (
  release_id text primary key,
  rank integer not null check (rank >= 1)
);

create table if not exists public.release_rank_live_events (
  id bigint generated always as identity primary key,
  release_id text not null,
  previous_rank integer,
  new_rank integer,
  changed_at timestamptz not null default now(),
  check (previous_rank is distinct from new_rank)
);

create index if not exists release_rank_live_events_latest_idx
  on public.release_rank_live_events (release_id, changed_at desc, id desc);

alter table public.release_rank_live_state enable row level security;
alter table public.release_rank_live_events enable row level security;
revoke all on public.release_rank_live_state from anon, authenticated;
revoke all on public.release_rank_live_events from anon, authenticated;

-- Migration time is a baseline, not a fabricated movement event.
insert into public.release_rank_live_state (release_id, rank)
select id::text, row_number() over (order by overall_score desc, id asc)::integer
from public.releases
where is_active = true and overall_score > 0
on conflict (release_id) do nothing;

create or replace function public.record_release_rank_changes()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  changed record;
begin
  if tg_op = 'UPDATE' then
    if new.overall_score is not distinct from old.overall_score
      and new.is_active is not distinct from old.is_active then
      return new;
    end if;
  end if;

  perform pg_advisory_xact_lock(9015);

  for changed in
    with current_ranks as (
      select id::text as release_id,
        row_number() over (order by overall_score desc, id asc)::integer as rank
      from public.releases
      where is_active = true and overall_score > 0
    )
    select coalesce(old.release_id, current_ranks.release_id) as release_id,
      old.rank as previous_rank, current_ranks.rank as new_rank
    from public.release_rank_live_state old
    full join current_ranks using (release_id)
    where old.rank is distinct from current_ranks.rank
  loop
    insert into public.release_rank_live_events (release_id, previous_rank, new_rank)
    values (changed.release_id, changed.previous_rank, changed.new_rank);
  end loop;

  delete from public.release_rank_live_state state
  where not exists (
    select 1 from public.releases release
    where release.id::text = state.release_id
      and release.is_active = true and release.overall_score > 0
  );

  insert into public.release_rank_live_state (release_id, rank)
  select id::text, row_number() over (order by overall_score desc, id asc)::integer
  from public.releases
  where is_active = true and overall_score > 0
  on conflict (release_id) do update set rank = excluded.rank;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

revoke all on function public.record_release_rank_changes() from public, anon, authenticated;

drop trigger if exists track_release_rank_changes on public.releases;
create trigger track_release_rank_changes
  after insert or update of overall_score, is_active or delete on public.releases
  for each row execute function public.record_release_rank_changes();

create or replace function public.top15_live_changes()
returns table (release_id text, previous_rank integer, changed_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
with current_ranks as (
  select id::text as release_id,
    row_number() over (order by overall_score desc, id asc)::integer as rank
  from public.releases
  where is_active = true and overall_score > 0
)
select current_ranks.release_id, latest.previous_rank, latest.changed_at
from current_ranks
join lateral (
  select event.previous_rank, event.new_rank, event.changed_at
  from public.release_rank_live_events event
  where event.release_id = current_ranks.release_id
  order by event.changed_at desc, event.id desc
  limit 1
) latest on latest.new_rank = current_ranks.rank
where current_ranks.rank <= 15 and latest.changed_at >= now() - interval '24 hours';
$$;

revoke all on function public.top15_live_changes() from public;
grant execute on function public.top15_live_changes() to anon, authenticated;
