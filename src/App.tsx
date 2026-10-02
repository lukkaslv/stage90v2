import { lazy, Suspense, useRef, useState, useEffect, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, TrendingUp, Clock, Award } from 'lucide-react';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import TopCarousel from '@/components/TopCarousel';
import ReleaseCard from '@/components/ReleaseCard';
import MediaReviews from '@/components/MediaReviews';
import RecentReviewsFeed from '@/components/RecentReviewsFeed';
import Top15Daily from '@/components/Top15Daily';
import AuthorsPicks from '@/components/AuthorsPicks';
import AuthorComments from '@/components/AuthorComments';
import NewNamesSection from '@/components/NewNamesSection';
import SectionLoader from '@/components/SectionLoader';
import SectionPage from '@/components/SectionPage';
import { sectionPaths, type SectionId } from '@/lib/sectionRoutes';
import ReviewDetail from '@/components/ReviewDetail';
import { useReleaseCatalog } from '@/hooks/useReleaseCatalog';
import type { Release, PageId } from '@/types/music';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { LoadingProvider, usePageLoading } from '@/context/LoadingContext';
import PageLoader from '@/components/PageLoader';
import MaintenancePlaceholder from '@/components/MaintenancePlaceholder';
import { maintenanceMapFromRows, type MaintenanceMap, type MaintenanceRecord } from '@/lib/maintenance';

type AuthMode = 'login' | 'register';

const ReleaseDetail = lazy(() => import('@/components/ReleaseDetail'));
const AuthModal = lazy(() => import('@/components/AuthModal'));
const Top90Leaderboard = lazy(() => import('@/components/Top90Leaderboard'));
const Achievements = lazy(() => import('@/components/Achievements'));
const ConcertsSection = lazy(() => import('@/components/ConcertsSection'));
const AdminDashboard = lazy(() => import('@/components/AdminDashboard'));
const PlatformAboutModal = lazy(() => import('@/components/PlatformAboutModal'));

function pathState() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const section = (Object.entries(sectionPaths).find(([, value]) => value === path)?.[0] ?? null) as SectionId | null;
  const release = path.match(/^\/releases\/([^/]+)$/);
  const review = path.match(/^\/reviews\/([^/]+)$/);
  const tab = path === '/top-90' ? 'top90' : path === '/achievements' ? 'achievements' : path === '/concerts' ? 'concerts' : 'releases';
  return { section, release: release ? decodeURIComponent(release[1]) : null, review: review ? decodeURIComponent(review[1]) : null, tab: tab as PageId };
}

const tabPaths: Record<PageId, string> = { releases: '/', top90: '/top-90', achievements: '/achievements', concerts: '/concerts' };

