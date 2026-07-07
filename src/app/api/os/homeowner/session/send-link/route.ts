// POST /api/os/homeowner/session/send-link
//
// Homeowner enters their email. If we have a party for that email
// (they've used AI Visualiser before), we email them a magic link.
// If not, we still return 200 (avoids account enumeration) but send
// nothing.

import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { findPartyByEmail } from "@/lib/os/parties";
import { buildMagicLinkToken } from "@/lib/os/homeownerSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Payload = {
  email?: unknown;
  next?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const next =
    typeof body.next === "string" && body.next.startsWith("/")
      ? body.next
      : "/home";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email." },
      { status: 400 }
    );
  }

  const party = await findPartyByEmail(email);
  // Non-enumeration: always return ok. Silent no-op if unknown.
  if (!party) {
    return NextResponse.json({ ok: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.AI_VISUALISER_FROM_EMAIL ||
    process.env.HAMMEREX_TRADE_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.error("[os.homeowner.send-link] missing Resend env");
    return NextResponse.json({ ok: true }); // silent
  }

  const token = buildMagicLinkToken(party.id);
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://xratedtrade.com";
  const linkUrl = `${base}/api/os/homeowner/session/verify?token=${encodeURIComponent(
    token
  )}&next=${encodeURIComponent(next)}`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0a0a0a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0a0a0a;padding:20px 24px;">
          <div style="color:#FFB300;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Your Home</div>
          <div style="color:#ffffff;font-size:18px;font-weight:800;margin-top:4px;">Sign in link</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;">Hi ${escapeHtml(party.display_name || "there")},</p>
          <p style="margin:0 0 20px 0;font-size:14px;line-height:1.5;">Tap the button below to open your Home dashboard. The link expires in 30 minutes.</p>
          <p style="margin:0 0 20px 0;">
            <a href="${escapeHtml(linkUrl)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-weight:800;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;">Open my Home</a>
          </p>
          <p style="margin:0;font-size:12px;color:#666;">If you didn't ask for this, ignore the email — nobody can sign in without opening this link.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Your Home — sign in link",
      html,
      text: `Sign in to your Home: ${linkUrl}\n\nExpires in 30 minutes.`
    });
  } catch (err) {
    console.error("[os.homeowner.send-link] send failed", err);
  }

  return NextResponse.json({ ok: true });
}
