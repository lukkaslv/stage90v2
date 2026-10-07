import { lazy, Suspense, useRef, useState, useEffect, type MouseEvent } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, TrendingUp, Clock, Award } from 'lucide-react';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import TopCarousel from '@/components/TopCarousel';
import ReleaseCard from '@/components/ReleaseCard';
import MediaReviews from '@/components/MediaReviews';
import RecentReviewsFeed from '@/components/RecentReviewsFeed';
import Top15AllTime from '@/components/Top15AllTime';
import TopArtists from '@/components/TopArtists';
import AuthorsPicks from '@/components/AuthorsPicks';
import AuthorComments from '@/components/AuthorComments';
import NewNamesSection from '@/components/NewNamesSection';
import SectionLoader from '@/components/SectionLoader';
import SectionPage from '@/components/SectionPage';
import { sectionPaths, type SectionId } from '@/lib/sectionRoutes';
import ReviewDetail from '@/components/ReviewDetail';
import TopReleasesPage from '@/components/TopReleasesPage';
import { useReleaseCatalog } from '@/hooks/useReleaseCatalog';
import type { Release, PageId } from '@/types/music';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { LoadingProvider, usePageLoading } from '@/context/LoadingContext';
import PageLoader from '@/components/PageLoader';
import MaintenancePlaceholder from '@/components/MaintenancePlaceholder';
import PageHeading from '@/components/PageHeading';
import SiteFooter from '@/components/SiteFooter';
import { maintenanceMapFromRows, type MaintenanceMap, type MaintenanceRecord } from '@/lib/maintenance';

type AuthMode = 'login' | 'register' | 'invite';

const ReleaseDetail = lazy(() => import('@/components/ReleaseDetail'));
const AuthModal = lazy(() => import('@/components/AuthModal'));
const Top90Leaderboard = lazy(() => import('@/components/Top90Leaderboard'));
const Achievements = lazy(() => import('@/components/Achievements'));
const ConcertsSection = lazy(() => import('@/components/ConcertsSection'));
const AdminDashboard = lazy(() => import('@/components/AdminDashboard'));
const PlatformAboutModal = lazy(() => import('@/components/PlatformAboutModal'));
const FAQPage = lazy(() => import('@/components/FAQPage'));
const ReactionOutput = lazy(() => import('@/components/ReactionOutput'));
const ArtistProfile = lazy(() => import('@/components/ArtistProfile'));

function pathState() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const section = (Object.entries(sectionPaths).find(([, value]) => value === path)?.[0] ?? null) as SectionId | null;
  const release = path.match(/^\/releases\/([^/]+)$/);
  const review = path.match(/^\/reviews\/([^/]+)$/);
  const artist = path.match(/^\/artists\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  const tab = path === '/artists' || artist ? 'artists' : path === '/top-90' ? 'top90' : path === '/achievements' ? 'achievements' : path === '/concerts' ? 'concerts' : path === '/faq' ? 'faq' : 'releases';
  const known = path === '/' || Boolean(section || release || review || artist) || Object.values(tabPaths).includes(path);
  return { section, release: release ? decodeURIComponent(release[1]) : null, review: review ? decodeURIComponent(review[1]) : null, artist: artist?.[1] ?? null, tab: tab as PageId, unknown: !known };
}

const tabPaths: Record<PageId, string> = { releases: '/', artists: '/artists', top90: '/top-90', achievements: '/achievements', concerts: '/concerts', faq: '/faq' };

