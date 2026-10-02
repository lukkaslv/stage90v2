import { Check, Mic2, PenLine, Radio, Shield, UserRound } from 'lucide-react';

type BadgeRole = 'guest' | 'user' | 'author' | 'artist' | 'media' | 'admin' | string;
type AuthorCategory = 'artist' | 'producer' | 'sound_engineer' | 'designer' | 'videomaker' | string | null | undefined;
type NormalizedRole = 'user' | 'author' | 'media' | 'admin';

export interface RoleBadgeProps {
  role?: BadgeRole | null;
  category?: AuthorCategory;
  isVerified?: boolean;
  className?: string;
  size?: 'compact' | 'profile';
}

const roleMeta = {
  user: { label: 'მომხმარებელი', Icon: UserRound },
  author: { label: 'ავტორი', Icon: Mic2 },
  media: { label: 'მედია', Icon: Radio },
  admin: { label: 'ადმინი', Icon: Shield },
} as const;

function normalizeRole(role?: BadgeRole | null): NormalizedRole {
  if (role === 'artist') return 'author';
  if (role === 'author' || role === 'media' || role === 'admin') return role;
  return 'user';
}

export function VerificationBadge({ className = '' }: { className?: string }) {
  return <span aria-label="ვერიფიცირებული" title="ვერიფიცირებული" className={`stage-verification ${className}`}><Check aria-hidden="true" className="h-3 w-3 stroke-[3]" /></span>;
}

export function AuthorCraftIcon({ className = '' }: { category?: AuthorCategory; className?: string }) {
  return <PenLine aria-hidden="true" className={className} />;
}

export function RoleAvatarBadge({ role, className = '' }: RoleBadgeProps) {
  const normalizedRole = normalizeRole(role);
  const { label, Icon } = roleMeta[normalizedRole];
  return <span aria-label={label} className={`stage-role-avatar stage-role-${normalizedRole} ${className}`}><Icon aria-hidden="true" className="h-5 w-5" /></span>;
}

export default function RoleBadge({ role, isVerified = false, className = '', size = 'compact' }: RoleBadgeProps) {
  const normalizedRole = normalizeRole(role);
  const { label, Icon } = roleMeta[normalizedRole];
  return <span className={`stage-role-badge stage-role-${normalizedRole} ${size === 'profile' ? 'stage-role-profile' : ''} ${className}`}><Icon aria-hidden="true" className="h-3 w-3" /><span>{label}</span>{normalizedRole === 'author' && isVerified && <VerificationBadge />}</span>;
}
