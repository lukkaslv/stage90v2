create table public.reaction_private_moments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reaction_sessions(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  release_id text not null,
  track_id text,
  cue text not null check (cue in ('story', 'feeling', 'contrast', 'change', 'response')),
  note text not null default '' check (char_length(note) <= 500),
  position_seconds integer check (position_seconds between 0 and 35999),
  created_at timestamptz not null default now()
);

create index reaction_private_moments_session_track_created
  on public.reaction_private_moments(session_id, release_id, track_id, created_at);

alter table public.reaction_private_moments enable row level security;
revoke all on public.reaction_private_moments from anon, authenticated;
grant select, insert, delete on public.reaction_private_moments to authenticated;

create function public.reaction_moment_session_allowed(
  p_session_id uuid, p_release_id text, p_track_id text, p_active boolean
)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.reaction_sessions session
    where session.id = p_session_id and session.admin_id = auth.uid()
      and (not p_active or (session.revoked_at is null and session.expires_at > now()))
      and session.release_id = p_release_id
      and (p_track_id is null or exists (
        select 1 from public.releases track
        where track.id::text = p_track_id and track.parent_id::text = p_release_id
      ))
  );
$$;

revoke all on function public.reaction_moment_session_allowed(uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.reaction_moment_session_allowed(uuid, text, text, boolean)
  to authenticated;

create policy "Admin reads own reaction moments"
  on public.reaction_private_moments for select to authenticated
  using (admin_id = auth.uid() and public.reaction_moment_session_allowed(
    session_id, release_id, track_id, false
  ));

create policy "Admin creates own reaction moments"
  on public.reaction_private_moments for insert to authenticated
  with check (admin_id = auth.uid() and public.reaction_moment_session_allowed(
    session_id, release_id, track_id, true
  ));

create policy "Admin deletes own reaction moments"
  on public.reaction_private_moments for delete to authenticated
  using (admin_id = auth.uid() and public.reaction_moment_session_allowed(
    session_id, release_id, track_id, false
  ));
