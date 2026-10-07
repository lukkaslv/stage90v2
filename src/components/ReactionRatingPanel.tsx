import { Gem, Send, TrendingUp } from 'lucide-react';
import { valueTierFromScore } from '@/lib/valueTier';
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

  return <section className="reaction-score flex w-[29%] shrink-0 flex-col" data-tier={revealed ? tier : undefined} aria-label="შეფასება">
    <div className="reaction-rating-heading flex items-center gap-2.5">
      <span className="reaction-rating-icon flex items-center justify-center"><TrendingUp aria-hidden="true" /></span>
      <h2 className="font-bold">STAGE 90 შეფასება</h2>
    </div>
    <div className="reaction-rating-result flex flex-col items-center">
      <div className="reaction-rating-stage flex w-full flex-col items-center justify-center text-center">
        <div className="reaction-rating-number flex items-baseline justify-center" key={revealed ? score : 'hidden'}>
          <strong className="font-extrabold tabular-nums">{revealed ? score : '—'}</strong>
          <span>/90</span>
        </div>
      </div>
      {revealed ? <div className="reaction-rating-tier flex items-center gap-1.5" key={tier}><Gem aria-hidden="true" /><span className="font-bold">{tier}</span></div>
        : <p className="reaction-rating-hidden">შეფასება დამალულია</p>}
    </div>
    <div className="reaction-rating-control"><SingleScoreInput id="obs-score" score={score} onChange={onChange} compact /></div>
    <button type="button" className="reaction-rating-submit mt-auto flex w-full items-center justify-center gap-2 font-bold" onClick={onSubmit} disabled={!onSubmit || submitting || saveStatus === 'ინახება...'}><Send aria-hidden="true" />{submitting ? 'იგზავნება...' : 'შეფასების გაგზავნა'}</button>
    {saveStatus && <p className="reaction-rating-status" role="status">{saveStatus}</p>}
  </section>;
}
