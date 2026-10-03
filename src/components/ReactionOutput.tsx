import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ReactionView } from '@/lib/reactionStudio';
import ReactionCanvas from '@/components/ReactionCanvas';

export default function ReactionOutput() {
  const [view, setView] = useState<ReactionView | null>(null);
  const [status, setStatus] = useState('იტვირთება...');

  useEffect(() => {
    document.getElementById('initial-page-loader')?.remove();
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    const url = new URL(window.location.href);
    const token = (url.searchParams.get('token') || url.hash.slice(1)).trim();
    if (!supabase) {
      setStatus('მონაცემთა ბაზასთან კავშირი არ არის გამართული.');
      return;
    }
    if (!token) {
      setStatus('გახსენით სტუდიაში დაკოპირებული სრული OBS-ის ბმული.');
      return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      setStatus('ბმული არასწორია.');
      return;
    }
    const client = supabase;
    let mounted = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      const { data, error } = await client.rpc('reaction_session_view', { p_token: token });
      inFlight = false;
      if (!mounted) return;
      if (error) { setStatus('კავშირი ვერ დამყარდა.'); return; }
      if (!data) { setView(null); setStatus('ბმულს ვადა გაუვიდა ან გაუქმებულია.'); return; }
      setView(data as unknown as ReactionView);
      setStatus('');
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 1000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  if (!view) return <main className="flex min-h-screen items-center justify-center bg-[#0b0c11] p-8 text-center text-xl text-gray-300">{status}</main>;
  return <main className="min-h-screen"><ReactionCanvas view={view} /></main>;
}
