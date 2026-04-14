import { useEffect } from 'react';

declare const __BUILD_HASH__: string;

/**
 * On visibilitychange (app appear / tab focus), fetch index.html and compare
 * the embedded build hash. If it differs, force a hard reload so the user
 * always runs the latest JS.
 */
export function useVersionCheck() {
  useEffect(() => {
    const currentHash = __BUILD_HASH__;

    const check = async () => {
      try {
        // Fetch index.html with cache-bust to get the latest version
        const res = await fetch(`/?_v=${Date.now()}`, { cache: 'no-store' });
        const html = await res.text();
        // The build hash is embedded in the JS bundle URL as a content hash.
        // But simpler: we embed it as a meta tag.
        const match = html.match(/data-build-hash="([^"]+)"/);
        if (match && match[1] && match[1] !== currentHash) {
          console.log(`[version] New build detected: ${match[1]} (current: ${currentHash}). Reloading...`);
          window.location.reload();
        }
      } catch {
        // Network error — skip silently
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        check();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
}
