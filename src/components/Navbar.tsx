import { useEffect, useState } from 'react';
import { Search, MessageSquare, LogIn, UserPlus, LogOut, Shield } from 'lucide-react';
import { categoryTabs, type PageId } from '@/types/music';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import MediaReleaseModal from '@/components/MediaReleaseModal';
import RoleBadge, { VerificationBadge } from '@/components/RoleBadge';

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
          <button type="button" onClick={onBrandClick} className="flex items-center gap-2.5 shrink-0 text-left">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 glow-cyan">
                <svg viewBox="0 0 160 80" aria-label="90 infinity mark" className="h-7 w-7" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs><linearGradient id="navbarInfinityGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#00F2FE" /><stop offset="50%" stopColor="#7B3DFF" /><stop offset="100%" stopColor="#FF2ED1" /></linearGradient></defs>
                  <path d="M48 22 C 24 22, 12 30, 12 40 C 12 50, 24 58, 48 58 C 72 58, 88 22, 112 22 C 136 22, 148 30, 148 40 C 148 50, 136 58, 112 58 C 88 58, 72 22, 48 22 Z" stroke="url(#navbarInfinityGrad)" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-extrabold tracking-tight text-white">Stage 90</span>
              <span className="hidden text-lg font-extrabold tracking-tight text-white">
                რზ<span className="text-cyan-400">ტ</span>
              </span>
              <span className="hidden ml-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                რისა ზა თვორჩესტვო
              </span>
            </div>
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
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button onClick={onOpenAbout} className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:text-gray-200 hover:bg-[#121215]">
              <MessageSquare className="h-4 w-4" />
              კავშირი
            </button>

            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 rounded-lg border border-[#2a2a32] px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-500"
                >
                  {user.isVerified && <VerificationBadge />}
                  <span className="hidden sm:inline max-w-[120px] truncate">{user.displayName}</span>
                  <RoleBadge role={user.role} category={user.authorCategory} isVerified={user.isVerified} />
                </button>
                {(user.role === 'media' || user.role === 'admin') && <div className="mt-1 flex flex-col items-end"><span className="text-[10px] text-teal-300">{user.role === 'media' ? `დარჩენილია: ${Math.max(0, 5 - user.mediaMonthlyReleases)}` : 'რელიზების შეუზღუდავი მართვა'}</span><button onClick={() => user.role === 'media' && user.mediaMonthlyReleases >= 5 ? window.alert('ამ თვეში რელიზების ლიმიტი ამოწურულია.') : setShowReleaseSubmission(true)} className="text-[10px] font-semibold text-teal-200 hover:text-white">რელიზის დამატება</button></div>}
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 z-20 w-48 rounded-lg border border-[#2a2a32] bg-[#121215] py-1 shadow-xl">
                      <div className="px-3 py-2 border-b border-[#1e1e24]">
                        <p className="text-sm font-bold text-white truncate">{user.displayName}</p>
                        <RoleBadge role={user.role} category={user.authorCategory} isVerified={user.isVerified} size="profile" className="mt-1" />
                        <p className="text-[11px] text-gray-500">
                          {user.role === 'media' ? 'მედია' : user.role === 'admin' ? 'ადმინი' : user.role === 'author' || user.role === 'artist' ? 'ავტორი' : 'მომხმარებელი'}
                        </p>
                        <p className="mt-2 text-[11px] text-gray-400">რეცენზიები: <span className="font-bold text-white">{reviewCount}</span></p>
                      </div>
                      {user.role === 'admin' && <button onClick={() => { onAdminOpen(); setShowUserMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-amber-300 shadow-[0_0_18px_-8px_rgba(251,191,36,0.9)] hover:bg-amber-400/10"><Shield className="h-4 w-4" />ადმინ პანელი</button>}
                      {(user.role === 'media' || user.role === 'admin') && <button onClick={() => { if (user.role === 'media' && user.mediaMonthlyReleases >= 5) { window.alert('ამ თვეში რელიზების ლიმიტი ამოწურულია.'); return; } setShowReleaseSubmission(true); setShowUserMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-teal-300 hover:bg-teal-400/10">რელიზის დამატება</button>}
                      <button
                        onClick={() => { logout(); setShowUserMenu(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-[#1e1e24] hover:text-rose-400"
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
    </header>{showReleaseSubmission && <MediaReleaseModal onClose={() => setShowReleaseSubmission(false)} onSubmitted={refreshProfile} />}
    </>
  );
}
