import { X } from 'lucide-react';
import ReleaseCreateForm from '@/components/ReleaseCreateForm';

export default function MediaReleaseModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => Promise<void> }) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
    <div className="relative w-full max-w-2xl"><button onClick={onClose} aria-label="დახურვა" className="absolute right-4 top-4 z-10 text-gray-500 hover:text-white"><X className="h-5 w-5" /></button><ReleaseCreateForm onCreated={() => { void onSubmitted(); onClose(); }} /></div>
  </div>;
}
