// beaconCustomerEmail — receipt email sent to the homeowner right
// after they submit a beacon enquiry.
//
// The point: stop the homeowner ghosting when their first strange
// WhatsApp message lands from an unknown trade number. This email
// says "your enquiry was sent to N trades, expect WhatsApps from
// their own numbers within 2h, no obligation, reply to whichever
// quotes you like".
//
// From: The Network admin (noreply@thenetworkers.app)
// Only fires when customer_email is populated on the beacon row.
// Idempotent — checks confirmation_email_sent_at before sending.
// Best-effort — logs but never throws.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const FROM = process.env.HAMMEREX_TRADE_FROM_EMAIL
  || process.env.RESEND_FROM_EMAIL
  || "The Network <noreply@thenetworkers.app>";

async function sendViaResend(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[beaconCustomerEmail] RESEND_API_KEY not set — skipping "${opts.subject}"`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html })
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[beaconCustomerEmail] Resend ${res.status}: ${txt}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[beaconCustomerEmail] send threw:", err);
    return false;
  }
}

/** Send the receipt email to the homeowner. Called once by
 *  createBeacon after the beacon + first fanout wave land. */
export async function sendBeaconReceiptEmail(input: {
  beaconId:      string;
  customerEmail: string;
  customerName:  string;
  customerCity:  string | null;
  tradeSlug:     string;
  description:   string;
  fanoutCount:   number;
  slaHours:      number;
  adminResidual: boolean;
}): Promise<void> {
  // Idempotency guard — don't re-send on retries
  const existing = await supabaseAdmin
    .from("hammerex_xrated_project_beacons")
    .select("confirmation_email_sent_at")
    .eq("id", input.beaconId)
    .maybeSingle();
  if (existing.data?.confirmation_email_sent_at) return;

  const firstName = input.customerName.split(/\s+/)[0] || "there";
  const tradeLabel = input.tradeSlug.replace(/-/g, " ");
  const cityBit = input.customerCity ? ` in ${input.customerCity}` : "";

  const subject = input.adminResidual
    ? `We've got your ${tradeLabel} enquiry — trades will be in touch`
    : `Your ${tradeLabel} enquiry has been sent to ${input.fanoutCount} trade${input.fanoutCount === 1 ? "" : "s"}${cityBit}`;

  const html = input.adminResidual ? adminResidualBody(input, firstName, tradeLabel, cityBit)
                                    : standardBody(input, firstName, tradeLabel, cityBit);

  const sent = await sendViaResend({ to: input.customerEmail, subject, html });
  if (sent) {
    await supabaseAdmin
      .from("hammerex_xrated_project_beacons")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", input.beaconId);
  }
}

function standardBody(input: { fanoutCount: number; description: string; slaHours: number }, firstName: string, tradeLabel: string, cityBit: string): string {
  const brief = escapeHtml(input.description);
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0a0a0a">
      <p style="font-size:11px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#166534;margin:0 0 8px 0">
        Enquiry sent
      </p>
      <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:900;line-height:1.2">
        Hi ${escapeHtml(firstName)} — your enquiry went out to ${input.fanoutCount} ${escapeHtml(tradeLabel)}${input.fanoutCount === 1 ? "" : "s"}${cityBit}.
      </h1>
      <blockquote style="margin:0 0 16px 0;padding:12px 14px;background:#F9FAFB;border-left:3px solid #B8860B;font-size:13px;line-height:1.5;color:#333;border-radius:6px">
        &ldquo;${brief}&rdquo;
      </blockquote>
      <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#333">
        <strong>What happens next:</strong><br/>
        They have <strong>${input.slaHours} hours</strong> to claim your job. You'll get WhatsApp messages from any who take it — this could be one, two, or all ${input.fanoutCount} separate trades.
      </p>
      <div style="background:#FFF7DB;border:1px solid rgba(184,134,11,0.30);border-radius:8px;padding:14px;margin:16px 0">
        <p style="margin:0 0 8px 0;font-size:11px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#7A5B00">
          Heads up
        </p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#0a0a0a">
          The WhatsApp messages will come from <strong>the trades' own numbers</strong>, not from The Network. Save any number that messages you so you know it's them. You're under no obligation — reply to whichever quotes you like best.
        </p>
      </div>
      <p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#666">
        If you don't hear from anyone within ${input.slaHours} hours, we'll re-route your enquiry to another set of trades automatically.
      </p>
      <p style="margin:16px 0 0 0;font-size:11px;color:#888">
        Any issues? Reply directly to this email and our team will help.
      </p>
    </div>
  `;
}

function adminResidualBody(input: { description: string }, firstName: string, tradeLabel: string, cityBit: string): string {
  const brief = escapeHtml(input.description);
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0a0a0a">
      <p style="font-size:11px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#B8860B;margin:0 0 8px 0">
        Enquiry received
      </p>
      <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:900;line-height:1.2">
        Hi ${escapeHtml(firstName)} — we've got your ${escapeHtml(tradeLabel)} enquiry${cityBit}.
      </h1>
      <blockquote style="margin:0 0 16px 0;padding:12px 14px;background:#F9FAFB;border-left:3px solid #B8860B;font-size:13px;line-height:1.5;color:#333;border-radius:6px">
        &ldquo;${brief}&rdquo;
      </blockquote>
      <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#333">
        No matching trades were live in your area right now, so our team is manually reaching out to ${escapeHtml(tradeLabel)}s who cover ${cityBit || "your area"}. When one joins and takes your enquiry, they'll message you on WhatsApp direct.
      </p>
      <p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#666">
        This usually takes 24-48 hours. Reply to this email if you'd like an update or want to change any details.
      </p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
