-- The former SQL alias "old" shadowed the trigger's OLD row during review deletion.
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
    select coalesce(previous_state.release_id, current_ranks.release_id) as release_id,
      previous_state.rank as previous_rank, current_ranks.rank as new_rank
    from public.release_rank_live_state previous_state
    full join current_ranks using (release_id)
    where previous_state.rank is distinct from current_ranks.rank
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
