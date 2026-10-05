-- Artist identities are editorial profiles, independent of login accounts.
begin;

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique default gen_random_uuid()::text,
  photo_url text not null default '',
  bio text not null default '',
  social_links jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The installed database may already have an unused artists directory with
-- slug/image_url/verified_profile_id. Extend it without replacing IDs or relations.
alter table public.artists add column if not exists slug text not null default gen_random_uuid()::text;
alter table public.artists alter column slug set default gen_random_uuid()::text;
alter table public.artists add column if not exists photo_url text not null default '';
alter table public.artists add column if not exists bio text not null default '';
alter table public.artists add column if not exists social_links jsonb not null default '{}'::jsonb;
alter table public.artists add column if not exists is_active boolean not null default true;
alter table public.artists add column if not exists updated_at timestamptz not null default now();
update public.artists set bio = '' where bio is null;
alter table public.artists alter column bio set default '';
alter table public.artists alter column bio set not null;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'artists' and column_name = 'image_url') then
    execute 'update public.artists set photo_url = image_url where photo_url = '''' and image_url ~ ''^https://[^[:space:]]+$''';
  end if;
end;
$$;
alter table public.artists add constraint artist_profile_name_length check (length(trim(name)) between 1 and 100);
alter table public.artists add constraint artist_profile_photo_url check (photo_url = '' or photo_url ~ '^https://[^[:space:]]+$');
alter table public.artists add constraint artist_profile_bio_length check (length(bio) <= 3000);
alter table public.artists add constraint artist_profile_social_object check (jsonb_typeof(social_links) = 'object');

-- Match the installed release ID type (some installations use bigint, others UUID).
do $$
declare release_id_type text;
begin
  select format_type(atttypid, atttypmod) into release_id_type
  from pg_attribute where attrelid = 'public.releases'::regclass and attname = 'id';
  execute format('create table public.artist_releases (
    artist_id uuid not null references public.artists(id) on delete cascade,
    release_id %s not null references public.releases(id) on delete cascade,
    primary key (artist_id, release_id)
  )', release_id_type);
end;
$$;
create index artist_releases_release_idx on public.artist_releases(release_id);

create function public.artist_is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.artist_is_admin() from public;
grant execute on function public.artist_is_admin() to anon, authenticated;

alter table public.artists enable row level security;
alter table public.artist_releases enable row level security;
create policy artists_read on public.artists for select to anon, authenticated
  using (is_active or public.artist_is_admin());
create policy artists_admin on public.artists for all to authenticated
  using (public.artist_is_admin()) with check (public.artist_is_admin());
create policy artist_releases_read on public.artist_releases for select to anon, authenticated
  using (exists (select 1 from public.artists a where a.id = artist_id and a.is_active)
    or public.artist_is_admin());
create policy artist_releases_admin on public.artist_releases for all to authenticated
  using (public.artist_is_admin()) with check (public.artist_is_admin());
revoke all on public.artists, public.artist_releases from anon, authenticated;
grant select on public.artists, public.artist_releases to anon, authenticated;
grant delete on public.artists to authenticated;

