import { useCallback, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Disc3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { artistPoints, artistTierFromRank, safeArtistUrl } from '@/lib/artistRank';
import { ARTIST_SOCIALS, type RankedArtist, type ArtistRelease } from '@/types/artist';
import { releaseTypeLabel } from '@/types/music';
import { useArtistLiveQuery } from '@/hooks/useArtistLiveQuery';
import ArtistRankBadge from '@/components/ArtistRankBadge';
import ArtistPortrait from '@/components/ArtistPortrait';
import SectionLoader from '@/components/SectionLoader';
import LiveRankingIndicator from '@/components/LiveRankingIndicator';
import { STRICT_VALUE_TIER_CONFIG, valueTierFromScore } from '@/lib/valueTier';

interface Props { id: string; onBack: () => void; onReleaseClick: (id: string) => void; }

export default function ArtistProfile({ id, onBack, onReleaseClick }: Props) {
  const [filter, setFilter] = useState<'all' | 'tracks' | 'albums'>('all');
  const query = useCallback(async () => {
    const client = supabase;
    if (!client) throw new Error('Unavailable');
    const profile = await client.from('artist_rankings').select('*').eq('id', id).maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data) return { artist: null, releases: [] as ArtistRelease[] };
    const releases: ArtistRelease[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await client.from('artist_release_catalog').select('*').eq('artist_id', id)
        .order('overall_score', { ascending: false }).order('release_id').range(offset, offset + 499);
      if (result.error) throw result.error;
      releases.push(...result.data as ArtistRelease[]);
      if (result.data.length < 500) break;
    }
    return { artist: profile.data as RankedArtist, releases };
  }, [id]);
  const { data, loading, error, live, reload } = useArtistLiveQuery(query);
  const artist = data?.artist;
  const tier = artistTierFromRank(artist);
  const releases = data?.releases.filter((release) => filter === 'all' || (filter === 'tracks' ? release.is_scoring_track : !release.is_scoring_track)) ?? [];

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white"><ArrowLeft className="h-4 w-4" />არტისტებთან დაბრუნება</button>
    {error && <p role="alert" className="mb-5 border border-rose-300/30 p-4 text-sm text-rose-200">{data ? 'პროფილის განახლება ვერ მოხერხდა. ნაჩვენებია ბოლო მიღებული მონაცემები.' : 'არტისტის პროფილი ვერ ჩაიტვირთა.'} <button onClick={reload} className="underline">ხელახლა ცდა</button></p>}
    {loading && !data ? <SectionLoader /> : !artist ? !error && <p className="stage-empty-state">არტისტის პროფილი ვერ მოიძებნა.</p> : <>
      <header className={`stage-artist-profile stage-artist-${tier?.key ?? 'spark'}`}>
        <ArtistPortrait src={artist.photo_url} />
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-3"><ArtistRankBadge artist={artist} />{live && !error && <LiveRankingIndicator />}</div>
          <h1 className="break-words text-3xl font-black text-white sm:text-5xl">{artist.name}</h1>
          {artist.bio && <p className="mt-4 max-w-2xl whitespace-pre-line break-words text-sm leading-7 text-gray-300">{artist.bio}</p>}
          <nav aria-label="არტისტის სოციალური ქსელები" className="mt-5 flex flex-wrap gap-2">{ARTIST_SOCIALS.map(({ key, label }) => {
            const url = safeArtistUrl(artist.social_links[key]);
            return url && <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="stage-artist-social">{label}<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></a>;
          })}</nav>
        </div>
      </header>
      <dl className="stage-artist-stats my-7">
        <div><dt>მიმდინარე ადგილი</dt><dd>{artist.rank ? `#${artist.rank}` : <span className="text-base">რეიტინგამდე კიდევ {3 - artist.rated_track_count} საკმარისად შეფასებული ტრეკი</span>}</dd></div>
        <div><dt>ჯამური ქულა</dt><dd>{artistPoints(artist.total_score)}</dd></div>
        <div><dt>საშუალო შეფასება</dt><dd>{artist.rated_track_count ? `${artistPoints(artist.average_score)}/90` : '—'}</dd></div>
        <div><dt>რეიტინგში ჩართული ტრეკები</dt><dd>{artist.rated_track_count}<small> / {artist.track_count}</small></dd></div>
      </dl>
      <p className="mb-7 max-w-3xl text-sm leading-6 text-gray-400">ადგილს განსაზღვრავს მინიმუმ 3 აქტიური ტრეკის საშუალო ქულა. თითოეულ ტრეკს რეიტინგში მოსახვედრად 3 დადასტურებული შემფასებელი სჭირდება. ალბომისა და კრებულის ქულა ცალკე არ ემატება. სტატუსი დამოკიდებულია ადგილსა და 60+ და 70+ ქულის მქონე ტრეკების რაოდენობაზე.</p>
      <section aria-labelledby="artist-catalog-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><h2 id="artist-catalog-title" className="text-xl font-bold text-white">რელიზები</h2><div className="stage-chart-tabs flex flex-wrap gap-2" role="group" aria-label="რელიზების ტიპი">
          {([{ key: 'all', label: 'ყველა' }, { key: 'tracks', label: 'ტრეკები' }, { key: 'albums', label: 'ალბომები და კრებულები' }] as const).map((item) => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} className={filter === item.key ? 'stage-chart-tab-active' : ''}>{item.label}</button>)}
        </div></div>
        {releases.length === 0 ? <p className="stage-empty-state">ამ განყოფილებაში რელიზები ჯერ არ არის.</p> : <ul className="stage-artist-releases">{releases.map((release) => <li key={String(release.release_id)}>
          <button type="button" onClick={() => onReleaseClick(String(release.release_id))} className="stage-artist-release">
            {safeArtistUrl(release.cover_url ?? '') ? <img src={release.cover_url!} alt="" loading="lazy" className="h-14 w-14 shrink-0 object-cover sm:h-16 sm:w-16" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-white/5"><Disc3 aria-hidden="true" className="text-gray-400" /></span>}
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-white sm:text-base">{release.title}</strong><span className="mt-1 block truncate text-xs text-gray-400">{releaseTypeLabel({ type: 'სინგლი', release_type: release.release_type })} · {release.artist_name}</span>{!release.is_scoring_track && <span className="mt-1 block text-[11px] text-gray-400">ჯამში მხოლოდ ტრეკები ითვლება</span>}</span>
            <span className="flex shrink-0 flex-col items-end gap-1.5">{release.overall_score > 0 ? <><strong className="text-sm text-white">{release.overall_score}/90</strong><span className={STRICT_VALUE_TIER_CONFIG[valueTierFromScore(release.overall_score)].badge}>{valueTierFromScore(release.overall_score)}</span></> : release.preliminary_score > 0 ? <><strong className="text-sm text-white">{release.preliminary_score}/90</strong><span className="text-[11px] text-gray-400">წინასწარი · {release.eligible_voter_count}/3</span></> : <span className="text-xs text-gray-400">შეუფასებელი</span>}</span>
            <ArrowUpRight aria-hidden="true" className="hidden h-4 w-4 text-gray-500 sm:block" />
          </button>
        </li>)}</ul>}
      </section>
    </>}
  </main>;
}
