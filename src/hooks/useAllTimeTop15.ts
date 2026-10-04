import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { queryCatalog } from '@/lib/catalogQuery';
import { normalizeCatalogRelease } from '@/lib/normalizeCatalogRelease';
import type { Release } from '@/types/music';

interface ChartMetaRow {
  chart: 'all_time' | 'weekly';
  release_id: string;
  chart_rank: number;
  chart_score: number;
  previous_rank: number | null;
  has_previous: boolean;
  top3_days: number;
  votes: number | null;
  baseline_date: string | null;
  first_rank: number | null;
  first_date: string | null;
}

interface LiveChangeRow {
  release_id: string;
  previous_rank: number | null;
  changed_at: string;
}

export interface RankMovement {
  previousRank: number | null;
  hasPrevious: boolean;
  top3Weeks: number;
  baselineDate: string | null;
  firstRank: number | null;
  firstDate: string | null;
  livePreviousRank: number | null;
  liveChangedAt: string | null;
}

export interface WeeklyRankedRelease {
  release: Release;
  score: number;
  votes: number;
}

export function useAllTimeTop15() {
  const [top, setTop] = useState<Release[]>([]);
  const [weeklyTop, setWeeklyTop] = useState<WeeklyRankedRelease[]>([]);
  const [movement, setMovement] = useState<Record<string, RankMovement>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weeklyError, setWeeklyError] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); setError(true); setWeeklyLoading(false); setWeeklyError(true); return; }
    let cancelled = false;
    let request = 0;

    const load = async () => {
      const current = ++request;
      const [catalog, chart, liveChanges] = await Promise.all([
        queryCatalog((columns) => client.from('releases')
          .select(columns)
          .eq('is_active', true)
          .gt('overall_score', 0)
          .order('overall_score', { ascending: false })
          .order('id', { ascending: true })
          .limit(15)
          .returns<Record<string, unknown>[]>()),
        client.rpc('top15_chart_meta'),
        client.rpc('top15_live_changes'),
      ]);
      if (cancelled || current !== request) return;

      if (catalog.error || !catalog.data) setError(true);
      else { setTop(catalog.data.map(normalizeCatalogRelease)); setError(false); }
      setLoading(false);

      if (chart.error || !Array.isArray(chart.data)) {
        setWeeklyError(true);
        setWeeklyLoading(false);
        return;
      }

      const rows = chart.data as ChartMetaRow[];
      const liveByRelease = new Map<string, LiveChangeRow>(
        Array.isArray(liveChanges.data)
          ? (liveChanges.data as LiveChangeRow[]).map((row) => [row.release_id, row])
          : [],
      );
      const nextMovement: Record<string, RankMovement> = {};
      rows.filter((row) => row.chart === 'all_time').forEach((row) => {
        const live = liveByRelease.get(row.release_id);
        nextMovement[row.release_id] = {
          previousRank: row.previous_rank,
          hasPrevious: row.has_previous,
          top3Weeks: Math.floor(row.top3_days / 7),
          baselineDate: row.baseline_date,
          firstRank: row.first_rank,
          firstDate: row.first_date,
          livePreviousRank: live?.previous_rank ?? null,
          liveChangedAt: live?.changed_at ?? null,
        };
      });
      setMovement(nextMovement);

      const weeklyRows = rows.filter((row) => row.chart === 'weekly').sort((a, b) => a.chart_rank - b.chart_rank);
      if (weeklyRows.length === 0) {
        setWeeklyTop([]);
        setWeeklyError(false);
        setWeeklyLoading(false);
        return;
      }

      const weeklyCatalog = await queryCatalog((columns) => client.from('releases')
        .select(columns)
        .in('id', weeklyRows.map((row) => row.release_id))
        .returns<Record<string, unknown>[]>());
      if (cancelled || current !== request) return;
      if (weeklyCatalog.error || !weeklyCatalog.data) setWeeklyError(true);
      else {
        const releasesById = new Map(weeklyCatalog.data.map((row) => [String(row.id), normalizeCatalogRelease(row)]));
        setWeeklyTop(weeklyRows.flatMap((row) => {
          const release = releasesById.get(row.release_id);
          return release ? [{ release, score: row.chart_score, votes: row.votes ?? 0 }] : [];
        }));
        setWeeklyError(false);
      }
      setWeeklyLoading(false);
    };

    void load();
    const channel = client.channel(`all-time-top-15-${window.crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'releases' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => { void load(); })
      .subscribe();
    const interval = window.setInterval(() => { void load(); }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void client.removeChannel(channel);
    };
  }, []);

  return { top, weeklyTop, movement, loading, error, weeklyLoading, weeklyError };
}
