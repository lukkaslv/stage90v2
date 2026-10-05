import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, ImagePlus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { safeArtistUrl } from '@/lib/artistRank';
import { ARTIST_SOCIALS, type Artist } from '@/types/artist';
import { releaseTypeLabel } from '@/types/music';
import { useAuth } from '@/context/auth-context';
import { useArtistLiveQuery } from '@/hooks/useArtistLiveQuery';
import ArtistPortrait from '@/components/ArtistPortrait';
import SectionLoader from '@/components/SectionLoader';

const inputClass = 'mt-2 w-full border border-white/20 bg-[#111318] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-300';
interface CatalogOption { id: string | number; title: string; artist_name: string; release_type: string; parent_id: string | null; is_active: boolean; }
interface ArtistLink { release_id: string | number; }

async function readAllRows<T>(request: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await request(from, from + 499);
    if (result.error || !result.data) throw result.error ?? new Error('Unavailable');
    rows.push(...result.data);
    if (result.data.length < 500) return rows;
  }
}

export default function ArtistAdmin({ onArtistClick }: { onArtistClick?: (id: string) => void }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState<Artist | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const query = useCallback(async () => {
    const client = supabase;
    if (!client || user?.role !== 'admin') throw new Error('Unavailable');
    return readAllRows<Artist>((from, to) => client.from('artists').select('*').order('name').order('id').range(from, to));
  }, [user?.role]);
  const { data, loading, error, reload } = useArtistLiveQuery(query);
  if (user?.role !== 'admin') return null;

  const remove = async (artist: Artist) => {
    if (!supabase || deleting || !window.confirm(`წაიშალოს არტისტის პროფილი „${artist.name}“? მისი რელიზები საიტზე დარჩება.`)) return;
    setDeleting(artist.id); setMutationError(''); setMessage('');
    try {
      const result = await supabase.from('artists').delete().eq('id', artist.id).select('id');
      if (result.error || !result.data?.length) throw result.error ?? new Error('Not found');
      setMessage('არტისტის პროფილი წაიშალა.'); reload();
    } catch { setMutationError('პროფილის წაშლა ვერ მოხერხდა. სცადეთ ხელახლა.'); }
    finally { setDeleting(null); }
  };

  if (editing) return <ArtistEditor key={editing === 'new' ? 'new' : editing.id} artist={editing === 'new' ? null : editing}
    onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage('არტისტის პროფილი და რელიზები შენახულია.'); setMutationError(''); reload(); }} />;

  const matches = data?.filter((artist) => artist.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [];
  return <section aria-labelledby="artist-admin-title">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 id="artist-admin-title" className="text-xl font-bold text-white">არტისტების პროფილები</h2><p className="mt-2 text-sm text-gray-400">შექმენით პროფილი, დაამატეთ ფოტო და დაუკავშირეთ რელიზები.</p></div><button type="button" onClick={() => { setEditing('new'); setMessage(''); }} className="stage-primary-action"><Plus className="h-4 w-4" />არტისტის დამატება</button></div>
    {message && <p role="status" className="mb-4 text-sm text-emerald-200">{message}</p>}
    {(error || mutationError) && <p role="alert" className="mb-4 text-sm text-rose-200">{mutationError || 'არტისტების სია ვერ ჩაიტვირთა.'} {error && <button type="button" onClick={reload} className="underline">ხელახლა ცდა</button>}</p>}
    <label className="mb-5 block max-w-md text-sm text-gray-300">არტისტის ძებნა<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} /></label>
    {loading && !data ? <SectionLoader /> : <div className="space-y-3">{matches.map((artist) => <article key={artist.id} className="flex flex-wrap items-center gap-4 border border-white/15 bg-[#15171d] p-4">
      <ArtistPortrait src={artist.photo_url} className="h-14 w-14" /><div className="min-w-0 flex-1"><h3 className="break-words font-bold text-white">{artist.name}</h3><p className="mt-1 text-xs text-gray-400">{artist.is_active ? 'გამოქვეყნებული' : 'დამალული'}</p></div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-300">{artist.is_active && onArtistClick && <button type="button" onClick={() => onArtistClick(artist.id)} className="inline-flex items-center gap-1 hover:text-white"><ArrowUpRight className="h-4 w-4" />ნახვა</button>}<button type="button" onClick={() => { setEditing(artist); setMessage(''); }} className="inline-flex items-center gap-1 text-blue-200"><Pencil className="h-4 w-4" />რედაქტირება</button><button type="button" disabled={deleting !== null} onClick={() => void remove(artist)} className="inline-flex items-center gap-1 text-rose-200 disabled:opacity-40"><Trash2 className="h-4 w-4" />{deleting === artist.id ? 'იშლება...' : 'წაშლა'}</button></div>
    </article>)}{!error && matches.length === 0 && <p className="stage-empty-state">{search ? 'არტისტი ვერ მოიძებნა.' : 'არტისტების პროფილები ჯერ არ დამატებულა.'}</p>}</div>}
  </section>;
}

