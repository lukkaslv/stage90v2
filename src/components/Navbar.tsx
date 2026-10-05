import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Award, CircleHelp, Disc3, LogIn, LogOut, Menu, MessageSquare, Mic2, PanelLeftClose, PanelLeftOpen, Search, Shield, Sparkles, Ticket, UserRound, UserPlus, X } from 'lucide-react';
import { categoryTabs, type PageId } from '@/types/music';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import SectionLoader from '@/components/SectionLoader';
import RoleBadge, { VerificationBadge } from '@/components/RoleBadge';
import { sectionTitles, type SectionId } from '@/lib/sectionRoutes';

const MediaReleaseModal = lazy(() => import('@/components/MediaReleaseModal'));

const tabIcons = { releases: Disc3, artists: Mic2, top90: Sparkles, achievements: Award, concerts: Ticket, faq: CircleHelp };

interface NavbarProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenAbout?: () => void;
  onBrandClick?: () => void;
  activeTab: PageId;
  section?: SectionId | null;
  unknownPath?: boolean;
  onTabChange: (tab: PageId) => void;
  onOpenRelease: (id: string) => void;
  onAdminOpen: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function Navbar({ onOpenAuth, onOpenAbout, onBrandClick, activeTab, section, unknownPath, onTabChange, onOpenRelease, onAdminOpen, collapsed, onToggleCollapsed }: NavbarProps) {
  const { user, logout, isAuthenticated, refreshProfile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [showReleaseSubmission, setShowReleaseSubmission] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; artist: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const client = supabase;
    if (!user || !client) {
      setReviewCount(0);
      return;
    }
    const loadReviewCount = async () => {
      const { count } = await client.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      setReviewCount(count ?? 0);
    };
    void loadReviewCount();
  }, [user]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [mobileOpen]);

  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2 || !supabase) {
      setSearchLoading(false);
      return;
    }
    const client = supabase;
    let cancelled = false;
    const search = async () => {
      const pattern = `%${term.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
      const [byTitle, byArtist] = await Promise.all([
        client.from('releases').select('id,title,artist_name').eq('is_active', true).ilike('title', pattern).limit(6),
        client.from('releases').select('id,title,artist_name').eq('is_active', true).ilike('artist_name', pattern).limit(6),
      ]);
      if (cancelled) return;
      const rows = [...(byTitle.data ?? []), ...(byArtist.data ?? [])];
      setSearchResults([...new Map(rows.map((row) => [String(row.id), { id: String(row.id), title: String(row.title ?? ''), artist: String(row.artist_name ?? '') }])).values()].slice(0, 6));
      setSearchLoading(false);
    };
    void search();
    return () => { cancelled = true; };
  }, [searchQuery]);

  const closeMobile = () => setMobileOpen(false);
  const openSearch = () => {
    if (collapsed) onToggleCollapsed();
    window.requestAnimationFrame(() => searchRef.current?.focus());
  };
  const labelVisibility = collapsed ? 'lg:hidden' : '';
  const itemClass = `flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''}`;

  return (
    <>
      <button type="button" onClick={() => setMobileOpen(true)} aria-label="მენიუს გახსნა" aria-expanded={mobileOpen} className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-[#2a2a32] bg-[#121215]/95 text-gray-200 shadow-xl backdrop-blur-lg lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      {mobileOpen && <button type="button" onClick={closeMobile} aria-label="მენიუს დახურვა" className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#25252d] bg-[#101014]/95 shadow-[18px_0_48px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-[width,transform] duration-300 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${collapsed ? 'lg:w-[76px]' : 'lg:w-72'}`} aria-label="მთავარი მენიუ">
        <div className={`flex items-center justify-between gap-2 border-b border-[#25252d] px-4 py-5 ${collapsed ? 'lg:flex-col lg:px-2' : ''}`}>
          <button type="button" onClick={() => { onBrandClick?.(); closeMobile(); }} aria-label="Stage 90 — მთავარი გვერდი" className="stage-brand min-w-0 text-left text-white">
            <img src="/stage90-mark.svg" alt="" className="stage-brand-mark" />
            <span className={labelVisibility}><strong>STAGE 90</strong><small>ქართული მუსიკის სცენა</small></span>
          </button>
          <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? 'მენიუს გაშლა' : 'მენიუს შეკეცვა'} aria-expanded={!collapsed} className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-blue-300 lg:flex">
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <button type="button" onClick={closeMobile} aria-label="მენიუს დახურვა" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white lg:hidden"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-3 pt-5">
          <div className={`relative ${collapsed ? 'lg:hidden' : ''}`}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input ref={searchRef} type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchLoading(event.target.value.trim().length >= 2); if (event.target.value.trim().length < 2) setSearchResults([]); }} onKeyDown={(event) => { if (event.key === 'Escape') setSearchQuery(''); if (event.key === 'Enter' && searchResults[0]) { onOpenRelease(searchResults[0].id); setSearchQuery(''); closeMobile(); } }} placeholder="რელიზის ან არტისტის ძებნა" aria-label="რელიზის ან არტისტის ძებნა" aria-controls="stage-search-results" className="w-full rounded-xl border border-[#2a2a32] bg-[#18181d] py-2.5 pl-10 pr-3 text-sm text-gray-200 placeholder-gray-500 transition-colors focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
            {searchQuery.trim().length >= 2 && <div id="stage-search-results" aria-live="polite" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-md border border-[#4d5060] bg-[#1b1d24] p-1 shadow-2xl">
              {searchLoading ? <p className="px-3 py-3 text-xs text-gray-400">იძებნება...</p> : searchResults.length === 0 ? <p className="px-3 py-3 text-xs text-gray-400">რელიზი ან არტისტი ვერ მოიძებნა.</p> : searchResults.map((result) => <button key={result.id} type="button" onClick={() => { onOpenRelease(result.id); setSearchQuery(''); closeMobile(); }} className="block w-full rounded-sm px-3 py-2 text-left hover:bg-[#2b2f3a] focus-visible:bg-[#2b2f3a]"><span className="block truncate text-sm font-semibold text-white">{result.title}</span><span className="block truncate text-xs text-gray-400">{result.artist}</span></button>)}
            </div>}
          </div>
          {collapsed && <button type="button" onClick={openSearch} aria-label="ძებნა" title="ძებნა" className="hidden h-11 w-full items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-white/5 hover:text-blue-300 lg:flex"><Search className="h-5 w-5" /></button>}
        </div>

        <nav aria-label="გვერდები" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-6">
          {categoryTabs.map((tab) => {
            const Icon = tabIcons[tab.id];
            const active = !unknownPath && activeTab === tab.id && !(tab.id === 'releases' && section);
            return <button key={tab.id} type="button" onClick={() => { onTabChange(tab.id); closeMobile(); }} aria-current={active ? 'page' : undefined} aria-label={tab.label} title={collapsed ? tab.label : undefined} className={`${itemClass} ${active ? 'border border-blue-400/20 bg-blue-400/10 text-blue-300 shadow-[inset_3px_0_0_#ff2299]' : 'border border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}`}>
              <Icon className="h-5 w-5 shrink-0" />
              <span className={labelVisibility}>{tab.label}</span>
            </button>;
          })}
          {section && <div className="stage-sidebar-current" aria-label="მიმდინარე განყოფილება">
            <span className="stage-sidebar-current-label">მიმდინარე განყოფილება</span>
            <span aria-current="page" title={collapsed ? sectionTitles[section] : undefined} className={`stage-sidebar-current-name ${collapsed ? 'lg:text-center' : ''}`}>{collapsed ? <span className="lg:hidden">{sectionTitles[section]}</span> : sectionTitles[section]}<span className={collapsed ? 'hidden lg:inline' : 'hidden'}>●</span></span>
          </div>}
          <div className="my-4 border-t border-[#25252d]" />
          <button type="button" onClick={() => { onOpenAbout?.(); closeMobile(); }} aria-label="კავშირი" title={collapsed ? 'კავშირი' : undefined} className={`${itemClass} border border-transparent text-gray-400 hover:bg-white/5 hover:text-white`}>
            <MessageSquare className="h-5 w-5 shrink-0" /><span className={labelVisibility}>კავშირი</span>
          </button>
        </nav>

        <div className="border-t border-[#25252d] px-3 py-4">
          {isAuthenticated && user ? (
            <div className="relative">
              <button type="button" onClick={() => setShowUserMenu((open) => !open)} aria-expanded={showUserMenu} aria-haspopup="menu" aria-label={user.displayName} title={collapsed ? user.displayName : undefined} className={`${itemClass} border border-[#2a2a32] text-gray-200 hover:border-gray-500`}>
                <UserRound className="h-5 w-5 shrink-0 text-blue-300" />
                <span className={`min-w-0 flex-1 truncate ${labelVisibility}`}>{user.displayName}</span>
                <span className={labelVisibility}>{user.isVerified && <VerificationBadge />}</span>
              </button>
              {showUserMenu && <>
                <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="პროფილის მენიუს დახურვა" onClick={() => setShowUserMenu(false)} />
                <div role="menu" className={`absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-[#2a2a32] bg-[#18181d] p-1.5 shadow-2xl shadow-black/50 ${collapsed ? 'lg:bottom-0 lg:left-full lg:mb-0 lg:ml-3' : ''}`}>
                  <div className="border-b border-[#2a2a32] px-3 py-3">
                    <p className="truncate text-sm font-bold text-white">{user.displayName}</p>
                    <RoleBadge role={user.role} category={user.authorCategory} isVerified={user.isVerified} size="profile" className="mt-1" />
                    <p className="mt-2 text-sm text-gray-400">რეცენზიები: <span className="font-bold text-white">{reviewCount}</span></p>
                  </div>
                  <button type="button" role="menuitem" onClick={() => { onTabChange('achievements'); setShowUserMenu(false); closeMobile(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-amber-300 hover:bg-amber-400/10"><Award className="h-4 w-4" />ჩემი მიღწევები</button>
                  {(user.role === 'media' || user.role === 'admin') && <div className="px-3 py-2 text-sm text-teal-300">რელიზების შეუზღუდავი მართვა</div>}
                  {user.role === 'admin' && <button type="button" role="menuitem" onClick={() => { onAdminOpen(); setShowUserMenu(false); closeMobile(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-400/10"><Shield className="h-4 w-4" />ადმინ პანელი</button>}
                  {(user.role === 'media' || user.role === 'admin') && <button type="button" role="menuitem" onClick={() => { setShowReleaseSubmission(true); setShowUserMenu(false); closeMobile(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-teal-300 hover:bg-teal-400/10">რელიზის დამატება</button>}
                  <button type="button" role="menuitem" onClick={() => { logout(); setShowUserMenu(false); closeMobile(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-[#25252d] hover:text-rose-400"><LogOut className="h-4 w-4" />გასვლა</button>
                </div>
              </>}
            </div>
          ) : <div className="space-y-2">
            <button type="button" onClick={() => { onOpenAuth('login'); closeMobile(); }} aria-label="შესვლა" title={collapsed ? 'შესვლა' : undefined} className={`${itemClass} border border-[#2a2a32] text-gray-200 hover:border-gray-500 hover:bg-white/5`}><LogIn className="h-5 w-5 shrink-0" /><span className={labelVisibility}>შესვლა</span></button>
            <button type="button" onClick={() => { onOpenAuth('register'); closeMobile(); }} aria-label="რეგისტრაცია" title={collapsed ? 'რეგისტრაცია' : undefined} className={`${itemClass} bg-gradient-to-r from-blue-400 to-pink-500 text-black hover:opacity-90 ${collapsed ? 'lg:bg-none lg:text-blue-300 lg:hover:bg-white/5' : ''}`}><UserPlus className="h-5 w-5 shrink-0" /><span className={labelVisibility}>რეგისტრაცია</span></button>
          </div>}
        </div>

        <div className={`border-t border-[#25252d] px-4 py-4 ${collapsed ? 'lg:px-2' : ''}`}>
          <div className={`stage-sidebar-note flex items-center gap-2 px-3 py-2 text-xs font-medium ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
            <Sparkles className="h-4 w-4 shrink-0" /><span className={labelVisibility}>სცენა ყველასთვის</span>
          </div>
        </div>
      </aside>
      {showReleaseSubmission && <Suspense fallback={<SectionLoader onClose={() => setShowReleaseSubmission(false)} />}><MediaReleaseModal onClose={() => setShowReleaseSubmission(false)} onSubmitted={refreshProfile} /></Suspense>}
    </>
  );
}
