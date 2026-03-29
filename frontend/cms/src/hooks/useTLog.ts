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

    const existingTraceId = window.TLog.getTraceId();
    if (!existingTraceId) {
      window.TLog.startTrace({ screenId, screenName });
    }

    window.TLog.screenLoad(screenId, screenName);
  }, [screenId, screenName]);
}
