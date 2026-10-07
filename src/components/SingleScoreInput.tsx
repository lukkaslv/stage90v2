import { valueTierFromScore } from '@/lib/valueTier';

const SCORE_PROMPTS = [
  'რა დაგამახსოვრდა ყველაზე მეტად?',
  'გინდა ამ ტრეკის ხელახლა მოსმენა?',
  'რამდენად მთლიანად და დამაჯერებლად ჟღერს?',
];

const SCORE_TIERS = [
  { label: 'ვერცხლი', range: '1–49' },
  { label: 'ოქრო', range: '50–64' },
  { label: 'ზურმუხტი', range: '65–74' },
  { label: 'საფირონი', range: '75–84' },
  { label: 'ლალი', range: '85–90' },
] as const;

interface SingleScoreInputProps {
  id: string;
  score: number;
  onChange?: (score: number) => void;
  compact?: boolean;
  disabled?: boolean;
}

export default function SingleScoreInput({ id, score, onChange, compact = false, disabled = false }: SingleScoreInputProps) {
  const tier = valueTierFromScore(score);
  if (compact) return <div className="reaction-score-control">
    <label htmlFor={id} className="sr-only">საბოლოო შეფასება</label>
    <input id={id} type="range" min={1} max={90} step={1} value={score} onChange={(event) => onChange?.(Number(event.target.value))} disabled={disabled || !onChange} className="rzt-slider reaction-score-slider disabled:cursor-not-allowed disabled:opacity-40" style={{ ['--fill' as string]: `${((score - 1) / 89) * 100}%` }} />
    <div className="reaction-score-scale"><span>1</span><span>90</span></div>
    <div className="reaction-score-tiers">
      {SCORE_TIERS.map((item) => <div key={item.label} className={`reaction-score-tier ${tier === item.label ? 'reaction-score-tier-active' : ''}`}><strong>{item.label}</strong><span>{item.range}</span></div>)}
    </div>
  </div>;
  return <div>
    <p className="text-sm text-gray-300">შეფასებამდე დაფიქრდი:</p>
    <ul className="mt-2 space-y-1 text-xs leading-relaxed text-gray-400">
      {SCORE_PROMPTS.map((prompt) => <li key={prompt}>• {prompt}</li>)}
    </ul>
    <div className="mt-5 flex items-center justify-between text-sm">
      <label htmlFor={id} className="font-bold text-white">საბოლოო შეფასება</label>
      <strong className="tabular-nums text-blue-300">{score}/90 · {tier}</strong>
    </div>
    <input id={id} type="range" min={1} max={90} step={1} value={score} onChange={(event) => onChange?.(Number(event.target.value))} disabled={disabled || !onChange} className="rzt-slider mt-3 disabled:cursor-not-allowed disabled:opacity-40" style={{ ['--fill' as string]: `${((score - 1) / 89) * 100}%` }} />
    <div className="mt-3 grid grid-cols-5 gap-1">
      {SCORE_TIERS.map((item) => <div key={item.label} className={`min-w-0 border px-1 py-1.5 text-center text-[10px] leading-tight ${tier === item.label ? 'border-blue-400 bg-blue-400/15 text-white' : 'border-[#353943] text-gray-500'}`}><strong className="block">{item.label}</strong><span>{item.range}</span></div>)}
    </div>
  </div>;
}
