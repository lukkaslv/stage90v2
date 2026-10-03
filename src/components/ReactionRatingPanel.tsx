import { Gem, TrendingUp } from 'lucide-react';
import { computeRZTScore, RZT_PARAMS, VIBE_COEFFICIENTS, VIBE_LEVELS } from '@/types/music';
import { STRICT_VALUE_TIER_CONFIG, valueTierFromScore } from '@/lib/valueTier';

interface ReactionRatingPanelProps {
  params: number[];
  vibe: number;
  revealed: boolean;
  onChange?: (params: number[], vibe: number) => void;
  saveStatus?: string;
}

export default function ReactionRatingPanel({ params, vibe, revealed, onChange, saveStatus }: ReactionRatingPanelProps) {
  const score = computeRZTScore(params, vibe);
  const tier = valueTierFromScore(score);
  const tierConfig = STRICT_VALUE_TIER_CONFIG[tier];

  return <section className="reaction-score flex w-[29%] shrink-0 flex-col" aria-label="შეფასება">
    <div className="reaction-rating-heading flex items-center gap-2.5">
      <span className="reaction-rating-icon flex items-center justify-center"><TrendingUp aria-hidden="true" /></span>
      <h2 className="font-bold">STAGE 90 შეფასების სისტემა</h2>
    </div>

    <div className="reaction-rating-result flex flex-col items-center">
      <div className="reaction-rating-number flex flex-col items-center justify-center text-center">
        <strong className="font-extrabold tabular-nums">{revealed ? score : '—'}</strong>
        <span>/ 90</span>
      </div>
      {revealed && <div className={`reaction-rating-tier flex items-center gap-1.5 ${tierConfig.badge}`}><Gem aria-hidden="true" className={tierConfig.icon} /><span className="font-bold">{tier}</span></div>}
    </div>

    <p className="reaction-rating-prompt">როგორ განიცდი ამ მუსიკას? შეაფასე თითოეული განცდა ცალ-ცალკე (1–10).</p>
    <div className="reaction-rating-criteria">{RZT_PARAMS.map((param, index) => <div key={param.id} className="reaction-rating-criterion">
      <div className="reaction-rating-label flex items-center justify-between gap-2"><label htmlFor={`obs-rzt-${param.id}`}>{param.label}</label><strong className="shrink-0 tabular-nums">{params[index]}</strong></div>
      <p className="reaction-rating-question">{param.question}</p>
      <p className="reaction-rating-hint">{param.hint}</p>
      <input id={`obs-rzt-${param.id}`} type="range" min={1} max={10} step={1} value={params[index]} disabled={!onChange} onChange={(event) => onChange?.(params.map((point, pointIndex) => pointIndex === index ? Number(event.target.value) : point), vibe)} className="rzt-slider" style={{ ['--fill' as string]: `${((params[index] - 1) / 9) * 100}%` }} />
    </div>)}</div>

    <div className="reaction-rating-vibe">
      <div className="reaction-rating-label flex items-center justify-between gap-2"><label htmlFor="obs-rzt-vibe">ატმოსფერო</label><strong className="text-right">{VIBE_LEVELS[vibe - 1]}</strong></div>
      <p className="reaction-rating-question">რამდენად მთლიან, გამომსახველ და ძლიერ სამყაროს ქმნის მუსიკა შენთვის?</p>
      <input id="obs-rzt-vibe" type="range" min={1} max={5} step={1} value={vibe} disabled={!onChange} onChange={(event) => onChange?.(params, Number(event.target.value))} className="rzt-vibe-slider" style={{ ['--fill' as string]: `${((vibe - 1) / 4) * 100}%` }} />
      <div className="reaction-rating-scale flex justify-between">{VIBE_LEVELS.map((level, index) => <span key={level} className={vibe === index + 1 ? 'reaction-rating-scale-current' : ''}>{index + 1}</span>)}</div>
      <p className="reaction-rating-coefficient">კოეფიციენტი: <span>{VIBE_COEFFICIENTS[vibe - 1].toFixed(4)}</span></p>
    </div>

    <div className="reaction-rating-formula">ფორმულა: ({params.join(' + ')}) × 1.4 × {VIBE_COEFFICIENTS[vibe - 1].toFixed(4)} = <strong>{revealed ? score : '—'}</strong></div>
    {saveStatus && <p className="reaction-rating-status" role="status">{saveStatus}</p>}
  </section>;
}
