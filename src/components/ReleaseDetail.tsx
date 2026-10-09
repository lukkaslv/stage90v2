import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight,
  Play,
  Music2,
  Users,
  Clock,
  Sparkles,
  Eraser,
  Send,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Gem,
  TrendingUp,
  MessageSquare,
  Star,
  Lock,
  LogIn,
} from 'lucide-react';
import type { Release } from '@/types/music';
import {
  REVIEW_RULES,
  REVIEW_FORM_TABS,
  releaseTypeLabel,
} from '@/types/music';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import RoleBadge, { VerificationBadge } from '@/components/RoleBadge';
import ScoreTriplet from '@/components/ScoreTriplet';
import SingleScoreInput from '@/components/SingleScoreInput';
import ReleaseArtists from '@/components/ReleaseArtists';
import { releaseCommunityScore, releaseValueTier, STRICT_VALUE_TIER_CONFIG, valueTierFromScore } from '@/lib/valueTier';

interface ReleaseDetailProps {
  release: Release | string | null;
  onBack: () => void;
  onOpenRelease: (release: Release) => void;
  onOpenReview: (id: string) => void;
  onOpenArtist: (id: string) => void;
  backToRelease?: boolean;
  onOpenAuth: () => void;
  onReviewSubmitted?: (releaseId: string | number, created: boolean) => void;
}

type FormTab = (typeof REVIEW_FORM_TABS)[number]['id'];

function isAlbumOrEp(releaseType?: string): boolean {
  const normalized = String(releaseType ?? '').trim().toLowerCase();
  return normalized === 'album' || normalized === 'ალბომი' || normalized === 'ep';
}

function youtubeEmbedUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const path = url.pathname.split('/').filter(Boolean);
    const id = host === 'youtu.be' ? path[0] : ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)
      ? url.searchParams.get('v') ?? (['shorts', 'embed', 'live', 'v'].includes(path[0]) ? path[1] : null)
      : null;
    return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
  } catch { return null; }
}

interface StoredReview {
  id: string | number;
  userId?: string;
  title: string;
  body: string;
  totalScore: number;
  scoringModel: string | null;
  createdAt: string;
  username: string;
  role: string;
  authorCategory?: string;
  isVerified: boolean;
  authorLikes: number;
  mediaUrl: string | null;
  previewImageUrl: string | null;
}

function normalizeRelease(row: Record<string, unknown>): Release {
  const score = Number(row.overall_score ?? row.score ?? row.total_score ?? 0);
  return {
    id: typeof row.id === 'number' ? row.id : String(row.id ?? ''),
    title: String(row.title ?? ''),
    artist: String(row.artist ?? row.artist_name ?? ''),
    coverUrl: String(row.cover_url ?? row.coverUrl ?? ''),
    type: String(row.release_type ?? row.type ?? '') as Release['type'],
    release_type: row.release_type ? String(row.release_type) : undefined,
    year: Number(row.year ?? new Date().getFullYear()),
    score,
    overall_score: row.overall_score == null ? undefined : Number(row.overall_score),
    preliminary_score: row.preliminary_score == null ? undefined : Number(row.preliminary_score),
    eligible_voter_count: row.eligible_voter_count == null ? undefined : Number(row.eligible_voter_count),
    valueTier: typeof row.value_tier === 'string' ? row.value_tier : undefined,
    score_community: row.score_community == null ? undefined : Number(row.score_community),
    community_score: row.community_score == null ? undefined : Number(row.community_score),
    score_critics: row.score_critics == null ? undefined : Number(row.score_critics),
    critics_score: row.critics_score == null ? undefined : Number(row.critics_score),
    reviewCount: Number(row.review_count ?? row.reviewCount ?? 0),
    reviews_count: Number(row.reviews_count ?? row.review_count ?? row.reviewCount ?? 0),
    value_tier: typeof row.value_tier === 'string' ? row.value_tier : undefined,
    trackCount: Number(row.track_count ?? row.trackCount ?? 0),
    genre: String(row.genre ?? ''),
    season: row.season ? String(row.season) : undefined,
    youtube_url: row.youtube_url ? String(row.youtube_url) : undefined,
    streaming_url: row.streaming_url ? String(row.streaming_url) : undefined,
    audio_url: row.audio_url ? String(row.audio_url) : undefined,
    scores: {
      community: Number(row.community_score ?? score - 2),
      critics: Number(row.critics_score ?? score - 3),
      personal: Number(row.personal_score ?? score),
    },
  };
}

function fallbackRelease(candidate: Release | string | null): Release | null {
  return candidate && typeof candidate !== 'string' ? candidate : null;
}

