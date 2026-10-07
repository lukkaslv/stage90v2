import { useCallback, useState } from 'react';
import { ArrowUpRight, Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ARTIST_RANK_TIERS, artistPoints, artistTierFromRank } from '@/lib/artistRank';
import { useArtistLiveQuery } from '@/hooks/useArtistLiveQuery';
import type { RankedArtist } from '@/types/artist';
import ArtistRankBadge from '@/components/ArtistRankBadge';
import ArtistPortrait from '@/components/ArtistPortrait';
import PageHeading from '@/components/PageHeading';
import SectionLoader from '@/components/SectionLoader';
import LiveRankingIndicator from '@/components/LiveRankingIndicator';

interface Props { preview?: boolean; onArtistClick: (id: string) => void; }

export default function TopArtists({ preview = false, onArtistClick }: Props) {
  const query = useCallback(async () => {
    if (!supabase) throw new Error('Unavailable');
    const { data, error } = await supabase.from('artist_rankings').select('*').not('rank', 'is', null).order('rank').limit(15);
    if (error) throw error;
    return data as RankedArtist[];
  }, []);
  const { data, loading, error, live, reload } = useArtistLiveQuery(query);
  const artists = data ?? [];
  const entries = preview ? artists.slice(0, 6) : artists;

  const chart = <section aria-labelledby="artist-chart-title">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><span className="stage-section-marker" /><h2 id="artist-chart-title" className="text-xl font-black text-white sm:text-2xl">ყველა დროის ტოპ-15 არტისტი</h2></div>
      {live && !error && <LiveRankingIndicator compact={preview} />}
      {!live && !loading && !error && <span className="text-xs text-gray-400">პერიოდულად ახლდება</span>}
    </div>
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 border border-rose-300/30 p-3 text-sm text-rose-200">
      <span>{data ? 'რეიტინგის განახლება ვერ მოხერხდა. ნაჩვენებია ბოლო მიღებული მონაცემები.' : 'არტისტების რეიტინგი ვერ ჩაიტვირთა.'}</span>
      <button type="button" onClick={reload} className="underline underline-offset-4">ხელახლა ცდა</button>
    </div>}
    {loading && !data ? <SectionLoader /> : !error && entries.length === 0 ? <p className="stage-empty-state">რეიტინგი გამოჩნდება, როცა არტისტს მინიმუმ 3 შეფასებული ტრეკი ექნება.</p> : <ol className={preview ? 'stage-artist-preview' : 'stage-artist-leaderboard'}>
      {entries.map((artist) => {
        const tier = artistTierFromRank(artist);
        return <li key={artist.id} className={`stage-artist-${tier?.key ?? 'spark'}`}>
          <button type="button" onClick={() => onArtistClick(artist.id)} className="stage-artist-card" aria-label={`${artist.rank}. ${artist.name} — საშუალო ${artistPoints(artist.average_score)} ქულა, პროფილის ნახვა`}>
            <span className="stage-artist-position">{String(artist.rank).padStart(2, '0')}</span>
            <ArtistPortrait src={artist.photo_url} />
            <span className="stage-artist-card-copy"><strong className="stage-artist-name">{artist.name}</strong><ArtistRankBadge artist={artist} /><span className="stage-artist-meta">{artist.rated_track_count} შეფასებული ტრეკი</span></span>
            <span className="stage-artist-total"><strong>{artistPoints(artist.average_score)}/90</strong><span>საშუალო ქულა</span></span>
            <ArrowUpRight aria-hidden="true" className="stage-artist-open" />
          </button>
        </li>;
      })}
    </ol>}
  </section>;

  if (preview) return chart;
  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
    <PageHeading title="არტისტები" description="შეფასებული ტრეკების საშუალო ქულა, ცოცხალი რეიტინგი და არტისტების პროფილები." aside={<Users aria-hidden="true" className="h-9 w-9 text-blue-300" />} />
    {chart}
    <details className="stage-artist-rules">
      <summary>როგორ ითვლება რეიტინგი და სტატუსი?</summary>
      <p className="mt-4 text-sm leading-7 text-gray-300">რეიტინგში მოსახვედრად არტისტს მინიმუმ 3 შეფასებული ტრეკი სჭირდება. ადგილს განსაზღვრავს ამ ტრეკების საშუალო ქულა. თითოეული აქტიური ტრეკი ერთხელ ითვლება; ალბომისა და კრებულის ქულა ცალკე არ ემატება. საერთო ტრეკის ქულა თითოეულ დაკავშირებულ არტისტს სრულად ეთვლება. შეუფასებელი ტრეკები საშუალო ქულაში არ შედის.</p>
      <p className="mt-2 text-sm leading-7 text-gray-400">თანაბარი საშუალოსას უპირატესობა ენიჭება უფრო მეტ შეფასებულ ტრეკს, შემდეგ — უფრო ადრე შექმნილ პროფილს. სტატუსს ადგენს ადგილი და მაღალი ქულის მქონე ტრეკების რაოდენობა. თუ არტისტი თავისი ადგილის სტატუსის პირობებს ვერ აკმაყოფილებს, ენიჭება ყველაზე მაღალი სტატუსი, რომლის პირობებსაც აკმაყოფილებს. 3 შეფასებულ ტრეკამდე არტისტს ადგილი და სტატუსი არ ენიჭება.</p>
      <ul className="mt-4 flex flex-wrap gap-3">{ARTIST_RANK_TIERS.map((tier) => <li key={tier.key} className="flex flex-col gap-2"><ArtistRankBadge tier={tier} /><span className="text-xs text-gray-400">{tier.places}</span></li>)}</ul>
    </details>
    <ArtistDirectory onArtistClick={onArtistClick} />
  </main>;
}

