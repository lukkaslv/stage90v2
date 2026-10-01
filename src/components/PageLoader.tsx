import { useEffect } from 'react';
import { usePageLoading } from '@/context/LoadingContext';

export default function PageLoader() {
  const { isLoading } = usePageLoading();

  useEffect(() => {
    document.getElementById('initial-page-loader')?.remove();
  }, []);

  return <div className={`fixed inset-0 z-[99999] flex select-none flex-col items-center justify-center overflow-hidden bg-[#0A0A0C] transition-opacity duration-300 ease-out ${isLoading ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={!isLoading}>
    <div className="absolute h-64 w-64 animate-pulse rounded-full bg-gradient-to-tr from-cyan-500/20 via-purple-600/20 to-pink-500/20 blur-3xl" />
    <div className="relative flex items-center gap-3 text-5xl font-black tracking-tight text-white sm:text-7xl"><span className="drop-shadow-[0_0_18px_rgba(255,255,255,0.2)]">STAGE</span><svg viewBox="0 0 160 80" className="h-12 w-auto sm:h-16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="90 infinity mark"><defs><linearGradient id="loaderInfinityGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#00F2FE"><animate attributeName="stop-color" values="#00F2FE;#7B3DFF;#FF2ED1;#00F2FE" dur="2.8s" repeatCount="indefinite" /></stop><stop offset="50%" stopColor="#7B3DFF"><animate attributeName="stop-color" values="#7B3DFF;#FF2ED1;#00F2FE;#7B3DFF" dur="2.8s" repeatCount="indefinite" /></stop><stop offset="100%" stopColor="#FF2ED1"><animate attributeName="stop-color" values="#FF2ED1;#00F2FE;#7B3DFF;#FF2ED1" dur="2.8s" repeatCount="indefinite" /></stop></linearGradient></defs><path d="M48 22 C 24 22, 12 30, 12 40 C 12 50, 24 58, 48 58 C 72 58, 88 22, 112 22 C 136 22, 148 30, 148 40 C 148 50, 136 58, 112 58 C 88 58, 72 22, 48 22 Z" stroke="url(#loaderInfinityGradient)" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
    <p className="relative mt-5 animate-pulse text-xs font-semibold uppercase tracking-[0.38em] text-[#F5F5F7]/80">ეს არის კავშირი</p>
  </div>;
}
