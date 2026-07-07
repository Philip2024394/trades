// Email sent when the owner invites a person to join an entity as a
// member (foreman, finance, estimator, viewer, trade).
import "server-only";
import { Resend } from "resend";

const FROM =
  process.env.HAMMEREX_TRADE_FROM_EMAIL ||
  "Construction Notebook <hello@xratedtrade.com>";

const BASE =
  process.env.NEXT_PUBLIC_HAMMEREX_SITE_URL || "https://xratedtrade.vercel.app";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ROLE_HUMAN: Record<string, string> = {
  finance: "manage finances",
  foreman: "run sites and hire trades",
  estimator: "prepare quotes and materials",
  viewer: "view-only access",
  trade: "log jobs and get paid"
};

export async function notifyEntityMemberInvited(input: {
  invitedEmail: string;
  invitedDisplayName: string;
  entityDisplayName: string;
  inviterDisplayName: string;
  proposedRole: string;
  note?: string | null;
  token: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const resend = new Resend(key);

  const acceptUrl = `${BASE}/entity/accept?token=${encodeURIComponent(input.token)}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: input.invitedEmail,
      subject: `${input.inviterDisplayName} invited you to ${input.entityDisplayName}`,
      html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#a35a00">
    ● The Construction Notebook
  </div>
  <h1 style="font-size:22px;margin:12px 0 4px">You&apos;ve been invited to join a team.</h1>
  <p style="color:#555;font-size:14px;margin:0 0 20px">
    <b>${esc(input.inviterDisplayName)}</b> added you to <b>${esc(input.entityDisplayName)}</b> as <b>${esc(input.proposedRole)}</b>
    — so you can ${ROLE_HUMAN[input.proposedRole] ?? "collaborate on projects"} inside their Notebook.
  </p>
  ${
    input.note
      ? `<div style="border:1px solid #eee;border-radius:12px;padding:16px;background:#fafafa;margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888">Message</div>
    <p style="margin:8px 0 0;font-size:14px;line-height:1.55;white-space:pre-wrap">${esc(input.note)}</p>
  </div>`
      : ""
  }
  <div style="margin-top:22px">
    <a href="${acceptUrl}" style="display:inline-block;background:#FFB300;color:#0f0f0f;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;font-size:14px">Accept invitation</a>
  </div>
  <p style="font-size:12px;color:#888;margin-top:14px">
    Link expires in 30 days. If you don&apos;t know ${esc(input.inviterDisplayName)}, you can ignore this email.
  </p>
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
