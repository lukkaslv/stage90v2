import { valueTierFromScore } from '@/lib/valueTier';

export const SCORE_PROMPTS = [
  'რა დაგამახსოვრდა ყველაზე მეტად?',
  'გინდა ამ ტრეკის ხელახლა მოსმენა?',
  'რამდენად მთლიანად და დამაჯერებლად ჟღერს?',
];

export const SCORE_TIERS = [
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
  return <div>
    <p className={compact ? 'text-[.7cqw] text-gray-300' : 'text-sm text-gray-300'}>შეფასებამდე დაფიქრდი:</p>
    <ul className={compact ? 'mt-[.4cqw] space-y-[.2cqw] text-[.62cqw] leading-snug text-gray-400' : 'mt-2 space-y-1 text-xs leading-relaxed text-gray-400'}>
      {SCORE_PROMPTS.map((prompt) => <li key={prompt}>• {prompt}</li>)}
    </ul>
    <div className={compact ? 'mt-[.8cqw] flex items-center justify-between text-[.7cqw]' : 'mt-5 flex items-center justify-between text-sm'}>
      <label htmlFor={id} className="font-bold text-white">საბოლოო შეფასება</label>
      <strong className="tabular-nums text-blue-300">{score}/90 · {tier}</strong>
    </div>
    <input id={id} type="range" min={1} max={90} step={1} value={score} onChange={(event) => onChange?.(Number(event.target.value))} disabled={disabled || !onChange} className="rzt-slider mt-3 disabled:cursor-not-allowed disabled:opacity-40" style={{ ['--fill' as string]: `${((score - 1) / 89) * 100}%` }} />
    <div className={compact ? 'mt-[.5cqw] grid grid-cols-5 gap-[.2cqw]' : 'mt-3 grid grid-cols-5 gap-1'}>
      {SCORE_TIERS.map((item) => <div key={item.label} className={`${compact ? 'px-[.1cqw] py-[.25cqw] text-[.53cqw]' : 'px-1 py-1.5 text-[10px]'} min-w-0 border text-center leading-tight ${tier === item.label ? 'border-blue-400 bg-blue-400/15 text-white' : 'border-[#353943] text-gray-500'}`}><strong className="block">{item.label}</strong><span>{item.range}</span></div>)}
    </div>
  </div>;
}
