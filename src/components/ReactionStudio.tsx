import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Eye, EyeOff, Music2, Radio, RotateCcw, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import SingleScoreInput from '@/components/SingleScoreInput';
import { useAllTimeTop15 } from '@/hooks/useAllTimeTop15';
import { useTopArtistRankings } from '@/hooks/useTopArtistRankings';
import { artistPoints, artistTierFromRank } from '@/lib/artistRank';
import { reactionCommentInitial, reactionOutputUrl, reactionStorageKey, type ReactionChartType, type ReactionScene, type ReactionSession, type ReactionView } from '@/lib/reactionStudio';
import { youtubeEmbedUrl } from '@/lib/youtubeEmbed';
import ReactionCanvas from '@/components/ReactionCanvas';
import ReactionGuide from '@/components/ReactionGuide';
import RankMovementBadge from '@/components/RankMovementBadge';
import ArtistPortrait from '@/components/ArtistPortrait';
import type { RankedArtist } from '@/types/artist';

type Row = Record<string, unknown>;

export default function ReactionStudio({ releases }: { releases: Row[] }) {
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
  const { top, movement, loading: topLoading, error: topError } = useAllTimeTop15();
  const { data: artistTop, loading: artistsLoading, error: artistsError } = useTopArtistRankings();
  const chartType = view?.chart_type ?? 'tracks';
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

  const changeChart = async (nextChart: ReactionChartType) => {
    if (!supabase || !session || !view || busy || nextChart === chartType) return;
    setBusy(true); setMessage('');
    const result = await supabase.rpc('reaction_session_set_chart', { p_id: session.id, p_chart_type: nextChart });
    if (result.error || !result.data) { setMessage('ეთერის რეიტინგის შეცვლა ვერ მოხერხდა.'); setBusy(false); return; }
    const refreshed = await supabase.rpc('reaction_session_view', { p_token: session.token });
    if (refreshed.error || !refreshed.data) setMessage('რეიტინგის განახლება ვერ მოხერხდა.');
    else setView(refreshed.data as unknown as ReactionView);
    setBusy(false);
  };

  const changeRelease = async (id: string) => {
    if (id === selectedReleaseId || busy) return;
    if (hasDraftChanges && !window.confirm('შეუნახავი შეფასება დაიკარგება. შეცვალოთ რელიზი?')) return;
    if (!supabase || !session || !view) { setSelectedReleaseId(id); return; }
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('reaction_session_update', {
      p_id: session.id, p_release_id: id, p_scene: 'intro', p_track_id: null,
      p_score: 45, p_revealed: true,
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

  const copyLink = async () => {
    if (!session) return;
    try { await navigator.clipboard.writeText(reactionOutputUrl(session.token)); setMessage('OBS-ის ბმული დაკოპირებულია.'); }
    catch { setMessage('ბმულის დაკოპირება ვერ მოხერხდა.'); }
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

  const scenes: { id: ReactionScene; label: string }[] = [
    { id: 'intro', label: 'რელიზის ბარათი' },
    { id: 'tracks', label: 'ტრეკების სია' },
    { id: 'score', label: 'შეფასება' },
  ];

  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#343844] pb-5">
      <div className="flex items-start gap-3"><div className="border border-pink-400/30 bg-pink-400/10 p-2"><Radio className="h-5 w-5 text-pink-400" /></div><div><h2 className="text-xl font-black text-white">რეაქციის სტუდია</h2><p className="mt-1 text-sm text-gray-400">რელიზი, შეფასება და OBS-ის ეკრანი ერთ სივრცეში</p></div></div>
      <span className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-bold ${session ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-gray-600 text-gray-400'}`}><span className={`h-2 w-2 rounded-full ${session ? 'bg-emerald-400' : 'bg-gray-500'}`} />{session ? 'სესია აქტიურია' : 'სესია არ არის შექმნილი'}</span>
    </div>

    <div className="border border-[#343844] bg-[#12151d] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-white">{chartType === 'artists' ? 'ყველა დროის ტოპ-15 არტისტი' : 'ყველა დროის ტოპ-15 ქულებით'}</h3><p className="text-xs text-gray-500">{chartType === 'artists' ? 'საშუალო ქულით · მინიმუმ 5 შეფასებული ტრეკი' : 'ადგილი განისაზღვრება საერთო ქულით'}</p></div><span className="text-xs text-gray-500">{chartType === 'artists' ? artistTop?.length ?? 0 : top.length}/15</span></div>
      {session && view && <div className="mb-4 flex gap-2" role="group" aria-label="ეთერის რეიტინგი">{([{ id: 'tracks', label: 'ტრეკები' }, { id: 'artists', label: 'არტისტები' }] as const).map(({ id, label }) => <button key={id} type="button" onClick={() => void changeChart(id)} disabled={busy} aria-pressed={chartType === id} className={`min-h-10 border px-4 py-2 text-xs font-bold disabled:opacity-50 ${chartType === id ? 'border-pink-400 bg-pink-400/15 text-white' : 'border-gray-600 text-gray-300'}`}>{label}</button>)}</div>}
      {chartType === 'artists' ? artistsLoading && !artistTop ? <p className="py-5 text-sm text-gray-400">მონაცემები იტვირთება...</p> : artistsError && !artistTop ? <p className="py-5 text-sm text-amber-300">არტისტების რეიტინგის ჩატვირთვა ვერ მოხერხდა.</p> : !artistTop?.length ? <p className="py-5 text-sm text-gray-400">რეიტინგში ჯერ არ არის არტისტი 5 შეფასებული ტრეკით.</p> : <div className="flex gap-2 overflow-x-auto pb-2">{artistTop.map((artist) => <StudioArtistCard key={artist.id} artist={artist} />)}</div>
        : topLoading && top.length === 0 ? <p className="py-5 text-sm text-gray-400">მონაცემები იტვირთება...</p> : topError && top.length === 0 ? <p className="py-5 text-sm text-amber-300">რეიტინგის ჩატვირთვა ვერ მოხერხდა.</p> : top.length === 0 ? <p className="py-5 text-sm text-gray-400">შეფასებული აქტიური რელიზები ჯერ არ არის.</p> : <div className="flex gap-2 overflow-x-auto pb-2">{top.map((release, index) => <button key={String(release.id)} type="button" onClick={() => void changeRelease(String(release.id))} disabled={busy} aria-pressed={selectedReleaseId === String(release.id)} className={`flex w-48 shrink-0 items-center gap-2 border p-2 text-left transition-colors disabled:opacity-50 ${selectedReleaseId === String(release.id) ? 'border-blue-400 bg-blue-400/15' : 'border-[#343844] bg-[#191d27] hover:border-blue-400/50'}`}><span className="text-sm font-black text-blue-300">{String(index + 1).padStart(2, '0')}</span>{release.coverUrl ? <img src={release.coverUrl} alt="" className="h-10 w-10 shrink-0 object-cover" /> : <Music2 className="h-10 w-10 shrink-0 p-2 text-gray-500" />}<span className="min-w-0"><span className="block truncate text-xs font-bold text-white">{release.title}</span><span className="block truncate text-[11px] text-gray-400">{release.overall_score}/90 ქულა</span><RankMovementBadge rank={index + 1} movement={movement[String(release.id)]} compact /></span></button>)}</div>}
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
            {view ? <ReactionCanvas view={view} /> : <div className="flex aspect-video items-center justify-center bg-[#0b0d16] px-5 text-center text-sm text-gray-400">შექმენით სესია ეკრანის სანახავად.</div>}
            {view && <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[28%] items-center justify-center border-l border-dashed border-white/30 px-2 text-center text-xs font-bold text-white/80">კამერის ადგილი OBS-ში</div>}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-400">კამერა დაამატეთ OBS-ში ცალკე წყაროდ და განათავსეთ მარჯვენა გამჭვირვალე ნაწილში, ბრაუზერის წყაროს ქვეშ. ვიდეო გაუშვით OBS-ის ბრაუზერის წყაროს ინტერაქციით.</p>
        </div>
      </div>

      <div className="min-w-0 space-y-5">
        <div className="border border-[#343844] bg-[#12151d] p-4">
          <h3 className="mb-3 font-bold text-white">ეთერის მართვა</h3>
          <label className="mb-3 block text-xs font-semibold text-gray-400">რელიზი<select aria-label="რელიზის არჩევა" className="mt-1.5 w-full border border-gray-600 bg-[#0b0d16] px-3 py-2.5 text-sm text-white" value={selectedReleaseId} onChange={(event) => void changeRelease(event.target.value)} disabled={busy}><option value="">აირჩიეთ რელიზი</option>{activeReleases.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.artist_name ?? '')} — {String(row.title ?? '')}</option>)}</select></label>
          {!session ? <button type="button" onClick={() => void createSession()} disabled={!selectedReleaseId || busy} className="w-full bg-blue-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">სესიის შექმნა</button> : view && <>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="ეკრანის არჩევა">{scenes.map((scene) => <button key={scene.id} type="button" onClick={() => void updateView({ scene: scene.id })} disabled={busy} aria-pressed={view.scene === scene.id} className={`min-h-11 border px-2 py-2 text-xs font-semibold disabled:opacity-50 ${view.scene === scene.id ? 'border-pink-400 bg-pink-400/15 text-white' : 'border-gray-600 text-gray-300'}`}>{scene.label}</button>)}</div>
            {view.tracks.length > 0 && <div className="mt-4"><p className="mb-2 text-xs font-semibold text-gray-400">მიმდინარე ტრეკი</p><div className="flex flex-wrap gap-2">{view.tracks.map((track) => <button key={track.id} type="button" onClick={() => void updateView({ scene: 'tracks', track_id: String(track.id) })} disabled={busy} className={`border px-3 py-2 text-xs disabled:opacity-50 ${view.track_id === String(track.id) ? 'border-blue-400 bg-blue-400/20 text-white' : 'border-gray-600 text-gray-300'}`}>{track.track_number ? `${track.track_number}. ` : ''}{track.title}</button>)}</div></div>}
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void copyLink()} className="inline-flex items-center gap-1.5 border border-blue-400 px-3 py-2 text-xs font-semibold text-blue-200"><Copy className="h-4 w-4" />OBS-ის ბმული</button><a href={reactionOutputUrl(session.token)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200"><ExternalLink className="h-4 w-4" />ეკრანის გახსნა</a><button type="button" onClick={() => void revokeSession()} disabled={busy} className="inline-flex items-center gap-1.5 border border-rose-500/60 px-3 py-2 text-xs font-semibold text-rose-300 disabled:opacity-50"><X className="h-4 w-4" />ბმულის გაუქმება</button></div>
            <p className="mt-3 text-xs text-gray-500">ბმული ჩასვით OBS-ში ბრაუზერის წყაროდ. ზომა: 1920 × 1080. ბმული მოქმედებს 12 საათი.</p>
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
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><button type="button" onClick={() => void updateView({ score: draftScore })} disabled={busy || !hasDraftChanges} className="border border-blue-400 px-4 py-2.5 text-sm font-bold text-blue-200 disabled:opacity-50">შეფასების გაგზავნა</button><button type="button" onClick={() => void updateView({ scene: 'score', score: draftScore, revealed: !view.revealed })} disabled={busy} className="inline-flex items-center justify-center gap-2 bg-blue-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{view.revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{view.revealed ? 'შეფასების დამალვა' : 'შეფასების გამოჩენა'}</button></div>
          <button type="button" onClick={() => { if (hasDraftChanges && !window.confirm('შეუნახავი შეფასება დაიკარგება. დავიწყოთ თავიდან?')) return; setDraftScore(45); void updateView({ score: 45, revealed: false }); }} disabled={busy} className="mt-3 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />თავიდან დაწყება</button>
        </div>}
      </div>
    </div>
    {message && <p role="status" className="text-sm text-amber-300">{message}</p>}
  </section>;
}

function StudioArtistCard({ artist }: { artist: RankedArtist }) {
  const tier = artistTierFromRank(artist.rank);
  return <div className={`flex w-48 shrink-0 items-center gap-2 border border-[#343844] bg-[#191d27] p-2 stage-artist-${tier?.key ?? 'spark'}`}>
    <span className="text-sm font-black text-blue-300">{String(artist.rank).padStart(2, '0')}</span>
    <ArtistPortrait src={artist.photo_url} className="h-10 w-10" />
    <span className="min-w-0"><strong className="block truncate text-xs text-white">{artist.name}</strong><span className="block truncate text-[11px] text-gray-400">{artistPoints(artist.average_score)}/90 · {artist.rated_track_count} ტრეკი</span><span className="block truncate text-[11px] font-bold" style={{ color: 'var(--artist-color)' }}>{tier?.label}</span></span>
  </div>;
}
