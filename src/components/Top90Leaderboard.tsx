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
import PageHeading from '@/components/PageHeading';

interface LeaderboardUser {
  rank: number;
  username: string;
  points: string;
  hearts?: number;
  likes?: number;
  badgeColor: 'ruby' | 'emerald' | 'gold';
  avatarUrl: string;
}

const initialPlatformStats = [
  { label: 'მომხმარებლები სულ', value: '—', icon: Users },
  { label: 'რეგისტრირებული ავტორები', value: '—', icon: Mic2 },
  { label: 'ავტორთა რჩეულები', value: '—', icon: Heart },
  { label: 'ავტორთა კომენტარები', value: '—', icon: MessageSquare },
  { label: 'ალბომის ღირებულების გათვლა', value: '—', icon: Gem },
  { label: 'რეცენზიები რელიზებზე', value: '—', icon: MessageSquare },
  { label: 'შეფასებები რეცენზიის გარეშე', value: '—', icon: Star },
  { label: 'სულ ტრეკები', value: '—', icon: Music2 },
  { label: 'სულ რელიზები', value: '—', icon: Disc3 },
  { label: 'სულ ალბომები', value: '—', icon: Disc3 },
  { label: 'სულ მინიალბომები', value: '—', icon: Disc3 },
  { label: 'სულ კონცერტები', value: '—', icon: Mic2 },
];

const badgeStyles: Record<string, { ring: string; glow: string; label: string }> = {
  ruby: { ring: 'ring-rose-700/70', glow: '', label: 'ლალი' },
  emerald: { ring: 'ring-emerald-700/70', glow: '', label: 'ზურმუხტი' },
  gold: { ring: 'ring-amber-700/70', glow: '', label: 'ოქრო' },
};

function PodiumCard({ user, position }: { user: LeaderboardUser; position: 'center' | 'left' | 'right' }) {
  const badge = badgeStyles[user.badgeColor];
  const heightClass = position === 'center' ? 'sm:mt-0' : 'sm:mt-8';
  const scaleClass = position === 'center' ? 'sm:scale-105' : '';
  const rankIcon = user.rank === 1 ? <Crown className="h-5 w-5" /> : user.rank === 2 ? <Medal className="h-5 w-5" /> : <Award className="h-5 w-5" />;
  const rankColor = user.rank === 1 ? 'text-rose-400' : user.rank === 2 ? 'text-emerald-400' : 'text-amber-400';

  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center ${heightClass} ${scaleClass}`}>
      {/* Rank badge */}
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-[#121215] ${rankColor} ${
        user.rank === 1 ? 'border-rose-500/50' : user.rank === 2 ? 'border-emerald-500/50' : 'border-amber-500/50'
      } ${badge.glow}`}>
        {rankIcon}
      </div>

      {/* Avatar with badge overlay */}
      <div className="relative">
        <div className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#1e1e24] ring-2 ${badge.ring} ${badge.glow} sm:h-24 sm:w-24`}>
          {user.avatarUrl ? <img src={user.avatarUrl} alt={user.username} className="h-full w-full object-cover" /> : <span className="text-lg font-bold text-gray-400">{user.username.slice(0, 2).toUpperCase()}</span>}
        </div>
        {/* Seasonal badge overlay */}
        <div className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0a0a0c] bg-[#121215] ${rankColor}`}>
          <Heart className="h-3.5 w-3.5" fill="currentColor" />
        </div>
      </div>

      {/* Username */}
      <p className="mt-3 w-full truncate text-center text-sm font-bold text-white">{user.username}</p>

      {/* Points */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className={`text-lg font-extrabold ${rankColor}`}>{user.points}</span>
        <span className="text-xs text-gray-500">ქულა</span>
      </div>

      {/* Hearts */}
      {user.hearts != null && <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
        <Heart className="h-3 w-3 text-rose-400/60" />
        {user.hearts} გული
      </div>}
    </div>
  );
}

function formatPoints(value: number) {
  return value.toLocaleString();
}

function mapProfileToLeaderboardUser(profile: Record<string, unknown>, rank: number): LeaderboardUser {
  const points = Number(profile.community_points ?? 0);
  return {
    rank,
    username: String(profile.display_name ?? profile.username ?? profile.artist_name ?? 'მომხმარებელი'),
    points: formatPoints(points),
    hearts: profile.hearts == null && profile.received_hearts == null ? undefined : Number(profile.hearts ?? profile.received_hearts),
    likes: profile.likes == null && profile.total_likes == null ? undefined : Number(profile.likes ?? profile.total_likes),
    badgeColor: rank === 1 ? 'ruby' : rank === 2 ? 'emerald' : 'gold',
    avatarUrl: String(profile.avatar_url ?? profile.avatarUrl ?? ''),
  };
}

