import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { useDailyTop15 } from '@/hooks/useDailyTop15';
import { supabase } from '@/lib/supabase';
import { youtubeEmbedUrl } from '@/lib/youtubeEmbed';
import type { ReactionView } from '@/lib/reactionStudio';
import ReactionRatingPanel from '@/components/ReactionRatingPanel';

interface ReactionCanvasProps {
  view: ReactionView;
  onRatingChange?: (params: number[], vibe: number) => void;
  onRatingSubmit?: () => void;
  submittingRating?: boolean;
  saveStatus?: string;
}

export default function ReactionCanvas({ view, onRatingChange, onRatingSubmit, submittingRating, saveStatus }: ReactionCanvasProps) {
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

  return <div className="reaction-canvas relative aspect-video w-full overflow-hidden text-white">
    <div className="reaction-canvas-content absolute inset-y-0 left-0 flex w-[72%] flex-col overflow-hidden">
      <section className="reaction-top flex h-[23%] shrink-0 flex-col" aria-label="ბოლო 24 საათის ტოპ-15">
        <div className="reaction-top-heading flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-[.7cqw]"><span className="reaction-section-marker" /><h2 className="font-black">ბოლო 24 საათის ტოპ-15</h2></div>
          <span className="reaction-supporting shrink-0">შეფასებების რაოდენობით</span>
        </div>
        {loading && top.length === 0 ? <p className="reaction-top-state flex flex-1 items-center">რეიტინგი იტვირთება...</p>
          : error && top.length === 0 ? <p className="reaction-top-state flex flex-1 items-center text-amber-300">რეიტინგის ჩატვირთვა ვერ მოხერხდა.</p>
            : top.length === 0 ? <p className="reaction-top-state flex flex-1 items-center">დღის აქტიური რელიზები ჯერ არ არის.</p>
              : <ol className="reaction-top-list grid min-h-0 flex-1 grid-cols-8 grid-rows-2">
                {top.slice(0, 15).map(({ release: rankedRelease, dailyCount }, index) => <li key={String(rankedRelease.id)} className={`reaction-top-item flex min-w-0 items-center overflow-hidden ${String(rankedRelease.id) === String(release.id) ? 'reaction-top-item-current' : ''}`}>
                  <span className="reaction-rank shrink-0 font-black tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                  {rankedRelease.coverUrl ? <img src={rankedRelease.coverUrl} alt="" className="reaction-top-cover aspect-square shrink-0 object-cover" /> : <Music2 className="reaction-top-cover shrink-0 text-gray-500" />}
                  <span className="min-w-0"><strong className="block truncate text-white">{rankedRelease.title}</strong><span className="reaction-supporting block truncate">{dailyCount} შეფასება</span></span>
                </li>)}
              </ol>}
      </section>

      <div className="flex min-h-0 flex-1">
        <section className="reaction-video flex min-w-0 flex-1 flex-col" aria-label="რელიზის ვიდეო">
          <div className="reaction-video-heading flex shrink-0 items-center justify-between gap-3">
            <div className="min-w-0"><p className="reaction-artist truncate font-bold">{videoArtist}</p><h1 className="truncate font-black">{videoTitle}</h1></div>
            <span className="reaction-video-brand flex shrink-0 items-center"><img src="/stage90-mark.svg" alt="" /><span>STAGE 90</span></span>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center"><div className="reaction-video-frame aspect-video w-full overflow-hidden bg-black">
            {videoUrl ? <iframe key={videoUrl} src={videoUrl} title={videoTitle ?? 'რელიზის ვიდეო'} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
              : <div className="reaction-video-empty flex h-full flex-col items-center justify-center gap-2 px-4 text-center"><Music2 className="text-blue-300" /><span>ამ რელიზს YouTube ბმული არ აქვს.</span></div>}
          </div></div>
          {view.scene === 'tracks' && <p className="reaction-track truncate font-semibold">{selectedTrack ? `მიმდინარე ტრეკი: ${selectedTrack.title}` : 'აირჩიეთ ტრეკი სტუდიაში'}</p>}
        </section>

        <ReactionRatingPanel params={view.params} vibe={view.vibe} revealed={view.revealed} onChange={submittingRating ? undefined : onRatingChange} onSubmit={onRatingSubmit} submitting={submittingRating} saveStatus={saveStatus} />
      </div>
    </div>
    <div className="absolute inset-y-0 right-0 w-[28%]" aria-hidden="true" />
  </div>;
}
