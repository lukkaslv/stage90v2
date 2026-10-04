export default function LiveRankingIndicator({ compact = false, iconOnly = false }: { compact?: boolean; iconOnly?: boolean }) {
  return <span className={`stage-live-indicator ${compact ? 'stage-live-indicator-compact' : ''}`} title="რეიტინგი ავტომატურად ახლდება" aria-label="რეიტინგი ავტომატურად ახლდება">
    <span className="stage-live-bars" aria-hidden="true"><i /><i /><i /></span>
    {!iconOnly && <span>{compact ? 'ცოცხალი' : 'ცოცხალი რეიტინგი'}</span>}
  </span>;
}
