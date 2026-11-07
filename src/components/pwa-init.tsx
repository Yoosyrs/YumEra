'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker and keeps push subscriptions in sync.
 * Notification permission is never requested here: it requires an explicit
 * user action inside Notification Settings.
 */
export function PwaInit() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch (error) {
        console.error('[pwa] service worker registration failed', error);
      }
    };
    void register();
  }, []);

  return null;
}