function ArtistDirectory({ onArtistClick }: Pick<Props, 'onArtistClick'>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const term = search.trim();
  const query = useCallback(async () => {
    if (!supabase) throw new Error('Unavailable');
    let request = supabase.from('artist_rankings').select('*', { count: 'exact' }).order('name').order('id').range(page * 24, page * 24 + 23);
    if (term) request = request.ilike('name', `%${term.replace(/[\\%_]/g, '\\$&')}%`);
    const { data, error, count } = await request;
    if (error) throw error;
    return { artists: data as RankedArtist[], count: count ?? 0 };
  }, [page, term]);
  const { data, loading, error, reload } = useArtistLiveQuery(query);
  return <section aria-labelledby="artist-directory-title">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <h2 id="artist-directory-title" className="text-xl font-bold text-white">ყველა არტისტი</h2>
      <label className="relative w-full sm:w-72"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><span className="sr-only">არტისტის ძებნა</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="არტისტის ძებნა" className="w-full border border-white/20 bg-[#121215] py-2.5 pl-9 pr-3 text-sm text-white" /></label>
    </div>
    {error && <p role="alert" className="mb-4 text-sm text-rose-200">არტისტების სია ვერ განახლდა. <button onClick={reload} className="underline">ხელახლა ცდა</button></p>}
    {loading && !data ? <SectionLoader /> : <>
      {data?.artists.length === 0 && !error && <p className="stage-empty-state">{term ? 'არტისტი ვერ მოიძებნა.' : 'არტისტების პროფილები ჯერ არ დამატებულა.'}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{data?.artists.map((artist) => <button key={artist.id} type="button" onClick={() => onArtistClick(artist.id)} className={`stage-artist-directory-card stage-artist-${artistTierFromRank(artist)?.key ?? 'spark'}`}>
        <ArtistPortrait src={artist.photo_url} /><span className="min-w-0"><strong className="mb-2 block truncate text-sm text-white">{artist.name}</strong><ArtistRankBadge artist={artist} /></span>
      </button>)}</div>
    </>}
    <div className="mt-5 flex items-center justify-end gap-4 text-sm text-gray-300">
      {page > 0 && <button type="button" onClick={() => setPage((value) => value - 1)} className="stage-outline-action">წინა</button>}
      {(data?.count ?? 0) > (page + 1) * 24 && <button type="button" onClick={() => setPage((value) => value + 1)} className="stage-outline-action">შემდეგი</button>}
    </div>
  </section>;
}
