import { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { releaseTypeLabel, type Release } from '@/types/music';
import ScoreTriplet from '@/components/ScoreTriplet';
import { releaseCommunityScore } from '@/lib/valueTier';

export default function TopCarousel({ releases, onReleaseClick, userReviewsMap = {} }: { releases: Release[]; onReleaseClick?: (release: Release) => void; userReviewsMap?: Record<string, number> }) {
  const sortedReleases = useMemo(() => [...releases].filter((release) => Number(release.overall_score) > 0)
    .sort((a, b) => Number(b.overall_score) - Number(a.overall_score) || String(a.id).localeCompare(String(b.id))).slice(0, 7), [releases]);
  return <section className="animate-fade-in">
    <div className="mb-5 flex items-center gap-3"><span className="stage-section-marker" /><h2 className="text-xl font-bold text-white sm:text-2xl">ყველა დროის ტოპ რელიზები</h2></div>
    {sortedReleases.length === 0 && <p className="stage-empty-state">რეიტინგისთვის თითოეულ რელიზს 3 დადასტურებული შემფასებელი სჭირდება.</p>}
    <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto overflow-y-visible scroll-smooth px-4 pb-2">
      {sortedReleases.map((release, index) => <button key={release.id} type="button" onClick={() => onReleaseClick?.(release)} aria-label={`${index + 1}. ${release.artist} — ${release.title}, რელიზის ნახვა`} className="stage-release-card group w-[220px] shrink-0 overflow-hidden border text-left sm:w-[250px]">
        <div className="relative aspect-square overflow-hidden bg-[#242733]"><img src={release.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" /><span className="stage-rank-number absolute left-3 top-3">{String(index + 1).padStart(2, '0')}</span></div>
        <div className="p-4"><div className="mb-2 flex items-center justify-between gap-2"><span className="stage-format-badge">{releaseTypeLabel(release)} · {release.year}</span><span className="flex items-center gap-1 text-xs text-gray-400"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{release.reviews_count ?? release.reviews?.length ?? 0}</span></div><h3 className="truncate text-sm font-bold text-white">{release.title}</h3><p className="mt-1 truncate text-xs text-gray-400">{release.artist}</p><ScoreTriplet community={releaseCommunityScore(release)} media={release.critics_score ?? release.score_critics} personal={userReviewsMap[String(release.id)]} className="mt-4 border-t border-white/10 pt-3" /></div>
      </button>)}
    </div>
  </section>;
}
