import type { RankMovement } from '@/hooks/useAllTimeTop15';

interface Props {
  rank: number;
  movement?: RankMovement;
  compact?: boolean;
  micro?: boolean;
}

export default function RankMovementBadge({ rank, movement, compact = false, micro = false }: Props) {
  if (!movement || (!movement.hasPrevious && movement.liveChangedAt === null)) return null;
  const live = movement.liveChangedAt !== null;
  const previousRank = live ? movement.livePreviousRank : movement.previousRank;
  const change = previousRank == null ? null : previousRank - rank;
  if (change === 0) return null;

  const total = movement.firstRank == null ? null : movement.firstRank - rank;
  const totalHint = total == null || total === 0 ? '' : ` · პირველი ჩანაწერიდან ${total > 0 ? '↑' : '↓'} ${Math.abs(total)}`;
  const newLeader = rank === 1 && (change == null || change > 0);
  const label = newLeader ? micro ? 'ლიდერი' : compact ? 'ახალი ლიდერი' : 'ახალი ლიდერი · #1' : change == null ? compact ? 'ახალი' : `ახალი #${rank}` : `${change > 0 ? '↑' : '↓'} ${Math.abs(change)}`;
  const direction = newLeader ? 'leader' : change == null ? 'new' : change > 0 ? 'up' : 'down';

  return <span key={`${rank}:${change}`} className={`stage-rank-status stage-rank-${direction} ${compact ? 'stage-rank-status-compact' : ''}`} title={`${live ? 'ბოლო ცვლილება' : 'ბოლო შენახული პოზიციიდან'} ${label}${totalHint}`} aria-label={newLeader ? 'ახალი ლიდერი, პირველი ადგილი' : change == null ? `ახალი, ${rank} ადგილი` : `${Math.abs(change)} ადგილით ${change > 0 ? 'დაწინაურდა' : 'ჩამოქვეითდა'}`}>
    {label}
  </span>;
}

export function RankMovementDetail({ rank, movement }: Props) {
  if (!movement || (!movement.hasPrevious && movement.liveChangedAt === null)) return null;
  const previousRank = movement.liveChangedAt !== null ? movement.livePreviousRank : movement.previousRank;
  const recent = previousRank == null ? null : previousRank - rank;
  const total = movement.firstRank == null ? null : movement.firstRank - rank;
  const showTotal = total !== null && total !== 0 && total !== recent;
  if (!showTotal && movement.top3Weeks === 0) return null;

  return <span className="stage-rank-detail">
    {showTotal && <span title={`პირველი შენახული პოზიცია: ${movement.firstDate ?? ''}`}>სულ {total > 0 ? '↑' : '↓'} {Math.abs(total)}</span>}
    {movement.top3Weeks > 0 && <span>{movement.top3Weeks} კვირა სამეულში</span>}
  </span>;
}
