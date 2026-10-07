import { Gem, Send, TrendingUp } from 'lucide-react';
import { STRICT_VALUE_TIER_CONFIG, valueTierFromScore } from '@/lib/valueTier';

const tiers = [
  { label: 'ვერცხლი', min: 1, max: 49 },
  { label: 'ოქრო', min: 50, max: 64 },
  { label: 'ზურმუხტი', min: 65, max: 74 },
  { label: 'საფირონი', min: 75, max: 84 },
  { label: 'ლალი', min: 85, max: 90 },
] as const;

export default function BroadcastScore({ title, score, revealed, preview, onChange, onSubmit, submitting, status }: {
  title: string;
  score: number;
  revealed: boolean;
  preview: boolean;
  onChange?: (score: number) => void;
  onSubmit?: () => void;
  submitting: boolean;
  status?: string;
}) {
  const tier = valueTierFromScore(score);
  const colorClass = revealed ? STRICT_VALUE_TIER_CONFIG[tier].badge.replace('stage-tier ', '') : '';
  const disabled = submitting || !onChange;
  return <section className={`broadcast-score-panel ${colorClass}`} aria-label="რელიზის შეფასება" data-revealed={revealed}>
    <header className="broadcast-score-heading"><TrendingUp aria-hidden="true" /><div><h2>რელიზის შეფასება</h2><p title={title}>{title}</p></div></header>
    <div className="broadcast-score-result">
      <div className="broadcast-score-orb"><strong>{revealed ? score : '—'}</strong><span>/ 90</span></div>
      <div className="broadcast-score-badge">{revealed ? <><Gem aria-hidden="true" />{tier}</> : 'შეფასების მოლოდინში'}</div>
    </div>
    <div className="broadcast-score-categories" role="group" aria-label="შეფასების კატეგორიები">{tiers.map((item) => <button key={item.label} type="button" className={STRICT_VALUE_TIER_CONFIG[item.label].badge.replace('stage-tier ', '')} disabled={disabled} aria-pressed={revealed && tier === item.label} onClick={() => onChange?.(item.min)}><strong>{item.label}</strong><span>{item.min}–{item.max}</span></button>)}</div>
    <div className="broadcast-score-adjust"><label htmlFor="broadcast-score">ქულა<strong>{score}<small>/90</small></strong></label><input id="broadcast-score" type="range" min={1} max={90} step={1} value={score} disabled={disabled} aria-valuetext={`${score} ქულა 90-დან`} onChange={(event) => onChange?.(Number(event.target.value))} style={{ background: `linear-gradient(to right, var(--score-color) ${((score - 1) / 89) * 100}%, #393345 ${((score - 1) / 89) * 100}%)` }} /></div>
    <button type="button" onClick={onSubmit} disabled={!onSubmit || submitting} className="broadcast-score-send"><Send aria-hidden="true" />{submitting ? 'იგზავნება...' : 'შეფასების გაგზავნა'}</button>
    <p className="broadcast-score-feedback" role="status">{status ?? (preview ? 'შეფასება შეცვალეთ ეთერის ბმულზე.' : 'ქულა გამოქვეყნდება გაგზავნის შემდეგ.')}</p>
  </section>;
}
