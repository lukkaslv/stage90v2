alter table public.releases add column if not exists author_profile_id uuid references public.profiles(id) on delete set null;
-- Release identifiers in existing installations may be numeric or UUID-like;
-- text keeps the relationship compatible with both deployed variants.
alter table public.releases add column if not exists parent_id text;
alter table public.releases add column if not exists track_number integer;

create index if not exists releases_parent_id_track_number_idx on public.releases(parent_id, track_number);
