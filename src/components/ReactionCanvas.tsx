import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { useAllTimeTop15 } from '@/hooks/useAllTimeTop15';
import { useTopArtistRankings } from '@/hooks/useTopArtistRankings';
import { useArtistQueueVisibility } from '@/hooks/useArtistQueueVisibility';
import { supabase } from '@/lib/supabase';
import { artistPoints, artistTierFromRank } from '@/lib/artistRank';
import { MIN_TRACKS_FOR_ARTIST_RATING } from '@/lib/artistRating';
import { youtubeEmbedUrl } from '@/lib/youtubeEmbed';
import { releaseValueTier } from '@/lib/valueTier';
import { reactionCommentInitial, type ReactionView } from '@/lib/reactionStudio';
import ReactionRatingPanel from '@/components/ReactionRatingPanel';
import LiveRankingIndicator from '@/components/LiveRankingIndicator';
import ArtistPortrait from '@/components/ArtistPortrait';
import ArtistQueue from '@/components/ArtistQueue';

interface ReactionCanvasProps {
  view: ReactionView;
  onRatingChange?: (score: number) => void;
  onRatingSubmit?: () => void;
  submittingRating?: boolean;
  saveStatus?: string;
}

export default function ReactionCanvas({ view, onRatingChange, onRatingSubmit, submittingRating, saveStatus }: ReactionCanvasProps) {
  const { top, loading, error } = useAllTimeTop15();
  const { data: artistTop, loading: artistsLoading, error: artistsError, live: artistsLive } = useTopArtistRankings();
  const [fallbackVideos, setFallbackVideos] = useState<Record<string, string | null>>({});
  const { visible: queueVisible, queue } = useArtistQueueVisibility();
  const { release, tracks } = view;
  const selectedTrack = tracks.find((track) => String(track.id) === view.track_id);
  const currentTopReleaseId = view.scene === 'tracks' && selectedTrack ? selectedTrack.id : release.id;
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
  const featuredComment = view.comment?.visible && view.comment.author && view.comment.text
    ? { author: view.comment.author, text: view.comment.text }
    : null;
  const visibleTop = top.slice(0, 10);
  const visibleArtists = artistTop?.slice(0, 5) ?? [];
  const vacantArtistSlots = 5 - visibleArtists.length;

  return <div className="reaction-canvas relative aspect-video w-full overflow-hidden text-white">
    <div className="reaction-canvas-content absolute inset-y-0 left-0 flex w-[72%] flex-col overflow-hidden">
      <section className="reaction-top reaction-track-chart flex h-[27%] shrink-0 flex-col" aria-label="ყველა დროის ტოპ-10 ტრეკი">
        <div className="reaction-top-heading flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-[.7cqw]"><span className="reaction-section-marker" /><h2 className="font-black">ყველა დროის ტოპ-10 ტრეკი</h2></div>
          <span className="reaction-top-live flex shrink-0 items-center gap-[.55cqw]">{!loading && !error && top.length > 0 && <LiveRankingIndicator iconOnly />}<span className="reaction-supporting">{visibleTop.length}/10 · საერთო ქულით</span></span>
        </div>
        {loading && top.length === 0 ? <p className="reaction-top-state flex flex-1 items-center">რეიტინგი იტვირთება...</p>
          : error && top.length === 0 ? <p className="reaction-top-state flex flex-1 items-center text-amber-300">რეიტინგის ჩატვირთვა ვერ მოხერხდა.</p>
            : top.length === 0 ? <p className="reaction-top-state flex flex-1 items-center">შეფასებული აქტიური რელიზები ჯერ არ არის.</p>
              : <ol className="reaction-top-list reaction-track-list grid min-h-0 flex-1">
                {visibleTop.map((rankedRelease, index) => {
                  const tier = releaseValueTier(rankedRelease);
                  const leaderLabel = index === 0 ? 'ლიდერი' : null;
                  return <li key={String(rankedRelease.id)} data-tier={tier ?? undefined} aria-label={`${index + 1}. ${rankedRelease.title}, ${tier ?? ''}, ${rankedRelease.overall_score} ქულა 90-დან${leaderLabel ? `, ${leaderLabel}` : ''}`} className={`reaction-top-item flex min-w-0 items-center ${String(rankedRelease.id) === String(currentTopReleaseId) ? 'reaction-top-item-current' : ''}`}>
                    <span className="reaction-rank shrink-0 font-black tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                    {rankedRelease.coverUrl ? <img src={rankedRelease.coverUrl} alt="" className="reaction-top-cover aspect-square shrink-0 object-cover" /> : <Music2 className="reaction-top-cover shrink-0 text-gray-500" />}
                    <span className="reaction-top-copy min-w-0"><strong className="text-white">{rankedRelease.title}</strong><span className="reaction-top-metrics"><span className="reaction-supporting">{rankedRelease.overall_score}/90</span>{leaderLabel && <span className="reaction-top-leader-label">{leaderLabel}</span>}</span></span>
                  </li>;
                })}
              </ol>}
      </section>

      <section className="reaction-top reaction-artist-chart flex h-[14%] shrink-0 flex-col" aria-label="ტოპ-5 არტისტი">
        <div className="reaction-top-heading flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-[.7cqw]"><span className="reaction-section-marker" /><h2 className="font-black">ტოპ-5 არტისტი</h2></div>
          <span className="reaction-top-live flex shrink-0 items-center gap-[.55cqw]">{artistsLive && !artistsError && visibleArtists.length > 0 && <LiveRankingIndicator iconOnly />}<span className="reaction-supporting">{visibleArtists.length}/5 · {MIN_TRACKS_FOR_ARTIST_RATING}+ ტრეკი</span></span>
        </div>
        {artistsLoading && visibleArtists.length === 0 ? <p className="reaction-top-state flex flex-1 items-center">რეიტინგი იტვირთება...</p>
          : artistsError && visibleArtists.length === 0 ? <p className="reaction-top-state flex flex-1 items-center text-amber-300">არტისტების რეიტინგის ჩატვირთვა ვერ მოხერხდა.</p>
              : <ol className="reaction-top-list reaction-artist-list grid min-h-0 flex-1">
                {visibleArtists.map((artist) => {
                  const tier = artistTierFromRank(artist.rank);
                  const points = artistPoints(artist.average_score);
                  return <li key={artist.id} data-artist-tier={tier?.key} aria-label={`${artist.rank}. ${artist.name}, ${tier?.label ?? ''}, საშუალო ${points} ქულა 90-დან, ${artist.rated_track_count} შეფასებული ტრეკი`} className="reaction-top-item flex min-w-0 items-center">
                    <span className="reaction-rank shrink-0 font-black tabular-nums">{String(artist.rank).padStart(2, '0')}</span>
                    <ArtistPortrait src={artist.photo_url} className="reaction-top-cover" />
                    <span className="reaction-top-copy min-w-0"><strong className="text-white">{artist.name}</strong><span className="reaction-supporting block">{points}/90 · {artist.rated_track_count} ტრეკი</span><span className="stage-rank-status stage-rank-status-compact reaction-artist-tier">{tier?.label}</span></span>
                  </li>;
                })}
                {Array.from({ length: vacantArtistSlots }, (_, index) => <li key={`vacant-${index}`} className="reaction-top-item reaction-artist-vacant flex min-w-0 items-center" aria-label={`კიდევ ${MIN_TRACKS_FOR_ARTIST_RATING} ტრეკი რეიტინგამდე`}>
                  <span className="reaction-vacant-mark">?</span><span className="reaction-top-copy">კიდევ {MIN_TRACKS_FOR_ARTIST_RATING} ტრეკი რეიტინგამდე</span>
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

        <ReactionRatingPanel score={view.score} revealed={view.revealed} onChange={submittingRating ? undefined : onRatingChange} onSubmit={onRatingSubmit} submitting={submittingRating} saveStatus={saveStatus} />
      </div>
      <div className={`reaction-bottom-strip${queueVisible ? '' : ' reaction-bottom-strip-wide'}`}>
        <section className="reaction-featured-comment" aria-label="მაყურებლის კომენტარი">
          {featuredComment && <span className="reaction-featured-comment-avatar" aria-hidden="true">{reactionCommentInitial(featuredComment.author)}</span>}
          <span className="reaction-featured-comment-copy"><span className="reaction-featured-comment-label">მაყურებლის კომენტარი</span>{featuredComment ? <><strong>{featuredComment.author}</strong><span className="reaction-featured-comment-text">{featuredComment.text}</span></> : <span className="reaction-featured-comment-empty">კომენტარი ჯერ არ არის</span>}</span>
        </section>
        {queueVisible && <ArtistQueue entries={queue.slice(0, 5)} />}
      </div>
    </div>
    <div className="absolute inset-y-0 right-0 w-[28%]" aria-hidden="true" />
  </div>;
}
