import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowLeft, CalendarDays, Check, MessageSquare, Music2, Plus, Shield, SlidersHorizontal, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import ReleaseCreateForm, { type ReleaseCreated } from '@/components/ReleaseCreateForm';
import AlbumCreateForm from '@/components/AlbumCreateForm';
import ReleaseEditModal from '@/components/ReleaseEditModal';
import RoleBadge from '@/components/RoleBadge';
import RegistrationApplications from '@/components/RegistrationApplications';
import ReactionStudio from '@/components/ReactionStudio';
import ArtistAdmin from '@/components/ArtistAdmin';
import { homeSections, maintenanceTabs, saveMaintenanceSetting, type MaintenanceMap, type MaintenanceRecord } from '@/lib/maintenance';
import { formatGeorgianDate, georgianMonths, isValidCalendarDate } from '@/lib/georgianDate';

type Tab = 'releases' | 'artists' | 'studio' | 'users' | 'applications' | 'reviews' | 'concerts' | 'maintenance';
type Row = Record<string, unknown> & { is_verified?: boolean; is_active?: boolean };
interface AdminDashboardProps { onBack: () => void; onRefresh?: () => void; onReleaseCreated?: (release: ReleaseCreated) => void; onArtistClick?: (id: string) => void; maintenance: MaintenanceMap; onMaintenanceChange: (settings: MaintenanceMap | ((previous: MaintenanceMap) => MaintenanceMap)) => void; }
const roles = ['user', 'author', 'media', 'admin'];
const categories = [
  { value: 'artist', label: 'არტისტი (შემსრულებელი)' },
  { value: 'producer', label: 'პროდიუსერი (ბითმეიქერი)' },
  { value: 'sound_engineer', label: 'ხმის ინჟინერი (მიქსინგი)' },
  { value: 'designer', label: 'დიზაინერი (ვიზუალი)' },
  { value: 'videomaker', label: 'კლიპმეიკერი (ვიდეო)' },
] as const;
const input = 'rounded-lg border border-[#2a2a32] bg-[#0b0b0e] px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60';
const value = (row: Row, ...keys: string[]) => String(keys.map((key) => row[key]).find((item) => item !== undefined && item !== null) ?? '');

