// Free-tier slug expiry warning emails.
//
// STRICT non-blocking design:
//   - No RESEND_API_KEY → returns false silently. Cron still succeeds.
//   - Missing merchant email → returns false silently.
//   - Send failure → returns false, logs a warning, cron still succeeds.
//   - Merchant NEVER gets a hard error; worst case they don't see a
//     warning email and lose their slug. They can still log in and
//     pick a new slug — no lockout.
//
// Wire-in: called from /api/cron/free-slug-expiry AFTER the stage
// transition is written to DB. Email failure ≠ transaction rollback.

import "server-only";
import { Resend } from "resend";

const FROM =
  process.env.HAMMEREX_TRADE_FROM_EMAIL ||
  "Thenetworkers <hello@thenetworkers.app>";
const BASE =
  process.env.NEXT_PUBLIC_HAMMEREX_SITE_URL || "https://thenetworkers.app";

export type SlugExpiryStage = "warn-15" | "warn-25" | "warn-29" | "expired";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function copyForStage(stage: SlugExpiryStage, slug: string, businessName: string): {
  subject: string;
  headline: string;
  body: string;
  daysLeft: number | null;
} {
  const escSlug = escapeHtml(slug);
  const escName = escapeHtml(businessName || slug);
  switch (stage) {
    case "warn-15":
      return {
        subject: `${businessName || slug} — log in to keep your URL`,
        headline: "Your URL is waiting.",
        body: `Hi ${escName},<br><br>You haven't logged in for 15 days. Your <strong>thenetworkers.app/${escSlug}</strong> URL is held for 30 days from your last login. Just log in once to reset the clock — there is nothing else to do. Upgrade to any paid tier at any time to keep your URL for life.`,
        daysLeft: 15
      };
    case "warn-25":
      return {
        subject: `${businessName || slug} — 5 days to keep your URL`,
        headline: "Reminder — log in to keep your URL.",
        body: `Hi ${escName},<br><br>Your <strong>thenetworkers.app/${escSlug}</strong> URL will be released in 5 days if you don't log in. Sign in once and the clock resets. If you want to keep it forever, upgrade to any paid tier and your slug is reserved for life.`,
        daysLeft: 5
      };
    case "warn-29":
      return {
        subject: `${businessName || slug} — 24 hours to keep your URL`,
        headline: "Final reminder — 24 hours.",
        body: `Hi ${escName},<br><br>This is your last heads-up. Your <strong>thenetworkers.app/${escSlug}</strong> URL will be released tomorrow if you don't sign in today. One tap resets the clock. Upgrading to a paid tier reserves the URL for life.`,
        daysLeft: 1
      };
    case "expired":
      return {
        subject: `${businessName || slug} — your URL has been released`,
        headline: "Your URL has been released.",
        body: `Hi ${escName},<br><br>Your <strong>thenetworkers.app/${escSlug}</strong> URL has been released back to the pool. You can still log in and pick a new URL any time. All your data — reviews, products, designs — is still in your account, only the URL changed. Upgrading to a paid tier reserves your new URL for life.`,
        daysLeft: 0
      };
  }
}

export async function notifySlugExpiryStage(input: {
  toEmail: string | null;
  slug: string;
  businessName: string;
  stage: SlugExpiryStage;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  if (!input.toEmail || !input.toEmail.includes("@")) return false;

  const { subject, headline, body, daysLeft } = copyForStage(
    input.stage,
    input.slug,
    input.businessName
  );
  const loginUrl = `${BASE}/trade-off/login`;
  const upgradeUrl = `${BASE}/trade-off/packages`;

  const resend = new Resend(key);
  try {
    await resend.emails.send({
      from: FROM,
      to: input.toEmail,
      subject,
      html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#a35a00">
    ● Thenetworkers
  </div>
  <h1 style="font-size:22px;margin:12px 0 4px">${escapeHtml(headline)}</h1>
  <p style="color:#333;font-size:14px;line-height:1.5;margin:0 0 20px">
    ${body}
  </p>
  ${daysLeft !== null && daysLeft > 0 ? `
  <div style="background:#FBF6EC;border:1px solid #E5D6BB;border-radius:12px;padding:12px;margin:0 0 20px">
    <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;color:#6b5a2c">Days left</div>
    <div style="font-size:28px;font-weight:900;color:#111;margin-top:4px">${daysLeft}</div>
  </div>` : ""}
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <a href="${loginUrl}" style="display:inline-block;background:#166534;color:#fff;padding:12px 20px;border-radius:999px;font-weight:800;text-decoration:none;font-size:13px">
      Log in and reset the clock
    </a>
    <a href="${upgradeUrl}" style="display:inline-block;background:#FFB300;color:#0A0A0A;padding:12px 20px;border-radius:999px;font-weight:800;text-decoration:none;font-size:13px">
      Upgrade to keep URL for life
    </a>
  </div>
  <p style="color:#777;font-size:11px;margin:24px 0 0">
    You're on the free tier of Thenetworkers. Free URLs stay reserved while you log in at least once every 30 days. Paid tiers keep their URL for life.
  </p>
</div>
      `.trim()
    });
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[slugExpiry.notify] send failed (non-fatal):", err);
    return false;
  }
}
