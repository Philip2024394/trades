// POST /api/store/login/request  { email }
//
// Verifies the email has an active membership and mints a magic-link
// token. In dev (no email service configured), the link is returned
// in the response so we can hit it manually. In prod, we'd email it;
// the response never leaks whether an email was recognised so we
// don't help enumerators.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mintMagicToken } from "@/lib/storeMagicLink";

const FROM = process.env.HAMMEREX_TRADE_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "Site Interest <noreply@thenetworkers.app>";

/** Send the magic link via Resend. Best-effort — errors are logged
 *  but the endpoint still returns the neutral success message so we
 *  don't reveal delivery failures to enumerators. */
async function sendMagicLinkEmail(to: string, linkUrl: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0a0a0a">
      <p style="font-size:11px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#B8860B;margin:0 0 8px 0">Site Interest</p>
      <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:900;line-height:1.2">Sign in to your account</h1>
      <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;color:#333">
        Click the button below to sign in. The link is single-use and expires in 15 minutes.
      </p>
      <a href="${linkUrl}" style="display:inline-block;background:#0A0A0A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9999px;font-weight:900;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">Sign in to Site Interest</a>
      <p style="margin:24px 0 0 0;font-size:11px;color:#666">Or copy this link:<br/><a href="${linkUrl}" style="color:#B8860B;word-break:break-all">${linkUrl}</a></p>
      <p style="margin:16px 0 0 0;font-size:11px;color:#666">Didn't request this? You can safely ignore this email.</p>
    </div>
  `;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ from: FROM, to: [to], subject: "Your Site Interest sign-in link", html })
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[store/login] Resend ${res.status}: ${txt}`);
    }
  } catch (err) {
    console.error("[store/login] Resend send threw:", err);
  }
}

export async function POST(req: Request) {
  let body: { email?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }

  // Look up membership. NEVER reveal existence — respond identically
  // whether or not the email has an active membership so this endpoint
  // isn't an account-enumeration surface. Silently no-op on unknown.
  const res = await supabaseAdmin
    .from("hammerex_store_memberships")
    .select("id, current_period_end")
    .eq("email",  email)
    .eq("status", "active")
    .maybeSingle();

  if (!res.error && res.data) {
    const token   = mintMagicToken(email);
    const origin  = new URL(req.url).origin;
    const linkUrl = `${origin}/store/login/verify?token=${encodeURIComponent(token)}`;

    // Dev — return the link inline so we can test the flow. Prod
    // sends via Resend below.
    const emailWired = Boolean(process.env.RESEND_API_KEY);
    if (!emailWired) {
      return NextResponse.json({
        ok:        true,
        dev_link:  linkUrl,
        note:      "Email service not configured — link returned inline for dev only."
      });
    }
    await sendMagicLinkEmail(email, linkUrl);
  }

  return NextResponse.json({
    ok: true,
    message: "If that email has an active membership, we've sent a sign-in link."
  });
}
