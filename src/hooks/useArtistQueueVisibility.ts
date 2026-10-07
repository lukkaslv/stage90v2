import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getQueue, type ArtistQueueEntry } from '@/lib/artistQueue';

const QUEUE_SETTING_KEY = 'obs-artist-queue';

export function useArtistQueueVisibility() {
  const [visible, setVisible] = useState(true);
  const [queue, setQueue] = useState<ArtistQueueEntry[]>([]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    const refresh = async () => {
      const { data, error } = await client.from('platform_settings')
        .select('is_maintenance, message_geo').eq('tab_key', QUEUE_SETTING_KEY).maybeSingle();
      if (active && !error) {
        setVisible(data?.is_maintenance !== true);
        const next = getQueue(data?.message_geo ?? null);
        setQueue((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return { visible, setVisible, queue, setQueue };
}

export async function saveArtistQueueVisibility(visible: boolean) {
  if (!supabase) return false;
  const updated = await supabase.from('platform_settings')
    .update({ is_maintenance: !visible }).eq('tab_key', QUEUE_SETTING_KEY).select('tab_key');
  if (updated.error) return false;
  if (updated.data.length > 0) return true;
  const { error } = await supabase.from('platform_settings').insert({
    tab_key: QUEUE_SETTING_KEY,
    tab_title: 'არტისტების რიგი',
    is_maintenance: !visible,
    message_geo: '[]',
  });
  return !error;
}

export async function saveArtistQueue(entries: ArtistQueueEntry[]) {
  if (!supabase) return false;
  const message = JSON.stringify(getQueue(JSON.stringify(entries)));
  const updated = await supabase.from('platform_settings')
    .update({ message_geo: message }).eq('tab_key', QUEUE_SETTING_KEY).select('tab_key');
  if (updated.error) return false;
  if (updated.data.length > 0) return true;
  const { error } = await supabase.from('platform_settings').insert({
    tab_key: QUEUE_SETTING_KEY,
    tab_title: 'არტისტების რიგი',
    is_maintenance: false,
    message_geo: message,
  });
  return !error;
}
