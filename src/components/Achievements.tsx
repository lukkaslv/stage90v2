import { useEffect, useState } from 'react';
import { BadgeCheck, Crown, Leaf, Shield, Snowflake, Star, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AchievementRow { title: string; description: string; recipient: string; }
interface BadgeDefinition { id: string; title: string; icon: typeof Trophy; color: string; }
const seasonalBadges: BadgeDefinition[] = [
  { id: 'featured-autumn-26', title: 'გამორჩეული წევრი შემოდგომა 26', icon: Trophy, color: 'text-amber-300' },
  { id: 'top-1-autumn-26', title: 'ტოპ-1 შემოდგომა 26', icon: Star, color: 'text-amber-300' },
  { id: 'top-90-autumn-26', title: 'ტოპ-90 შემოდგომა 26', icon: Shield, color: 'text-amber-300' },
  { id: 'spring-26', title: 'გაზაფხული 26', icon: Leaf, color: 'text-emerald-300' },
  { id: 'winter-25-26', title: 'ზამთარი 25/26', icon: Snowflake, color: 'text-cyan-300' },
  { id: 'five-years', title: '5 წელი', icon: BadgeCheck, color: 'text-violet-300' },
  { id: 'rzt-100', title: '#RZT100', icon: Crown, color: 'text-rose-300' },
];

export default function Achievements() {
  const [rows, setRows] = useState<AchievementRow[]>([]);
  useEffect(() => { const client = supabase; if (!client) return; const load = async () => { const { data } = await client.from('achievements').select('*').order('created_at', { ascending: false }); setRows((data ?? []).map((row) => { const item = row as Record<string, unknown>; const profile = (item.profiles ?? item.profile) as Record<string, unknown> | undefined; return { title: String(item.title ?? item.name ?? ''), description: String(item.description ?? item.details ?? ''), recipient: String(item.display_name ?? item.username ?? profile?.display_name ?? item.artist_name ?? '') }; })); }; void load(); }, []);
  const matchingRow = (title: string) => rows.find((row) => row.title.trim().toLowerCase() === title.trim().toLowerCase());
  return <div className="mx-auto max-w-7xl animate-fade-in px-4 py-8 sm:px-6 lg:px-8"><div className="mb-8"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-400/10"><Trophy className="h-5 w-5 text-amber-400" /></span><h1 className="text-2xl font-bold text-white sm:text-3xl">მიღწევები</h1></div><p className="mt-2 text-sm text-gray-400">სეზონური ნიშნები და სპეციალური აღიარებები RZT-ის საზოგადოებისთვის.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{seasonalBadges.map((badge) => { const Icon = badge.icon; const row = matchingRow(badge.title); return <article key={badge.id} className="min-w-0 rounded-xl border border-[#1e1e24] bg-[#121215] p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5"><Icon className={`h-6 w-6 ${badge.color}`} /></span><div className="min-w-0"><h2 className="break-words text-sm font-bold text-white">{badge.title}</h2>{row?.recipient && <p className="mt-1 truncate text-xs text-cyan-300">{row.recipient}</p>}</div></div>{row?.description && <p className="mt-4 break-words text-sm leading-relaxed text-gray-400">{row.description}</p>}</article>; })}</div></div>;
}