function AppContent() {
  const { user } = useAuth();
  const { startTransition } = usePageLoading();
  const [selectedRelease, setSelectedRelease] = useState<Release | string | null>(() => pathState().release);
  const [selectedReview, setSelectedReview] = useState<string | null>(() => pathState().review);
  const [section, setSection] = useState<SectionId | null>(() => pathState().section);
  const [releaseHistory, setReleaseHistory] = useState<Array<Release | string>>([]);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState<PageId>(() => pathState().tab);
  const [adminMode, setAdminMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { releases: releaseCatalog, releaseById, latestReleases, topReleases, newNames, releaseCount, reviewCount, userReviewsMap, reviewVersion, commentVersion, onReviewSubmitted } = useReleaseCatalog(user?.id, refreshKey);
  const [maintenanceMap, setMaintenanceMap] = useState<MaintenanceMap>({});
  const addedReleasesScrollRef = useRef<HTMLDivElement>(null);
  const addedReleasesDraggingRef = useRef(false);
  const addedReleasesDragStartRef = useRef({ x: 0, scrollLeft: 0 });
  const topCatalog = topReleases;
  const latestCatalog = latestReleases;
  const navigate = (path: string) => {
    if (window.location.pathname !== path) window.history.pushState({ stage90: true }, '', path);
    const next = pathState();
    setSelectedRelease(next.release);
    setSelectedReview(next.review);
    setSection(next.section);
    setActiveTab(next.tab);
    setAdminMode(false);
  };
  const openRelease = (nextRelease: Release | string) => { void startTransition(() => { setReleaseHistory([]); navigate(`/releases/${encodeURIComponent(String(typeof nextRelease === 'string' ? nextRelease : nextRelease.id))}`); setSelectedRelease(nextRelease); }); };
  const openTrackRelease = (nextRelease: Release) => { void startTransition(() => { if (selectedRelease) setReleaseHistory((history) => [...history, selectedRelease]); navigate(`/releases/${encodeURIComponent(String(nextRelease.id))}`); setSelectedRelease(nextRelease); }); };
  const returnFromRelease = () => { if (window.history.state?.stage90) window.history.back(); else navigate('/'); };
  const openReview = (id: string) => { void startTransition(() => navigate(`/reviews/${encodeURIComponent(id)}`)); };
  const openSection = (next: SectionId) => { void startTransition(() => navigate(sectionPaths[next])); };
  const handleTabChange = (tab: PageId) => {
    void startTransition(() => {
      setReleaseHistory([]);
      navigate(tabPaths[tab]);
    });
  };
  const handleAdminOpen = () => {
    void startTransition(() => {
      setSelectedRelease(null);
      setReleaseHistory([]);
      setAdminMode(true);
    });
  };
  const handleRefresh = () => setRefreshKey((key) => key + 1);
  const startAddedReleasesDrag = (event: MouseEvent<HTMLDivElement>) => {
    const container = addedReleasesScrollRef.current;
    if (!container) return;
    addedReleasesDraggingRef.current = true;
    addedReleasesDragStartRef.current = { x: event.clientX, scrollLeft: container.scrollLeft };
  };
  const moveAddedReleasesDrag = (event: MouseEvent<HTMLDivElement>) => {
    if (!addedReleasesDraggingRef.current || !addedReleasesScrollRef.current) return;
    event.preventDefault();
    addedReleasesScrollRef.current.scrollLeft = addedReleasesDragStartRef.current.scrollLeft - (event.clientX - addedReleasesDragStartRef.current.x);
  };
  const stopAddedReleasesDrag = () => { addedReleasesDraggingRef.current = false; };
  const moveAddedReleases = (distance: number) => { addedReleasesScrollRef.current?.scrollBy({ left: distance, behavior: 'smooth' }); };

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    const realtimeUpdatedTabs = new Set<string>();
    const channel = client
      .channel('platform_settings_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, (payload) => {
        const updated = payload.new as Partial<MaintenanceRecord>;
        if (updated?.tab_key) {
          realtimeUpdatedTabs.add(updated.tab_key);
          const row = maintenanceMapFromRows([updated])[updated.tab_key];
          if (row) setMaintenanceMap((previous) => ({ ...previous, [row.tab_key]: row }));
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { tab_key?: string };
          if (deleted?.tab_key) {
            realtimeUpdatedTabs.add(deleted.tab_key);
            setMaintenanceMap((previous) => {
              const next = { ...previous };
              delete next[deleted.tab_key!];
              return next;
            });
          }
        }
      })
      .subscribe();

    const loadMaintenance = async () => {
      const { data, error } = await client.from('platform_settings').select('*');
      if (cancelled || error || !data) return;
      const loaded = maintenanceMapFromRows(data);
      setMaintenanceMap((previous) => {
        const next = { ...loaded };
        realtimeUpdatedTabs.forEach((key) => {
          if (previous[key]) next[key] = previous[key];
          else delete next[key];
        });
        return next;
      });
    };
    void loadMaintenance();
    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const onPop = () => {
      const next = pathState();
      setSelectedRelease(next.release);
      setSelectedReview(next.review);
      setSection(next.section);
      setActiveTab(next.tab);
      setAdminMode(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab, selectedRelease, selectedReview, section, adminMode]);

  if (selectedRelease) {
    return (
      <div className="min-h-screen bg-[#0a0a0c]">
        <Navbar onOpenAuth={setAuthMode} onOpenAbout={() => setShowAbout(true)} onBrandClick={() => handleTabChange('releases')} activeTab={activeTab} onTabChange={handleTabChange} onAdminOpen={handleAdminOpen} />
        {showAbout && <Suspense fallback={<SectionLoader onClose={() => setShowAbout(false)} />}><PlatformAboutModal onClose={() => setShowAbout(false)} /></Suspense>}
        {maintenanceMap.releases?.is_maintenance
          ? <MaintenancePlaceholder tabTitle={maintenanceMap.releases.tab_title} customMessage={maintenanceMap.releases.message_geo} />
          : <Suspense fallback={<SectionLoader />}><ReleaseDetail
            key={typeof selectedRelease === 'string' ? selectedRelease : String(selectedRelease.id)}
            release={selectedRelease}
            onBack={returnFromRelease}
            onOpenRelease={openTrackRelease}
            backToRelease={releaseHistory.length > 0}
            onOpenAuth={() => setAuthMode('login')}
            onReviewSubmitted={onReviewSubmitted}
          /></Suspense>}
        {authMode && (
          <Suspense fallback={<SectionLoader onClose={() => setAuthMode(null)} />}><AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} /></Suspense>
        )}
      </div>
    );
  }

  if (selectedReview) {
    return <div className="min-h-screen bg-[#0a0a0c]">
      <Navbar onOpenAuth={setAuthMode} onOpenAbout={() => setShowAbout(true)} onBrandClick={() => handleTabChange('releases')} activeTab={activeTab} onTabChange={handleTabChange} onAdminOpen={handleAdminOpen} />
      <ReviewDetail id={selectedReview} onReleaseClick={openRelease} onBack={returnFromRelease} />
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <Navbar onOpenAuth={setAuthMode} onOpenAbout={() => setShowAbout(true)} onBrandClick={() => handleTabChange('releases')} activeTab={activeTab} onTabChange={handleTabChange} onAdminOpen={handleAdminOpen} />
      {showAbout && <Suspense fallback={<SectionLoader onClose={() => setShowAbout(false)} />}><PlatformAboutModal onClose={() => setShowAbout(false)} /></Suspense>}
      {adminMode && user?.role === 'admin' ? <Suspense fallback={<SectionLoader />}><AdminDashboard maintenance={maintenanceMap} onMaintenanceChange={setMaintenanceMap} onBack={() => setAdminMode(false)} onRefresh={handleRefresh} onReleaseCreated={handleRefresh} /></Suspense> : null}

      {!adminMode && maintenanceMap[activeTab]?.is_maintenance && <MaintenancePlaceholder tabTitle={maintenanceMap[activeTab].tab_title} customMessage={maintenanceMap[activeTab].message_geo} />}
      {!adminMode && section && !maintenanceMap.releases?.is_maintenance && <SectionPage key={section} section={section} onReleaseClick={openRelease} onReviewClick={openReview} />}
      {!adminMode && !maintenanceMap[activeTab]?.is_maintenance && activeTab === 'top90' && <Suspense fallback={<SectionLoader />}><Top90Leaderboard /></Suspense>}

      {!adminMode && !maintenanceMap[activeTab]?.is_maintenance && activeTab === 'achievements' && <Suspense fallback={<SectionLoader />}><Achievements /></Suspense>}

      {!adminMode && !maintenanceMap[activeTab]?.is_maintenance && activeTab === 'concerts' && (
        <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
          <Suspense fallback={<SectionLoader />}><ConcertsSection /></Suspense>
        </main>
      )}

      {!adminMode && !section && !maintenanceMap[activeTab]?.is_maintenance && activeTab === 'releases' && (
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
                  <div className="text-4xl font-semibold leading-none tracking-[0.12em] text-white sm:text-5xl md:text-6xl">
                    #STAGE90
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
            <Top15Daily onReleaseClick={openRelease} />

            <button type="button" onClick={() => openSection('author-picks')} className="block w-full text-right text-sm font-semibold text-cyan-300">ყველას ნახვა →</button>
            <AuthorsPicks releaseById={releaseById} onReleaseClick={openRelease} preview />

            <button type="button" onClick={() => openSection('author-comments')} className="block w-full text-right text-sm font-semibold text-cyan-300">ყველას ნახვა →</button>
            <AuthorComments refreshVersion={refreshKey + reviewVersion + commentVersion} releaseById={releaseById} onReleaseClick={openRelease} preview />

            {/* Section 1: Top daily releases */}
            <button type="button" onClick={() => handleTabChange('top90')} className="block w-full text-right text-sm font-semibold text-cyan-300">ყველას ნახვა →</button>
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
                <button type="button" onClick={() => openSection('all-releases')} className="text-sm font-semibold text-cyan-300">ყველას ნახვა →</button>
              </div>
              <div className="group relative">
                <button type="button" onClick={() => moveAddedReleases(-530)} aria-label="წინა რელიზები" className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-[#0a0a0c]/90 p-2 text-white shadow-xl transition hover:border-cyan-300/60 hover:text-cyan-300 md:block"><ChevronLeft className="h-5 w-5" /></button>
                <div ref={addedReleasesScrollRef} onMouseDown={startAddedReleasesDrag} onMouseMove={moveAddedReleasesDrag} onMouseUp={stopAddedReleasesDrag} onMouseLeave={stopAddedReleasesDrag} onWheel={(event) => { if (event.deltaY !== 0) event.currentTarget.scrollLeft += event.deltaY; }} className="flex cursor-grab items-stretch gap-4 overflow-x-auto overflow-y-hidden scroll-smooth scrollbar-none py-2 px-1 select-none active:cursor-grabbing" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {latestCatalog.slice(0, 6).map((release) => (
                  <div key={release.id} className="w-[220px] shrink-0 flex flex-col sm:w-[240px] md:w-[250px]">
                    <ReleaseCard release={release} onClick={openRelease} userReviewsMap={userReviewsMap} />
                  </div>
                ))}
                </div>
                <button type="button" onClick={() => moveAddedReleases(530)} aria-label="შემდეგი რელიზები" className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-[#0a0a0c]/90 p-2 text-white shadow-xl transition hover:border-cyan-300/60 hover:text-cyan-300 md:block"><ChevronRight className="h-5 w-5" /></button>
              </div>
            </section>

            <button type="button" onClick={() => openSection('media-reviews')} className="block w-full text-right text-sm font-semibold text-cyan-300">ყველას ნახვა →</button>
            <MediaReviews refreshVersion={refreshKey + reviewVersion} releaseById={releaseById} onReviewClick={openReview} />

            <button type="button" onClick={() => openSection('reviews')} className="block w-full text-right text-sm font-semibold text-cyan-300">ყველას ნახვა →</button>
            <RecentReviewsFeed releaseById={releaseById} releases={releaseCatalog} onReleaseClick={openRelease} onReviewClick={openReview} />

            <NewNamesSection releases={newNames} onReleaseClick={openRelease} onViewAll={() => openSection('new-names')} />
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
            <p className="text-xs text-gray-600">© 2026 #STAGE90. ეს არის კავშირი. ყველა უფლება დაცულია.</p>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <button className="transition-colors hover:text-gray-400">წესები</button>
              <button className="transition-colors hover:text-gray-400">კონტაქტი</button>
              <button className="transition-colors hover:text-gray-400">კონფიდენციალობა</button>
            </div>
          </div>
        </div>
      </footer>

      {authMode && (
        <Suspense fallback={<SectionLoader onClose={() => setAuthMode(null)} />}><AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} /></Suspense>
      )}
    </div>
  );
}

export default function App() {
  return <LoadingProvider><AuthProvider><AppContent /></AuthProvider><PageLoader /></LoadingProvider>;
}
