// Xrated Trades — VAPID + web-push wrapper.
//
// Centralises the VAPID key validation and the actual `web-push` send
// call so every route uses the same configured library instance.
//
// Throws at import time if VAPID env vars are missing — better to fail
// fast at boot than discover a misconfigured deploy when the first
// lead lands.

import "server-only";
import webpush, { type PushSubscription, type RequestOptions, type SendResult } from "web-push";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.XRATED_VAPID_PRIVATE_KEY;
const SUBJECT = process.env.XRATED_VAPID_SUBJECT;

if (!PUBLIC_KEY) {
  throw new Error("Missing NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY");
}
if (!PRIVATE_KEY) {
  throw new Error("Missing XRATED_VAPID_PRIVATE_KEY");
}
if (!SUBJECT || !/^mailto:.+@.+/.test(SUBJECT)) {
  throw new Error("XRATED_VAPID_SUBJECT must be a mailto: URI");
}

webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);

export const vapidPublicKey: string = PUBLIC_KEY;

export type WebPushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type SendPushResult =
  | { ok: true; statusCode: number }
  | { ok: false; statusCode: number | null; gone: boolean; error: string };

/** Sends a single web-push delivery. Wraps web-push to normalise the
 *  return shape and tag 404 / 410 responses as `gone:true` so the
 *  caller can disable the subscription row in one place. */
export async function sendWebPush(
  subscription: WebPushSubscriptionInput,
  payload: unknown,
  options: RequestOptions = {}
): Promise<SendPushResult> {
  const sub: PushSubscription = {
    endpoint: subscription.endpoint,
    keys: subscription.keys
  };
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  try {
    const result: SendResult = await webpush.sendNotification(sub, body, {
      TTL: 60,
      urgency: "high",
      ...options
    });
    return { ok: true, statusCode: result.statusCode };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; body?: string; message?: string };
    const statusCode = typeof e.statusCode === "number" ? e.statusCode : null;
    const gone = statusCode === 404 || statusCode === 410;
    return {
      ok: false,
      statusCode,
      gone,
      error: e.body ?? e.message ?? "Unknown push error"
    };
  }
}
