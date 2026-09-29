/* eslint-env serviceworker */
// public/nex-native-sw.js
//
// Bridge 89b · NEX-native push wakeup service worker.
// ---------------------------------------------------
// Registered by _push-subscribe-hub.tsx once the user grants
// Notification permission. Scope is /nex-native/ so it doesn't
// interfere with the older trade-off /sw.js or the caching-only
// /nex-sw.js.
//
// Three jobs:
//   1. `push`              — render the incoming-call notification
//                            (or future urgent-message notification)
//                            when the tab is closed / phone locked
//   2. `notificationclick` — bring the app to foreground + deep-link
//                            into the peer chat with ?accept_call=<id>
//   3. `pushsubscriptionchange` — silently re-subscribe if the browser
//                            rotates the endpoint

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { title: "NEX", body: "You have a new notification" }; }

  const title = payload.title || "NEX";
  const options = {
    body: payload.body || "",
    icon: "/apple-touch-icon.png",
    badge: "/apple-touch-icon.png",
    tag: payload.tag || undefined,
    // Incoming calls stay on the lock screen until dismissed so the
    // user actually notices before the caller times out. Regular
    // messages fade on their own.
    requireInteraction: payload.kind === "incoming_call",
    data: payload.data || {},
    // Vibration pattern: two short buzzes for a call, one short for
    // a normal message.
    vibrate: payload.kind === "incoming_call" ? [200, 100, 200, 100, 400] : [80],
    actions: payload.kind === "incoming_call"
      ? [
          { action: "accept",  title: "Accept" },
          { action: "decline", title: "Decline" },
        ]
      : undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  const notif = event.notification;
  notif.close();
  const data = notif.data || {};
  const action = event.action;

  // Build the deep-link URL. For incoming-call notifications, honor
  // the caller-supplied url (already includes ?accept_call=<id>).
  // Decline just closes the notification · client picks up nothing.
  let url = data.url || "/nex-native/home";
  if (data.kind === "incoming_call" && action === "decline") {
    // No navigation · caller will time out. Future work: fire a POST
    // that broadcasts a bye on the signalling channel.
    return;
  }

  event.waitUntil((async () => {
    // If an existing tab is already on /nex-native/*, focus it and
    // client-side navigate rather than opening a duplicate tab.
    const allClients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    for (const client of allClients) {
      const clientUrl = new URL(client.url);
      if (clientUrl.pathname.startsWith("/nex-native/")) {
        try { await client.focus(); } catch { /* ignore */ }
        try { await client.navigate(url); } catch { /* ignore */ }
        return;
      }
    }
    // No open NEX tab · open one.
    await self.clients.openWindow(url);
  })());
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // The browser rotated our endpoint · re-subscribe silently + POST
  // the fresh subscription to the server. If VAPID public key isn't
  // available (rare corner case where SW loads before app bootstrap),
  // skip · the next app open will subscribe fresh.
  event.waitUntil((async () => {
    try {
      const cache = await caches.open("nex-native-push-config");
      const cached = await cache.match("/nex-native-push-vapid");
      const keyText = cached ? await cached.text() : null;
      if (!keyText) return;
      const key = urlBase64ToUint8Array(keyText);
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      await fetch("/api/nex-native/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscriptionToWire(sub)),
      });
    } catch { /* silent · next app open will refresh */ }
  })());
});

function subscriptionToWire(sub) {
  const raw = sub.toJSON();
  return {
    endpoint: raw.endpoint,
    p256dh: raw.keys && raw.keys.p256dh,
    auth: raw.keys && raw.keys.auth,
  };
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}
