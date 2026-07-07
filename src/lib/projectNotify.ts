// Project brief notifications — sends emails when a homeowner submits
// a project via the /project wizard. Best-effort; errors do not fail
// the parent request.
import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signInboxToken } from "@/lib/inboxToken";
import { signProjectTrackToken } from "@/lib/projectTrackToken";

const FROM =
  process.env.HAMMEREX_TRADE_FROM_EMAIL ||
  "Construction Notebook <hello@xratedtrade.com>";

const BASE = process.env.NEXT_PUBLIC_HAMMEREX_SITE_URL || "https://xratedtrade.vercel.app";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type BriefEmailInput = {
  projectId: string;
  projectTitle: string;
  scope: string;
  budget: string;
  timeframe: string;
  postcode: string;
  homeownerName: string;
  homeownerEmail: string;
  homeownerWhatsapp?: string;
};

// Notify every invited trade — one email each with a signed inbox
// link. Failure to notify one merchant does not block the others.
export async function notifyInvitedTrades(
  businessIds: string[],
  brief: BriefEmailInput
): Promise<{ sent: number; failed: number }> {
  const key = process.env.RESEND_API_KEY;
  if (!key || businessIds.length === 0) {
    return { sent: 0, failed: 0 };
  }
  const resend = new Resend(key);

  const { data: rows } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, display_name, email, slug")
    .in("id", businessIds);

  const merchants = (rows ?? []) as Array<{
    id: string;
    display_name: string;
    email: string | null;
    slug: string;
  }>;

  let sent = 0;
  let failed = 0;
  for (const m of merchants) {
    if (!m.email) {
      failed++;
      continue;
    }
    try {
      const token = signInboxToken(m.id);
      const inboxUrl = `${BASE}/inbox?token=${encodeURIComponent(token)}#brief-${brief.projectId}`;
      await resend.emails.send({
        from: FROM,
        to: m.email,
        subject: `New project brief · ${brief.projectTitle}`,
        html: renderEmail({ merchantName: m.display_name, inboxUrl, brief })
      });
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}

// Homeowner confirmation — sent from /api/project/submit after the
// project is created. Contains a signed tracking link so Sarah can
// come back and view her project + replies without an account.
export async function notifyHomeownerBriefSubmitted(input: {
  homeownerEmail: string;
  homeownerName: string;
  projectId: string;
  projectTitle: string;
  invitedTradesCount: number;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const token = signProjectTrackToken(input.projectId);
  const trackUrl = `${BASE}/project/track?token=${encodeURIComponent(token)}`;
  const resend = new Resend(key);
  try {
    await resend.emails.send({
      from: FROM,
      to: input.homeownerEmail,
      subject: `Your brief is on the Notebook · ${input.projectTitle}`,
      html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#a35a00">
    ● The Construction Notebook
  </div>
  <h1 style="font-size:22px;margin:12px 0 4px">Your brief is on the Notebook.</h1>
  <p style="color:#555;font-size:14px;margin:0 0 20px">
    Hi ${escapeHtml(input.homeownerName)} — we sent your project brief to
    <strong>${input.invitedTradesCount} trade${input.invitedTradesCount === 1 ? "" : "s"}</strong>.
    They'll be in touch within 24 hours.
  </p>
  <div style="border:1px solid #eee;border-radius:12px;padding:16px;background:#fafafa">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888">Project</div>
    <p style="margin:6px 0 0;font-size:15px;font-weight:700">${escapeHtml(input.projectTitle)}</p>
  </div>
  <div style="margin-top:22px">
    <a href="${trackUrl}" style="display:inline-block;background:#FFB300;color:#0f0f0f;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;font-size:14px">Track your brief</a>
  </div>
  <p style="font-size:12px;color:#888;margin-top:14px">
    This link is valid for 60 days. Every reply and update stays on your project's page.
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

// Reply back to a homeowner from a trade — used by /api/inbox/reply.
export async function notifyHomeownerReply(input: {
  homeownerEmail: string;
  homeownerName: string;
  merchantName: string;
  projectTitle: string;
  message: string;
  projectId: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const resend = new Resend(key);
  try {
    await resend.emails.send({
      from: FROM,
      to: input.homeownerEmail,
      subject: `${input.merchantName} replied to your brief`,
      html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#a35a00">
    ● The Construction Notebook
  </div>
  <h1 style="font-size:22px;margin:12px 0 4px">${escapeHtml(input.merchantName)} replied.</h1>
  <p style="color:#555;font-size:14px;margin:0 0 20px">
    About your project: <strong>${escapeHtml(input.projectTitle)}</strong>
  </p>
  <div style="border:1px solid #eee;border-radius:12px;padding:16px;background:#fafafa">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888">Message</div>
    <p style="white-space:pre-wrap;margin:8px 0 0;font-size:14px;line-height:1.55">${escapeHtml(input.message)}</p>
  </div>
  <div style="margin-top:24px;font-size:13px;color:#666">
    Reply directly to this email to keep the conversation going, or open your Notebook to see every reply in one place.
  </div>
  <div style="margin-top:8px">
    <a href="${BASE}/home" style="display:inline-block;background:#0f0f0f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;font-size:14px">Open Notebook</a>
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

function renderEmail({
  merchantName,
  inboxUrl,
  brief
}: {
  merchantName: string;
  inboxUrl: string;
  brief: BriefEmailInput;
}): string {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#a35a00">
    ● The Construction Notebook · New Brief
  </div>
  <h1 style="font-size:22px;margin:12px 0 4px">${escapeHtml(brief.projectTitle)}</h1>
  <p style="color:#555;font-size:14px;margin:0 0 20px">
    ${escapeHtml(brief.homeownerName)} sent you a project brief through the Notebook.
  </p>
  <div style="border:1px solid #eee;border-radius:12px;padding:16px;background:#fafafa;font-size:13px;color:#333">
    <div><strong>Postcode:</strong> ${escapeHtml(brief.postcode)}</div>
    <div><strong>Timeframe:</strong> ${escapeHtml(brief.timeframe)}</div>
    <div><strong>Budget:</strong> ${escapeHtml(brief.budget)}</div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #eee">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888">Scope</div>
      <p style="white-space:pre-wrap;margin:6px 0 0;font-size:13px;line-height:1.55">${escapeHtml(brief.scope)}</p>
    </div>
  </div>
  <div style="margin-top:22px">
    <a href="${inboxUrl}" style="display:inline-block;background:#FFB300;color:#0f0f0f;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;font-size:14px">Open ${escapeHtml(merchantName)}'s inbox</a>
  </div>
  <p style="font-size:12px;color:#888;margin-top:14px">
    Link valid for 30 days. Direct contact: ${escapeHtml(brief.homeownerEmail)}${brief.homeownerWhatsapp ? ` · ${escapeHtml(brief.homeownerWhatsapp)}` : ""}
  </p>
  <div style="margin-top:32px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.15em">
    The Construction Notebook · Britain
  </div>
</div>
  `;
}
