import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import type { Release } from '@/types/music';
import { supabase } from '@/lib/supabase';

interface AuthorsPicksProps { releases: Release[]; onReleaseClick: (release: Release) => void; }
interface AuthorPick { id: string | number; author: string; initials: string; releaseId: number | string; reactions: number; }

export default function AuthorsPicks({ releases, onReleaseClick }: AuthorsPicksProps) {
  const [picks, setPicks] = useState<AuthorPick[]>([]);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const loadPicks = async () => {
      const { data } = await client.from('author_picks').select('*').order('created_at', { ascending: false });
      if (!data) return;
      setPicks(data.map((row, index) => {
        const item = row as Record<string, unknown>;
        const profile = (item.profiles ?? item.profile) as Record<string, unknown> | undefined;
        const author = String(item.author_name ?? item.username ?? profile?.display_name ?? 'ავტორი');
        return { id: String(item.id ?? index), author, initials: author.slice(0, 2).toUpperCase(), releaseId: typeof item.release_id === 'number' ? item.release_id : String(item.release_id ?? ''), reactions: Number(item.reactions ?? item.likes ?? 0) };
      }));
    };
    void loadPicks();
  }, []);
  const visiblePicks = picks.filter((pick) => releases.some((release) => release.id === pick.releaseId));
  return (
    <section className="animate-fade-in" aria-labelledby="authors-picks-heading" style={{ animationDelay: '0.08s' }}>
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id="authors-picks-heading" className="text-xl font-bold text-white sm:text-2xl">ავტორების რჩეული</h2><div className="flex items-center gap-2"><button className="hidden text-sm font-medium text-gray-500 transition-colors hover:text-rose-400 sm:block">ყველა საავტორო მოსაზრება</button><button aria-label="წინა ავტორის არჩევანი" className="rounded-lg border border-[#2a2a32] p-1.5 text-gray-500 hover:text-white"><ChevronLeft className="h-4 w-4" /></button><button aria-label="შემდეგი ავტორის არჩევანი" className="rounded-lg border border-[#2a2a32] p-1.5 text-gray-500 hover:text-white"><ChevronRight className="h-4 w-4" /></button></div></div>
      {visiblePicks.length === 0 ? <div className="flex min-h-20 max-h-40 items-center justify-center rounded-xl border border-dashed border-[#2a2a32] bg-[#121216] px-4 py-4 text-center text-xs text-gray-500">ავტორების რჩეული ჯერ არ არის.</div> : <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{visiblePicks.map((pick) => { const release = releases.find((item) => item.id === pick.releaseId); if (!release) return null; return <button key={pick.id} onClick={() => onReleaseClick(release)} className="card-hover flex w-[245px] shrink-0 items-center gap-3 rounded-xl border border-[#1e1e24] bg-[#121215] p-3 text-left"><img src={release.coverUrl} alt={release.title} className="h-16 w-16 shrink-0 rounded-lg object-cover" loading="lazy" /><span className="min-w-0 flex-1"><span className="mb-2 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-400/40 to-cyan-400/30 text-[9px] font-bold text-white">{pick.initials}</span><span className="truncate text-[11px] font-semibold text-gray-400">{pick.author}</span></span><span className="block truncate text-sm font-bold text-white">{release.title}</span><span className="mt-1 block truncate text-xs text-gray-500">{release.artist}</span><span className="mt-2 flex items-center gap-1 text-[11px] text-rose-400"><Heart className="h-3 w-3" fill="currentColor" />{pick.reactions}</span></span></button>; })}</div>}
    </section>
  );
}
