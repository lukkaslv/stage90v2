begin;

alter table public.reaction_sessions
  add column score integer check (score between 1 and 90);

update public.reaction_sessions
set score = least(90, round(
  (params[1] + params[2] + params[3] + params[4]) * 1.4 *
  case vibe when 1 then 1.0000 when 2 then 1.1518 when 3 then 1.3036
    when 4 then 1.4554 else 1.6072 end
)::integer)
where score is null;

alter table public.reaction_sessions alter column score set default 45;
alter table public.reaction_sessions alter column score set not null;

alter table public.reviews
  alter column rhymes drop not null,
  alter column structure drop not null,
  alter column style drop not null,
  alter column individuality drop not null,
  alter column vibe drop not null;

alter table public.reviews drop constraint if exists reviews_content_check;
alter table public.reviews add constraint reviews_content_check check (
  char_length(content) between 300 and 8500
  or (content = '' and scoring_model in ('experience_v1', 'holistic_v1'))
);

drop function public.reaction_session_update(uuid, text, text, text, integer[], integer, boolean);
drop function public.reaction_session_rate(uuid, integer[], integer);
drop function public.reaction_session_submit_rating(uuid, integer[], integer);

create function public.reaction_session_update(
  p_id uuid, p_release_id text, p_scene text, p_track_id text,
  p_score integer, p_revealed boolean
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.reaction_is_admin() then raise exception 'Access denied'; end if;
  if p_scene is null or p_scene not in ('intro', 'tracks', 'score')
    or p_score is null or p_score not between 1 and 90 then
    raise exception 'Invalid studio state';
  end if;
  if not exists (select 1 from public.releases where id::text = p_release_id) then
    raise exception 'Release not found';
  end if;
  if p_track_id is not null and not exists (
    select 1 from public.releases
    where id::text = p_track_id and parent_id::text = p_release_id
  ) then raise exception 'Track does not belong to release'; end if;

  update public.reaction_sessions set
    release_id = p_release_id, scene = p_scene, track_id = p_track_id,
    score = p_score, revealed = p_revealed, updated_at = now()
  where id = p_id and admin_id = auth.uid() and revoked_at is null and expires_at > now();
  return found;
end;
$$;

create or replace function public.reaction_session_view(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare session_row public.reaction_sessions;
declare release_row public.releases;
declare track_rows jsonb;
begin
  select * into session_row from public.reaction_sessions
  where access_token = p_token and revoked_at is null and expires_at > now();
  if not found then return null; end if;

  select * into release_row from public.releases where id::text = session_row.release_id;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'title', title, 'artist_name', artist_name,
    'track_number', track_number
  ) order by track_number nulls last, created_at), '[]'::jsonb)
  into track_rows from public.releases where parent_id::text = session_row.release_id;

  return jsonb_build_object(
    'id', session_row.id,
    'scene', session_row.scene,
    'chart_type', session_row.chart_type,
    'track_id', session_row.track_id,
    'score', session_row.score,
    'revealed', session_row.revealed,
    'expires_at', session_row.expires_at,
    'comment', jsonb_build_object(
      'author', session_row.comment_author,
      'text', session_row.comment_text,
      'visible', session_row.comment_visible
    ),
    'release', jsonb_build_object(
      'id', release_row.id, 'title', release_row.title,
      'artist_name', release_row.artist_name, 'cover_url', release_row.cover_url,
      'release_type', release_row.release_type,
      'overall_score', release_row.overall_score,
      'community_score', coalesce(to_jsonb(release_row)->'community_score', to_jsonb(release_row)->'score_community'),
      'critics_score', coalesce(to_jsonb(release_row)->'critics_score', to_jsonb(release_row)->'score_critics')
    ),
    'tracks', track_rows
  );
end;
$$;

create function public.reaction_session_rate(p_token uuid, p_score integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_score is null or p_score not between 1 and 90 then
    raise exception 'Invalid studio rating';
  end if;
  update public.reaction_sessions set
    score = p_score, revealed = true, updated_at = now()
  where access_token = p_token and revoked_at is null and expires_at > now();
  return found;
end;
$$;

create function public.reaction_session_submit_rating(p_token uuid, p_score integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  session_row public.reaction_sessions;
  release_row public.releases;
  existing_review public.reviews;
begin
  if p_score is null or p_score not between 1 and 90 then
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

  update public.reaction_sessions set
    score = p_score, revealed = true, updated_at = now()
  where id = session_row.id;

  perform pg_advisory_xact_lock(hashtext(session_row.admin_id::text), hashtext(session_row.release_id));
  select * into existing_review from public.reviews
  where user_id = session_row.admin_id and release_id::text = session_row.release_id
  order by created_at desc limit 1 for update;

  if found then
    update public.reviews set
      rhymes = null, structure = null, style = null, individuality = null, vibe = null,
      scoring_model = 'holistic_v1', total_score = p_score, is_media_review = true
    where id = existing_review.id;
  else
    insert into public.reviews (
      release_id, user_id, title, content, rhymes, structure, style,
      individuality, vibe, scoring_model, total_score, is_media_review
    ) values (
      release_row.id, session_row.admin_id, 'შეფასება', '',
      null, null, null, null, null, 'holistic_v1', p_score, true
    );
  end if;
  return true;
end;
$$;

revoke all on function public.reaction_session_update(uuid, text, text, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.reaction_session_rate(uuid, integer) from public, anon, authenticated;
revoke all on function public.reaction_session_submit_rating(uuid, integer) from public, anon, authenticated;
grant execute on function public.reaction_session_update(uuid, text, text, text, integer, boolean) to authenticated;
grant execute on function public.reaction_session_rate(uuid, integer) to anon, authenticated;
grant execute on function public.reaction_session_submit_rating(uuid, integer) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