-- Save metadata and the complete selection in one transaction, with conflict detection.
create function public.save_artist_profile(
  p_id uuid, p_name text, p_photo_url text, p_bio text, p_social_links jsonb,
  p_is_active boolean, p_release_ids text[], p_expected_updated_at timestamptz
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare saved_id uuid; current_version timestamptz; link record;
begin
  if not public.artist_is_admin() then raise exception 'Access denied' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 100
    or p_bio is null or length(p_bio) > 3000
    or p_photo_url is null or (p_photo_url <> '' and p_photo_url !~ '^https://[^[:space:]]+$')
    or p_social_links is null or jsonb_typeof(p_social_links) <> 'object'
    or p_is_active is null or p_release_ids is null then
    raise exception 'Invalid artist profile' using errcode = '22023';
  end if;
  for link in select * from jsonb_each(p_social_links) loop
    if link.key not in ('instagram', 'youtube', 'spotify', 'facebook', 'tiktok', 'soundcloud', 'website')
      or jsonb_typeof(link.value) <> 'string'
      or (link.value #>> '{}') !~ '^https://[^[:space:]]+$' then
      raise exception 'Invalid social link' using errcode = '22023';
    end if;
  end loop;
  if exists (select 1 from unnest(p_release_ids) selected(id)
    where selected.id is null or not exists (select 1 from public.releases r where r.id::text = selected.id)) then
    raise exception 'Release not found' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.artists(name, photo_url, bio, social_links, is_active)
      values (trim(p_name), p_photo_url, trim(p_bio), p_social_links, p_is_active) returning id into saved_id;
  else
    select updated_at into current_version from public.artists where id = p_id for update;
    if not found then raise exception 'Artist not found' using errcode = 'P0002'; end if;
    if current_version is distinct from p_expected_updated_at then
      raise exception 'Artist changed, reload before saving' using errcode = '40001';
    end if;
    update public.artists set name = trim(p_name), photo_url = p_photo_url, bio = trim(p_bio),
      social_links = p_social_links, is_active = p_is_active, updated_at = clock_timestamp()
      where id = p_id returning id into saved_id;
  end if;
  delete from public.artist_releases where artist_id = saved_id;
  insert into public.artist_releases(artist_id, release_id)
    select saved_id, r.id from public.releases r where r.id::text = any(p_release_ids);
  return saved_id;
end;
$$;
revoke all on function public.save_artist_profile(uuid,text,text,text,jsonb,boolean,text[],timestamptz) from public;
grant execute on function public.save_artist_profile(uuid,text,text,text,jsonb,boolean,text[],timestamptz) to authenticated;

-- UNION ensures an explicitly linked track that is also in a linked album counts once.
-- Collaborations may be explicitly linked to several artists and count once for each.
create view public.artist_release_catalog with (security_invoker = true) as
with linked as (
  select ar.artist_id, r.id as release_id
  from public.artist_releases ar join public.releases r on r.id = ar.release_id where r.is_active
  union
  select ar.artist_id, track.id
  from public.artist_releases ar
  join public.releases album on album.id = ar.release_id and album.is_active
  join public.releases track on track.parent_id::text = album.id::text and track.is_active
), catalog as (
  select a.id as artist_id, a.name as artist_display_name, a.photo_url as artist_photo_url,
    r.id as release_id, r.title, r.artist_name, r.cover_url, r.release_type,
    r.parent_id, r.track_number, r.created_at, r.overall_score,
    lower(trim(coalesce(r.release_type, ''))) not in ('album', 'ალბომი', 'ep', 'ეპი', 'mixtape', 'მიქსტეიპი')
      and not exists (select 1 from public.releases child where child.parent_id::text = r.id::text) as is_scoring_track
  from linked l join public.artists a on a.id = l.artist_id and a.is_active
  join public.releases r on r.id = l.release_id
)
select *, is_scoring_track and overall_score > 0 as score_counted from catalog;

create view public.artist_rankings with (security_invoker = true) as
with totals as (
  select a.id, a.name, a.photo_url, a.bio, a.social_links, a.created_at,
    coalesce(sum(c.overall_score) filter (where c.score_counted), 0)::bigint as total_score,
    coalesce(round(avg(c.overall_score) filter (where c.score_counted), 1), 0) as average_score,
    count(c.release_id) filter (where c.score_counted)::integer as rated_track_count,
    count(c.release_id) filter (where c.is_scoring_track)::integer as track_count,
    count(c.release_id)::integer as release_count
  from public.artists a left join public.artist_release_catalog c on c.artist_id = a.id
  where a.is_active group by a.id
), ranked as (
  select id, row_number() over (order by total_score desc, average_score desc, created_at asc, id asc)::integer as rank
  from totals where total_score > 0
)
select t.*, r.rank from totals t left join ranked r on r.id = t.id;

grant select on public.artist_release_catalog, public.artist_rankings to anon, authenticated;

-- Artist portraits: public images, admin-only upload/removal, no login profile access needed.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('artist-photos', 'artist-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy artist_photos_read on storage.objects for select to anon, authenticated using (bucket_id = 'artist-photos');
create policy artist_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'artist-photos' and public.artist_is_admin());
create policy artist_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'artist-photos' and public.artist_is_admin());

do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['artists', 'artist_releases', 'releases'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
