// Sends the merchant a lead email with the homeowner's contact details.
// Called on first registration; called again when the homeowner
// generates their first render (so the merchant sees the design, not
// just contact info).
import "server-only";
import { Resend } from "resend";

const FROM =
  process.env.AI_VISUALISER_FROM_EMAIL ||
  process.env.HAMMEREX_TRADE_FROM_EMAIL ||
  "";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type MerchantLeadEmailParams = {
  merchantEmail: string;
  merchantDisplayName: string;
  homeowner: {
    fullName: string;
    email: string;
    whatsappE164: string;
    homePhone?: string | null;
    postcode: string;
  };
  leafDisplayName: string;
  designSummary?: string; // e.g. "Shaker · Solid Oak · Cornforth White · Brushed brass bar"
  renderThumbUrl?: string;
  dashboardLink: string;
  isFirstContact: boolean;
};

export async function sendMerchantLeadEmail(
  params: MerchantLeadEmailParams
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !FROM) {
    console.error("[ai-visualiser] missing RESEND_API_KEY or from email");
    return { ok: false, error: "email-not-configured" };
  }

  const {
    merchantEmail,
    merchantDisplayName,
    homeowner,
    leafDisplayName,
    designSummary,
    renderThumbUrl,
    dashboardLink,
    isFirstContact
  } = params;

  const waDigits = homeowner.whatsappE164.replace(/\D/g, "");
  const waUrl = waDigits ? `https://wa.me/${waDigits}` : null;
  const mailtoUrl = `mailto:${homeowner.email}`;

  const subject = isFirstContact
    ? `New AI Visualiser lead — ${homeowner.fullName} (${homeowner.postcode})`
    : `New design from ${homeowner.fullName} — ${leafDisplayName}`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0a0a0a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0a0a0a;padding:20px 24px;">
          <div style="color:#FFB300;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">AI Visualiser Lead</div>
          <div style="color:#ffffff;font-size:18px;font-weight:800;margin-top:4px;">${escapeHtml(homeowner.fullName)} · ${escapeHtml(homeowner.postcode)}</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;color:#0a0a0a;">
            Hi ${escapeHtml(merchantDisplayName)}, a new customer has
            ${isFirstContact ? "registered on" : "created another design in"} your
            AI Visualiser for <b>${escapeHtml(leafDisplayName)}</b>.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;color:#0a0a0a;margin-top:8px;">
            <tr><td style="padding:6px 0;width:150px;color:#666;font-weight:600;">Name</td><td style="padding:6px 0;">${escapeHtml(homeowner.fullName)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;font-weight:600;">Email</td><td style="padding:6px 0;"><a href="${escapeHtml(mailtoUrl)}" style="color:#0a0a0a;">${escapeHtml(homeowner.email)}</a></td></tr>
            <tr><td style="padding:6px 0;color:#666;font-weight:600;">WhatsApp</td><td style="padding:6px 0;">${escapeHtml(homeowner.whatsappE164)}</td></tr>
            ${
              homeowner.homePhone
                ? `<tr><td style="padding:6px 0;color:#666;font-weight:600;">Phone</td><td style="padding:6px 0;">${escapeHtml(homeowner.homePhone)}</td></tr>`
                : ""
            }
            <tr><td style="padding:6px 0;color:#666;font-weight:600;">Postcode</td><td style="padding:6px 0;">${escapeHtml(homeowner.postcode)}</td></tr>
            ${
              designSummary
                ? `<tr><td style="padding:6px 0;color:#666;font-weight:600;">Design</td><td style="padding:6px 0;">${escapeHtml(designSummary)}</td></tr>`
                : ""
            }
          </table>
          ${
            renderThumbUrl
              ? `<div style="margin-top:16px;text-align:center;"><img src="${escapeHtml(renderThumbUrl)}" alt="" style="max-width:100%;border-radius:8px;border:1px solid #eee;"/></div>`
              : ""
          }
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">
            <tr>
              <td style="padding-right:8px;">
                <a href="${escapeHtml(dashboardLink)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-weight:800;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:13px;">View in dashboard</a>
              </td>
              ${
                waUrl
                  ? `<td style="padding-right:8px;"><a href="${escapeHtml(waUrl)}" style="display:inline-block;background:#25D366;color:#ffffff;font-weight:800;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:13px;">Reply on WhatsApp</a></td>`
                  : ""
              }
              <td><a href="${escapeHtml(mailtoUrl)}" style="display:inline-block;background:#FFB300;color:#0a0a0a;font-weight:800;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:13px;">Email reply</a></td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#888;">
          Sent by thenetworkers.app AI Visualiser. Reply within 24h for the best response rate.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    subject,
    "",
    `Name:     ${homeowner.fullName}`,
    `Email:    ${homeowner.email}`,
    `WhatsApp: ${homeowner.whatsappE164}`,
    homeowner.homePhone ? `Phone:    ${homeowner.homePhone}` : "",
    `Postcode: ${homeowner.postcode}`,
    designSummary ? `Design:   ${designSummary}` : "",
    "",
    `Dashboard: ${dashboardLink}`,
    waUrl ? `WhatsApp:  ${waUrl}` : "",
    `Email:     ${mailtoUrl}`
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: FROM,
      to: merchantEmail,
      replyTo: homeowner.email,
      subject,
      html,
      text
    });
    if (result.error) {
      console.error("[ai-visualiser] resend send error:", result.error);
      return { ok: false, error: "send-failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[ai-visualiser] resend exception:", err);
    return { ok: false, error: "send-exception" };
  }
}
