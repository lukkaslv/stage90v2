-- Stage 90 achievements. Existing public.achievements data is deliberately preserved.
-- A season is a calendar year in Asia/Tbilisi; scope_year = 0 means lifetime.
create table if not exists public.achievement_definitions (
  key text primary key,
  category text not null check (category in ('listener', 'media')),
  scope text not null check (scope in ('lifetime', 'annual')),
  title_ka text not null,
  description_ka text not null,
  target integer not null check (target > 0)
);

insert into public.achievement_definitions (key, category, scope, title_ka, description_ka, target) values
  ('listener_first_voice','listener','lifetime','პირველი ხმა','პირველი მოქმედი შეფასება',1),
  ('listener_first_review','listener','lifetime','პირველი რეცენზია','პირველი გამოქვეყნებული რეცენზია',1),
  ('listener_explorer','listener','annual','აღმომჩენი','წელიწადში 10 რელიზი სულ მცირე 5 სხვადასხვა არტისტისგან',10),
  ('listener_researcher','listener','annual','სცენის მკვლევარი','წელიწადში 5 სხვადასხვა არტისტის რეცენზია',5),
  ('listener_author_choice','listener','lifetime','ავტორის რჩეული','რეცენზია მოიწონა ამ რელიზის დადასტურებულმა ავტორმა',1),
  ('media_first_review','media','lifetime','პირველი რეცენზია','პირველი გამოქვეყნებული მედიარეცენზია',1),
  ('media_scene_voice','media','annual','სცენის ხმა','წელიწადში 10 სხვადასხვა არტისტის რეცენზია',10),
  ('media_researcher','media','annual','სცენის მკვლევარი','წელიწადში 5 სხვადასხვა არტისტის რეცენზია',5),
  ('media_author_recognition','media','annual','ავტორთა აღიარება','წელიწადში 3 სხვადასხვა არტისტის მოწონება',3),
  ('media_new_voice','media','annual','ახალი ხმის აღმოჩენა','წელიწადში 3 ახალი არტისტის რეცენზია',3)
on conflict (key) do update set title_ka = excluded.title_ka,
  description_ka = excluded.description_ka, target = excluded.target;

create table if not exists public.achievement_grants (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null references public.achievement_definitions(key),
  scope_year integer not null default 0 check (scope_year = 0 or scope_year between 2020 and 9999),
  earned_at timestamptz not null,
  primary key (user_id, achievement_key, scope_year)
);
create index if not exists achievement_grants_key_year_idx on public.achievement_grants(achievement_key, scope_year);

create table if not exists public.achievement_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  achievement_key text not null,
  scope_year integer not null,
  action text not null check (action in ('awarded','revoked')),
  changed_at timestamptz not null default now(),
  reason text not null
);

-- Publication time is recorded on transitions to active. Existing active releases
-- use created_at as the only available historical publication proxy.
alter table public.releases add column if not exists achievement_published_at timestamptz;
update public.releases set achievement_published_at = created_at
  where is_active = true and achievement_published_at is null;
create index if not exists achievement_reviews_user_year_idx on public.reviews(user_id, created_at, release_id);
create index if not exists achievement_likes_review_author_idx on public.review_author_likes(review_id, author_id, created_at);
create index if not exists achievement_releases_publication_idx on public.releases(achievement_published_at)
  where is_active = true;

create or replace function public.achievement_release_publication()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    new.achievement_published_at := coalesce(new.achievement_published_at, now());
  end if;
  return new;
end $$;
drop trigger if exists achievement_release_publication on public.releases;
create trigger achievement_release_publication before insert or update of is_active on public.releases
for each row execute function public.achievement_release_publication();

