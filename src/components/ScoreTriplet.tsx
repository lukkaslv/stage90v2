type ScoreValue = number | string | null | undefined;

interface ScoreTripletProps {
  community: ScoreValue;
  media: ScoreValue;
  personal: ScoreValue;
  large?: boolean;
  className?: string;
}

export default function ScoreTriplet({ community, media, personal, large = false, className = '' }: ScoreTripletProps) {
  const display = (value: ScoreValue) => value == null || value === '' || value === '—' || Number(value) === 0 ? '—' : value;
  const scores = [
    { label: 'საზოგადოება', value: community },
    { label: 'მედია', value: media },
    { label: 'ჩემი', value: personal },
  ];
  return <div className={`stage-score-triplet ${large ? 'stage-score-triplet-large' : ''} ${className}`} aria-label="შეფასებები">
    {scores.map(({ label, value }, index) => <div key={label} className="stage-score-item" data-score-group={index}><span className="stage-score-label">{label}</span><div className="stage-score-number"><strong>{display(value)}</strong>{display(value) !== '—' && <small>/90</small>}</div></div>)}
  </div>;
}
