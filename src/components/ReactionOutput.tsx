import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { reactionSceneFromParam, type ReactionView } from '@/lib/reactionStudio';
import ReactionCanvas from '@/components/ReactionCanvas';

export default function ReactionOutput() {
  const [view, setView] = useState<ReactionView | null>(null);
  const [status, setStatus] = useState('იტვირთება...');
  const [draft, setDraft] = useState<{ releaseId: string; score: number } | null>(null);
  const [ratingStatus, setRatingStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const writeVersion = useRef(0);
  const saving = useRef(false);
  const [source] = useState(() => {
    const url = new URL(window.location.href);
    return { token: (url.searchParams.get('token') || url.hash.slice(1)).trim(), scene: reactionSceneFromParam(url.searchParams.get('scene')) };
  });

  useEffect(() => {
    document.getElementById('initial-page-loader')?.remove();
    const previousHtml = document.documentElement.style.background;
    const previousBody = document.body.style.background;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    let mounted = true;
    let inFlight = false;
    const client = supabase;
    const refresh = async () => {
      if (!client) { setStatus('მონაცემთა ბაზასთან კავშირი არ არის გამართული.'); return; }
      if (!source.token) { setStatus('გახსენით სტუდიაში დაკოპირებული სრული ბმული.'); return; }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source.token)) { setStatus('ბმული არასწორია.'); return; }
      if (inFlight) return;
      if (saving.current) return;
      const version = writeVersion.current;
      inFlight = true;
      try {
        const { data, error } = await client.rpc('reaction_session_view', { p_token: source.token });
        if (!mounted || version !== writeVersion.current) return;
        if (error) {
          setView((current) => current && Date.parse(current.expires_at) > Date.now() ? current : null);
          setStatus('კავშირი ვერ დამყარდა.');
          return;
        }
        if (!data) { setView(null); setDraft(null); setStatus('ბმულს ვადა გაუვიდა ან გაუქმებულია.'); return; }
        const next = data as unknown as ReactionView;
        setDraft((current) => current?.releaseId === String(next.release.id) ? current : null);
        setView(next);
        setStatus('');
      } catch {
        if (mounted) { setView(null); setStatus('კავშირი ვერ დამყარდა.'); }
      } finally { inFlight = false; }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 1000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.documentElement.style.background = previousHtml;
      document.body.style.background = previousBody;
    };
  }, [source]);

  const submitRating = async () => {
    if (!supabase || !view || saving.current) return;
    const score = draft?.releaseId === String(view.release.id) ? draft.score : view.score;
    saving.current = true;
    writeVersion.current += 1;
    setSubmitting(true);
    setRatingStatus('');
    try {
      const latest = await supabase.rpc('reaction_session_view', { p_token: source.token });
      if (latest.error || !latest.data) throw new Error('Session unavailable');
      const current = latest.data as unknown as ReactionView;
      if (String(current.release.id) !== String(view.release.id)) {
        setView(current); setDraft(null);
        setRatingStatus('რელიზი შეიცვალა. შეაფასეთ მიმდინარე რელიზი.');
        return;
      }
      const { data, error } = await supabase.rpc('reaction_session_submit_rating', { p_token: source.token, p_score: score });
      if (error || !data) throw new Error('Rating failed');
      setView({ ...current, score, revealed: true });
      setDraft(null);
      setRatingStatus('შეფასება გაგზავნილია.');
    } catch {
      setRatingStatus('შეფასება ვერ გაიგზავნა. სცადეთ ხელახლა.');
    } finally {
      saving.current = false;
      setSubmitting(false);
    }
  };

  if (!view) return <main className="flex min-h-screen items-center justify-center bg-[#0b0c11] p-8 text-center text-xl text-gray-300">{status}</main>;
  const displayed = draft?.releaseId === String(view.release.id) ? { ...view, score: draft.score, revealed: true } : view;
  return <main><ReactionCanvas view={displayed} scene={source.scene} onRatingChange={(score) => {
    if (saving.current) return;
    setDraft({ releaseId: String(view.release.id), score });
    setRatingStatus('ქულა ჯერ არ გაგზავნილა.');
  }} onRatingSubmit={() => void submitRating()} submittingRating={submitting} ratingStatus={ratingStatus} /></main>;
}
