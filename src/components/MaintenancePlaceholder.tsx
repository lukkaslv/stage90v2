import { SlidersHorizontal } from 'lucide-react';

interface MaintenancePlaceholderProps {
  tabTitle: string;
  customMessage?: string;
}

export default function MaintenancePlaceholder({ tabTitle, customMessage }: MaintenancePlaceholderProps) {
  return (
    <section className="relative my-10 mx-auto max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0C] p-12 text-center shadow-2xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[32rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(0,242,254,0.24) 0%, rgba(123,61,255,0.2) 42%, transparent 72%)' }}
      />
      <div className="relative mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-300/50 bg-[#111117] shadow-[0_0_30px_rgba(0,242,254,0.18),0_0_45px_rgba(123,61,255,0.18)]">
        <div className="absolute inset-1 rounded-xl border border-fuchsia-400/40" />
        <svg viewBox="0 0 160 80" role="img" aria-label="Stage 90 infinity mark" className="h-11 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="maintenanceInfinityGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop stopColor="#00F2FE" /><stop offset=".5" stopColor="#7B3DFF" /><stop offset="1" stopColor="#FF2ED1" /></linearGradient></defs>
          <path d="M48 22C24 22 12 30 12 40s12 18 36 18 40-36 64-36 36 8 36 18-12 18-36 18-40-36-64-36Z" stroke="url(#maintenanceInfinityGradient)" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="relative text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Stage 90 · 90</p>
      <h1 className="relative mt-4 text-3xl font-black tracking-tight text-white">STAGE 90 — დროებით დახურულია</h1>
      <p className="relative mt-3 text-sm font-semibold text-gray-300">{tabTitle}</p>
      <p className="relative mx-auto mt-5 max-w-sm text-sm leading-6 text-gray-400">
        {customMessage || 'ეს განყოფილება დროებით მიუწვდომელია ტექნიკური სამუშაოების გამო. მალე დავბრუნდებით.'}
      </p>
      <div className="relative mt-8 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-500">
        <SlidersHorizontal className="h-3.5 w-3.5 text-fuchsia-300" /> Stage 90 maintenance mode
      </div>
    </section>
  );
}
