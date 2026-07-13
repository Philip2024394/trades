// Homeowner-to-trade invite email.
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

export async function notifyTradeInvited(input: {
  invitedEmail: string;
  invitedDisplayName: string;
  invitedTrade: string;
  inviterDisplayName: string;
  note?: string | null;
  token: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const resend = new Resend(key);

  const joinUrl = `${BASE}/join/start?invite=${encodeURIComponent(input.token)}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: input.invitedEmail,
      subject: `${input.inviterDisplayName} added you to their Notebook`,
      html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#a35a00">
    ● The Construction Notebook
  </div>
  <h1 style="font-size:22px;margin:12px 0 4px">${escapeHtml(input.inviterDisplayName)} added you to their Notebook.</h1>
  <p style="color:#555;font-size:14px;margin:0 0 20px">
    They&apos;d like to keep every quote, photo, warranty, and message with
    you in one place — attached to their property, forever.
  </p>
  ${
    input.note
      ? `<div style="border:1px solid #eee;border-radius:12px;padding:16px;background:#fafafa;margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888">Message from ${escapeHtml(input.inviterDisplayName)}</div>
    <p style="margin:8px 0 0;font-size:14px;line-height:1.55;white-space:pre-wrap">${escapeHtml(input.note)}</p>
  </div>`
      : ""
  }
  <div style="margin-top:22px">
    <a href="${joinUrl}" style="display:inline-block;background:#FFB300;color:#0f0f0f;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;font-size:14px">Open your free Notebook</a>
  </div>
  <p style="font-size:13px;color:#666;margin-top:14px;line-height:1.55">
    You&apos;ll get a free public profile (photos, past work, contact) and
    the ability to record every job you complete — a portfolio that&apos;s
    yours, not the platform&apos;s. No card required, no listing fee.
  </p>
  <div style="margin-top:22px;padding-top:18px;border-top:1px solid #eee;font-size:13px;color:#333">
    <strong>What you get</strong>
    <ul style="padding-left:20px;margin:8px 0 0;line-height:1.7">
      <li>Free Notebook profile — indexed on thenetworkers.app</li>
      <li>Photos + materials list for every job you record</li>
      <li>${escapeHtml(input.inviterDisplayName)} added to your circle from day one</li>
    </ul>
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
