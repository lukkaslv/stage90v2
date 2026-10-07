import { useEffect, useState } from 'react';
import { Music2, Trophy } from 'lucide-react';
import { useAllTimeTop15 } from '@/hooks/useAllTimeTop15';
import { useTopArtistRankings } from '@/hooks/useTopArtistRankings';
import { useArtistQueueVisibility } from '@/hooks/useArtistQueueVisibility';
import { supabase } from '@/lib/supabase';
import { artistPoints, artistTierFromRank } from '@/lib/artistRank';
import { MIN_TRACKS_FOR_ARTIST_RATING } from '@/lib/artistRating';
import { youtubeEmbedUrl } from '@/lib/youtubeEmbed';
import { releaseValueTier, STRICT_VALUE_TIER_CONFIG } from '@/lib/valueTier';
import { reactionCommentInitial, reactionSceneFromView, reactionScenes, type ReactionOutputScene, type ReactionView } from '@/lib/reactionStudio';
import ArtistPortrait from '@/components/ArtistPortrait';
import BroadcastScore from '@/components/BroadcastScore';
import '@/components/reaction-broadcast.css';

export default function ReactionCanvas({ view, scene: fixedScene, preview = false, onRatingChange, onRatingSubmit, submittingRating = false, ratingStatus }: {
  view: ReactionView;
  scene?: ReactionOutputScene;
  preview?: boolean;
  onRatingChange?: (score: number) => void;
  onRatingSubmit?: () => void;
  submittingRating?: boolean;
  ratingStatus?: string;
}) {
  const scene = fixedScene ?? reactionSceneFromView(view.scene, view.chart_type);
  const { top, loading, error } = useAllTimeTop15();
  const { data: artistTop, loading: artistsLoading, error: artistsError } = useTopArtistRankings();
  const { visible: queueVisible, queue } = useArtistQueueVisibility();
  const [fallbackVideos, setFallbackVideos] = useState<Record<string, string | null>>({});
  const { release, tracks } = view;
  const selectedTrack = tracks.find((track) => String(track.id) === String(view.track_id));
  const releaseId = String(release.id);
  const trackId = selectedTrack ? String(selectedTrack.id) : null;
  const releaseVideo = release.youtube_url;
  const selectedTrackVideo = selectedTrack?.youtube_url;

  useEffect(() => {
    if (!supabase || scene !== 'listen') return;
    const ids = [!releaseVideo && releaseId, trackId && !selectedTrackVideo && trackId].filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;
    let cancelled = false;
    void supabase.from('releases').select('id, youtube_url').in('id', ids).then(({ data }) => {
      if (cancelled || !data) return;
      setFallbackVideos((previous) => ({ ...previous, ...Object.fromEntries(data.map((row) => [String(row.id), row.youtube_url as string | null])) }));
    });
    return () => { cancelled = true; };
  }, [releaseId, releaseVideo, trackId, selectedTrackVideo, scene]);

  const trackVideo = youtubeEmbedUrl(selectedTrackVideo ?? (trackId ? fallbackVideos[trackId] : null));
  const videoUrl = trackVideo ?? youtubeEmbedUrl(releaseVideo ?? fallbackVideos[releaseId]);
  const current = selectedTrack ?? release;
  const comment = view.comment?.visible && view.comment.author && view.comment.text ? view.comment : null;
  const isChart = scene === 'tracks' || scene === 'artists';
  const rows = scene === 'artists'
    ? (artistTop ?? []).slice(0, 15).map((artist) => {
      const tier = artistTierFromRank(artist);
      return { id: String(artist.id), title: artist.name, subtitle: `${artist.rated_track_count} შეფასებული ტრეკი`, score: artistPoints(artist.average_score), cover: artist.photo_url, tier: tier?.label, colorClass: tier ? `stage-artist-${tier.key}` : '' };
    })
    : top.slice(0, 15).map((item) => {
      const tier = releaseValueTier(item);
      return { id: String(item.id), title: item.title, subtitle: item.artist, score: item.overall_score, cover: item.coverUrl, tier, colorClass: tier ? STRICT_VALUE_TIER_CONFIG[tier].badge.replace('stage-tier ', '') : '' };
    });
  const chartLoading = scene === 'artists' ? artistsLoading : loading;
  const chartError = scene === 'artists' ? artistsError : error;

  return <div className="broadcast" data-scene={scene}>
    <header className="broadcast-header"><span className="broadcast-brand"><img src="/stage90-mark.svg" alt="" />#STAGE90</span><span>{reactionScenes.find((entry) => entry.id === scene)?.label}</span><span className="broadcast-header-note">მუსიკა · მოსმენა · შეფასება</span></header>
    <div className="broadcast-camera" aria-label="კამერის ადგილი">{preview && <span>კამერის ადგილი</span>}</div>
    {isChart ? <>
      <section className="broadcast-chart">
        <div className="broadcast-chart-heading"><div><p className="broadcast-eyebrow">ყველა დროის რეიტინგი</p><h1>{scene === 'artists' ? 'ტოპ-15 არტისტი' : 'ტოპ-15 ტრეკი'}</h1></div><span>{scene === 'artists' ? `საშუალო ქულა · ${MIN_TRACKS_FOR_ARTIST_RATING}+ ტრეკი` : 'საერთო ქულით'}</span></div>
        {rows.length > 0 ? <ol className="broadcast-chart-list">{rows.map((row, index) => <li key={row.id} className={row.colorClass} data-current={scene === 'tracks' && row.id === String(current.id)}>
          <span className="broadcast-position">{index === 0 && <Trophy aria-label="პირველი ადგილი" />}{String(index + 1).padStart(2, '0')}</span>
          {scene === 'artists' ? <ArtistPortrait src={row.cover} className="broadcast-chart-cover" /> : row.cover ? <img className="broadcast-chart-cover" src={row.cover} alt="" /> : <Music2 className="broadcast-chart-cover" />}
          <span className="broadcast-chart-copy"><strong>{row.title}</strong><span>{row.subtitle}</span>{row.tier && <small>{row.tier}</small>}</span>
          <span className="broadcast-chart-score">{row.score ?? '—'}<small>/90</small></span>
        </li>)}</ol> : <p className="broadcast-state">{chartLoading ? 'რეიტინგი იტვირთება...' : chartError ? 'რეიტინგის ჩატვირთვა ვერ მოხერხდა.' : 'რეიტინგში ჯერ არ არის საკმარისი მონაცემები.'}</p>}
        {chartError && rows.length > 0 && <p className="broadcast-chart-warning">რეიტინგის განახლება დროებით ვერ მოხერხდა.</p>}
      </section>
    </> : <>
      <section className="broadcast-main">
        {scene === 'listen' ? <div className="broadcast-video">{videoUrl ? <iframe key={videoUrl} src={videoUrl} title={(trackVideo ? selectedTrack?.title : release.title) ?? 'რელიზის ვიდეო'} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : <div className="broadcast-cover-empty">{release.cover_url ? <img src={release.cover_url} alt="" /> : <Music2 />}<span>ამ რელიზს ვიდეოს ბმული არ აქვს.</span></div>}</div> : <div className="broadcast-discussion-art">{release.cover_url ? <img src={release.cover_url} alt="" /> : <Music2 />}<span className="broadcast-eyebrow">რელიზის განხილვა</span></div>}
        <div className="broadcast-title"><p>{current.artist_name}</p><h1>{current.title}</h1>{selectedTrack && <span>რელიზი: {release.title}</span>}</div>
      </section>
      {scene === 'discussion' && <BroadcastScore title={release.title} score={view.score} revealed={view.revealed} preview={preview} onChange={onRatingChange} onSubmit={onRatingSubmit} submitting={submittingRating} status={ratingStatus} />}
    </>}
    <footer className="broadcast-footer">
      {comment ? <div className="broadcast-comment"><span className="broadcast-avatar">{reactionCommentInitial(comment.author!)}</span><div><strong>{comment.author}</strong><p>{comment.text}</p></div></div> : <span className="broadcast-footer-brand">მოუსმინე. განიხილე. შეაფასე.</span>}
      {queueVisible && queue.length > 0 && <div className="broadcast-next"><span>შემდეგი არტისტი</span><strong>{queue[0].artist}</strong>{queue.length > 1 && <small>კიდევ {queue.length - 1} არტისტი</small>}</div>}
    </footer>
  </div>;
}
