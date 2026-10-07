import { useCallback } from 'react';
import { useArtistLiveQuery } from '@/hooks/useArtistLiveQuery';
import { supabase } from '@/lib/supabase';
import { MIN_TRACKS_FOR_ARTIST_RATING } from '@/lib/artistRating';
import type { RankedArtist } from '@/types/artist';

export function useTopArtistRankings() {
  const query = useCallback(async () => {
    if (!supabase) throw new Error('Unavailable');
    const { data, error } = await supabase.from('artist_rankings')
      .select('*').not('rank', 'is', null)
      .gte('rated_track_count', MIN_TRACKS_FOR_ARTIST_RATING)
      .order('rank').limit(15);
    if (error) throw error;
    return data as RankedArtist[];
  }, []);
  return useArtistLiveQuery(query);
}