-- The application writes both ratings without text and full reviews to reviews.
-- A published review is identified by the existing form's 300-character minimum.
create or replace view public.achievement_eligible_reviews with (security_invoker = true) as
select r.id, r.user_id, r.release_id, r.created_at, r.total_score,
       length(trim(coalesce(r.content, ''))) >= 300 as is_written,
       p.role, coalesce(x.author_profile_id::text, lower(nullif(trim(x.artist_name), '')), x.id::text) as artist_key,
       (coalesce(x.is_freshman, false) or coalesce(x.is_new_name, false)) as is_new_name
from public.reviews r
join public.profiles p on p.id = r.user_id
join public.releases x on x.id = r.release_id
where x.is_active = true and r.total_score between 1 and 90;

create or replace function public.achievement_set_grant(p_user uuid, p_key text, p_year integer, p_eligible boolean, p_earned timestamptz)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare changed integer;
begin
  if p_eligible then
    insert into public.achievement_grants(user_id, achievement_key, scope_year, earned_at)
      values (p_user, p_key, p_year, coalesce(p_earned, now())) on conflict do nothing;
    get diagnostics changed = row_count;
    if changed > 0 then
      insert into public.achievement_audit(user_id, achievement_key, scope_year, action, reason)
      values (p_user, p_key, p_year, 'awarded', 'source reconciliation');
    end if;
  else
    delete from public.achievement_grants
      where user_id = p_user and achievement_key = p_key and scope_year = p_year;
    get diagnostics changed = row_count;
    if changed > 0 then
      insert into public.achievement_audit(user_id, achievement_key, scope_year, action, reason)
      values (p_user, p_key, p_year, 'revoked', 'source no longer eligible');
    end if;
  end if;
end $$;
revoke all on function public.achievement_set_grant(uuid,text,integer,boolean,timestamptz) from public, anon, authenticated;

