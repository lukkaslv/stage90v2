import { Check } from 'lucide-react';

type BadgeRole = 'guest' | 'user' | 'author' | 'artist' | 'media' | 'admin' | string;
type BadgeSize = 'compact' | 'profile';
type AuthorCategory = 'artist' | 'producer' | 'sound_engineer' | 'designer' | 'videomaker' | string | null | undefined;

export interface RoleBadgeProps {
  role?: BadgeRole | null;
  category?: AuthorCategory;
  isVerified?: boolean;
  className?: string;
  size?: BadgeSize;
}

type NormalizedRole = 'user' | 'author' | 'admin' | 'media';

const roleMeta: Record<NormalizedRole, { label: string; tone: string; glow: string }> = {
  user: { label: 'მომხმარებელი', tone: 'from-[#f1f5f9]/20 via-[#64748b]/14 to-[#0f766e]/16 text-slate-100 border-slate-300/30', glow: 'shadow-[0_0_14px_rgba(94,234,212,0.13)]' },
  author: { label: 'ავტორი', tone: 'from-[#fed7c7]/25 via-[#c66a52]/18 to-[#7c2d12]/22 text-[#ffe4d6] border-[#f0a58f]/50', glow: 'shadow-[0_0_16px_rgba(224,115,92,0.22)]' },
  admin: { label: 'ადმინი', tone: 'from-[#fff7ad]/35 via-[#f59e0b]/20 to-[#854d0e]/28 text-yellow-50 border-[#facc15]/60', glow: 'shadow-[0_0_18px_rgba(250,183,35,0.28)]' },
  media: { label: 'მედია', tone: 'from-[#eff6ff]/28 via-[#60a5fa]/18 to-[#1d4ed8]/24 text-[#e0f2fe] border-[#7dd3fc]/60', glow: 'shadow-[0_0_17px_rgba(34,211,238,0.3)]' },
};

function normalizeRole(role?: BadgeRole | null): NormalizedRole {
  if (role === 'artist') return 'author';
  if (role === 'author' || role === 'admin' || role === 'media') return role;
  return 'user';
}

