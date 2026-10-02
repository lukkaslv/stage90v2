import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeCatalogRelease } from '@/lib/normalizeCatalogRelease';
import type { Release } from '@/types/music';
import { queryCatalog, CATALOG_PAGE_SIZE } from '@/lib/catalogQuery';

export function useReleaseCatalog(userId: string | undefined, refreshKey: number) {
  const [catalog, setCatalog] = useState<Release[]>([]);
  const [latestIds, setLatestIds] = useState<string[]>([]);
  const [topIds, setTopIds] = useState<string[]>([]);
  const [newNameIds, setNewNameIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const loadMoreRef = useRef<() => void>(() => undefined);
  const [releaseCount, setReleaseCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [userReviewsMap, setUserReviewsMap] = useState<Record<string, number>>({});
  const [reviewVersion, setReviewVersion] = useState(0);
  const [commentVersion, setCommentVersion] = useState(0);
  const refreshReviewRef = useRef<(id: string | number, created: boolean) => void>(() => undefined);
  const refreshPersonalRef = useRef<(id: string) => void>(() => undefined);
  const visibleIds = useMemo(() => catalog.map((release) => String(release.id)).sort().join(','), [catalog]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    let personalVersion = 0;
    const releaseVersions = new Map<string, number>();
    const changedIds = new Set<string>();
    setUserReviewsMap({});
    const loadPersonal = async () => {
      const version = ++personalVersion;
      if (!userId) return;
      const ids = visibleIds ? visibleIds.split(',') : [];
      const data: Record<string, unknown>[] = [];
      for (let offset = 0; offset < ids.length; offset += CATALOG_PAGE_SIZE) {
        const result = await client.from('reviews').select('release_id, total_score').eq('user_id', userId).in('release_id', ids.slice(offset, offset + CATALOG_PAGE_SIZE)).limit(CATALOG_PAGE_SIZE);
        if (cancelled || version !== personalVersion || result.error) return;
        data.push(...(result.data ?? []));
      }
      const scores = Object.fromEntries(data.map((row) => [String(row.release_id), Number(row.total_score)]));
      setUserReviewsMap((current) => {
        changedIds.forEach((id) => {
          if (current[id] == null) delete scores[id];
          else scores[id] = current[id];
        });
        return scores;
      });
    };
    const loadPersonalRelease = async (id: string) => {
      if (!userId) return;
      changedIds.add(id);
      const version = (releaseVersions.get(id) ?? 0) + 1;
      releaseVersions.set(id, version);
      const { data, error } = await client.from('reviews').select('total_score').eq('user_id', userId).eq('release_id', id).maybeSingle();
      if (cancelled || error || version !== releaseVersions.get(id)) return;
      setUserReviewsMap((current) => {
        const next = { ...current };
        if (data) next[id] = Number(data.total_score);
        else delete next[id];
        return next;
      });
    };
    refreshPersonalRef.current = (id) => { void loadPersonalRelease(id); };
    void loadPersonal();
    const channel = userId ? client.channel(`catalog-personal-reviews-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        const old = payload.old as Record<string, unknown>;
        if (payload.eventType === 'DELETE' && old.release_id == null) {
          changedIds.clear();
          void loadPersonal();
        } else if (row.user_id === userId || old.user_id === userId) {
          if (row.release_id != null) void loadPersonalRelease(String(row.release_id));
          if (old.release_id != null && old.release_id !== row.release_id) void loadPersonalRelease(String(old.release_id));
        }
      }).subscribe() : null;
    return () => { cancelled = true; refreshPersonalRef.current = () => undefined; if (channel) void client.removeChannel(channel); };
  }, [userId, refreshKey, visibleIds]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    let releaseCountVersion = 0;
    let reviewCountVersion = 0;
    let countSnapshotVersion = 0;
    const changedIds = new Set<string>();
    const releaseDates = new Map<string, string>();
    const activeIds = new Set<string>();
    const reviewCounts = new Map<string, number>();
    const reviewReleases = new Map<string, string>();
    const pendingIds = new Set<string>();
    const dirtyIds = new Set<string>();
    const loadedIds = new Set<string>();
    let cursor: { createdAt: string; id: string } | null = null;
    let pageLoading = false;
    let rankingVersion = 0;
    let namesVersion = 0;
    setCatalog([]);
    setLatestIds([]);
    setTopIds([]);
    setNewNameIds([]);
    setHasMore(false);

    const loadTop = async () => {
      const version = ++rankingVersion;
      const ids = [...reviewCounts].sort((a, b) => b[1] - a[1]
        || (releaseDates.get(b[0]) ?? '').localeCompare(releaseDates.get(a[0]) ?? '')
        || a[0].localeCompare(b[0])).slice(0, 15).map(([id]) => id);
      const missing = ids.filter((id) => !loadedIds.has(id));
      if (missing.length) {
        const { data, error } = await queryCatalog((columns) => client.from('releases').select(columns).in('id', missing).eq('is_active', true).limit(15).returns<Record<string, unknown>[]>());
        if (cancelled || error || version !== rankingVersion) return;
        const releases = (data ?? []).map((row) => { loadedIds.add(String(row.id)); return normalizeCatalogRelease(row); });
        setCatalog((current) => [...new Map([...current, ...releases].map((release) => [String(release.id), release])).values()]);
      }
      if (!cancelled && version === rankingVersion) setTopIds(ids);
    };
    const loadNewNames = async () => {
      const version = ++namesVersion;
      const { data, error } = await queryCatalog((columns) => client.from('releases').select(columns).eq('is_active', true).or('is_new_name.eq.true,is_freshman.eq.true').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(6).returns<Record<string, unknown>[]>());
      if (cancelled || error || !data || version !== namesVersion) return;
      const releases = data.map((row) => { loadedIds.add(String(row.id)); return normalizeCatalogRelease(row); });
      setCatalog((current) => [...new Map([...current, ...releases].map((release) => [String(release.id), release])).values()]);
      setNewNameIds(releases.map((release) => String(release.id)));
    };

    const loadReleaseCount = async () => {
      const version = ++releaseCountVersion;
      const { count, error } = await client.from('releases').select('id', { count: 'exact', head: true }).eq('is_active', true);
      if (!cancelled && version === releaseCountVersion && !error && count != null) setReleaseCount(count);
    };
    const loadReviewCount = async () => {
      const version = ++reviewCountVersion;
      const { count, error } = await client.from('reviews').select('id', { count: 'exact', head: true });
      if (!cancelled && version === reviewCountVersion && !error && count != null) setReviewCount(count);
    };
    const sortCatalog = (rows: Release[]) => rows.sort((a, b) =>
      (releaseDates.get(String(b.id)) ?? '').localeCompare(releaseDates.get(String(a.id)) ?? '')
      || String(a.id).localeCompare(String(b.id)));
    const refreshRelease = async (id: string) => {
      changedIds.add(id);
      countSnapshotVersion += 1;
      dirtyIds.add(id);
      if (pendingIds.has(id)) return;
      pendingIds.add(id);
      try {
        do {
          dirtyIds.delete(id);
          const { data, error } = await queryCatalog((columns) => client.from('releases').select(columns).eq('id', id).eq('is_active', true).maybeSingle().returns<Record<string, unknown>>());
          if (cancelled) return;
          if (error || dirtyIds.has(id)) continue;
          const release = data ? normalizeCatalogRelease(data) : null;
          if (release) { reviewCounts.set(id, release.reviewCount); loadedIds.add(id); }
          else { reviewCounts.delete(id); loadedIds.delete(id); }
          if (data) releaseDates.set(id, String(data.created_at ?? ''));
          setCatalog((current) => sortCatalog([
            ...current.filter((item) => String(item.id) !== id),
            ...(release?.id && release.title && release.coverUrl ? [release] : []),
          ]));
          void loadTop();
        } while (dirtyIds.has(id));
      } finally { pendingIds.delete(id); }
    };
    // DELETE payloads may contain only the primary key. Refresh just the
    // aggregate columns when the deleted review's release is unknown.
    const refreshReviewCounts = async () => {
      while (!cancelled) {
        const version = countSnapshotVersion;
        const counts = new Map<string, number>();
        for (let offset = 0; !cancelled; offset += 200) {
          const { data, error } = await client.from('releases').select('id, created_at, reviews(count)').eq('is_active', true).order('id', { ascending: false }).range(offset, offset + 199);
          if (cancelled || error || !data) return;
          data.forEach((row) => { counts.set(String(row.id), Number(row.reviews[0]?.count ?? 0)); releaseDates.set(String(row.id), String(row.created_at ?? '')); });
          if (data.length < 200) break;
        }
        if (version !== countSnapshotVersion) continue;
        reviewCounts.clear();
        counts.forEach((count, id) => reviewCounts.set(id, count));
        setCatalog((current) => current.map((release) => {
          const count = reviewCounts.get(String(release.id));
          return count == null ? release : { ...release, reviewCount: count, reviews_count: count, total_reviews_count: count, reviews: [{ count }] };
        }));
        void loadTop();
        return;
      }
    };
    const refreshReview = (id: string | number, created: boolean) => {
      void refreshRelease(String(id));
      if (created) void loadReviewCount();
      setReviewVersion((version) => version + 1);
    };
    refreshReviewRef.current = refreshReview;
    const channel = client.channel('homepage-release-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'releases' }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        const old = payload.old as Record<string, unknown>;
        const id = row.id ?? old.id;
        if (id != null) void refreshRelease(String(id));
        const wasActive = old.is_active ?? activeIds.has(String(id));
        if (row.is_active === true) activeIds.add(String(id));
        else activeIds.delete(String(id));
        if (payload.eventType !== 'UPDATE' || row.is_active !== wasActive) void loadReleaseCount();
        void loadNewNames();
        if (payload.eventType === 'INSERT') {
          if (row.is_active === true && id != null) setLatestIds((current) => [String(id), ...current.filter((value) => value !== String(id))]);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, (payload) => {
        countSnapshotVersion += 1;
        const row = payload.new as Record<string, unknown>;
        const old = payload.old as Record<string, unknown>;
        const reviewId = String(row.id ?? old.id ?? '');
        const oldReleaseId = old.release_id ?? reviewReleases.get(reviewId);
        const releaseId = row.release_id ?? oldReleaseId;
        if (releaseId != null) void refreshRelease(String(releaseId));
        else if (payload.eventType === 'DELETE') void refreshReviewCounts();
        if (oldReleaseId != null && String(oldReleaseId) !== String(releaseId)) void refreshRelease(String(oldReleaseId));
        if (payload.eventType === 'DELETE') reviewReleases.delete(reviewId);
        else if (releaseId != null) reviewReleases.set(reviewId, String(releaseId));
        if (payload.eventType !== 'UPDATE') void loadReviewCount();
        setReviewVersion((version) => version + 1);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'author_comments' }, () => setCommentVersion((version) => version + 1))
      .subscribe();

    const loadCatalog = async () => {
      if (pageLoading) return;
      pageLoading = true;
      setLoading(true);
      setCatalogError(false);
      const pageCursor = cursor;
      const { data, error } = await queryCatalog((columns) => {
        let query = client.from('releases').select(columns).eq('is_active', true).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(CATALOG_PAGE_SIZE + 1);
        if (pageCursor) query = query.or(`created_at.lt.${pageCursor.createdAt},and(created_at.eq.${pageCursor.createdAt},id.lt.${pageCursor.id})`);
        return query.returns<Record<string, unknown>[]>();
      });
      if (cancelled) return;
      pageLoading = false;
      setLoading(false);
      if (error || !data) { setCatalogError(true); return; }
      const page = data.slice(0, CATALOG_PAGE_SIZE);
      const last = page[page.length - 1];
      if (last) cursor = { createdAt: String(last.created_at), id: String(last.id) };
      setHasMore(data.length > CATALOG_PAGE_SIZE);
      const releases = page.filter((row) => !changedIds.has(String(row.id))).map((row) => {
        loadedIds.add(String(row.id));
        activeIds.add(String(row.id));
        releaseDates.set(String(row.id), String(row.created_at ?? ''));
        const count = reviewCounts.get(String(row.id));
        return normalizeCatalogRelease(count == null ? row : { ...row, reviews: [{ count }] });
      }).filter((release) => Boolean(release.id) && release.title && release.coverUrl);
      setCatalog((current) => sortCatalog([...new Map([...current, ...releases].map((release) => [String(release.id), release])).values()]));
      setLatestIds((current) => [...new Set([...current, ...page.map((row) => String(row.id))])]);
    };
    loadMoreRef.current = () => { void loadCatalog(); };
    void loadCatalog();
    void refreshReviewCounts();
    void loadNewNames();
    void loadReleaseCount();
    void loadReviewCount();
    return () => {
      cancelled = true;
      refreshReviewRef.current = () => undefined;
      loadMoreRef.current = () => undefined;
      void client.removeChannel(channel);
    };
  }, [refreshKey]);

  const onReviewSubmitted = useCallback((id: string | number, created: boolean) => {
    refreshReviewRef.current(id, created);
    refreshPersonalRef.current(String(id));
  }, []);
  const releases = useMemo(() => catalog.map((release) => ({ ...release, personalScore: userReviewsMap[String(release.id)] })), [catalog, userReviewsMap]);
  const byId = useMemo(() => new Map(releases.map((release) => [String(release.id), release])), [releases]);
  const latestReleases = useMemo(() => latestIds.flatMap((id) => byId.get(id) ?? []), [latestIds, byId]);
  const topReleases = useMemo(() => topIds.flatMap((id) => byId.get(id) ?? []), [topIds, byId]);
  const newNames = useMemo(() => newNameIds.flatMap((id) => byId.get(id) ?? []), [newNameIds, byId]);
  const loadMore = useCallback(() => loadMoreRef.current(), []);
  return { releases, releaseById: byId, latestReleases, topReleases, newNames, loading, hasMore, catalogError, loadMore, releaseCount, reviewCount, userReviewsMap, reviewVersion, commentVersion, onReviewSubmitted };
}
