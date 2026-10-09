import type { Release } from '@/types/music';

export function normalizeCatalogRelease(row: Record<string, unknown>): Release {
  const item = row;
  const score = Number(item.overall_score ?? item.score ?? item.total_score ?? item.score_community ?? 0);
  const joinedReviews = Array.isArray(item.reviews) ? item.reviews[0] as Record<string, unknown> | undefined : item.reviews as Record<string, unknown> | undefined;
  const parsedId = typeof item.id === 'number' ? item.id : String(item.id ?? '');
  return {
    id: parsedId,
    title: String(item.title ?? ''),
    artist: String(item.artist ?? item.artist_name ?? ''),
    coverUrl: String(item.cover_url ?? item.coverUrl ?? ''),
    type: String(item.release_type ?? item.type ?? '') as Release['type'],
    release_type: item.release_type ? String(item.release_type) : undefined,
    year: Number(item.year ?? new Date().getFullYear()),
    score,
    overall_score: item.overall_score == null ? undefined : Number(item.overall_score),
    preliminary_score: item.preliminary_score == null ? undefined : Number(item.preliminary_score),
    eligible_voter_count: item.eligible_voter_count == null ? undefined : Number(item.eligible_voter_count),
    valueTier: typeof item.value_tier === 'string' ? item.value_tier : undefined,
    score_community: item.score_community == null ? undefined : Number(item.score_community),
    community_score: item.community_score == null && item.score_community == null ? undefined : Number(item.community_score ?? item.score_community),
    score_critics: item.score_critics == null ? undefined : Number(item.score_critics),
    critics_score: item.critics_score == null && item.score_critics == null ? undefined : Number(item.critics_score ?? item.score_critics),
    reviewCount: Number(joinedReviews?.count ?? item.reviews_count ?? item.total_reviews_count ?? item.review_count ?? item.reviewCount ?? 0),
    reviews_count: Number(joinedReviews?.count ?? item.reviews_count ?? item.total_reviews_count ?? item.review_count ?? item.reviewCount ?? 0),
    total_reviews_count: Number(joinedReviews?.count ?? item.total_reviews_count ?? item.reviews_count ?? item.review_count ?? item.reviewCount ?? 0),
    reviews: Array.isArray(item.reviews) ? item.reviews : undefined,
    value_tier: typeof item.value_tier === 'string' ? item.value_tier : undefined,
    commentCount: Number(item.comment_count ?? item.commentCount ?? item.comments ?? 0),
    trackCount: Number(item.track_count ?? item.trackCount ?? 0),
    genre: String(item.genre ?? ''),
    season: item.season ? String(item.season) : undefined,
    scores: {
      community: Number(item.community_score ?? item.score_community ?? score - 2),
      critics: Number(item.critics_score ?? item.score_critics ?? score - 3),
      personal: Number(item.personal_score ?? score),
    },
    personalScore: (item.personal_score == null ? undefined : Number(item.personal_score)),
    is_new_name: item.is_new_name === true,
    is_freshman: item.is_freshman === true,
    youtube_url: item.youtube_url ? String(item.youtube_url) : undefined,
    streaming_url: item.streaming_url ? String(item.streaming_url) : undefined,
    audio_url: item.audio_url ? String(item.audio_url) : undefined,
  } satisfies Release;

}
