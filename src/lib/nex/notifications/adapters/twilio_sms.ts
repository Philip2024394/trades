// NEX Notifications · Twilio SMS adapter
//
// Twilio REST API · form-encoded POST to Messages.json.
//
// Env:
//   TWILIO_ACCOUNT_SID              · required
//   TWILIO_AUTH_TOKEN               · required · secret
//   TWILIO_MESSAGING_SERVICE_SID    · preferred sender (Twilio picks best number)
//   TWILIO_FROM_NUMBER              · fallback sender if no messaging service
//
// This is the ONLY file in the codebase permitted to hit
// https://api.twilio.com/*/Messages.json · every other SMS send must
// route through the Notifications Runtime (`sendNotification`).

import type { NotificationAdapter, NotificationMessage, NotificationSendResult } from "../types";

const TWILIO_API_VERSION = "2010-04-01";

export const twilioSmsAdapter: NotificationAdapter = {
  name: "twilio",
  channel: "sms",
  capabilities: {
    supportsBody: true,
    supportsMedia: false,                 // MMS support later (add MediaUrl param)
    supportsTemplate: false,               // Twilio doesn't do templates the way Meta does
    supportsDataPayload: false,
    supportsDeliveryReceipts: true,        // status callback URL · Runtime doesn't consume yet
  },
  async send(msg: NotificationMessage): Promise<NotificationSendResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token) {
      return { ok: false, provider: "twilio", reason: "TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set", retryable: false };
    }
    if (!messagingServiceSid && !fromNumber) {
      return { ok: false, provider: "twilio", reason: "neither TWILIO_MESSAGING_SERVICE_SID nor TWILIO_FROM_NUMBER set", retryable: false };
    }
    const to = msg.to[0];
    if (!to?.address) return { ok: false, provider: "twilio", reason: "no recipient", retryable: false };
    if (!msg.body) return { ok: false, provider: "twilio", reason: "SMS needs message.body (plain text)", retryable: false };

    // Twilio expects E.164 (leading + required).
    const phone = to.address.startsWith("+") ? to.address : `+${to.address.replace(/[^\d]/g, "")}`;

    const params = new URLSearchParams();
    params.set("To", phone);
    if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
    else if (fromNumber) params.set("From", fromNumber);
    params.set("Body", msg.body);

    const started = Date.now();
    try {
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const res = await fetch(`https://api.twilio.com/${TWILIO_API_VERSION}/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const json = (await res.json()) as { sid?: string; status?: string; message?: string; code?: number };
      if (!res.ok || !json.sid) {
        return {
          ok: false, provider: "twilio",
          reason: `${json.code ?? res.status}: ${json.message ?? res.statusText}`,
          retryable: res.status >= 500 || res.status === 429,
        };
      }
      return {
        ok: true, provider: "twilio",
        provider_message_id: json.sid,
        sent_at: new Date().toISOString(),
      };
    } catch (err) {
      const _elapsed = Date.now() - started;
      void _elapsed;
      return {
        ok: false, provider: "twilio",
        reason: err instanceof Error ? err.message : "unknown",
        retryable: true,
      };
    }
  },
};

export async function isTwilioSmsHealthy(): Promise<{ healthy: boolean; detail?: string }> {
  if (!process.env.TWILIO_ACCOUNT_SID) return { healthy: false, detail: "TWILIO_ACCOUNT_SID not set" };
  if (!process.env.TWILIO_AUTH_TOKEN)  return { healthy: false, detail: "TWILIO_AUTH_TOKEN not set" };
  if (!process.env.TWILIO_MESSAGING_SERVICE_SID && !process.env.TWILIO_FROM_NUMBER) {
    return { healthy: false, detail: "neither TWILIO_MESSAGING_SERVICE_SID nor TWILIO_FROM_NUMBER set" };
  }
  return { healthy: true, detail: "twilio env present · deliverability proven by audit success rate" };
}
