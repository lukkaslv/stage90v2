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
      <div className="relative mx-auto mb-7 font-sans text-xl font-semibold tracking-[0.12em] text-white">#STAGE90</div>
      <h1 className="relative mt-4 text-3xl font-bold tracking-tight text-white">განყოფილება დროებით დახურულია</h1>
      <p className="relative mt-3 text-sm font-semibold text-gray-300">{tabTitle}</p>
      <p className="relative mx-auto mt-5 max-w-sm text-sm leading-6 text-gray-400">
        {customMessage || 'ეს განყოფილება დროებით მიუწვდომელია ტექნიკური სამუშაოების გამო. მალე დავბრუნდებით.'}
      </p>
      <div className="relative mt-8 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-500">
        <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400" /> ტექნიკური სამუშაოები
      </div>
    </section>
  );
}