export default function ReleaseDetail({ release, onBack, onOpenRelease, onOpenReview, onOpenArtist, backToRelease = false, onOpenAuth, onReviewSubmitted }: ReleaseDetailProps) {
  const { isAuthenticated, user } = useAuth();
  const [totalScore, setTotalScore] = useState(45);
  const [formTab, setFormTab] = useState<FormTab>('review');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [authorLikedReviewIds, setAuthorLikedReviewIds] = useState<Set<string>>(new Set());
  const [authorLikePendingId, setAuthorLikePendingId] = useState<string | null>(null);
  const [authorLikeError, setAuthorLikeError] = useState('');
  const [authorCommentText, setAuthorCommentText] = useState('');
  const [authorCommentMessage, setAuthorCommentMessage] = useState('');
  const [storedReviews, setStoredReviews] = useState<StoredReview[]>([]);
  const [reviewError, setReviewError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioMessage, setAudioMessage] = useState('');
  const [youtubePlayerUrl, setYoutubePlayerUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [loadedRelease, setLoadedRelease] = useState<Release | null>(() => fallbackRelease(release));
  const [childTracks, setChildTracks] = useState<Release[]>([]);
  const [releaseAwards, setReleaseAwards] = useState<{ season_year: number; award_key: string }[]>([]);

  useEffect(() => {
    const client = supabase;
    const id = typeof release === 'string' ? release : release?.id;
    if (!client || !id) { setReleaseAwards([]); return; }
    let cancelled = false;
    void client.from('annual_release_awards').select('season_year, award_key').eq('release_id', id)
      .then(({ data }) => { if (!cancelled) setReleaseAwards((data ?? []) as { season_year: number; award_key: string }[]); });
    return () => { cancelled = true; };
  }, [release]);

  useEffect(() => {
    if (release && typeof release !== 'string') setLoadedRelease(release);
    const selectedId = typeof release === 'string' ? release : release?.id ? String(release.id) : undefined;
    const client = supabase;
    if (!selectedId || !client) {
      setLoadedRelease(fallbackRelease(release));
      return;
    }

    let cancelled = false;
    const loadRelease = async () => {
      // The selected value may be a Supabase UUID. Keep it as a string and
      // query the database directly instead of coercing it to a number.
      const { data: selectedRow } = await client
        .from('releases')
        .select('*')
        .eq('is_active', true)
        .eq('id', selectedId)
        .maybeSingle();

      if (selectedRow) {
        if (!cancelled) setLoadedRelease(normalizeRelease(selectedRow as Record<string, unknown>));
        return;
      }

      // If the requested UUID is stale, use the canonical fallback from the
      // database first, then the first available row in the database.
      const { data: crisisRow } = await client
        .from('releases')
        .select('*')
        .eq('is_active', true)
        .eq('title', 'CRISIS MANAGEMENT')
        .maybeSingle();

      if (crisisRow) {
        if (!cancelled) setLoadedRelease(normalizeRelease(crisisRow as Record<string, unknown>));
        return;
      }

      let { data: firstRow } = await client
        .from('releases')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!firstRow) {
        const fallbackQuery = await client.from('releases').select('*').eq('is_active', true).limit(1).maybeSingle();
        firstRow = fallbackQuery.data;
      }

      if (!cancelled) {
        setLoadedRelease(firstRow
          ? normalizeRelease(firstRow as Record<string, unknown>)
          : fallbackRelease(release));
      }
    };

    void loadRelease();
    return () => { cancelled = true; };
  }, [release]);

  const activeRelease = loadedRelease;

  useEffect(() => {
    const client = supabase;
    if (!client || !activeRelease || !isAlbumOrEp(activeRelease.release_type ?? activeRelease.type)) {
      setChildTracks([]);
      return;
    }
    let cancelled = false;
    const loadTracks = async () => {
      const { data } = await client.from('releases').select('*').eq('parent_id', activeRelease.id).order('track_number', { ascending: true });
      if (!cancelled) setChildTracks((data ?? []).map((row) => normalizeRelease(row as Record<string, unknown>)));
    };
    void loadTracks();
    return () => { cancelled = true; };
  }, [activeRelease]);

  const charCount = reviewText.length;
  const charMin = 300;
  const charMax = 8500;
  const charWarning = charCount > 0 && charCount < charMin;
  const charOver = charCount > charMax;

  const canSubmit =
    isAuthenticated && (user?.isVerified === true || user?.role === 'admin') &&
    (formTab !== 'review' ||
      (reviewTitle.trim().length > 0 && charCount >= charMin && charCount <= charMax));
  const isMediaUser = user?.role === 'media' || user?.role === 'admin';

  const loadReviews = useCallback(async () => {
    if (!supabase || !activeRelease) {
      setStoredReviews([]);
      return;
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles:user_id(display_name, role, author_category, is_verified)')
      .eq('release_id', activeRelease.id)
      .order('created_at', { ascending: false });

    if (error) {
      setReviewError(error.message);
      return;
    }

    setReviewError('');
    const mappedReviews = (data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      const profile = (item.profiles ?? item.profile) as Record<string, unknown> | null | undefined;
      const metadata = item.user_metadata as Record<string, unknown> | null | undefined;
      const isCurrentUser = item.user_id === user?.id;
      return {
        id: String(item.id ?? crypto.randomUUID()),
        userId: item.user_id ? String(item.user_id) : undefined,
        title: String(item.title ?? 'რეცენზია'),
        body: String(item.content ?? item.body ?? item.text ?? item.review_text ?? item.excerpt ?? ''),
        totalScore: Number(item.total_score ?? 0),
        scoringModel: typeof item.scoring_model === 'string' ? item.scoring_model : null,
        createdAt: String(item.created_at ?? ''),
        username: String(profile?.display_name ?? item.user_display_name ?? item.username ?? item.display_name ?? metadata?.display_name ?? (isCurrentUser ? user?.displayName : undefined) ?? 'მომხმარებელი'),
        role: String(profile?.role ?? 'user'),
        authorCategory: profile?.author_category ? String(profile.author_category) : undefined,
        isVerified: Boolean(profile?.is_verified),
        authorLikes: Number(item.author_like_count ?? 0),
        mediaUrl: typeof item.media_url === 'string' ? item.media_url : null,
        previewImageUrl: typeof item.preview_image_url === 'string' ? item.preview_image_url : null,
      };
    });
    const reviewIds = mappedReviews.map((review) => String(review.id));
    if (reviewIds.length > 0) {
      const { data: likeRows } = await supabase.from('review_author_likes').select('review_id').in('review_id', reviewIds);
      const likeCounts = new Map<string, number>();
      (likeRows ?? []).forEach((row) => {
        const id = String((row as Record<string, unknown>).review_id);
        likeCounts.set(id, (likeCounts.get(id) ?? 0) + 1);
      });
      mappedReviews.forEach((review) => { review.authorLikes = likeCounts.get(String(review.id)) ?? review.authorLikes; });
    }
    setStoredReviews(mappedReviews);
    if ((user?.role === 'author' || user?.role === 'admin') && user.id) {
      const { data: likes } = await supabase.from('review_author_likes').select('review_id').eq('author_id', user.id);
      setAuthorLikedReviewIds(new Set((likes ?? []).map((row) => String((row as Record<string, unknown>).review_id))));
    } else setAuthorLikedReviewIds(new Set());
  }, [activeRelease, user?.displayName, user?.id, user?.role]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const userPersonalReview = storedReviews.find((review) => review.userId === user?.id);

  useEffect(() => {
    const client = supabase;
    if (!client || !activeRelease) return;
    let cancelled = false;
    const refreshRelease = async () => {
      const { data } = await client.from('releases').select('*').eq('id', activeRelease.id).maybeSingle();
      if (!cancelled && data) setLoadedRelease(normalizeRelease(data as Record<string, unknown>));
    };
    const channel = client
      .channel(`release-reviews-${String(activeRelease.id)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `release_id=eq.${activeRelease.id}` }, () => {
        void Promise.all([loadReviews(), refreshRelease()]);
      })
      .subscribe();
    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [activeRelease, loadReviews]);

  const toggleAuthorLike = async (reviewId: string) => {
    if (!supabase || !user || authorLikePendingId || (user.role !== 'author' && user.role !== 'admin')) return;
    const alreadyLiked = authorLikedReviewIds.has(reviewId);
    setAuthorLikePendingId(reviewId);
    setAuthorLikeError('');
    try {
      const result = alreadyLiked
        ? await supabase.from('review_author_likes').delete().eq('review_id', reviewId).eq('author_id', user.id).select('review_id')
        : await supabase.from('review_author_likes').insert({ review_id: reviewId, author_id: user.id }).select('review_id');
      if (result.error || result.data?.length !== 1) {
        setAuthorLikeError('ავტორული მოწონება ვერ შეინახა. სცადეთ ხელახლა.');
        return;
      }
      setAuthorLikedReviewIds((previous) => {
        const next = new Set(previous);
        if (alreadyLiked) next.delete(reviewId);
        else next.add(reviewId);
        return next;
      });
      setStoredReviews((previous) => previous.map((review) => String(review.id) === reviewId
        ? { ...review, authorLikes: Math.max(0, review.authorLikes + (alreadyLiked ? -1 : 1)) }
        : review));
    } catch {
      setAuthorLikeError('ავტორული მოწონება ვერ შეინახა. სცადეთ ხელახლა.');
    } finally {
      setAuthorLikePendingId(null);
    }
  };

  const submitAuthorComment = async () => {
    if (!supabase || !user || !activeRelease || !authorCommentText.trim()) return;
    if (user.role !== 'author' && user.role !== 'admin') return;
    const { error } = await supabase.from('author_comments').insert({ release_id: activeRelease.id, author_id: user.id, comment_text: authorCommentText.trim() });
    setAuthorCommentMessage(error ? 'კომენტარის გამოქვეყნება ვერ მოხერხდა.' : 'კომენტარი გამოქვეყნდა.');
    if (!error) setAuthorCommentText('');
  };

  const handleClear = () => {
    setReviewTitle('');
    setReviewText('');
    setMediaUrl('');
    setPreviewImageUrl('');
  };

  const handleSubmit = async () => {
    if (!canSubmit || !user || !supabase || !activeRelease) {
      if (!supabase) setReviewError('Supabase ჯერ არ არის კონფიგურირებული');
      return;
    }
    if (formTab === 'review' && (charCount < charMin || charCount > charMax)) {
      setReviewError(`რეცენზიის ტექსტი უნდა იყოს ${charMin}-დან ${charMax} სიმბოლომდე`);
      return;
    }

    setIsSubmitting(true);
    setReviewError('');
    const { data: authData } = await supabase.auth.getUser();
    const authenticatedUser = authData.user;
    if (!authenticatedUser) {
      setIsSubmitting(false);
      setReviewError('გთხოვთ, ხელახლა გაიაროთ ავტორიზაცია');
      return;
    }

    const displayName = user.displayName || String(authenticatedUser.user_metadata?.display_name ?? authenticatedUser.email?.split('@')[0] ?? 'მომხმარებელი');
    const existingReview = storedReviews.find((review) => review.userId === authenticatedUser.id);
    const reviewPayload = {
      release_id: activeRelease.id,
      user_id: authenticatedUser.id,
      title: formTab === 'review' ? reviewTitle.trim() : existingReview?.title ?? 'შეფასება',
      content: formTab === 'review' ? reviewText.trim() : existingReview?.body ?? '',
      rhymes: null,
      structure: null,
      style: null,
      individuality: null,
      vibe: null,
      scoring_model: 'holistic_v1',
      total_score: totalScore,
      media_url: formTab === 'review' ? (isMediaUser && mediaUrl.trim() ? mediaUrl.trim() : null) : existingReview?.mediaUrl ?? null,
      preview_image_url: formTab === 'review' ? (isMediaUser && previewImageUrl.trim() ? previewImageUrl.trim() : null) : existingReview?.previewImageUrl ?? null,
      is_media_review: isMediaUser,
      user_display_name: displayName,
      author_name: displayName,
    };
    let { error } = existingReview
      ? await supabase.from('reviews').update(reviewPayload).eq('id', existingReview.id)
      : await supabase.from('reviews').insert(reviewPayload);
    if (error && /column|schema cache|could not find/i.test(error.message)) {
      const basePayload: Record<string, unknown> = { ...reviewPayload };
      delete basePayload.user_display_name;
      delete basePayload.author_name;
      ({ error } = existingReview
        ? await supabase.from('reviews').update(basePayload).eq('id', existingReview.id)
        : await supabase.from('reviews').insert(basePayload));
    }
    if (error) {
      setIsSubmitting(false);
      setReviewError(error.message);
      return;
    }

    handleClear();
    setTotalScore(45);
    await loadReviews();
    const { data: refreshedRelease } = await supabase.from('releases').select('*').eq('id', activeRelease.id).maybeSingle();
    if (refreshedRelease) setLoadedRelease(normalizeRelease(refreshedRelease as Record<string, unknown>));
    onReviewSubmitted?.(activeRelease.id, !existingReview);
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (audioUrl && audioRef.current) void audioRef.current.play().catch(() => undefined);
  }, [audioUrl]);

  if (!activeRelease) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] px-4 py-20 text-center text-gray-500 animate-slide-in">
        <p>რელიზი ვერ მოიძებნა.</p>
        <button onClick={onBack} className="mt-4 rounded-lg border border-[#2a2a32] px-4 py-2 text-sm text-gray-300 transition-colors hover:border-blue-400/50 hover:text-blue-300">უკან დაბრუნება</button>
      </div>
    );
  }

  const reviewCount = storedReviews.length || Number(activeRelease.reviewCount ?? activeRelease.reviews_count ?? 0);
  const boundCommunityScore = releaseCommunityScore(activeRelease) ?? '—';
  const criticsScore = Number(activeRelease.critics_score ?? activeRelease.score_critics);
  const boundCriticsScore = Number.isFinite(criticsScore) && criticsScore > 0 ? criticsScore : '—';
  const boundReleaseTier = releaseValueTier(activeRelease);
  const releaseTierConfig = boundReleaseTier ? STRICT_VALUE_TIER_CONFIG[boundReleaseTier] : null;
  const personalTier = valueTierFromScore(totalScore);
  const personalTierConfig = STRICT_VALUE_TIER_CONFIG[personalTier];
  const normalizedReleaseType = String(activeRelease.release_type ?? activeRelease.type ?? '').trim().toLowerCase();
  const displayedTrackCount = normalizedReleaseType === 'single' || normalizedReleaseType === 'track' || normalizedReleaseType === 'სინგლი'
    ? Math.max(1, activeRelease.trackCount)
    : activeRelease.trackCount;
  const handleListen = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const embedUrl = youtubeEmbedUrl(activeRelease.youtube_url) ?? youtubeEmbedUrl(activeRelease.streaming_url) ?? youtubeEmbedUrl(activeRelease.audio_url);
    if (embedUrl) {
      setYoutubePlayerUrl(embedUrl);
      setAudioUrl(null);
      return;
    }
    const playableAudioUrl = activeRelease.audio_url || activeRelease.streaming_url;
    if (playableAudioUrl) {
      setAudioUrl(playableAudioUrl);
      setYoutubePlayerUrl(null);
      return;
    }
    setAudioMessage('მოსასმენი ბმული მალე დაემატება');
    window.setTimeout(() => setAudioMessage(''), 3200);
  };
  const playTrack = (track: Release) => {
    const embedUrl = youtubeEmbedUrl(track.youtube_url) ?? youtubeEmbedUrl(track.streaming_url) ?? youtubeEmbedUrl(track.audio_url);
    if (embedUrl) {
      setYoutubePlayerUrl(embedUrl);
      setAudioUrl(null);
      return;
    }
    const trackAudioUrl = track.audio_url || track.streaming_url;
    if (trackAudioUrl) {
      setAudioUrl(trackAudioUrl);
      setYoutubePlayerUrl(null);
      return;
    }
    setAudioMessage('ტრეკს მოსასმენი ბმული არ აქვს.');
    window.setTimeout(() => setAudioMessage(''), 3200);
  };
  return (
    <div className="stage-release-detail relative min-h-screen bg-[#0a0a0c] animate-slide-in">
      {audioMessage && createPortal(<div role="status" className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-lg border border-blue-400/30 bg-[#121215] px-4 py-3 text-sm font-semibold text-blue-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]">{audioMessage}</div>, document.body)}
      {youtubePlayerUrl && createPortal(<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-blue-400/30 bg-[#121215] shadow-2xl"><button type="button" onClick={(event) => { event.stopPropagation(); setYoutubePlayerUrl(null); }} className="absolute right-3 top-2 z-10 rounded-full bg-black/70 px-3 py-1 text-xl text-white" aria-label="დახურვა">×</button><div className="aspect-video"><iframe src={youtubePlayerUrl} title={activeRelease.title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div></div></div>, document.body)}
      {audioUrl && createPortal(<div className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-blue-400/30 bg-[#121215] p-3 shadow-2xl"><audio ref={audioRef} src={audioUrl} controls autoPlay className="h-8" /><button type="button" onClick={(event) => { event.stopPropagation(); setAudioUrl(null); }} className="text-lg text-gray-400 hover:text-white" aria-label="დახურვა">×</button></div>, document.body)}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex items-center gap-2 text-sm">
          <button
            onClick={onBack}
            className="text-gray-500 transition-colors hover:text-blue-400"
          >
            {backToRelease ? 'ალბომში დაბრუნება' : 'მთავარი'}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-gray-700" />
          <span className="text-gray-500">რელიზები</span>
          <ChevronRight className="h-3.5 w-3.5 text-gray-700" />
              <span className="text-gray-300 truncate">{activeRelease.title}</span>
        </nav>

        {/* Release Header */}
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Cover */}
          <div className="relative shrink-0">
            <div className="h-48 w-48 overflow-hidden rounded-2xl border border-[#2a2a32] sm:h-56 sm:w-56">
              <img
                src={activeRelease.coverUrl}
                alt={activeRelease.title}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="stage-format-badge px-3 py-1">
                {releaseTypeLabel(activeRelease)}
              </span>
              {activeRelease.season && (
                <span className="stage-season-badge px-3 py-1 text-xs font-medium">
                  {activeRelease.season}
                </span>
              )}
              {releaseAwards.map((award) => <span key={`${award.season_year}-${award.award_key}`} className="stage-award-badge px-3 py-1 text-xs font-semibold">{award.season_year} · {{ listeners_choice: 'მსმენელთა რჩეული', media_choice: 'მედიის რჩეული', release_of_year: 'წლის რელიზი', discovery_of_year: 'წლის აღმოჩენა' }[award.award_key] ?? 'ჯილდო'}</span>)}
            </div>

            {/* Title & artist */}
            <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              {activeRelease.title}
            </h1>
            <p className="mt-1.5 text-lg text-gray-400">{activeRelease.artist}</p>
            <ReleaseArtists releaseId={String(activeRelease.id)} onArtistClick={onOpenArtist} />

            {/* Streaming button */}
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={handleListen} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-400 to-pink-500 px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90">
                <Play className="h-4 w-4" fill="currentColor" />
                მოსმენა
              </button>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Music2 className="h-3.5 w-3.5" />
                  {displayedTrackCount} ტრეკი
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {reviewCount} შეფასება
                </span>
              </div>
            </div>

            {/* Triple score pills */}
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-600">შეფასებები</p>
              <ScoreTriplet community={boundCommunityScore} media={boundCriticsScore} personal={userPersonalReview?.totalScore} large />
              <p className="mt-2 text-xs text-gray-500">ქულები პირად განცდას ასახავს; ჯგუფები მხოლოდ შეფასების ავტორს განასხვავებს.</p>
            </div>

            {/* Overall score and value tier */}
            <div className={`mt-5 w-full max-w-[350px] rounded-xl ${releaseTierConfig?.badge ?? 'border border-zinc-700/50 text-zinc-400'}`}>
              <div className="flex items-center gap-3 rounded-[11px] bg-[#101013] px-4 py-3">
                <Gem className={`h-5 w-5 shrink-0 ${releaseTierConfig?.icon ?? 'text-zinc-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold leading-tight">{boundReleaseTier ?? (activeRelease.preliminary_score ? 'წინასწარი შეფასება' : 'ჯერ არ შეფასებულა')}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-gray-400">{boundReleaseTier ? 'დადასტურებული შემფასებლების საშუალო' : activeRelease.preliminary_score ? `${activeRelease.eligible_voter_count ?? 0}/3 დადასტურებული შემფასებელი · რეიტინგში ჯერ არ ითვლება` : 'დადასტურებული შეფასებები ჯერ არ არის'}</p>
                </div>
                {(boundReleaseTier || activeRelease.preliminary_score) && <span className="shrink-0 text-xl font-bold tabular-nums text-white" aria-label={`საშუალო ქულა ${activeRelease.overall_score || activeRelease.preliminary_score} 90-დან`}>
                  {activeRelease.overall_score || activeRelease.preliminary_score}<span className="ml-0.5 text-xs font-medium text-gray-500">/90</span>
                </span>}
              </div>
            </div>
          </div>
        </div>

        {isAlbumOrEp(activeRelease.release_type ?? activeRelease.type) && <section className="mb-8 rounded-2xl border border-blue-400/20 bg-[#121215] p-5" aria-labelledby="tracklist-heading">
          <h2 id="tracklist-heading" className="mb-4 text-lg font-bold text-white">ტრეკების სია</h2>
          {childTracks.length === 0 ? <p className="text-sm text-gray-500">ამ ალბომში ტრეკები ჯერ არ არის.</p> : <ol className="divide-y divide-white/10">{childTracks.map((track, index) => <li key={String(track.id)} className="flex items-center gap-4 py-3"><span className="w-7 text-center text-sm font-bold text-blue-300">{index + 1}</span><div className="min-w-0 flex-1"><button type="button" onClick={() => onOpenRelease(track)} className="block max-w-full truncate text-left text-sm font-semibold text-white transition-colors hover:text-blue-300 focus-visible:text-blue-300">{track.title}</button><p className="truncate text-xs text-gray-500">{track.artist}</p></div><button type="button" onClick={() => playTrack(track)} aria-label={`${track.title} — მოსმენა`} className="rounded-full border border-blue-300/30 p-2 text-blue-200 transition hover:bg-blue-300/10"><Play className="h-4 w-4" fill="currentColor" /></button></li>)}</ol>}
        </section>}

        {/* Divider */}
        <div className="mb-8 h-px bg-[#1e1e24]" />

        {/* Auth lock banner */}
        {!isAuthenticated && (
          <div className="mb-6 flex flex-col items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 shrink-0 text-amber-400" />
              <p className="text-sm text-amber-200/90">
                სამუშაოს შეფასება შეუძლიათ პლატფორმის წევრებს. ქულების დასაწერად და რეცენზიის გასაგზავნად გაიარეთ ავტორიზაცია
              </p>
            </div>
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-400 to-pink-500 px-5 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90 glow-cyan shrink-0"
            >
              <LogIn className="h-4 w-4" />
              შესვლა
            </button>
          </div>
        )}

        {/* Authenticated user banner */}
        {isAuthenticated && user && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-400/10">
              {user.isVerified ? (
                <VerificationBadge />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-blue-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                შესული ხართ როგორც {user.displayName}
              </p>
              <p className="text-xs text-gray-400">
                {user.isVerified || user.role === 'admin'
                  ? 'შეფასება და რეცენზია ხელმისაწვდომია'
                  : 'ანგარიში შექმნილია. შეფასება და რეცენზია ადმინისტრატორის ვერიფიკაციის შემდეგ გახდება ხელმისაწვდომი.'}
              </p>
            </div>
          </div>
        )}

        {/* Two-column layout: Evaluation + Review form */}
        <div className="stage-detail-grid grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {/* Left: Stage 90 Evaluation */}
          <div className="stage-detail-evaluation space-y-5">
            <div className="rounded-xl border border-[#1e1e24] bg-[#121215] p-6">
              <div className="mb-5 flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-400/10">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                </span>
                <h2 className="text-lg font-bold text-white">STAGE 90 შეფასების სისტემა</h2>
              </div>

              {/* Score display */}
              <div className="mb-6 flex flex-col items-center">
                <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-slate-500/50 bg-slate-800/60">
                  <div className="text-center">
                    <span className="block text-4xl font-extrabold text-white leading-none">
                      {totalScore}
                    </span>
                    <span className="text-xs font-medium text-gray-500">/ 90</span>
                  </div>
                </div>
                <div className={`mt-3 flex items-center gap-1.5 rounded-full px-4 py-1.5 ${personalTierConfig.badge}`}>
                  <Gem className={`h-3.5 w-3.5 ${personalTierConfig.icon}`} />
                  <span className="text-sm font-bold">{personalTier}</span>
                </div>
              </div>

              <SingleScoreInput id="release-score" score={totalScore} onChange={isAuthenticated ? setTotalScore : undefined} />
            </div>
          </div>

          {/* Right: Review form */}
          <div className="stage-detail-community flex flex-col gap-5">
            {/* Form tabs */}
            <div className="stage-detail-form-tabs grid grid-cols-2 gap-1 rounded-xl border border-[#1e1e24] bg-[#121215] p-1 sm:flex sm:items-center">
              {REVIEW_FORM_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFormTab(tab.id)}
                  className={`min-w-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:flex-1 ${
                    formTab === tab.id
                      ? 'bg-blue-400/10 text-blue-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="stage-detail-form-body grid grid-cols-1 gap-5 sm:grid-cols-[200px_1fr]">
              {/* Rules sidebar */}
              <div className="rounded-xl border border-[#1e1e24] bg-[#121215] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-pink-400" />
                  <h3 className="text-sm font-bold text-white">რეცენზიის წესები</h3>
                </div>
                <ul className="space-y-2.5">
                  {REVIEW_RULES.map((rule, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-400/60" />
                      <span className="text-xs leading-relaxed text-gray-400">{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Form inputs */}
              <div className="rounded-xl border border-[#1e1e24] bg-[#121215] p-5">
                {userPersonalReview && <div className="mb-4 rounded-lg border border-blue-400/20 bg-blue-400/5 px-3 py-2 text-xs text-blue-200">თქვენ უკვე შეაფასეთ ეს რელიზი — ხელახლა გაგზავნა შეცვლის არსებულ შეფასებას.</div>}
                {formTab === 'review' && (
                  <div className="space-y-4">
                    {/* Title input */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-300">
                        რეცენზიის სათაური
                      </label>
                      <input
                        type="text"
                        value={reviewTitle}
                        onChange={(e) => setReviewTitle(e.target.value)}
                        disabled={!isAuthenticated}
                        placeholder={isAuthenticated ? 'შეიყვანეთ სათაური...' : 'ავტორიზაცია საჭიროა'}
                        className="w-full rounded-lg border border-[#1e1e24] bg-[#0a0a0c] px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 transition-colors focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Textarea */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-300">
                        რეცენზიის ტექსტი (300-დან 8500 სიმბოლომდე)
                      </label>
                      <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        minLength={charMin}
                        maxLength={charMax}
                        disabled={!isAuthenticated}
                        placeholder={isAuthenticated ? 'რა იგრძენი მოსმენისას? რა ემოციები, სახეები ან მოგონებები დაგრჩა?' : 'ავტორიზაცია საჭიროა'}
                        rows={8}
                        className="w-full resize-none rounded-lg border border-[#1e1e24] bg-[#0a0a0c] px-4 py-3 text-sm leading-relaxed text-gray-200 placeholder-gray-600 transition-colors focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      {/* Character counter */}
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span
                          className={`rounded-full border px-2 py-0.5 ${
                            charWarning ? 'text-amber-400' :
                            charOver ? 'text-rose-400' :
                            'text-gray-500'
                          }`}
                        >
                          {charCount} / {charMax}
                        </span>
                        {charWarning && (
                          <span className="flex items-center gap-1 text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
            მინიმუმ {charMin - charCount} სიმბოლო დარჩა
                          </span>
                        )}
                        {charOver && (
                          <span className="flex items-center gap-1 text-rose-400">
                            <AlertTriangle className="h-3 w-3" />
            ლიმიტი გადაცილებულია {charCount - charMax} სიმბოლოთი
                          </span>
                        )}
                        {charCount >= charMin && charCount <= charMax && charCount > 0 && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
            ტექსტი შეესაბამება მოთხოვნებს
                          </span>
                        )}
                      </div>
                    </div>
                    {isMediaUser && (
                      <div className="space-y-3 rounded-lg border border-teal-400/20 bg-teal-400/5 p-3">
                        <p className="text-xs font-semibold text-teal-300">მედიის დამატებითი ველები</p>
                        <input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} disabled={!isAuthenticated} type="url" placeholder="ვიდეო გარჩევის ან სტატიის ბმული" className="w-full rounded-lg border border-[#1e1e24] bg-[#0a0a0c] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-teal-400/50 focus:outline-none" />
                        <input value={previewImageUrl} onChange={(event) => setPreviewImageUrl(event.target.value)} disabled={!isAuthenticated} type="url" placeholder="პრევიუს სურათის ბმული" className="w-full rounded-lg border border-[#1e1e24] bg-[#0a0a0c] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-teal-400/50 focus:outline-none" />
                      </div>
                    )}
                  </div>
                )}

                {formTab === 'rating-only' && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Star className="mb-3 h-10 w-10 text-blue-400/40" />
                    <p className="text-sm text-gray-400">
                      შეაფასე, როგორ განიცადე რელიზი, რეცენზიის წერის გარეშე.
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      თქვენი ქულა: <span className="font-bold text-blue-400">{totalScore} / 90</span>
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-5 flex flex-col gap-3 border-t border-[#1e1e24] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={handleClear}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[#2a2a32] px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-300"
                  >
                    <Eraser className="h-4 w-4" />
                    მონახაზის გასუფთავება
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-6 py-2 text-sm font-bold transition-all ${
                      canSubmit
                        ? 'bg-gradient-to-r from-blue-400 to-pink-500 text-black glow-cyan hover:opacity-90'
                        : 'cursor-not-allowed border border-[#1e1e24] bg-[#121215] text-gray-600'
                    }`}
                  >
                    <Send className="h-4 w-4" />
                    {isSubmitting ? 'იგზავნება...' : 'გაგზავნა'}
                  </button>
                </div>
                {reviewError && (
                  <p className="mt-3 text-xs text-rose-400">{reviewError}</p>
                )}
              </div>
            </div>

            {/* Existing reviews preview */}
            <div className="stage-detail-reviews order-first rounded-xl border border-[#1e1e24] bg-[#121215] p-5 lg:order-last">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-pink-400/10">
                  <MessageSquare className="h-4 w-4 text-pink-400" />
                </span>
                <h3 className="text-sm font-bold text-white">შეფასებები და რეცენზიები</h3>
              </div>
              <div className="space-y-3">
                {storedReviews.length === 0 && (
                  <p className="rounded-lg border border-[#1e1e24] p-4 text-xs text-gray-500">
                    {reviewError ? 'შეფასებების ჩატვირთვა ვერ მოხერხდა.' : 'ამ რელიზზე შეფასებები ჯერ არ არის.'}
                  </p>
                )}
                {storedReviews.map((review) => (
                  <div key={review.id} className="flex min-w-0 max-w-full items-start gap-3 overflow-hidden rounded-lg border border-[#1e1e24] p-3">
                    <img
                      src={activeRelease.coverUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
                          <span className="truncate">{review.username}</span>
                          <RoleBadge role={review.role} category={review.authorCategory} isVerified={review.isVerified} />
                        </span>
                        <span className="stage-review-score text-sm font-extrabold">{review.totalScore}<small>/90</small></span>
                      </div>
                      <p className="mt-1 break-words break-all overflow-hidden text-xs font-semibold text-gray-300 line-clamp-1">{review.title}</p>
                      <p className="mt-1 text-[10px] text-gray-500">{review.scoringModel === 'holistic_v1' ? 'ერთიანი შეფასება' : review.scoringModel === 'experience_v1' ? 'პირადი განცდის შეფასება' : 'ადრინდელი ან ვერსიადაუზუსტებელი შეფასება'}</p>
                      {review.body && <p className="mt-1 break-words break-all overflow-hidden whitespace-pre-wrap text-xs leading-relaxed text-gray-500 line-clamp-2">{review.body}</p>}
                      <button type="button" onClick={() => onOpenReview(String(review.id))} className="mt-2 text-xs font-semibold text-blue-300 hover:text-blue-200">{review.body ? 'სრული რეცენზიის ნახვა →' : 'შეფასების ნახვა →'}</button>
                      {(user?.role === 'author' || user?.role === 'admin') && <button type="button" onClick={() => void toggleAuthorLike(String(review.id))} disabled={authorLikePendingId !== null} aria-pressed={authorLikedReviewIds.has(String(review.id))} className={`mt-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold disabled:cursor-wait disabled:opacity-60 ${authorLikedReviewIds.has(String(review.id)) ? 'border-blue-300/40 bg-blue-300/10 text-blue-200' : 'border-[#2a2a32] text-gray-400 hover:text-blue-200'}`}>ავტორული მოწონება · {review.authorLikes}</button>}
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-600">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{review.createdAt ? new Date(review.createdAt).toLocaleDateString('ka-GE') : 'ახლახან'}</span>
                        <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" />{review.body ? 'STAGE 90 რეცენზია' : 'STAGE 90 შეფასება'}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {authorLikeError && <p role="alert" className="text-xs text-rose-300">{authorLikeError}</p>}
              </div>
              {(user?.role === 'author' || user?.role === 'admin') && <div className="mt-4 border-t border-[#1e1e24] pt-4"><label htmlFor="author-review-comment" className="mb-2 block text-xs font-semibold text-blue-200">ავტორული კომენტარი</label><div className="flex gap-2"><input id="author-review-comment" value={authorCommentText} onChange={(event) => setAuthorCommentText(event.target.value)} placeholder="დატოვეთ კომენტარი რელიზზე" className="min-w-0 flex-1 rounded-lg border border-[#2a2a32] bg-[#0a0a0c] px-3 py-2 text-xs text-white placeholder-gray-500" /><button onClick={() => void submitAuthorComment()} disabled={!authorCommentText.trim()} className="rounded-lg bg-blue-400/15 px-3 py-2 text-xs font-semibold text-blue-200 disabled:opacity-40">გამოქვეყნება</button></div>{authorCommentMessage && <p className="mt-2 text-xs text-gray-400">{authorCommentMessage}</p>}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

