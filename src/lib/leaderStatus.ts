import type { RankMovement } from '@/hooks/useAllTimeTop15';

export function leaderStatus(movement?: RankMovement): 'ახალი ლიდერი' | 'ლიდერი' {
  const changedAtMs = movement?.liveChangedAt ? Date.parse(movement.liveChangedAt) : NaN;
  const elapsedMs = Date.now() - changedAtMs;
  return Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < 3 * 24 * 60 * 60 * 1000
    ? 'ახალი ლიდერი'
    : 'ლიდერი';
}
