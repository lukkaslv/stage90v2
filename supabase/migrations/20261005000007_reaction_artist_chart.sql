begin;

alter table public.reaction_sessions
  add column chart_type text not null default 'tracks'
  check (chart_type in ('tracks', 'artists'));

create or replace function public.reaction_session_set_chart(p_id uuid, p_chart_type text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.reaction_is_admin() then raise exception 'Access denied'; end if;
  if p_chart_type is null or p_chart_type not in ('tracks', 'artists') then
    raise exception 'Invalid chart type';
  end if;

  update public.reaction_sessions set chart_type = p_chart_type, updated_at = now()
  where id = p_id and admin_id = auth.uid() and revoked_at is null and expires_at > now();
  return found;
end;
$$;

revoke all on function public.reaction_session_set_chart(uuid, text) from public, anon, authenticated;
grant execute on function public.reaction_session_set_chart(uuid, text) to authenticated;

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
    'params', session_row.params,
    'vibe', session_row.vibe,
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

notify pgrst, 'reload schema';
commit;
