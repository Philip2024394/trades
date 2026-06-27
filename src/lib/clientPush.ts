// Xrated Trades — client-only push helpers.
//
// Browser-side primitives for the Lead Alerts dashboard card. None of
// these touch the network themselves except for `enablePush` /
// `disablePush` which POST to the subscribe / unsubscribe routes.
//
// Import only from Client Components — every helper here assumes
// `window`, `navigator`, `Notification` etc.

export type Platform = "ios" | "android" | "desktop" | "unknown";

export type CanEnableResult = {
  ok: boolean;
  reason: "ready" | "needs_install" | "denied" | "unsupported";
};

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS 13+ identifies as Mac Safari with touch — sniff the touch
  // points as a secondary signal so an iPad in desktop-UA mode still
  // sees the install gate.
  if (/Macintosh/i.test(ua) && typeof navigator !== "undefined" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints && ((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0) > 1) {
    return "ios";
  }
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return "desktop";
  return "unknown";
}

/** True if we're running as an installed PWA on iOS (Add to Home
 *  Screen). Required gate: Safari throws if you call
 *  Notification.requestPermission() from a normal Safari tab. */
export function isIosStandalone(): boolean {
  if (typeof navigator === "undefined") return false;
  // legacy Safari: navigator.standalone === true when launched from
  // the home-screen icon. Newer iOS supports the display-mode media
  // query — check both.
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export function canEnablePushHere(): CanEnableResult {
  if (typeof window === "undefined") return { ok: false, reason: "unsupported" };
  const platform = detectPlatform();
  const hasNotification = "Notification" in window;
  const hasServiceWorker = "serviceWorker" in navigator;
  const hasPushManager = "PushManager" in window;
  if (!hasNotification || !hasServiceWorker || !hasPushManager) {
    return { ok: false, reason: "unsupported" };
  }
  if (platform === "ios" && !isIosStandalone()) {
    return { ok: false, reason: "needs_install" };
  }
  if (Notification.permission === "denied") {
    return { ok: false, reason: "denied" };
  }
  return { ok: true, reason: "ready" };
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export type EnablePushResult =
  | { ok: true; endpointHash: string; platform: Platform }
  | { ok: false; reason: "needs_install" | "denied" | "unsupported" | "no_vapid" | "subscribe_failed" | "save_failed"; message?: string };

export async function enablePush({
  slug,
  editToken,
  vapidPublicKey,
  deviceLabel,
  vibrationPattern,
  mutedEvents
}: {
  slug: string;
  editToken: string;
  vapidPublicKey: string;
  deviceLabel?: string | null;
  vibrationPattern?: number[];
  mutedEvents?: string[];
}): Promise<EnablePushResult> {
  const gate = canEnablePushHere();
  if (!gate.ok) {
    if (gate.reason === "ready") {
      // unreachable, keeps the type narrow
      return { ok: false, reason: "unsupported" };
    }
    return { ok: false, reason: gate.reason };
  }
  if (!vapidPublicKey) {
    return { ok: false, reason: "no_vapid", message: "VAPID public key not configured." };
  }

  const reg = await ensureServiceWorker();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "denied" };
  }

  let sub: PushSubscription;
  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      sub = existing;
    } else {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }
  } catch (err) {
    return {
      ok: false,
      reason: "subscribe_failed",
      message: err instanceof Error ? err.message : "Could not subscribe."
    };
  }

  const platform = detectPlatform();
  const p256dh = arrayBufferToBase64Url(sub.getKey("p256dh"));
  const auth = arrayBufferToBase64Url(sub.getKey("auth"));

  try {
    const res = await fetch("/api/trade-off/push-subscriptions/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        edit_token: editToken,
        endpoint: sub.endpoint,
        p256dh_key: p256dh,
        auth_key: auth,
        user_agent: navigator.userAgent,
        platform,
        device_label: deviceLabel ?? null,
        vibration_pattern: vibrationPattern ?? null,
        muted_events: mutedEvents ?? null
      })
    });
    const json = await res.json();
    if (!json.ok) {
      return {
        ok: false,
        reason: "save_failed",
        message: json.error ?? "Couldn't save subscription."
      };
    }
    return { ok: true, endpointHash: json.endpoint_hash, platform };
  } catch (err) {
    return {
      ok: false,
      reason: "save_failed",
      message: err instanceof Error ? err.message : "Network error."
    };
  }
}

