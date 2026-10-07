-- Keep rank based on the exact average; expose scored-track milestones for status badges.
create or replace view public.artist_rankings with (security_invoker = true) as
with totals as (
  select a.id, a.name, a.photo_url, a.bio, a.social_links, a.created_at,
    coalesce(sum(c.overall_score) filter (where c.score_counted), 0)::bigint as total_score,
    coalesce(round(avg(c.overall_score) filter (where c.score_counted), 1), 0) as average_score,
    count(c.release_id) filter (where c.score_counted)::integer as rated_track_count,
    count(c.release_id) filter (where c.is_scoring_track)::integer as track_count,
    count(c.release_id)::integer as release_count,
    count(c.release_id) filter (where c.score_counted and c.overall_score >= 60)::integer as tracks_60_plus,
    count(c.release_id) filter (where c.score_counted and c.overall_score >= 70)::integer as tracks_70_plus
  from public.artists a left join public.artist_release_catalog c on c.artist_id = a.id
  where a.is_active group by a.id
), ranked as (
  select id, row_number() over (
    order by total_score::numeric / rated_track_count desc,
      rated_track_count desc, created_at asc, id asc
  )::integer as rank
  from totals where rated_track_count >= 3
)
select t.id, t.name, t.photo_url, t.bio, t.social_links, t.created_at,
  t.total_score, t.average_score, t.rated_track_count, t.track_count,
  t.release_count, r.rank, t.tracks_60_plus, t.tracks_70_plus
from totals t left join ranked r on r.id = t.id;

notify pgrst, 'reload schema';
