import { useEffect, useState } from 'react';
import { Award, Trophy } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';

interface Definition { key: string; category: 'listener' | 'media'; scope: 'lifetime' | 'annual'; title_ka: string; description_ka: string; target: number }
interface Progress { achievement_key: string; progress: number; target: number; earned_at: string | null; scope_year: number; secondary_progress: number | null; secondary_target: number | null }
interface RecipientSummary { achievement_key: string; scope_year: number; recipient_count: number; recent_recipients: string[] }
interface AwardResult { season_year: number; award_key: string; release_format: string; release_id: string | number | null; release_title: string | null; artist_name: string | null; final_score: number | null; listener_count: number; media_count: number }
interface ReleaseName { id: string | number; title: string; artist_name: string }

const awardNames: Record<string, string> = { listeners_choice: 'მსმენელთა რჩეული', media_choice: 'მედიის რჩეული', release_of_year: 'წლის რელიზი', discovery_of_year: 'წლის აღმოჩენა' };
const formatNames: Record<string, string> = { album: 'ალბომი', ep: 'მინიალბომი', single: 'სინგლი', mixtape: 'მიქსტეიპი', other: 'რელიზი' };
const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tbilisi', year: 'numeric' }).format(new Date()));
const dateLabel = (value: string) => new Intl.DateTimeFormat('ka-GE', { timeZone: 'Asia/Tbilisi', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));

