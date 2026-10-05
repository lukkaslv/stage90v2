import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Listen before loading; reload after reconnect and coalesce bursts of score updates.
export function useArtistLiveQuery<T>(query: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [live, setLive] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const client = supabase;
    let cancelled = false;
    let running = false;
    let pending = false;
    setData(null);
    setLoading(true);
    setError(false);
    setLive(false);
    const load = async () => {
      if (cancelled) return;
      if (running) { pending = true; return; }
      running = true;
      try {
        do {
          pending = false;
          try {
            const result = await query();
            if (!cancelled) { setData(result); setError(false); }
          } catch {
            if (!cancelled) setError(true);
          }
        } while (pending && !cancelled);
      } finally {
        running = false;
        if (!cancelled) setLoading(false);
      }
    };
    const channel = client?.channel(`artist-live-${window.crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'artists' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'artist_releases' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'releases' }, () => { void load(); })
      .subscribe((status) => {
        if (cancelled) return;
        setLive(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') void load();
      });
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('online', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(onVisible, 60_000);
    void load();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('online', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel && client) void client.removeChannel(channel);
    };
  }, [query, revision]);

  return { data, loading, error, live, reload };
}
