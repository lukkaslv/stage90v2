-- One review contributes one vote to the release's overall score, regardless of role.
-- Community and media averages remain available in their existing columns.
alter table public.releases add column if not exists overall_score integer not null default 0;

create or replace function public.refresh_release_scores(target_release_id text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  overall integer;
  community integer;
  media integer;
  computed_tier text;
  score_column text;
begin
  select
    round(avg(review.total_score))::integer,
    round(avg(review.total_score) filter (where profile.role in ('user', 'author', 'admin')))::integer,
    round(avg(review.total_score) filter (where profile.role = 'media'))::integer
  into overall, community, media
  from public.reviews review
  left join public.profiles profile on profile.id = review.user_id
  where review.release_id::text = target_release_id;

  computed_tier := case
    when overall >= 85 then 'ლალი'
    when overall >= 75 then 'საფირონი'
    when overall >= 65 then 'ზურმუხტი'
    when overall >= 50 then 'ოქრო'
    else 'ვერცხლი'
  end;

  update public.releases set overall_score = coalesce(overall, 0)
    where id::text = target_release_id;

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
        using target_release_id, coalesce(media, 0);
    end if;
  end loop;

  if exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'releases' and column_name = 'value_tier') then
    update public.releases set value_tier = computed_tier where id::text = target_release_id;
  end if;
end;
$$;

revoke all on function public.refresh_release_scores(text) from public, anon, authenticated;

do $$
declare
  release_id text;
begin
  for release_id in select id::text from public.releases loop
    perform public.refresh_release_scores(release_id);
  end loop;
end;
$$;

-- Rollback: restore refresh_release_scores from 20261002000007_review_score_sources.sql,
-- recalculate releases, then drop public.releases.overall_score.
