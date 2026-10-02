import { LoaderCircle, X } from 'lucide-react';

export default function SectionLoader({ onClose }: { onClose?: () => void }) {
  return (
    <div className={onClose
      ? 'fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm'
      : 'flex min-h-[40vh] items-center justify-center px-4'}>
      {onClose && <button type="button" onClick={onClose} aria-label="დახურვა" className="absolute right-6 top-6 rounded-lg p-2 text-gray-400 hover:text-white">
        <X className="h-5 w-5" />
      </button>}
      <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm text-gray-400">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none text-blue-400" />
        <span>იტვირთება…</span>
      </div>
    </div>
  );
}
