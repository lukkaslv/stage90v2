import type { Release } from '@/types/music';
import { useDailyTop15 } from '@/hooks/useDailyTop15';
import { releaseValueTier, STRICT_VALUE_TIER_CONFIG } from '@/lib/valueTier';

interface Top15DailyProps {
  onReleaseClick: (release: Release) => void;
  preview?: boolean;
}

export default function Top15Daily({ onReleaseClick, preview = false }: Top15DailyProps) {
  const sortedTopReleases = useDailyTop15();

  return <section className="animate-fade-in" aria-labelledby="top-15-heading">
    <div className="mb-4 flex items-center gap-3"><span className="stage-section-marker" /><h2 id="top-15-heading" className="text-xl font-black text-white sm:text-2xl">ბოლო 24 საათის ტოპ-15</h2></div>
    {sortedTopReleases.length === 0 ? <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-[#2a2a32] bg-[#121215] px-4 py-5 text-center text-xs text-gray-500">დღის აქტიური რელიზები ჯერ არ არის.</div> : <div onWheel={(event) => { if (event.deltaY !== 0) event.currentTarget.scrollLeft += event.deltaY; }} className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-3">
      {sortedTopReleases.slice(0, preview ? 6 : 15).map(({ release, dailyCount }, index) => {
        const tier = releaseValueTier(release);
        return <button key={String(release.id)} type="button" onClick={() => onReleaseClick(release)} className="stage-daily-card group w-[194px] shrink-0 text-left" aria-label={`${index + 1}. ${release.title} — ${release.artist}, ${dailyCount} შეფასება`}>
          <div className="stage-daily-art"><img src={release.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" /><span className="stage-daily-rank">{String(index + 1).padStart(2, '0')}</span></div>
          <div className="stage-daily-copy"><p className="truncate text-sm font-extrabold text-white">{release.title}</p><p className="mt-0.5 truncate text-xs text-gray-400">{release.artist}</p><div className="stage-daily-foot"><span>{dailyCount} შეფასება</span>{tier && <span className={STRICT_VALUE_TIER_CONFIG[tier].badge}>{tier}</span>}</div></div>
        </button>;
      })}
    </div>}
  </section>;
}
