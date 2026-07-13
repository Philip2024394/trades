// The Network — service worker.
//
// Plain JavaScript (NOT TypeScript). Lives at the site root so it
// owns the whole origin scope for push subscription. Three jobs:
//
//   1. `push` event — render the lead-alert notification with the
//      vibration pattern the tradesperson configured for this device.
//   2. `notificationclick` — open the deep-link URL the server sent
//      (typically wa.me/<digits>, or the dashboard for commissions).
//   3. `pushsubscriptionchange` — re-fetch the new subscription and
//      POST it to /api/trade-off/push-subscriptions/subscribe so the
//      server-side row points at the live endpoint.

const PAYLOAD_FALLBACK = {
  title: 'The Network',
  body: 'You have a new alert.',
  data: { url: '/' }
};

self.addEventListener('install', (event) => {
  // Activate this SW the moment it finishes installing, even if an old
  // SW is still alive — we never need to wait for a graceful handover.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = PAYLOAD_FALLBACK;
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_err) {
      try {
        data = { ...PAYLOAD_FALLBACK, body: event.data.text() };
      } catch (_err2) {
        data = PAYLOAD_FALLBACK;
      }
    }
  }

  const title = typeof data.title === 'string' ? data.title : PAYLOAD_FALLBACK.title;
  const body = typeof data.body === 'string' ? data.body : PAYLOAD_FALLBACK.body;
  const tag = typeof data.tag === 'string' ? data.tag : 'network-lead-alert';
  const vibrate = Array.isArray(data.vibrate) ? data.vibrate : [200, 100, 200, 100, 400];
  const requireInteraction = data.requireInteraction === true;
  const payload = typeof data.data === 'object' && data.data !== null ? data.data : { url: '/' };

  const options = {
    body,
    tag,
    vibrate,
    requireInteraction,
    data: payload,
    badge: '/icon-badge.png',
    icon: '/icon-192.png',
    renotify: true,
    silent: false
  };

  // Paint the home-screen app icon badge with the unread count the
  // server included in payload.badge. Best-effort — Safari + Chromium
  // support this via the Badging API; other engines silently no-op.
  event.waitUntil(
    (async () => {
      try {
        if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
          const badgeCount = typeof payload.badge === 'number' ? payload.badge : 1;
          if (badgeCount > 0) await self.navigator.setAppBadge(badgeCount);
          else if (typeof self.navigator.clearAppBadge === 'function') await self.navigator.clearAppBadge();
        }
      } catch (_err) { /* not supported */ }
      // Tell any open client tabs to refresh their notifications feed.
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: 'tc-notification', kind: payload.kind ?? null });
        }
      } catch (_err) { /* fine */ }
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      // If a window with the same URL is already open, focus it.
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const targetUrl = new URL(target, self.location.origin);
          if (clientUrl.href === targetUrl.href && 'focus' in client) {
            return client.focus();
          }
        } catch (_err) {
          // ignore URL parse errors and fall through
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
      return null;
    })()
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const newSub = await self.registration.pushManager.subscribe(
          event.oldSubscription
            ? event.oldSubscription.options
            : { userVisibleOnly: true }
        );
        // Best-effort: tell the server about the refreshed endpoint.
        // We don't know the listing_id / edit_token here, so we POST
        // the new subscription plus the OLD endpoint_hash; the route
        // looks up the existing row and rewrites it in place.
        const oldEndpoint = event.oldSubscription ? event.oldSubscription.endpoint : null;
        await fetch('/api/trade-off/push-subscriptions/refresh', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            old_endpoint: oldEndpoint,
            endpoint: newSub.endpoint,
            p256dh_key: arrayBufferToBase64Url(newSub.getKey ? newSub.getKey('p256dh') : null),
            auth_key: arrayBufferToBase64Url(newSub.getKey ? newSub.getKey('auth') : null)
          })
        });
      } catch (_err) {
        // Best-effort — if the refresh fails, the row will be marked
        // gone on the next failed send and the tradesperson re-enables.
      }
    })()
  );
});

function arrayBufferToBase64Url(buf) {
  if (!buf) return null;
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return self.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
