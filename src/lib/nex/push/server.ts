// Nex Web Push · server-side · Philip 2026-08-03.
//
// Owns three things:
//   1. VAPID identity (reuses the existing keys in .env.local)
//   2. In-memory subscription store keyed by nex session id
//   3. In-memory scheduled-push table keyed by taskId
//
// v1 demo storage: process memory. Restart wipes subscriptions + timers.
// Real persistence (Redis / Supabase) lands with the backend rewrite.
// Multi-instance deploys need a shared store — noted for later.

import webpush from "web-push";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.XRATED_VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.XRATED_VAPID_SUBJECT ?? "mailto:admin@nex.local";

let vapidReady = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
  } catch (err) {
    console.warn("[nex/push] VAPID setup failed:", err);
  }
}

export function isVapidConfigured(): boolean {
  return vapidReady;
}

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC ?? null;
}

// ─── Subscription store ────────────────────────────────────────────────

export type NexPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// sessionId → subscription. One subscription per session in v1 (users
// don't have multi-device in the demo; real multi-device management
// lands with the backend).
const subs = new Map<string, NexPushSubscription>();

export function storeSubscription(sessionId: string, sub: NexPushSubscription) {
  subs.set(sessionId, sub);
}

export function removeSubscription(sessionId: string) {
  subs.delete(sessionId);
  // Also cancel every scheduled push tied to this session — no point
  // firing pushes to an endpoint the browser can't receive on.
  for (const [taskId, entry] of scheduled.entries()) {
    if (entry.sessionId === sessionId) {
      clearTimeout(entry.timer);
      scheduled.delete(taskId);
    }
  }
}

export function getSubscription(sessionId: string): NexPushSubscription | null {
  return subs.get(sessionId) ?? null;
}

// ─── Scheduled pushes ─────────────────────────────────────────────────

type ScheduledPush = {
  sessionId: string;
  taskId: string;
  fireAt: number; // ms since epoch
  timer: ReturnType<typeof setTimeout>;
  payload: PushPayload;
};

export type PushPayload = {
  title: string;
  body: string;
  data?: { url?: string; taskId?: string; kind?: string; [k: string]: unknown };
  tag?: string;
  requireInteraction?: boolean;
};

// taskId → scheduled entry. Cancelling clears the timer + drops the row.
const scheduled = new Map<string, ScheduledPush>();

export async function sendPushNow(
  sub: NexPushSubscription,
  payload: PushPayload,
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  if (!vapidReady) return { ok: false, error: "VAPID not configured" };
  try {
    const res = await webpush.sendNotification(
      sub as unknown as webpush.PushSubscription,
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 }, // 24h TTL — reminders past that aren't useful
    );
    return { ok: true, statusCode: res.statusCode };
  } catch (err) {
    // 404/410 mean the subscription is gone — caller should remove it.
    const anyErr = err as { statusCode?: number; body?: string };
    return {
      ok: false,
      statusCode: anyErr.statusCode,
      error: anyErr.body ?? (err instanceof Error ? err.message : "send failed"),
    };
  }
}

export function schedulePush({
  sessionId,
  taskId,
  fireAt,
  payload,
}: {
  sessionId: string;
  taskId: string;
  fireAt: number;
  payload: PushPayload;
}): { ok: boolean; reason?: string } {
  const sub = subs.get(sessionId);
  if (!sub) return { ok: false, reason: "no_subscription" };

  // Replace any existing schedule for the same taskId (reschedule).
  const existing = scheduled.get(taskId);
  if (existing) {
    clearTimeout(existing.timer);
    scheduled.delete(taskId);
  }

  const now = Date.now();
  const delay = Math.max(0, fireAt - now);
  // Cap to setTimeout's 32-bit signed max (~24.8 days). Anything longer
  // is out of scope for v1 (would need a persistent scheduler).
  const MAX_DELAY = 2_000_000_000;
  if (delay > MAX_DELAY) return { ok: false, reason: "too_far" };

  const timer = setTimeout(async () => {
    scheduled.delete(taskId);
    const s = subs.get(sessionId);
    if (!s) return;
    const result = await sendPushNow(s, payload);
    // 404 = subscription is gone. Clean up so we don't try again.
    if (!result.ok && (result.statusCode === 404 || result.statusCode === 410)) {
      subs.delete(sessionId);
    }
  }, delay);

  scheduled.set(taskId, { sessionId, taskId, fireAt, timer, payload });
  return { ok: true };
}

export function cancelScheduledPush(taskId: string): { ok: boolean } {
  const entry = scheduled.get(taskId);
  if (!entry) return { ok: true }; // idempotent
  clearTimeout(entry.timer);
  scheduled.delete(taskId);
  return { ok: true };
}

export function debugState() {
  return {
    subscriptions: subs.size,
    scheduled: scheduled.size,
    vapidReady,
  };
}
