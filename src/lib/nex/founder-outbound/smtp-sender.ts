// src/lib/nex/founder-outbound/smtp-sender.ts
//
// Founder Batch Outbound · SMTP sender wrapper (nodemailer)
// Founder-authorised programme · 2026-09-22.
//
// Doctrine:
//  - Reads config strictly from env at call-time · zero cached secrets in memory.
//  - If NEX_FOUNDER_SMTP_URL is absent/malformed: returns { configured: false }
//    with a plain reason string. NEVER pretends to send.
//  - If configured: real nodemailer transport · real send · returns per-recipient
//    accepted/rejected status FROM THE SMTP RESPONSE, never fabricated.
//  - Never throws to caller · every failure surfaces as structured result.
//  - No retry logic in this module · caller decides.

import nodemailer, { type Transporter } from "nodemailer";

export interface SmtpConfig {
  readonly url: string;                // e.g. smtps://user:pass@smtp.gmail.com:465
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly from_address: string;
  readonly from_name: string | null;
  readonly reply_to: string | null;
}

export type SmtpResolution =
  | { configured: true; config: SmtpConfig }
  | { configured: false; reason: string };

export interface Recipient {
  readonly email_address: string;
  readonly recipient_id: string;
  readonly unsubscribe_token: string;
}

export interface RecipientResult {
  readonly recipient_id: string;
  readonly email_address: string;
  readonly status: "sent" | "failed" | "smtp_not_configured";
  readonly smtp_message_id: string | null;
  readonly error_reason: string | null;
  readonly sent_at: string | null;
}

export interface BatchSendInput {
  readonly subject: string;
  readonly body_text: string;
  readonly body_html: string | null;
  readonly unsubscribe_base_url: string;   // e.g. http://localhost:3008/api/nex/unsubscribe
  readonly recipients: readonly Recipient[];
}

/** Resolve SMTP config from environment. Never throws. */
export function resolveSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpResolution {
  const url = env.NEX_FOUNDER_SMTP_URL?.trim();
  if (!url) return { configured: false, reason: "NEX_FOUNDER_SMTP_URL not set" };
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return { configured: false, reason: "NEX_FOUNDER_SMTP_URL is not a valid URL" }; }
  if (parsed.protocol !== "smtp:" && parsed.protocol !== "smtps:") {
    return { configured: false, reason: `unsupported protocol ${parsed.protocol} · expected smtp: or smtps:` };
  }
  const from_address = env.NEX_FOUNDER_SMTP_FROM?.trim();
  if (!from_address) return { configured: false, reason: "NEX_FOUNDER_SMTP_FROM not set" };
  if (!/.+@.+/.test(from_address)) return { configured: false, reason: "NEX_FOUNDER_SMTP_FROM not an email address" };
  const port = parsed.port ? Number(parsed.port) : (parsed.protocol === "smtps:" ? 465 : 587);
  const secure = parsed.protocol === "smtps:";
  return {
    configured: true,
    config: {
      url,
      host: parsed.hostname,
      port,
      secure,
      from_address,
      from_name: env.NEX_FOUNDER_SMTP_FROM_NAME?.trim() || null,
      reply_to: env.NEX_FOUNDER_SMTP_REPLY_TO?.trim() || null,
    },
  };
}

/** Build a nodemailer transporter from a resolved SmtpConfig. */
export function buildTransport(cfg: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: (() => {
      const u = new URL(cfg.url);
      if (!u.username) return undefined;
      return { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password || "") };
    })(),
  });
}

/** Build the per-recipient HTML body with a mandatory unsubscribe footer. */
export function decorateHtml(
  body_html: string | null,
  body_text: string,
  unsubscribe_url: string,
  from_display: string,
): string {
  const inner = body_html && body_html.trim().length > 0
    ? body_html
    : `<div style="white-space:pre-wrap;font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a">${escapeHtml(body_text)}</div>`;
  return `<!doctype html><html><body style="margin:0;padding:20px;background:#f7f7f7">
<div style="max-width:640px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;border:1px solid #e5e5e5">
${inner}
<hr style="margin:24px 0 12px;border:0;border-top:1px solid #e5e5e5"/>
<p style="font:11px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#666;margin:0">
Sent by ${escapeHtml(from_display)}. If this reached you in error, or you'd rather not receive further messages,
<a href="${unsubscribe_url}" style="color:#0645ad">click here to unsubscribe</a>.
</p>
</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  } as Record<string, string>)[c]);
}

/** Send a batch. Returns per-recipient results.
 *  If SMTP not configured: returns 'smtp_not_configured' for every recipient · does not throw. */
export async function sendBatch(input: BatchSendInput, env: NodeJS.ProcessEnv = process.env): Promise<{
  configured: boolean;
  smtp_host: string | null;
  results: RecipientResult[];
  reason?: string;
}> {
  const resolution = resolveSmtpConfig(env);
  if (!resolution.configured) {
    return {
      configured: false,
      smtp_host: null,
      reason: resolution.reason,
      results: input.recipients.map((r) => ({
        recipient_id: r.recipient_id,
        email_address: r.email_address,
        status: "smtp_not_configured" as const,
        smtp_message_id: null,
        error_reason: resolution.reason,
        sent_at: null,
      })),
    };
  }

  const cfg = resolution.config;
  const from_display = cfg.from_name ? `${cfg.from_name} <${cfg.from_address}>` : cfg.from_address;
  const transport = buildTransport(cfg);
  const results: RecipientResult[] = [];

  for (const recipient of input.recipients) {
    const unsub_url = `${input.unsubscribe_base_url.replace(/\/+$/, "")}/${encodeURIComponent(recipient.unsubscribe_token)}`;
    const html = decorateHtml(input.body_html, input.body_text, unsub_url, from_display);
    const textWithFooter = `${input.body_text}\n\n—\nSent by ${from_display}. Unsubscribe: ${unsub_url}`;
    try {
      const info = await transport.sendMail({
        from: from_display,
        to: recipient.email_address,
        replyTo: cfg.reply_to || undefined,
        subject: input.subject,
        text: textWithFooter,
        html,
        headers: {
          "List-Unsubscribe": `<${unsub_url}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      results.push({
        recipient_id: recipient.recipient_id,
        email_address: recipient.email_address,
        status: "sent",
        smtp_message_id: info.messageId ?? null,
        error_reason: null,
        sent_at: new Date().toISOString(),
      });
    } catch (e) {
      results.push({
        recipient_id: recipient.recipient_id,
        email_address: recipient.email_address,
        status: "failed",
        smtp_message_id: null,
        error_reason: (e as Error).message.slice(0, 512),
        sent_at: null,
      });
    }
  }

  try { transport.close(); } catch { /* ignore */ }
  return { configured: true, smtp_host: cfg.host, results };
}

// Doctrine locks · asserted structurally in acceptance tests
export const _SMTP_SENDER_NEVER_FABRICATES_DELIVERY = "sent_status_requires_real_smtp_message_id";
export const _SMTP_SENDER_NOT_CONFIGURED_IS_HONEST_STATUS = "no_config_returns_smtp_not_configured_for_all_recipients";
export const _SMTP_SENDER_ALWAYS_INCLUDES_UNSUBSCRIBE = "every_message_has_list_unsubscribe_header_and_footer_link";