function ArtistEditor({ artist, onCancel, onSaved }: { artist: Artist | null; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(artist?.name ?? '');
  const [photoUrl, setPhotoUrl] = useState(artist?.photo_url ?? '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [bio, setBio] = useState(artist?.bio ?? '');
  const [socials, setSocials] = useState<Artist['social_links']>(artist?.social_links ?? {});
  const [active, setActive] = useState(artist?.is_active ?? true);
  const [catalog, setCatalog] = useState<CatalogOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const [visibleCount, setVisibleCount] = useState(40);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photoFile) { setPhotoPreview(''); return; }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    const client = supabase;
    let cancelled = false;
    setLoading(true); setLoadError(false);
    const load = async () => {
      try {
        if (!client) throw new Error('Unavailable');
        const [releases, links] = await Promise.all([
          readAllRows<CatalogOption>((from, to) => client.from('releases').select('id,title,artist_name,release_type,parent_id,is_active').order('title').order('id').range(from, to)),
          artist ? readAllRows<ArtistLink>((from, to) => client.from('artist_releases').select('release_id').eq('artist_id', artist.id).order('release_id').range(from, to)) : Promise.resolve([]),
        ]);
        if (!cancelled) { setCatalog(releases); setSelected(new Set(links.map((link) => String(link.release_id)))); }
      } catch { if (!cancelled) setLoadError(true); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [artist, loadRevision]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current || loading || loadError) return;
    const client = supabase;
    if (!client) { setError('სერვისთან კავშირი მიუწვდომელია.'); return; }
    if (!name.trim()) { setError('მიუთითეთ არტისტის სასცენო სახელი.'); return; }
    if (photoUrl.trim() && !photoFile && !safeArtistUrl(photoUrl)) { setError('ფოტოსთვის მიუთითეთ დაცული, სწორი ბმული.'); return; }
    const socialLinks: Artist['social_links'] = {};
    for (const { key, label } of ARTIST_SOCIALS) {
      const value = socials[key]?.trim();
      if (!value) continue;
      const safe = safeArtistUrl(value);
      if (!safe) { setError(`${label}: მიუთითეთ დაცული, სწორი ბმული.`); return; }
      socialLinks[key] = safe;
    }
    submitting.current = true; setSaving(true); setError('');
    let uploadedPath: string | null = null;
    let saveRequested = false;
    try {
      let savedPhotoUrl = photoUrl.trim() ? safeArtistUrl(photoUrl)! : '';
      if (photoFile) {
        const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[photoFile.type];
        if (!extension || photoFile.size > 5 * 1024 * 1024) { setError('აირჩიეთ ფოტო მხარდაჭერილი ფორმატით, მაქსიმუმ 5 მბ.'); return; }
        const path = `${window.crypto.randomUUID()}.${extension}`;
        const upload = await client.storage.from('artist-photos').upload(path, photoFile, { contentType: photoFile.type, upsert: false });
        if (upload.error) { setError('ფოტოს ატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.'); return; }
        uploadedPath = path;
        savedPhotoUrl = client.storage.from('artist-photos').getPublicUrl(path).data.publicUrl;
      }
      saveRequested = true;
      const result = await client.rpc('save_artist_profile', {
        p_id: artist?.id ?? null, p_name: name.trim(), p_photo_url: savedPhotoUrl, p_bio: bio.trim(),
        p_social_links: socialLinks, p_is_active: active, p_release_ids: Array.from(selected),
        p_expected_updated_at: artist?.updated_at ?? null,
      });
      if (result.error) {
        const rejected = ['40001', '42501', '22023', '23514', '23503', 'P0002'].includes(result.error.code);
        if (uploadedPath && rejected) await client.storage.from('artist-photos').remove([uploadedPath]);
        uploadedPath = null;
        setError(result.error.code === '40001'
          ? 'პროფილი სხვა ფანჯარაში შეიცვალა. დაბრუნდით სიაში და ხელახლა გახსენით, რათა ბოლო ცვლილებები ნახოთ.'
          : rejected ? 'პროფილის შენახვა ვერ მოხერხდა. გადაამოწმეთ რელიზები და სცადეთ ხელახლა.'
            : 'შენახვა ვერ დადასტურდა. დაბრუნდით სიაში და გადაამოწმეთ პროფილი ხელახლა შენახვამდე.');
        return;
      }
      uploadedPath = null;
      onSaved();
    } catch {
      if (uploadedPath && !saveRequested) await client.storage.from('artist-photos').remove([uploadedPath]);
      setError('შენახვა ვერ დადასტურდა. შეამოწმეთ კავშირი და არტისტების სია ხელახლა შენახვამდე.');
    } finally { submitting.current = false; setSaving(false); }
  };

  const term = search.trim().toLocaleLowerCase();
  const matches = catalog.filter((release) => (!onlySelected || selected.has(String(release.id))) && (!term || `${release.title} ${release.artist_name}`.toLocaleLowerCase().includes(term)));
  const activeLinkedIds = new Set(catalog.filter((release) => release.is_active && selected.has(String(release.id))).map((release) => String(release.id)));
  const inherited = new Set(catalog.filter((release) => release.parent_id && activeLinkedIds.has(String(release.parent_id))).map((release) => String(release.id)));

  return <section aria-labelledby="artist-editor-title">
    <button type="button" disabled={saving} onClick={onCancel} className="mb-5 inline-flex items-center gap-2 text-sm text-gray-300 disabled:opacity-40"><ArrowLeft className="h-4 w-4" />არტისტების სიაში დაბრუნება</button>
    <h2 id="artist-editor-title" className="mb-5 text-xl font-bold text-white">{artist ? 'არტისტის რედაქტირება' : 'არტისტის დამატება'}</h2>
    <form noValidate onSubmit={(event) => void save(event)}>
      <fieldset disabled={saving} className="space-y-6 disabled:opacity-60">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div className="space-y-3">
            {photoPreview ? <img src={photoPreview} alt="არჩეული ფოტო" className="aspect-square w-40 object-cover" /> : <ArtistPortrait src={photoUrl} className="h-40 w-40" />}
            <label className="stage-outline-action inline-flex cursor-pointer items-center gap-2"><ImagePlus className="h-4 w-4" />ფოტოს ატვირთვა<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('აირჩიეთ ჯეიპეგი, პიენჯი ან ვებპი, მაქსიმუმ 5 მბ.'); event.target.value = ''; return; }
              setPhotoFile(file); setError('');
            }} /></label>
            <p className="text-xs leading-5 text-gray-400">მაქსიმუმ 5 მბ. კვადრატული ფოტო საუკეთესო შედეგს იძლევა.</p>
            {(photoUrl || photoFile) && <button type="button" className="text-xs text-rose-200" onClick={() => { setPhotoFile(null); setPhotoUrl(''); if (fileInput.current) fileInput.current.value = ''; }}>ფოტოს მოცილება</button>}
          </div>
          <div className="space-y-4">
            <label className="block text-sm text-gray-300">სასცენო სახელი <span className="text-rose-200">*</span><input value={name} maxLength={100} required onChange={(event) => setName(event.target.value)} className={inputClass} /></label>
            <label className="block text-sm text-gray-300">ფოტოს ბმული<input type="url" value={photoUrl} onChange={(event) => { setPhotoUrl(event.target.value); setPhotoFile(null); if (fileInput.current) fileInput.current.value = ''; }} className={inputClass} /><span className="mt-1 block text-xs text-gray-500">შეგიძლიათ ატვირთვის ნაცვლად ფოტოს ბმული მიუთითოთ.</span></label>
            <label className="block text-sm text-gray-300">არტისტის შესახებ<textarea value={bio} maxLength={3000} rows={4} onChange={(event) => setBio(event.target.value)} className={inputClass} /></label>
            <label className="flex items-center gap-3 text-sm text-gray-300"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="accent-blue-400" />პროფილის გამოქვეყნება</label>
          </div>
        </div>
        <section><h3 className="mb-4 font-bold text-white">სოციალური ქსელები</h3><div className="grid gap-4 sm:grid-cols-2">{ARTIST_SOCIALS.map(({ key, label }) => <label key={key} className="text-sm text-gray-300">{label}<input type="url" value={socials[key] ?? ''} onChange={(event) => setSocials((current) => ({ ...current, [key]: event.target.value }))} className={inputClass} /></label>)}</div></section>
        <section className="border border-white/20 p-4 sm:p-5" aria-labelledby="artist-release-select-title">
          <h3 id="artist-release-select-title" className="font-bold text-white">რელიზების დაკავშირება</h3>
          <p className="mt-2 text-sm leading-6 text-gray-400">ალბომის არჩევისას მისი აქტიური ტრეკებიც ავტომატურად გამოჩნდება. ტრეკი ჯამში ერთხელ ითვლება, მაშინაც კი, თუ ცალკეც მონიშნულია. ალბომის ქულა დამატებით არ ითვლება. საერთო ნამუშევარი რამდენიმე არტისტს შეგიძლიათ დაუკავშიროთ.</p>
          <div className="my-4 flex flex-wrap items-center gap-4"><label className="relative min-w-0 flex-1"><Search aria-hidden="true" className="absolute left-3 top-5 h-4 w-4 text-gray-400" /><span className="sr-only">რელიზის ძებნა</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(40); }} placeholder="სათაური ან არტისტი" className={`${inputClass} pl-9`} /></label><label className="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={onlySelected} onChange={(event) => { setOnlySelected(event.target.checked); setVisibleCount(40); }} />მხოლოდ მონიშნული ({selected.size})</label></div>
          {loadError ? <p role="alert" className="text-sm text-rose-200">რელიზების სია ვერ ჩაიტვირთა. <button type="button" onClick={() => setLoadRevision((value) => value + 1)} className="underline">ხელახლა ცდა</button></p> : loading ? <SectionLoader /> : <>
            <div className="max-h-[440px] space-y-2 overflow-y-auto">{matches.slice(0, visibleCount).map((release) => {
              const id = String(release.id);
              return <label key={id} className={`flex cursor-pointer items-start gap-3 border p-3 ${selected.has(id) ? 'border-blue-300/50 bg-blue-300/5' : 'border-white/10'}`}>
                <input type="checkbox" checked={selected.has(id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} className="mt-1 accent-blue-400" />
                <span className="min-w-0 flex-1"><strong className="block break-words text-sm text-gray-100">{release.title}</strong><span className="mt-1 block text-xs text-gray-400">{release.artist_name} · {releaseTypeLabel({ type: 'სინგლი', release_type: release.release_type })}{!release.is_active && ' · დამალული'}</span>{inherited.has(id) && <span className="mt-1 block text-xs text-blue-200">დაკავშირებული ალბომის ტრეკი</span>}</span>
              </label>;
            })}{matches.length === 0 && <p className="py-4 text-sm text-gray-400">რელიზი ვერ მოიძებნა.</p>}</div>
            {matches.length > visibleCount && <button type="button" onClick={() => setVisibleCount((count) => count + 40)} className="mt-4 text-sm text-blue-200">მეტის ნახვა ({matches.length - visibleCount})</button>}
          </>}
        </section>
      </fieldset>
      {error && <p role="alert" className="mt-5 border border-rose-300/30 p-3 text-sm text-rose-200">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3"><button type="submit" disabled={saving || loading || loadError} className="stage-primary-action disabled:opacity-40">{saving ? 'ინახება...' : 'პროფილის შენახვა'}</button><button type="button" disabled={saving} onClick={onCancel} className="stage-outline-action disabled:opacity-40">გაუქმება</button></div>
    </form>
  </section>;
}