create or replace function public.refresh_achievements(p_user uuid, p_year integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role text;
  v_first_rating timestamptz;
  v_first_review timestamptz;
  v_releases integer;
  v_rating_artists integer;
  v_review_artists integer;
  v_new_artists integer;
  v_author_likes integer;
  v_season_likes integer;
  v_first_like timestamptz;
  v_tenth_rating timestamptz;
  v_fifth_artist timestamptz;
  v_fifth_review_artist timestamptz;
  v_tenth_review_artist timestamptz;
  v_third_new_artist timestamptz;
  v_third_author_like timestamptz;
begin
  if p_year < 2020 or p_year > 9999 then raise exception 'Invalid season'; end if;
  select role into v_role from public.profiles where id = p_user;
  if v_role is null then return; end if;

  select min(created_at), min(created_at) filter (where is_written)
    into v_first_rating, v_first_review
    from public.achievement_eligible_reviews where user_id = p_user;

  select count(distinct release_id), count(distinct artist_key),
         count(distinct artist_key) filter (where is_written),
         count(distinct artist_key) filter (where is_written and is_new_name)
    into v_releases, v_rating_artists, v_review_artists, v_new_artists
    from public.achievement_eligible_reviews
    where user_id = p_user and extract(year from created_at at time zone 'Asia/Tbilisi')::integer = p_year;

  select count(distinct l.author_id),
         count(distinct l.author_id) filter (where extract(year from l.created_at at time zone 'Asia/Tbilisi')::integer = p_year),
         min(l.created_at)
    into v_author_likes, v_season_likes, v_first_like
    from public.review_author_likes l
    join public.achievement_eligible_reviews r on r.id = l.review_id and r.user_id = p_user and r.is_written
    join public.releases x on x.id = r.release_id and x.author_profile_id = l.author_id
    join public.profiles a on a.id = l.author_id and a.role = 'author' and a.is_verified = true
    where l.author_id <> p_user;

  select first_at into v_tenth_rating from (
    select min(created_at) as first_at from public.achievement_eligible_reviews
    where user_id = p_user and extract(year from created_at at time zone 'Asia/Tbilisi')::integer = p_year
    group by release_id order by first_at limit 1 offset 9
  ) threshold;
  select first_at into v_fifth_artist from (
    select min(created_at) as first_at from public.achievement_eligible_reviews
    where user_id = p_user and extract(year from created_at at time zone 'Asia/Tbilisi')::integer = p_year
    group by artist_key order by first_at limit 1 offset 4
  ) threshold;
  select first_at into v_fifth_review_artist from (
    select min(created_at) as first_at from public.achievement_eligible_reviews
    where user_id = p_user and is_written
      and extract(year from created_at at time zone 'Asia/Tbilisi')::integer = p_year
    group by artist_key order by first_at limit 1 offset 4
  ) threshold;
  select first_at into v_tenth_review_artist from (
    select min(created_at) as first_at from public.achievement_eligible_reviews
    where user_id = p_user and is_written
      and extract(year from created_at at time zone 'Asia/Tbilisi')::integer = p_year
    group by artist_key order by first_at limit 1 offset 9
  ) threshold;
  select first_at into v_third_new_artist from (
    select min(created_at) as first_at from public.achievement_eligible_reviews
    where user_id = p_user and is_written and is_new_name
      and extract(year from created_at at time zone 'Asia/Tbilisi')::integer = p_year
    group by artist_key order by first_at limit 1 offset 2
  ) threshold;
  select first_at into v_third_author_like from (
    select min(l.created_at) as first_at from public.review_author_likes l
    join public.achievement_eligible_reviews r on r.id = l.review_id and r.user_id = p_user and r.is_written
    join public.releases x on x.id = r.release_id and x.author_profile_id = l.author_id
    join public.profiles a on a.id = l.author_id and a.role = 'author' and a.is_verified
    where l.author_id <> p_user
      and extract(year from l.created_at at time zone 'Asia/Tbilisi')::integer = p_year
    group by l.author_id order by first_at limit 1 offset 2
  ) threshold;

  perform public.achievement_set_grant(p_user,'listener_first_voice',0,v_role in ('user','author','admin') and v_first_rating is not null,v_first_rating);
  perform public.achievement_set_grant(p_user,'listener_first_review',0,v_role in ('user','author','admin') and v_first_review is not null,v_first_review);
  perform public.achievement_set_grant(p_user,'listener_explorer',p_year,v_role in ('user','author','admin') and v_releases >= 10 and v_rating_artists >= 5,greatest(v_tenth_rating,v_fifth_artist));
  perform public.achievement_set_grant(p_user,'listener_researcher',p_year,v_role in ('user','author','admin') and v_review_artists >= 5,v_fifth_review_artist);
  perform public.achievement_set_grant(p_user,'listener_author_choice',0,v_role in ('user','author','admin') and v_author_likes >= 1,v_first_like);
  perform public.achievement_set_grant(p_user,'media_first_review',0,v_role = 'media' and v_first_review is not null,v_first_review);
  perform public.achievement_set_grant(p_user,'media_scene_voice',p_year,v_role = 'media' and v_review_artists >= 10,v_tenth_review_artist);
  perform public.achievement_set_grant(p_user,'media_researcher',p_year,v_role = 'media' and v_review_artists >= 5,v_fifth_review_artist);
  perform public.achievement_set_grant(p_user,'media_author_recognition',p_year,v_role = 'media' and v_season_likes >= 3,v_third_author_like);
  perform public.achievement_set_grant(p_user,'media_new_voice',p_year,v_role = 'media' and v_new_artists >= 3,v_third_new_artist);
end $$;
revoke all on function public.refresh_achievements(uuid,integer) from public, anon, authenticated;

create or replace function public.achievement_review_changed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op in ('DELETE','UPDATE') then
    perform public.refresh_achievements(old.user_id, extract(year from old.created_at at time zone 'Asia/Tbilisi')::integer);
  end if;
  if tg_op in ('INSERT','UPDATE') then
    perform public.refresh_achievements(new.user_id, extract(year from new.created_at at time zone 'Asia/Tbilisi')::integer);
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists achievement_review_changed on public.reviews;
create trigger achievement_review_changed after insert or update or delete on public.reviews
for each row execute function public.achievement_review_changed();

create or replace function public.achievement_like_changed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid; v_year integer;
begin
  if tg_op in ('DELETE','UPDATE') then
    select r.user_id, extract(year from old.created_at at time zone 'Asia/Tbilisi')::integer
      into v_user,v_year from public.reviews r where r.id = old.review_id;
    if v_user is not null then perform public.refresh_achievements(v_user,v_year); end if;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    select r.user_id, extract(year from new.created_at at time zone 'Asia/Tbilisi')::integer
      into v_user,v_year from public.reviews r where r.id = new.review_id;
    if v_user is not null then perform public.refresh_achievements(v_user,v_year); end if;
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists achievement_like_changed on public.review_author_likes;
create trigger achievement_like_changed after insert or update or delete on public.review_author_likes
for each row execute function public.achievement_like_changed();

create or replace function public.achievement_profile_changed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare item record;
begin
  if old.role is distinct from new.role or old.is_verified is distinct from new.is_verified then
    for item in select distinct extract(year from r.created_at at time zone 'Asia/Tbilisi')::integer as y
      from public.reviews r where r.user_id = new.id loop
      perform public.refresh_achievements(new.id,item.y);
    end loop;
    if old.is_verified is distinct from new.is_verified or old.role is distinct from new.role then
      for item in select distinct r.user_id,
          extract(year from l.created_at at time zone 'Asia/Tbilisi')::integer as y
        from public.review_author_likes l join public.reviews r on r.id = l.review_id
        where l.author_id = new.id loop
        perform public.refresh_achievements(item.user_id,item.y);
      end loop;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists achievement_profile_changed on public.profiles;
create trigger achievement_profile_changed after update of role, is_verified on public.profiles
for each row execute function public.achievement_profile_changed();

create or replace function public.achievement_release_changed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare row_item record;
begin
  for row_item in select distinct r.user_id, extract(year from r.created_at at time zone 'Asia/Tbilisi')::integer as y
    from public.reviews r where r.release_id = new.id loop
    perform public.refresh_achievements(row_item.user_id,row_item.y);
  end loop;
  return new;
end $$;
drop trigger if exists achievement_release_changed on public.releases;
create trigger achievement_release_changed after update of is_active, is_new_name, is_freshman, artist_name, author_profile_id on public.releases
for each row execute function public.achievement_release_changed();

alter table public.achievement_definitions enable row level security;
alter table public.achievement_grants enable row level security;
alter table public.achievement_audit enable row level security;
create policy "Read achievement definitions" on public.achievement_definitions for select using (true);
create policy "Read own achievement grants" on public.achievement_grants for select using (user_id = auth.uid());
grant select on public.achievement_definitions to anon, authenticated;
grant select on public.achievement_grants to authenticated;

create or replace view public.achievement_recipient_summary as
select g.achievement_key, g.scope_year, count(*)::integer as recipient_count,
  (array_agg(p.display_name order by g.earned_at desc))[1:3] as recent_recipients
from public.achievement_grants g join public.profiles p on p.id = g.user_id
group by g.achievement_key, g.scope_year;
grant select on public.achievement_recipient_summary to anon, authenticated;

-- Progress is derived from source rows; clients cannot submit counters.
create or replace function public.my_achievement_progress(p_year integer)
returns table(achievement_key text, progress integer, target integer, earned_at timestamptz, scope_year integer,
              secondary_progress integer, secondary_target integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role text;
begin
  if auth.uid() is null or p_year < 2020 or p_year > 9999 then raise exception 'Invalid request'; end if;
  select role into v_role from public.profiles where id = auth.uid();
  return query
  with eligible as (
    select r.* from public.achievement_eligible_reviews r where r.user_id = auth.uid()
  ), annual as (
    select * from eligible where extract(year from created_at at time zone 'Asia/Tbilisi')::integer = p_year
  ), likes as (
    select distinct l.author_id,
      extract(year from l.created_at at time zone 'Asia/Tbilisi')::integer as liked_year
    from public.review_author_likes l
    join eligible r on r.id = l.review_id and r.is_written
    join public.releases x on x.id = r.release_id and x.author_profile_id = l.author_id
    join public.profiles a on a.id = l.author_id and a.role = 'author' and a.is_verified
    where l.author_id <> auth.uid()
  ), counts as (
    select
      (select count(distinct release_id)::integer from eligible) as lifetime_ratings,
      (select count(distinct release_id)::integer from eligible where is_written) as lifetime_reviews,
      (select count(distinct release_id)::integer from annual) as annual_releases,
      (select count(distinct artist_key)::integer from annual) as annual_artists,
      (select count(distinct artist_key)::integer from annual where is_written) as annual_review_artists,
      (select count(distinct artist_key)::integer from annual where is_written and is_new_name) as annual_new_artists,
      (select count(distinct author_id)::integer from likes) as lifetime_likes,
      (select count(distinct author_id)::integer from likes where liked_year = p_year) as annual_likes
  )
  select d.key,
    case d.key
      when 'listener_first_voice' then least(c.lifetime_ratings,1)
      when 'listener_first_review' then least(c.lifetime_reviews,1)
      when 'listener_explorer' then c.annual_releases
      when 'listener_researcher' then c.annual_review_artists
      when 'listener_author_choice' then least(c.lifetime_likes,1)
      when 'media_first_review' then least(c.lifetime_reviews,1)
      when 'media_scene_voice' then c.annual_review_artists
      when 'media_researcher' then c.annual_review_artists
      when 'media_author_recognition' then c.annual_likes
      when 'media_new_voice' then c.annual_new_artists
      else 0 end,
    d.target, g.earned_at, case when d.scope = 'lifetime' then 0 else p_year end,
    case when d.key = 'listener_explorer' then c.annual_artists else null end,
    case when d.key = 'listener_explorer' then 5 else null end
  from public.achievement_definitions d cross join counts c
  left join public.achievement_grants g on g.user_id = auth.uid() and g.achievement_key = d.key
    and g.scope_year = case when d.scope = 'lifetime' then 0 else p_year end
  where (d.category = 'media' and v_role = 'media')
     or (d.category = 'listener' and v_role in ('user','author','admin'));
end $$;
grant execute on function public.my_achievement_progress(integer) to authenticated;

-- One result per year, award, and release format. NULL winner means no eligible candidate.
do $$
declare release_id_type text;
begin
  select format_type(a.atttypid,a.atttypmod) into release_id_type
  from pg_attribute a where a.attrelid = 'public.releases'::regclass
    and a.attname = 'id' and a.attnum > 0 and not a.attisdropped;
  if release_id_type is null then raise exception 'releases.id is unavailable'; end if;
  execute format($ddl$
    create table if not exists public.annual_release_awards (
      season_year integer not null check (season_year between 2020 and 9999),
      award_key text not null check (award_key in ('listeners_choice','media_choice','release_of_year','discovery_of_year')),
      release_format text not null,
      release_id %s references public.releases(id) on delete set null,
      release_title text,
      artist_name text,
      final_score numeric(7,3),
      listener_count integer not null default 0,
      media_count integer not null default 0,
      candidate_count integer not null default 0,
      rule_version text not null default 'v1',
      calculated_at timestamptz not null default now(),
      corrected_at timestamptz,
      primary key (season_year, award_key, release_format)
    )$ddl$, release_id_type);
end $$;
create table if not exists public.annual_release_award_audit (
  id bigint generated always as identity primary key,
  season_year integer not null,
  award_key text not null,
  release_format text not null,
  previous_result jsonb,
  new_result jsonb not null,
  actor_id uuid,
  reason text not null,
  changed_at timestamptz not null default now()
);
alter table public.annual_release_awards enable row level security;
alter table public.annual_release_award_audit enable row level security;
create policy "Read annual release awards" on public.annual_release_awards for select using (true);
grant select on public.annual_release_awards to anon, authenticated;

-- Call from pg_cron once the new Tbilisi year has begun. Admins can explicitly
-- correct a finalized year with a reason; ordinary reruns leave rows untouched.
create or replace function public.finalize_annual_release_awards(p_year integer, p_correct boolean default false, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row record; v_old jsonb; v_actor uuid := auth.uid();
begin
  if p_year < 2020 or p_year >= extract(year from now() at time zone 'Asia/Tbilisi')::integer then
    raise exception 'Season is not closed';
  end if;
  if v_actor is not null and not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'Administrator required';
  end if;
  if v_actor is null and session_user <> 'postgres' then raise exception 'Administrator required'; end if;
  if p_correct and (v_actor is null or nullif(trim(p_reason),'') is null) then
    raise exception 'An administrator and a reason are required for correction';
  end if;
  perform pg_advisory_xact_lock(90090, p_year);

  for v_row in
    with formats as (
      select distinct case
        when lower(trim(release_type)) in ('album','ალბომი') then 'album'
        when lower(trim(release_type)) in ('ep','მინიალბომი') then 'ep'
        when lower(trim(release_type)) in ('single','სინგლი','track','ტრეკი') then 'single'
        else coalesce(nullif(lower(trim(release_type)),''),'other') end as release_format
      from public.releases where is_active and achievement_published_at >= make_timestamptz(p_year,1,1,0,0,0,'Asia/Tbilisi')
        and achievement_published_at < make_timestamptz(p_year+1,1,1,0,0,0,'Asia/Tbilisi')
      union select release_format from public.annual_release_awards where season_year = p_year
    ), award_types as (
      select unnest(array['listeners_choice','media_choice','release_of_year','discovery_of_year']) as award_key
    ), valid_votes as (
      select r.release_id, r.user_id, r.total_score, p.role,
        row_number() over (partition by r.release_id,r.user_id order by r.created_at desc,r.id desc) as vote_rank
      from public.reviews r join public.profiles p on p.id = r.user_id
      where r.total_score between 1 and 90
    ), candidates as (
      select x.id as release_id,
        case when lower(trim(x.release_type)) in ('album','ალბომი') then 'album'
             when lower(trim(x.release_type)) in ('ep','მინიალბომი') then 'ep'
             when lower(trim(x.release_type)) in ('single','სინგლი','track','ტრეკი') then 'single'
             else coalesce(nullif(lower(trim(x.release_type)),''),'other') end as release_format,
        (coalesce(x.is_new_name,false) or coalesce(x.is_freshman,false)) as newcomer,
        avg(r.total_score) filter (where r.role in ('user','author','admin')) as listener_score,
        avg(r.total_score) filter (where r.role = 'media') as media_score,
        avg(r.total_score) as overall_score,
        count(distinct r.user_id) filter (where r.role in ('user','author','admin'))::integer as listener_count,
        count(distinct r.user_id) filter (where r.role = 'media')::integer as media_count
      from public.releases x
      left join valid_votes r on r.release_id = x.id and r.vote_rank = 1
      where x.is_active and x.achievement_published_at >= make_timestamptz(p_year,1,1,0,0,0,'Asia/Tbilisi')
        and x.achievement_published_at < make_timestamptz(p_year+1,1,1,0,0,0,'Asia/Tbilisi')
      group by x.id
    ), ranked as (
      select a.award_key, c.*,
        case a.award_key when 'listeners_choice' then listener_score
             when 'media_choice' then media_score else overall_score end as final_score,
        row_number() over (partition by a.award_key,c.release_format order by
          case a.award_key when 'listeners_choice' then listener_score
               when 'media_choice' then media_score else overall_score end desc nulls last,
          (listener_count + media_count) desc, c.release_id asc) as rank,
        count(*) over (partition by a.award_key,c.release_format)::integer as candidate_count
      from candidates c cross join award_types a
      where (a.award_key = 'listeners_choice' and c.listener_count >= 5)
         or (a.award_key = 'media_choice' and c.media_count >= 3)
         or (a.award_key = 'release_of_year' and c.listener_count >= 5 and c.media_count >= 3)
         or (a.award_key = 'discovery_of_year' and c.newcomer and c.listener_count >= 5 and c.media_count >= 3)
    )
    select p_year as season_year, a.award_key, f.release_format,
           r.release_id, x.title as release_title, x.artist_name,
           r.final_score, coalesce(r.listener_count,0) as listener_count,
           coalesce(r.media_count,0) as media_count, coalesce(r.candidate_count,0) as candidate_count
    from formats f cross join award_types a
    left join ranked r on r.award_key = a.award_key and r.release_format = f.release_format and r.rank = 1
    left join public.releases x on x.id = r.release_id
  loop
    select to_jsonb(t) into v_old from public.annual_release_awards t
      where t.season_year = p_year and t.award_key = v_row.award_key and t.release_format = v_row.release_format;
    if v_old is not null and not p_correct then continue; end if;
    insert into public.annual_release_awards(season_year,award_key,release_format,release_id,release_title,artist_name,final_score,listener_count,media_count,candidate_count,corrected_at)
      values (p_year,v_row.award_key,v_row.release_format,v_row.release_id,v_row.release_title,v_row.artist_name,v_row.final_score,v_row.listener_count,v_row.media_count,v_row.candidate_count,
              case when v_old is null then null else now() end)
    on conflict (season_year,award_key,release_format) do update
      set release_id = excluded.release_id, release_title = excluded.release_title, artist_name = excluded.artist_name,
          final_score = excluded.final_score,
          listener_count = excluded.listener_count, media_count = excluded.media_count,
          candidate_count = excluded.candidate_count, corrected_at = now();
    insert into public.annual_release_award_audit(season_year,award_key,release_format,previous_result,new_result,actor_id,reason)
      values (p_year,v_row.award_key,v_row.release_format,v_old,to_jsonb(v_row),v_actor,
              case when v_old is null then 'annual finalization' else p_reason end);
  end loop;
end $$;
revoke all on function public.finalize_annual_release_awards(integer,boolean,text) from public, anon;
grant execute on function public.finalize_annual_release_awards(integer,boolean,text) to authenticated;

-- Explicit, repeatable backfill for years with reliable source timestamps.
create or replace function public.reconcile_achievements(p_from_year integer, p_to_year integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare item record;
begin
  if p_from_year < 2020 or p_to_year > extract(year from now() at time zone 'Asia/Tbilisi')::integer
    or p_to_year < p_from_year or p_to_year - p_from_year > 20 then raise exception 'Invalid range'; end if;
  if auth.uid() is not null and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Administrator required';
  end if;
  if auth.uid() is null and session_user <> 'postgres' then raise exception 'Administrator required'; end if;
  for item in select distinct r.user_id,
      extract(year from r.created_at at time zone 'Asia/Tbilisi')::integer as season_year
      from public.reviews r
      where extract(year from r.created_at at time zone 'Asia/Tbilisi')::integer between p_from_year and p_to_year
    loop perform public.refresh_achievements(item.user_id,item.season_year); end loop;
end $$;
revoke all on function public.reconcile_achievements(integer,integer) from public, anon;
grant execute on function public.reconcile_achievements(integer,integer) to authenticated;

-- Schedule in Supabase when pg_cron is installed. Reconciliation is also safe to rerun.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('stage90-finalize-year','10 12 * * *',
      'select public.finalize_annual_release_awards(extract(year from now() at time zone ''Asia/Tbilisi'')::integer - 1)');
  end if;
exception when undefined_function or insufficient_privilege then
  raise notice 'Register stage90-finalize-year in production scheduler';
end $$;
