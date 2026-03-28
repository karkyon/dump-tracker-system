import { useEffect } from 'react';
declare global {
  interface Window {
    TLog?: {
      init: (config: object) => void;
      startTrace: (opts?: object) => void;
      stopTrace: () => void;
      screenLoad: (screenId: string, screenName: string) => void;
      log: (...args: unknown[]) => void;
      getTraceId: () => string;
    };
  }
}
export function useTLog(screenId: string, screenName: string) {
  useEffect(() => {
    if (!window.TLog) return;
    window.TLog.startTrace({ screenId, screenName });
    window.TLog.screenLoad(screenId, screenName);
    return () => {
      window.TLog?.stopTrace();
    };
  }, [screenId, screenName]);
}
