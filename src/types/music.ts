export type ReleaseType = 'ალბომი' | 'EP' | 'სინგლი' | 'მიქსტეიპი';

export interface Release {
  id: number | string;
  title: string;
  artist: string;
  coverUrl: string;
  type: ReleaseType;
  release_type?: string;
  year: number;
  score: number;
  score_community?: number;
  community_score?: number;
  score_critics?: number;
  critics_score?: number;
  reviewCount: number;
  reviews_count?: number;
  total_reviews_count?: number;
  reviews?: unknown[];
  commentCount?: number;
  trackCount: number;
  genre: string;
  season?: string;
  scores?: { community: number; critics: number; personal: number };
  personalScore?: number;
  valueTier?: string;
  value_tier?: string;
  is_new_name?: boolean;
  is_freshman?: boolean;
  youtube_url?: string;
  streaming_url?: string;
  audio_url?: string;
}

export function releaseTypeLabel(release: Pick<Release, 'type' | 'release_type'>): string {
  const rawType = String(release.release_type ?? '').trim();
  const normalizedType = rawType.toLowerCase();
  if (normalizedType === 'single' || rawType === 'სინგლი') return 'სინგლი';
  if (normalizedType === 'track' || rawType === 'ტრეკი') return 'ტრეკი';
  if (normalizedType === 'album' || rawType === 'ალბომი') return 'ალბომი';
  return rawType;
}

export type ValueTier = 'ვერცხლი' | 'ოქრო' | 'ზურმუხტი' | 'საფირონი' | 'ლალი';

export const VIBE_COEFFICIENTS = [1.0, 1.1518, 1.3036, 1.4554, 1.6072] as const;

export const VIBE_LEVELS = ['ჩაძირული', 'მშვიდი', 'ნეიტრალური', 'ამაღლებული', 'ტრანსცენდენტული'] as const;

export const RZT_PARAMS = [
  { id: 'rhymes', label: 'რითმები / სახეები' },
  { id: 'structure', label: 'სტრუქტურა / რიტმიკა' },
  { id: 'style', label: 'სტილის რეალიზაცია' },
  { id: 'individuality', label: 'ინდივიდუალობა / ქარიზმა' },
] as const;

export const VALUE_TIER_CONFIG: Record<ValueTier, { color: string; glow: string; gradient: string }> = {
  'ვერცხლი': { color: 'text-gray-300', glow: 'shadow-[0_0_20px_-4px_rgba(203,213,225,0.4)]', gradient: 'from-gray-400/20 to-gray-500/10' },
  'ოქრო': { color: 'text-amber-300', glow: 'shadow-[0_0_20px_-4px_rgba(251,191,36,0.4)]', gradient: 'from-amber-400/20 to-amber-600/10' },
  'ზურმუხტი': { color: 'text-teal-300', glow: 'shadow-[0_0_20px_-4px_rgba(45,212,191,0.4)]', gradient: 'from-teal-400/20 to-teal-600/10' },
  'საფირონი': { color: 'text-cyan-300', glow: 'shadow-[0_0_20px_-4px_rgba(34,211,238,0.4)]', gradient: 'from-cyan-400/20 to-cyan-600/10' },
  'ლალი': { color: 'text-rose-400', glow: 'shadow-[0_0_24px_-2px_rgba(251,113,133,0.5)]', gradient: 'from-rose-400/20 to-rose-600/10' },
};

export const REVIEW_RULES = [
  'უცენზურო ლექსიკის გარეშე',
  'შეურაცხყოფის გარეშე',
  'რეკლამისა და ბმულების გარეშე',
  'არა AI-გენერირებულ ტექსტებს, დაწერეთ თავად',
  'შინაარსიანი და დასაბუთებული',
];

export const REVIEW_FORM_TABS = [
  { id: 'review', label: 'რეცენზია' },
  { id: 'rating-only', label: 'შეფასება რეცენზიის გარეშე' },
  { id: 'value', label: 'ღირებულების მინიჭება' },
] as const;

export interface Review {
  id: number | string;
  username: string;
  badge: string;
  releaseTitle: string;
  artist: string;
  coverUrl: string;
  ratings: { production: number; lyrics: number; originality: number; replay: number };
  totalScore: number;
  excerpt: string;
  date: string;
  role?: string;
  authorCategory?: string;
  isVerified?: boolean;
}

export type PageId = 'releases' | 'top90' | 'achievements' | 'concerts';

export const categoryTabs: { id: PageId; label: string }[] = [
  { id: 'releases', label: 'რელიზები' },
  { id: 'top90', label: 'ტოპ-90' },
  { id: 'achievements', label: 'მიღწევები' },
  { id: 'concerts', label: 'კონცერტები' },
];

function computeValueTier(score: number): ValueTier {
  if (score >= 85) return 'ლალი';
  if (score >= 75) return 'საფირონი';
  if (score >= 65) return 'ზურმუხტი';
  if (score >= 50) return 'ოქრო';
  return 'ვერცხლი';
}

export function computeRZTScore(params: number[], vibeLevel: number): number {
  const baseSum = params[0] + params[1] + params[2] + params[3];
  const vibeCoeff = VIBE_COEFFICIENTS[vibeLevel - 1] ?? 1.0;
  return Math.min(90, Math.round(baseSum * 1.4 * vibeCoeff));
}

export function scoreToTier(score: number): ValueTier {
  return computeValueTier(score);
}