export type DisablePushResult =
  | { ok: true }
  | { ok: false; message: string };

export async function disablePush({
  slug,
  editToken,
  endpointHash
}: {
  slug: string;
  editToken: string;
  endpointHash?: string | null;
}): Promise<DisablePushResult> {
  // Unsubscribe locally — we don't want the SW to keep waking up if the
  // tradesperson said no. If we don't know the endpoint_hash yet, fall
  // back to the current registration's endpoint.
  let hash = endpointHash ?? null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        if (!hash) {
          hash = await hashEndpoint(sub.endpoint);
        }
        try {
          await sub.unsubscribe();
        } catch {
          // ignore — server-side disable is what matters
        }
      }
    }
  } catch {
    // ignore — still try server-side disable
  }
  if (!hash) {
    return { ok: false, message: "No active subscription to disable." };
  }
  try {
    const res = await fetch("/api/trade-off/push-subscriptions/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, edit_token: editToken, endpoint_hash: hash })
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, message: json.error ?? "Couldn't disable." };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error."
    };
  }
}

async function hashEndpoint(endpoint: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) return "";
  const enc = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

export async function fetchSubscriptions({
  slug,
  editToken
}: {
  slug: string;
  editToken: string;
}): Promise<{
  ok: boolean;
  subscriptions: Array<{
    endpoint_hash: string;
    platform: Platform;
    device_label: string | null;
    vibration_pattern: number[];
    muted_events: string[];
    quiet_hours_start: number | null;
    quiet_hours_end: number | null;
    enabled: boolean;
    last_used_at: string | null;
  }>;
  error?: string;
}> {
  try {
    const params = new URLSearchParams({ slug, edit_token: editToken });
    const res = await fetch(`/api/trade-off/push-subscriptions/list?${params.toString()}`);
    const json = await res.json();
    return json;
  } catch (err) {
    return {
      ok: false,
      subscriptions: [],
      error: err instanceof Error ? err.message : "Network error."
    };
  }
}

export async function sendTestPush({
  slug,
  editToken,
  endpointHash
}: {
  slug: string;
  editToken: string;
  endpointHash: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/trade-off/push-subscriptions/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, edit_token: editToken, endpoint_hash: endpointHash })
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

export async function updateSubscriptionSettings({
  slug,
  editToken,
  endpointHash,
  vibrationPattern,
  mutedEvents,
  quietHoursStart,
  quietHoursEnd
}: {
  slug: string;
  editToken: string;
  endpointHash: string;
  vibrationPattern?: number[] | null;
  mutedEvents?: string[] | null;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/trade-off/push-subscriptions/update-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        edit_token: editToken,
        endpoint_hash: endpointHash,
        vibration_pattern: vibrationPattern,
        muted_events: mutedEvents,
        quiet_hours_start: quietHoursStart,
        quiet_hours_end: quietHoursEnd
      })
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

export const VIBRATION_PRESETS: { id: string; label: string; pattern: number[] }[] = [
  { id: "subtle", label: "Subtle", pattern: [120] },
  { id: "standard", label: "Standard", pattern: [200, 100, 200, 100, 400] },
  { id: "loud", label: "Loud", pattern: [400, 100, 400, 100, 600] },
  { id: "very_loud", label: "Very loud", pattern: [600, 100, 600, 100, 600, 100, 800] }
];

export function matchVibrationPreset(pattern: number[] | null | undefined): string {
  if (!Array.isArray(pattern) || pattern.length === 0) return "standard";
  const sig = pattern.join(",");
  for (const preset of VIBRATION_PRESETS) {
    if (preset.pattern.join(",") === sig) return preset.id;
  }
  return "custom";
}
