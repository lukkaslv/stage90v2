import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { useAllTimeTop15 } from '@/hooks/useAllTimeTop15';
import { supabase } from '@/lib/supabase';
import { youtubeEmbedUrl } from '@/lib/youtubeEmbed';
import { releaseValueTier } from '@/lib/valueTier';
import { reactionCommentInitial, type ReactionView } from '@/lib/reactionStudio';
import ReactionRatingPanel from '@/components/ReactionRatingPanel';
import RankMovementBadge from '@/components/RankMovementBadge';
import LiveRankingIndicator from '@/components/LiveRankingIndicator';

interface ReactionCanvasProps {
  view: ReactionView;
  onRatingChange?: (params: number[], vibe: number) => void;
  onRatingSubmit?: () => void;
  submittingRating?: boolean;
  saveStatus?: string;
}

export default function ReactionCanvas({ view, onRatingChange, onRatingSubmit, submittingRating, saveStatus }: ReactionCanvasProps) {
  const { top, movement, loading, error } = useAllTimeTop15();
  const [fallbackVideos, setFallbackVideos] = useState<Record<string, string | null>>({});
  const { release, tracks } = view;
  const selectedTrack = tracks.find((track) => track.id === view.track_id);
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
  const visibleTop = top.slice(0, 15);
  const topColumns = visibleTop.length <= 5 ? Math.max(visibleTop.length, 1) : visibleTop.length === 6 ? 3 : visibleTop.length <= 10 ? 5 : 8;
  const topRows = Math.ceil(visibleTop.length / topColumns);

  return <div className="reaction-canvas relative aspect-video w-full overflow-hidden text-white">
    <div className="reaction-canvas-content absolute inset-y-0 left-0 flex w-[72%] flex-col overflow-hidden">
      <section className="reaction-top flex h-[23%] shrink-0 flex-col" aria-label="ყველა დროის ტოპ-15 ქულებით">
        <div className="reaction-top-heading flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-[.7cqw]"><span className="reaction-section-marker" /><h2 className="font-black">ყველა დროის ტოპ-15 ქულებით</h2></div>
          <span className="reaction-top-live flex shrink-0 items-center gap-[.55cqw]">{!loading && !error && top.length > 0 && <LiveRankingIndicator iconOnly />}<span className="reaction-supporting">საერთო ქულით</span></span>
        </div>
        {loading && top.length === 0 ? <p className="reaction-top-state flex flex-1 items-center">რეიტინგი იტვირთება...</p>
          : error && top.length === 0 ? <p className="reaction-top-state flex flex-1 items-center text-amber-300">რეიტინგის ჩატვირთვა ვერ მოხერხდა.</p>
            : top.length === 0 ? <p className="reaction-top-state flex flex-1 items-center">შეფასებული აქტიური რელიზები ჯერ არ არის.</p>
              : <ol className="reaction-top-list grid min-h-0 flex-1" data-density={visibleTop.length <= 2 ? 'hero' : topRows === 1 ? 'spacious' : topColumns > 5 ? 'dense' : 'compact'} style={{ gridTemplateColumns: `repeat(${topColumns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${topRows}, minmax(0, 1fr))` }}>
                {visibleTop.map((rankedRelease, index) => {
                  const tier = releaseValueTier(rankedRelease);
                  const rankMovement = movement[String(rankedRelease.id)];
                  const previousRank = rankMovement?.liveChangedAt != null ? rankMovement.livePreviousRank : rankMovement?.previousRank;
                  const newLeader = index === 0 && Boolean(rankMovement?.hasPrevious || rankMovement?.liveChangedAt) && (previousRank == null || previousRank > 1);
                  return <li key={String(rankedRelease.id)} data-tier={tier ?? undefined} aria-label={`${index + 1}. ${rankedRelease.title}, ${tier ?? ''}, ${rankedRelease.overall_score} ქულა 90-დან${newLeader ? ', ახალი ლიდერი' : ''}`} className={`reaction-top-item flex min-w-0 items-center ${String(rankedRelease.id) === String(currentTopReleaseId) ? 'reaction-top-item-current' : ''}`}>
                    <span className="reaction-rank shrink-0 font-black tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                    {rankedRelease.coverUrl ? <img src={rankedRelease.coverUrl} alt="" className="reaction-top-cover aspect-square shrink-0 object-cover" /> : <Music2 className="reaction-top-cover shrink-0 text-gray-500" />}
                    <span className="reaction-top-copy min-w-0">{newLeader && <span className="reaction-top-leader-label">ახალი ლიდერი</span>}<strong className="text-white">{rankedRelease.title}</strong><span className="reaction-supporting block truncate">{rankedRelease.overall_score}/90</span></span>
                    {!newLeader && <RankMovementBadge rank={index + 1} movement={rankMovement} compact micro={topColumns > 5} />}
                  </li>;
                })}
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
          {featuredComment ? <div key={`${featuredComment.author}:${featuredComment.text}`} className="reaction-featured-comment" role="status">
            <span className="reaction-featured-comment-avatar" aria-hidden="true">{reactionCommentInitial(featuredComment.author)}</span>
            <span className="reaction-featured-comment-copy"><span className="reaction-featured-comment-label">მაყურებლის კომენტარი</span><strong>{featuredComment.author}</strong><span className="reaction-featured-comment-text">{featuredComment.text}</span></span>
          </div> : <div className="reaction-comment-placeholder"><span aria-hidden="true">“</span><span><strong>მაყურებლის ხმა</strong><small>შენი კომენტარი აქ გამოჩნდება</small></span></div>}
          {view.scene === 'tracks' && <p className="reaction-track truncate font-semibold">{selectedTrack ? `მიმდინარე ტრეკი: ${selectedTrack.title}` : 'აირჩიეთ ტრეკი სტუდიაში'}</p>}
        </section>

        <ReactionRatingPanel params={view.params} vibe={view.vibe} revealed={view.revealed} onChange={submittingRating ? undefined : onRatingChange} onSubmit={onRatingSubmit} submitting={submittingRating} saveStatus={saveStatus} />
      </div>
    </div>
    <div className="absolute inset-y-0 right-0 w-[28%]" aria-hidden="true" />
  </div>;
}
