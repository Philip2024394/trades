// POST /api/contact
//
// Structured contact intake. Validates the body, then emails the
// admin inbox via Resend. The reason category lives in the subject
// line so the team can filter the inbox at a glance.
//
// Env contract (already provisioned in .env.local):
//   RESEND_API_KEY                 — Resend secret
//   HAMMEREX_TRADE_FROM_EMAIL      — verified `from` (e.g. "Hammerex
//                                    Trade <orders@hammerexdirect.com>")
//   HAMMEREX_TRADE_ADMIN_EMAIL     — inbox we forward to
//
// We deliberately do not log the WhatsApp number, email, or message
// body — those stay inside the Resend payload.

import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS = [
  "General enquiry",
  "Marketing / partnership",
  "Trade app — feature request or custom build",
  "Payment / billing issue",
  "Account access / login help",
  "Reseller programme",
  "Bug report",
  "Press / media",
  "Other"
] as const;

const COUNTRIES = new Set([
  "United Kingdom",
  "Ireland",
  "United States",
  "Canada",
  "Australia",
  "New Zealand",
  "Germany",
  "France",
  "Netherlands",
  "Belgium",
  "Spain",
  "Italy",
  "Portugal",
  "Poland",
  "India",
  "United Arab Emirates",
  "South Africa",
  "Singapore",
  "Hong Kong",
  "Other"
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fieldFail(field: string, error: string) {
  return NextResponse.json({ ok: false, field, error }, { status: 400 });
}

function whatsappDigits(input: string): string {
  return input.replace(/\D/g, "");
}

type ContactPayload = {
  reason?: unknown;
  country?: unknown;
  name?: unknown;
  whatsapp?: unknown;
  email?: unknown;
  accountRef?: unknown;
  message?: unknown;
  // Honeypot — real users never fill this. Bots scrape every visible
  // input and tend to fill anything named "website". If we see a value
  // we silently resolve as success without sending the email.
  website?: unknown;
};

export async function POST(req: NextRequest) {
  let body: ContactPayload;
  try {
    body = (await req.json()) as ContactPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  // Honeypot check — return ok:true without sending so the bot thinks
  // it succeeded. Anything truthy in the trap counts.
  const honeypot =
    typeof body.website === "string" ? body.website.trim() : "";
  if (honeypot.length > 0) {
    console.warn("[contact] honeypot triggered — dropping silently");
    return NextResponse.json({ ok: true });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const country = typeof body.country === "string" ? body.country.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const whatsapp =
    typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const accountRef =
    typeof body.accountRef === "string" ? body.accountRef.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!reason) return fieldFail("reason", "Reason is required.");
  if (!(REASONS as ReadonlyArray<string>).includes(reason)) {
    return fieldFail("reason", "Unknown reason.");
  }
  if (!country) return fieldFail("country", "Country is required.");
  if (!COUNTRIES.has(country)) {
    return fieldFail("country", "Unknown country.");
  }
  if (name.length < 2) return fieldFail("name", "Name is required.");
  if (whatsappDigits(whatsapp).length < 7) {
    return fieldFail("whatsapp", "WhatsApp number is required.");
  }
  if (!EMAIL_RE.test(email)) {
    return fieldFail("email", "Valid email is required.");
  }
  if (message.length < 10) {
    return fieldFail("message", "Message is too short.");
  }
  if (message.length > 5000) {
    return fieldFail("message", "Message is too long (max 5000 chars).");
  }
  if (accountRef.length > 300) {
    return fieldFail("accountRef", "Account reference is too long.");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.HAMMEREX_TRADE_FROM_EMAIL;
  const adminEmail = process.env.HAMMEREX_TRADE_ADMIN_EMAIL;

  if (!apiKey || !fromEmail || !adminEmail) {
    console.error(
      "[contact] missing Resend env: RESEND_API_KEY / HAMMEREX_TRADE_FROM_EMAIL / HAMMEREX_TRADE_ADMIN_EMAIL"
    );
    return NextResponse.json(
      {
        ok: false,
        error:
          "Our messaging service is temporarily unavailable. Please try again in a few minutes."
      },
      { status: 500 }
    );
  }

  const waDigits = whatsappDigits(whatsapp);
  const waUrl = waDigits ? `https://wa.me/${waDigits}` : null;
  const replyToMailto = `mailto:${email}`;

  const subject = `[xratedtrade.com Contact] ${reason}: ${name}`;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0a0a0a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0a0a0a;padding:20px 24px;">
          <div style="color:#FFB300;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">xratedtrade.com Contact</div>
          <div style="color:#ffffff;font-size:18px;font-weight:800;margin-top:4px;">${escapeHtml(reason)}</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;color:#0a0a0a;">
            <tr><td style="padding:6px 0;width:160px;color:#666;font-weight:600;">Reason</td><td style="padding:6px 0;">${escapeHtml(reason)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;font-weight:600;">Name</td><td style="padding:6px 0;">${escapeHtml(name)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;font-weight:600;">Country</td><td style="padding:6px 0;">${escapeHtml(country)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;font-weight:600;">Email</td><td style="padding:6px 0;"><a href="${escapeHtml(replyToMailto)}" style="color:#0a0a0a;">${escapeHtml(email)}</a></td></tr>
            <tr><td style="padding:6px 0;color:#666;font-weight:600;">WhatsApp</td><td style="padding:6px 0;">${escapeHtml(whatsapp)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;font-weight:600;">Account ref</td><td style="padding:6px 0;">${accountRef ? escapeHtml(accountRef) : '<span style="color:#999;">—</span>'}</td></tr>
          </table>
          <div style="margin-top:20px;padding:16px;background:#fafafa;border:1px solid #eee;border-radius:8px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#666;margin-bottom:8px;">Message</div>
            <div style="font-size:14px;line-height:1.6;color:#0a0a0a;white-space:pre-wrap;">${escapeHtml(message)}</div>
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">
            <tr>
              <td style="padding-right:8px;">
                <a href="${escapeHtml(replyToMailto)}" style="display:inline-block;background:#FFB300;color:#0a0a0a;font-weight:800;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:13px;">Reply by email</a>
              </td>
              ${
                waUrl
                  ? `<td><a href="${escapeHtml(waUrl)}" style="display:inline-block;background:#25D366;color:#ffffff;font-weight:800;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:13px;">Open WhatsApp</a></td>`
                  : ""
              }
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#888;">
          Sent from the xratedtrade.com /contact form.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textLines = [
    `[xratedtrade.com Contact] ${reason}`,
    "",
    `Reason:      ${reason}`,
    `Name:        ${name}`,
    `Country:     ${country}`,
    `Email:       ${email}`,
    `WhatsApp:    ${whatsapp}`,
    `Account ref: ${accountRef || "—"}`,
    "",
    "Message:",
    message,
    "",
    `Reply: ${replyToMailto}`,
    waUrl ? `WhatsApp: ${waUrl}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      replyTo: email,
      subject,
      html,
      text: textLines
    });
    if (result.error) {
      console.error("[contact] resend send error:", result.error);
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not send your message right now. Please try again in a few minutes."
        },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[contact] resend exception:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not send your message right now. Please try again in a few minutes."
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
