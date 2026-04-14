import { useEffect, useRef } from 'react';

interface LogEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

const MAX_ENTRIES = 200;

/**
 * Captures console.log/warn/error into a ring buffer.
 * Returns a ref to the current log entries array.
 */
export function useConsoleCapture() {
  const logsRef = useRef<LogEntry[]>([]);

  useEffect(() => {
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    function capture(level: LogEntry['level'], args: unknown[]) {
      const message = args.map(a => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(' ');

      logsRef.current.push({
        level,
        message: message.slice(0, 500), // truncate long messages
        timestamp: new Date().toISOString(),
      });

      // Keep only the last MAX_ENTRIES
      if (logsRef.current.length > MAX_ENTRIES) {
        logsRef.current = logsRef.current.slice(-MAX_ENTRIES);
      }
    }

    console.log = (...args: unknown[]) => { capture('log', args); origLog.apply(console, args); };
    console.warn = (...args: unknown[]) => { capture('warn', args); origWarn.apply(console, args); };
    console.error = (...args: unknown[]) => { capture('error', args); origError.apply(console, args); };

    // Also capture unhandled errors
    const handleError = (e: ErrorEvent) => {
      capture('error', [`Uncaught: ${e.message} at ${e.filename}:${e.lineno}`]);
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      capture('error', [`Unhandled rejection: ${e.reason}`]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return logsRef;
}
