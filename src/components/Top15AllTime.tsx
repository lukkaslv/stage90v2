import { useState } from 'react';
import type { Release } from '@/types/music';
import { useAllTimeTop15 } from '@/hooks/useAllTimeTop15';
import { releaseValueTier, STRICT_VALUE_TIER_CONFIG, valueTierFromScore } from '@/lib/valueTier';
import SectionLoader from '@/components/SectionLoader';
import RankMovementBadge, { RankMovementDetail } from '@/components/RankMovementBadge';
import LiveRankingIndicator from '@/components/LiveRankingIndicator';

interface Top15AllTimeProps {
  onReleaseClick: (release: Release) => void;
  preview?: boolean;
}

export default function Top15AllTime({ onReleaseClick, preview = false }: Top15AllTimeProps) {
  const { top, weeklyTop, movement, loading, error, weeklyLoading, weeklyError } = useAllTimeTop15();
  const [chart, setChart] = useState<'all_time' | 'weekly'>('all_time');
  const weekly = chart === 'weekly';
  const entries = weekly ? weeklyTop.map((item) => ({ release: item.release, score: item.score, votes: item.votes })) : top.map((release) => ({ release, score: Number(release.overall_score), votes: 0 }));
  const chartLoading = weekly ? weeklyLoading : loading;
  const chartError = weekly ? weeklyError : error;

  return <section className="animate-fade-in" aria-label={preview ? undefined : 'ტოპ-15 ქულებით'} aria-labelledby={preview ? 'top-15-heading' : undefined}>
    {preview && <div className="mb-4 flex items-center gap-3"><span className="stage-section-marker" /><h2 id="top-15-heading" className="text-xl font-black text-white sm:text-2xl">ტოპ-15 ქულებით</h2></div>}
    <div className="stage-chart-tabs mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="რეიტინგის პერიოდი">
      <button type="button" onClick={() => setChart('all_time')} aria-pressed={!weekly} className={!weekly ? 'stage-chart-tab-active' : ''}>ყველა დროის</button>
      <button type="button" onClick={() => setChart('weekly')} aria-pressed={weekly} className={weekly ? 'stage-chart-tab-active' : ''}>ბოლო 7 დღე</button>
      {weekly && <span className="text-[11px] text-gray-400">მინიმუმ 3 შემფასებელი</span>}
      {!chartLoading && !chartError && entries.length > 0 && <LiveRankingIndicator compact={preview} />}
    </div>
    {chartLoading && entries.length === 0 ? <SectionLoader /> : chartError && entries.length === 0 ? <p className="stage-empty-state">რეიტინგის ჩატვირთვა ვერ მოხერხდა.</p> : entries.length === 0 ? <p className="stage-empty-state">{weekly ? 'ბოლო 7 დღეში საკმარისი შეფასება ჯერ არ არის.' : 'შეფასებული აქტიური რელიზები ჯერ არ არის.'}</p> : <div onWheel={(event) => { if (event.deltaY !== 0) event.currentTarget.scrollLeft += event.deltaY; }} className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-3">
      {entries.slice(0, preview ? 6 : 15).map(({ release, score, votes }, index) => {
        const tier = weekly ? valueTierFromScore(score) : releaseValueTier(release);
        return <button key={String(release.id)} type="button" onClick={() => onReleaseClick(release)} className="stage-daily-card group w-[194px] shrink-0 text-left" aria-label={`${index + 1}. ${release.title} — ${release.artist}, ${score} ქულა 90-დან`}>
          <div className="stage-daily-art"><img src={release.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" /><span className="stage-daily-rank">{String(index + 1).padStart(2, '0')}</span>{!weekly && <RankMovementBadge rank={index + 1} movement={movement[String(release.id)]} compact />}</div>
          <div className="stage-daily-copy"><p className="truncate text-sm font-extrabold text-white">{release.title}</p><p className="mt-0.5 truncate text-xs text-gray-400">{release.artist}</p><div className="stage-daily-foot"><span>{score}/90 ქულა</span>{tier && <span className={STRICT_VALUE_TIER_CONFIG[tier].badge}>{tier}</span>}</div>{weekly ? <p className="stage-chart-detail">{votes} შემფასებელი ბოლო 7 დღეში</p> : !preview && <RankMovementDetail rank={index + 1} movement={movement[String(release.id)]} />}</div>
        </button>;
      })}
    </div>}
  </section>;
}
