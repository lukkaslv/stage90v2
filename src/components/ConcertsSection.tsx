import { useEffect, useState } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ConcertEvent { id: string | number; artist: string; tour: string; date: string; city: string; type: string; image: string; }

function formatDate(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('ka-GE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export default function ConcertsSection() {
  const [events, setEvents] = useState<ConcertEvent[]>([]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const loadConcerts = async () => {
      const { data, error } = await client.from('concerts').select('*').order('created_at', { ascending: false });
      if (error || !data) return;
      setEvents(data.map((row, index) => {
        const item = row as Record<string, unknown>;
        return {
          id: typeof item.id === 'number' ? item.id : String(item.id ?? index),
          artist: String(item.artist ?? item.artist_name ?? item.name ?? ''),
          tour: String(item.tour ?? item.title ?? item.event_name ?? ''),
          date: formatDate(item.event_date ?? item.date ?? item.start_date),
          city: String(item.city ?? item.location ?? ''),
          type: String(item.category ?? item.type ?? item.event_type ?? ''),
          image: String(item.poster_url ?? item.image_url ?? item.image ?? ''),
        };
      }));
    };
    void loadConcerts();
  }, []);

  return <section className="animate-fade-in" aria-labelledby="concerts-heading">
    <div className="mb-5 flex items-center justify-between gap-4"><h2 id="concerts-heading" className="text-xl font-bold text-white sm:text-2xl">კონცერტები, ტურები და ფესტივალები</h2></div>
    {events.length === 0 ? <div className="rounded-xl border border-dashed border-[#2a2a32] bg-[#121215] px-6 py-6 text-center text-sm text-gray-500">კონცერტები და ტურები მალე დაემატება.</div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{events.map((event) => { const city = event.city.toLowerCase().includes('ბათ') ? 'ბათუმი' : event.city.toLowerCase().includes('თბილ') ? 'თბილისი' : event.city; const category = event.type.toLowerCase().includes('tour') || event.type.includes('ტურ') ? 'ტური' : 'კონცერტი'; return <article key={event.id} className="card-hover min-w-0 overflow-hidden rounded-xl border border-[#1e1e24] bg-[#121215]">
      <div className="relative h-40 overflow-hidden">{event.image ? <img src={event.image} alt={event.artist || event.tour} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy" /> : <div className="h-full w-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20" />}<span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">{city || 'საქართველო'}</span><span className="absolute right-3 top-3 rounded-full bg-cyan-400/90 px-2.5 py-1 text-[10px] font-bold text-black">{category}</span></div>
      <div className="p-4"><h3 className="truncate text-sm font-bold text-white">{event.tour || event.artist}</h3>{event.artist && event.tour && <p className="mt-0.5 truncate text-xs text-gray-400">{event.artist}</p>}<div className="mt-4 space-y-2 text-[11px] text-gray-500">{event.date && <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-cyan-400" />{event.date}</span>}{city && <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-violet-400" />{city}</span>}</div></div>
    </article>; })}</div>}
  </section>;
}
