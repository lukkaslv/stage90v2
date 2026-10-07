import { Sparkle, Sparkles, Star } from 'lucide-react';
import { ARTIST_RANK_TIERS, artistTierFromRank } from '@/lib/artistRank';
import type { RankedArtist } from '@/types/artist';

function RisingStarIcon({ className }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m15 2 2.1 4.2 4.6.7-3.3 3.3.8 4.6-4.2-2.2-4.2 2.2.8-4.6-3.3-3.3 4.6-.7Z" /><path d="m3 16 4-4m-3 9 5-5m2 5 3-3" /></svg>;
}

function LaurelStarIcon({ className }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3 1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6Z" /><path d="M4 7c-3 7 0 12 8 14M20 7c3 7 0 12-8 14M3 11l3 1m-2 4 3-.5m1 4 1-3m12-6-3 1m2 4-3-.5m-1 4-1-3" /></svg>;
}

const icons = { spark: Sparkle, rising: RisingStarIcon, star: Star, superstar: Sparkles, legend: LaurelStarIcon };

type Props = { artist: Pick<RankedArtist, 'rank' | 'rated_track_count' | 'tracks_60_plus' | 'tracks_70_plus'>; tier?: never }
  | { artist?: never; tier: typeof ARTIST_RANK_TIERS[number] };

export default function ArtistRankBadge({ artist, tier: listedTier }: Props) {
  const tier = listedTier ?? artistTierFromRank(artist);
  if (!tier) return <span className="text-xs text-gray-400">ჯერ რეიტინგის გარეშე</span>;
  const Icon = icons[tier.key];
  return <span className={`stage-artist-badge stage-artist-${tier.key}`} title={tier.places}>
    <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{tier.label}
  </span>;
}
