'use client';

/**
 * Browser-side Web Push helpers.
 *
 * The VAPID public key is fetched from the server; private material never
 * reaches the client. Subscribing always requires a user gesture.
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupport(): { supported: boolean; reason: string } {
  if (typeof window === 'undefined') return { supported: false, reason: 'Server rendering' };
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'This browser has no Service Worker support.' };
  if (!('PushManager' in window)) return { supported: false, reason: 'This browser has no Push API support.' };
  if (!('Notification' in window)) return { supported: false, reason: 'This browser has no Notification API.' };

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS && !standalone) {
    return {
      supported: false,
      reason: 'On iPhone and iPad, push notifications require YumEra added to the Home Screen (iOS 16.4 or later).',
    };
  }
  return { supported: true, reason: '' };
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function subscribeToPush(publicKey: string): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const reg = await registration();
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    }));

  return subscription.toJSON() as PushSubscriptionJSON;
}

export async function currentSubscription(): Promise<PushSubscriptionJSON | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  return sub ? (sub.toJSON() as PushSubscriptionJSON) : null;
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}
