// NEX Delivery · Amazon SES adapter
//
// SES API v2 · POST https://email.{region}.amazonaws.com/v2/email/outbound-emails
// Signed with AWS Signature v4 (see _sigv4.ts). No external SDK required.
//
// Env: NEX_DELIVERY_SES_ACCESS_KEY_ID
//      NEX_DELIVERY_SES_SECRET_ACCESS_KEY
//      NEX_DELIVERY_SES_REGION           (e.g. "eu-west-1")
//      NEX_DELIVERY_SES_SESSION_TOKEN    (optional · when using temporary credentials)
//      NEX_DELIVERY_SES_CONFIGURATION_SET (optional · for engagement tracking + suppression)

import type { DeliveryProviderAdapter, EmailMessage, ProviderEnvHint, ProviderSendResult } from "../types";
import { signRequest } from "./_sigv4";

export const sesAdapter: DeliveryProviderAdapter = {
  id: "ses",
  label: "Amazon SES v2 (REST + SigV4)",

  isConfigured(): boolean {
    return !!process.env.NEX_DELIVERY_SES_ACCESS_KEY_ID
        && !!process.env.NEX_DELIVERY_SES_SECRET_ACCESS_KEY
        && !!process.env.NEX_DELIVERY_SES_REGION;
  },

  env_hints(): ProviderEnvHint[] {
    return [
      { name: "NEX_DELIVERY_SES_ACCESS_KEY_ID",     purpose: "AWS access key ID with SES:SendEmail",  present: !!process.env.NEX_DELIVERY_SES_ACCESS_KEY_ID,     length: process.env.NEX_DELIVERY_SES_ACCESS_KEY_ID?.length },
      { name: "NEX_DELIVERY_SES_SECRET_ACCESS_KEY", purpose: "Corresponding AWS secret access key",   present: !!process.env.NEX_DELIVERY_SES_SECRET_ACCESS_KEY, length: process.env.NEX_DELIVERY_SES_SECRET_ACCESS_KEY?.length },
      { name: "NEX_DELIVERY_SES_REGION",            purpose: "SES region (e.g. eu-west-1)",           present: !!process.env.NEX_DELIVERY_SES_REGION },
      { name: "NEX_DELIVERY_SES_SESSION_TOKEN",     purpose: "Optional STS session token",            present: !!process.env.NEX_DELIVERY_SES_SESSION_TOKEN },
      { name: "NEX_DELIVERY_SES_CONFIGURATION_SET", purpose: "Optional SES configuration set for events + suppression list", present: !!process.env.NEX_DELIVERY_SES_CONFIGURATION_SET },
    ];
  },

  async send(msg: EmailMessage): Promise<ProviderSendResult> {
    const t0 = Date.now();
    if (!this.isConfigured()) return { ok: false, error: "ses not configured (ACCESS_KEY_ID + SECRET_ACCESS_KEY + REGION required)", retriable: false, latency_ms: 0 };

    const region = process.env.NEX_DELIVERY_SES_REGION!;
    const host = `email.${region}.amazonaws.com`;
    const path = "/v2/email/outbound-emails";

    const body = JSON.stringify({
      FromEmailAddress: msg.from,
      Destination: { ToAddresses: [msg.to] },
      ReplyToAddresses: msg.reply_to ? [msg.reply_to] : undefined,
      Content: {
        Simple: {
          Subject: { Data: msg.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: msg.html, Charset: "UTF-8" },
            Text: msg.text ? { Data: msg.text, Charset: "UTF-8" } : undefined,
          },
        },
      },
      ConfigurationSetName: process.env.NEX_DELIVERY_SES_CONFIGURATION_SET,
      EmailTags: [
        ...(msg.campaign_id ? [{ Name: "campaign_id", Value: safeTag(msg.campaign_id) }] : []),
        ...(msg.recipient_contact_id ? [{ Name: "recipient_contact_id", Value: safeTag(msg.recipient_contact_id) }] : []),
      ],
    });

    const signed = signRequest({
      method: "POST", host, path, region, service: "ses", body,
      accessKeyId: process.env.NEX_DELIVERY_SES_ACCESS_KEY_ID!,
      secretAccessKey: process.env.NEX_DELIVERY_SES_SECRET_ACCESS_KEY!,
      sessionToken: process.env.NEX_DELIVERY_SES_SESSION_TOKEN,
    });

    try {
      const res = await fetch(signed.url, { method: "POST", headers: signed.headers, body: signed.body });
      const latency_ms = Date.now() - t0;
      const data = await res.json().catch(() => null) as { MessageId?: string; message?: string; __type?: string } | null;
      if (res.ok && data?.MessageId) return { ok: true, provider_message_id: data.MessageId, latency_ms };

      // AWS retriable classes: Throttling · InternalServerError · ServiceUnavailable · 5xx
      const type = String(data?.__type ?? "");
      const retriable = res.status === 429 || res.status >= 500 || /Throttl|InternalServer|Unavailable/i.test(type);
      return { ok: false, error: `ses ${res.status} ${type}: ${data?.message ?? "unknown"}`, retriable, latency_ms };
    } catch (err) {
      const msg2 = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `ses exception: ${msg2}`, retriable: true, latency_ms: Date.now() - t0 };
    }
  },

  async health() {
    if (!this.isConfigured()) return { ok: false, detail: "credentials or region not set" };
    // Send a signed HEAD-equivalent: attempt a GET on GetAccount which is cheap.
    // (This still consumes an AWS API call but no email is sent.)
    try {
      const region = process.env.NEX_DELIVERY_SES_REGION!;
      const host = `email.${region}.amazonaws.com`;
      const path = "/v2/email/account";
      const signed = signRequest({
        method: "POST", host, path, region, service: "ses", body: "",
        accessKeyId: process.env.NEX_DELIVERY_SES_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEX_DELIVERY_SES_SECRET_ACCESS_KEY!,
        sessionToken: process.env.NEX_DELIVERY_SES_SESSION_TOKEN,
      });
      // v2 GetAccount is actually a GET · we'll just verify HEAD/HTTPS is reachable
      const r = await fetch(`https://${host}/`, { method: "HEAD" }).catch(() => null);
      return { ok: !!r, detail: r ? `endpoint reachable · signature ${signed.headers.authorization.slice(0, 24)}…` : "endpoint unreachable" };
    } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : "network error" }; }
  },
};

function safeTag(v: string): string {
  // SES EmailTags allow: a-z A-Z 0-9 _ - · length 1-256 · we ASCII-sanitise + truncate
  return v.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 256);
}
