// Nex Web Push · client-side · Philip 2026-08-03.
//
// Session-scoped subscribe/unsubscribe/schedule/cancel helpers. Wraps
// the browser Push API + POSTs to /api/nex/push with an action verb.
// Every helper returns a small typed result so callers can render
// error states honestly (denied · unsupported · needs iOS install).

export type NexPushCanEnable =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "needs_ios_install" };

export function canEnableNexPush(): NexPushCanEnable {
  if (typeof window === "undefined") return { ok: false, reason: "unsupported" };
  const hasSW = "serviceWorker" in navigator;
  const hasPush = "PushManager" in window;
  const hasNotif = "Notification" in window;
  if (!hasSW || !hasPush || !hasNotif) return { ok: false, reason: "unsupported" };
  if (Notification.permission === "denied") return { ok: false, reason: "denied" };
  // iOS Safari requires the site to be installed to home-screen (PWA).
  const ua = navigator.userAgent || "";
  const isIos = /iPhone|iPad|iPod/.test(ua);
  if (isIos) {
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone =
      nav.standalone === true ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches);
    if (!standalone) return { ok: false, reason: "needs_ios_install" };
  }
  return { ok: true };
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Clean = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Clean);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return window.btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function ensureSW(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

type PushConfig = { vapidPublicKey: string | null; ready: boolean };
let _configCache: PushConfig | null = null;
async function getPushConfig(): Promise<PushConfig> {
  if (_configCache) return _configCache;
  try {
    const res = await fetch("/api/nex/push");
    const json = await res.json();
    _configCache = {
      vapidPublicKey: json?.vapidPublicKey ?? null,
      ready: Boolean(json?.ready),
    };
  } catch {
    _configCache = { vapidPublicKey: null, ready: false };
  }
  return _configCache;
}

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "needs_ios_install" | "no_vapid" | "subscribe_failed" | "save_failed"; message?: string };

export async function enableNexPush(sessionId: string): Promise<EnableResult> {
  const gate = canEnableNexPush();
  if (!gate.ok) return gate;

  const cfg = await getPushConfig();
  if (!cfg.ready || !cfg.vapidPublicKey) {
    return { ok: false, reason: "no_vapid", message: "Server VAPID keys are not configured." };
  }

  const reg = await ensureSW();
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

  let sub: PushSubscription;
  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      sub = existing;
    } else {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey),
      });
    }
  } catch (err) {
    return {
      ok: false,
      reason: "subscribe_failed",
      message: err instanceof Error ? err.message : "Could not subscribe.",
    };
  }

  try {
    const res = await fetch("/api/nex/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        sessionId,
        subscription: {
          endpoint: sub.endpoint,
          keys: {
            p256dh: bufToB64Url(sub.getKey("p256dh")),
            auth: bufToB64Url(sub.getKey("auth")),
          },
        },
      }),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, reason: "save_failed", message: json.error };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: "save_failed",
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

export async function disableNexPush(sessionId: string): Promise<{ ok: boolean }> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try { await sub.unsubscribe(); } catch { /* best-effort */ }
      }
    }
  } catch { /* ignore */ }
  try {
    await fetch("/api/nex/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "unsubscribe", sessionId }),
    });
  } catch { /* ignore */ }
  return { ok: true };
}

// Schedule a server-side push for a task's reminder time. Idempotent —
// calling twice for the same taskId replaces the previous schedule.
export async function scheduleTaskPush(params: {
  sessionId: string;
  taskId: string;
  fireAt: number;
  title: string;
  body: string;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch("/api/nex/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "schedule",
        sessionId: params.sessionId,
        taskId: params.taskId,
        fireAt: params.fireAt,
        payload: {
          title: params.title,
          body: params.body,
          tag: `nex-task-${params.taskId}`,
          data: { url: "/nex-app/chat", kind: "task_reminder", taskId: params.taskId },
        },
      }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "network_error" };
  }
}

export async function cancelTaskPush(taskId: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch("/api/nex/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "cancel", taskId }),
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

export async function sendTestNexPush(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/nex/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "test", sessionId }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network_error" };
  }
}
