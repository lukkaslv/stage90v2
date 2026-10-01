import { useEffect, useState } from 'react';
import {
  Trophy,
  Heart,
  Users,
  Music2,
  MessageSquare,
  Star,
  Gem,
  Disc3,
  Mic2,
  Crown,
  Medal,
  Award,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface LeaderboardUser {
  rank: number;
  username: string;
  points: string;
  hearts: number;
  likes: number;
  badgeColor: 'ruby' | 'emerald' | 'gold';
  avatarUrl: string;
}

const seasonFilters = ['შემოდგომა 26', 'ზაფხული 26', 'ყველა დრო'] as const;

const initialPlatformStats = [
  { label: 'მომხმარებლები სულ', value: '0', icon: Users },
  { label: 'რეგისტრირებული ავტორები', value: '0', icon: Mic2 },
  { label: 'ავტორთა მოწონებები', value: '0', icon: Heart },
  { label: 'ავტორთა კომენტარები', value: '0', icon: MessageSquare },
  { label: 'ალბომის ღირებულების გათვლა', value: '0', icon: Gem },
  { label: 'რეცენზიები რელიზებზე', value: '0', icon: MessageSquare },
  { label: 'შეფასებები რეცენზიის გარეშე', value: '0', icon: Star },
  { label: 'სულ ტრეკები', value: '0', icon: Music2 },
  { label: 'სულ ალბომები', value: '0', icon: Disc3 },
  { label: 'სულ კონცერტები', value: '0', icon: Mic2 },
];

const badgeStyles: Record<string, { ring: string; glow: string; label: string }> = {
  ruby: { ring: 'ring-rose-500/40', glow: 'shadow-[0_0_24px_-4px_rgba(244,63,94,0.5)]', label: 'ლალი' },
  emerald: { ring: 'ring-emerald-500/40', glow: 'shadow-[0_0_24px_-4px_rgba(16,185,129,0.5)]', label: 'ზურმუხტი' },
  gold: { ring: 'ring-amber-500/40', glow: 'shadow-[0_0_24px_-4px_rgba(251,191,36,0.5)]', label: 'ოქრო' },
};

function PodiumCard({ user, position }: { user: LeaderboardUser; position: 'center' | 'left' | 'right' }) {
  const badge = badgeStyles[user.badgeColor];
  const heightClass = position === 'center' ? 'sm:mt-0' : 'sm:mt-8';
  const scaleClass = position === 'center' ? 'sm:scale-105' : '';
  const rankIcon = user.rank === 1 ? <Crown className="h-5 w-5" /> : user.rank === 2 ? <Medal className="h-5 w-5" /> : <Award className="h-5 w-5" />;
  const rankColor = user.rank === 1 ? 'text-rose-400' : user.rank === 2 ? 'text-emerald-400' : 'text-amber-400';

  return (
    <div className={`flex flex-col items-center ${heightClass} ${scaleClass}`}>
      {/* Rank badge */}
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-[#121215] ${rankColor} ${
        user.rank === 1 ? 'border-rose-500/50' : user.rank === 2 ? 'border-emerald-500/50' : 'border-amber-500/50'
      } ${badge.glow}`}>
        {rankIcon}
      </div>

      {/* Avatar with badge overlay */}
      <div className="relative">
        <div className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#1e1e24] ring-2 ${badge.ring} ${badge.glow} sm:h-24 sm:w-24`}>
          {user.avatarUrl ? <img src={user.avatarUrl} alt={user.username} className="h-full w-full object-cover" /> : <span className="text-lg font-bold text-gray-400">{user.username.slice(0, 2).toUpperCase()}</span>}
        </div>
        {/* Seasonal badge overlay */}
        <div className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0a0a0c] bg-[#121215] ${rankColor}`}>
          <Heart className="h-3.5 w-3.5" fill="currentColor" />
        </div>
      </div>

      {/* Username */}
      <p className="mt-3 max-w-[120px] truncate text-sm font-bold text-white text-center">{user.username}</p>

      {/* Points */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className={`text-lg font-extrabold ${rankColor}`}>{user.points}</span>
        <span className="text-xs text-gray-500">ქულა</span>
      </div>

      {/* Hearts */}
      <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
        <Heart className="h-3 w-3 text-rose-400/60" />
        {user.hearts} გული
      </div>
    </div>
  );
}

function formatPoints(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString();
}

function mapProfileToLeaderboardUser(profile: Record<string, unknown>, rank: number): LeaderboardUser {
  const points = Number(profile.community_points ?? 0);
  return {
    rank,
    username: String(profile.display_name ?? profile.username ?? profile.artist_name ?? 'მომხმარებელი'),
    points: formatPoints(points),
    hearts: Number(profile.hearts ?? profile.received_hearts ?? 0),
    likes: Number(profile.likes ?? profile.total_likes ?? 0),
    badgeColor: rank === 1 ? 'ruby' : rank === 2 ? 'emerald' : 'gold',
    avatarUrl: String(profile.avatar_url ?? profile.avatarUrl ?? ''),
  };
}

export default function Top90Leaderboard() {
  const [season, setSeason] = useState<typeof seasonFilters[number]>('შემოდგომა 26');
  const [podiumUsers, setPodiumUsers] = useState<LeaderboardUser[]>([]);
  const [rankedUsers, setRankedUsers] = useState<LeaderboardUser[]>([]);
  const [platformStats, setPlatformStats] = useState(initialPlatformStats);
  const podiumDisplayUsers: LeaderboardUser[] = [
    podiumUsers[0] ?? { rank: 1, username: 'ადგილი 1', points: '—', hearts: 0, likes: 0, badgeColor: 'ruby', avatarUrl: '' },
    podiumUsers[1] ?? { rank: 2, username: 'ადგილი 2', points: '—', hearts: 0, likes: 0, badgeColor: 'emerald', avatarUrl: '' },
    podiumUsers[2] ?? { rank: 3, username: 'ადგილი 3', points: '—', hearts: 0, likes: 0, badgeColor: 'gold', avatarUrl: '' },
  ];

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const loadTop90 = async () => {
      const { data } = await client
        .from('profiles')
        .select('*')
        .order('community_points', { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        const users = data.map((row, index) => mapProfileToLeaderboardUser(row as Record<string, unknown>, index + 1));
        setPodiumUsers(users.slice(0, 3));
        setRankedUsers(users.slice(3, 10));
      }

      const [{ count: profileCount }, { count: authorCount }, { count: pickCount }, { count: commentCount }, { count: calculationCount }, { count: reviewCount }, { count: ratingCount }, { data: releaseRows }, { count: releaseCount }, { count: concertCount }] = await Promise.all([
        client.from('profiles').select('*', { count: 'exact', head: true }),
        client.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'author'),
        client.from('author_picks').select('*', { count: 'exact', head: true }),
        client.from('author_comments').select('*', { count: 'exact', head: true }),
        client.from('release_calculations').select('*', { count: 'exact', head: true }),
        client.from('reviews').select('*', { count: 'exact', head: true }),
        client.from('ratings').select('*', { count: 'exact', head: true }),
        client.from('releases').select('track_count').eq('is_active', true),
        client.from('releases').select('*', { count: 'exact', head: true }).eq('is_active', true),
        client.from('concerts').select('*', { count: 'exact', head: true }),
      ]);

      setPlatformStats((current) => current.map((stat) => {
        const trackCount = (releaseRows ?? []).reduce((sum, row) => sum + Number((row as { track_count?: number }).track_count ?? 0), 0);
        if (stat.label === 'მომხმარებლები სულ') return { ...stat, value: (profileCount ?? 0).toLocaleString() };
        if (stat.label === 'რეგისტრირებული ავტორები') return { ...stat, value: (authorCount ?? 0).toLocaleString() };
        if (stat.label === 'ავტორთა მოწონებები') return { ...stat, value: (pickCount ?? 0).toLocaleString() };
        if (stat.label === 'ავტორთა კომენტარები') return { ...stat, value: (commentCount ?? 0).toLocaleString() };
        if (stat.label === 'ალბომის ღირებულების გათვლა') return { ...stat, value: (calculationCount ?? 0).toLocaleString() };
        if (stat.label === 'რეცენზიები რელიზებზე') return { ...stat, value: (reviewCount ?? 0).toLocaleString() };
        if (stat.label === 'შეფასებები რეცენზიის გარეშე') return { ...stat, value: (ratingCount ?? 0).toLocaleString() };
        if (stat.label === 'სულ ტრეკები') return { ...stat, value: trackCount.toLocaleString() };
        if (stat.label === 'სულ ალბომები') return { ...stat, value: (releaseCount ?? 0).toLocaleString() };
        if (stat.label === 'სულ კონცერტები') return { ...stat, value: (concertCount ?? 0).toLocaleString() };
        return stat;
      }));
    };

    void loadTop90();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const refreshLeaderboard = async () => {
      const { data } = await client.from('profiles').select('*').order('community_points', { ascending: false }).limit(10);
      if (!data) return;
      const users = data.map((row, index) => mapProfileToLeaderboardUser(row as Record<string, unknown>, index + 1));
      setPodiumUsers(users.slice(0, 3));
      setRankedUsers(users.slice(3, 10));
    };
    const adjustStat = (index: number, amount: number) => {
      setPlatformStats((current) => current.map((stat, statIndex) => statIndex === index ? { ...stat, value: String(Math.max(0, Number(stat.value.replace(/,/g, '')) + amount)) } : stat));
    };
    const channel = client
      .channel('top90-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.eventType === 'INSERT') adjustStat(0, 1);
        if (payload.eventType === 'DELETE') adjustStat(0, -1);
        void refreshLeaderboard();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, (payload) => {
        if (payload.eventType === 'INSERT') adjustStat(5, 1);
        if (payload.eventType === 'DELETE') adjustStat(5, -1);
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-400/10">
            <Trophy className="h-5 w-5 text-cyan-400" />
          </span>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">ტოპ-90 საზოგადოების ქულებით</h1>
        </div>
      </div>

      {/* Season filter tabs */}
      <div className="mb-8 flex gap-1 rounded-xl border border-[#1e1e24] bg-[#121215] p-1 w-fit">
        {seasonFilters.map((s) => (
          <button
            key={s}
            onClick={() => setSeason(s)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              season === s ? 'bg-cyan-400/10 text-cyan-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Main layout: leaderboard + stats sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: Leaderboard */}
        <div className="space-y-6">
          {/* Podium */}
          <div className="rounded-xl border border-[#1e1e24] bg-[#121215] p-6 sm:p-8">
            {podiumDisplayUsers.length === 3 ? (
              <div className="flex items-end justify-center gap-4 sm:gap-8">
                <PodiumCard user={podiumDisplayUsers[1]} position="left" />
                <PodiumCard user={podiumDisplayUsers[0]} position="center" />
                <PodiumCard user={podiumDisplayUsers[2]} position="right" />
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-gray-500">ტოპ-90-ისთვის საკმარისი პროფილები ჯერ არ არის.</div>
            )}
          </div>

          {/* Ranked list 4-10 */}
          <div className="rounded-xl border border-[#1e1e24] bg-[#121215] overflow-hidden">
            <div className="border-b border-[#1e1e24] px-5 py-3">
              <h3 className="text-sm font-bold text-white">რეიტინგი 4-10</h3>
            </div>
            <div className="divide-y divide-[#1e1e24]">
              {rankedUsers.map((user) => {
                const badge = badgeStyles[user.badgeColor];
                return (
                  <div
                    key={user.rank}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#18181c]"
                  >
                    {/* Rank */}
                    <span className="w-8 shrink-0 text-center text-sm font-bold text-gray-500">{user.rank}</span>

                    {/* Avatar + badge */}
                    <div className="relative shrink-0">
                      <div className={`h-10 w-10 overflow-hidden rounded-full ring-1 ${badge.ring}`}>
                        {user.avatarUrl ? <img src={user.avatarUrl} alt={user.username} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs font-bold text-gray-400">{user.username.slice(0, 2).toUpperCase()}</span>}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border border-[#0a0a0c] bg-amber-500/20 flex items-center justify-center">
                        <Heart className="h-2 w-2 text-amber-400" fill="currentColor" />
                      </div>
                    </div>

                    {/* Username */}
                    <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-200">{user.username}</span>

                    {/* Score pill */}
                    <span className="shrink-0 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyan-300">
                      {user.points}
                    </span>

                    {/* Likes */}
                    <span className="hidden sm:flex shrink-0 items-center gap-1 text-xs text-gray-500 w-20 justify-end">
                      <Heart className="h-3 w-3 text-rose-400/50" />
                      {user.likes.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Platform stats */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#1e1e24] bg-[#121215] p-5 lg:sticky lg:top-32">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-400/10">
                  <Trophy className="h-4 w-4 text-violet-400" />
                </span>
                <h3 className="text-sm font-bold text-white">პლატფორმის სტატისტიკა</h3>
              </div>
              <span className="rounded-md border border-[#2a2a32] px-2 py-0.5 text-[10px] font-medium text-gray-500">
                ყველა დრო
              </span>
            </div>
            <div className="space-y-3">
              {platformStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-gray-600" />
                      <span className="whitespace-normal break-words text-xs leading-relaxed text-gray-400">{stat.label}</span>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-white">{stat.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
