import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { queryCatalog } from '@/lib/catalogQuery';
import { normalizeCatalogRelease } from '@/lib/normalizeCatalogRelease';
import type { Release } from '@/types/music';

export function useAllTimeTop15() {
  const [top, setTop] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); setError(true); return; }
    let cancelled = false;
    let request = 0;

    const load = async () => {
      const current = ++request;
      const { data, error: cause } = await queryCatalog((columns) => client.from('releases')
        .select(columns)
        .eq('is_active', true)
        .gt('overall_score', 0)
        .order('overall_score', { ascending: false })
        .order('id', { ascending: true })
        .limit(15)
        .returns<Record<string, unknown>[]>());
      if (cancelled || current !== request) return;
      if (cause || !data) { setLoading(false); setError(true); return; }
      setTop(data.map(normalizeCatalogRelease));
      setLoading(false);
      setError(false);
    };

    void load();
    const channel = client.channel(`all-time-top-15-${window.crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'releases' }, () => { void load(); })
      .subscribe();
    const interval = window.setInterval(() => { void load(); }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void client.removeChannel(channel);
    };
  }, []);

  return { top, loading, error };
}
