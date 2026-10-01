import { useEffect, useState } from 'react';
import { ExternalLink, Link2, MessageCircle } from 'lucide-react';
import type { Release } from '@/types/music';
import { supabase } from '@/lib/supabase';
import RoleBadge from '@/components/RoleBadge';

interface MediaReviewsProps { onReleaseClick: (release: Release) => void; releases: Release[]; }
interface MediaReview { id: string; username: string; role: string; category?: string; isVerified: boolean; score: number; scores: number[]; releaseId: number | string; title: string; previewImage: string; mediaUrl: string; comments: number; }
function joined(value: unknown): Record<string, unknown> | undefined { return (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined; }

export default function MediaReviews({ onReleaseClick, releases }: MediaReviewsProps) {
  const [reviews, setReviews] = useState<MediaReview[]>([]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const load = async () => {
      const { data } = await client.from('reviews').select('*, profiles:user_id(display_name, role, author_category, is_verified)').order('created_at', { ascending: false }).limit(24);
      const mediaRows = (data ?? []).filter((row) => { const item = row as Record<string, unknown>; const profile = joined(item.profiles); return item.is_media_review === true || profile?.role === 'media'; });
      setReviews(mediaRows.map((row, index) => {
        const item = row as Record<string, unknown>;
        const profile = joined(item.profiles);
        return { id: String(item.id ?? index), username: String(profile?.display_name ?? item.user_display_name ?? item.display_name ?? 'მედია'), role: String(profile?.role ?? item.role ?? 'media'), category: profile?.author_category ? String(profile.author_category) : undefined, isVerified: Boolean(profile?.is_verified), score: Number(item.total_score ?? 0), scores: [Number(item.param_rhymes ?? item.rhymes ?? 0), Number(item.param_structure ?? item.structure ?? 0), Number(item.param_style ?? item.style ?? 0), Number(item.param_charisma ?? item.charisma ?? item.individuality ?? 0), Number(item.vibe_level ?? item.vibe ?? 0)], releaseId: typeof item.release_id === 'number' ? item.release_id : String(item.release_id ?? ''), title: String(item.title ?? item.content ?? ''), previewImage: String(item.preview_image_url ?? ''), mediaUrl: String(item.media_url ?? ''), comments: Number(item.comment_count ?? item.comments ?? 0) };
      }));
    };
    void load();
  }, []);
  const visibleReviews = reviews.map((review) => ({ review, release: releases.find((item) => String(item.id) === String(review.releaseId)) })).filter((item): item is { review: MediaReview; release: Release } => Boolean(item.release));
  return <section className="animate-fade-in" aria-labelledby="media-reviews-heading"><div className="mb-5 flex items-center justify-between gap-4"><h2 id="media-reviews-heading" className="text-xl font-bold text-white sm:text-2xl">მედიის რეცენზიები</h2></div>{visibleReviews.length === 0 ? <div className="flex min-h-20 max-h-40 items-center justify-center rounded-xl border border-dashed border-[#2a2a32] bg-[#121216] px-4 py-4 text-center text-xs text-gray-500">მედიის რეცენზიები ჯერ არ არის.</div> : <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{visibleReviews.map(({ review, release }) => <article key={review.id} className="card-hover min-w-0 overflow-hidden rounded-xl border border-[#1e1e24] bg-[#121215] p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400/30 to-cyan-400/20 text-xs font-bold text-white">{review.username.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-bold text-white">{review.username}</p><RoleBadge role={review.role} category={review.category} isVerified={review.isVerified} /></div><div className="mt-1 flex gap-2 text-[10px] font-bold text-gray-400">{review.scores.map((score, index) => <span key={`${review.id}-${index}`}>{score}</span>)}</div></div><span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-cyan-400/10 px-2 text-sm font-extrabold text-cyan-300">{review.score}</span></div><button onClick={() => onReleaseClick(release)} className="mt-4 flex w-full min-w-0 items-center gap-3 text-left"><img src={review.previewImage || release.coverUrl} alt={release.title} className="h-20 w-20 shrink-0 rounded-lg object-cover" loading="lazy" /><p className="min-w-0 break-words break-all line-clamp-4 text-sm font-semibold leading-relaxed text-gray-200">{review.title}</p></button><div className="mt-4 flex items-center gap-4 border-t border-[#1e1e24] pt-3 text-xs text-gray-500"><span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />{review.comments}</span>{review.mediaUrl && <a href={review.mediaUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} aria-label="ვიდეოს ან სტატიის გახსნა" className="ml-auto flex items-center gap-1.5 text-teal-300 hover:text-teal-200"><Link2 className="h-3.5 w-3.5" />გახსნა<ExternalLink className="h-3 w-3" /></a>}</div></article>)}</div>}</section>;
}
