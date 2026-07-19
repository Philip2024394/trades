// Merchant-to-merchant referral transactional emails.
//
// Two touches:
//   1. `sendReferralJoinedEmail` — fires when a new signup is attributed
//      to a referrer's mref slug. "Someone joined with your link — 50
//      free WhatsApp leads on the way."
//   2. `sendReferralUpgradedEmail` — fires when a referred merchant
//      upgrades to a paid tier. "Your referral just went paid — bonus
//      200 washers landing."
//
// Both are best-effort: if RESEND_API_KEY isn't set we log a warning
// and skip. Never block the caller path (signup / stripe webhook).
// Mirror of src/lib/affiliateEmails.ts shape.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const FROM_DEFAULT = "The Network <noreply@thenetworkers.app>";
const CANONICAL_ORIGIN =
  process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? "https://thenetworkers.app";

function fromAddress(): string {
  return (
    process.env.HAMMEREX_TRADE_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    FROM_DEFAULT
  );
}

async function sendViaResend(opts: {
  to:      string;
  subject: string;
  html:    string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      `[merchantReferralEmails] RESEND_API_KEY not set — skipping "${opts.subject}" to ${opts.to}`
    );
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from:    fromAddress(),
        to:      [opts.to],
        subject: opts.subject,
        html:    opts.html
      })
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[merchantReferralEmails] Resend ${res.status}: ${txt}`);
    }
  } catch (err) {
    console.error("[merchantReferralEmails] send threw:", err);
  }
}

/** Look up a merchant's email + display name from their listing slug.
 *  Returns null when the slug doesn't resolve to a live listing. */
async function referrerContact(slug: string): Promise<{ email: string; name: string } | null> {
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("email, display_name, trading_name")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (!res.data?.email) return null;
  return {
    email: res.data.email as string,
    name:  (res.data.trading_name as string | null) ?? (res.data.display_name as string | null) ?? "there"
  };
}

/** Fires immediately after `attributeSignup` succeeds. */
export async function sendReferralJoinedEmail(input: {
  referrerSlug:  string;
  referredSlug:  string;
  referredName?: string | null;
}): Promise<void> {
  const to = await referrerContact(input.referrerSlug);
  if (!to) return;
  const dashUrl = `${CANONICAL_ORIGIN}/trade-off/edit/${encodeURIComponent(input.referrerSlug)}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0a0a0a">
      <p style="font-size:11px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#B8860B;margin:0 0 8px 0">
        Referral joined
      </p>
      <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:900;line-height:1.2">
        ${escapeHtml(input.referredName ?? "Someone")} just joined The Network with your link.
      </h1>
      <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;color:#333">
        Hi ${escapeHtml(to.name)}, thanks for spreading the word.
        <br/><br/>
        50 free WhatsApp leads (washers) are on their way to your account
        — no need to do anything, they'll appear on your washer bag
        shortly. When ${escapeHtml(input.referredName ?? "they")}
        upgrade to a paid tier, you'll get another 200 washers.
      </p>
      <a href="${dashUrl}" style="display:inline-block;background:#0A0A0A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:900;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">
        Open your dashboard
      </a>
      <p style="margin:24px 0 0 0;font-size:11px;color:#666">
        Keep sharing your invite link — the more merchants who join
        through you, the more free leads you stack up.
      </p>
    </div>
  `;
  await sendViaResend({
    to: to.email,
    subject: `${input.referredName ?? "Someone"} joined The Network with your link`,
    html
  });
}

/** Fires when a referred merchant first upgrades to a paid tier. */
export async function sendReferralUpgradedEmail(input: {
  referrerSlug:  string;
  referredSlug:  string;
  referredName?: string | null;
}): Promise<void> {
  const to = await referrerContact(input.referrerSlug);
  if (!to) return;
  const dashUrl = `${CANONICAL_ORIGIN}/trade-off/edit/${encodeURIComponent(input.referrerSlug)}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0a0a0a">
      <p style="font-size:11px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#166534;margin:0 0 8px 0">
        Referral went paid
      </p>
      <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:900;line-height:1.2">
        ${escapeHtml(input.referredName ?? "Your referral")} just upgraded. 200 washers on the way.
      </h1>
      <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;color:#333">
        Hi ${escapeHtml(to.name)}, big one — your referral has picked a paid
        tier on The Network. As a thank-you, we're crediting your washer
        bag with 200 free WhatsApp leads (worth £14.99). No action needed.
      </p>
      <a href="${dashUrl}" style="display:inline-block;background:#166534;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:900;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">
        Open your dashboard
      </a>
      <p style="margin:24px 0 0 0;font-size:11px;color:#666">
        Every merchant you refer helps The Network grow — and stacks
        more free leads on your side.
      </p>
    </div>
  `;
  await sendViaResend({
    to: to.email,
    subject: `${input.referredName ?? "Your referral"} upgraded — 200 washers landing`,
    html
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
