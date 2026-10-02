import { useCallback, useMemo } from 'react';
import { useSupabasePages } from '@/hooks/useSupabasePages';
import { queryCatalog } from '@/lib/catalogQuery';
import { normalizeCatalogRelease } from '@/lib/normalizeCatalogRelease';
import { selectColumns } from '@/lib/selectColumns';
import { supabase } from '@/lib/supabase';
import type { Release } from '@/types/music';
import ReleaseCard from '@/components/ReleaseCard';
import RoleBadge from '@/components/RoleBadge';
import LoadMoreButton from '@/components/LoadMoreButton';
import { sectionTitles, type SectionId } from '@/lib/sectionRoutes';

function joined(value: unknown): Record<string, unknown> | undefined {
  return (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined;
}

interface Props {
  section: SectionId;
  onReleaseClick: (release: Release | string) => void;
  onReviewClick: (id: string) => void;
}

export default function SectionPage({ section, onReleaseClick, onReviewClick }: Props) {
  const fetchPage = useCallback((from: number, to: number) => {
    if (!supabase) return Promise.resolve({ data: null, error: true });
    const client = supabase;
    if (section === 'all-releases' || section === 'new-names') {
      return queryCatalog((columns) => {
        let query = client.from('releases').select(columns).eq('is_active', true)
          .order('created_at', { ascending: false }).order('id', { ascending: false });
        if (section === 'new-names') query = query.or('is_new_name.eq.true,is_freshman.eq.true');
        return query.range(from, to).returns<Record<string, unknown>[]>();
      });
    }
    if (section === 'author-picks') {
      return selectColumns('author_picks', 'id, release_id, created_at, releases:release_id(id, title, artist_name, cover_url, release_type)', ['author_name', 'username', 'reactions', 'likes'], (columns) => client.from('author_picks').select(columns)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(from, to).returns<Record<string, unknown>[]>());
    }
    if (section === 'author-comments') {
      return selectColumns('author_comments', 'id, release_id, created_at', ['content', 'comment', 'text', 'author_name', 'username'], (columns) => client.from('author_comments').select(columns)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(from, to).returns<Record<string, unknown>[]>());
    }
    if (section === 'media-reviews') {
      return client.from('reviews').select('id, release_id, title, content, total_score, created_at, releases:release_id(id, title, artist_name, cover_url), profiles:user_id!inner(display_name, role, author_category, is_verified)')
        .eq('profiles.role', 'media').order('created_at', { ascending: false })
        .order('id', { ascending: false }).range(from, to).returns<Record<string, unknown>[]>();
    }
    return selectColumns('reviews', 'id, release_id, title, content, total_score, created_at, releases:release_id(id, title, artist_name, cover_url), profiles:user_id(display_name, role, author_category, is_verified)', ['is_media_review'], (columns) => {
      const query = client.from('reviews').select(columns)
        .order('created_at', { ascending: false }).order('id', { ascending: false });
      return query.range(from, to).returns<Record<string, unknown>[]>();
    });
  }, [section]);
  const { rows, loading, hasMore, error, loadMore } = useSupabasePages(fetchPage, 20);
  const releases = useMemo(() => rows.map((row) => normalizeCatalogRelease(row)), [rows]);
  const isReleaseList = section === 'all-releases' || section === 'new-names';

  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <h1 className="mb-7 text-3xl font-bold text-white">{sectionTitles[section]}</h1>
    {isReleaseList ? <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
      {releases.map((release) => <ReleaseCard key={String(release.id)} release={release} onClick={onReleaseClick} />)}
    </div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const release = joined(row.releases);
        const profile = joined(row.profiles);
        const title = section === 'author-picks' ? String(release?.title ?? '') :
          section === 'author-comments' ? String(row.content ?? row.comment ?? row.text ?? '') :
            String(row.title ?? row.content ?? 'რეცენზია');
        const author = String(row.author_name ?? row.username ?? profile?.display_name ?? 'ავტორი');
        const releaseId = String(row.release_id ?? release?.id ?? '');
        const isReview = section === 'reviews' || section === 'media-reviews';
        return <article key={String(row.id)} className="min-w-0 rounded-xl border border-[#24242c] bg-[#121215] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-300">
            <span className="font-semibold">{author}</span>
            {profile && <RoleBadge role={String(profile.role ?? 'user')} category={String(profile.author_category ?? '')} isVerified={Boolean(profile.is_verified)} />}
            {isReview && <span className="ml-auto font-bold text-cyan-300">{Number(row.total_score ?? 0)}</span>}
          </div>
          <button type="button" onClick={() => isReview ? onReviewClick(String(row.id)) : onReleaseClick(releaseId)} className="w-full text-left">
            <h2 className="line-clamp-3 break-words font-semibold text-white hover:text-cyan-300">{title}</h2>
            {release && <p className="mt-2 truncate text-xs text-gray-400">{String(release.artist_name ?? '')} · {String(release.title ?? '')}</p>}
          </button>
        </article>;
      })}
    </div>}
    {rows.length === 0 && !loading && !error && <p className="py-12 text-center text-gray-400">ამ განყოფილებაში ჩანაწერები ჯერ არ არის.</p>}
    <div className="mt-8"><LoadMoreButton loading={loading} hasMore={hasMore} error={error} onClick={() => { void loadMore(); }} /></div>
  </main>;
}
