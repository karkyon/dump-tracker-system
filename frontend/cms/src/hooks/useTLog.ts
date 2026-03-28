import { useEffect } from 'react';
declare global {
  interface Window {
    TLog?: {
      init: (config: object) => void;
      screenLoad: (screenId: string, screenName: string) => void;
      startTrace: (opts?: object) => void;
      stopTrace: () => void;
      log: (...args: unknown[]) => void;
      getTraceId: () => string;
    };
  }
}
export function useTLog(screenId: string, screenName: string) {
  useEffect(() => {
    window.TLog?.screenLoad(screenId, screenName);
  }, [screenId, screenName]);
}
