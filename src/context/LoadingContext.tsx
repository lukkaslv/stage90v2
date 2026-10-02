/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface LoadingContextValue {
  isLoading: boolean;
  startTransition: (asyncCallback?: () => Promise<unknown> | void) => Promise<void>;
}

export const LoadingContext = createContext<LoadingContextValue | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [pendingTransitions, setPendingTransitions] = useState(0);
  const isLoading = pendingTransitions > 0;
  const startTransition = useCallback(async (asyncCallback?: () => Promise<unknown> | void) => {
    const pending = asyncCallback?.();
    if (!pending) return;

    setPendingTransitions((count) => count + 1);
    try {
      await pending;
    } finally {
      setPendingTransitions((count) => count - 1);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isLoading]);

  const value = useMemo(() => ({ isLoading, startTransition }), [isLoading, startTransition]);
  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function usePageLoading() {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('usePageLoading must be used inside LoadingProvider');
  return context;
}
