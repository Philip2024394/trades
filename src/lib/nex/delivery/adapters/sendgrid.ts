// NEX Delivery · SendGrid adapter
//
// REST v3 · POST /mail/send with a single personalisation.
// Docs: https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send
//
// Env: NEX_DELIVERY_SENDGRID_API_KEY

import type { DeliveryProviderAdapter, EmailMessage, ProviderEnvHint, ProviderSendResult } from "../types";

const ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

export const sendgridAdapter: DeliveryProviderAdapter = {
  id: "sendgrid",
  label: "SendGrid (REST v3)",

  isConfigured(): boolean {
    return !!process.env.NEX_DELIVERY_SENDGRID_API_KEY;
  },

  env_hints(): ProviderEnvHint[] {
    const key = process.env.NEX_DELIVERY_SENDGRID_API_KEY;
    return [{ name: "NEX_DELIVERY_SENDGRID_API_KEY", purpose: "SendGrid v3 API key with Mail Send scope", present: !!key, length: key?.length }];
  },

  async send(msg: EmailMessage): Promise<ProviderSendResult> {
    const t0 = Date.now();
    if (!this.isConfigured()) return { ok: false, error: "sendgrid not configured (NEX_DELIVERY_SENDGRID_API_KEY missing)", retriable: false, latency_ms: 0 };

    const body = {
      personalizations: [{ to: [{ email: msg.to }] }],
      from: parseAddress(msg.from),
      reply_to: msg.reply_to ? parseAddress(msg.reply_to) : undefined,
      subject: msg.subject,
      content: [
        ...(msg.text ? [{ type: "text/plain", value: msg.text }] : []),
        { type: "text/html",  value: msg.html },
      ],
      custom_args: {
        ...(msg.campaign_id ? { campaign_id: msg.campaign_id } : {}),
        ...(msg.recipient_contact_id ? { recipient_contact_id: msg.recipient_contact_id } : {}),
      },
      headers: msg.headers,
    };

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "authorization": `Bearer ${process.env.NEX_DELIVERY_SENDGRID_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const latency_ms = Date.now() - t0;
      if (res.status === 202) {
        const messageId = res.headers.get("x-message-id") ?? `sg-${Date.now().toString(36)}`;
        return { ok: true, provider_message_id: messageId, latency_ms };
      }
      const text = await res.text().catch(() => "");
      const retriable = res.status === 429 || res.status >= 500;
      return { ok: false, error: `sendgrid ${res.status}: ${text.slice(0, 300)}`, retriable, latency_ms };
    } catch (err) {
      const msg2 = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `sendgrid exception: ${msg2}`, retriable: true, latency_ms: Date.now() - t0 };
    }
  },

  async health() {
    if (!this.isConfigured()) return { ok: false, detail: "API key not set" };
    try {
      const r = await fetch("https://api.sendgrid.com/v3/scopes", { headers: { "authorization": `Bearer ${process.env.NEX_DELIVERY_SENDGRID_API_KEY}` } });
      return { ok: r.ok, detail: r.ok ? "scopes fetch succeeded" : `scopes fetch ${r.status}` };
    } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : "network error" }; }
  },
};

function parseAddress(input: string): { email: string; name?: string } {
  const m = input.match(/^\s*(?:"?([^"<]+)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?\s*$/);
  if (!m) return { email: input.trim() };
  return { email: m[2], name: m[1]?.trim() || undefined };
}
