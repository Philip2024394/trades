// NEX Delivery · Generic SMTP adapter
//
// Uses `nodemailer` when available (dynamic import so it stays optional).
// Any SMTP-compatible provider works: Postfix · Amazon SES SMTP endpoint ·
// Mailgun SMTP endpoint · your own relay.
//
// Env: NEX_DELIVERY_SMTP_HOST
//      NEX_DELIVERY_SMTP_PORT       (default 587)
//      NEX_DELIVERY_SMTP_SECURE     ("true" for 465 · default false with STARTTLS)
//      NEX_DELIVERY_SMTP_USER
//      NEX_DELIVERY_SMTP_PASSWORD
//      NEX_DELIVERY_SMTP_POOL       ("true" to enable pooled connections)
//
// Adapter fails cleanly with `error: nodemailer not installed` when the
// dep is missing — no crash · shows in System Health as unhealthy.

import type { DeliveryProviderAdapter, EmailMessage, ProviderEnvHint, ProviderSendResult } from "../types";

type NodemailerTransport = {
  sendMail: (opts: {
    from: string; to: string; replyTo?: string;
    subject: string; html: string; text?: string;
    headers?: Record<string, string>;
  }) => Promise<{ messageId?: string; accepted?: string[]; rejected?: string[] }>;
  verify?: () => Promise<boolean>;
};

let cachedTransport: NodemailerTransport | null = null;
let cachedTransportError: string | null = null;

async function getTransport(): Promise<NodemailerTransport | null> {
  if (cachedTransport) return cachedTransport;
  if (cachedTransportError) return null;
  try {
    const mod = await import("nodemailer" as string) as {
      createTransport?: (opts: unknown) => NodemailerTransport;
      default?: { createTransport?: (opts: unknown) => NodemailerTransport };
    };
    const createTransport = mod.createTransport ?? mod.default?.createTransport;
    if (!createTransport) throw new Error("nodemailer.createTransport not found");

    const secure = (process.env.NEX_DELIVERY_SMTP_SECURE ?? "").toLowerCase() === "true";
    cachedTransport = createTransport({
      host: process.env.NEX_DELIVERY_SMTP_HOST,
      port: Number(process.env.NEX_DELIVERY_SMTP_PORT ?? (secure ? 465 : 587)),
      secure,
      auth: (process.env.NEX_DELIVERY_SMTP_USER && process.env.NEX_DELIVERY_SMTP_PASSWORD)
        ? { user: process.env.NEX_DELIVERY_SMTP_USER, pass: process.env.NEX_DELIVERY_SMTP_PASSWORD }
        : undefined,
      pool: (process.env.NEX_DELIVERY_SMTP_POOL ?? "").toLowerCase() === "true",
    });
    return cachedTransport;
  } catch (e) {
    cachedTransportError = e instanceof Error ? e.message : "nodemailer unavailable";
    return null;
  }
}

export const smtpAdapter: DeliveryProviderAdapter = {
  id: "smtp",
  label: "SMTP (via nodemailer · optional dep)",

  isConfigured(): boolean {
    return !!process.env.NEX_DELIVERY_SMTP_HOST;
  },

  env_hints(): ProviderEnvHint[] {
    return [
      { name: "NEX_DELIVERY_SMTP_HOST",     purpose: "SMTP relay host",                          present: !!process.env.NEX_DELIVERY_SMTP_HOST },
      { name: "NEX_DELIVERY_SMTP_PORT",     purpose: "Port (default 587 · 465 with SECURE)",     present: !!process.env.NEX_DELIVERY_SMTP_PORT },
      { name: "NEX_DELIVERY_SMTP_SECURE",   purpose: "'true' for TLS on 465 · else STARTTLS",    present: !!process.env.NEX_DELIVERY_SMTP_SECURE },
      { name: "NEX_DELIVERY_SMTP_USER",     purpose: "Auth username",                            present: !!process.env.NEX_DELIVERY_SMTP_USER },
      { name: "NEX_DELIVERY_SMTP_PASSWORD", purpose: "Auth password",                            present: !!process.env.NEX_DELIVERY_SMTP_PASSWORD, length: process.env.NEX_DELIVERY_SMTP_PASSWORD?.length },
      { name: "NEX_DELIVERY_SMTP_POOL",     purpose: "'true' to enable connection pooling",      present: !!process.env.NEX_DELIVERY_SMTP_POOL },
    ];
  },

  async send(msg: EmailMessage): Promise<ProviderSendResult> {
    const t0 = Date.now();
    if (!this.isConfigured()) return { ok: false, error: "smtp not configured (NEX_DELIVERY_SMTP_HOST missing)", retriable: false, latency_ms: 0 };
    const transport = await getTransport();
    if (!transport) return { ok: false, error: `smtp adapter unavailable · install nodemailer (${cachedTransportError ?? "unknown"})`, retriable: false, latency_ms: Date.now() - t0 };

    try {
      const info = await transport.sendMail({
        from: msg.from, to: msg.to, replyTo: msg.reply_to,
        subject: msg.subject, html: msg.html, text: msg.text,
        headers: msg.headers,
      });
      const latency_ms = Date.now() - t0;
      if ((info.rejected?.length ?? 0) > 0) {
        return { ok: false, error: `smtp rejected ${info.rejected!.length} recipient(s)`, retriable: false, latency_ms };
      }
      return { ok: true, provider_message_id: info.messageId ?? `smtp-${Date.now().toString(36)}`, latency_ms };
    } catch (err) {
      const msg2 = err instanceof Error ? err.message : String(err);
      // 4xx SMTP errors are transient (temp reject, greylist) · 5xx are permanent
      const retriable = /\b4\d\d\b|timeout|ECONNRESET|ETIMEDOUT/i.test(msg2);
      return { ok: false, error: `smtp exception: ${msg2}`, retriable, latency_ms: Date.now() - t0 };
    }
  },

  async health() {
    if (!this.isConfigured()) return { ok: false, detail: "SMTP host not set" };
    const transport = await getTransport();
    if (!transport) return { ok: false, detail: `nodemailer not installed (${cachedTransportError ?? "unknown"})` };
    try {
      const ok = transport.verify ? await transport.verify() : true;
      return { ok, detail: ok ? "SMTP verify() passed" : "SMTP verify() failed" };
    } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : "verify error" }; }
  },
};
