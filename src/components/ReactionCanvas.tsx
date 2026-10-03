import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { useDailyTop15 } from '@/hooks/useDailyTop15';
import { supabase } from '@/lib/supabase';
import { youtubeEmbedUrl } from '@/lib/youtubeEmbed';
import { computeRZTScore, RZT_PARAMS, scoreToTier, VIBE_LEVELS } from '@/types/music';
import type { ReactionView } from '@/lib/reactionStudio';

export default function ReactionCanvas({ view }: { view: ReactionView }) {
  const { top, loading, error } = useDailyTop15();
  const [fallbackVideos, setFallbackVideos] = useState<Record<string, string | null>>({});
  const { release, tracks } = view;
  const selectedTrack = tracks.find((track) => track.id === view.track_id);
  const releaseId = String(release.id);
  const trackId = selectedTrack ? String(selectedTrack.id) : null;
  const releaseVideo = release.youtube_url;
  const selectedTrackVideo = selectedTrack?.youtube_url;

  useEffect(() => {
    if (!supabase) return;
    const ids = [!releaseVideo && releaseId, trackId && !selectedTrackVideo && trackId].filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;
    let cancelled = false;
    void supabase.from('releases').select('id, youtube_url').in('id', ids).then(({ data }) => {
      if (cancelled || !data) return;
      setFallbackVideos((previous) => ({ ...previous, ...Object.fromEntries(data.map((row) => [String(row.id), row.youtube_url as string | null])) }));
    });
    return () => { cancelled = true; };
  }, [releaseId, releaseVideo, trackId, selectedTrackVideo]);

  const trackVideo = youtubeEmbedUrl(selectedTrackVideo ?? (trackId ? fallbackVideos[trackId] : null));
  const videoUrl = trackVideo ?? youtubeEmbedUrl(releaseVideo ?? fallbackVideos[releaseId]);
  const videoTitle = trackVideo ? selectedTrack?.title : release.title;
  const videoArtist = trackVideo ? selectedTrack?.artist_name : release.artist_name;
  const score = computeRZTScore(view.params, view.vibe);

  return <div className="reaction-canvas relative aspect-video w-full overflow-hidden text-white">
    <div className="reaction-canvas-content absolute inset-y-0 left-0 flex w-[72%] flex-col overflow-hidden border-r border-blue-400/40 bg-[#0b0d16]">
      <div className="pointer-events-none absolute -left-[12%] -top-[25%] h-[85%] w-[55%] rounded-full bg-blue-600/10 blur-3xl" />
      <section className="relative flex h-[23%] shrink-0 flex-col border-b border-[#343844] bg-[#101521] px-[2%] py-[1.3%]" aria-label="ბოლო 24 საათის ტოპ-15">
        <div className="mb-[1%] flex items-center justify-between gap-2"><div className="flex items-center gap-[.6cqw]"><span className="h-[1.1cqw] w-[.18cqw] bg-pink-400" /><h2 className="font-black tracking-wide">ბოლო 24 საათის ტოპ-15</h2></div><span className="text-gray-400">შეფასებების რაოდენობით</span></div>
        {loading && top.length === 0 ? <p className="flex flex-1 items-center text-gray-400">რეიტინგი იტვირთება...</p> : error && top.length === 0 ? <p className="flex flex-1 items-center text-amber-300">რეიტინგის ჩატვირთვა ვერ მოხერხდა.</p> : top.length === 0 ? <p className="flex flex-1 items-center text-gray-400">დღის აქტიური რელიზები ჯერ არ არის.</p> : <ol className="grid min-h-0 flex-1 grid-cols-8 grid-rows-2 gap-[.45cqw]">{top.slice(0, 15).map(({ release: rankedRelease, dailyCount }, index) => <li key={String(rankedRelease.id)} className={`flex min-w-0 items-center gap-[.4cqw] overflow-hidden border px-[.45cqw] ${String(rankedRelease.id) === String(release.id) ? 'border-blue-400 bg-blue-400/20' : 'border-white/10 bg-white/5'}`}><span className="shrink-0 font-black tabular-nums text-blue-300">{index + 1}</span>{rankedRelease.coverUrl ? <img src={rankedRelease.coverUrl} alt="" className="aspect-square h-[3.1cqw] shrink-0 object-cover" /> : <Music2 className="h-[2.5cqw] w-[2.5cqw] shrink-0 text-gray-500" />}<span className="min-w-0"><strong className="block truncate text-white">{rankedRelease.title}</strong><span className="block truncate text-gray-400">{dailyCount} შეფასება</span></span></li>)}</ol>}
      </section>
      <div className="relative flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col border-r border-[#343844] bg-[#0b0d16] px-[2.5%] py-[2%]" aria-label="რელიზის ვიდეო">
          <div className="mb-[2%] flex shrink-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold text-pink-400">{videoArtist}</p><h1 className="truncate font-black">{videoTitle}</h1></div><span className="shrink-0 border border-blue-400/50 px-[.7cqw] py-[.3cqw] font-black tracking-wide text-blue-200">STAGE 90</span></div>
          <div className="flex min-h-0 flex-1 items-center justify-center"><div className="aspect-video w-full overflow-hidden border border-white/15 bg-black">{videoUrl ? <iframe key={videoUrl} src={videoUrl} title={videoTitle ?? 'რელიზის ვიდეო'} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-gray-400"><Music2 className="h-[3cqw] w-[3cqw] text-blue-300" /><span>ამ რელიზს YouTube ბმული არ აქვს.</span></div>}</div></div>
          {view.scene === 'tracks' && <p className="mt-[1.5%] truncate font-semibold text-gray-300">{selectedTrack ? `მიმდინარე ტრეკი: ${selectedTrack.title}` : 'აირჩიეთ ტრეკი სტუდიაში'}</p>}
        </section>
        <section className="flex w-[29%] shrink-0 flex-col bg-[#141925] px-[1.5%] py-[2%]" aria-label="შეფასება">
          <p className="font-black tracking-[.08em] text-blue-300">STAGE <span className="text-pink-400">90</span></p>
          <h2 className="mt-[3%] font-black">შეფასება</h2>
          <p className="mb-[5%] text-gray-400">{release.artist_name}</p>
          <div className="space-y-[1.1cqw]">{RZT_PARAMS.map((param, index) => <div key={param.id}><div className="mb-[.25cqw] flex justify-between gap-1"><span className="truncate">{param.label}</span><strong className="tabular-nums">{view.revealed ? `${view.params[index]}/10` : '—'}</strong></div><div className="relative h-[.42cqw] bg-[#323a4b]"><div className="h-full bg-blue-500 transition-[width] duration-300" style={{ width: view.revealed ? `${((view.params[index] - 1) / 9) * 100}%` : '0%' }} />{view.revealed && <span className="absolute top-1/2 h-[.85cqw] w-[.85cqw] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-300 bg-[#141925] transition-[left] duration-300" style={{ left: `${((view.params[index] - 1) / 9) * 100}%` }} />}</div></div>)}</div>
          <div className="mt-[6%] border-t border-white/10 pt-[5%]"><p className="text-gray-400">ატმოსფერო</p><strong>{view.revealed ? VIBE_LEVELS[view.vibe - 1] : '—'}</strong></div>
          <div className="mt-auto border-t border-white/10 pt-[5%]"><p className="font-bold text-gray-400">პირადი შეფასება</p>{view.revealed ? <><strong className="block font-black leading-none tabular-nums">{score}<small className="text-[.3em] text-gray-400">/90</small></strong><span className="font-bold text-pink-300">{scoreToTier(score)}</span></> : <strong className="block font-black text-gray-500">—/90</strong>}</div>
        </section>
      </div>
    </div>
    <div className="absolute inset-y-0 right-0 w-[28%]" aria-hidden="true" />
  </div>;
}
