import { valueTierFromScore } from '@/lib/valueTier';

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
  overall_score?: number;
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
  const rawType = String(release.release_type ?? release.type ?? '').trim();
  const normalizedType = rawType.toLowerCase();
  if (normalizedType === 'single' || rawType === 'სინგლი') return 'სინგლი';
  if (normalizedType === 'track' || rawType === 'ტრეკი') return 'ტრეკი';
  if (normalizedType === 'album' || rawType === 'ალბომი') return 'ალბომი';
  if (normalizedType === 'ep' || rawType === 'ეპი') return 'ეპი';
  return rawType;
}

export type ValueTier = 'ვერცხლი' | 'ოქრო' | 'ზურმუხტი' | 'საფირონი' | 'ლალი';

export const VIBE_COEFFICIENTS = [1.0, 1.1518, 1.3036, 1.4554, 1.6072] as const;

export const VIBE_LEVELS = ['სუსტი', 'შესამჩნევი', 'გამოკვეთილი', 'ძლიერი', 'განსაკუთრებით ძლიერი'] as const;

export const RZT_PARAMS = [
  { id: 'response', storageKey: 'rhymes', label: 'გამოძახილი', question: 'რამდენად ძლიერ რეაქციას იწვევს ეს მუსიკა შენში?', hint: 'გრძნობა, ინტერესი ან შინაგანი გამოძახილი' },
  { id: 'engagement', storageKey: 'structure', label: 'ჩართულობა', question: 'რამდენად ერთვები ამ მუსიკის განცდაში?', hint: 'პირადი კავშირი და ემოციური მონაწილეობა' },
  { id: 'immersion', storageKey: 'style', label: 'ჩაძირვა', question: 'რამდენად იძირები მუსიკალურ სამყაროში?', hint: 'ყურადღების სრულად მიპყრობა' },
  { id: 'transformation', storageKey: 'individuality', label: 'გარდაქმნა', question: 'რამდენად ცვლის მუსიკა შენს შინაგან მდგომარეობას?', hint: 'განწყობის ან საკუთარი თავის აღქმის ცვლილება' },
] as const;

export const VALUE_TIER_CONFIG: Record<ValueTier, { color: string; glow: string; gradient: string }> = {
  'ვერცხლი': { color: 'text-gray-300', glow: 'shadow-[0_0_20px_-4px_rgba(203,213,225,0.4)]', gradient: 'from-gray-400/20 to-gray-500/10' },
  'ოქრო': { color: 'text-amber-300', glow: 'shadow-[0_0_20px_-4px_rgba(251,191,36,0.4)]', gradient: 'from-amber-400/20 to-amber-600/10' },
  'ზურმუხტი': { color: 'text-teal-300', glow: 'shadow-[0_0_20px_-4px_rgba(45,212,191,0.4)]', gradient: 'from-teal-400/20 to-teal-600/10' },
  'საფირონი': { color: 'text-[#91abc7]', glow: 'shadow-none', gradient: 'from-[#91abc7]/20 to-[#91abc7]/10' },
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
  ratings: { production: number; lyrics: number; originality: number; replay: number } | { response: number; engagement: number; immersion: number; transformation: number };
  totalScore: number;
  excerpt: string;
  date: string;
  role?: string;
  authorCategory?: string;
  isVerified?: boolean;
}

export type PageId = 'releases' | 'top90' | 'achievements' | 'concerts' | 'faq';

export const categoryTabs: { id: PageId; label: string }[] = [
  { id: 'releases', label: 'რელიზები' },
  { id: 'top90', label: 'ტოპ-90' },
  { id: 'achievements', label: 'მიღწევები' },
  { id: 'concerts', label: 'კონცერტები' },
  { id: 'faq', label: 'ხშირად დასმული კითხვები' },
];

export function computeRZTScore(params: number[], vibeLevel: number): number {
  const baseSum = params[0] + params[1] + params[2] + params[3];
  const vibeCoeff = VIBE_COEFFICIENTS[vibeLevel - 1] ?? 1.0;
  return Math.min(90, Math.round(baseSum * 1.4 * vibeCoeff));
}

export function scoreToTier(score: number): ValueTier {
  return valueTierFromScore(score);
}
