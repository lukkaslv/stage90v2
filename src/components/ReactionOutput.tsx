import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ReactionView } from '@/lib/reactionStudio';
import ReactionCanvas from '@/components/ReactionCanvas';

export default function ReactionOutput() {
  const [view, setView] = useState<ReactionView | null>(null);
  const [status, setStatus] = useState('იტვირთება...');
  const [saveStatus, setSaveStatus] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [token] = useState(() => {
    const url = new URL(window.location.href);
    return (url.searchParams.get('token') || url.hash.slice(1)).trim();
  });
  const pendingRating = useRef<{ params: number[]; vibe: number } | null>(null);
  const saving = useRef(false);
  const lastInteraction = useRef(0);
  const saveTimer = useRef<number | null>(null);

  const persistRating = useCallback(async () => {
    if (!supabase || saving.current || !pendingRating.current) return;
    const rating = pendingRating.current;
    pendingRating.current = null;
    saving.current = true;
    const { data, error } = await supabase.rpc('reaction_session_rate', {
      p_token: token, p_params: rating.params, p_vibe: rating.vibe,
    });
    saving.current = false;
    if (error || !data) setSaveStatus('შეფასება ვერ შეინახა. სცადეთ ხელახლა.');
    else if (!pendingRating.current) setSaveStatus('');
    if (pendingRating.current) {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => { void persistRating(); }, 200);
    }
  }, [token]);

  const changeRating = (params: number[], vibe: number) => {
    pendingRating.current = { params, vibe };
    lastInteraction.current = Date.now();
    setView((current) => current ? { ...current, params, vibe, revealed: true } : current);
    setSaveStatus('ინახება...');
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void persistRating(); }, 200);
  };

  const submitRating = async () => {
    if (!supabase || !view || submittingRating || saving.current || pendingRating.current) return;
    setSubmittingRating(true);
    setSaveStatus('');
    const { data, error } = await supabase.rpc('reaction_session_submit_rating', {
      p_token: token, p_params: view.params, p_vibe: view.vibe,
    });
    setSubmittingRating(false);
    setSaveStatus(error || !data ? 'შეფასება ვერ გაიგზავნა. სცადეთ ხელახლა.' : 'შეფასება გაგზავნილია. საერთო ქულა განახლდა.');
  };

  useEffect(() => {
    document.getElementById('initial-page-loader')?.remove();
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
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
      if (!pendingRating.current && !saving.current && Date.now() - lastInteraction.current > 700) {
        setView(data as unknown as ReactionView);
      }
      setStatus('');
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 1000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [token]);

  if (!view) return <main className="flex min-h-screen items-center justify-center bg-[#0b0c11] p-8 text-center text-xl text-gray-300">{status}</main>;
  return <main className="min-h-screen"><ReactionCanvas view={view} onRatingChange={changeRating} onRatingSubmit={() => { void submitRating(); }} submittingRating={submittingRating} saveStatus={saveStatus} /></main>;
}