export default function AdminDashboard({ onBack, onRefresh, onReleaseCreated, onArtistClick, maintenance, onMaintenanceChange }: AdminDashboardProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('releases');
  const [releases, setReleases] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [reviews, setReviews] = useState<Row[]>([]);
  const [concerts, setConcerts] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [concert, setConcert] = useState({ title: '', artist: '', city: '', coverUrl: '' });
  const [concertDate, setConcertDate] = useState({ day: '', month: '', year: '' });
  const [editingRelease, setEditingRelease] = useState<Row | null>(null);
  const [maintenanceMessageDrafts, setMaintenanceMessageDrafts] = useState<Record<string, string>>({});

  const load = async (showLoading = true) => {
    if (!supabase) return;
    if (showLoading) setLoading(true);
    const [releaseResult, profileResult, reviewResult, concertResult] = await Promise.all([
      supabase.from('releases').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('is_verified', { ascending: true }).order('display_name'),
      supabase.from('reviews').select('*, profiles:user_id(display_name, artist_name, role, author_category, is_verified), releases:release_id(title)').order('created_at', { ascending: false }).limit(100),
      supabase.from('concerts').select('*').order('event_date', { ascending: true }),
    ]);
    setReleases((releaseResult.data ?? []) as Row[]); setProfiles((profileResult.data ?? []) as Row[]);
    setReviews((reviewResult.data ?? []) as Row[]); setConcerts((concertResult.data ?? []) as Row[]); setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  if (user?.role !== 'admin') return null;

  const update = async (table: string, id: string, changes: Row, setter: Dispatch<SetStateAction<Row[]>>) => {
    if (!supabase) return;
    const { error } = await supabase.from(table).update(changes).eq('id', id);
    if (error) { window.alert(`ცვლილება ვერ შეინახა: ${error.message}`); return; }
    setter((items) => items.map((item) => String(item.id) === id ? { ...item, ...changes } : item));
    if (table === 'releases' || table === 'reviews') onRefresh?.();
  };
  const remove = async (table: string, id: string, setter: Dispatch<SetStateAction<Row[]>>) => {
    if (!supabase || !window.confirm('ნამდვილად გსურთ წაშლა?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { window.alert(`წაშლა ვერ მოხერხდა: ${error.message}`); return; }
    setter((items) => items.filter((item) => String(item.id) !== id));
    if (table === 'releases' || table === 'reviews') onRefresh?.();
  };
  const handleDeleteReview = async (reviewId: string) => {
    if (!supabase || !window.confirm('ნამდვილად გსურთ რეცენზიის წაშლა?')) return;
    const { error, count } = await supabase.from('reviews').delete().eq('id', reviewId);
    if (error) { console.error('Failed to delete review:', error); window.alert(`შეცდომა რეცენზიის წაშლისას: ${error.message}`); return; }
    if (count === 0) console.warn('No review was deleted for id:', reviewId);
    setReviews((previous) => previous.filter((review) => String(review.id) !== reviewId));
    onRefresh?.();
  };
  const handleRoleChange = async (profile: Row, nextRole: string) => {
    const changes: Row = { role: nextRole, ...(nextRole === 'author' ? {} : { author_category: null }), is_verified: false };
    await update('profiles', value(profile, 'id'), changes, setProfiles);
  };
  const handleCategoryChange = async (profile: Row, rawValue: string) => {
    const newCategory = rawValue === '' || rawValue === 'none' ? null : rawValue;
    await update('profiles', value(profile, 'id'), { author_category: newCategory }, setProfiles);
  };
  const addConcert = async () => {
    if (!supabase || !concert.title.trim() || !concert.artist.trim() || !concert.city.trim()) return;
    const year = Number(concertDate.year);
    const month = Number(concertDate.month);
    const day = Number(concertDate.day);
    if (year < 1900 || !isValidCalendarDate(year, month, day)) { window.alert('აირჩიეთ სწორი თარიღი.'); return; }
    const eventDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const { data, error } = await supabase.from('concerts').insert({ tour_name: concert.title.trim(), artist_name: concert.artist.trim(), city: concert.city.trim(), event_date: eventDate, cover_url: concert.coverUrl.trim() || null, event_type: 'კონცერტი' }).select('*').single();
    if (error) { console.error('Failed to add concert:', error); window.alert('კონცერტის დამატება ვერ მოხერხდა. გადაამოწმეთ მონაცემები და სცადეთ ხელახლა.'); return; }
    if (data) setConcerts((items) => [...items, data as Row]);
    setConcert({ title: '', artist: '', city: '', coverUrl: '' });
    setConcertDate({ day: '', month: '', year: '' });
  };
  const created = (release: ReleaseCreated) => { void load(false); onReleaseCreated?.(release); };
  const setMaintenance = async (id: string, changes: Partial<MaintenanceRecord>) => {
    const title = [...maintenanceTabs, ...homeSections].find((item) => item.id === id)?.title ?? id;
    const previous = maintenance[id];
    const record: MaintenanceRecord = {
      tab_key: id,
      tab_title: changes.tab_title ?? previous?.tab_title ?? title,
      is_maintenance: changes.is_maintenance ?? previous?.is_maintenance ?? false,
      message_geo: changes.message_geo ?? previous?.message_geo ?? '',
    };
    const error = await saveMaintenanceSetting(record);
    if (error) { window.alert(`პარამეტრის შენახვა ვერ მოხერხდა: ${error.message}`); return false; }
    onMaintenanceChange((previousMap) => ({ ...previousMap, [id]: record }));
    return true;
  };
  const tabs = [{ id: 'releases' as const, label: 'რელიზები', icon: Music2 }, { id: 'artists' as const, label: 'არტისტები', icon: Users }, { id: 'studio' as const, label: 'რეაქციის სტუდია', icon: Music2 }, { id: 'users' as const, label: 'მომხმარებლები & ვერიფიკაცია', icon: Users }, { id: 'applications' as const, label: 'რეგისტრაციის განაცხადები', icon: Shield }, { id: 'reviews' as const, label: 'რეცენზიების მოდერაცია', icon: MessageSquare }, { id: 'concerts' as const, label: 'კონცერტები', icon: CalendarDays }, { id: 'maintenance' as const, label: 'მომსახურება', icon: SlidersHorizontal }];

  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" />საიტზე დაბრუნება</button>
    <div className="mb-6 flex items-center gap-3"><div className="rounded-lg bg-amber-400/10 p-2"><Shield className="h-6 w-6 text-amber-300" /></div><h1 className="text-2xl font-extrabold text-white">ადმინ პანელი</h1></div>
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-[#1e1e24] bg-[#121215] p-1">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${tab === id ? 'bg-blue-400/10 text-blue-300' : 'text-gray-500 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
    {loading ? <div className="rounded-xl border border-[#1e1e24] p-8 text-center text-sm text-gray-500">იტვირთება...</div> : <>
      {tab === 'studio' && <ReactionStudio releases={releases} />}
      {tab === 'artists' && <ArtistAdmin onArtistClick={onArtistClick} />}
      {tab === 'releases' && <div className="space-y-6"><AlbumCreateForm releases={releases} onCreated={() => { void load(false); onRefresh?.(); }} /><ReleaseCreateForm onCreated={created} onRefresh={onRefresh} compact singleOnly /><div className="overflow-x-auto rounded-xl border border-[#1e1e24] bg-[#121215]"><table className="w-full min-w-[840px] text-left text-sm"><thead className="border-b border-[#25252d] text-xs text-gray-500"><tr><th className="p-3">გარეკანი</th><th>სათაური / არტისტი</th><th>სეზონი</th><th>ფორმატი</th><th>აქტიური</th><th>მოქმედება</th></tr></thead><tbody>{releases.map((row) => <tr key={value(row, 'id')} className="border-b border-[#1e1e24] text-gray-300"><td className="p-3"><img src={value(row, 'cover_url', 'coverUrl')} alt="" className="h-11 w-11 rounded object-cover" /></td><td><p className="font-semibold text-white">{value(row, 'title')}</p><p className="text-xs text-gray-500">{value(row, 'artist_name', 'artist')}</p></td><td>{value(row, 'season')}</td><td>{value(row, 'release_type', 'type')}</td><td><button aria-label="აქტიურობის შეცვლა" onClick={() => void update('releases', value(row, 'id'), { is_active: !row.is_active }, setReleases)} className={`h-6 w-11 rounded-full p-1 ${row.is_active ? 'bg-emerald-400' : 'bg-gray-700'}`}><span className={`block h-4 w-4 rounded-full bg-white ${row.is_active ? 'translate-x-5' : ''}`} /></button></td><td><div className="flex items-center gap-2"><button type="button" onClick={() => setEditingRelease(row)} className="rounded border border-blue-500/40 bg-blue-500/20 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/30">რედაქტირება</button><button onClick={() => void remove('releases', value(row, 'id'), setReleases)} className="inline-flex items-center gap-1 text-xs text-rose-400"><Trash2 className="h-4 w-4" />წაშლა</button></div></td></tr>)}</tbody></table></div></div>}
      {tab === 'users' && <div className="overflow-x-auto rounded-xl border border-[#1e1e24] bg-[#121215] p-4"><p className="mb-4 text-sm text-gray-400">ახალი ანგარიშები ვერიფიკაციამდე შეფასებებსა და რეცენზიებს ვერ აქვეყნებენ.</p><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-[#25252d] text-xs text-gray-500"><tr><th className="p-3">მომხმარებელი</th><th>როლი</th><th>კატეგორია</th><th>ვერიფიცირებული</th></tr></thead><tbody>{profiles.map((profile) => { const role = value(profile, 'role'); const link = value(profile, 'verification_link'); const safeLink = /^https:\/\/(www\.)?(instagram\.com|youtube\.com)\//i.test(link); return <tr key={value(profile, 'id')} className="border-b border-[#1e1e24] text-gray-300"><td className="p-3"><div className="flex items-center gap-3"><img src={value(profile, 'avatar_url', 'avatar')} alt="" className="h-9 w-9 rounded-full bg-[#25252d] object-cover" /><div><span className="font-semibold text-white">{value(profile, 'display_name', 'artist_name') || 'მომხმარებელი'}</span><p className="text-xs text-gray-500">{value(profile, 'email')}</p>{safeLink && <a href={link} target="_blank" rel="noopener noreferrer" className="block max-w-xs truncate text-xs text-blue-300 underline">{link}</a>}{value(profile, 'registration_reason') && <p className="max-w-xs text-xs text-gray-400">{value(profile, 'registration_reason')}</p>}</div></div></td><td><div className="flex items-center gap-2"><RoleBadge role={role} size="compact" /><select aria-label="როლის შეცვლა" value={role || 'user'} onChange={(event) => void handleRoleChange(profile, event.target.value)} className={input}>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></td><td>{role === 'author' ? <select value={value(profile, 'author_category')} onChange={(event) => void handleCategoryChange(profile, event.target.value)} className={input}><option value="">აირჩიე</option>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select> : <span className="text-gray-600">—</span>}</td><td><button onClick={() => void update('profiles', value(profile, 'id'), { is_verified: !profile.is_verified }, setProfiles)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${profile.is_verified ? 'bg-emerald-400/10 text-emerald-300' : 'bg-gray-700/40 text-gray-400'}`}>{profile.is_verified && <Check className="h-3 w-3" />}{profile.is_verified ? 'კი' : 'არა'}</button></td></tr>; })}</tbody></table></div>}
      {tab === 'applications' && <RegistrationApplications />}
      {tab === 'reviews' && <div className="overflow-x-auto rounded-xl border border-[#1e1e24] bg-[#121215]"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-[#25252d] text-xs text-gray-500"><tr><th className="p-3">ავტორი</th><th>რელიზი</th><th>ქულა</th><th>ტექსტი</th><th>მოქმედება</th></tr></thead><tbody>{reviews.map((row) => { const profile = (row.profiles ?? {}) as Row; const release = (row.releases ?? {}) as Row; return <tr key={value(row, 'id')} className="border-b border-[#1e1e24] text-gray-300"><td className="p-3">{value(profile, 'display_name', 'artist_name')}</td><td>{value(release, 'title')}</td><td>{value(row, 'total_score', 'score')}</td><td className="max-w-xs truncate text-gray-400">{value(row, 'content', 'text', 'title')}</td><td><button onClick={() => void handleDeleteReview(value(row, 'id'))} className="inline-flex items-center gap-1 text-xs text-rose-400"><Trash2 className="h-4 w-4" />წაშლა</button></td></tr>; })}</tbody></table></div>}
      {tab === 'concerts' && <div className="space-y-5"><div className="rounded-xl border border-[#1e1e24] bg-[#121215] p-5"><h2 className="mb-4 text-lg font-bold text-white">კონცერტის დამატება</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{[['title', 'სათაური'], ['artist', 'არტისტი'], ['city', 'ქალაქი'], ['coverUrl', 'გარეკანის ბმული']].map(([key, label]) => <input key={key} type="text" placeholder={label} value={concert[key as keyof typeof concert]} onChange={(event) => setConcert({ ...concert, [key]: event.target.value })} className={input} />)}<div className="grid min-w-0 grid-cols-3 gap-1 lg:col-span-2"><select aria-label="დღე" value={concertDate.day} onChange={(event) => setConcertDate({ ...concertDate, day: event.target.value })} className={`${input} min-w-0`}><option value="">დღე</option>{Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select><select aria-label="თვე" value={concertDate.month} onChange={(event) => setConcertDate({ ...concertDate, month: event.target.value })} className={`${input} min-w-0`}><option value="">თვე</option>{georgianMonths.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select><input type="number" min="1900" max="9999" inputMode="numeric" aria-label="წელი" placeholder="წელი" value={concertDate.year} onChange={(event) => setConcertDate({ ...concertDate, year: event.target.value })} className={`${input} min-w-0`} /></div></div><button onClick={() => void addConcert()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-300 px-4 py-2 text-sm font-bold text-black"><Plus className="h-4 w-4" />დამატება</button></div>{concerts.map((item) => <div key={value(item, 'id')} className="flex items-center justify-between rounded-lg border border-[#1e1e24] bg-[#121215] p-3"><div><p className="font-semibold text-white">{value(item, 'tour_name', 'title')}</p><p className="text-xs text-gray-500">{value(item, 'artist_name')} · {value(item, 'city')} · {formatGeorgianDate(item.event_date ?? item.date)}</p></div><button onClick={() => void remove('concerts', value(item, 'id'), setConcerts)} className="text-rose-400"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
      {tab === 'maintenance' && <div className="space-y-8">
        <div className="space-y-4"><div className="rounded-xl border border-blue-400/20 bg-[#121215] p-5"><h2 className="text-lg font-bold text-white">მთავარი გვერდის განყოფილებები</h2><p className="mt-1 text-sm text-gray-500">გამორთული განყოფილება მთავარ გვერდზე აღარ გამოჩნდება. თუ მას ცალკე გვერდიც აქვს, ის დროებით დაიხურება. დარჩენილი განყოფილებები ავტომატურად გადანაწილდება.</p></div>
          {homeSections.map(({ id, title }) => { const closed = maintenance[id]?.is_maintenance === true; return <div key={id} className="flex items-center justify-between gap-4 rounded-xl border border-[#1e1e24] bg-[#121215] p-5"><div><p className="font-bold text-white">{title}</p><p className="mt-1 text-xs text-gray-500">{closed ? 'მთავარ გვერდზე დამალულია' : 'მთავარ გვერდზე ჩანს'}</p></div><button type="button" role="switch" aria-label={`${title} — მთავარ გვერდზე ჩვენება`} aria-checked={!closed} onClick={() => void setMaintenance(id, { is_maintenance: !closed })} className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${closed ? 'bg-gray-700' : 'bg-blue-400'}`}><span className={`block h-5 w-5 rounded-full bg-white transition-transform ${closed ? '' : 'translate-x-5'}`} /></button></div>; })}
        </div>
        <div className="space-y-4"><div className="rounded-xl border border-blue-400/20 bg-[#121215] p-5"><h2 className="text-lg font-bold text-white">განყოფილებების დროებითი გათიშვა</h2><p className="mt-1 text-sm text-gray-500">დროებით დამალეთ კონკრეტული განყოფილება და აჩვენეთ განმარტებითი შეტყობინება.</p></div>{maintenanceTabs.map(({ id, title }) => { const setting = maintenance[id] ?? { tab_key: id, tab_title: title, is_maintenance: false, message_geo: '' }; return <div key={id} className="flex flex-col gap-4 rounded-xl border border-[#1e1e24] bg-[#121215] p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-white">{title}</p><p className="mt-1 text-xs text-gray-500">{setting.is_maintenance ? 'მომხმარებლები ხედავენ დროებითი დახურვის ეკრანს' : 'განყოფილება ჩართულია'}</p><div className="mt-3 flex gap-2"><input value={maintenanceMessageDrafts[id] ?? setting.message_geo} onChange={(event) => setMaintenanceMessageDrafts((previous) => ({ ...previous, [id]: event.target.value }))} placeholder="მორგებული შეტყობინება (არასავალდებულო)" className={`${input} w-full sm:w-96`} /><button type="button" onClick={() => { const message = maintenanceMessageDrafts[id] ?? setting.message_geo; void setMaintenance(id, { message_geo: message }).then((saved) => { if (saved) setMaintenanceMessageDrafts((previous) => { const next = { ...previous }; delete next[id]; return next; }); }); }} className="shrink-0 rounded-lg border border-blue-400/30 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-400/10">შენახვა</button></div></div><button type="button" aria-pressed={setting.is_maintenance} onClick={() => void setMaintenance(id, { is_maintenance: !setting.is_maintenance })} className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${setting.is_maintenance ? 'bg-blue-400' : 'bg-gray-700'}`}><span className={`block h-5 w-5 rounded-full bg-white transition-transform ${setting.is_maintenance ? 'translate-x-5' : ''}`} /></button></div>; })}</div>
      </div>}
    </>}
    {editingRelease && <ReleaseEditModal release={editingRelease} onClose={() => setEditingRelease(null)} onSaved={(updated) => setReleases((items) => items.map((item) => String(item.id) === String(updated.id) ? { ...item, ...updated } : item))} onRefresh={onRefresh} />}
  </main>;
}
