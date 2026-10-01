import type { PageId } from '@/types/music';
import { supabase } from '@/lib/supabase';

export interface MaintenanceRecord {
  tab_key: string;
  is_maintenance: boolean;
  message_geo: string;
  tab_title: string;
}

export type MaintenanceMap = Record<string, MaintenanceRecord>;

export const maintenanceTabs: { id: PageId; title: string }[] = [
  { id: 'releases', title: 'რელიზები' },
  { id: 'top90', title: 'ტოპ-90' },
  { id: 'achievements', title: 'მიღწევები' },
  { id: 'concerts', title: 'კონცერტები' },
];

export function maintenanceMapFromRows(rows: unknown[]): MaintenanceMap {
  return rows.reduce<MaintenanceMap>((map, value) => {
    if (!value || typeof value !== 'object') return map;
    const row = value as Record<string, unknown>;
    if (typeof row.tab_key !== 'string' || !row.tab_key) return map;
    map[row.tab_key] = {
      tab_key: row.tab_key,
      is_maintenance: row.is_maintenance === true,
      message_geo: typeof row.message_geo === 'string' ? row.message_geo : '',
      tab_title: typeof row.tab_title === 'string' ? row.tab_title : row.tab_key,
    };
    return map;
  }, {});
}

export async function saveMaintenanceSetting(record: MaintenanceRecord) {
  if (!supabase) return new Error('სერვისთან კავშირი მიუწვდომელია.');
  const { error } = await supabase.from('platform_settings').upsert(record, { onConflict: 'tab_key' });
  return error;
}
