// Newsletter delivery — sends the composed monthly digest via Resend.
//
// Merchant-branded template + inline images. Failure logs a Gold Path
// task so the merchant knows delivery didn't go through.

import { Resend } from "resend";
import type { MonthlyDigestDraft } from "./monthlyDigest";

export type DeliverDigestInput = {
  merchantId: string;
  toEmail: string;
  fromName?: string; // Merchant's business name for the from field
  fromEmail?: string; // Merchant-side sender (defaults to platform)
  subscriberCount?: number;
  draft: MonthlyDigestDraft;
};

export async function deliverMonthlyDigest(
  input: DeliverDigestInput
): Promise<{ ok: boolean; reason?: string; messageId?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "resend_not_configured" };
  const resend = new Resend(key);
  const from = input.fromEmail
    ? `${input.fromName ?? "Recent work"} <${input.fromEmail}>`
    : `xrated studio <digest@xratedtrades.com>`;

  const html = renderDigestHtml(input.draft, input.fromName ?? "");
  const { data, error } = await resend.emails.send({
    from,
    to: input.toEmail,
    subject: input.draft.headline,
    html
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, messageId: data?.id };
}

function renderDigestHtml(draft: MonthlyDigestDraft, brand: string): string {
  const featured = draft.featured_posts
    .map(
      (p) => `
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #eee;">
          ${p.hero_image_url ? `<img src="${p.hero_image_url}" alt="${escape(p.headline)}" style="width: 100%; max-width: 480px; border-radius: 12px;" />` : ""}
          <h3 style="margin: 12px 0 4px; font-size: 16px; color: #111;">${escape(p.headline)}</h3>
          <p style="margin: 0; font-size: 13px; color: #444; line-height: 1.4;">${escape(p.blurb)}</p>
        </td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family: Helvetica, Arial, sans-serif; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 22px; margin: 0 0 8px;">${escape(draft.headline)}</h1>
    ${brand ? `<div style="font-size: 12px; color: #666; margin-bottom: 12px;">From ${escape(brand)}</div>` : ""}
    <p style="font-size: 14px; line-height: 1.5; color: #333;">${escape(draft.intro)}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 16px;">
      ${featured}
    </table>
    <p style="font-size: 14px; line-height: 1.5; color: #333; margin-top: 20px;">${escape(draft.closing_cta)}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="font-size: 11px; color: #888;">
      Sent by xrated studio on behalf of ${escape(brand || "your business")}.
      Reply STOP to opt out.
    </p>
  </div>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
