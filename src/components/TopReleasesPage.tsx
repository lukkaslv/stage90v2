import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { queryCatalog } from '@/lib/catalogQuery';
import { normalizeCatalogRelease } from '@/lib/normalizeCatalogRelease';
import type { Release } from '@/types/music';
import ReleaseCard from '@/components/ReleaseCard';
import PageHeading from '@/components/PageHeading';
import SectionLoader from '@/components/SectionLoader';

export default function TopReleasesPage({ onReleaseClick }: { onReleaseClick: (release: Release) => void }) {
  const [ranking, setRanking] = useState<string[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let cancelled = false;
    let version = 0;
    const loadRanking = async () => {
      const current = ++version;
      const rankedIds: string[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error: cause } = await client.from('releases').select('id')
          .eq('is_active', true).gt('overall_score', 0)
          .order('overall_score', { ascending: false })
          .order('id', { ascending: true }).range(from, from + 499);
        if (cancelled || current !== version) return;
        if (cause || !data) { setError(true); setLoading(false); return; }
        data.forEach((row) => rankedIds.push(String(row.id)));
        if (data.length < 500) break;
      }
      setRanking(rankedIds);
      setError(false);
      setLoading(false);
    };
    void loadRanking();
    const channel = client.channel('top-releases-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => { void loadRanking(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'releases' }, () => { void loadRanking(); })
      .subscribe();
    return () => { cancelled = true; void client.removeChannel(channel); };
  }, []);

  const ids = useMemo(() => ranking.slice(0, limit), [ranking, limit]);
  useEffect(() => {
    const client = supabase;
    if (!client || !ids.length) { setReleases([]); return; }
    let cancelled = false;
    setLoading(true);
    void queryCatalog((columns) => client.from('releases').select(columns).in('id', ids)
      .eq('is_active', true).limit(ids.length).returns<Record<string, unknown>[]>()).then(({ data, error: cause }) => {
        if (cancelled) return;
        if (cause || !data) setError(true);
        else {
          const byId = new Map(data.map((row) => [String(row.id), normalizeCatalogRelease(row)]));
          setReleases(ids.flatMap((id) => byId.get(id) ?? []));
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [ids]);

  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <PageHeading title="ყველა დროის ტოპ რელიზები ქულებით" />
    <div className="stage-catalog-grid grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {releases.map((release) => <ReleaseCard key={String(release.id)} release={release} onClick={onReleaseClick} />)}
    </div>
    {loading && releases.length === 0 && <SectionLoader />}
    {ranking.length === 0 && !loading && !error && <p className="stage-empty-state">რეიტინგისთვის თითოეულ რელიზს 3 დადასტურებული შემფასებელი სჭირდება.</p>}
    {error && <p className="py-5 text-center text-rose-300">მონაცემების ჩატვირთვა ვერ მოხერხდა.</p>}
    {ranking.length > limit && <button type="button" onClick={() => setLimit((current) => current + 20)} disabled={loading} className="mx-auto mt-8 block rounded-lg border border-blue-400/30 px-5 py-2 text-sm font-semibold text-blue-300 disabled:opacity-50">კიდევ 20 რელიზის ნახვა</button>}
  </main>;
}
