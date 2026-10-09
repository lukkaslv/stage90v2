import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { releaseTypeLabel, type Release } from '@/types/music';
import { useAuth } from '@/context/auth-context';
import { releaseCommunityScore, releaseValueTier, STRICT_VALUE_TIER_CONFIG } from '@/lib/valueTier';
import ScoreTriplet from '@/components/ScoreTriplet';

export default function ReleaseCard({ release, onClick, userReviewsMap = {} }: { release: Release; onClick?: (release: Release) => void; userReviewsMap?: Record<string, number> }) {
  const { isAuthenticated } = useAuth();
  const reviewCount = Number(release.reviews_count ?? release.reviews?.length ?? 0);
  const communityScore = releaseCommunityScore(release) ?? '—';
  const criticsValue = release.critics_score ?? release.score_critics;
  const criticsScore = criticsValue != null && Number(criticsValue) > 0 ? criticsValue : '—';
  const personalScore = isAuthenticated ? userReviewsMap[String(release.id)] ?? '—' : '—';
  const valueTier = releaseValueTier(release);
  return (
    <article className="stage-release-card group relative overflow-hidden border bg-[#121216]">
      <button type="button" onClick={() => onClick?.(release)} className="block w-full text-left focus-visible:outline-offset-[-3px]" aria-label={`${release.artist} — ${release.title}, რელიზის ნახვა`}>
        <div className="stage-release-art relative aspect-square overflow-hidden">
          <img src={release.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          {releaseTypeLabel(release) && <span className="stage-format-badge absolute right-3 top-3">{releaseTypeLabel(release)}</span>}
        </div>
        <div className="stage-release-content p-4">
          <div className="flex min-w-0 items-start justify-between gap-2"><h3 className="truncate text-base font-bold text-white">{release.title}</h3><ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#a8aab4]" /></div>
          <p className="mt-1 truncate text-sm text-gray-400">{release.artist}</p>
          <div className="stage-release-verdict mt-4 flex items-center justify-between gap-2">
            <span className={valueTier ? STRICT_VALUE_TIER_CONFIG[valueTier].badge : 'stage-tier stage-tier-unrated'}>
              {valueTier ? valueTier : release.preliminary_score ? 'წინასწარი შეფასება' : 'ჯერ არ შეფასებულა'}
            </span>
            {(valueTier || release.preliminary_score) && <span className="stage-verdict-number" aria-label={`საშუალო ქულა ${release.overall_score || release.preliminary_score} 90-დან`}>{release.overall_score || release.preliminary_score}<small>/90</small></span>}
            <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{reviewCount}</span>
          </div>
          <ScoreTriplet community={communityScore} media={criticsScore} personal={personalScore} className="mt-4 border-t border-white/10 pt-3" />
          {!valueTier && Boolean(release.preliminary_score) && <p className="mt-2 text-[11px] text-gray-400">რეიტინგამდე: {release.eligible_voter_count ?? 0}/3 დადასტურებული შემფასებელი</p>}
        </div>
      </button>
    </article>
  );
}
