import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Clock, Award } from 'lucide-react';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import TopCarousel from '@/components/TopCarousel';
import ReleaseCard from '@/components/ReleaseCard';
import ReleaseDetail from '@/components/ReleaseDetail';
import AuthModal from '@/components/AuthModal';
import Top90Leaderboard from '@/components/Top90Leaderboard';
import Achievements from '@/components/Achievements';
import MediaReviews from '@/components/MediaReviews';
import RecentReviewsFeed from '@/components/RecentReviewsFeed';
import ConcertsSection from '@/components/ConcertsSection';
import Top15Daily from '@/components/Top15Daily';
import AuthorsPicks from '@/components/AuthorsPicks';
import AuthorComments from '@/components/AuthorComments';
import NewNamesSection from '@/components/NewNamesSection';
import AdminDashboard from '@/components/AdminDashboard';
import PlatformAboutModal from '@/components/PlatformAboutModal';
import type { Release, PageId } from '@/types/music';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { LoadingProvider, usePageLoading } from '@/context/LoadingContext';
import PageLoader from '@/components/PageLoader';
import MaintenancePlaceholder from '@/components/MaintenancePlaceholder';
import { defaultMaintenanceSettings, loadMaintenanceSettings, type MaintenanceSettings } from '@/lib/maintenance';

type AuthMode = 'login' | 'register';

