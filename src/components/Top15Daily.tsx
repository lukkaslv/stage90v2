import { useEffect, useState } from 'react';
import type { Release } from '@/types/music';
import { supabase } from '@/lib/supabase';

interface Top15DailyProps {
  releases: Release[];
  onReleaseClick: (release: Release) => void;
  userReviewsMap?: Record<string, number>;
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
};

function tierFromScore(score: number) {
  if (score >= 85) return 'ლალი';
  if (score >= 75) return 'საფირონი';
  if (score >= 65) return 'ზურმუხტი';
  if (score >= 50) return 'ოქრო';
  return 'ვერცხლი';
}

function normalizeRelease(row: Record<string, unknown>, userReviewsMap: Record<string, number>): Release {
  const relation = Array.isArray(row.reviews) ? row.reviews[0] as Record<string, unknown> | undefined : row.reviews as Record<string, unknown> | undefined;
  const id = typeof row.id === 'number' ? row.id : String(row.id ?? '');
  const reviewCount = Number(row.reviews_count ?? row.total_reviews_count ?? relation?.count ?? 0);
  const community = row.community_score == null ? undefined : Number(row.community_score);
  const critics = row.critics_score == null ? undefined : Number(row.critics_score);
  return {
    id,
    title: String(row.title ?? ''),
    artist: String(row.artist ?? row.artist_name ?? ''),
    coverUrl: String(row.cover_url ?? row.coverUrl ?? ''),
    type: String(row.release_type ?? row.type ?? '') as Release['type'],
    release_type: row.release_type ? String(row.release_type) : undefined,
    year: Number(row.year ?? new Date().getFullYear()),
    score: Number(row.score ?? 0),
    community_score: community,
    critics_score: critics,
    value_tier: typeof row.value_tier === 'string' ? row.value_tier : undefined,
    valueTier: typeof row.value_tier === 'string' ? row.value_tier : undefined,
    reviewCount,
    reviews_count: reviewCount,
    reviews: Array.isArray(row.reviews) ? row.reviews : undefined,
    commentCount: Number(row.comment_count ?? 0),
    trackCount: Number(row.track_count ?? 0),
    genre: String(row.genre ?? ''),
    personalScore: userReviewsMap[String(id)],
    scores: { community: community ?? 0, critics: critics ?? 0, personal: userReviewsMap[String(id)] ?? 0 },
  };
}

export default function Top15Daily({ releases, onReleaseClick, userReviewsMap = {} }: Top15DailyProps) {
  const [dailyReleases, setDailyReleases] = useState<Release[]>(releases);

  useEffect(() => {
    const client = supabase;
    if (!client) { setDailyReleases(releases); return; }
    const loadTop15 = async () => {
      const { data, error } = await client.from('releases').select('*, reviews(count)').eq('is_active', true).order('created_at', { ascending: false });
      if (error || !data) { setDailyReleases(releases); return; }
      setDailyReleases(data.map((row) => normalizeRelease(row as Record<string, unknown>, userReviewsMap)));
    };
    void loadTop15();
    const channel = client.channel('top-15-daily-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'releases' }, () => { void loadTop15(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => { void loadTop15(); })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [releases, userReviewsMap]);

  const sortedTopReleases = [...dailyReleases]
    .sort((a, b) => Number(b.reviews_count ?? 0) - Number(a.reviews_count ?? 0))
    .slice(0, 15);

  return <section className="animate-fade-in" aria-labelledby="top-15-heading">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-orange-500 text-lg"></span>
      <h2 id="top-15-heading" className="text-xl font-black text-white tracking-wide">დღის ტოპ-15</h2>
    </div>
    {sortedTopReleases.length === 0 ? <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-[#2a2a32] bg-[#121215] px-4 py-5 text-center text-xs text-gray-500">დღის აქტიური რელიზები ჯერ არ არის.</div> : <div className="no-scrollbar scrollbar-none -mx-4 flex gap-5 overflow-x-auto overflow-y-visible px-1 pt-3 pb-2 sm:gap-6">
      {sortedTopReleases.map((release, index) => {
        const tier = release.value_tier || tierFromScore(Number(release.community_score ?? 0));
        return <button key={String(release.id)} type="button" onClick={() => onReleaseClick(release)} className="group w-[84px] shrink-0 text-center" aria-label={`${release.title} — ${release.artist}`}>
          <div className="relative mx-auto h-16 w-16">
            <div className={`h-full w-full overflow-hidden rounded-full bg-[#121216] transition-transform duration-200 group-hover:scale-105 ${tierGlowClasses[tier] ?? tierGlowClasses['ვერცხლი']}`}>
              <img src={release.coverUrl} alt={release.title} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <span className={`absolute -top-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black leading-none shadow-md ${rankBadgeClasses[index] ?? rankBadgeClasses[3]}`}><span className="flex h-full w-full items-center justify-center text-center leading-none">{index + 1}</span></span>
          </div>
          <p className="mx-auto mt-2 max-w-[80px] truncate text-xs font-bold text-white">{release.title}</p>
          <p className="mx-auto max-w-[80px] truncate text-[11px] text-zinc-400">{release.artist}</p>
        </button>;
      })}
    </div>}
  </section>;
}
