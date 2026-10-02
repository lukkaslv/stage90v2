import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabasePages } from '@/hooks/useSupabasePages';
import { normalizeCatalogRelease } from '@/lib/normalizeCatalogRelease';
import LoadMoreButton from '@/components/LoadMoreButton';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import type { Release } from '@/types/music';
import { supabase } from '@/lib/supabase';

interface AuthorsPicksProps { releaseById: ReadonlyMap<string, Release>; onReleaseClick: (release: Release) => void; preview?: boolean; }
interface AuthorPick { id: string; author: string; initials: string; releaseId: string; release: Release | null; }
function joined(value: unknown): Record<string, unknown> | undefined { return (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined; }

export default function AuthorsPicks({ releaseById, onReleaseClick, preview = false }: AuthorsPicksProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [likeVersion, setLikeVersion] = useState(0);
  const fetchPage = useCallback((from: number, to: number) => {
    if (!supabase) return Promise.resolve({ data: null, error: true });
    const client = supabase;
    return client.from('review_author_likes').select('id, created_at, profiles:author_id!inner(display_name, role), reviews:review_id!inner(release_id, releases:release_id!inner(id, title, artist_name, cover_url, release_type))')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to).returns<Record<string, unknown>[]>();
  }, []);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const refresh = () => setLikeVersion((version) => version + 1);
    const refreshOnReturn = () => { if (document.visibilityState === 'visible') refresh(); };
    const channel = client.channel('authors-picks-likes').on('postgres_changes', { event: '*', schema: 'public', table: 'review_author_likes' }, refresh).subscribe();
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => { document.removeEventListener('visibilitychange', refreshOnReturn); void client.removeChannel(channel); };
  }, []);
  const { rows, loading, hasMore, error, loadMore } = useSupabasePages(fetchPage, preview ? 5 : 20, likeVersion);
  const picks = useMemo<AuthorPick[]>(() => rows.flatMap((item) => {
    const author = String(joined(item.profiles)?.display_name ?? '').trim();
    const linked = joined(joined(item.reviews)?.releases);
    if (!author || !linked) return [];
    return [{ id: String(item.id), author, initials: author.slice(0, 2), releaseId: String(linked.id), release: normalizeCatalogRelease(linked) }];
  }), [rows]);
  const visiblePicks = useMemo(() => picks.flatMap((pick) => { const release = releaseById.get(String(pick.releaseId)) ?? pick.release; return release ? [{ pick, release }] : []; }), [picks, releaseById]);
  return (
    <section className="animate-fade-in" aria-labelledby="authors-picks-heading" style={{ animationDelay: '0.08s' }}>
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id="authors-picks-heading" className="text-xl font-bold text-white sm:text-2xl">ავტორების რჩეული</h2><div className="flex items-center gap-2"><button type="button" onClick={() => scrollRef.current?.scrollBy({ left: -520, behavior: 'smooth' })} aria-label="წინა ავტორის არჩევანი" className="rounded-lg border border-[#2a2a32] p-1.5 text-gray-500 hover:text-white"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => scrollRef.current?.scrollBy({ left: 520, behavior: 'smooth' })} aria-label="შემდეგი ავტორის არჩევანი" className="rounded-lg border border-[#2a2a32] p-1.5 text-gray-500 hover:text-white"><ChevronRight className="h-4 w-4" /></button></div></div>
      {visiblePicks.length === 0 && !loading && !error ? <div className="flex min-h-20 max-h-40 items-center justify-center rounded-xl border border-dashed border-[#2a2a32] bg-[#121216] px-4 py-4 text-center text-xs text-gray-500">ავტორების რჩეული ჯერ არ არის.</div> : <div ref={scrollRef} onWheel={(event) => { if (event.deltaY !== 0) event.currentTarget.scrollLeft += event.deltaY; }} className="no-scrollbar flex gap-4 overflow-x-auto overflow-y-visible scroll-smooth select-none pb-2">{visiblePicks.map(({ pick, release }) => { return <button key={pick.id} onClick={() => onReleaseClick(release)} className="card-hover flex w-[245px] shrink-0 items-center gap-3 rounded-xl border border-[#1e1e24] bg-[#121215] p-3 text-left"><img src={release.coverUrl} alt={release.title} className="h-16 w-16 shrink-0 rounded-lg object-cover" loading="lazy" /><span className="min-w-0 flex-1"><span className="mb-2 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-400/40 to-cyan-400/30 text-[9px] font-bold text-white">{pick.initials}</span><span className="truncate text-[11px] font-semibold text-gray-400">{pick.author}</span></span><span className="block truncate text-sm font-bold text-white">{release.title}</span><span className="mt-1 block truncate text-xs text-gray-500">{release.artist}</span><span className="mt-2 flex items-center gap-1 text-[11px] text-rose-400"><Heart className="h-3 w-3" fill="currentColor" />ავტორის მოწონება</span></span></button>; })}</div>}
      {!preview && <LoadMoreButton loading={loading} hasMore={hasMore} error={error} onClick={() => { void loadMore(); }} />}
    </section>
  );
}
