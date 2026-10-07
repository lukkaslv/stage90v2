import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Eye, EyeOff, Music2, Radio, RotateCcw, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import SingleScoreInput from '@/components/SingleScoreInput';
import { useAllTimeTop15 } from '@/hooks/useAllTimeTop15';
import { useTopArtistRankings } from '@/hooks/useTopArtistRankings';
import { saveArtistQueue, saveArtistQueueVisibility, useArtistQueueVisibility } from '@/hooks/useArtistQueueVisibility';
import { getQueue, type ArtistQueueEntry } from '@/lib/artistQueue';
import { artistPoints, artistTierFromRank } from '@/lib/artistRank';
import { reactionCommentInitial, reactionOutputUrl, reactionStorageKey, reactionScenes, type ReactionOutputScene, type ReactionSession, type ReactionView } from '@/lib/reactionStudio';
import { youtubeEmbedUrl } from '@/lib/youtubeEmbed';
import ReactionCanvas from '@/components/ReactionCanvas';
import ReactionGuide from '@/components/ReactionGuide';
import RankMovementBadge from '@/components/RankMovementBadge';
import ArtistPortrait from '@/components/ArtistPortrait';
import type { RankedArtist } from '@/types/artist';

type Row = Record<string, unknown>;

export default function ReactionStudio({ releases }: { releases: Row[] }) {
  const [previewScene, setPreviewScene] = useState<ReactionOutputScene>('listen');
  const [session, setSession] = useState<ReactionSession | null>(null);
  const [view, setView] = useState<ReactionView | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [draftScore, setDraftScore] = useState(45);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentMessage, setCommentMessage] = useState('');
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueMessage, setQueueMessage] = useState('');
  const [queueArtist, setQueueArtist] = useState('');
  const { visible: queueVisible, setVisible: setQueueVisible, queue, setQueue } = useArtistQueueVisibility();
  const { top, movement, loading: topLoading, error: topError } = useAllTimeTop15();
  const { data: artistTop, loading: artistsLoading, error: artistsError } = useTopArtistRankings();
  const visibleTracks = top.slice(0, 10);
  const visibleArtists = artistTop?.slice(0, 5) ?? [];
  const activeReleases = releases.filter((row) => row.is_active === true && row.parent_id == null);
  const selectedRelease = activeReleases.find((row) => String(row.id) === selectedReleaseId);
  const selectedTrack = view?.track_id ? releases.find((row) => String(row.id) === view.track_id) : null;
  const trackPlayerUrl = youtubeEmbedUrl(selectedTrack?.youtube_url);
  const playerUrl = trackPlayerUrl ?? youtubeEmbedUrl(selectedRelease?.youtube_url);
  const videoRelease = trackPlayerUrl ? selectedTrack : selectedRelease;
  const hasDraftChanges = Boolean(view && draftScore !== view.score);
  const sessionToken = session?.token;

  useEffect(() => {
    if (!hasDraftChanges) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [hasDraftChanges]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(reactionStorageKey);
    if (!raw || !supabase) return;
    let saved: ReactionSession;
    try { saved = JSON.parse(raw) as ReactionSession; } catch { window.sessionStorage.removeItem(reactionStorageKey); return; }
    if (!saved.id || !saved.token) { window.sessionStorage.removeItem(reactionStorageKey); return; }
    void supabase.rpc('reaction_session_view', { p_token: saved.token }).then(({ data, error }) => {
      if (error || !data) { window.sessionStorage.removeItem(reactionStorageKey); return; }
      const restored = data as unknown as ReactionView;
      setSession(saved);
      setView(restored);
      setSelectedReleaseId(restored.release.id);
      setDraftScore(restored.score);
      setCommentAuthor(restored.comment?.author ?? '');
      setCommentText(restored.comment?.text ?? '');
    });
  }, []);

  useEffect(() => {
    if (!supabase || !sessionToken || busy || hasDraftChanges) return;
    const client = supabase;
    let cancelled = false;
    const refresh = async () => {
      const { data, error } = await client.rpc('reaction_session_view', { p_token: sessionToken });
      if (cancelled || error || !data) return;
      const next = data as unknown as ReactionView;
      setView(next);
      setSelectedReleaseId(next.release.id);
      setDraftScore(next.score);
    };
    const timer = window.setInterval(() => { void refresh(); }, 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [sessionToken, busy, hasDraftChanges]);

  const createSession = async () => {
    if (!supabase || !selectedReleaseId || busy) return;
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('reaction_session_create', { p_release_id: selectedReleaseId });
    if (error || !data) { setMessage('სესიის შექმნა ვერ მოხერხდა. გადაამოწმეთ მონაცემთა ბაზის განახლება.'); setBusy(false); return; }
    const created = data as unknown as ReactionSession;
    const initialized = await supabase.rpc('reaction_session_update', {
      p_id: created.id, p_release_id: selectedReleaseId, p_scene: 'intro',
      p_track_id: null, p_score: 45, p_revealed: false,
    });
    if (initialized.error || !initialized.data) {
      setMessage('სესიის მომზადება ვერ მოხერხდა. სცადეთ ხელახლა.'); setBusy(false); return;
    }
    const result = await supabase.rpc('reaction_session_view', { p_token: created.token });
    if (result.error || !result.data) { setMessage('სესიის ჩატვირთვა ვერ მოხერხდა.'); setBusy(false); return; }
    window.sessionStorage.setItem(reactionStorageKey, JSON.stringify(created));
    const createdView = result.data as unknown as ReactionView;
    setSession(created);
    setView(createdView);
    setDraftScore(createdView.score);
    setCommentAuthor(createdView.comment?.author ?? '');
    setCommentText(createdView.comment?.text ?? '');
    setBusy(false);
  };

  const updateView = async (changes: Partial<ReactionView>) => {
    if (!supabase || !session || !view || busy) return;
    const next = { ...view, ...changes };
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('reaction_session_update', {
      p_id: session.id, p_release_id: next.release.id, p_scene: next.scene,
      p_track_id: next.track_id, p_score: next.score, p_revealed: next.revealed,
    });
    if (error || !data) { setMessage('ცვლილება ვერ შეინახა. სცადეთ ხელახლა.'); setBusy(false); return; }
    const refreshed = await supabase.rpc('reaction_session_view', { p_token: session.token });
    if (refreshed.data) setView(refreshed.data as unknown as ReactionView);
    else setMessage('სესიის განახლება ვერ მოხერხდა.');
    setBusy(false);
  };

  const changeRelease = async (id: string) => {
    if (id === selectedReleaseId || busy) return;
    if (hasDraftChanges && !window.confirm('შეუნახავი შეფასება დაიკარგება. შეცვალოთ რელიზი?')) return;
    if (!supabase || !session || !view) { setSelectedReleaseId(id); return; }
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('reaction_session_update', {
      p_id: session.id, p_release_id: id, p_scene: 'intro', p_track_id: null,
      p_score: 45, p_revealed: false,
    });
    if (error || !data) { setMessage('რელიზის შეცვლა ვერ მოხერხდა.'); setBusy(false); return; }
    const refreshed = await supabase.rpc('reaction_session_view', { p_token: session.token });
    if (refreshed.data) {
      const changedView = refreshed.data as unknown as ReactionView;
      setView(changedView);
      setSelectedReleaseId(changedView.release.id);
      setDraftScore(changedView.score);
      setCommentMessage('');
    } else setMessage('რელიზის ჩატვირთვა ვერ მოხერხდა.');
    setBusy(false);
  };

  const revokeSession = async () => {
    if (!supabase || !session || busy || !window.confirm('გსურთ სტუდიის ბმულის გაუქმება?')) return;
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('reaction_session_revoke', { p_id: session.id });
    if (error || !data) { setMessage('ბმულის გაუქმება ვერ მოხერხდა.'); setBusy(false); return; }
    window.sessionStorage.removeItem(reactionStorageKey);
    setSession(null); setView(null); setBusy(false);
  };

  const copyLink = async (scene: ReactionOutputScene) => {
    if (!session) return;
    try { await navigator.clipboard.writeText(reactionOutputUrl(session.token, scene)); setMessage('OBS-ის ბმული დაკოპირებულია.'); }
    catch { setMessage('ბმულის დაკოპირება ვერ მოხერხდა.'); }
  };

  const submitRating = async () => {
    if (!supabase || !session || busy) return;
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('reaction_session_submit_rating', {
      p_token: session.token, p_score: draftScore,
    });
    if (error || !data) setMessage('შეფასება ვერ გაიგზავნა. სცადეთ ხელახლა.');
    else {
      const refreshed = await supabase.rpc('reaction_session_view', { p_token: session.token });
      if (refreshed.data) setView(refreshed.data as unknown as ReactionView);
      setMessage((refreshed.error || !refreshed.data) ? 'შეფასება გაიგზავნა, სესიის განახლება ვერ მოხერხდა.' : 'შეფასება გაგზავნილია. საერთო ქულა განახლდა.');
    }
    setBusy(false);
  };

  const setCommentVisibility = async (visible: boolean) => {
    if (!supabase || !session || commentBusy) return;
    const author = commentAuthor.trim();
    const text = commentText.trim();
    if (visible && (!author || !text)) {
      setCommentMessage('შეავსეთ ავტორის სახელი და კომენტარი.');
      return;
    }
    setCommentBusy(true);
    setCommentMessage('');
    const result = await supabase.rpc('reaction_session_set_comment', {
      p_id: session.id, p_author: author, p_text: text, p_visible: visible,
    });
    if (result.error || !result.data) {
      setCommentMessage('კომენტარის განახლება ვერ მოხერხდა. გადაამოწმეთ მონაცემთა ბაზის განახლება.');
    } else {
      const refreshed = await supabase.rpc('reaction_session_view', { p_token: session.token });
      if (refreshed.error || !refreshed.data) setCommentMessage('კომენტარის ჩატვირთვა ვერ მოხერხდა.');
      else {
        setView(refreshed.data as unknown as ReactionView);
        setCommentMessage(visible ? 'კომენტარი ეთერში დამაგრდა.' : 'კომენტარი ეთერიდან დამალულია.');
      }
    }
    setCommentBusy(false);
  };

  const toggleQueue = async () => {
    if (queueBusy) return;
    setQueueBusy(true);
    setQueueMessage('');
    const next = !queueVisible;
    if (await saveArtistQueueVisibility(next)) setQueueVisible(next);
    else setQueueMessage('არტისტების რიგის განახლება ვერ მოხერხდა.');
    setQueueBusy(false);
  };

  const updateQueue = async (entries: ArtistQueueEntry[], clearInput = false) => {
    if (queueBusy) return;
    setQueueBusy(true);
    setQueueMessage('');
    const next = getQueue(JSON.stringify(entries));
    if (await saveArtistQueue(next)) {
      setQueue(next);
      if (clearInput) setQueueArtist('');
    } else setQueueMessage('მოთხოვნების შენახვა ვერ მოხერხდა.');
    setQueueBusy(false);
  };

  const addQueueRequest = () => {
    const artist = queueArtist.trim();
    if (!artist) return;
    const match = queue.find((entry) => entry.artist.toLocaleLowerCase('ka-GE') === artist.toLocaleLowerCase('ka-GE'));
    const next = match
      ? queue.map((entry) => entry === match ? { ...entry, requests: entry.requests + 1 } : entry)
      : [...queue, { artist, requests: 1 }];
    void updateQueue(next, true);
  };

  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#343844] pb-5">
      <div className="flex items-start gap-3"><div className="border border-pink-400/30 bg-pink-400/10 p-2"><Radio className="h-5 w-5 text-pink-400" /></div><div><h2 className="text-xl font-black text-white">რეაქციის სტუდია</h2><p className="mt-1 text-sm text-gray-400">რელიზი, შეფასება და OBS-ის ეკრანი ერთ სივრცეში</p></div></div>
      <span className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-bold ${session ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-gray-600 text-gray-400'}`}><span className={`h-2 w-2 rounded-full ${session ? 'bg-emerald-400' : 'bg-gray-500'}`} />{session ? 'სესია აქტიურია' : 'სესია არ არის შექმნილი'}</span>
    </div>

    <div className="border border-[#343844] bg-[#12151d] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-white">ყველა დროის ტოპ-10 ტრეკი</h3><p className="text-xs text-gray-500">ადგილი განისაზღვრება საერთო ქულით</p></div><span className="text-xs text-gray-500">{visibleTracks.length}/10</span></div>
      {topLoading && top.length === 0 ? <p className="py-5 text-sm text-gray-400">მონაცემები იტვირთება...</p> : topError && top.length === 0 ? <p className="py-5 text-sm text-amber-300">რეიტინგის ჩატვირთვა ვერ მოხერხდა.</p> : top.length === 0 ? <p className="py-5 text-sm text-gray-400">შეფასებული აქტიური რელიზები ჯერ არ არის.</p> : <div className="grid gap-2 overflow-x-auto pb-2" style={{ gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))' }}>{visibleTracks.map((release, index) => <button key={String(release.id)} type="button" onClick={() => void changeRelease(String(release.id))} disabled={busy} aria-pressed={selectedReleaseId === String(release.id)} className={`flex min-h-20 min-w-0 items-center gap-2 border p-2.5 text-left transition-colors disabled:opacity-50 ${selectedReleaseId === String(release.id) ? 'border-blue-400 bg-blue-400/15' : 'border-[#343844] bg-[#191d27] hover:border-blue-400/50'}`}><span className="text-base font-black text-blue-300">{String(index + 1).padStart(2, '0')}</span>{release.coverUrl ? <img src={release.coverUrl} alt="" className="h-12 w-12 shrink-0 object-cover" /> : <Music2 className="h-12 w-12 shrink-0 p-2 text-gray-500" />}<span className="min-w-0"><strong className="block break-words text-xs leading-snug text-white">{release.title}</strong><span className="mt-1 block text-[11px] text-gray-400">{release.overall_score}/90 ქულა</span><RankMovementBadge rank={index + 1} movement={movement[String(release.id)]} compact /></span></button>)}</div>}
    </div>

    <div className="border border-[#343844] bg-[#12151d] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-white">ტოპ-5 არტისტი</h3><p className="text-xs text-gray-500">საშუალო ქულით · მინიმუმ 3 შეფასებული ტრეკი</p></div><span className="text-xs text-gray-500">{visibleArtists.length}/5</span></div>
      {artistsLoading && !artistTop ? <p className="py-5 text-sm text-gray-400">მონაცემები იტვირთება...</p> : artistsError && !artistTop ? <p className="py-5 text-sm text-amber-300">არტისტების რეიტინგის ჩატვირთვა ვერ მოხერხდა.</p> : visibleArtists.length === 0 ? <p className="py-5 text-sm text-gray-400">რეიტინგში ჯერ არ არის არტისტი 3 შეფასებული ტრეკით.</p> : <div className="grid gap-2 overflow-x-auto pb-2" style={{ gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))' }}>{visibleArtists.map((artist) => <StudioArtistCard key={artist.id} artist={artist} />)}</div>}
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
      <div className="min-w-0 space-y-5">
        <div className="border border-[#343844] bg-[#12151d] p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-bold text-white">რელიზის ვიდეო</h3><span className="text-xs text-gray-500">YouTube</span></div>
          <div className="aspect-video overflow-hidden bg-[#0b0d16]">{playerUrl ? <iframe key={playerUrl} src={playerUrl} title={String(videoRelease?.title ?? 'რელიზის ვიდეო')} className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen /> : <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-400"><Music2 className="h-7 w-7 text-blue-300" />{selectedRelease ? 'ამ რელიზს YouTube ბმული არ აქვს.' : 'აირჩიეთ რელიზი ვიდეოს სანახავად.'}</div>}</div>
          {videoRelease && <p className="mt-3 truncate text-sm text-gray-300"><strong className="text-white">{String(videoRelease.artist_name ?? '')}</strong> · {String(videoRelease.title ?? '')}</p>}
        </div>
        {session && view && <ReactionGuide key={session.id} view={view} />}
        <div className="border border-[#343844] bg-[#12151d] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-white">OBS-ის ეკრანის წინასწარი ნახვა</h3><span className="text-xs text-gray-500">1920 × 1080</span></div>
          <div className="relative overflow-hidden border border-[#343844] bg-[linear-gradient(45deg,#222733_25%,transparent_25%),linear-gradient(-45deg,#222733_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#222733_75%),linear-gradient(-45deg,transparent_75%,#222733_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px]">
            {view ? <ReactionCanvas view={view} scene={previewScene} preview /> : <div className="flex aspect-video items-center justify-center bg-[#0b0d16] px-5 text-center text-sm text-gray-400">შექმენით სესია ეკრანის სანახავად.</div>}

          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-400">კამერა განათავსეთ გამჭვირვალე ფანჯარაში, ბრაუზერის წყაროს ქვეშ. ოთხივე სცენაში მარჯვნივ ერთი და იგივე ვერტიკალური ფანჯარაა — 9:16. 1920 × 1080 კადრში: მარცხნიდან 1434, ზემოდან 96; ზომა 486 × 864. ტელეფონის კამერა დაამატეთ ერთხელ და გამოიყენეთ არსებული წყარო ყველა სცენაში. ვიდეო გაუშვით ბრაუზერის წყაროს ინტერაქციით. მოსმენის წყაროსთვის ჩართეთ დამალვისას გამორთვა, რათა სხვა სცენაში ხმა არ გაგრძელდეს.</p>
        </div>
      </div>

      <div className="min-w-0 space-y-5">
        <div className="border border-[#343844] bg-[#12151d] p-4">
          <h3 className="mb-3 font-bold text-white">ეთერის მართვა</h3>
          <div className="mb-4 flex items-center justify-between gap-3 border border-violet-400/30 bg-violet-400/10 p-3"><div><p className="text-sm font-bold text-white">არტისტების რიგი OBS-ზე</p><p className="text-xs text-gray-400">{queueVisible ? 'რიგი ეთერში ჩანს' : 'რიგი ეთერიდან დამალულია'}</p></div><button type="button" onClick={() => void toggleQueue()} disabled={queueBusy} aria-pressed={queueVisible} className="shrink-0 border border-violet-400 px-3 py-2 text-xs font-bold text-violet-200 disabled:opacity-50">{queueVisible ? 'რიგის დამალვა' : 'რიგის ჩვენება'}</button></div>
          <form className="mb-4 border border-violet-400/20 bg-[#1a1522] p-3" onSubmit={(event) => { event.preventDefault(); addQueueRequest(); }}>
            <label className="block text-xs font-semibold text-gray-300">არტისტის მოთხოვნა<input value={queueArtist} onChange={(event) => setQueueArtist(event.target.value)} maxLength={80} placeholder="შეიყვანეთ არტისტის სახელი" className="mt-1.5 w-full border border-gray-600 bg-[#0b0d16] px-3 py-2.5 text-sm text-white" /></label>
            <button type="submit" disabled={queueBusy || !queueArtist.trim()} className="mt-2 border border-violet-400 px-3 py-2 text-xs font-bold text-violet-200 disabled:opacity-50">მოთხოვნის დამატება</button>
            {queue.length === 0 ? <p className="mt-3 text-xs text-gray-400">რიგი ცარიელია.</p> : <ol className="mt-3 space-y-2">{queue.map((entry) => <li key={entry.artist} className="flex flex-wrap items-center gap-2 border border-white/10 px-2 py-1.5 text-sm text-gray-200"><strong className="min-w-0 flex-1 break-words">{entry.artist}</strong><span className="font-bold text-violet-200">×{entry.requests}</span><button type="button" onClick={() => void updateQueue(queue.map((item) => item === entry ? { ...item, requests: item.requests + 1 } : item))} disabled={queueBusy} aria-label={`${entry.artist}: მოთხოვნის დამატება`} className="border border-violet-400/50 px-2 py-1 text-xs text-violet-200 disabled:opacity-50">+1</button><button type="button" onClick={() => void updateQueue(queue.map((item) => item === entry ? { ...item, requests: item.requests - 1 } : item))} disabled={queueBusy} aria-label={`${entry.artist}: მოთხოვნის გამოკლება`} className="border border-gray-500 px-2 py-1 text-xs text-gray-200 disabled:opacity-50">−1</button><button type="button" onClick={() => void updateQueue(queue.filter((item) => item !== entry))} disabled={queueBusy} aria-label={`${entry.artist}: რიგიდან წაშლა`} className="border border-rose-500/50 px-2 py-1 text-xs text-rose-300 disabled:opacity-50">წაშლა</button></li>)}</ol>}
          </form>
          {queueMessage && <p role="status" className="mb-3 text-xs text-amber-300">{queueMessage}</p>}
          <label className="mb-3 block text-xs font-semibold text-gray-400">რელიზი<select aria-label="რელიზის არჩევა" className="mt-1.5 w-full border border-gray-600 bg-[#0b0d16] px-3 py-2.5 text-sm text-white" value={selectedReleaseId} onChange={(event) => void changeRelease(event.target.value)} disabled={busy}><option value="">აირჩიეთ რელიზი</option>{activeReleases.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.artist_name ?? '')} — {String(row.title ?? '')}</option>)}</select></label>
          {!session ? <button type="button" onClick={() => void createSession()} disabled={!selectedReleaseId || busy} className="w-full bg-blue-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">სესიის შექმნა</button> : view && <>
            <div className="grid gap-3 sm:grid-cols-2">{reactionScenes.map((scene) => <div key={scene.id} className={`border p-3 ${previewScene === scene.id ? 'border-pink-400 bg-pink-400/10' : 'border-gray-600'}`}>
              <h4 className="text-sm font-bold text-white">{scene.label}</h4><p className="mt-1 text-xs text-gray-400">{scene.description}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs"><button type="button" onClick={() => setPreviewScene(scene.id)} aria-pressed={previewScene === scene.id} className="text-pink-300">წინასწარი ნახვა</button><button type="button" onClick={() => void copyLink(scene.id)} className="inline-flex items-center gap-1 text-blue-200"><Copy className="h-3 w-3" />ბმულის კოპირება</button><a href={reactionOutputUrl(session.token, scene.id)} target="_blank" rel="noreferrer" aria-label={`${scene.label}: გახსნა`} className="inline-flex items-center gap-1 text-gray-200"><ExternalLink className="h-3 w-3" />გახსნა</a></div>
            </div>)}</div>
            {view.tracks.length > 0 && <div className="mt-4"><p className="mb-2 text-xs font-semibold text-gray-400">მიმდინარე ტრეკი</p><div className="flex flex-wrap gap-2">{view.tracks.map((track) => <button key={track.id} type="button" onClick={() => void updateView({ track_id: String(track.id) })} disabled={busy} className={`border px-3 py-2 text-xs disabled:opacity-50 ${view.track_id === String(track.id) ? 'border-blue-400 bg-blue-400/20 text-white' : 'border-gray-600 text-gray-300'}`}>{track.track_number ? `${track.track_number}. ` : ''}{track.title}</button>)}</div></div>}
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void revokeSession()} disabled={busy} className="inline-flex items-center gap-1.5 border border-rose-500/60 px-3 py-2 text-xs font-semibold text-rose-300 disabled:opacity-50"><X className="h-4 w-4" />ბმულის გაუქმება</button></div>
            <p className="mt-3 text-xs text-gray-500">ოთხივე ბმული დაამატეთ ცალკე სცენაში ბრაუზერის წყაროდ: 1920 × 1080. ყველა სცენა იყენებს ერთ სესიას. ბმულები მოქმედებს 12 საათი. წინასწარი ნახვა ეთერს არ ცვლის.</p>
          </>}
        </div>
        <div className="border border-[#343844] bg-[#12151d] p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-white">მაყურებლის კომენტარი</h3><span className={`text-xs font-bold ${view?.comment?.visible ? 'text-emerald-300' : 'text-gray-400'}`}>{view?.comment?.visible ? 'დამაგრებულია' : 'დამალულია'}</span></div>
          <p className="mt-1 text-xs text-gray-400">რელიზის შეცვლისას კომენტარი ეთერიდან დაიმალება, მაგრამ შეყვანილი ტექსტი შენარჩუნდება.</p>
          <label className="mt-4 block text-xs font-semibold text-gray-300">ავტორის სახელი<input type="text" maxLength={60} value={commentAuthor} onChange={(event) => setCommentAuthor(event.target.value)} placeholder="მაყურებლის სახელი" className="mt-1.5 w-full border border-gray-600 bg-[#0b0d16] px-3 py-2.5 text-sm text-white" /></label>
          <label className="mt-3 block text-xs font-semibold text-gray-300">კომენტარის ტექსტი<textarea maxLength={160} rows={3} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="ჩასვით მაყურებლის კომენტარი" className="mt-1.5 w-full resize-y border border-gray-600 bg-[#0b0d16] px-3 py-2.5 text-sm text-white" /></label>
          <p className="mt-1 text-right text-xs text-gray-400">{commentText.length}/160</p>
          {commentAuthor.trim() && commentText.trim() && <div className="mt-3 border border-pink-400/30 bg-[#1c1826] p-3" aria-label="კომენტარის წინასწარი ნახვა"><p className="mb-2 text-xs font-bold text-pink-300">წინასწარი ნახვა</p><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pink-400/50 bg-pink-400/20 text-sm font-black text-pink-200">{reactionCommentInitial(commentAuthor)}</span><div className="min-w-0"><strong className="block break-words text-sm text-white">{commentAuthor.trim()}</strong><p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-200">{commentText.trim()}</p></div></div></div>}
          <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => void setCommentVisibility(true)} disabled={!session || commentBusy || !commentAuthor.trim() || !commentText.trim()} className="min-h-11 bg-pink-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">ეთერში დამაგრება</button><button type="button" onClick={() => void setCommentVisibility(false)} disabled={!session || commentBusy || !view?.comment?.visible} className="min-h-11 border border-gray-500 px-3 py-2 text-sm font-bold text-gray-200 disabled:opacity-50">დამალვა</button></div>
          {commentMessage && <p role="status" className="mt-3 text-xs text-amber-300">{commentMessage}</p>}
        </div>
        {session && view && <div className="border border-[#343844] bg-[#12151d] p-4">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold text-white">რელიზის საბოლოო შეფასება</h3><p className="text-xs text-gray-500">არჩეული ტრეკის მიუხედავად, ქულა რელიზს მიენიჭება.</p></div><strong className="shrink-0 text-3xl font-black tabular-nums text-white">{draftScore}<small className="text-sm text-gray-500">/90</small></strong></div>
          <SingleScoreInput id="studio-score" score={draftScore} onChange={setDraftScore} disabled={busy} />
          <p className={`mt-3 flex items-center gap-1.5 text-xs ${hasDraftChanges ? 'text-amber-300' : 'text-emerald-300'}`}>{hasDraftChanges ? 'შეუნახავი ცვლილებები' : <><Check className="h-3.5 w-3.5" />შეფასება შენახულია</>}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><button type="button" onClick={() => void updateView({ score: draftScore })} disabled={busy || !hasDraftChanges} className="border border-blue-400 px-4 py-2.5 text-sm font-bold text-blue-200 disabled:opacity-50">ქულის შენახვა</button><button type="button" onClick={() => void updateView({ scene: 'score', score: draftScore, revealed: !view.revealed })} disabled={busy} className="inline-flex items-center justify-center gap-2 bg-blue-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{view.revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{view.revealed ? 'შეფასების დამალვა' : 'შეფასების გამოჩენა'}</button></div>
          <button type="button" onClick={() => void submitRating()} disabled={busy} className="mt-3 w-full bg-pink-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">შეფასების გამოქვეყნება საიტზე</button>
          <p className="mt-2 text-xs text-gray-400">გამოქვეყნება განაახლებს საიტის რეიტინგს და ქულას ეთერშიც გამოაჩენს.</p>
          <button type="button" onClick={() => { if (hasDraftChanges && !window.confirm('შეუნახავი შეფასება დაიკარგება. დავიწყოთ თავიდან?')) return; setDraftScore(45); void updateView({ score: 45, revealed: false }); }} disabled={busy} className="mt-3 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />თავიდან დაწყება</button>
        </div>}
      </div>
    </div>
    {message && <p role="status" className="text-sm text-amber-300">{message}</p>}
  </section>;
}

function StudioArtistCard({ artist }: { artist: RankedArtist }) {
  const tier = artistTierFromRank(artist);
  return <div className={`flex min-h-20 min-w-0 items-center gap-2 border border-[#343844] bg-[#191d27] p-2.5 stage-artist-${tier?.key ?? 'spark'}`}>
    <span className="text-base font-black" style={{ color: 'var(--artist-color)' }}>{String(artist.rank).padStart(2, '0')}</span>
    <ArtistPortrait src={artist.photo_url} className="h-12 w-12" />
    <span className="min-w-0"><strong className="block break-words text-xs leading-snug text-white">{artist.name}</strong><span className="block text-[11px] text-gray-400">{artistPoints(artist.average_score)}/90 · {artist.rated_track_count} ტრეკი</span><span className="block text-[11px] font-bold" style={{ color: 'var(--artist-color)' }}>{tier?.label}</span></span>
  </div>;
}
