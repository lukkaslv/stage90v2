import { useLayoutEffect, useRef } from 'react';
import type { ArtistQueueEntry } from '@/lib/artistQueue';

interface ArtistQueueProps {
  entries: ArtistQueueEntry[];
}

export default function ArtistQueue({ entries }: ArtistQueueProps) {
  const rows = useRef(new Map<string, HTMLLIElement>());
  const previous = useRef(new Map<string, { top: number; requests: number }>());
  const previousLeader = useRef<string | null>(null);
  const leaderChanged = previousLeader.current !== null && previousLeader.current !== (entries[0]?.artist ?? null);

  useLayoutEffect(() => {
    const next = new Map<string, { top: number; requests: number }>();
    entries.forEach((entry) => {
      const row = rows.current.get(entry.artist);
      if (!row) return;
      const top = row.getBoundingClientRect().top;
      const before = previous.current.get(entry.artist);
      if (leaderChanged && before && before.top !== top && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        row.animate([{ transform: `translateY(${before.top - top}px)` }, { transform: 'translateY(0)' }], {
          duration: 450, easing: 'ease-in-out',
        });
      }
      next.set(entry.artist, { top, requests: entry.requests });
    });
    previous.current = next;
    previousLeader.current = entries[0]?.artist ?? null;
  }, [entries, leaderChanged]);

  return <section className="reaction-queue" aria-label="არტისტების რიგი">
    <h2>არტისტების რიგი</h2>
    {entries.length === 0 ? <p className="reaction-queue-empty">რიგი ცარიელია</p> : <ol className="reaction-queue-list">
      {entries.map((entry, index) => {
        const increased = entry.requests > (previous.current.get(entry.artist)?.requests ?? entry.requests);
        return <li key={entry.artist} ref={(node) => { if (node) rows.current.set(entry.artist, node); else rows.current.delete(entry.artist); }} className="reaction-queue-row">
          <span className="reaction-queue-rank">{index + 1}.</span>
          <strong>{entry.artist}</strong>
          <span key={`${entry.artist}:${entry.requests}`} className={`reaction-queue-count${increased ? ' reaction-queue-count-up' : ''}`}>×{entry.requests}</span>
        </li>;
      })}
    </ol>}
  </section>;
}