function RoleEmblem({ role, className = '' }: { role: NormalizedRole; className?: string }) {
  const id = `rzt-${role}`;
  const outer = role === 'admin' ? 'M7 16 13 8l7 5 4-8 4 8 7-5 6 8-3 18H10L7 16Z' : role === 'media' ? 'M12 7h24a5 5 0 0 1 5 5v24a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V12a5 5 0 0 1 5-5Z' : role === 'author' ? 'M24 4 41 14v20L24 44 7 34V14L24 4Z' : 'M24 4 41 11v14c0 10-7 16-17 19C14 41 7 35 7 25V11l17-7Z';
  const inner = role === 'admin' ? 'M12 18h24l-2 11H14l-2-11Z' : role === 'media' ? 'M14 13h20a2 2 0 0 1 2 2v18H12V15a2 2 0 0 1 2-2Z' : role === 'author' ? 'M24 10 35 17v14L24 38 13 31V17l11-7Z' : 'M24 10 35 15v10c0 6-4 10-11 13-7-3-11-7-11-13V15l11-5Z';
  return <svg viewBox="0 0 48 48" aria-hidden="true" className={`role-emblem shrink-0 ${className}`}>
    <defs><linearGradient id={`${id}-metal`} x1="8" y1="4" x2="39" y2="44" gradientUnits="userSpaceOnUse">
      {role === 'user' && <><stop stopColor="#f8fafc" /><stop offset=".42" stopColor="#94a3b8" /><stop offset=".72" stopColor="#cbd5e1" /><stop offset="1" stopColor="#0f766e" /></>}
      {role === 'author' && <><stop stopColor="#fff1eb" /><stop offset=".4" stopColor="#d97757" /><stop offset=".7" stopColor="#f2b5a0" /><stop offset="1" stopColor="#7c2d12" /></>}
      {role === 'admin' && <><stop stopColor="#fffbd1" /><stop offset=".35" stopColor="#facc15" /><stop offset=".7" stopColor="#e08a05" /><stop offset="1" stopColor="#713f12" /></>}
      {role === 'media' && <><stop stopColor="#ffffff" /><stop offset=".35" stopColor="#bfdbfe" /><stop offset=".7" stopColor="#e0f2fe" /><stop offset="1" stopColor="#1d4ed8" /></>}
    </linearGradient><linearGradient id={`${id}-inner`} x1="10" y1="8" x2="38" y2="40" gradientUnits="userSpaceOnUse"><stop stopColor="#111827" stopOpacity=".96" /><stop offset="1" stopColor="#020617" stopOpacity=".82" /></linearGradient></defs>
    <path d={outer} fill={`url(#${id}-metal)`} stroke="#fff" strokeOpacity=".48" strokeWidth="1.2" /><path d={inner} fill={`url(#${id}-inner)`} stroke="#fff" strokeOpacity=".28" />
    {role === 'admin' && <path d="m14 19 4 5 6-8 6 8 4-5-2 8H16l-2-8Z" fill="#fff7ad" stroke="#ca8a04" strokeWidth=".8" />}
    {role === 'author' && <><path d="m24 14 2.4 6 6.1.4-4.8 3.9 1.6 6-5.3-3.5-5.3 3.5 1.6-6-4.8-3.9 6.1-.4L24 14Z" fill="#ffe4d6" stroke="#c2410c" strokeWidth=".8" /><path d="m33 10 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" fill="#fff1eb" opacity=".9" /></>}
    {role === 'media' && <><path d="M24 18a5 5 0 0 0-5 5v6a5 5 0 0 0 10 0v-6a5 5 0 0 0-5-5Z" fill="#dbeafe" stroke="#38bdf8" /><path d="M15 26v2a9 9 0 0 0 18 0v-2M24 37v4M19 41h10" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" /></>}
    {role === 'user' && <><circle cx="24" cy="19" r="4" fill="#d1fae5" /><path d="M16 34c1.5-6 14.5-6 16 0" fill="none" stroke="#5eead4" strokeWidth="2.4" strokeLinecap="round" /><path d="M11 13h4M33 13h4" stroke="#99f6e4" strokeWidth="1.2" strokeLinecap="round" /></>}
    <path d="M13 10 24 6l11 4" fill="none" stroke="#fff" strokeOpacity=".62" strokeWidth="1.3" strokeLinecap="round" />
  </svg>;
}

export function VerificationBadge({ className = '' }: { className?: string }) {
  return <span aria-label="ვერიფიცირებული" className={`inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-200/60 bg-cyan-400/20 text-cyan-100 shadow-[0_0_8px_rgba(34,211,238,0.3)] ${className}`}><Check className="h-2.5 w-2.5 stroke-[3]" /></span>;
}

export function AuthorCraftIcon({ className = '' }: { category?: AuthorCategory; className?: string }) { return <RoleEmblem role="author" className={className} />; }

export function RoleAvatarBadge({ role, className = '' }: RoleBadgeProps) {
  const normalizedRole = normalizeRole(role); const meta = roleMeta[normalizedRole];
  return <span aria-label={meta.label} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-gradient-to-br ${meta.tone} ${meta.glow} ${className}`}><RoleEmblem role={normalizedRole} className="h-7 w-7" /></span>;
}

export default function RoleBadge({ role, isVerified = false, className = '', size = 'compact' }: RoleBadgeProps) {
  const normalizedRole = normalizeRole(role); const meta = roleMeta[normalizedRole];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-r font-bold tracking-wide transition-all duration-200 ${size === 'profile' ? 'px-3.5 py-1.5 text-sm leading-5' : 'px-2.5 py-0.5 text-[10px] leading-4'} ${meta.tone} ${meta.glow} ${className}`}><RoleEmblem role={normalizedRole} className={size === 'profile' ? 'h-6 w-6' : 'h-[18px] w-[18px]'} /><span>{meta.label}</span>{normalizedRole === 'author' && isVerified && <Check className="ml-0.5 h-3 w-3 text-cyan-200" />}</span>;
}
