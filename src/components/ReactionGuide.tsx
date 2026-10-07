import { useEffect, useState } from 'react';
import { BookmarkPlus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import type { ReactionView } from '@/lib/reactionStudio';

type Cue = 'story' | 'feeling' | 'contrast' | 'change' | 'response';
type Moment = {
  id: string;
  cue: Cue;
  note: string;
  position_seconds: number | null;
  created_at: string;
};

const prompts: { id: Cue; label: string; question: string }[] = [
  { id: 'story', label: 'ისტორია', question: 'ვინ საუბრობს სიმღერაში და ვის მიმართავს?' },
  { id: 'feeling', label: 'გრძნობა', question: 'რა ემოციას გამოხატავს ტექსტი და რას გრძნობთ მოსმენისას?' },
  { id: 'contrast', label: 'წინააღმდეგობა', question: 'სად განსხვავდება ტექსტის, ხმისა და მუსიკის განწყობა?' },
  { id: 'change', label: 'ცვლილება', question: 'როგორ იცვლება შთაბეჭდილება ტრეკის განმავლობაში?' },
  { id: 'response', label: 'პირადი გამოძახილი', question: 'რომელმა მომენტმა შეგაჩერათ და რატომ?' },
];

function formatPosition(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function ReactionGuide({ view }: { view: ReactionView }) {
  const { user } = useAuth();
  const [cue, setCue] = useState<Cue>('story');
  const [note, setNote] = useState('');
  const [timecode, setTimecode] = useState('');
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const trackId = view.track_id;
  const needsTrack = view.tracks.length > 0 && !trackId;

  useEffect(() => {
    const client = supabase;
    if (!client || !user?.id) { setLoading(false); return; }
    let cancelled = false;
    setMoments([]);
    setLoading(true);
    setMessage('');
    let query = client.from('reaction_private_moments')
      .select('id,cue,note,position_seconds,created_at')
      .eq('session_id', view.id)
      .eq('release_id', String(view.release.id))
      .order('created_at', { ascending: true });
    query = trackId ? query.eq('track_id', trackId) : query.is('track_id', null);
    void query.then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      if (error) { setMessage('მონიშნული მომენტები ვერ ჩაიტვირთა. შეამოწმეთ მონაცემთა ბაზის განახლება.'); return; }
      setMoments((data ?? []) as Moment[]);
    });
    return () => { cancelled = true; };
  }, [view.id, view.release.id, trackId, user?.id]);

  const markMoment = async () => {
    if (!supabase || !user || busy || loading || needsTrack) return;
    const rawTime = timecode.trim();
    const match = rawTime.match(/^(\d{1,3}):([0-5]\d)$/);
    const position = match ? Number(match[1]) * 60 + Number(match[2]) : null;
    if (rawTime && (position === null || position > 35999)) {
      setMessage('ვიდეოს დრო შეიყვანეთ ფორმატით წუთი:წამი, მაგალითად 1:24.');
      return;
    }
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase.from('reaction_private_moments').insert({
      session_id: view.id,
      admin_id: user.id,
      release_id: String(view.release.id),
      track_id: trackId,
      cue,
      note: note.trim(),
      position_seconds: position,
    }).select('id,cue,note,position_seconds,created_at').single();
    setBusy(false);
    if (error || !data) { setMessage('მომენტის შენახვა ვერ მოხერხდა.'); return; }
    setMoments((current) => [...current, data as Moment]);
    setNote('');
    setTimecode('');
    setMessage('მომენტი შენახულია. ჩანაწერი მხოლოდ სტუდიაში ჩანს.');
  };

  const deleteMoment = async (id: string) => {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase.from('reaction_private_moments').delete().eq('id', id);
    setBusy(false);
    if (error) { setMessage('მომენტის წაშლა ვერ მოხერხდა.'); return; }
    setMoments((current) => current.filter((moment) => moment.id !== id));
  };

  const currentTitle = view.tracks.find((track) => String(track.id) === trackId)?.title ?? view.release.title;

  return <section className="border border-blue-400/30 bg-[#12151d] p-4" aria-labelledby="reaction-guide-title">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 id="reaction-guide-title" className="font-bold text-white">ფსიქოლოგის პირადი გზამკვლევი</h3><p className="mt-1 text-xs text-gray-400">კითხვები და ჩანაწერები OBS-ის ეკრანზე არ გამოჩნდება.</p></div>
      <span className="border border-blue-400/30 bg-blue-400/10 px-2 py-1 text-xs font-semibold text-blue-200">მხოლოდ თქვენთვის</span>
    </div>
    <p className="mt-4 text-sm font-semibold text-white">{currentTitle}</p>
    {needsTrack && <p className="mt-2 text-xs text-amber-300">მომენტის მონიშვნამდე აირჩიეთ მიმდინარე ტრეკი.</p>}
    <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="სასაუბრო კითხვა">
      {prompts.map((prompt) => <button key={prompt.id} type="button" onClick={() => setCue(prompt.id)} aria-pressed={cue === prompt.id} className={`min-h-20 border p-3 text-left transition-colors ${cue === prompt.id ? 'border-pink-400 bg-pink-400/10 text-white' : 'border-[#343844] bg-[#191d27] text-gray-300 hover:border-blue-400/50'}`}><strong className="block text-xs text-pink-300">{prompt.label}</strong><span className="mt-1 block text-sm leading-snug">{prompt.question}</span></button>)}
    </div>
    <p className="mt-3 text-xs text-gray-400">განიხილეთ სიმღერის ამბავი და თქვენი აღქმა; სიმღერის მიხედვით არტისტის პიროვნებაზე დასკვნას ნუ გამოიტანთ.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
      <label className="text-xs font-semibold text-gray-300">თქვენი მოკლე ჩანაწერი (არასავალდებულო)<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="რა შეგაჩერათ ამ მომენტში?" className="mt-1.5 w-full border border-gray-600 bg-[#0b0d16] px-3 py-2.5 text-sm text-white" /></label>
      <label className="text-xs font-semibold text-gray-300">დრო ვიდეოში<input value={timecode} onChange={(event) => setTimecode(event.target.value)} inputMode="numeric" placeholder="1:24" aria-label="დრო ვიდეოში, წუთი და წამი" className="mt-1.5 w-full border border-gray-600 bg-[#0b0d16] px-3 py-2.5 text-sm text-white" /></label>
    </div>
    <p className="mt-1 text-xs text-gray-500">დრო შეგიძლიათ მიუთითოთ ხელით; ვიდეოდან ის ავტომატურად არ იკითხება.</p>
    <button type="button" onClick={() => void markMoment()} disabled={busy || loading || needsTrack} className="mt-3 inline-flex min-h-11 items-center gap-2 bg-blue-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><BookmarkPlus className="h-4 w-4" />მომენტის მონიშვნა</button>
    <div className="mt-5 border-t border-[#343844] pt-4"><h4 className="text-sm font-bold text-white">მონიშნული მომენტები</h4>
      {loading ? <p className="mt-2 text-xs text-gray-400">იტვირთება...</p> : moments.length === 0 ? <p className="mt-2 text-xs text-gray-400">ამ ტრეკზე მომენტი ჯერ არ მოგინიშნავთ.</p> : <ol className="mt-3 space-y-2">{moments.map((moment) => <li key={moment.id} className="flex items-start justify-between gap-3 border border-[#343844] bg-[#191d27] p-3"><div className="min-w-0"><span className="text-xs font-bold text-pink-300">{prompts.find((prompt) => prompt.id === moment.cue)?.label ?? 'მომენტი'}{moment.position_seconds !== null ? ` · ${formatPosition(moment.position_seconds)}` : ''}</span><p className="mt-1 break-words text-sm text-gray-200">{moment.note || prompts.find((prompt) => prompt.id === moment.cue)?.question}</p></div><button type="button" onClick={() => void deleteMoment(moment.id)} disabled={busy} aria-label="მომენტის წაშლა" className="shrink-0 p-1 text-gray-400 hover:text-rose-300 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></li>)}</ol>}
    </div>
    {message && <p role="status" className="mt-3 text-xs text-amber-300">{message}</p>}
  </section>;
}
