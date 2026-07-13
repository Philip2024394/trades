// Fires the review-request email when Job Diary signs a job off.
// Idempotent per job_id (unique index on the requests table).
import "server-only";
import { randomBytes } from "node:crypto";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const FROM =
  process.env.AI_VISUALISER_FROM_EMAIL ||
  process.env.HAMMEREX_TRADE_FROM_EMAIL ||
  "";

const EXPIRY_DAYS = 60;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type SendReviewRequestInput = {
  jobId: string;
  projectId: string;
  propertyId: string;
  merchantId: string;
  homeownerId?: string | null;
  homeownerPartyId?: string | null;
};

export type SendReviewRequestResult = {
  requestId: string;
  reused: boolean;
  emailSent: boolean;
};

export async function sendReviewRequest(
  input: SendReviewRequestInput
): Promise<SendReviewRequestResult> {
  const { data: existing } = await supabaseAdmin
    .from("app_reviews_review_requests")
    .select("id, share_token, status")
    .eq("job_id", input.jobId)
    .maybeSingle();
  if (existing) {
    // Don't spam — one request per job.
    return {
      requestId: existing.id,
      reused: true,
      emailSent: false
    };
  }

  const shareToken = randomBytes(24).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

  const { data: created, error } = await supabaseAdmin
    .from("app_reviews_review_requests")
    .insert({
      job_id: input.jobId,
      project_id: input.projectId,
      property_id: input.propertyId,
      merchant_id: input.merchantId,
      homeowner_id: input.homeownerId ?? null,
      homeowner_party_id: input.homeownerPartyId ?? null,
      share_token: shareToken,
      status: "queued" as const,
      expires_at: expiresAt.toISOString()
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(`Failed to create review request: ${error?.message}`);
  }

  const [homeowner, merchant, project] = await Promise.all([
    input.homeownerId
      ? supabaseAdmin
          .from("app_ai_visualiser_homeowners")
          .select("full_name, email")
          .eq("id", input.homeownerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("display_name, trading_name")
      .eq("id", input.merchantId)
      .maybeSingle(),
    supabaseAdmin
      .from("os_projects")
      .select("title, leaf_slug")
      .eq("id", input.projectId)
      .maybeSingle()
  ]);

  const apiKey = process.env.RESEND_API_KEY;
  const email = homeowner.data?.email;
  if (!apiKey || !FROM || !email) {
    // Row created; email deferred. Cron reminder or manual resend picks it up.
    return { requestId: created.id, reused: false, emailSent: false };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://thenetworkers.app";
  const linkUrl = `${base}/review/${shareToken}`;
  const merchantName =
    merchant.data?.trading_name || merchant.data?.display_name || "your trade";
  const jobTitle = project.data?.title || "your project";

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0a0a0a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0a0a0a;padding:20px 24px;">
          <div style="color:#FFB300;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">How was it?</div>
          <div style="color:#ffffff;font-size:18px;font-weight:800;margin-top:4px;">${escapeHtml(jobTitle)}</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;">Hi ${escapeHtml(homeowner.data?.full_name || "there")},</p>
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">Your job with <b>${escapeHtml(merchantName)}</b> is signed off. If you have a minute, other homeowners really do read these — and ${escapeHtml(merchantName)} sees your review straight away.</p>
          <p style="margin:16px 0;">
            <a href="${escapeHtml(linkUrl)}" style="display:inline-block;background:#FFB300;color:#0a0a0a;font-weight:800;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;">Leave a review</a>
          </p>
          <p style="margin:0;font-size:12px;color:#666;">Takes about 30 seconds. No sign-up. Add up to four photos of the finished job if you like.</p>
        </td></tr>
        <tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#888;">
          Sent by Xrated Trades on behalf of ${escapeHtml(merchantName)}. Every review here is tied to a real signed-off job.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `How did ${merchantName} do?`,
      html,
      text: `How was ${jobTitle}? Leave a quick review here: ${linkUrl}`
    });
  } catch (err) {
    console.error("[reviews.sendRequest] resend failed", err);
    return { requestId: created.id, reused: false, emailSent: false };
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("app_reviews_review_requests")
    .update({ status: "sent", sent_at: now })
    .eq("id", created.id);

  return { requestId: created.id, reused: false, emailSent: true };
}
