import { useCallback } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useArtistLiveQuery } from '@/hooks/useArtistLiveQuery';

export default function ReleaseArtists({ releaseId, onArtistClick }: { releaseId: string; onArtistClick: (id: string) => void }) {
  const query = useCallback(async () => {
    if (!supabase) throw new Error('Unavailable');
    const { data, error } = await supabase.from('artist_release_catalog').select('artist_id, artist_display_name').eq('release_id', releaseId).order('artist_display_name');
    if (error) throw error;
    return data as Array<{ artist_id: string; artist_display_name: string }>;
  }, [releaseId]);
  const { data } = useArtistLiveQuery(query);
  if (!data?.length) return null;
  return <div className="mt-3 flex flex-wrap gap-2">{data.map((artist) => <button type="button" key={artist.artist_id} onClick={() => onArtistClick(artist.artist_id)} className="stage-artist-social">{artist.artist_display_name}<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></button>)}</div>;
}
