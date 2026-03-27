import { useEffect } from 'react';

declare global {
  interface Window {
    TLogAutoInstrument?: {
      init: (screenId: string, opts?: { screenName?: string }) => void;
    };
  }
}

export function useTLog(screenId: string, screenName: string) {
  useEffect(() => {
    window.TLogAutoInstrument?.init(screenId, { screenName });
  }, [screenId, screenName]);
}
