import type { Release } from '@/types/music';

export type StrictValueTier = 'ლალი' | 'საფირონი' | 'ზურმუხტი' | 'ოქრო' | 'ვერცხლი';

export const STRICT_VALUE_TIER_CONFIG: Record<StrictValueTier, { badge: string; icon: string }> = {
  'ლალი': { badge: 'stage-tier stage-tier-ruby', icon: 'text-[#de8090]' },
  'საფირონი': { badge: 'stage-tier stage-tier-sapphire', icon: 'text-[#91abc7]' },
  'ზურმუხტი': { badge: 'stage-tier stage-tier-emerald', icon: 'text-[#83bea1]' },
  'ოქრო': { badge: 'stage-tier stage-tier-gold', icon: 'text-[#d8bb78]' },
  'ვერცხლი': { badge: 'stage-tier stage-tier-silver', icon: 'text-[#bdc4cd]' },
};

export function valueTierFromScore(score: number): StrictValueTier {
  if (score >= 85) return 'ლალი';
  if (score >= 75) return 'საფირონი';
  if (score >= 65) return 'ზურმუხტი';
  if (score >= 50) return 'ოქრო';
  return 'ვერცხლი';
}

export function releaseCommunityScore(release: Pick<Release, 'community_score' | 'score_community'>): number | null {
  for (const score of [release.community_score, release.score_community]) {
    const parsed = Number(score);
    if (score != null && Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function releaseValueTier(release: Pick<Release, 'overall_score'>): StrictValueTier | null {
  const score = Number(release.overall_score);
  return release.overall_score != null && Number.isFinite(score) && score > 0
    ? valueTierFromScore(score)
    : null;
}
