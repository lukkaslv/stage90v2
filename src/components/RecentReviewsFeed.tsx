import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Heart, MessageCircle } from 'lucide-react';
import type { Release } from '@/types/music';
import { supabase } from '@/lib/supabase';
import RoleBadge from '@/components/RoleBadge';
import { selectColumns } from '@/lib/selectColumns';

interface RecentReviewsFeedProps { onReleaseClick: (release: Release | string) => void; onReviewClick: (id: string) => void; releases: Release[]; releaseById: ReadonlyMap<string, Release>; }
interface ReviewItem { id: string; username: string; role: string; category?: string; isVerified: boolean; score: number; title: string; text: string; releaseId: number | string; reactions: number; releaseTitle: string; releaseArtist: string; releaseCoverUrl: string; }
function joined(value: unknown): Record<string, unknown> | undefined { return (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined; }
function mapReview(row: Record<string, unknown>): ReviewItem { const profile = joined(row.profiles); const release = joined(row.releases); return { id: String(row.id ?? crypto.randomUUID()), username: String(profile?.display_name ?? row.user_display_name ?? row.display_name ?? 'მომხმარებელი'), role: String(profile?.role ?? row.role ?? 'user'), category: profile?.author_category ? String(profile.author_category) : undefined, isVerified: Boolean(profile?.is_verified), score: Number(row.total_score ?? 0), title: String(row.title ?? 'რეცენზია'), text: String(row.content ?? ''), releaseId: typeof row.release_id === 'number' ? row.release_id : String(row.release_id ?? ''), reactions: Number(row.reactions ?? row.likes ?? 0), releaseTitle: String(release?.title ?? ''), releaseArtist: String(release?.artist_name ?? ''), releaseCoverUrl: String(release?.cover_url ?? '') }; }
function fallback(review: ReviewItem): Release { return { id: review.releaseId, title: review.releaseTitle, artist: review.releaseArtist, coverUrl: review.releaseCoverUrl, type: 'album' as Release['type'], year: new Date().getFullYear(), score: review.score, reviewCount: 0, trackCount: 0, genre: '' }; }

export default function RecentReviewsFeed({ onReleaseClick, onReviewClick, releases, releaseById }: RecentReviewsFeedProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    let requestVersion = 0;
    const loadRecent = async () => {
      const version = ++requestVersion;
      const { data, error } = await selectColumns('reviews', 'id, release_id, title, content, total_score, profiles:user_id(display_name, role, author_category, is_verified), releases:release_id(title, artist_name, cover_url)', ['reactions', 'likes', 'user_display_name'], (columns) => client.from('reviews').select(columns).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(6).returns<Record<string, unknown>[]>());
      if (!cancelled && version === requestVersion && !error) setReviews((data ?? []).map((row) => mapReview(row as Record<string, unknown>)));
    };
    const channel = client.channel('recent-reviews-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => { void loadRecent(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void loadRecent(); })
      .subscribe();
    void loadRecent();
    return () => { cancelled = true; void client.removeChannel(channel); };
  }, []);

  const visibleReviews = useMemo(() => reviews.map((review) => { const matched = releaseById.get(String(review.releaseId)); return { review, release: matched ?? fallback(review), target: matched ?? String(review.releaseId) }; }), [reviews, releaseById]);
  const emptyRelease = releases[0];
  return <section className="animate-fade-in" aria-labelledby="recent-reviews-heading"><div className="mb-5 flex items-center justify-between gap-4"><h2 id="recent-reviews-heading" className="text-xl font-bold text-white sm:text-2xl">ახალი რეცენზიები რელიზებზე</h2></div>{reviews.length === 0 ? <div className="py-12 text-center text-gray-500"><p>ამ დროისთვის რეცენზიები ჯერ არ არის დამატებული.</p>{emptyRelease && <button onClick={() => onReleaseClick(emptyRelease)} className="mt-4 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2 text-xs font-bold text-black">რელიზის შეფასება</button>}</div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleReviews.map(({ review, release }) => { return <article key={review.id} onClick={() => onReviewClick(review.id)} className="card-hover min-w-0 cursor-pointer overflow-hidden rounded-xl border border-[#1e1e24] bg-[#121215] p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400/30 to-cyan-400/20 text-xs font-bold text-white">{review.username.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold text-white">{review.username}</p><RoleBadge role={review.role} category={review.category} isVerified={review.isVerified} /></div></div><span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-violet-400/10 px-2 text-sm font-extrabold text-violet-300">{review.score}</span></div><div className="mt-4 flex min-w-0 items-center gap-3">{(release.coverUrl || review.releaseCoverUrl) && <img src={release.coverUrl || review.releaseCoverUrl} alt={release.title} className="h-12 w-12 shrink-0 rounded-md object-cover" loading="lazy" />}<h3 className="min-w-0 truncate text-sm font-bold text-white">{review.title}</h3></div><p className="mt-2 line-clamp-3 overflow-hidden break-words text-sm leading-relaxed text-gray-400">{review.text}</p><div className="mt-4 flex items-center gap-4 border-t border-[#1e1e24] pt-3 text-[11px] text-gray-500"><span className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5 text-rose-400/70" />{review.reactions}</span><span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />კომენტარები</span><ExternalLink className="ml-auto h-3.5 w-3.5" /></div></article>; })}</div>}</section>;
}
