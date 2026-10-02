import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import RoleBadge from '@/components/RoleBadge';

interface Props { id: string; onReleaseClick: (id: string) => void; onBack: () => void; }
type Row = Record<string, unknown>;
function joined(value: unknown): Row | undefined { return (Array.isArray(value) ? value[0] : value) as Row | undefined; }

export default function ReviewDetail({ id, onReleaseClick, onBack }: Props) {
  const [review, setReview] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let cancelled = false;
    void client.from('reviews').select('id, release_id, title, content, total_score, created_at, profiles:user_id(display_name, role, author_category, is_verified), releases:release_id(title, artist_name, cover_url)')
      .eq('id', id).maybeSingle().then(({ data }) => {
        if (!cancelled) { setReview(data as Row | null); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [id]);
  const profile = joined(review?.profiles);
  const release = joined(review?.releases);
  return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <button type="button" onClick={onBack} className="mb-6 text-sm text-cyan-300">← უკან დაბრუნება</button>
    {loading ? <p className="text-gray-400">იტვირთება...</p> : !review ? <p className="text-gray-400">რეცენზია ვერ მოიძებნა.</p> : <article className="rounded-2xl border border-[#24242c] bg-[#121215] p-6">
      <div className="mb-5 flex items-center gap-2 text-sm text-gray-300">
        <span className="font-semibold">{String(profile?.display_name ?? 'მომხმარებელი')}</span>
        {profile && <RoleBadge role={String(profile.role ?? 'user')} category={String(profile.author_category ?? '')} isVerified={Boolean(profile.is_verified)} />}
        <span className="ml-auto text-xl font-bold text-cyan-300">{Number(review.total_score ?? 0)}</span>
      </div>
      <h1 className="mb-5 text-2xl font-bold text-white">{String(review.title ?? 'რეცენზია')}</h1>
      <p className="whitespace-pre-wrap break-words leading-7 text-gray-300">{String(review.content ?? '')}</p>
      {review.release_id != null && <button type="button" onClick={() => onReleaseClick(String(review.release_id))} className="mt-8 flex items-center gap-3 border-t border-white/10 pt-5 text-left text-cyan-300">
        {Boolean(release?.cover_url) && <img src={String(release?.cover_url)} alt="" className="h-12 w-12 rounded-md object-cover" />}
        <span>{String(release?.artist_name ?? '')} · {String(release?.title ?? 'რელიზის ნახვა')}</span>
      </button>}
    </article>}
  </main>;
}
