import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Radio, RotateCcw, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { computeRZTScore, RZT_PARAMS, VIBE_LEVELS } from '@/types/music';
import { reactionOutputUrl, reactionStorageKey, type ReactionScene, type ReactionSession, type ReactionView } from '@/lib/reactionStudio';

type Row = Record<string, unknown>;

export default function ReactionStudio({ releases }: { releases: Row[] }) {
  const [session, setSession] = useState<ReactionSession | null>(null);
  const [view, setView] = useState<ReactionView | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [draftParams, setDraftParams] = useState([5, 5, 5, 5]);
  const [draftVibe, setDraftVibe] = useState(3);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const activeReleases = releases.filter((row) => row.is_active === true && row.parent_id == null);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(reactionStorageKey);
    if (!raw || !supabase) return;
    let saved: ReactionSession;
    try { saved = JSON.parse(raw) as ReactionSession; } catch { window.sessionStorage.removeItem(reactionStorageKey); return; }
    if (!saved.id || !saved.token) { window.sessionStorage.removeItem(reactionStorageKey); return; }
    void supabase.rpc('reaction_session_view', { p_token: saved.token }).then(({ data }) => {
      if (!data) { window.sessionStorage.removeItem(reactionStorageKey); return; }
      const restored = data as unknown as ReactionView;
      setSession(saved);
      setView(restored);
      setSelectedReleaseId(restored.release.id);
      setDraftParams(restored.params);
      setDraftVibe(restored.vibe);
    });
  }, []);

  const createSession = async () => {
    if (!supabase || !selectedReleaseId || busy) return;
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('reaction_session_create', { p_release_id: selectedReleaseId });
    if (error || !data) { setMessage('სესიის შექმნა ვერ მოხერხდა. გადაამოწმეთ მონაცემთა ბაზის განახლება.'); setBusy(false); return; }
    const created = data as unknown as ReactionSession;
    const result = await supabase.rpc('reaction_session_view', { p_token: created.token });
    if (result.error || !result.data) { setMessage('სესიის ჩატვირთვა ვერ მოხერხდა.'); setBusy(false); return; }
    window.sessionStorage.setItem(reactionStorageKey, JSON.stringify(created));
    setSession(created);
    const createdView = result.data as unknown as ReactionView;
    setView(createdView);
    setDraftParams(createdView.params);
    setDraftVibe(createdView.vibe);
    setBusy(false);
  };

  const updateView = async (changes: Partial<ReactionView>) => {
    if (!supabase || !session || !view || busy) return;
    const next = { ...view, ...changes };
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('reaction_session_update', {
      p_id: session.id,
      p_release_id: next.release.id,
      p_scene: next.scene,
      p_track_id: next.track_id,
      p_params: next.params,
      p_vibe: next.vibe,
      p_revealed: next.revealed,
    });
    if (error || !data) { setMessage('ცვლილება ვერ შეინახა. სცადეთ ხელახლა.'); setBusy(false); return; }
    const refreshed = await supabase.rpc('reaction_session_view', { p_token: session.token });
    if (refreshed.data) setView(refreshed.data as unknown as ReactionView);
    else setMessage('სესიის განახლება ვერ მოხერხდა.');
    setBusy(false);
  };

  const changeRelease = async (id: string) => {
    setSelectedReleaseId(id);
    if (!supabase || !session || !view || busy) return;
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('reaction_session_update', {
      p_id: session.id, p_release_id: id, p_scene: 'intro', p_track_id: null,
      p_params: [5, 5, 5, 5], p_vibe: 3, p_revealed: false,
    });
    if (error || !data) { setMessage('რელიზის შეცვლა ვერ მოხერხდა.'); setSelectedReleaseId(view.release.id); setBusy(false); return; }
    const refreshed = await supabase.rpc('reaction_session_view', { p_token: session.token });
    if (refreshed.data) {
      const changedView = refreshed.data as unknown as ReactionView;
      setView(changedView);
      setDraftParams(changedView.params);
      setDraftVibe(changedView.vibe);
    }
    setBusy(false);
  };

  const revokeSession = async () => {
    if (!supabase || !session || busy) return;
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('reaction_session_revoke', { p_id: session.id });
    if (error || !data) { setMessage('ბმულის გაუქმება ვერ მოხერხდა.'); setBusy(false); return; }
    window.sessionStorage.removeItem(reactionStorageKey);
    setSession(null); setView(null); setBusy(false);
  };

  const copyLink = async () => {
    if (!session) return;
    try { await navigator.clipboard.writeText(reactionOutputUrl(session.token)); setMessage('OBS-ის ბმული დაკოპირებულია.'); }
    catch { setMessage('ბმულის დაკოპირება ვერ მოხერხდა.'); }
  };

  const scenes: { id: ReactionScene; label: string }[] = [
    { id: 'intro', label: 'რელიზის ბარათი' },
    { id: 'tracks', label: 'ტრეკების სია' },
    { id: 'score', label: 'შეფასება' },
  ];
  const score = computeRZTScore(draftParams, draftVibe);
  const hasDraftChanges = Boolean(view && (draftVibe !== view.vibe || draftParams.some((value, index) => value !== view.params[index])));

  return <section className="space-y-5 rounded-xl border border-blue-400/30 bg-[#121215] p-5">
    <div className="flex items-start gap-3"><Radio className="mt-1 h-5 w-5 text-pink-400" /><div><h2 className="text-lg font-bold text-white">რეაქციის სტუდია</h2><p className="mt-1 text-sm text-gray-400">მართეთ ის, რაც ვიდეოში ჩანს. ბმული მოქმედებს 12 საათის განმავლობაში.</p></div></div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <select aria-label="რელიზის არჩევა" className="min-w-0 flex-1 border border-gray-600 bg-[#0b0b0e] px-3 py-2 text-white" value={selectedReleaseId} onChange={(event) => void changeRelease(event.target.value)} disabled={busy}>
        <option value="">აირჩიეთ რელიზი</option>
        {activeReleases.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.artist_name ?? '')} — {String(row.title ?? '')}</option>)}
      </select>
      {!session && <button type="button" onClick={() => void createSession()} disabled={!selectedReleaseId || busy} className="bg-blue-500 px-4 py-2 font-bold text-white disabled:opacity-50">სესიის შექმნა</button>}
    </div>
    {session && view && <>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyLink()} className="inline-flex items-center gap-2 border border-blue-400 px-3 py-2 text-sm text-blue-200"><Copy className="h-4 w-4" />OBS-ის ბმულის კოპირება</button>
        <a href={reactionOutputUrl(session.token)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-gray-600 px-3 py-2 text-sm text-gray-200"><ExternalLink className="h-4 w-4" />ეკრანის ნახვა</a>
        <button type="button" onClick={() => void revokeSession()} disabled={busy} className="inline-flex items-center gap-2 border border-rose-500/60 px-3 py-2 text-sm text-rose-300 disabled:opacity-50"><X className="h-4 w-4" />ბმულის გაუქმება</button>
      </div>
      <p className="text-xs text-gray-500">ჩასვით ბმული OBS-ში, როგორც ბრაუზერის წყარო. რეკომენდებული ზომა: 1920 × 1080. ბმული შეინახეთ პირადად.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="ეკრანის არჩევა">{scenes.map((scene) => <button key={scene.id} type="button" onClick={() => void updateView({ scene: scene.id })} disabled={busy} className={`border px-3 py-2 text-sm disabled:opacity-50 ${view.scene === scene.id ? 'border-pink-400 bg-pink-400/20 text-white' : 'border-gray-600 text-gray-300'}`}>{scene.label}</button>)}</div>
      {view.tracks.length > 0 && <div><p className="mb-2 text-sm font-semibold text-white">მიმდინარე ტრეკი</p><div className="flex flex-wrap gap-2">{view.tracks.map((track) => <button key={track.id} type="button" onClick={() => void updateView({ scene: 'tracks', track_id: track.id })} disabled={busy} className={`border px-3 py-2 text-xs disabled:opacity-50 ${view.track_id === track.id ? 'border-blue-400 bg-blue-400/20 text-white' : 'border-gray-600 text-gray-300'}`}>{track.track_number ? `${track.track_number}. ` : ''}{track.title}</button>)}</div></div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{RZT_PARAMS.map((param, index) => <label key={param.id} className="border border-gray-700 p-3 text-sm text-gray-300"><span className="flex justify-between"><span>{param.label}</span><strong className="text-white">{draftParams[index]}</strong></span><input type="range" min="1" max="10" value={draftParams[index]} disabled={busy} onChange={(event) => setDraftParams((previous) => previous.map((point, pointIndex) => pointIndex === index ? Number(event.target.value) : point))} className="mt-3 w-full accent-blue-400" /></label>)}</div>
      <label className="block max-w-sm border border-gray-700 p-3 text-sm text-gray-300"><span className="flex justify-between"><span>ატმოსფერო</span><strong className="text-white">{VIBE_LEVELS[draftVibe - 1]}</strong></span><input type="range" min="1" max="5" value={draftVibe} disabled={busy} onChange={(event) => setDraftVibe(Number(event.target.value))} className="mt-3 w-full accent-pink-400" /></label>
      <div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-4"><span className="text-sm text-gray-300">პირადი შეფასება: <strong className="text-xl text-white">{score}/90</strong></span><button type="button" onClick={() => void updateView({ params: draftParams, vibe: draftVibe })} disabled={busy || !hasDraftChanges} className="border border-blue-400 px-4 py-2 text-sm font-bold text-blue-200 disabled:opacity-50">შეფასების გაგზავნა</button><button type="button" onClick={() => void updateView({ scene: 'score', params: draftParams, vibe: draftVibe, revealed: !view.revealed })} disabled={busy} className="bg-blue-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{view.revealed ? 'შეფასების დამალვა' : 'შეფასების გამოჩენა'}</button><button type="button" onClick={() => { setDraftParams([5, 5, 5, 5]); setDraftVibe(3); void updateView({ params: [5, 5, 5, 5], vibe: 3, revealed: false }); }} disabled={busy} className="inline-flex items-center gap-1 border border-gray-600 px-3 py-2 text-sm text-gray-300 disabled:opacity-50"><RotateCcw className="h-4 w-4" />თავიდან დაწყება</button></div>
    </>}
    {message && <p role="status" className="text-sm text-amber-300">{message}</p>}
  </section>;
}
