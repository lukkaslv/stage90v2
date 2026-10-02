import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { queryCatalog } from '@/lib/catalogQuery';
import { normalizeCatalogRelease } from '@/lib/normalizeCatalogRelease';
import type { Release } from '@/types/music';

export interface DailyTopRelease {
  release: Release;
  dailyCount: number;
}

export function useDailyTop15() {
  const [top, setTop] = useState<DailyTopRelease[]>([]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    let request = 0;

    const load = async () => {
      const current = ++request;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const counts = new Map<string, number>();
      for (let from = 0; ; from += 500) {
        const { data, error } = await client.from('reviews')
          .select('release_id').gte('created_at', since)
          .order('created_at', { ascending: false }).range(from, from + 499);
        if (cancelled || current !== request || error || !data) return;
        data.forEach(({ release_id }) => {
          const id = String(release_id);
          counts.set(id, (counts.get(id) ?? 0) + 1);
        });
        if (data.length < 500) break;
      }
      const ids = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 15).map(([id]) => id);
      if (!ids.length) { setTop([]); return; }
      const { data, error } = await queryCatalog((columns) => client.from('releases')
        .select(columns).in('id', ids).eq('is_active', true).limit(15)
        .returns<Record<string, unknown>[]>());
      if (cancelled || current !== request || error || !data) return;
      const byId = new Map(data.map((row) => [String(row.id), normalizeCatalogRelease(row)]));
      setTop(ids.flatMap((id) => {
        const release = byId.get(id);
        return release ? [{ release, dailyCount: counts.get(id) ?? 0 }] : [];
      }));
    };

    void load();
    const channel = client.channel('daily-top-15')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'releases' }, () => { void load(); })
      .subscribe();
    const interval = window.setInterval(() => { void load(); }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void client.removeChannel(channel);
    };
  }, []);

  return top;
}
