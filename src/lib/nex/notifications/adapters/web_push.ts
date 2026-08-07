// NEX Notifications · Web Push (VAPID) adapter
//
// Web Push protocol · encrypts + signs a push envelope for a specific
// browser subscription and delivers it to the endpoint's push service
// (Chrome's FCM · Firefox's Mozilla push · Apple's Web Push, etc.).
//
// Env:
//   NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY  · required · shared with browsers
//   XRATED_VAPID_PRIVATE_KEY             · required · secret · signs push envelopes
//   XRATED_VAPID_SUBJECT                 · required · mailto: or https:// admin contact
//
// Interface convention (Runtime doctrine):
//   Push has ONE physical delivery per browser subscription. Callers
//   package a subscription in `message.data.subscription` (endpoint +
//   keys.p256dh + keys.auth). The adapter delivers that one push. Multi-
//   subscription fanout stays with the caller (typically the Registry
//   consumer that owns the subscription store).
//
// This is the ONLY file in the codebase permitted to import "web-push".

import type { NotificationAdapter, NotificationMessage, NotificationSendResult } from "../types";

type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type WebPushSendResult = { statusCode: number; body: string; headers: Record<string, string> };

type WebPushMod = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (subscription: WebPushSubscription, payload: string, options?: { TTL?: number; urgency?: "very-low" | "low" | "normal" | "high"; topic?: string }) => Promise<WebPushSendResult>;
};

let modPromise: Promise<WebPushMod | null> | null = null;
async function loadWebPush(): Promise<WebPushMod | null> {
  if (modPromise) return modPromise;
  modPromise = (async () => {
    try {
      const m = await import("web-push" as string);
      const mod = ((m as { default?: unknown }).default ?? m) as WebPushMod;
      return mod;
    } catch {
      return null;
    }
  })();
  return modPromise;
}

export const webPushAdapter: NotificationAdapter = {
  name: "web-push",
  channel: "push",
  capabilities: {
    supportsBody: true,
    supportsMedia: false,                 // Push service supports icon/image · Runtime not yet exposing
    supportsTemplate: false,
    supportsDataPayload: true,
    supportsDeliveryReceipts: false,       // Push protocol has no ack · statusCode 201 means "queued", not "shown"
  },
  async send(msg: NotificationMessage): Promise<NotificationSendResult> {
    const publicKey = process.env.NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY;
    const privateKey = process.env.XRATED_VAPID_PRIVATE_KEY;
    const subject = process.env.XRATED_VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
      return { ok: false, provider: "web-push", reason: "VAPID env missing · set NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY + XRATED_VAPID_PRIVATE_KEY + XRATED_VAPID_SUBJECT", retryable: false };
    }
    const sub = (msg.data as { subscription?: WebPushSubscription } | undefined)?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return { ok: false, provider: "web-push", reason: "push send requires message.data.subscription with endpoint + keys.p256dh + keys.auth", retryable: false };
    }

    const mod = await loadWebPush();
    if (!mod) {
      return { ok: false, provider: "web-push", reason: "`web-push` npm package not installed · run: npm install web-push", retryable: false };
    }
    mod.setVapidDetails(subject, publicKey, privateKey);

    // Payload · the browser SW receives this JSON string · commonly
    // shaped as { title, body, data } but the Runtime is agnostic.
    const payload = JSON.stringify({
      title: msg.subject ?? "NEX",
      body: msg.body ?? "",
      data: msg.data ?? null,
    });

    const started = Date.now();
    try {
      const res = await mod.sendNotification(sub, payload, {
        TTL: msg.kind === "transactional" ? 60 : 3600,     // transactional expires fast · marketing gets 1h
        urgency: msg.kind === "transactional" ? "high" : "normal",
      });
      const okStatus = res.statusCode >= 200 && res.statusCode < 300;
      if (!okStatus) {
        // 404/410 = gone subscription · caller should prune from store
        const retryable = res.statusCode === 429 || res.statusCode >= 500;
        return {
          ok: false, provider: "web-push",
          reason: `push endpoint returned ${res.statusCode}${res.body ? ": " + res.body.slice(0, 200) : ""}`,
          retryable,
        };
      }
      return {
        ok: true, provider: "web-push",
        provider_message_id: `web-push-${started}`,        // Web Push has no message id · use timestamp
        sent_at: new Date().toISOString(),
      };
    } catch (err) {
      // web-push throws WebPushError with .statusCode
      const wpErr = err as { statusCode?: number; body?: string; message?: string };
      const status = wpErr.statusCode;
      const retryable = status === 429 || (typeof status === "number" && status >= 500);
      return {
        ok: false, provider: "web-push",
        reason: `${status ?? "network"}: ${wpErr.body ?? wpErr.message ?? "unknown"}`,
        retryable,
      };
    }
  },
};

export async function isWebPushHealthy(): Promise<{ healthy: boolean; detail?: string }> {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY) missing.push("NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY");
  if (!process.env.XRATED_VAPID_PRIVATE_KEY) missing.push("XRATED_VAPID_PRIVATE_KEY");
  if (!process.env.XRATED_VAPID_SUBJECT) missing.push("XRATED_VAPID_SUBJECT");
  if (missing.length > 0) return { healthy: false, detail: `env missing: ${missing.join(", ")}` };
  const mod = await loadWebPush();
  if (!mod) return { healthy: false, detail: "`web-push` npm package not installed" };
  return { healthy: true, detail: "vapid env present + web-push module loaded" };
}
