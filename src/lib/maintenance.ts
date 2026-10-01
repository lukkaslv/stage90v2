import type { PageId } from '@/types/music';
import { supabase } from '@/lib/supabase';

export type MaintenanceSetting = { enabled: boolean; message?: string };
export type MaintenanceSettings = Record<PageId, MaintenanceSetting>;

export const maintenanceTabs: { id: PageId; title: string }[] = [
  { id: 'releases', title: 'რელიზები' },
  { id: 'top90', title: 'ტოპ-90' },
  { id: 'achievements', title: 'მიღწევები' },
  { id: 'concerts', title: 'კონცერტები' },
];

export const defaultMaintenanceSettings: MaintenanceSettings = {
  releases: { enabled: false }, top90: { enabled: false }, achievements: { enabled: false }, concerts: { enabled: false },
};

const storageKey = 'stage90-maintenance-settings';

function normalize(value: unknown): MaintenanceSettings {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return maintenanceTabs.reduce((result, tab) => {
    const item = source[tab.id];
    const setting = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    result[tab.id] = { enabled: setting.enabled === true, ...(typeof setting.message === 'string' && setting.message.trim() ? { message: setting.message } : {}) };
    return result;
  }, { ...defaultMaintenanceSettings });
}

export async function loadMaintenanceSettings(): Promise<MaintenanceSettings> {
  let stored: unknown = {};
  try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { stored = {}; }
  const local = normalize(stored);
  if (!supabase) return local;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'maintenance_tabs').maybeSingle();
  return data?.value ? normalize(data.value) : local;
}

export async function saveMaintenanceSettings(settings: MaintenanceSettings) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
  if (!supabase) return;
  await supabase.from('site_settings').upsert({ key: 'maintenance_tabs', value: settings }, { onConflict: 'key' });
}
