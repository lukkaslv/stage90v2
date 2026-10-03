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

create or replace function public.reaction_session_submit_rating(
  p_token uuid, p_params integer[], p_vibe integer
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  session_row public.reaction_sessions;
  release_row public.releases;
  existing_review public.reviews;
  computed_score integer;
begin
  if array_length(p_params, 1) is distinct from 4
    or exists (select 1 from unnest(p_params) as point where point is null or point not between 1 and 10)
    or p_vibe is null or p_vibe not between 1 and 5 then
    raise exception 'Invalid studio rating';
  end if;

  select * into session_row from public.reaction_sessions
  where access_token = p_token and revoked_at is null and expires_at > now()
  for update;
  if not found then return false; end if;
  if not exists (select 1 from public.profiles where id = session_row.admin_id and role = 'admin') then
    return false;
  end if;
  select * into release_row from public.releases where id::text = session_row.release_id and is_active = true;
  if not found then return false; end if;

  computed_score := least(90, round(
    (p_params[1] + p_params[2] + p_params[3] + p_params[4]) * 1.4 *
    case p_vibe
      when 1 then 1.0000 when 2 then 1.1518 when 3 then 1.3036
      when 4 then 1.4554 else 1.6072
    end
  )::integer);

  update public.reaction_sessions set
    params = p_params, vibe = p_vibe, revealed = true, updated_at = now()
  where id = session_row.id;

  perform pg_advisory_xact_lock(hashtext(session_row.admin_id::text), hashtext(session_row.release_id));
  select * into existing_review from public.reviews
  where user_id = session_row.admin_id and release_id::text = session_row.release_id
  order by created_at desc limit 1 for update;

  if found then
    update public.reviews set
      rhymes = p_params[1], structure = p_params[2], style = p_params[3],
      individuality = p_params[4], vibe = p_vibe,
      scoring_model = 'experience_v1', total_score = computed_score,
      is_media_review = true
    where id = existing_review.id;
  else
    insert into public.reviews (
      release_id, user_id, title, content, rhymes, structure, style,
      individuality, vibe, scoring_model, total_score, is_media_review
    ) values (
      release_row.id, session_row.admin_id, 'შეფასება', '',
      p_params[1], p_params[2], p_params[3], p_params[4], p_vibe,
      'experience_v1', computed_score, true
    );
  end if;
  return true;
end;
$$;

revoke all on function public.reaction_session_submit_rating(uuid, integer[], integer) from public, anon, authenticated;
grant execute on function public.reaction_session_submit_rating(uuid, integer[], integer) to anon, authenticated;
