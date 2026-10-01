/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface LoadingContextValue {
  isLoading: boolean;
  startTransition: (asyncCallback?: () => Promise<unknown> | void) => Promise<void>;
}

export const LoadingContext = createContext<LoadingContextValue | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const startTransition = useCallback(async (asyncCallback?: () => Promise<unknown> | void) => {
    // Raise the barrier before invoking navigation. The following two paint
    // frames ensure the overlay is visible before React renders the destination.
    setIsLoading(true);

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });

    // Run navigation and the cinematic loader beat concurrently. This keeps
    // the transition visible for a crisp 700ms without adding another delay
    // after the destination has finished rendering.
    const minDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 700);
    });

    try {
      await Promise.all([asyncCallback?.(), minDelay]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = isLoading ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isLoading]);

  const value = useMemo(() => ({ isLoading, startTransition }), [isLoading, startTransition]);
  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function usePageLoading() {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('usePageLoading must be used inside LoadingProvider');
  return context;
}
