import { useCallback } from 'react';
import { useArtistLiveQuery } from '@/hooks/useArtistLiveQuery';
import { supabase } from '@/lib/supabase';
import type { RankedArtist } from '@/types/artist';

export function useTopArtistRankings() {
  const query = useCallback(async () => {
    if (!supabase) throw new Error('Unavailable');
    const { data, error } = await supabase.from('artist_rankings')
      .select('*').not('rank', 'is', null).order('rank').limit(15);
    if (error) throw error;
    return data as RankedArtist[];
  }, []);
  return useArtistLiveQuery(query);
}
