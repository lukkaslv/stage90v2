import { FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ClipboardPaste, ImageOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import ReleaseRelationshipFields, { type AuthorOption, type TrackOption } from '@/components/ReleaseRelationshipFields';

export type ReleaseCreated = { id: string | number; title: string; is_active: boolean; is_freshman: boolean; is_new_name: boolean };
interface ReleaseCreateFormProps { onCreated?: (release: ReleaseCreated) => void; onRefresh?: () => void; compact?: boolean; singleOnly?: boolean; }
const fieldClass = 'w-full rounded-lg border border-[#2a2a32] bg-[#0b0b0e] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/60';

function extractYouTubeVideoId(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] ?? null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' || parts[0] === 'embed') return parts[1] ?? null;
    }
  } catch { return null; }
  return null;
}

function cleanVideoTitle(rawTitle: string): { artist: string; title: string } {
  const cleaned = rawTitle.replace(/\s*[([{]\s*(official\s+(video|audio)|clip|music\s+video|4k)\s*[)\]}]/gi, '').replace(/\s+/g, ' ').trim();
  const separator = cleaned.search(/\s[-—]\s/);
  if (separator >= 0) return { artist: cleaned.slice(0, separator).trim(), title: cleaned.slice(separator + 3).trim() };
  return { artist: '', title: cleaned };
}

