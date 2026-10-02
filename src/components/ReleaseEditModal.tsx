import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ReleaseRow = Record<string, unknown> & { id: string | number };
interface ProfileRow { id: string; display_name: string | null; email: string | null; role: string; }
interface TrackRow { id: string | number; title: string; artist_name: string | null; cover_url: string | null; release_type?: string; parent_id?: string | null; track_number?: number | null; }
interface AlbumRow { id: string | number; title: string; release_type: string; }
interface ReleaseEditModalProps { release: Record<string, unknown>; onClose: () => void; onSaved: (release: ReleaseRow) => void; onRefresh?: () => void; }
const inputClass = 'mt-1 w-full rounded-lg border border-[#2a2a32] bg-[#0b0b0e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60';
const textValue = (item: Record<string, unknown>, key: string, fallback = '') => String(item[key] ?? fallback);
const isBundleType = (format: string) => ['ალბომი', 'ep', 'album'].includes(format.trim().toLowerCase());

export default function ReleaseEditModal({ release, onClose, onSaved, onRefresh }: ReleaseEditModalProps) {
  const [title, setTitle] = useState(textValue(release, 'title'));
  const [artist, setArtist] = useState(textValue(release, 'artist_name', textValue(release, 'artist')));
  const [coverUrl, setCoverUrl] = useState(textValue(release, 'cover_url', textValue(release, 'coverUrl')));
  const [format, setFormat] = useState(textValue(release, 'release_type', textValue(release, 'type', 'სინგლი')));
  const [season, setSeason] = useState(textValue(release, 'season'));
  const [valueTier, setValueTier] = useState(textValue(release, 'value_tier', textValue(release, 'valueTier', 'ვერცხლი')));
  const [youtubeUrl, setYoutubeUrl] = useState(textValue(release, 'youtube_url'));
  const [authorId, setAuthorId] = useState(textValue(release, 'author_profile_id'));
  const [parentId, setParentId] = useState(textValue(release, 'parent_id'));
  const [trackNumber, setTrackNumber] = useState(String(release.track_number ?? 1));
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const isBundle = isBundleType(format);
  const editingBundle = isBundleType(textValue(release, 'release_type', textValue(release, 'type')));
  const releaseId = String(release.id ?? '');

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    const loadOptions = async () => {
      const [{ data: profileRows }, { data: albumRows }, { data: standaloneRows }, { data: existingChildRows }] = await Promise.all([
        client.from('profiles').select('id, display_name, email, role').order('display_name', { ascending: true }),
        client.from('releases').select('id, title, release_type').in('release_type', ['ალბომი', 'EP', 'album']).neq('id', releaseId),
        client.from('releases').select('id, title, artist_name, cover_url, release_type, parent_id, track_number').is('parent_id', null).eq('is_active', true).neq('id', releaseId),
        client.from('releases').select('id, title, artist_name, cover_url, parent_id, track_number').eq('parent_id', releaseId).order('track_number', { ascending: true }),
      ]);
      if (cancelled) return;
      setProfiles((profileRows ?? []) as ProfileRow[]);
      setAlbums((albumRows ?? []) as AlbumRow[]);
      const currentChildren = (existingChildRows ?? []) as TrackRow[];
      const standalone = ((standaloneRows ?? []) as TrackRow[]).filter((row) => !isBundleType(row.release_type ?? ''));
      const merged = [...currentChildren, ...standalone].filter((row, index, rows) => rows.findIndex((candidate) => String(candidate.id) === String(row.id)) === index);
      setTracks(merged);
      setSelectedTrackIds(currentChildren.sort((a, b) => Number(a.track_number ?? 0) - Number(b.track_number ?? 0)).map((track) => String(track.id)));
    };
    void loadOptions();
    return () => { cancelled = true; };
  }, [releaseId]);

  const toggleTrack = (id: string) => setSelectedTrackIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const moveTrack = (id: string, direction: -1 | 1) => setSelectedTrackIds((current) => {
    const index = current.indexOf(id); const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return current;
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    setSaving(true); setErrorMessage(''); setSuccessMessage('');
    const parentValue = isBundle ? null : parentId || null;
    const { data, error } = await client.from('releases').update({
      title: title.trim(), artist_name: artist.trim(), cover_url: coverUrl.trim(), release_type: format,
      season: season.trim(), value_tier: valueTier, youtube_url: youtubeUrl.trim() || null,
      author_profile_id: authorId || null, parent_id: parentValue,
      track_number: parentValue ? Math.max(1, Number(trackNumber) || 1) : null,
    }).eq('id', releaseId).select('*').single();
    if (error || !data) { setErrorMessage(`განახლება ვერ მოხერხდა: ${error?.message ?? 'რელიზი ვერ მოიძებნა.'}`); setSaving(false); return; }

    if (editingBundle || isBundle) {
      const desired = isBundle ? selectedTrackIds : [];
      const selected = new Set(desired);
      const oldChildren = tracks.filter((track) => String(track.parent_id ?? '') === releaseId);
      const changes = [
        ...oldChildren.filter((track) => !selected.has(String(track.id))).map((track) => ({ id: String(track.id), parentId: null, trackNumber: null })),
        ...desired.map((id, index) => ({ id, parentId: String(data.id), trackNumber: index + 1 })),
      ];
      for (const change of changes) {
        const { data: updated, error: childError } = await client.from('releases')
          .update({ parent_id: change.parentId, track_number: change.trackNumber })
          .eq('id', change.id).select('id').maybeSingle();
        if (childError || !updated) {
          setErrorMessage(`ტრეკების სიის განახლება ვერ მოხერხდა: ${childError?.message ?? 'ტრეკი ვერ განახლდა.'}`);
          setSaving(false);
          onRefresh?.();
          return;
        }
      }
    }

    setSuccessMessage('რელიზის მონაცემები წარმატებით განახლდა!');
    onSaved(data as ReleaseRow);
    onRefresh?.();
    setSaving(false);
    window.setTimeout(onClose, 1300);
  };

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="release-edit-title">
    {successMessage && <div role="status" className="fixed right-4 top-4 z-[100] rounded-xl border border-emerald-400/30 bg-[#101a14] px-5 py-3 text-sm font-semibold text-emerald-200 shadow-2xl">{successMessage}</div>}
    <form onSubmit={(event) => void submit(event)} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-cyan-400/25 bg-[#121215] p-5 shadow-2xl sm:p-7">
      <div className="mb-5 flex items-center justify-between"><h2 id="release-edit-title" className="text-xl font-extrabold text-white">რელიზის რედაქტირება</h2><button type="button" onClick={onClose} aria-label="დახურვა" className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-gray-400">სათაური<input required value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} /></label>
        <label className="text-xs text-gray-400">არტისტი<input required value={artist} onChange={(event) => setArtist(event.target.value)} className={inputClass} /></label>
        <label className="text-xs text-gray-400 sm:col-span-2">გარეკანის ბმული<input required type="url" value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} className={inputClass} /></label>
        <label className="text-xs text-gray-400">ფორმატი<select value={format} onChange={(event) => setFormat(event.target.value)} className={inputClass}><option>სინგლი</option><option>ალბომი</option><option>EP</option></select></label>
        <label className="text-xs text-gray-400">სეზონი<input value={season} onChange={(event) => setSeason(event.target.value)} className={inputClass} /></label>
        <label className="text-xs text-gray-400">ღირებულების გრეიდი<select value={valueTier} onChange={(event) => setValueTier(event.target.value)} className={inputClass}><option>ვერცხლი</option><option>ოქრო</option><option>ზურმუხტი</option><option>საფირონი</option><option>ლალი</option></select></label>
        <label className="text-xs text-gray-400">YouTube ბმული<input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} className={inputClass} /></label>
        <label className="text-xs text-gray-400 sm:col-span-2">ავტორის ანგარიში (პროფილი)<select value={authorId} onChange={(event) => { setAuthorId(event.target.value); const profile = profiles.find((item) => item.id === event.target.value); if (profile?.display_name) setArtist(profile.display_name); }} className={inputClass}><option value="">— აირჩიეთ რეგისტრირებული პროფილი (არასავალდებულო) —</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name || 'რეგისტრირებული პროფილი'}{profile.email ? ` · ${profile.email}` : ''}</option>)}</select></label>
      </div>
      {!isBundle && <div className="mt-5 grid gap-4 rounded-xl border border-white/10 bg-[#0b0b0e] p-4 sm:grid-cols-2"><label className="text-xs text-gray-400">ალბომთან მიბმა<select value={parentId} onChange={(event) => setParentId(event.target.value)} className={inputClass}><option value="">მიაკუთვნეთ ალბომს (არასავალდებულო)</option>{albums.map((album) => <option key={album.id} value={album.id}>{album.title} · {album.release_type}</option>)}</select></label><label className="text-xs text-gray-400">ტრეკის ნომერი ალბომში<input type="number" min={1} value={trackNumber} onChange={(event) => setTrackNumber(event.target.value)} className={inputClass} /></label></div>}
      {isBundle && <section className="mt-5 rounded-xl border border-cyan-400/25 bg-[#0b0b0e] p-4 shadow-[0_0_28px_rgba(0,242,254,0.08)]"><h3 className="text-sm font-bold text-cyan-200">ალბომში ტრეკების გაერთიანება</h3><p className="mt-1 text-xs text-gray-500">მონიშნეთ ტრეკები და შეცვალეთ მათი რიგი.</p><div className="mt-3 space-y-2">{tracks.map((track) => { const id = String(track.id); const position = selectedTrackIds.indexOf(id); return <div key={id} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2"><label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"><input type="checkbox" checked={position >= 0} onChange={() => toggleTrack(id)} className="accent-cyan-400" />{track.cover_url && <img src={track.cover_url} alt="" className="h-9 w-9 rounded object-cover" />}<span className="truncate text-sm text-gray-300">{track.title}<span className="ml-2 text-xs text-gray-500">{track.artist_name}</span></span></label>{position >= 0 && <><span className="text-xs font-bold text-cyan-300">#{position + 1}</span><button type="button" disabled={position === 0} onClick={() => moveTrack(id, -1)} aria-label="ტრეკის ზემოთ გადატანა" className="text-cyan-300 disabled:opacity-30">▲</button><button type="button" disabled={position === selectedTrackIds.length - 1} onClick={() => moveTrack(id, 1)} aria-label="ტრეკის ქვემოთ გადატანა" className="text-cyan-300 disabled:opacity-30">▼</button></>}</div>; })}{tracks.length === 0 && <p className="text-xs text-gray-500">ტრეკები ვერ მოიძებნა.</p>}</div></section>}
      {errorMessage && <p role="alert" className="mt-4 text-sm text-rose-300">{errorMessage}</p>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5">გაუქმება</button><button type="submit" disabled={saving} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-[#0a0a0c] disabled:opacity-50">{saving ? 'ინახება…' : 'შენახვა'}</button></div>
    </form>
  </div>;
}
