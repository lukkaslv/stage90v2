import type { Release } from '@/types/music';
import { useDailyTop15 } from '@/hooks/useDailyTop15';
import { releaseValueTier } from '@/lib/valueTier';

interface Top15DailyProps {
  onReleaseClick: (release: Release) => void;
  preview?: boolean;
}

const rankBadgeClasses = [
  'bg-gradient-to-tr from-amber-500 to-yellow-300 text-black shadow-md shadow-amber-500/50',
  'bg-gradient-to-tr from-teal-400 to-cyan-300 text-black shadow-md shadow-cyan-500/50',
  'bg-gradient-to-tr from-emerald-500 to-green-300 text-black shadow-md shadow-emerald-500/50',
  'border border-zinc-700 bg-zinc-900 text-zinc-300',
];

const tierGlowClasses: Record<string, string> = {
  'ლალი': 'border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6),0_0_30px_rgba(244,63,94,0.25)]',
  'საფირონი': 'border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6),0_0_30px_rgba(34,211,238,0.25)]',
  'ზურმუხტი': 'border-2 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6),0_0_30px_rgba(52,211,153,0.25)]',
  'ოქრო': 'border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6),0_0_30px_rgba(251,191,36,0.25)]',
  'ვერცხლი': 'border-2 border-slate-600/60 shadow-[0_0_10px_rgba(148,163,184,0.15)]',
  'unrated': 'border-2 border-zinc-800',
};

export default function Top15Daily({ onReleaseClick, preview = false }: Top15DailyProps) {
  const sortedTopReleases = useDailyTop15();

  return <section className="animate-fade-in" aria-labelledby="top-15-heading">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-orange-500 text-lg"></span>
      <h2 id="top-15-heading" className="text-xl font-black text-white tracking-wide">ბოლო 24 საათის ტოპ-15</h2>
    </div>
    {sortedTopReleases.length === 0 ? <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-[#2a2a32] bg-[#121215] px-4 py-5 text-center text-xs text-gray-500">დღის აქტიური რელიზები ჯერ არ არის.</div> : <div onWheel={(event) => { if (event.deltaY !== 0) event.currentTarget.scrollLeft += event.deltaY; }} className="no-scrollbar scrollbar-none -mx-4 flex gap-5 overflow-x-auto overflow-y-visible scroll-smooth select-none px-1 pt-3 pb-2 sm:gap-6">
      {sortedTopReleases.slice(0, preview ? 6 : 15).map(({ release, dailyCount }, index) => {
        const tier = releaseValueTier(release);
        return <button key={String(release.id)} type="button" onClick={() => onReleaseClick(release)} className="group w-[84px] shrink-0 text-center" aria-label={`${release.title} — ${release.artist}`}>
          <div className="relative mx-auto h-16 w-16">
            <div className={`h-full w-full overflow-hidden rounded-full bg-[#121216] transition-transform duration-200 group-hover:scale-105 ${tierGlowClasses[tier ?? 'unrated']}`}>
              <img src={release.coverUrl} alt={release.title} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <span className={`absolute -top-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black leading-none shadow-md ${rankBadgeClasses[index] ?? rankBadgeClasses[3]}`}><span className="flex h-full w-full items-center justify-center text-center leading-none">{index + 1}</span></span>
          </div>
          <p className="mx-auto mt-2 max-w-[80px] truncate text-xs font-bold text-white">{release.title}</p>
          <p className="mx-auto max-w-[80px] truncate text-[11px] text-zinc-400">{release.artist}</p>
          <p className="mx-auto mt-1 text-[10px] text-cyan-300">{dailyCount} შეფასება</p>
        </button>;
      })}
    </div>}
  </section>;
}