export default function ReleaseCreateForm({ onCreated, onRefresh, compact = false, singleOnly = false }: ReleaseCreateFormProps) {
  const { user, refreshProfile } = useAuth();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [releaseType, setReleaseType] = useState('სინგლი');
  const [season, setSeason] = useState('შემოდგომა 26');
  const [valueTier, setValueTier] = useState('ვერცხლი');
  const [isFreshman, setIsFreshman] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [authors, setAuthors] = useState<AuthorOption[]>([]);
  const [authorProfileId, setAuthorProfileId] = useState('');
  const [standaloneTracks, setStandaloneTracks] = useState<TrackOption[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const requestId = useRef(0);
  const isBundle = releaseType === 'ალბომი' || releaseType === 'EP' || releaseType.toLowerCase() === 'album';

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    const loadRelationships = async () => {
      const [{ data: authorRows }, { data: trackRows }] = await Promise.all([
        client.from('profiles').select('id, display_name, email, role').order('display_name', { ascending: true }),
        client.from('releases').select('id, title, artist_name, cover_url').is('parent_id', null).eq('is_active', true),
      ]);
      if (cancelled) return;
      setAuthors((authorRows ?? []) as AuthorOption[]);
      setStandaloneTracks((trackRows ?? []) as TrackOption[]);
    };
    void loadRelationships();
    return () => { cancelled = true; };
  }, []);

  const handleAuthorChange = (id: string) => {
    setAuthorProfileId(id);
    const author = authors.find((item) => item.id === id);
    if (author?.display_name) setArtist(author.display_name);
  };

  const toggleTrack = (id: string) => setSelectedTrackIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const moveTrack = (id: string, direction: -1 | 1) => setSelectedTrackIds((current) => {
    const index = current.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return current;
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });

  const resolveYouTube = async (rawValue: string) => {
    setYoutubeUrl(rawValue);
    const id = extractYouTubeVideoId(rawValue);
    setYoutubeId(id);
    if (!id) return;
    const currentRequest = ++requestId.current;
    setResolving(true); setPreviewLoading(true); setMessage(null);
    setCoverUrl(`https://img.youtube.com/vi/${id}/maxresdefault.jpg`);
    setReleaseType('სინგლი');
    try {
      const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
      if (!response.ok) throw new Error('ვიდეოს მონაცემები ვერ მოიძებნა');
      const metadata = await response.json() as { title?: string };
      if (currentRequest !== requestId.current) return;
      const parsed = cleanVideoTitle(metadata.title ?? '');
      if (parsed.title) setTitle(parsed.title);
      if (parsed.artist) setArtist(parsed.artist);
    } catch (error) {
      if (currentRequest === requestId.current) setMessage({ text: error instanceof Error ? error.message : 'YouTube-ის მონაცემები ვერ ჩაიტვირთა.', error: true });
    } finally {
      if (currentRequest === requestId.current) setResolving(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client || !user) return;
    if (user.role === 'media' && user.mediaMonthlyReleases >= 5) { setMessage({ text: 'ამ თვეში რელიზების ლიმიტი ამოწურულია.', error: true }); return; }
    setSaving(true); setMessage(null);
    const { data, error } = await client.from('releases').insert({ title: title.trim(), artist_name: artist.trim(), cover_url: coverUrl.trim(), youtube_url: youtubeUrl.trim() || null, release_type: releaseType, season: season.trim(), value_tier: valueTier, is_new_name: isFreshman, is_freshman: isFreshman, is_active: isActive, submitted_by: user.id, author_profile_id: authorProfileId || null }).select('id, title, is_active, is_freshman, is_new_name').single();
    if (error) { setMessage({ text: `რელიზის დამატება ვერ მოხერხდა: ${error.message}`, error: true }); setSaving(false); return; }
    if (isBundle && data && selectedTrackIds.length > 0) {
      const updates = await Promise.all(selectedTrackIds.map((trackId, index) => client.from('releases').update({ parent_id: data.id, track_number: index + 1 }).eq('id', trackId)));
      const trackError = updates.find((result) => result.error)?.error;
      if (trackError) { setMessage({ text: `ტრეკების გაერთიანება ვერ შესრულდა: ${trackError.message}`, error: true }); setSaving(false); return; }
    }
    if (user.role === 'media') { const { error: quotaError } = await client.from('profiles').update({ media_monthly_releases: user.mediaMonthlyReleases + 1 }).eq('id', user.id); if (quotaError) setMessage({ text: `რელიზი დაემატა, თუმცა ლიმიტის განახლება ვერ მოხერხდა: ${quotaError.message}`, error: true }); await refreshProfile(); }
    setTitle(''); setArtist(''); setCoverUrl(''); setYoutubeUrl(''); setYoutubeId(null); setAuthorProfileId(''); setSelectedTrackIds([]);
    setMessage({ text: isBundle && selectedTrackIds.length > 0 ? 'ალბომი და ტრეკების სია წარმატებით შეიქმნა!' : 'რელიზი წარმატებით დაემატა!' }); setSaving(false); if (data) { onCreated?.(data as ReleaseCreated); onRefresh?.(); }
  };

  const previewUrl = coverUrl || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : '');
  return <form onSubmit={(event) => void submit(event)} className={`rounded-xl border border-[#25252d] bg-[#121215] ${compact ? 'p-4' : 'p-5'}`}>
    <div className="grid gap-3 sm:grid-cols-2">
      <ReleaseRelationshipFields authors={authors} authorProfileId={authorProfileId} onAuthorChange={handleAuthorChange} isBundle={false} tracks={[]} selectedTrackIds={[]} onToggleTrack={() => undefined} onMoveTrack={() => undefined} />
      {!singleOnly && <ReleaseRelationshipFields authors={[]} authorProfileId="" onAuthorChange={() => undefined} isBundle={isBundle} tracks={standaloneTracks} selectedTrackIds={selectedTrackIds} onToggleTrack={toggleTrack} onMoveTrack={moveTrack} showAuthor={false} />}
    </div>
    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-white">რელიზის დამატება</h2><p className="mt-1 text-xs text-gray-500">შეავსე ყველა აუცილებელი ველი</p></div>{message && !message.error && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}</div>
    <label className="mb-4 block text-xs font-semibold text-cyan-200">YouTube ბმული (ავტომატური შევსება)<span className="relative mt-1 block"><ClipboardPaste className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400" /><input value={youtubeUrl} onChange={(event) => void resolveYouTube(event.target.value)} placeholder="https://www.youtube.com/watch?v=... ან https://youtu.be/..." className={`${fieldClass} pl-9 pr-10`} />{resolving && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-cyan-400" />}</span></label>
    {previewUrl && <div className="mb-4 overflow-hidden rounded-xl border border-cyan-400/20 bg-[#0b0b0e]"><div className="relative aspect-video w-full bg-gradient-to-br from-cyan-400/10 to-violet-500/10">{previewLoading && <div className="absolute inset-0 animate-pulse bg-white/5" />}{previewUrl ? <img src={previewUrl} alt={title || 'რელიზის გარეკანი'} onLoad={() => setPreviewLoading(false)} onError={(event) => { if (youtubeId && event.currentTarget.src.includes('maxresdefault')) { event.currentTarget.src = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`; } else { setPreviewLoading(false); event.currentTarget.style.display = 'none'; } }} className="h-full w-full object-cover" /> : <ImageOff className="absolute inset-0 m-auto h-8 w-8 text-gray-600" />}</div><div className="p-3"><p className="truncate text-sm font-bold text-white">{title || 'სათაური ჩაიტვირთება'}</p><p className="mt-1 truncate text-xs text-gray-400">{artist || 'არტისტი ჩაიტვირთება'}</p></div></div>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-gray-400">სათაური *<input required value={title} onChange={(event) => setTitle(event.target.value)} className={`${fieldClass} mt-1`} /></label><label className="text-xs text-gray-400">არტისტი *<input required value={artist} onChange={(event) => setArtist(event.target.value)} className={`${fieldClass} mt-1`} /></label><label className="text-xs text-gray-400 sm:col-span-2">გარეკანის ბმული (Cover URL) *<input required type="url" value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} className={`${fieldClass} mt-1`} /></label><label className="text-xs text-gray-400">ფორმატი *<select required value={releaseType} onChange={(event) => setReleaseType(event.target.value)} className={`${fieldClass} mt-1`}><option>სინგლი</option>{!singleOnly && <><option>ალბომი</option><option>EP</option></>}</select></label><label className="text-xs text-gray-400">სეზონი *<input required value={season} onChange={(event) => setSeason(event.target.value)} className={`${fieldClass} mt-1`} /></label><label className="text-xs text-gray-400">ღირებულების გრეიდი<select value={valueTier} onChange={(event) => setValueTier(event.target.value)} className={`${fieldClass} mt-1`}><option>ვერცხლი</option><option>ოქრო</option><option>ზურმუხტი</option><option>საფირონი</option><option>ლალი</option></select></label><div className="flex flex-col justify-end gap-2 pb-1 text-sm text-gray-300"><label className="flex items-center gap-2"><input type="checkbox" checked={isFreshman} onChange={(event) => setIsFreshman(event.target.checked)} className="accent-cyan-400" />ახალი სახელები</label><label className="flex items-center gap-2"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="accent-cyan-400" />აქტიური როტაციაში</label></div></div>
    {user?.role === 'media' && <p className="mt-3 text-xs text-teal-300">დარჩენილია: {Math.max(0, 5 - user.mediaMonthlyReleases)}</p>}{message && <p className={`mt-3 text-xs ${message.error ? 'text-rose-300' : 'text-emerald-300'}`}>{message.text}</p>}<button disabled={saving || (user?.role === 'media' && user.mediaMonthlyReleases >= 5)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-300 to-violet-400 px-4 py-2.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">{saving && <Loader2 className="h-4 w-4 animate-spin" />}დამატება</button>
  </form>;
}
