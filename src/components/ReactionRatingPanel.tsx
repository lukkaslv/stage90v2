import { Gem, Send, TrendingUp } from 'lucide-react';
import { STRICT_VALUE_TIER_CONFIG, valueTierFromScore } from '@/lib/valueTier';
import SingleScoreInput from '@/components/SingleScoreInput';

interface ReactionRatingPanelProps {
  score: number;
  revealed: boolean;
  onChange?: (score: number) => void;
  onSubmit?: () => void;
  submitting?: boolean;
  saveStatus?: string;
}

export default function ReactionRatingPanel({ score, revealed, onChange, onSubmit, submitting = false, saveStatus }: ReactionRatingPanelProps) {
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
    <div className="mt-[1cqw]"><SingleScoreInput id="obs-score" score={score} onChange={onChange} compact /></div>
    <button type="button" className="reaction-rating-submit mt-auto flex w-full items-center justify-center gap-2 font-bold" onClick={onSubmit} disabled={!onSubmit || submitting || saveStatus === 'ინახება...'}><Send aria-hidden="true" />{submitting ? 'იგზავნება...' : 'შეფასების გაგზავნა'}</button>
    {saveStatus && <p className="reaction-rating-status" role="status">{saveStatus}</p>}
  </section>;
}
