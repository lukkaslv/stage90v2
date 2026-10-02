create or replace function public.refresh_release_scores(target_release_id text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  community integer;
  critics integer;
  computed_tier text;
  score_column text;
begin
  select
    round(avg(review.total_score) filter (where profile.role in ('user', 'author')))::integer,
    round(avg(review.total_score) filter (where profile.role in ('media', 'admin')))::integer
  into community, critics
  from public.reviews review
  join public.profiles profile on profile.id = review.user_id
  where review.release_id::text = target_release_id;

  computed_tier := case
    when community >= 85 then 'ლალი'
    when community >= 75 then 'საფირონი'
    when community >= 65 then 'ზურმუხტი'
    when community >= 50 then 'ოქრო'
    else 'ვერცხლი'
  end;

  foreach score_column in array array['community_score', 'score_community'] loop
    if exists (select 1 from information_schema.columns candidate
      where candidate.table_schema = 'public' and candidate.table_name = 'releases' and candidate.column_name = score_column) then
      execute format('update public.releases set %I = $2 where id::text = $1', score_column)
        using target_release_id, coalesce(community, 0);
    end if;
  end loop;

  foreach score_column in array array['critics_score', 'score_critics'] loop
    if exists (select 1 from information_schema.columns candidate
      where candidate.table_schema = 'public' and candidate.table_name = 'releases' and candidate.column_name = score_column) then
      execute format('update public.releases set %I = $2 where id::text = $1', score_column)
        using target_release_id, coalesce(critics, 0);
    end if;
  end loop;

  if exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'releases' and column_name = 'value_tier') then
    update public.releases set value_tier = computed_tier where id::text = target_release_id;
  end if;
end;
$$;

revoke all on function public.refresh_release_scores(text) from public, anon, authenticated;

create or replace function public.on_release_review_changed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_release_scores(old.release_id::text);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.release_id is distinct from new.release_id then
    perform public.refresh_release_scores(old.release_id::text);
  end if;
  perform public.refresh_release_scores(new.release_id::text);
  return new;
end;
$$;

drop trigger if exists recalculate_release_scores on public.reviews;
create trigger recalculate_release_scores
  after insert or update of release_id, user_id, total_score or delete on public.reviews
  for each row execute function public.on_release_review_changed();

create or replace function public.on_reviewer_role_changed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  reviewed_release_id text;
begin
  if new.role is distinct from old.role then
    for reviewed_release_id in
      select distinct review.release_id::text from public.reviews review where review.user_id = new.id
    loop
      perform public.refresh_release_scores(reviewed_release_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists recalculate_release_scores_for_role on public.profiles;
create trigger recalculate_release_scores_for_role
  after update of role on public.profiles
  for each row execute function public.on_reviewer_role_changed();

do $$
declare
  release_id text;
begin
  for release_id in select id::text from public.releases loop
    perform public.refresh_release_scores(release_id);
  end loop;
end;
$$;