export default function Top90Leaderboard() {
  const [podiumUsers, setPodiumUsers] = useState<LeaderboardUser[]>([]);
  const [rankedUsers, setRankedUsers] = useState<LeaderboardUser[]>([]);
  const [platformStats, setPlatformStats] = useState(initialPlatformStats);
  const [loading, setLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); setLeaderboardError(true); return; }
    let cancelled = false;

    const loadTop90 = async () => {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .order('community_points', { ascending: false })
        .limit(90);
      if (cancelled) return;
      setLoading(false);
      setLeaderboardError(Boolean(error));
      if (!error && data) {
        const users = data.map((row, index) => mapProfileToLeaderboardUser(row as Record<string, unknown>, index + 1));
        setPodiumUsers(users.slice(0, 3));
        setRankedUsers(users.slice(3));
      }
    };

    const loadStats = async () => {
      const loadReleaseTypes = async () => {
        const types: string[] = [];
        for (let from = 0; ; from += 500) {
          const { data, error } = await client.from('releases').select('release_type').eq('is_active', true).order('id').range(from, from + 499);
          if (error || !data) return null;
          types.push(...data.map((row) => String(row.release_type ?? '').trim().toLowerCase()));
          if (data.length < 500) return types;
        }
      };
      const [profiles, authors, picks, comments, calculations, reviews, ratings, releases, concerts] = await Promise.all([
        client.from('profiles').select('*', { count: 'exact', head: true }),
        client.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'author'),
        client.from('review_author_likes').select('*', { count: 'exact', head: true }),
        client.from('author_comments').select('*', { count: 'exact', head: true }),
        client.from('release_calculations').select('*', { count: 'exact', head: true }),
        client.from('reviews').select('*', { count: 'exact', head: true }),
        client.from('ratings').select('*', { count: 'exact', head: true }),
        loadReleaseTypes(),
        client.from('concerts').select('*', { count: 'exact', head: true }),
      ]);
      if (cancelled) return;
      const releaseTypes = releases;
      const countType = (types: string[]) => releaseTypes?.filter((type) => types.includes(type)).length;
      const values: Record<string, number | null | undefined> = {
        'მომხმარებლები სულ': profiles.error ? null : profiles.count,
        'რეგისტრირებული ავტორები': authors.error ? null : authors.count,
        'ავტორთა რჩეულები': picks.error ? null : picks.count,
        'ავტორთა კომენტარები': comments.error ? null : comments.count,
        'ალბომის ღირებულების გათვლა': calculations.error ? null : calculations.count,
        'რეცენზიები რელიზებზე': reviews.error ? null : reviews.count,
        'შეფასებები რეცენზიის გარეშე': ratings.error ? null : ratings.count,
        'სულ ტრეკები': countType(['სინგლი', 'single', 'ტრეკი', 'track']),
        'სულ რელიზები': releaseTypes?.length,
        'სულ ალბომები': countType(['ალბომი', 'album']),
        'სულ მინიალბომები': countType(['ep', 'ეპი']),
        'სულ კონცერტები': concerts.error ? null : concerts.count,
      };
      setPlatformStats(initialPlatformStats.map((stat) => ({ ...stat, value: values[stat.label] == null ? '—' : Number(values[stat.label]).toLocaleString() })));
    };

    void loadTop90();
    void loadStats();
    const channel = client.channel('top90-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void loadTop90(); void loadStats(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => { void loadStats(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'releases' }, () => { void loadStats(); })
      .subscribe();
    return () => { cancelled = true; void client.removeChannel(channel); };
  }, []);

  return (
    <main className="stage-leaderboard mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 animate-fade-in">
      {/* Header */}
      <PageHeading title="ტოპ-90 საზოგადოების ქულებით" description="ყველა დრო · საზოგადოების ქულები" />

      {/* Main layout: leaderboard + stats sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: Leaderboard */}
        <div className="space-y-6">
          {/* Podium */}
          <div className="rounded-xl border border-[#1e1e24] bg-[#121215] p-4 sm:p-8">
            {podiumUsers.length > 0 ? (
              <div className="flex items-end justify-center gap-2 sm:gap-8">
                {podiumUsers[1] && <PodiumCard user={podiumUsers[1]} position="left" />}
                <PodiumCard user={podiumUsers[0]} position="center" />
                {podiumUsers[2] && <PodiumCard user={podiumUsers[2]} position="right" />}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-gray-500">{loading ? 'მონაცემები იტვირთება...' : leaderboardError ? 'რეიტინგის ჩატვირთვა ვერ მოხერხდა.' : 'რეიტინგში მონაწილეები ჯერ არ არიან.'}</div>
            )}
          </div>

          {/* Ranked list */}
          <div className="rounded-xl border border-[#1e1e24] bg-[#121215] overflow-hidden">
            <div className="border-b border-[#1e1e24] px-5 py-3">
              <h3 className="text-sm font-bold text-white">რეიტინგი 4–90</h3>
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
                    <span className="shrink-0 rounded-lg border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-sm font-bold text-blue-300">
                      {user.points}
                    </span>

                    {/* Likes */}
                    {user.likes != null && <span className="hidden sm:flex shrink-0 items-center gap-1 text-xs text-gray-500 w-20 justify-end">
                      <Heart className="h-3 w-3 text-rose-400/50" />
                      {user.likes.toLocaleString()}
                    </span>}
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
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-pink-400/10">
                  <Trophy className="h-4 w-4 text-pink-400" />
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
    </main>
  );
}
