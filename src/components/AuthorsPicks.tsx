import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabasePages } from '@/hooks/useSupabasePages';
import LoadMoreButton from '@/components/LoadMoreButton';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AuthorsPicksProps { onReviewClick: (id: string) => void; preview?: boolean; }
interface AuthorPick { id: string; author: string; initials: string; reviewId: string; reviewTitle: string; reviewText: string; releaseTitle: string; releaseArtist: string; releaseCoverUrl: string; }
function joined(value: unknown): Record<string, unknown> | undefined { return (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined; }

export default function AuthorsPicks({ onReviewClick, preview = false }: AuthorsPicksProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [likeVersion, setLikeVersion] = useState(0);
  const fetchPage = useCallback((from: number, to: number) => {
    if (!supabase) return Promise.resolve({ data: null, error: true });
    const client = supabase;
    return client.from('review_author_likes').select('id, created_at, profiles:author_id!inner(display_name, role), reviews:review_id!inner(id, title, content, releases:release_id!inner(title, artist_name, cover_url))')
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
    const review = joined(item.reviews);
    const release = joined(review?.releases);
    if (!author || !review?.id || !release) return [];
    return [{ id: String(item.id), author, initials: author.slice(0, 2), reviewId: String(review.id), reviewTitle: String(review.title ?? 'რეცენზია'), reviewText: String(review.content ?? ''), releaseTitle: String(release.title ?? ''), releaseArtist: String(release.artist_name ?? ''), releaseCoverUrl: String(release.cover_url ?? '') }];
  }), [rows]);
  return (
    <section className="animate-fade-in" aria-labelledby="authors-picks-heading" style={{ animationDelay: '0.08s' }}>
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id="authors-picks-heading" className="text-xl font-bold text-white sm:text-2xl">ავტორების რჩეული</h2><div className="flex items-center gap-2"><button type="button" onClick={() => scrollRef.current?.scrollBy({ left: -520, behavior: 'smooth' })} aria-label="წინა ავტორის არჩევანი" className="rounded-lg border border-[#2a2a32] p-1.5 text-gray-500 hover:text-white"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => scrollRef.current?.scrollBy({ left: 520, behavior: 'smooth' })} aria-label="შემდეგი ავტორის არჩევანი" className="rounded-lg border border-[#2a2a32] p-1.5 text-gray-500 hover:text-white"><ChevronRight className="h-4 w-4" /></button></div></div>
      {picks.length === 0 && !loading && !error ? <div className="flex min-h-20 max-h-40 items-center justify-center rounded-xl border border-dashed border-[#2a2a32] bg-[#121216] px-4 py-4 text-center text-xs text-gray-500">ავტორების რჩეული ჯერ არ არის.</div> : <div ref={scrollRef} onWheel={(event) => { if (event.deltaY !== 0) event.currentTarget.scrollLeft += event.deltaY; }} className="no-scrollbar flex gap-4 overflow-x-auto overflow-y-visible scroll-smooth select-none pb-2">{picks.map((pick) => <button key={pick.id} type="button" onClick={() => onReviewClick(pick.reviewId)} className="card-hover flex w-[280px] shrink-0 flex-col rounded-xl border border-[#1e1e24] bg-[#121215] p-4 text-left"><span className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400/40 to-blue-400/30 text-[9px] font-bold text-white">{pick.initials}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-300">{pick.author}</span><Heart className="h-3.5 w-3.5 shrink-0 text-rose-400" fill="currentColor" /></span><span className="mt-3 line-clamp-2 break-all text-sm font-bold text-white">{pick.reviewTitle}</span><span className="mt-1 line-clamp-3 min-h-12 break-all text-xs leading-4 text-gray-400">{pick.reviewText}</span><span className="mt-3 flex min-w-0 items-center gap-2 border-t border-[#24242c] pt-3">{pick.releaseCoverUrl && <img src={pick.releaseCoverUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" loading="lazy" />}<span className="min-w-0 truncate text-[11px] text-blue-300">{pick.releaseTitle} · {pick.releaseArtist}</span></span></button>)}</div>}
      {!preview && <LoadMoreButton loading={loading} hasMore={hasMore} error={error} onClick={() => { void loadMore(); }} />}
    </section>
  );
}
