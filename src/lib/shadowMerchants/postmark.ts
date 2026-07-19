// Postmark API client — outbound sending + inbound webhook parsing.
//
// Env vars:
//   POSTMARK_SERVER_TOKEN       — one server token per Postmark server
//   POSTMARK_MESSAGE_STREAM     — usually "broadcast" for shadow-outreach
//   POSTMARK_WEBHOOK_SECRET     — shared secret we verify in webhook route
//
// If POSTMARK_SERVER_TOKEN is absent we return { ok: false, dryRun: true }
// — the send cron logs but does not actually attempt an API call. Lets
// the admin dashboard show "would have sent" during development.

import type { PostmarkSendRequest, PostmarkSendResponse } from "./types";

const API_BASE = "https://api.postmarkapp.com";

export type SendResult =
  | { ok: true; messageId: string; dryRun: false }
  | { ok: true; messageId: null; dryRun: true }
  | { ok: false; error: string; errorCode?: number };

/**
 * Send a single email via Postmark. If POSTMARK_SERVER_TOKEN is not
 * configured, no API call is made — returns dryRun so the cron can
 * still log the intended send for admin inspection.
 */
export async function sendPostmarkEmail(payload: PostmarkSendRequest): Promise<SendResult> {
  const token  = process.env.POSTMARK_SERVER_TOKEN;
  const stream = process.env.POSTMARK_MESSAGE_STREAM || "broadcast";

  if (!token) {
    console.warn("[postmark] POSTMARK_SERVER_TOKEN not set — dry-run");
    return { ok: true, messageId: null, dryRun: true };
  }

  const body: PostmarkSendRequest = {
    ...payload,
    MessageStream: payload.MessageStream || stream
  };

  try {
    const res = await fetch(`${API_BASE}/email`, {
      method: "POST",
      headers: {
        "Content-Type":            "application/json",
        Accept:                    "application/json",
        "X-Postmark-Server-Token": token
      },
      body: JSON.stringify(body)
    });

    const data = (await res.json().catch(() => ({}))) as Partial<PostmarkSendResponse>;

    if (!res.ok || (data.ErrorCode !== undefined && data.ErrorCode !== 0)) {
      return {
        ok:        false,
        error:     data.Message || `Postmark HTTP ${res.status}`,
        errorCode: data.ErrorCode
      };
    }

    return { ok: true, messageId: data.MessageID || "unknown", dryRun: false };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network-error" };
  }
}

/**
 * Postmark webhook payload shape (partial — we only use what we need).
 * https://postmarkapp.com/developer/webhooks/webhooks-overview
 */
export type PostmarkWebhookEvent = {
  RecordType:  "Delivery" | "Bounce" | "SpamComplaint" | "Open" | "Click" | "SubscriptionChange";
  MessageID:   string;
  Recipient?:  string;
  Email?:      string;
  Type?:       string;              // bounce type, if applicable
  Details?:    string;
  BouncedAt?:  string;
  DeliveredAt?: string;
  ReceivedAt?: string;
  Metadata?:   Record<string, string>;
};

/**
 * Map Postmark webhook RecordType → our EmailEventType.
 */
export function webhookEventTypeToInternal(recordType: string): "delivered" | "open" | "click" | "bounce" | "complaint" | "unsubscribe" | null {
  switch (recordType) {
    case "Delivery":            return "delivered";
    case "Open":                return "open";
    case "Click":               return "click";
    case "Bounce":              return "bounce";
    case "SpamComplaint":       return "complaint";
    case "SubscriptionChange":  return "unsubscribe";
    default:                    return null;
  }
}
