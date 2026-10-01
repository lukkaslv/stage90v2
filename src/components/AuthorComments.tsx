import { useEffect, useState } from 'react';
import { ExternalLink, Heart, MessageCircle } from 'lucide-react';
import type { Release } from '@/types/music';
import { supabase } from '@/lib/supabase';
import RoleBadge from '@/components/RoleBadge';

interface AuthorCommentsProps { releases: Release[]; onReleaseClick: (release: Release | string) => void; }
interface AuthorComment { id: string; author: string; avatarUrl?: string; role: string; category?: string; isVerified: boolean; initials: string; text: string; releaseId: number | string; likes: number; replies: number; releaseTitle: string; releaseArtist: string; coverUrl: string; }
function objectValue(value: unknown): Record<string, unknown> | undefined { return (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined; }
function fallback(comment: AuthorComment): Release { return { id: comment.releaseId, title: comment.releaseTitle, artist: comment.releaseArtist, coverUrl: comment.coverUrl, type: '' as Release['type'], year: new Date().getFullYear(), score: 0, reviewCount: 0, trackCount: 0, genre: '' }; }
function mapComment(row: Record<string, unknown>, index: number): AuthorComment {
  const profile = objectValue(row.profiles ?? row.profile);
  const release = objectValue(row.releases ?? row.release);
  const author = String(row.author_name ?? row.username ?? profile?.display_name ?? 'ავტორი');
  const releaseId = row.release_id ?? release?.id ?? '';
  return { id: String(row.id ?? index), author, avatarUrl: String(profile?.avatar_url ?? row.avatar_url ?? '') || undefined, role: String(profile?.role ?? row.role ?? 'author'), category: profile?.author_category ? String(profile.author_category) : undefined, isVerified: Boolean(profile?.is_verified), initials: author.slice(0, 2).toUpperCase(), text: String(row.content ?? row.comment ?? row.text ?? ''), releaseId: typeof releaseId === 'number' ? releaseId : String(releaseId), likes: Number(row.likes ?? row.reactions ?? 0), replies: Number(row.replies ?? row.reply_count ?? 0), releaseTitle: String(release?.title ?? ''), releaseArtist: String(release?.artist_name ?? ''), coverUrl: String(release?.cover_url ?? '') };
}

export default function AuthorComments({ releases, onReleaseClick }: AuthorCommentsProps) {
  const [comments, setComments] = useState<AuthorComment[]>([]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const load = async () => {
      const { data: rows } = await client.from('author_comments').select('*, profiles:user_id(display_name, avatar_url, role, author_category, is_verified), releases:release_id(id, title, artist_name, cover_url)').order('created_at', { ascending: false });
      if (rows?.length) { setComments(rows.map((row, index) => mapComment(row as Record<string, unknown>, index))); return; }
      const { data } = await client.from('reviews').select('id, title, content, created_at, user_id, profiles:user_id(display_name, avatar_url, role, author_category, is_verified), releases:release_id(id, title, artist_name, cover_url)').order('created_at', { ascending: false }).limit(6);
      const authorRows = (data ?? []).filter((row) => { const profile = objectValue((row as Record<string, unknown>).profiles); return profile?.role === 'author' || profile?.role === 'media' || profile?.display_name === 'storm'; });
      setComments(authorRows.map((row, index) => mapComment(row as Record<string, unknown>, index)));
    };
    void load();
  }, []);
  const visible = comments.map((comment) => ({ comment, release: releases.find((item) => String(item.id) === String(comment.releaseId)) ?? fallback(comment) }));
  return <section className="animate-fade-in" aria-labelledby="author-comments-heading"><div className="mb-5"><h2 id="author-comments-heading" className="text-xl font-bold text-white sm:text-2xl">ავტორების კომენტარები</h2></div>{visible.length === 0 ? <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-[#2a2a32] bg-[#121216] px-4 py-4 text-center text-xs text-gray-500">ავტორების კომენტარები ჯერ არ არის.</div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{visible.map(({ comment, release }) => { const target: Release | string = releases.some((item) => String(item.id) === String(comment.releaseId)) ? release : String(comment.releaseId); const selectRelease = () => onReleaseClick(target); return <article key={comment.id} onClick={selectRelease} className="group card-hover flex h-[210px] min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-[#1e1e24] bg-[#121215] p-4 transition-all hover:border-cyan-500/50 hover:bg-[#16161c]"><div className="flex items-center gap-3"><div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-zinc-700/80 bg-zinc-800">{comment.avatarUrl ? <img src={comment.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-300">{comment.initials || 'AU'}</div>}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold text-white">{comment.author}</p><RoleBadge role={comment.role} category={comment.category} isVerified={comment.isVerified} /></div><button onClick={(event) => { event.stopPropagation(); selectRelease(); }} className="mt-1 flex max-w-full items-center gap-2 truncate text-left text-[11px] text-cyan-300">{release.coverUrl && <img src={release.coverUrl} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />}{release.title} · {release.artist}</button></div><ExternalLink className="h-4 w-4 shrink-0 text-gray-600 transition-colors group-hover:text-cyan-300" aria-label="რეცენზიის გახსნა" /></div><p className="mt-3 flex-1 overflow-hidden break-words whitespace-pre-wrap text-sm leading-relaxed text-gray-300 line-clamp-4">„{comment.text}“</p><div className="mt-3 flex items-center gap-4 border-t border-[#1e1e24] pt-3 text-[11px] text-gray-500"><span className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5 text-rose-400" fill="currentColor" />{comment.likes}</span><span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />{comment.replies}</span><ExternalLink className="ml-auto h-3.5 w-3.5 text-gray-600 group-hover:text-cyan-300" aria-label="სრული რეცენზიის ნახვა" /></div></article>; })}</div>}</section>;
}
