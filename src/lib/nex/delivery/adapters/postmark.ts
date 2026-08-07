// NEX Delivery · Postmark adapter
//
// REST · POST https://api.postmarkapp.com/email · X-Postmark-Server-Token header.
// Docs: https://postmarkapp.com/developer/user-guide/send-email-with-api
//
// Env: NEX_DELIVERY_POSTMARK_SERVER_TOKEN
//      NEX_DELIVERY_POSTMARK_MESSAGE_STREAM  (default "outbound" · use a
//                                              broadcast stream ID for marketing)

import type { DeliveryProviderAdapter, EmailMessage, ProviderEnvHint, ProviderSendResult } from "../types";

const ENDPOINT = "https://api.postmarkapp.com/email";

export const postmarkAdapter: DeliveryProviderAdapter = {
  id: "postmark",
  label: "Postmark (REST)",

  isConfigured(): boolean {
    return !!process.env.NEX_DELIVERY_POSTMARK_SERVER_TOKEN;
  },

  env_hints(): ProviderEnvHint[] {
    const key = process.env.NEX_DELIVERY_POSTMARK_SERVER_TOKEN;
    return [
      { name: "NEX_DELIVERY_POSTMARK_SERVER_TOKEN",    purpose: "Postmark Server API token", present: !!key, length: key?.length },
      { name: "NEX_DELIVERY_POSTMARK_MESSAGE_STREAM",  purpose: "Message stream id (default 'outbound' · use a broadcast stream for marketing)", present: !!process.env.NEX_DELIVERY_POSTMARK_MESSAGE_STREAM },
    ];
  },

  async send(msg: EmailMessage): Promise<ProviderSendResult> {
    const t0 = Date.now();
    if (!this.isConfigured()) return { ok: false, error: "postmark not configured (SERVER_TOKEN missing)", retriable: false, latency_ms: 0 };

    const body = {
      From: msg.from,
      To: msg.to,
      ReplyTo: msg.reply_to,
      Subject: msg.subject,
      HtmlBody: msg.html,
      TextBody: msg.text ?? undefined,
      MessageStream: process.env.NEX_DELIVERY_POSTMARK_MESSAGE_STREAM ?? "outbound",
      Metadata: {
        ...(msg.campaign_id ? { campaign_id: msg.campaign_id } : {}),
        ...(msg.recipient_contact_id ? { recipient_contact_id: msg.recipient_contact_id } : {}),
      },
      Headers: msg.headers ? Object.entries(msg.headers).map(([Name, Value]) => ({ Name, Value })) : undefined,
    };

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": process.env.NEX_DELIVERY_POSTMARK_SERVER_TOKEN!,
        },
        body: JSON.stringify(body),
      });
      const latency_ms = Date.now() - t0;
      const data = await res.json().catch(() => null) as { MessageID?: string; ErrorCode?: number; Message?: string } | null;
      if (res.ok && data?.MessageID) {
        return { ok: true, provider_message_id: data.MessageID, latency_ms };
      }
      // Postmark ErrorCode 300+ are non-retriable · 4xx/5xx from HTTP layer treated normally
      const retriable = res.status === 429 || res.status >= 500;
      return { ok: false, error: `postmark ${res.status} ${data?.ErrorCode ?? ""}: ${data?.Message ?? "unknown"}`, retriable, latency_ms };
    } catch (err) {
      const msg2 = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `postmark exception: ${msg2}`, retriable: true, latency_ms: Date.now() - t0 };
    }
  },

  async health() {
    if (!this.isConfigured()) return { ok: false, detail: "server token not set" };
    try {
      const r = await fetch("https://api.postmarkapp.com/server", {
        headers: { "Accept": "application/json", "X-Postmark-Server-Token": process.env.NEX_DELIVERY_POSTMARK_SERVER_TOKEN! },
      });
      return { ok: r.ok, detail: r.ok ? "server reachable" : `server fetch ${r.status}` };
    } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : "network error" }; }
  },
};
