import { useCallback, useEffect, useRef, useState } from 'react';

interface PageResult {
  data: Record<string, unknown>[] | null;
  error: unknown;
}

export function useSupabasePages(fetchPage: (from: number, to: number) => PromiseLike<PageResult>, pageSize: number, refreshVersion = 0) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const offset = useRef(0);
  const busy = useRef(false);
  const loadMore = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const version = generation.current;
    setLoading(true);
    setError(false);
    try {
      const result = await fetchPage(offset.current, offset.current + pageSize);
      if (version !== generation.current) return;
      if (result.error || !result.data) {
        console.error('Supabase pagination query failed', result.error);
        setError(true);
        return;
      }
      const page = result.data.slice(0, pageSize);
      offset.current += page.length;
      setRows((current) => [...new Map([...current, ...page].map((row) => [String(row.id), row])).values()]);
      setHasMore(result.data.length > pageSize);
    } catch (cause) {
      if (version === generation.current) {
        console.error('Supabase pagination query failed', cause);
        setError(true);
      }
    } finally {
      if (version === generation.current) { busy.current = false; setLoading(false); }
    }
  }, [fetchPage, pageSize]);
  useEffect(() => {
    generation.current += 1;
    offset.current = 0;
    busy.current = false;
    setRows([]);
    setHasMore(false);
    void loadMore();
    return () => { generation.current += 1; };
  }, [loadMore, refreshVersion]);
  return { rows, loading, hasMore, error, loadMore };
}
