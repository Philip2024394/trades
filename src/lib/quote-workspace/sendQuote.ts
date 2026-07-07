// Sends a quote to a homeowner. Email via Resend; WhatsApp via a
// deep-link that opens the customer's WA with a pre-filled message
// pointing to the public share page.
import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordTimelineEvent } from "@/lib/os/timeline";

const FROM =
  process.env.AI_VISUALISER_FROM_EMAIL ||
  process.env.HAMMEREX_TRADE_FROM_EMAIL ||
  "";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type SendQuoteResult =
  | { ok: true; channel: "whatsapp" | "email"; wa_url?: string }
  | { ok: false; error: string };

export async function sendQuote(input: {
  quoteId: string;
  channel: "whatsapp" | "email";
}): Promise<SendQuoteResult> {
  const { data: quote } = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select(
      "id, title, total_pence, share_token, expires_at, timeline_estimate, notes, merchant_id, property_id, project_id, homeowner_id, sent_at, status"
    )
    .eq("id", input.quoteId)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Quote not found." };

  const [homeownerRes, merchantRes] = await Promise.all([
    quote.homeowner_id
      ? supabaseAdmin
          .from("app_ai_visualiser_homeowners")
          .select("full_name, email, whatsapp_e164")
          .eq("id", quote.homeowner_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("display_name, trading_name, email")
      .eq("id", quote.merchant_id)
      .maybeSingle()
  ]);

  const homeowner = homeownerRes.data;
  const merchant = merchantRes.data;

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://xratedtrade.com";
  const quoteUrl = `${base}/quote/${quote.share_token}`;
  const totalGbp = `£${(quote.total_pence / 100).toFixed(2)}`;
  const merchantName =
    merchant?.trading_name || merchant?.display_name || "your trade";

  if (input.channel === "whatsapp") {
    if (!homeowner?.whatsapp_e164) {
      return { ok: false, error: "Homeowner WhatsApp not on file." };
    }
    const waDigits = homeowner.whatsapp_e164.replace(/\D/g, "");
    const message = `Hi ${homeowner.full_name || "there"}, here's your quote from ${merchantName} for ${quote.title} — ${totalGbp} incl VAT. Open here: ${quoteUrl}`;
    const waUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`;
    await markSent(quote.id, "whatsapp", quote.property_id, quote.project_id, quote.merchant_id);
    return { ok: true, channel: "whatsapp", wa_url: waUrl };
  }

  // Email channel
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !FROM) {
    return { ok: false, error: "Email not configured." };
  }
  if (!homeowner?.email) {
    return { ok: false, error: "Homeowner email not on file." };
  }

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0a0a0a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0a0a0a;padding:20px 24px;">
          <div style="color:#FFB300;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Quote from ${escapeHtml(merchantName)}</div>
          <div style="color:#ffffff;font-size:18px;font-weight:800;margin-top:4px;">${escapeHtml(quote.title)}</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;">Hi ${escapeHtml(homeowner.full_name || "there")},</p>
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">Here's your quote for <b>${escapeHtml(quote.title)}</b> — <b>${totalGbp}</b> including VAT.</p>
          ${quote.timeline_estimate ? `<p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;"><b>Timeline:</b> ${escapeHtml(quote.timeline_estimate)}</p>` : ""}
          ${quote.expires_at ? `<p style="margin:0 0 12px 0;font-size:13px;color:#666;">Expires ${new Date(quote.expires_at).toLocaleDateString()}</p>` : ""}
          <p style="margin:16px 0;">
            <a href="${escapeHtml(quoteUrl)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-weight:800;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;">Open your quote</a>
          </p>
          <p style="margin:0;font-size:12px;color:#666;">Any questions — just reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: FROM,
      to: homeowner.email,
      replyTo: merchant?.email || undefined,
      subject: `Your quote from ${merchantName} — ${quote.title}`,
      html,
      text: `Your quote from ${merchantName} for ${quote.title}: ${totalGbp}\n\nOpen it here: ${quoteUrl}`
    });
  } catch (err) {
    console.error("[quote-workspace.send] resend failed", err);
    return { ok: false, error: "Email send failed." };
  }

  await markSent(quote.id, "email", quote.property_id, quote.project_id, quote.merchant_id);
  return { ok: true, channel: "email" };
}

async function markSent(
  quoteId: string,
  channel: "whatsapp" | "email",
  propertyId: string,
  projectId: string,
  merchantId: string
) {
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .update({
      status: "sent",
      sent_at: now,
      sent_channel: channel
    })
    .eq("id", quoteId);
  await supabaseAdmin.from("app_quote_workspace_quote_events").insert({
    quote_id: quoteId,
    verb: "sent" as const,
    actor_kind: "merchant" as const,
    actor_business_listing_id: merchantId,
    payload: { channel }
  });
  await recordTimelineEvent({
    propertyId,
    projectId,
    actorBusinessListingId: merchantId,
    verb: "quote.sent",
    subjectType: "quote",
    subjectId: quoteId,
    headline: `Quote sent via ${channel}`,
    payload: { channel }
  });
}
