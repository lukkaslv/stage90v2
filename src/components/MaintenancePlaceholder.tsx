import { SlidersHorizontal } from 'lucide-react';

interface MaintenancePlaceholderProps {
  tabTitle: string;
  customMessage?: string;
}

export default function MaintenancePlaceholder({ tabTitle, customMessage }: MaintenancePlaceholderProps) {
  return (
    <section className="stage-maintenance my-10 mx-auto max-w-xl p-8 text-center sm:p-12">
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
