export type StrictValueTier = 'ლალი' | 'საფირონი' | 'ზურმუხტი' | 'ოქრო' | 'ვერცხლი';

export const STRICT_VALUE_TIER_CONFIG: Record<StrictValueTier, { badge: string; icon: string }> = {
  'ლალი': { badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]', icon: 'text-rose-300' },
  'საფირონი': { badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]', icon: 'text-cyan-300' },
  'ზურმუხტი': { badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]', icon: 'text-emerald-300' },
  'ოქრო': { badge: 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.35)]', icon: 'text-amber-300' },
  'ვერცხლი': { badge: 'bg-zinc-700/30 text-zinc-300 border border-zinc-600/40', icon: 'text-zinc-300' },
};

export function valueTierFromScore(score: number): StrictValueTier {
  if (score >= 85) return 'ლალი';
  if (score >= 75) return 'საფირონი';
  if (score >= 65) return 'ზურმუხტი';
  if (score >= 50) return 'ოქრო';
  return 'ვერცხლი';
}

export function normalizeValueTier(value: unknown, fallbackScore: number): StrictValueTier {
  return typeof value === 'string' && value in STRICT_VALUE_TIER_CONFIG ? value as StrictValueTier : valueTierFromScore(fallbackScore);
}
