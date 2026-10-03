import { useEffect, useState } from 'react';
import { Gem, Music2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { computeRZTScore, releaseTypeLabel, RZT_PARAMS, scoreToTier, VIBE_LEVELS, type ReleaseType } from '@/types/music';
import type { ReactionView } from '@/lib/reactionStudio';

function displayScore(score: number | null): string {
  return score != null && Number(score) > 0 ? `${score}/90` : '—';
}

export default function ReactionOutput() {
  const [view, setView] = useState<ReactionView | null>(null);
  const [status, setStatus] = useState('იტვირთება...');

  useEffect(() => {
    document.getElementById('initial-page-loader')?.remove();
    const token = window.location.hash.slice(1);
    if (!supabase || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      setStatus('ბმული არასწორია.');
      return;
    }
    const client = supabase;
    let mounted = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      const { data, error } = await client.rpc('reaction_session_view', { p_token: token });
      inFlight = false;
      if (!mounted) return;
      if (error) { setStatus('კავშირი ვერ დამყარდა.'); return; }
      if (!data) { setView(null); setStatus('ბმულს ვადა გაუვიდა ან გაუქმებულია.'); return; }
      setView(data as unknown as ReactionView);
      setStatus('');
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 1000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  if (!view) return <main className="flex min-h-screen items-center justify-center bg-[#0b0c11] p-8 text-center text-xl text-gray-300">{status}</main>;

  const { release, tracks } = view;
  const score = computeRZTScore(view.params, view.vibe);
  const tier = scoreToTier(score);
  const currentIndex = Math.max(0, tracks.findIndex((track) => track.id === view.track_id));
  const visibleTracks = tracks.slice(Math.max(0, Math.min(currentIndex - 3, tracks.length - 7)), Math.max(7, currentIndex + 4));
  return <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0b0c11] p-[4vw] text-white">
    <div className="pointer-events-none absolute -right-32 -top-40 h-[45vw] w-[45vw] rounded-full bg-blue-600/10 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-40 -left-32 h-[40vw] w-[40vw] rounded-full bg-pink-500/10 blur-3xl" />
    <header className="relative flex items-center justify-between border-b border-white/20 pb-5 text-[clamp(16px,1.6vw,26px)] font-black tracking-[.08em]"><span>STAGE <span className="text-pink-400">90</span></span><span className="text-[clamp(11px,1vw,16px)] font-semibold tracking-normal text-gray-400">რელიზის რეაქცია</span></header>
    <div className="relative flex flex-1 items-center gap-[4vw] py-[3vw]">
      <div className="w-[31%] max-w-[560px] shrink-0"><div className="aspect-square overflow-hidden border-4 border-[#525764] bg-[#1d202a] shadow-[18px_18px_0_#1455f5]">{release.cover_url ? <img src={release.cover_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Music2 className="h-24 w-24 text-gray-500" /></div>}</div></div>
      <div className="min-w-0 flex-1">
        <p className="mb-3 text-[clamp(15px,1.7vw,28px)] font-bold text-pink-400">{release.artist_name}</p>
        <h1 className="break-words text-[clamp(38px,5vw,90px)] font-black leading-[1.05] tracking-tight">{release.title}</h1>
        {release.release_type && <p className="mt-5 w-fit border-l-4 border-blue-500 bg-[#1a2030] px-4 py-2 text-[clamp(13px,1.2vw,20px)] font-bold">{releaseTypeLabel({ type: release.release_type as ReleaseType })}</p>}
        {view.scene === 'intro' && <p className="mt-9 text-[clamp(18px,2vw,34px)] font-semibold text-gray-300">მოვუსმინოთ და შევაფასოთ</p>}
        {view.scene === 'tracks' && <section className="mt-7 max-h-[48vh] overflow-hidden"><h2 className="mb-4 text-[clamp(18px,2vw,30px)] font-bold">ტრეკები</h2>{tracks.length ? <ol className="space-y-2">{visibleTracks.map((track) => <li key={track.id} className={`flex items-center gap-4 border-l-4 px-4 py-2 text-[clamp(14px,1.4vw,23px)] ${view.track_id === track.id ? 'border-pink-400 bg-pink-400/15 text-white' : 'border-gray-700 bg-white/5 text-gray-300'}`}><span className="w-8 shrink-0 text-gray-400">{track.track_number ?? tracks.indexOf(track) + 1}</span><span className="truncate">{track.title}</span></li>)}</ol> : <p className="text-gray-400">ტრეკები არ არის დამატებული.</p>}</section>}
        {view.scene === 'score' && <section className="mt-7"><h2 className="mb-4 text-[clamp(18px,2vw,30px)] font-bold">პირადი შეფასება</h2>{view.revealed ? <><div className="grid max-w-[740px] grid-cols-2 gap-3">{RZT_PARAMS.map((param, index) => <div key={param.id} className="flex justify-between border border-white/20 bg-white/5 px-4 py-3 text-[clamp(12px,1.2vw,20px)]"><span>{param.label}</span><strong>{view.params[index]}/10</strong></div>)}</div><p className="mt-4 text-[clamp(13px,1.2vw,20px)] text-gray-300">ატმოსფერო: {VIBE_LEVELS[view.vibe - 1]}</p><div className="mt-6 flex items-center gap-5"><strong className="text-[clamp(62px,8vw,144px)] leading-none">{score}<small className="text-[.25em] text-gray-400">/90</small></strong><span className="flex items-center gap-2 border-l-4 border-pink-400 bg-pink-400/15 px-4 py-2 text-[clamp(16px,2vw,32px)] font-bold"><Gem className="h-[1em] w-[1em]" />{tier}</span></div></> : <p className="text-[clamp(20px,2.5vw,40px)] font-bold text-gray-300">შეფასება მალე გამოჩნდება</p>}</section>}
      </div>
    </div>
    <footer className="relative flex flex-wrap justify-between gap-4 border-t border-white/20 pt-4 text-[clamp(12px,1.2vw,19px)] text-gray-300"><span>საზოგადოება <strong className="ml-2 text-white">{view.revealed ? displayScore(release.community_score) : '—'}</strong></span><span>მედია <strong className="ml-2 text-white">{view.revealed ? displayScore(release.critics_score) : '—'}</strong></span><span>საერთო ქულა <strong className="ml-2 text-white">{view.revealed ? displayScore(release.overall_score) : '—'}</strong></span></footer>
  </main>;
}
