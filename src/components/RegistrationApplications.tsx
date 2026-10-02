import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Application {
  id: string;
  email: string;
  display_name: string;
  requested_role: 'user' | 'author';
  social_url: string;
  registration_reason: string | null;
  created_at: string;
}

export default function RegistrationApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('registration_requests')
      .select('id, email, display_name, requested_role, social_url, registration_reason, created_at')
      .eq('status', 'pending').order('created_at', { ascending: true });
    setLoading(false);
    if (error) { setMessage('განაცხადების ჩატვირთვა ვერ მოხერხდა.'); return; }
    setApplications((data ?? []) as Application[]);
  };

  useEffect(() => { void load(); }, []);

  const decide = async (application: Application, decision: 'approve' | 'reject') => {
    if (!supabase) return;
    setMessage('');
    setActiveId(application.id);
    const { data, error } = await supabase.functions.invoke('moderate-registration', {
      body: { requestId: application.id, decision },
    });
    setActiveId(null);
    if (error || data?.error) {
      setMessage(typeof data?.error === 'string' ? data.error : 'განაცხადის განხილვა ვერ მოხერხდა.');
      return;
    }
    setMessage(decision === 'approve' ? 'განაცხადი დამტკიცდა და მოწვევა გაიგზავნა.' : 'განაცხადი უარყოფილია.');
    await load();
  };

  return <section className="rounded-xl border border-[#1e1e24] bg-[#121215] p-5">
    <h2 className="text-lg font-bold text-white">რეგისტრაციის განაცხადები</h2>
    <p className="mt-1 text-xs text-gray-400">ანგარიში მხოლოდ განაცხადის დამტკიცებისა და ელ-ფოსტით მოწვევის შემდეგ იქმნება.</p>
    {message && <p role="status" className="mt-4 text-sm text-cyan-300">{message}</p>}
    {loading ? <p className="mt-5 text-sm text-gray-500">იტვირთება...</p> : applications.length === 0 ? <p className="mt-5 text-sm text-gray-500">განსახილველი განაცხადები არ არის.</p> : <div className="mt-5 space-y-3">
      {applications.map((application) => <article key={application.id} className="rounded-lg border border-[#2a2a32] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-white">{application.display_name}</p>
            <p className="text-xs text-gray-400">{application.email} · {application.requested_role === 'author' ? 'ავტორი' : 'მომხმარებელი'}</p>
            <p className="mt-1 text-xs text-gray-500">{new Date(application.created_at).toLocaleDateString('ka-GE')}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={activeId !== null} onClick={() => void decide(application, 'approve')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-40"><Check className="h-4 w-4" />დამტკიცება</button>
            <button type="button" disabled={activeId !== null} onClick={() => void decide(application, 'reject')} className="inline-flex items-center gap-1 rounded-lg bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-300 disabled:opacity-40"><X className="h-4 w-4" />უარყოფა</button>
          </div>
        </div>
        <a href={application.social_url} target="_blank" rel="noopener noreferrer" className="mt-3 block break-all text-sm text-cyan-300 underline">{application.social_url}</a>
        {application.registration_reason && <p className="mt-2 text-sm text-gray-300">{application.registration_reason}</p>}
      </article>)}
    </div>}
  </section>;
}