function AppContent() {
  const { user } = useAuth();
  const { startTransition } = usePageLoading();
  const [selectedRelease, setSelectedRelease] = useState<Release | string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState<PageId>('releases');
  const [adminMode, setAdminMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [releaseCatalog, setReleaseCatalog] = useState<Release[]>([]);
  const [releaseCount, setReleaseCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [userReviewsMap, setUserReviewsMap] = useState<Record<string, number>>({});
  const [maintenance, setMaintenance] = useState<MaintenanceSettings>(defaultMaintenanceSettings);
  const topCatalog = releaseCatalog;
  const latestCatalog = releaseCatalog.length > 7 ? releaseCatalog.slice(7) : releaseCatalog;
  const openRelease = (nextRelease: Release | string) => { void startTransition(() => setSelectedRelease(nextRelease)); };
  const handleRefresh = () => setRefreshKey((key) => key + 1);

  useEffect(() => {
    void loadMaintenanceSettings().then(setMaintenance);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const loadReleases = async () => {
      const { data, error } = await client
        .from('releases')
        .select('*, reviews(count)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const [{ count: liveReleaseCount }, { count: liveReviewCount }, { data: personalReviews }] = await Promise.all([
        client.from('releases').select('*', { count: 'exact', head: true }).eq('is_active', true),
        client.from('reviews').select('*', { count: 'exact', head: true }),
        user?.id ? client.from('reviews').select('release_id, total_score').eq('user_id', user.id) : Promise.resolve({ data: [] as { release_id: string | number; total_score: number }[] }),
      ]);
      const personalScores = new Map((personalReviews ?? []).map((row) => [String((row as Record<string, unknown>).release_id), Number((row as Record<string, unknown>).total_score ?? 0)]));
      setUserReviewsMap(Object.fromEntries(personalScores));

      setReleaseCount(liveReleaseCount ?? 0);
      setReviewCount(liveReviewCount ?? 0);
      if (error || !data) return;

      const normalized = data.map((row) => {
        const item = row as Record<string, unknown>;
        const score = Number(item.score ?? item.total_score ?? 0);
        const joinedReviews = Array.isArray(item.reviews) ? item.reviews[0] as Record<string, unknown> | undefined : item.reviews as Record<string, unknown> | undefined;
        const parsedId = typeof item.id === 'number' ? item.id : String(item.id ?? '');
        return {
          id: parsedId,
          title: String(item.title ?? ''),
          artist: String(item.artist ?? item.artist_name ?? ''),
          coverUrl: String(item.cover_url ?? item.coverUrl ?? ''),
          type: String(item.release_type ?? item.type ?? '') as Release['type'],
          release_type: item.release_type ? String(item.release_type) : undefined,
          year: Number(item.year ?? new Date().getFullYear()),
          score,
          valueTier: typeof item.value_tier === 'string' ? item.value_tier : undefined,
          score_community: item.score_community == null ? undefined : Number(item.score_community),
          community_score: item.community_score == null ? undefined : Number(item.community_score),
          score_critics: item.score_critics == null ? undefined : Number(item.score_critics),
          critics_score: item.critics_score == null ? undefined : Number(item.critics_score),
          reviewCount: Number(item.reviews_count ?? item.total_reviews_count ?? item.review_count ?? item.reviewCount ?? joinedReviews?.count ?? 0),
          reviews_count: Number(item.reviews_count ?? item.total_reviews_count ?? item.review_count ?? item.reviewCount ?? joinedReviews?.count ?? 0),
          total_reviews_count: Number(item.total_reviews_count ?? item.reviews_count ?? item.review_count ?? item.reviewCount ?? joinedReviews?.count ?? 0),
          reviews: Array.isArray(item.reviews) ? item.reviews : undefined,
          value_tier: typeof item.value_tier === 'string' ? item.value_tier : undefined,
          commentCount: Number(item.comment_count ?? item.commentCount ?? item.comments ?? 0),
          trackCount: Number(item.track_count ?? item.trackCount ?? 0),
          genre: String(item.genre ?? ''),
          season: item.season ? String(item.season) : undefined,
          scores: {
            community: Number(item.community_score ?? item.score_community ?? score - 2),
            critics: Number(item.critics_score ?? item.score_critics ?? score - 3),
            personal: Number(item.personal_score ?? score),
          },
          personalScore: personalScores.get(String(parsedId)) ?? (item.personal_score == null ? undefined : Number(item.personal_score)),
          is_new_name: item.is_new_name === true,
          is_freshman: item.is_freshman === true,
          youtube_url: item.youtube_url ? String(item.youtube_url) : undefined,
          streaming_url: item.streaming_url ? String(item.streaming_url) : undefined,
          audio_url: item.audio_url ? String(item.audio_url) : undefined,
        } satisfies Release;
      }).filter((release) => Boolean(release.id) && release.title && release.coverUrl);

      setReleaseCatalog(normalized);
    };

    void loadReleases();
  }, [refreshKey, user?.id]);

  useEffect(() => {
    if (selectedRelease) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedRelease]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client.channel('homepage-release-refresh').on('postgres_changes', { event: '*', schema: 'public', table: 'releases' }, () => handleRefresh()).on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => handleRefresh()).subscribe();
    return () => { void client.removeChannel(channel); };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  if (selectedRelease) {
    return (
      <div className="min-h-screen bg-[#0a0a0c]">
        <Navbar onOpenAuth={setAuthMode} onOpenAbout={() => setShowAbout(true)} onBrandClick={() => void startTransition(() => setSelectedRelease(null))} activeTab={activeTab} onTabChange={(tab) => void startTransition(() => setActiveTab(tab))} onAdminOpen={() => void startTransition(() => setAdminMode(true))} />
        {showAbout && <PlatformAboutModal onClose={() => setShowAbout(false)} />}
        <ReleaseDetail
          release={selectedRelease}
          onBack={() => { void startTransition(() => { setSelectedRelease(null); handleRefresh(); }); }}
          onOpenAuth={() => setAuthMode('login')}
          onReviewSubmitted={handleRefresh}
        />
        {authMode && (
          <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <Navbar onOpenAuth={setAuthMode} onOpenAbout={() => setShowAbout(true)} onBrandClick={() => void startTransition(() => setSelectedRelease(null))} activeTab={activeTab} onTabChange={(tab) => void startTransition(() => setActiveTab(tab))} onAdminOpen={() => void startTransition(() => setAdminMode(true))} />
      {showAbout && <PlatformAboutModal onClose={() => setShowAbout(false)} />}
      {adminMode && user?.role === 'admin' ? <AdminDashboard maintenance={maintenance} onMaintenanceChange={setMaintenance} onBack={() => setAdminMode(false)} onRefresh={handleRefresh} onReleaseCreated={handleRefresh} /> : null}

      {!adminMode && maintenance[activeTab].enabled && <MaintenancePlaceholder tabTitle={({ releases: 'რელიზები', top90: 'ტოპ-90', achievements: 'მიღწევები', concerts: 'კონცერტები' }[activeTab])} customMessage={maintenance[activeTab].message} />}
      {!adminMode && !maintenance[activeTab].enabled && activeTab === 'top90' && <Top90Leaderboard />}

      {!adminMode && !maintenance[activeTab].enabled && activeTab === 'achievements' && <Achievements />}

      {!adminMode && !maintenance[activeTab].enabled && activeTab === 'concerts' && (
        <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
          <ConcertsSection />
        </main>
      )}

      {!adminMode && !maintenance[activeTab].enabled && activeTab === 'releases' && (
        <>
          {/* Hero banner */}
          <section className="relative overflow-hidden border-b border-[#1e1e24]">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5" />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 50%, rgba(34,211,238,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(167,139,250,0.08) 0%, transparent 50%)',
              }}
            />
            <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
              <div className="flex flex-col items-start gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-xs font-medium text-cyan-300">ახალი სეზონი · 2026</span>
                </div>
                <div className="mb-5 max-w-2xl">
                  <div className="flex items-center gap-3 text-4xl font-black leading-none tracking-tight text-white sm:text-5xl md:text-6xl">
                    <span>STAGE</span>
                    <svg viewBox="0 0 160 80" role="img" aria-label="90 infinity mark" className="h-10 w-auto drop-shadow-[0_0_24px_rgba(123,61,255,0.45)] sm:h-14 md:h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs><linearGradient id="stageInfinityGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#00F2FE" /><stop offset="50%" stopColor="#7B3DFF" /><stop offset="100%" stopColor="#FF2ED1" /></linearGradient></defs>
                      <path d="M48 22 C 24 22, 12 30, 12 40 C 12 50, 24 58, 48 58 C 72 58, 88 22, 112 22 C 136 22, 148 30, 148 40 C 148 50, 136 58, 112 58 C 88 58, 72 22, 48 22 Z" stroke="url(#stageInfinityGrad)" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="mt-5 text-sm font-medium tracking-[0.35em] text-[#F5F5F7]/80 sm:text-base">ეს არის კავშირი</p>
                </div>
                <h1 className="hidden max-w-2xl text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
                  ქართული მუსიკის რეცენზიები და რეიტინგები —{' '}
                  <span className="text-glow-cyan text-cyan-400">სრულად თქვენთვის</span>
                </h1>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-gray-400 sm:text-base">არტისტები, ინფლუენსერები, მედია და მსმენელები. ადგილი, სადაც ხდება კონექტი: ვხედავთ, ვინ არის ტოპებში, ვის ირჩევს ხალხი და რას ამბობს ექსპერტული მედია ამ თამაშში.</p>
                <p className="hidden max-w-xl text-sm text-gray-400 sm:text-base">
                  აღმოაჩინეთ ახალი რელიზები, წაიკითხეთ კრიტიკოსთა რეცენზიები და შეაფასეთ თქვენი საყვარელი მუსიკოსების ნამუშევრები.
                </p>

                {/* Stats row */}
                <div className="mt-2 flex flex-wrap items-center gap-4 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm text-gray-300">
                      <span className="font-bold text-white">{releaseCount}</span> რელიზი
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-violet-400" />
                    <span className="text-sm text-gray-300">
                      <span className="font-bold text-white">{reviewCount}</span> რეცენზია
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm text-gray-300">
                      <span className="font-bold text-white">90</span> ტოპ რეიტინგი
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Main content */}
          <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
            <Top15Daily releases={releaseCatalog} onReleaseClick={openRelease} userReviewsMap={userReviewsMap} />

            <AuthorsPicks releases={releaseCatalog} onReleaseClick={openRelease} />

            <AuthorComments key={`author-comments-${refreshKey}`} releases={releaseCatalog} onReleaseClick={openRelease} />

            {/* Section 1: Top daily releases */}
            <TopCarousel releases={topCatalog} onReleaseClick={openRelease} userReviewsMap={userReviewsMap} />

            {/* Section 2: Latest releases */}
            <section className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-400/10">
                    <TrendingUp className="h-4 w-4 text-violet-400" />
                  </span>
                  <h2 className="text-xl font-bold text-white sm:text-2xl">დამატებული რელიზები</h2>
                </div>
                <button className="text-sm font-medium text-gray-500 transition-colors hover:text-violet-400">
                  ყველას ნახვა →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {latestCatalog.map((release) => (
                  <ReleaseCard key={release.id} release={release} onClick={openRelease} userReviewsMap={userReviewsMap} />
                ))}
              </div>
            </section>

            <MediaReviews key={`media-reviews-${refreshKey}`} releases={releaseCatalog} onReleaseClick={openRelease} />

            <RecentReviewsFeed key={`recent-reviews-${refreshKey}`} releases={releaseCatalog} onReleaseClick={openRelease} />

            <NewNamesSection releases={releaseCatalog} onReleaseClick={openRelease} />
          </main>
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-[#1e1e24]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="hidden text-xs text-gray-600">
              © 2026 რზტ — რისა ზა თვორჩესტვო. ყველა უფლება დაცულია.
            </p>
            <p className="text-xs text-gray-600">© 2026 Stage 90. ეს არის კავშირი. ყველა უფლება დაცულია.</p>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <button className="transition-colors hover:text-gray-400">წესები</button>
              <button className="transition-colors hover:text-gray-400">კონტაქტი</button>
              <button className="transition-colors hover:text-gray-400">კონფიდენციალობა</button>
            </div>
          </div>
        </div>
      </footer>

      {authMode && (
        <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} />
      )}
    </div>
  );
}

export default function App() {
  return <LoadingProvider><AuthProvider><AppContent /></AuthProvider><PageLoader /></LoadingProvider>;
}
