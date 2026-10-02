import { useEffect } from 'react';
import { usePageLoading } from '@/context/LoadingContext';

export default function PageLoader() {
  const { isLoading } = usePageLoading();

  useEffect(() => {
    document.getElementById('initial-page-loader')?.remove();
  }, []);

  return <div className={`fixed inset-0 z-[99999] flex select-none items-center justify-center overflow-hidden bg-[#0A0A0C] transition-opacity duration-300 ease-out ${isLoading ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={!isLoading}>
    <div className="font-sans text-4xl font-semibold tracking-[0.14em] text-white sm:text-6xl">#STAGE90</div>
  </div>;
}
