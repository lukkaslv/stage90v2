-- Keep the current leader's entry event available after the 24-hour movement window.
-- Other rank movements still expire after 24 hours.
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
where current_ranks.rank <= 15
  and (
    latest.changed_at >= now() - interval '24 hours'
    or current_ranks.rank = 1
  );
$$;

revoke all on function public.top15_live_changes() from public;
grant execute on function public.top15_live_changes() to anon, authenticated;
