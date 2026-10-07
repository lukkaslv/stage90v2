import type { RankedArtist } from '@/types/artist';

export const ARTIST_RANK_TIERS = [
  { key: 'legend', label: '#STAGE90 ლეგენდა', places: 'პირველი ადგილი · 2 ტრეკი 70+', maxRank: 1, min60: 2, min70: 2 },
  { key: 'superstar', label: 'სუპერვარსკვლავი', places: 'პირველი 3 ადგილი · 1 ტრეკი 70+ და კიდევ 1 ტრეკი 60+', maxRank: 3, min60: 2, min70: 1 },
  { key: 'star', label: 'ვარსკვლავი', places: 'პირველი 7 ადგილი · 2 ტრეკი 60+', maxRank: 7, min60: 2, min70: 0 },
  { key: 'rising', label: 'ამომავალი ვარსკვლავი', places: 'პირველი 11 ადგილი · 1 ტრეკი 60+', maxRank: 11, min60: 1, min70: 0 },
  { key: 'spark', label: 'ნაპერწკალი', places: 'რეიტინგში მოხვედრა', maxRank: Infinity, min60: 0, min70: 0 },
] as const;

export function artistTierFromRank(artist: Pick<RankedArtist, 'rank' | 'rated_track_count' | 'tracks_60_plus' | 'tracks_70_plus'> | null | undefined) {
  if (!artist) return null;
  const rank = artist.rank;
  if (rank == null || !Number.isInteger(rank) || rank < 1) return null;
  if (artist.rated_track_count < 3) return null;
  return ARTIST_RANK_TIERS.find((tier) => rank <= tier.maxRank
    && artist.tracks_60_plus >= tier.min60 && artist.tracks_70_plus >= tier.min70) ?? null;
}

export function safeArtistUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function artistPoints(value: number) {
  return new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 0 }).format(value);
}
