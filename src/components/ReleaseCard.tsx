import { MessageCircle } from 'lucide-react';
import { releaseTypeLabel, type Release } from '@/types/music';
import { useAuth } from '@/context/auth-context';
import { normalizeValueTier, STRICT_VALUE_TIER_CONFIG } from '@/lib/valueTier';

export default function ReleaseCard({ release, onClick, userReviewsMap = {} }: { release: Release; onClick?: (release: Release) => void; userReviewsMap?: Record<string, number> }) {
  const { isAuthenticated } = useAuth();
  const reviewCount = Number(release.reviews_count ?? (release.reviews ? release.reviews.length : 0) ?? 0);
  const communityValue = release.community_score;
  const criticsValue = release.critics_score;
  const communityScore = communityValue != null && Number(communityValue) > 0 ? communityValue : '—';
  const criticsScore = criticsValue != null && Number(criticsValue) > 0 ? criticsValue : '—';
  const personalScore = isAuthenticated ? userReviewsMap[String(release.id)] ?? '—' : '—';
  const tier = release.value_tier || 'ვერცხლი';
  const activeTier = tier === 'ვერცხლი' && Number(communityValue ?? 0) >= 85 ? 'ლალი' : tier;
  const valueTier = normalizeValueTier(activeTier, 0);
  const commentCount = reviewCount;
  return <article onClick={() => onClick?.(release)} className="card-hover group relative cursor-pointer overflow-hidden rounded-xl border border-[#1e1e24] bg-[#121216]"><div className="relative aspect-[3/4] overflow-hidden"><img src={release.coverUrl} alt={release.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-[#121216] via-transparent to-transparent" />{releaseTypeLabel(release) && <span className="absolute right-3 top-3 rounded-full border border-cyan-400/30 bg-[#0a0a0c]/75 px-2.5 py-1 text-[10px] font-bold text-cyan-300 backdrop-blur">{releaseTypeLabel(release)}</span>}</div><div className="p-3 sm:p-3.5"><h3 className="truncate text-sm font-bold text-white">{release.title}</h3><p className="mt-0.5 truncate text-xs text-gray-500">{release.artist}</p><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${STRICT_VALUE_TIER_CONFIG[valueTier].badge}`}>{valueTier}</span><div className="mt-3 flex items-center gap-1.5"><span className="flex min-w-0 flex-1 items-center justify-center rounded-full bg-blue-500/20 px-1.5 py-1 text-[10px] font-bold text-blue-300 ring-1 ring-inset ring-blue-400/20">{communityScore}</span><span className="flex min-w-0 flex-1 items-center justify-center rounded-full bg-[#24242c] px-1.5 py-1 text-[10px] font-bold text-gray-300 ring-1 ring-inset ring-white/10">{criticsScore}</span><span className="flex min-w-0 flex-1 items-center justify-center rounded-full bg-gray-300/90 px-1.5 py-1 text-[10px] font-bold text-[#17171b]">{personalScore}</span><span className="ml-1 flex shrink-0 items-center gap-1 text-[11px] text-gray-500"><MessageCircle className="h-3.5 w-3.5" />{commentCount}</span></div><button type="button" onClick={(event) => { event.stopPropagation(); onClick?.(release); }} className="mt-3 w-full rounded-full border border-[#2a2a32] bg-[#0a0a0c] px-3 py-1.5 text-[11px] font-semibold text-gray-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300">რეცენზიის დაწერა...</button></div></article>;
}
