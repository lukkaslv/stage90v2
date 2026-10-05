export const ARTIST_RANK_TIERS = [
  { key: 'legend', label: '#STAGE90 ლეგენდა', places: 'პირველი ადგილი', maxRank: 1 },
  { key: 'superstar', label: 'სუპერვარსკვლავი', places: 'მე-2–მე-3 ადგილი', maxRank: 3 },
  { key: 'star', label: 'ვარსკვლავი', places: 'მე-4–მე-7 ადგილი', maxRank: 7 },
  { key: 'rising', label: 'ამომავალი ვარსკვლავი', places: 'მე-8–მე-11 ადგილი', maxRank: 11 },
  { key: 'spark', label: 'ნაპერწკალი', places: 'მე-12 ადგილიდან', maxRank: Infinity },
] as const;

export function artistTierFromRank(rank: number | null | undefined) {
  if (rank == null || !Number.isInteger(rank) || rank < 1) return null;
  return ARTIST_RANK_TIERS.find((tier) => rank <= tier.maxRank) ?? null;
}

export function safeArtistUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function artistPoints(value: number) {
  return new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 1 }).format(value);
}
