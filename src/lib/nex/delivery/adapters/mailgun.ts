// NEX Delivery · Mailgun adapter
//
// REST v3 · POST https://{host}/v3/{domain}/messages · basic auth 'api:{key}'.
// Docs: https://documentation.mailgun.com/en/latest/api-sending.html
//
// Env: NEX_DELIVERY_MAILGUN_API_KEY
//      NEX_DELIVERY_MAILGUN_DOMAIN     (e.g. "mg.thenetworkers.app")
//      NEX_DELIVERY_MAILGUN_HOST       (default "api.mailgun.net" · "api.eu.mailgun.net" for EU region)

import type { DeliveryProviderAdapter, EmailMessage, ProviderEnvHint, ProviderSendResult } from "../types";

export const mailgunAdapter: DeliveryProviderAdapter = {
  id: "mailgun",
  label: "Mailgun (REST v3)",

  isConfigured(): boolean {
    return !!process.env.NEX_DELIVERY_MAILGUN_API_KEY && !!process.env.NEX_DELIVERY_MAILGUN_DOMAIN;
  },

  env_hints(): ProviderEnvHint[] {
    const key = process.env.NEX_DELIVERY_MAILGUN_API_KEY;
    return [
      { name: "NEX_DELIVERY_MAILGUN_API_KEY", purpose: "Mailgun sending API key", present: !!key, length: key?.length },
      { name: "NEX_DELIVERY_MAILGUN_DOMAIN",  purpose: "Verified sending domain (e.g. mg.thenetworkers.app)", present: !!process.env.NEX_DELIVERY_MAILGUN_DOMAIN },
      { name: "NEX_DELIVERY_MAILGUN_HOST",    purpose: "Region host (default api.mailgun.net · use api.eu.mailgun.net for EU)", present: !!process.env.NEX_DELIVERY_MAILGUN_HOST },
    ];
  },

  async send(msg: EmailMessage): Promise<ProviderSendResult> {
    const t0 = Date.now();
    if (!this.isConfigured()) return { ok: false, error: "mailgun not configured (API_KEY + DOMAIN required)", retriable: false, latency_ms: 0 };

    const host   = process.env.NEX_DELIVERY_MAILGUN_HOST   ?? "api.mailgun.net";
    const domain = process.env.NEX_DELIVERY_MAILGUN_DOMAIN!;
    const url = `https://${host}/v3/${encodeURIComponent(domain)}/messages`;

    const form = new URLSearchParams();
    form.set("from",    msg.from);
    form.set("to",      msg.to);
    if (msg.reply_to) form.set("h:Reply-To", msg.reply_to);
    form.set("subject", msg.subject);
    form.set("html",    msg.html);
    if (msg.text) form.set("text", msg.text);
    if (msg.campaign_id)          form.set("v:campaign_id", msg.campaign_id);
    if (msg.recipient_contact_id) form.set("v:recipient_contact_id", msg.recipient_contact_id);
    if (msg.headers) for (const [k, v] of Object.entries(msg.headers)) form.set(`h:${k}`, v);

    try {
      const authorization = `Basic ${Buffer.from(`api:${process.env.NEX_DELIVERY_MAILGUN_API_KEY}`).toString("base64")}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { authorization, "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      const latency_ms = Date.now() - t0;
      const json = await res.json().catch(() => null) as { id?: string; message?: string } | null;
      if (res.ok && json?.id) {
        return { ok: true, provider_message_id: json.id, latency_ms };
      }
      const retriable = res.status === 429 || res.status >= 500;
      return { ok: false, error: `mailgun ${res.status}: ${json?.message ?? "unknown"}`, retriable, latency_ms };
    } catch (err) {
      const msg2 = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `mailgun exception: ${msg2}`, retriable: true, latency_ms: Date.now() - t0 };
    }
  },

  async health() {
    if (!this.isConfigured()) return { ok: false, detail: "API key or domain not set" };
    try {
      const host   = process.env.NEX_DELIVERY_MAILGUN_HOST   ?? "api.mailgun.net";
      const domain = process.env.NEX_DELIVERY_MAILGUN_DOMAIN!;
      const auth = `Basic ${Buffer.from(`api:${process.env.NEX_DELIVERY_MAILGUN_API_KEY}`).toString("base64")}`;
      const r = await fetch(`https://${host}/v4/domains/${encodeURIComponent(domain)}`, { headers: { authorization: auth } });
      return { ok: r.ok, detail: r.ok ? "domain reachable" : `domain fetch ${r.status}` };
    } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : "network error" }; }
  },
};
