import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';

type ReleaseRow = Record<string, unknown>;
interface AlbumCreateFormProps {
  releases: ReleaseRow[];
  onCreated: () => void;
}

const inputClass = 'mt-1 w-full rounded-lg border border-[#2a2a32] bg-[#0b0b0e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60';
const isBundle = (value: unknown) => ['ალბომი', 'album', 'ep'].includes(String(value ?? '').trim().toLowerCase());

export default function AlbumCreateForm({ releases, onCreated }: AlbumCreateFormProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [season, setSeason] = useState('');
  const [format, setFormat] = useState('ალბომი');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const tracks = releases.filter((release) => release.id != null && release.parent_id == null && !isBundle(release.release_type ?? release.type));
  const availableIds = new Set(tracks.map((track) => String(track.id)));
  const orderedTracks = [
    ...selectedIds.map((id) => tracks.find((track) => String(track.id) === id)).filter((track): track is ReleaseRow => Boolean(track)),
    ...tracks.filter((track) => !selectedIds.includes(String(track.id))),
  ];

  const toggleTrack = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setMessage(null);
  };
  const moveTrack = (id: string, direction: -1 | 1) => setSelectedIds((current) => {
    const index = current.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = supabase;
    if (!client || !user || saving) return;
    if (selectedIds.length < 2 || selectedIds.some((id) => !availableIds.has(id))) {
      setMessage({ text: 'აირჩიეთ მინიმუმ ორი დამოუკიდებელი ტრეკი.', error: true });
      return;
    }
    setSaving(true);
    setMessage(null);
    let albumId: string | number | null = null;
    const attachedIds: string[] = [];
    try {
      const { data: album, error: createError } = await client.from('releases').insert({
        title: title.trim(), artist_name: artist.trim(), cover_url: coverUrl.trim(),
        release_type: format, season: season.trim(), value_tier: 'ვერცხლი',
        is_active: true, submitted_by: user.id,
      }).select('id').single();
      if (createError || !album) throw new Error(createError?.message ?? 'ალბომი ვერ შეიქმნა.');
      albumId = album.id as string | number;

      for (const [index, id] of selectedIds.entries()) {
        const { data, error } = await client.from('releases')
          .update({ parent_id: String(albumId), track_number: index + 1 })
          .eq('id', id).is('parent_id', null)
          .select('id').maybeSingle();
        if (error || !data) throw new Error(error?.message ?? 'ერთ-ერთი ტრეკის ალბომთან დაკავშირება ვერ მოხერხდა.');
        attachedIds.push(id);
      }

      setTitle(''); setArtist(''); setCoverUrl(''); setSeason(''); setSelectedIds([]);
      setMessage({ text: 'ალბომი შეიქმნა და ტრეკები დაემატა.', error: false });
      onCreated();
    } catch (error) {
      const rollback = await Promise.all([
        ...attachedIds.map((id) => client.from('releases').update({ parent_id: null, track_number: null }).eq('id', id).eq('parent_id', String(albumId)).select('id')),
        ...(albumId === null ? [] : [client.from('releases').delete().eq('id', albumId).select('id')]),
      ]);
      const rollbackFailed = rollback.some((result) => result.error || !result.data?.length);
      setMessage({ text: `${error instanceof Error ? error.message : 'ალბომის შექმნა ვერ მოხერხდა.'}${rollbackFailed ? ' ცვლილებები სრულად ვერ გაუქმდა; შეამოწმეთ რელიზების სია.' : ''}`, error: true });
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return <form onSubmit={(event) => void submit(event)} className="rounded-xl border border-cyan-400/25 bg-[#121215] p-5">
    <h2 className="text-lg font-bold text-white">რელიზების ალბომად გაერთიანება</h2>
    <p className="mt-1 text-sm text-gray-400">აირჩიეთ არსებული ტრეკები, მიუთითეთ ალბომის სახელი და გარეკანი.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-gray-400">ალბომის სათაური *<input required value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} /></label>
      <label className="text-xs text-gray-400">არტისტი *<input required value={artist} onChange={(event) => setArtist(event.target.value)} className={inputClass} /></label>
      <label className="text-xs text-gray-400 sm:col-span-2">გარეკანის ბმული *<input required type="url" value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} className={inputClass} /></label>
      <label className="text-xs text-gray-400">ფორმატი<select value={format} onChange={(event) => setFormat(event.target.value)} className={inputClass}><option>ალბომი</option><option>EP</option></select></label>
      <label className="text-xs text-gray-400">სეზონი *<input required value={season} onChange={(event) => setSeason(event.target.value)} className={inputClass} /></label>
    </div>
    {coverUrl.trim() && <img src={coverUrl.trim()} alt="ალბომის გარეკანი" className="mt-4 h-32 w-32 rounded-lg border border-white/10 object-cover" />}
    <h3 className="mt-5 text-sm font-bold text-cyan-200">ტრეკები და მათი რიგი</h3>
    <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
      {tracks.length === 0 && <p className="text-sm text-gray-500">დამოუკიდებელი ტრეკები ვერ მოიძებნა.</p>}
      {orderedTracks.map((track) => {
        const id = String(track.id);
        const position = selectedIds.indexOf(id);
        return <div key={id} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"><input type="checkbox" checked={position >= 0} onChange={() => toggleTrack(id)} className="accent-cyan-400" />{typeof track.cover_url === 'string' && <img src={track.cover_url} alt="" className="h-9 w-9 rounded object-cover" />}<span className="min-w-0 truncate text-sm text-gray-200">{String(track.title ?? '')}<span className="ml-2 text-xs text-gray-500">{String(track.artist_name ?? '')}</span></span></label>
          {position >= 0 && <><span className="text-xs font-bold text-cyan-300">#{position + 1}</span><button type="button" disabled={position === 0} onClick={() => moveTrack(id, -1)} aria-label="ტრეკის ზემოთ გადატანა" className="text-cyan-300 disabled:opacity-30">▲</button><button type="button" disabled={position === selectedIds.length - 1} onClick={() => moveTrack(id, 1)} aria-label="ტრეკის ქვემოთ გადატანა" className="text-cyan-300 disabled:opacity-30">▼</button></>}
        </div>;
      })}
    </div>
    {message && <p role={message.error ? 'alert' : 'status'} className={`mt-3 text-sm ${message.error ? 'text-rose-300' : 'text-emerald-300'}`}>{message.text}</p>}
    <button type="submit" disabled={saving || tracks.length < 2} className="mt-4 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">{saving ? 'იქმნება…' : 'ალბომის შექმნა'}</button>
  </form>;
}