export default function Achievements() {
  const { user } = useAuth();
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [recipients, setRecipients] = useState<RecipientSummary[]>([]);
  const [awards, setAwards] = useState<AwardResult[]>([]);
  const [earnedYears, setEarnedYears] = useState<number[]>([]);
  const [releaseNames, setReleaseNames] = useState<Record<string, ReleaseName>>({});
  const [year, setYear] = useState(currentYear);
  const [error, setError] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    const load = async () => {
      const [definitionsResult, awardsResult, recipientsResult, progressResult, ownYearsResult] = await Promise.all([
        client.from('achievement_definitions').select('*').order('category').order('key'),
        client.from('annual_release_awards').select('season_year, award_key, release_format, release_id, release_title, artist_name, final_score, listener_count, media_count').order('season_year', { ascending: false }),
        client.from('achievement_recipient_summary').select('achievement_key, scope_year, recipient_count, recent_recipients').in('scope_year', [0, year]),
        user ? client.rpc('my_achievement_progress', { p_year: year }) : Promise.resolve({ data: [], error: null }),
        user ? client.from('achievement_grants').select('scope_year').eq('user_id', user.id).gt('scope_year', 0) : Promise.resolve({ data: [], error: null }),
      ]);
      if (cancelled) return;
      setError(Boolean(definitionsResult.error || awardsResult.error || recipientsResult.error || progressResult.error || ownYearsResult.error));
      setDefinitions((definitionsResult.data ?? []) as Definition[]);
      const result = (awardsResult.data ?? []) as AwardResult[];
      setAwards(result);
      setRecipients((recipientsResult.data ?? []) as RecipientSummary[]);
      setProgress((progressResult.data ?? []) as Progress[]);
      setEarnedYears([...new Set((ownYearsResult.data ?? []).map((row) => Number(row.scope_year)))]);
      const ids = [...new Set(result.map((item) => item.release_id).filter((id): id is string | number => id != null))];
      if (ids.length) {
        const { data } = await client.from('releases').select('id, title, artist_name').in('id', ids);
        if (!cancelled) setReleaseNames(Object.fromEntries(((data ?? []) as ReleaseName[]).map((row) => [String(row.id), row])));
      } else setReleaseNames({});
    };
    void load();
    return () => { cancelled = true; };
  }, [user, year]);

  const years = [...new Set([currentYear, ...earnedYears, ...awards.map((item) => item.season_year)])].sort((a, b) => b - a);
  const yearAwards = awards.filter((item) => item.season_year === year);
  const own = progress.filter((item) => item.earned_at);

  return <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
    <header><div className="flex items-center gap-2.5"><Trophy className="h-7 w-7 text-amber-300" /><h1 className="text-3xl font-bold text-white">მიღწევები</h1></div><p className="mt-2 text-sm text-gray-400">სეზონი გრძელდება 1 იანვრიდან 31 დეკემბრამდე, თბილისის დროით.</p></header>
    {error && <p role="alert" className="rounded-xl border border-rose-400/30 p-4 text-rose-300">მიღწევების მონაცემები ვერ ჩაიტვირთა.</p>}
    <div className="flex items-center gap-3"><label htmlFor="achievement-year" className="text-sm text-gray-300">სეზონი</label><select id="achievement-year" value={year} onChange={(event) => setYear(Number(event.target.value))} className="rounded-lg border border-[#33333d] bg-[#18181e] px-3 py-2 text-white">{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
    {user && <section aria-labelledby="my-achievements"><h2 id="my-achievements" className="mb-4 text-xl font-bold text-white">ჩემი მიღწევები</h2>{own.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{own.map((item) => { const definition = definitions.find((entry) => entry.key === item.achievement_key); return definition && <article key={item.achievement_key} className="rounded-xl border border-blue-400/30 bg-blue-400/5 p-4"><div className="flex items-center gap-2 text-blue-300"><Award className="h-5 w-5" /><h3 className="font-bold">{definition.title_ka}</h3></div><p className="mt-2 text-sm text-gray-400">{definition.description_ka}</p><p className="mt-2 text-xs text-gray-500">{item.scope_year || 'მუდმივი'} · {dateLabel(item.earned_at!)}</p></article>; })}</div> : <p className="text-sm text-gray-500">ამ სეზონში მიღწევა ჯერ არ გაქვთ.</p>}</section>}
    <section aria-labelledby="achievement-rules"><h2 id="achievement-rules" className="mb-4 text-xl font-bold text-white">მიღწევების წესები</h2><div className="grid gap-4 sm:grid-cols-2">{definitions.map((definition) => { const item = progress.find((entry) => entry.achievement_key === definition.key); const summary = recipients.find((entry) => entry.achievement_key === definition.key && entry.scope_year === (definition.scope === 'lifetime' ? 0 : year)); return <article key={definition.key} className="rounded-xl border border-[#25252d] bg-[#121215] p-5"><p className="text-xs font-semibold text-blue-300">{definition.category === 'media' ? 'მედია' : 'მსმენელი'} · {definition.scope === 'lifetime' ? 'მუდმივი' : `${year} წლის სეზონი`}</p><h3 className="mt-2 font-bold text-white">{definition.title_ka}</h3><p className="mt-2 text-sm text-gray-400">{definition.description_ka}</p>{item && <p className="mt-3 text-xs text-blue-300">ჩემი პროგრესი: {Math.min(item.progress, item.target)}/{item.target}{item.secondary_target != null && ` · არტისტები: ${Math.min(item.secondary_progress ?? 0, item.secondary_target)}/${item.secondary_target}`}</p>}<p className="mt-2 text-xs text-gray-500">მფლობელები: {summary?.recipient_count ?? 0}{summary?.recent_recipients?.length ? ` · ${summary.recent_recipients.join(', ')}` : ''}</p></article>; })}</div></section>
    <section aria-labelledby="annual-awards"><h2 id="annual-awards" className="mb-4 text-xl font-bold text-white">წლიური ჯილდოები</h2>{yearAwards.length ? <div className="grid gap-4 sm:grid-cols-2">{yearAwards.map((award) => { const release = award.release_id == null ? null : releaseNames[award.release_id]; return <article key={`${award.award_key}-${award.release_format}`} className="rounded-xl border border-amber-400/20 bg-[#121215] p-5"><h3 className="font-bold text-white">{awardNames[award.award_key] ?? 'ჯილდო'} · {formatNames[award.release_format] ?? 'რელიზი'}</h3>{award.release_title ? <><p className="mt-2 text-amber-300">{release?.title ?? award.release_title} · {release?.artist_name ?? award.artist_name}</p><p className="mt-2 text-xs text-gray-500">ქულა: {Number(award.final_score).toFixed(1)} · მსმენელები: {award.listener_count} · მედია: {award.media_count}</p></> : <p className="mt-2 text-sm text-gray-500">გამარჯვებული არ გამოვლენილა: საკმარისი შეფასებები არ არის.</p>}</article>; })}</div> : <p className="text-sm text-gray-500">ამ სეზონის შედეგები ჯერ არ არის განსაზღვრული.</p>}</section>
  </main>;
}
