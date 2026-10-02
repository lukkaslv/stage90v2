import { lazy, Suspense, useEffect, useState } from 'react';
import { Search, MessageSquare, LogIn, UserPlus, LogOut, Shield } from 'lucide-react';
import { categoryTabs, type PageId } from '@/types/music';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import SectionLoader from '@/components/SectionLoader';
import RoleBadge, { VerificationBadge } from '@/components/RoleBadge';

const MediaReleaseModal = lazy(() => import('@/components/MediaReleaseModal'));

interface NavbarProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenAbout?: () => void;
  onBrandClick?: () => void;
  activeTab: PageId;
  onTabChange: (tab: PageId) => void;
  onAdminOpen: () => void;
}

export default function Navbar({ onOpenAuth, onOpenAbout, onBrandClick, activeTab, onTabChange, onAdminOpen }: NavbarProps) {
  const { user, logout, isAuthenticated, refreshProfile } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [showReleaseSubmission, setShowReleaseSubmission] = useState(false);

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

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-[#1e1e24] bg-[#0a0a0c]/90 backdrop-blur-xl">
      {/* Top bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <button type="button" onClick={onBrandClick} aria-label="#STAGE90" className="shrink-0 text-left font-sans text-base font-semibold tracking-[0.12em] text-white sm:text-lg">
            #STAGE90
          </button>

          {/* Search bar */}
          <div className="relative flex-1 max-w-md hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="ძებნა..."
              className="w-full rounded-lg border border-[#1e1e24] bg-[#121215] py-2 pl-9 pr-4 text-sm text-gray-200 placeholder-gray-500 transition-colors focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2 self-center sm:gap-3">
            <button onClick={onOpenAbout} className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:text-gray-200 hover:bg-[#121215]">
              <MessageSquare className="h-4 w-4" />
              კავშირი
            </button>

            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-expanded={showUserMenu}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-lg border border-[#2a2a32] px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-500"
                >
                  {user.isVerified && <VerificationBadge />}
                  <span className="hidden sm:inline max-w-[120px] truncate">{user.displayName}</span>
                  <RoleBadge role={user.role} category={user.authorCategory} isVerified={user.isVerified} />
                </button>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <div role="menu" className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-[#2a2a32] bg-[#121215] p-1.5 shadow-xl shadow-black/40">
                      <div className="border-b border-[#1e1e24] px-3 py-3">
                        <p className="text-sm font-bold text-white truncate">{user.displayName}</p>
                        <RoleBadge role={user.role} category={user.authorCategory} isVerified={user.isVerified} size="profile" className="mt-1" />
                        <p className="mt-1 text-sm leading-5 text-gray-400">
                          {user.role === 'media' ? 'მედია' : user.role === 'admin' ? 'ადმინი' : user.role === 'author' || user.role === 'artist' ? 'ავტორი' : 'მომხმარებელი'}
                        </p>
                        <p className="mt-2 text-sm leading-5 text-gray-400">რეცენზიები: <span className="font-bold text-white">{reviewCount}</span></p>
                      </div>
                      {(user.role === 'media' || user.role === 'admin') && <div className="px-3 py-2 text-sm leading-5 text-teal-300">{user.role === 'media' ? `ამ თვეში დარჩენილია: ${Math.max(0, 5 - user.mediaMonthlyReleases)}` : 'რელიზების შეუზღუდავი მართვა'}</div>}
                      {user.role === 'admin' && <button role="menuitem" onClick={() => { onAdminOpen(); setShowUserMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-amber-300 shadow-[0_0_18px_-8px_rgba(251,191,36,0.9)] hover:bg-amber-400/10"><Shield className="h-4 w-4" />ადმინ პანელი</button>}
                      {(user.role === 'media' || user.role === 'admin') && <button role="menuitem" onClick={() => { if (user.role === 'media' && user.mediaMonthlyReleases >= 5) { window.alert('ამ თვეში რელიზების ლიმიტი ამოწურულია.'); return; } setShowReleaseSubmission(true); setShowUserMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-teal-300 hover:bg-teal-400/10">რელიზის დამატება</button>}
                      <button
                        onClick={() => { logout(); setShowUserMenu(false); }}
                        role="menuitem"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-400 transition-colors hover:bg-[#1e1e24] hover:text-rose-400"
                      >
                        <LogOut className="h-4 w-4" />
                        გასვლა
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => onOpenAuth('login')}
                  className="flex items-center gap-1.5 rounded-lg border border-[#2a2a32] px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-500 hover:bg-[#121215]"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">შესვლა</span>
                </button>
                <button
                  onClick={() => onOpenAuth('register')}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-3 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">რეგისტრაცია</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search */}
      <div className="px-4 pb-3 md:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="ძებნა..."
            className="w-full rounded-lg border border-[#1e1e24] bg-[#121215] py-2 pl-9 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Category tabs */}
      <nav className="border-t border-[#1e1e24]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar h-12">
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'text-cyan-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-cyan-400 text-glow-cyan" />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </header>{showReleaseSubmission && <Suspense fallback={<SectionLoader onClose={() => setShowReleaseSubmission(false)} />}><MediaReleaseModal onClose={() => setShowReleaseSubmission(false)} onSubmitted={refreshProfile} /></Suspense>}
    </>
  );
}
