create table if not exists public.reaction_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  access_token uuid not null unique default gen_random_uuid(),
  release_id text not null,
  scene text not null default 'intro' check (scene in ('intro', 'tracks', 'score')),
  track_id text,
  params integer[] not null default array[5, 5, 5, 5],
  vibe integer not null default 3 check (vibe between 1 and 5),
  revealed boolean not null default false,
  expires_at timestamptz not null default (now() + interval '12 hours'),
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.reaction_sessions enable row level security;
revoke all on public.reaction_sessions from anon, authenticated;

create or replace function public.reaction_is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.reaction_session_create(p_release_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare created public.reaction_sessions;
begin
  if not public.reaction_is_admin() then raise exception 'Access denied'; end if;
  if not exists (select 1 from public.releases where id::text = p_release_id) then
    raise exception 'Release not found';
  end if;
  insert into public.reaction_sessions (admin_id, release_id)
  values (auth.uid(), p_release_id) returning * into created;
  return jsonb_build_object('id', created.id, 'token', created.access_token, 'expires_at', created.expires_at);
end;
$$;

create or replace function public.reaction_session_update(
  p_id uuid, p_release_id text, p_scene text, p_track_id text,
  p_params integer[], p_vibe integer, p_revealed boolean
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.reaction_is_admin() then raise exception 'Access denied'; end if;
  if p_scene not in ('intro', 'tracks', 'score') or p_scene is null
    or array_length(p_params, 1) is distinct from 4
    or exists (select 1 from unnest(p_params) as point where point is null or point not between 1 and 10)
    or p_vibe not between 1 and 5 or p_vibe is null then
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
    params = p_params, vibe = p_vibe, revealed = p_revealed, updated_at = now()
  where id = p_id and admin_id = auth.uid() and revoked_at is null and expires_at > now();
  return found;
end;
$$;

create or replace function public.reaction_session_revoke(p_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.reaction_is_admin() then raise exception 'Access denied'; end if;
  update public.reaction_sessions set revoked_at = now(), updated_at = now()
  where id = p_id and admin_id = auth.uid() and revoked_at is null;
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
    'track_id', session_row.track_id,
    'params', session_row.params,
    'vibe', session_row.vibe,
    'revealed', session_row.revealed,
    'expires_at', session_row.expires_at,
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

revoke all on function public.reaction_is_admin() from public, anon, authenticated;
revoke all on function public.reaction_session_create(text) from public, anon, authenticated;
revoke all on function public.reaction_session_update(uuid, text, text, text, integer[], integer, boolean) from public, anon, authenticated;
revoke all on function public.reaction_session_revoke(uuid) from public, anon, authenticated;
revoke all on function public.reaction_session_view(uuid) from public, anon, authenticated;
grant execute on function public.reaction_session_create(text) to authenticated;
grant execute on function public.reaction_session_update(uuid, text, text, text, integer[], integer, boolean) to authenticated;
grant execute on function public.reaction_session_revoke(uuid) to authenticated;
grant execute on function public.reaction_session_view(uuid) to anon, authenticated;