function AppContent() {
  const { user } = useAuth();
  const { startTransition } = usePageLoading();
  const [selectedRelease, setSelectedRelease] = useState<Release | string | null>(() => pathState().release);
  const [selectedReview, setSelectedReview] = useState<string | null>(() => pathState().review);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(() => pathState().artist);
  const [section, setSection] = useState<SectionId | null>(() => pathState().section);
  const [releaseHistory, setReleaseHistory] = useState<Array<Release | string>>([]);
  const [authMode, setAuthMode] = useState<AuthMode | null>(() => new URLSearchParams(window.location.search).has('stage90_invite') ? 'invite' : null);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState<PageId>(() => pathState().tab);
  const [unknownPath, setUnknownPath] = useState(() => pathState().unknown);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('stage90-sidebar-collapsed') === 'true');
  const [adminMode, setAdminMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { releases: releaseCatalog, releaseById, latestReleases, topReleases, newNames, releaseCount, reviewCount, userReviewsMap, reviewVersion, commentVersion, onReviewSubmitted } = useReleaseCatalog(user?.id, refreshKey);
  const [maintenanceMap, setMaintenanceMap] = useState<MaintenanceMap>({});
  const addedReleasesScrollRef = useRef<HTMLDivElement>(null);
  const addedReleasesDraggingRef = useRef(false);
  const addedReleasesDragStartRef = useRef({ x: 0, scrollLeft: 0 });
  const topCatalog = topReleases;
  const latestCatalog = latestReleases;
  const homeSectionVisible = (id: SectionId | 'home-hero') => !maintenanceMap[id]?.is_maintenance;
  const navigate = (path: string) => {
    if (window.location.pathname !== path) window.history.pushState({ stage90: true }, '', path);
    const next = pathState();
    setSelectedRelease(next.release);
    setSelectedReview(next.review);
    setSelectedArtist(next.artist);
    setSection(next.section);
    setActiveTab(next.tab);
    setUnknownPath(next.unknown);
    setAdminMode(false);
  };
  const openRelease = (nextRelease: Release | string) => { void startTransition(() => { setReleaseHistory([]); navigate(`/releases/${encodeURIComponent(String(typeof nextRelease === 'string' ? nextRelease : nextRelease.id))}`); setSelectedRelease(nextRelease); }); };
  const openTrackRelease = (nextRelease: Release) => { void startTransition(() => { if (selectedRelease) setReleaseHistory((history) => [...history, selectedRelease]); navigate(`/releases/${encodeURIComponent(String(nextRelease.id))}`); setSelectedRelease(nextRelease); }); };
  const returnFromRelease = () => { if (window.history.state?.stage90) window.history.back(); else navigate('/'); };
  const openReview = (id: string) => { void startTransition(() => navigate(`/reviews/${encodeURIComponent(id)}`)); };
  const openArtist = (id: string) => { void startTransition(() => navigate(`/artists/${encodeURIComponent(id)}`)); };
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
      setSelectedReview(null);
      setSelectedArtist(null);
      setReleaseHistory([]);
      setAdminMode(true);
    });
  };
  const handleRefresh = () => setRefreshKey((key) => key + 1);
  const toggleSidebar = () => setSidebarCollapsed((collapsed) => {
    window.localStorage.setItem('stage90-sidebar-collapsed', String(!collapsed));
    return !collapsed;
  });
  const contentClass = `min-w-0 min-h-screen pt-16 transition-[margin-left] duration-300 ease-out lg:pt-0 ${sidebarCollapsed ? 'lg:ml-[76px]' : 'lg:ml-72'}`;
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
      setSelectedArtist(next.artist);
      setSection(next.section);
      setActiveTab(next.tab);
      setUnknownPath(next.unknown);
      setAdminMode(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab, selectedRelease, selectedReview, selectedArtist, section, adminMode]);

  if (selectedRelease) {
    return (
      <div className="min-h-screen bg-[#0a0a0c]">
        <Navbar onOpenAuth={setAuthMode} onOpenAbout={() => setShowAbout(true)} onBrandClick={() => handleTabChange('releases')} activeTab={activeTab} onTabChange={handleTabChange} onOpenRelease={openRelease} onAdminOpen={handleAdminOpen} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
        <div className={contentClass}>
        {showAbout && <Suspense fallback={<SectionLoader onClose={() => setShowAbout(false)} />}><PlatformAboutModal onClose={() => setShowAbout(false)} /></Suspense>}
        {maintenanceMap.releases?.is_maintenance
          ? <MaintenancePlaceholder tabTitle={maintenanceMap.releases.tab_title} customMessage={maintenanceMap.releases.message_geo} />
          : <Suspense fallback={<SectionLoader />}><ReleaseDetail
            key={typeof selectedRelease === 'string' ? selectedRelease : String(selectedRelease.id)}
            release={selectedRelease}
            onBack={returnFromRelease}
            onOpenRelease={openTrackRelease}
            onOpenReview={openReview}
            onOpenArtist={openArtist}
            backToRelease={releaseHistory.length > 0}
            onOpenAuth={() => setAuthMode('login')}
            onReviewSubmitted={onReviewSubmitted}
          /></Suspense>}
        <SiteFooter onFaq={() => handleTabChange('faq')} onAbout={() => setShowAbout(true)} />
        {authMode && (
          <Suspense fallback={<SectionLoader onClose={() => setAuthMode(null)} />}><AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} /></Suspense>
        )}
        </div>
      </div>
    );
  }

  if (selectedArtist) {
    return <div className="min-h-screen bg-[#0a0a0c]">
      <Navbar onOpenAuth={setAuthMode} onOpenAbout={() => setShowAbout(true)} onBrandClick={() => handleTabChange('releases')} activeTab="artists" onTabChange={handleTabChange} onOpenRelease={openRelease} onAdminOpen={handleAdminOpen} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
      <div className={contentClass}>
        {showAbout && <Suspense fallback={<SectionLoader onClose={() => setShowAbout(false)} />}><PlatformAboutModal onClose={() => setShowAbout(false)} /></Suspense>}
        {maintenanceMap.artists?.is_maintenance
          ? <MaintenancePlaceholder tabTitle={maintenanceMap.artists.tab_title} customMessage={maintenanceMap.artists.message_geo} />
          : <Suspense fallback={<SectionLoader />}><ArtistProfile key={selectedArtist} id={selectedArtist} onBack={() => handleTabChange('artists')} onReleaseClick={openRelease} /></Suspense>}
        <SiteFooter onFaq={() => handleTabChange('faq')} onAbout={() => setShowAbout(true)} />
        {authMode && <Suspense fallback={<SectionLoader onClose={() => setAuthMode(null)} />}><AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} /></Suspense>}
      </div>
    </div>;
  }

  if (selectedReview) {
    return <div className="min-h-screen bg-[#0a0a0c]">
      <Navbar onOpenAuth={setAuthMode} onOpenAbout={() => setShowAbout(true)} onBrandClick={() => handleTabChange('releases')} activeTab={activeTab} onTabChange={handleTabChange} onOpenRelease={openRelease} onAdminOpen={handleAdminOpen} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
      <div className={contentClass}>
      {showAbout && <Suspense fallback={<SectionLoader onClose={() => setShowAbout(false)} />}><PlatformAboutModal onClose={() => setShowAbout(false)} /></Suspense>}
      <ReviewDetail id={selectedReview} onReleaseClick={openRelease} onBack={returnFromRelease} />
      <SiteFooter onFaq={() => handleTabChange('faq')} onAbout={() => setShowAbout(true)} />
      {authMode && <Suspense fallback={<SectionLoader onClose={() => setAuthMode(null)} />}><AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} /></Suspense>}
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <Navbar onOpenAuth={setAuthMode} onOpenAbout={() => setShowAbout(true)} onBrandClick={() => handleTabChange('releases')} activeTab={activeTab} section={section} unknownPath={unknownPath} onTabChange={handleTabChange} onOpenRelease={openRelease} onAdminOpen={handleAdminOpen} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
      <div className={contentClass}>
      {showAbout && <Suspense fallback={<SectionLoader onClose={() => setShowAbout(false)} />}><PlatformAboutModal onClose={() => setShowAbout(false)} /></Suspense>}
      {adminMode && user?.role === 'admin' ? <Suspense fallback={<SectionLoader />}><AdminDashboard maintenance={maintenanceMap} onMaintenanceChange={setMaintenanceMap} onBack={() => { setAdminMode(false); navigate(tabPaths[activeTab]); }} onRefresh={handleRefresh} onReleaseCreated={handleRefresh} onArtistClick={openArtist} /></Suspense> : null}

      {!adminMode && unknownPath && <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><PageHeading title="გვერდი ვერ მოიძებნა" description="მითითებულ მისამართზე გვერდი არ არსებობს." /><button type="button" onClick={() => handleTabChange('releases')} className="stage-outline-action">მთავარ გვერდზე დაბრუნება →</button></main>}
      {!adminMode && !unknownPath && maintenanceMap[activeTab]?.is_maintenance && <MaintenancePlaceholder tabTitle={maintenanceMap[activeTab].tab_title} customMessage={maintenanceMap[activeTab].message_geo} />}
      {!adminMode && !unknownPath && section && !maintenanceMap.releases?.is_maintenance && maintenanceMap[section]?.is_maintenance && <MaintenancePlaceholder tabTitle={maintenanceMap[section].tab_title} customMessage={maintenanceMap[section].message_geo} />}
      {!adminMode && !unknownPath && section && !maintenanceMap.releases?.is_maintenance && !maintenanceMap[section]?.is_maintenance && (section === 'top-releases'
        ? <TopReleasesPage onReleaseClick={openRelease} />
        : section === 'score-top-15'
          ? <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><PageHeading title="ტოპ-15 ქულებით" /><Top15AllTime onReleaseClick={openRelease} /></main>
          : <SectionPage key={section} section={section} onReleaseClick={openRelease} onReviewClick={openReview} />)}
      {!adminMode && !maintenanceMap[activeTab]?.is_maintenance && activeTab === 'top90' && <Suspense fallback={<SectionLoader />}><Top90Leaderboard /></Suspense>}
      {!adminMode && !maintenanceMap.artists?.is_maintenance && activeTab === 'artists' && <TopArtists onArtistClick={openArtist} />}

      {!adminMode && !maintenanceMap[activeTab]?.is_maintenance && activeTab === 'achievements' && <Suspense fallback={<SectionLoader />}><Achievements /></Suspense>}

      {!adminMode && !maintenanceMap[activeTab]?.is_maintenance && activeTab === 'concerts' && (
        <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
          <PageHeading title="კონცერტები, ტურები და ფესტივალები" />
          <Suspense fallback={<SectionLoader />}><ConcertsSection /></Suspense>
        </main>
      )}

      {!adminMode && !maintenanceMap[activeTab]?.is_maintenance && activeTab === 'faq' && <Suspense fallback={<SectionLoader />}><FAQPage /></Suspense>}

      {!adminMode && !unknownPath && !section && !maintenanceMap[activeTab]?.is_maintenance && activeTab === 'releases' && (
        <>
          {homeSectionVisible('home-hero') && <section className="stage-hero" aria-labelledby="stage-hero-title">
            <div className="stage-hero-photo" aria-hidden="true" />
            <div className="stage-hero-inner mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <p className="stage-eyebrow"><span className="stage-live-dot" /> ქართული მუსიკის სცენა</p>
              <h1 id="stage-hero-title">მუსიკა,<br /><span>რომელიც გვაერთიანებს.</span></h1>
              <p className="stage-hero-copy">აღმოაჩინე ახალი რელიზები, მოუსმინე არტისტებს და წაიკითხე გულწრფელი რეცენზიები. შენი ხმა სცენის ნაწილია.</p>
              <div className="stage-hero-actions">
                <button type="button" onClick={() => openSection('all-releases')} className="stage-primary-action">აღმოაჩინე რელიზები <ArrowUpRight className="h-4 w-4" /></button>
                <button type="button" onClick={() => handleTabChange('top90')} className="stage-secondary-action">ნახე ტოპ-90 <ArrowUpRight className="h-4 w-4" /></button>
              </div>
              <div className="stage-hero-stats" aria-label="პლატფორმის მონაცემები">
                <div><TrendingUp aria-hidden="true" /><strong>{releaseCount}</strong><span>რელიზი</span></div>
                <div><Clock aria-hidden="true" /><strong>{reviewCount}</strong><span>რეცენზია</span></div>
                <div><Award aria-hidden="true" /><strong>90</strong><span>ქულიანი სისტემა</span></div>
              </div>
            </div>
          </section>}

          {/* Main content */}
          <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
            {homeSectionVisible('score-top-15') && <div className="space-y-2">
              <button type="button" onClick={() => openSection('score-top-15')} className="block w-full text-right text-sm font-semibold text-blue-300">ყველას ნახვა →</button>
              <Top15AllTime onReleaseClick={openRelease} preview />
            </div>}

            {!maintenanceMap.artists?.is_maintenance && <div className="space-y-2">
              <button type="button" onClick={() => handleTabChange('artists')} className="block w-full text-right text-sm font-semibold text-blue-300">ყველა არტისტის ნახვა →</button>
              <TopArtists onArtistClick={openArtist} preview />
            </div>}

            {homeSectionVisible('author-picks') && <div className="space-y-2">
              <button type="button" onClick={() => openSection('author-picks')} className="block w-full text-right text-sm font-semibold text-blue-300">ყველას ნახვა →</button>
              <AuthorsPicks onReviewClick={openReview} preview />
            </div>}

            {homeSectionVisible('author-comments') && <div className="space-y-2">
              <button type="button" onClick={() => openSection('author-comments')} className="block w-full text-right text-sm font-semibold text-blue-300">ყველას ნახვა →</button>
              <AuthorComments refreshVersion={refreshKey + reviewVersion + commentVersion} releaseById={releaseById} onReleaseClick={openRelease} preview />
            </div>}

            {/* Section 1: Top daily releases */}
            {homeSectionVisible('top-releases') && <div className="space-y-2">
              <button type="button" onClick={() => openSection('top-releases')} className="block w-full text-right text-sm font-semibold text-blue-300">ყველას ნახვა →</button>
              <TopCarousel releases={topCatalog} onReleaseClick={openRelease} userReviewsMap={userReviewsMap} />
            </div>}

            {/* Section 2: Latest releases */}
            {homeSectionVisible('all-releases') && <section className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-pink-400/10">
                    <TrendingUp className="h-4 w-4 text-pink-400" />
                  </span>
                  <h2 className="text-xl font-bold text-white sm:text-2xl">დამატებული რელიზები</h2>
                </div>
                <button type="button" onClick={() => openSection('all-releases')} className="text-sm font-semibold text-blue-300">ყველას ნახვა →</button>
              </div>
              <div className="group relative">
                <button type="button" onClick={() => moveAddedReleases(-530)} aria-label="წინა რელიზები" className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-[#0a0a0c]/90 p-2 text-white shadow-xl transition hover:border-blue-300/60 hover:text-blue-300 md:block"><ChevronLeft className="h-5 w-5" /></button>
                <div ref={addedReleasesScrollRef} onMouseDown={startAddedReleasesDrag} onMouseMove={moveAddedReleasesDrag} onMouseUp={stopAddedReleasesDrag} onMouseLeave={stopAddedReleasesDrag} onWheel={(event) => { if (event.deltaY !== 0) event.currentTarget.scrollLeft += event.deltaY; }} className="flex cursor-grab items-stretch gap-4 overflow-x-auto overflow-y-hidden scroll-smooth scrollbar-none py-2 px-1 select-none active:cursor-grabbing" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {latestCatalog.slice(0, 6).map((release) => (
                  <div key={release.id} className="w-[220px] shrink-0 flex flex-col sm:w-[240px] md:w-[250px]">
                    <ReleaseCard release={release} onClick={openRelease} userReviewsMap={userReviewsMap} />
                  </div>
                ))}
                </div>
                <button type="button" onClick={() => moveAddedReleases(530)} aria-label="შემდეგი რელიზები" className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-[#0a0a0c]/90 p-2 text-white shadow-xl transition hover:border-blue-300/60 hover:text-blue-300 md:block"><ChevronRight className="h-5 w-5" /></button>
              </div>
            </section>}

            {homeSectionVisible('media-reviews') && <div className="space-y-2">
              <button type="button" onClick={() => openSection('media-reviews')} className="block w-full text-right text-sm font-semibold text-blue-300">ყველას ნახვა →</button>
              <MediaReviews refreshVersion={refreshKey + reviewVersion} releaseById={releaseById} onReviewClick={openReview} />
            </div>}

            {homeSectionVisible('reviews') && <div className="space-y-2">
              <button type="button" onClick={() => openSection('reviews')} className="block w-full text-right text-sm font-semibold text-blue-300">ყველას ნახვა →</button>
              <RecentReviewsFeed releaseById={releaseById} releases={releaseCatalog} onReleaseClick={openRelease} onReviewClick={openReview} />
            </div>}

            {homeSectionVisible('new-names') && <NewNamesSection releases={newNames} onReleaseClick={openRelease} onViewAll={() => openSection('new-names')} />}
          </main>
        </>
      )}

      <SiteFooter onFaq={() => handleTabChange('faq')} onAbout={() => setShowAbout(true)} />

      {authMode && (
        <Suspense fallback={<SectionLoader onClose={() => setAuthMode(null)} />}><AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} /></Suspense>
      )}
      </div>
    </div>
  );
}

export default function App() {
  if (window.location.pathname === '/studio/obs') return <Suspense fallback={null}><ReactionOutput /></Suspense>;
  return <LoadingProvider><AuthProvider><AppContent /></AuthProvider><PageLoader /></LoadingProvider>;
}
