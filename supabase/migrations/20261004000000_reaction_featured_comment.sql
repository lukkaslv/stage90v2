alter table public.reaction_sessions
  add column if not exists comment_author text,
  add column if not exists comment_text text,
  add column if not exists comment_visible boolean not null default false;

create or replace function public.reaction_session_set_comment(
  p_id uuid, p_author text, p_text text, p_visible boolean
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.reaction_is_admin() then raise exception 'Access denied'; end if;
  if p_visible is null then raise exception 'Invalid comment visibility'; end if;
  if p_visible and (
    p_author is null or char_length(btrim(p_author)) not between 1 and 60
    or p_text is null or char_length(btrim(p_text)) not between 1 and 160
  ) then raise exception 'Invalid featured comment'; end if;

  update public.reaction_sessions set
    comment_author = case when p_visible then btrim(p_author) else comment_author end,
    comment_text = case when p_visible then btrim(p_text) else comment_text end,
    comment_visible = p_visible,
    updated_at = now()
  where id = p_id and admin_id = auth.uid() and revoked_at is null and expires_at > now();
  return found;
end;
$$;

revoke all on function public.reaction_session_set_comment(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.reaction_session_set_comment(uuid, text, text, boolean) to authenticated;

create or replace function public.reaction_session_clear_comment_on_release_change()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.release_id is distinct from old.release_id then
    new.comment_author := null;
    new.comment_text := null;
    new.comment_visible := false;
  end if;
  return new;
end;
$$;

drop trigger if exists reaction_session_clear_comment_on_release_change on public.reaction_sessions;
create trigger reaction_session_clear_comment_on_release_change
  before update of release_id on public.reaction_sessions
  for each row execute function public.reaction_session_clear_comment_on_release_change();

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

revoke all on function public.reaction_session_view(uuid) from public, anon, authenticated;
grant execute on function public.reaction_session_view(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
