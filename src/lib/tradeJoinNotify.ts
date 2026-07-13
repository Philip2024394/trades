// Trade welcome email — sent by /api/join/submit after the merchant
// creates their Notebook. Contains their public profile URL + a
// secure edit link with their edit_token.
import "server-only";
import { Resend } from "resend";

const FROM =
  process.env.HAMMEREX_TRADE_FROM_EMAIL ||
  "Construction Notebook <hello@thenetworkers.app>";

const BASE =
  process.env.NEXT_PUBLIC_HAMMEREX_SITE_URL || "https://xratedtrade.vercel.app";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function notifyTradeWelcome(input: {
  email: string;
  displayName: string;
  slug: string;
  editToken: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const resend = new Resend(key);

  const publicUrl = `${BASE}/${input.slug}`;
  const editUrl = `${BASE}/trade-off/edit/${input.slug}?token=${encodeURIComponent(input.editToken)}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: input.email,
      subject: `Your Notebook is live · ${input.displayName}`,
      html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#a35a00">
    ● The Construction Notebook
  </div>
  <h1 style="font-size:22px;margin:12px 0 4px">Welcome, ${escapeHtml(input.displayName)}.</h1>
  <p style="color:#555;font-size:14px;margin:0 0 20px">
    Your Notebook is live. Every job you complete, every review you get, every
    trade you work with — recorded here forever.
  </p>
  <div style="border:1px solid #eee;border-radius:12px;padding:16px;background:#fafafa">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888">Your public Notebook</div>
    <p style="margin:6px 0 0"><a href="${publicUrl}" style="color:#a35a00;font-weight:700;text-decoration:none">${escapeHtml(publicUrl)}</a></p>
  </div>
  <div style="margin-top:22px">
    <a href="${editUrl}" style="display:inline-block;background:#FFB300;color:#0f0f0f;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;font-size:14px">Finish your Notebook</a>
  </div>
  <p style="font-size:12px;color:#888;margin-top:14px">
    Add photos, services, and your Trade Circle. Takes another 5 minutes and
    your profile becomes real. Link above works for 30 days.
  </p>
  <div style="margin-top:22px;padding-top:18px;border-top:1px solid #eee;font-size:13px;color:#333">
    <strong>What&apos;s next</strong>
    <ol style="padding-left:20px;margin:8px 0 0;line-height:1.7">
      <li>Add photos of past work + short bio</li>
      <li>Invite trades you already work with into your Trade Circle</li>
      <li>Homeowners near you find you when they submit a brief</li>
    </ol>
  </div>
  <div style="margin-top:32px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.15em">
    The Construction Notebook · Britain
  </div>
</div>
      `
    });
    return true;
  } catch {
    return false;
  }
}
