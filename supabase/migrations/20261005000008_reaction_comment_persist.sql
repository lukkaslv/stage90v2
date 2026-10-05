create or replace function public.reaction_session_clear_comment_on_release_change()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.release_id is distinct from old.release_id then
    new.comment_visible := false;
  end if;
  return new;
end;
$$;
