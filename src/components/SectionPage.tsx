import { useCallback, useMemo } from 'react';
import { useSupabasePages } from '@/hooks/useSupabasePages';
import { queryCatalog } from '@/lib/catalogQuery';
import { normalizeCatalogRelease } from '@/lib/normalizeCatalogRelease';
import { supabase } from '@/lib/supabase';
import type { Release } from '@/types/music';
import ReleaseCard from '@/components/ReleaseCard';
import RoleBadge from '@/components/RoleBadge';
import LoadMoreButton from '@/components/LoadMoreButton';
import { sectionTitles, type SectionId } from '@/lib/sectionRoutes';
import PageHeading from '@/components/PageHeading';
import { formatGeorgianDate } from '@/lib/georgianDate';
import SectionLoader from '@/components/SectionLoader';

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
      return client.from('review_author_likes').select('id, created_at, profiles:author_id!inner(display_name, role, author_category, is_verified), reviews:review_id!inner(id, title, content, release_id, releases:release_id!inner(id, title, artist_name, cover_url, release_type))')
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(from, to).returns<Record<string, unknown>[]>();
    }
    if (section === 'author-comments') {
      return client.from('author_comments').select('id, release_id, comment_text, created_at, profiles:author_id!inner(display_name, role, author_category, is_verified), releases:release_id!inner(id, title, artist_name, cover_url)')
        .not('profiles.display_name', 'is', null).neq('profiles.display_name', '').neq('comment_text', '')
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(from, to).returns<Record<string, unknown>[]>();
    }
    if (section === 'media-reviews') {
      return client.from('reviews').select('id, release_id, title, content, total_score, created_at, releases:release_id(id, title, artist_name, cover_url), profiles:user_id!inner(display_name, role, author_category, is_verified)')
        .eq('profiles.role', 'media').order('created_at', { ascending: false })
        .order('id', { ascending: false }).range(from, to).returns<Record<string, unknown>[]>();
    }
    return client.from('reviews').select('*, releases:release_id(id, title, artist_name, cover_url), profiles:user_id(display_name, role, author_category, is_verified)')
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(from, to).returns<Record<string, unknown>[]>();
  }, [section]);
  const { rows, loading, hasMore, error, loadMore } = useSupabasePages(fetchPage, 20);
  const releases = useMemo(() => rows.map((row) => normalizeCatalogRelease(row)), [rows]);
  const isReleaseList = section === 'all-releases' || section === 'new-names';

  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <PageHeading title={sectionTitles[section]} />
    {isReleaseList ? <div className="stage-catalog-grid grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {releases.map((release) => <ReleaseCard key={String(release.id)} release={release} onClick={onReleaseClick} />)}
    </div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const likedReview = section === 'author-picks' ? joined(row.reviews) : undefined;
        const release = likedReview ? joined(likedReview.releases) : joined(row.releases);
        const profile = joined(row.profiles);
        const title = section === 'author-picks' ? String(likedReview?.title ?? 'რეცენზია') :
          section === 'author-comments' ? String(row.comment_text ?? '') :
            String(row.title ?? row.content ?? 'რეცენზია');
        const author = String(row.author_name ?? row.username ?? profile?.display_name ?? 'ავტორი');
        const releaseId = String(row.release_id ?? likedReview?.release_id ?? release?.id ?? '');
        const isReview = section === 'reviews' || section === 'media-reviews';
        return <article key={String(row.id)} className="stage-editorial-card min-w-0">
          <div className="stage-editorial-card-top">
            {Boolean(release?.cover_url) && <img src={String(release?.cover_url)} alt="" className="stage-editorial-cover" loading="lazy" />}
            <div className="min-w-0 flex-1">
              <p className="stage-editorial-kind">{sectionTitles[section]}</p>
              {release && <p className="mt-1 truncate text-xs text-gray-400">{String(release.artist_name ?? '')} · {String(release.title ?? '')}</p>}
            </div>
            {isReview && <span className="stage-review-score ml-auto font-bold">{Number(row.total_score ?? 0)}<small>/90</small></span>}
          </div>
          <button type="button" onClick={() => section === 'author-picks' ? onReviewClick(String(likedReview?.id ?? '')) : isReview ? onReviewClick(String(row.id)) : onReleaseClick(releaseId)} className="stage-editorial-body w-full text-left">
            <h2 className="line-clamp-3 break-words text-lg font-extrabold text-white">{title}</h2>
            {section === 'author-picks' && Boolean(likedReview?.content) && <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-gray-400">{String(likedReview?.content)}</p>}
            {isReview && Boolean(row.content) && <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-gray-400">{String(row.content)}</p>}
          </button>
          <div className="stage-editorial-footer">
            <span className="min-w-0 truncate font-semibold text-gray-200">{author}</span>
            {profile && <RoleBadge role={String(profile.role ?? 'user')} category={String(profile.author_category ?? '')} isVerified={Boolean(profile.is_verified)} />}
            <span className="ml-auto shrink-0 text-xs text-gray-500">{formatGeorgianDate(row.created_at)}</span>
          </div>
        </article>;
      })}
    </div>}
    {rows.length === 0 && !loading && !error && <p className="stage-empty-state">ამ განყოფილებაში ჩანაწერები ჯერ არ არის.</p>}
    {rows.length === 0 && loading && <SectionLoader />}
    <div className="mt-8"><LoadMoreButton loading={rows.length > 0 && loading} hasMore={hasMore && !loading} error={error} onClick={() => { void loadMore(); }} /></div>
  </main>;
}
