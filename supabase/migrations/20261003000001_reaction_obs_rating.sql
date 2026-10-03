alter table public.reaction_sessions alter column revealed set default true;

create or replace function public.reaction_session_rate(
  p_token uuid, p_params integer[], p_vibe integer
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if array_length(p_params, 1) is distinct from 4
    or exists (select 1 from unnest(p_params) as point where point is null or point not between 1 and 10)
    or p_vibe is null or p_vibe not between 1 and 5 then
    raise exception 'Invalid studio rating';
  end if;

  update public.reaction_sessions set
    params = p_params, vibe = p_vibe, revealed = true, updated_at = now()
  where access_token = p_token and revoked_at is null and expires_at > now();
  return found;
end;
$$;

revoke all on function public.reaction_session_rate(uuid, integer[], integer) from public, anon, authenticated;
grant execute on function public.reaction_session_rate(uuid, integer[], integer) to anon, authenticated;
