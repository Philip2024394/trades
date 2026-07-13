// Client-side push subscription helper.
//
// Call on first sign-in from any page. Registers the service worker,
// subscribes with the app's VAPID public key, and POSTs the subscription
// to /api/apps/notifications/subscribe. Idempotent — re-running just
// refreshes the row via the endpoint upsert.

"use client";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window
    .atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function ensurePushSubscription(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  if (!("serviceWorker" in navigator))    return { ok: false, reason: "no_service_worker" };
  if (!("PushManager" in window))         return { ok: false, reason: "no_push_manager" };
  if (!VAPID_PUBLIC)                       return { ok: false, reason: "no_vapid_public_env" };

  // Ask for permission if not already granted. On iOS, must be user-initiated.
  if (Notification.permission === "default") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return { ok: false, reason: "permission_denied" };
  }
  if (Notification.permission !== "granted") return { ok: false, reason: "permission_denied" };

  const registration = await navigator.serviceWorker.register("/sw.js").catch(() => null);
  if (!registration) return { ok: false, reason: "sw_register_failed" };
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
      })
      .catch(() => null);
  }
  if (!subscription) return { ok: false, reason: "subscribe_failed" };

  const res = await fetch("/api/apps/notifications/subscribe", {
    method:  "POST",
    headers: { "content-type": "application/json" },
    body:    JSON.stringify(subscription.toJSON())
  }).catch(() => null);
  if (!res || !res.ok) return { ok: false, reason: "persist_failed" };

  return { ok: true };
}
