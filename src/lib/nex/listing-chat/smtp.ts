// src/lib/nex/listing-chat/smtp.ts
//
// Founder Phase 31 · P31-3 · SMTP delivery + honest-fallback queue.
//
// The exact same discipline as OAuth (Phase 24) and image-gen (Phase 8):
//   · isConfigured() returns true only when SMTP env vars are complete.
//   · If not configured, enqueueEmail() stores the row with status
//     'queued_pending_smtp' — endpoints truthfully report this back
//     to the sender ("Owner will be notified when SMTP is configured")
//   · When configured, we still queue (status='queued') and a background
//     flusher (deferred) will send. For now we send inline on enqueue
//     so the founder sees delivery immediately after adding creds.
//
// Provider adapter: right now the code speaks generic SMTP via nodemailer
// dynamic-import (falls back gracefully if the module isn't installed).
// Resend / Postmark / SES compatibility is achieved by pointing NEX_SMTP_HOST
// at their SMTP endpoints — no code change.

import { createHash } from "node:crypto";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

function sha16(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export interface SmtpConfig {
  host: string; port: number; user: string; pass: string;
  from: string; secure: boolean; provider: string;
}

export function readSmtpConfig(): SmtpConfig | null {
  const host = (process.env.NEX_SMTP_HOST ?? "").trim();
  const port = Number(process.env.NEX_SMTP_PORT ?? "587");
  const user = (process.env.NEX_SMTP_USER ?? "").trim();
  const pass = (process.env.NEX_SMTP_PASS ?? "").trim();
  const from = (process.env.NEX_SMTP_FROM ?? "").trim();
  if (!host || !user || !pass || !from) return null;
  const secure = port === 465 || (process.env.NEX_SMTP_SECURE ?? "").toLowerCase() === "true";
  // Provider hint · purely informational · the transport is generic.
  const provider =
    /resend\./i.test(host) ? "resend" :
    /postmarkapp\.com/i.test(host) ? "postmark" :
    /amazonaws\.com/i.test(host) ? "ses" :
    "smtp-generic";
  return { host, port, user, pass, from, secure, provider };
}

export function isConfigured(): boolean { return readSmtpConfig() != null; }

// ═══════════════════════════════════════════════════════════════════
// Enqueue + (if configured) attempt inline delivery
// ═══════════════════════════════════════════════════════════════════

export interface EnqueueArgs {
  purpose: "owner_invite" | "marketing_intro" | "transactional" | "claim_reminder";
  to_email: string;
  subject: string;
  body_text: string;
  body_html?: string;
  related_thread_id?: string | null;
}

export interface EnqueueResult {
  email_id: string;
  status: "queued_pending_smtp" | "queued" | "sending" | "sent" | "failed" | "bounced";
  provider: string | null;
  smtp_configured: boolean;
  note: string;
}

export async function enqueueEmail(args: EnqueueArgs): Promise<EnqueueResult> {
  const pool = getKnowledgeFactoryDbPool();
  const cfg = readSmtpConfig();
  const status0: EnqueueResult["status"] = cfg ? "queued" : "queued_pending_smtp";
  const r = await pool.query(
    `INSERT INTO nex.outbound_email
       (purpose, to_email, to_email_hash_16, subject, body_text, body_html,
        status, provider, related_thread_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING email_id::text`,
    [args.purpose, args.to_email.trim().toLowerCase(),
     sha16(args.to_email), args.subject, args.body_text, args.body_html ?? null,
     status0, cfg?.provider ?? null, args.related_thread_id ?? null],
  );
  const email_id = (r.rows[0] as { email_id: string }).email_id;

  if (!cfg) {
    return {
      email_id, status: "queued_pending_smtp", provider: null, smtp_configured: false,
      note: "SMTP not configured. Set NEX_SMTP_HOST/PORT/USER/PASS/FROM in .env.local. Email queued in nex.outbound_email · will send on flush after configuration.",
    };
  }

  // Attempt inline delivery.
  try {
    await pool.query(`UPDATE nex.outbound_email SET status = 'sending', attempts = attempts + 1 WHERE email_id = $1`, [email_id]);
    const providerId = await deliverViaSmtp(cfg, args);
    await pool.query(
      `UPDATE nex.outbound_email SET status = 'sent', sent_at = now(), provider_message_id = $2 WHERE email_id = $1`,
      [email_id, providerId],
    );
    return {
      email_id, status: "sent", provider: cfg.provider, smtp_configured: true,
      note: `Delivered via ${cfg.provider} (${cfg.host}).`,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 300) : "unknown";
    await pool.query(
      `UPDATE nex.outbound_email SET status = 'failed', last_error = $2 WHERE email_id = $1`,
      [email_id, detail],
    );
    return {
      email_id, status: "failed", provider: cfg.provider, smtp_configured: true,
      note: `Delivery failed: ${detail}. Row kept in nex.outbound_email for retry.`,
    };
  }
}

async function deliverViaSmtp(cfg: SmtpConfig, args: EnqueueArgs): Promise<string> {
  // Dynamic import hidden from bundler static analysis. `nodemailer` is
  // genuinely optional at build time — Turbopack/Webpack will not try to
  // resolve it via new Function. When installed and env vars set, this
  // path runs; otherwise the outer enqueueEmail() has already recorded
  // the row with status='queued_pending_smtp' and never reached us.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynImport = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
  const nm = await dynImport("nodemailer").catch(() => null) as {
    createTransport: (opts: Record<string, unknown>) => {
      sendMail: (m: Record<string, unknown>) => Promise<{ messageId?: string }>;
    };
  } | null;
  if (!nm) throw new Error("nodemailer_not_installed · run: npm install nodemailer");
  const transport = nm.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  const info = await transport.sendMail({
    from: cfg.from, to: args.to_email, subject: args.subject,
    text: args.body_text, html: args.body_html,
  });
  return info?.messageId ?? "sent-no-id";
}
