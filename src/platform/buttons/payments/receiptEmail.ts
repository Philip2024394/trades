// Receipt email sender.
//
// Called from the webhook route when an order flips to 'paid'.
// Loads the brand's receipt config, formats the amount currency-aware,
// fires via Resend, marks receipt_sent_at (or receipt_error) on the
// order row.
//
// Retries are provider-side (Resend has its own SMTP retries). Our
// webhook idempotency comes from receipt_sent_at — if it's set we
// skip. Providers that retry webhooks won't double-send receipts.

import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatMoney } from "./currency";

type OrderRow = {
  id: string;
  brand_id: string;
  provider_id: string;
  external_ref: string | null;
  order_ref: string | null;
  amount_minor: number;
  currency: string;
  description: string | null;
  customer_email: string | null;
  receipt_sent_at: string | null;
};

export async function sendReceiptForOrder(orderId: string): Promise<void> {
  const orderRes = await supabaseAdmin
    .from("studio_payment_orders")
    .select(
      "id, brand_id, provider_id, external_ref, order_ref, amount_minor, currency, description, customer_email, receipt_sent_at"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!orderRes.data) return;
  const order = orderRes.data as OrderRow;

  if (order.receipt_sent_at) return; // idempotent
  if (!order.customer_email) {
    await supabaseAdmin
      .from("studio_payment_orders")
      .update({ receipt_error: "no-customer-email" })
      .eq("id", orderId);
    return;
  }

  const configRes = await supabaseAdmin
    .from("studio_payment_receipt_config")
    .select(
      "enabled, from_email, from_name, logo_url, reply_to, footer_note, bcc_merchant"
    )
    .eq("brand_id", order.brand_id)
    .maybeSingle();
  const config = configRes.data;
  if (!config || !config.enabled || !config.from_email) {
    await supabaseAdmin
      .from("studio_payment_orders")
      .update({ receipt_error: "receipt-config-disabled" })
      .eq("id", orderId);
    return;
  }

  const brandRes = await supabaseAdmin
    .from("studio_brands")
    .select("name")
    .eq("id", order.brand_id)
    .maybeSingle();
  const brandName =
    (brandRes.data?.name as string | undefined) ?? config.from_name ?? "";

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await supabaseAdmin
      .from("studio_payment_orders")
      .update({ receipt_error: "resend-api-key-missing" })
      .eq("id", orderId);
    return;
  }

  const amount = formatMoney(order.amount_minor, order.currency);
  const subject = `Receipt: ${amount} — ${brandName || order.description || order.order_ref}`;
  const html = renderReceiptHtml({
    brandName,
    logoUrl: config.logo_url ?? null,
    amount,
    orderRef: order.order_ref ?? order.id,
    externalRef: order.external_ref,
    description: order.description,
    providerLabel: order.provider_id,
    footerNote: config.footer_note ?? null
  });
  const text = renderReceiptText({
    brandName,
    amount,
    orderRef: order.order_ref ?? order.id,
    description: order.description,
    providerLabel: order.provider_id
  });

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${config.from_name ?? brandName} <${config.from_email}>`,
      to: order.customer_email,
      bcc: config.bcc_merchant ? [config.from_email] : undefined,
      replyTo: config.reply_to ?? undefined,
      subject,
      html,
      text
    });
    await supabaseAdmin
      .from("studio_payment_orders")
      .update({
        receipt_sent_at: new Date().toISOString(),
        receipt_error: null
      })
      .eq("id", orderId);
  } catch (err) {
    await supabaseAdmin
      .from("studio_payment_orders")
      .update({ receipt_error: (err as Error).message ?? "send-failed" })
      .eq("id", orderId);
  }
}

// ─── Templates ─────────────────────────────────────────

function renderReceiptHtml(args: {
  brandName: string;
  logoUrl: string | null;
  amount: string;
  orderRef: string;
  externalRef: string | null;
  description: string | null;
  providerLabel: string;
  footerNote: string | null;
}): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Receipt from ${escape(args.brandName)}</title>
</head>
<body style="margin:0;padding:24px;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0A0A0A;">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <tr>
      <td>
        ${args.logoUrl
          ? `<img src="${escape(args.logoUrl)}" alt="${escape(args.brandName)}" style="max-height:36px;margin-bottom:24px;">`
          : `<div style="font-weight:800;font-size:14px;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:24px;">${escape(args.brandName)}</div>`}
        <p style="font-size:10px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#525252;margin:0 0 4px;">Receipt</p>
        <h1 style="margin:0 0 24px;font-size:28px;font-weight:800;letter-spacing:-0.01em;">Payment confirmed.</h1>
        <div style="background:#FAFAFA;border-radius:12px;padding:20px;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;">
            <span style="font-size:11px;font-weight:700;color:#737373;text-transform:uppercase;letter-spacing:0.14em;">Amount</span>
            <span style="font-size:22px;font-weight:800;font-family:ui-monospace,SFMono-Regular,monospace;">${escape(args.amount)}</span>
          </div>
          ${args.description
            ? `<div style="font-size:14px;font-weight:600;margin-bottom:8px;">${escape(args.description)}</div>`
            : ""}
          <div style="font-size:11px;color:#737373;">
            Order reference:
            <code style="font-family:ui-monospace,SFMono-Regular,monospace;">${escape(args.orderRef)}</code>
          </div>
          ${args.externalRef
            ? `<div style="font-size:11px;color:#737373;">Provider reference: <code style="font-family:ui-monospace,SFMono-Regular,monospace;">${escape(args.externalRef)}</code></div>`
            : ""}
          <div style="font-size:11px;color:#737373;">Processed via ${escape(args.providerLabel)}</div>
        </div>
        <p style="font-size:13px;color:#404040;margin:0 0 16px;">Thanks for your purchase. Keep this email — it's your receipt.</p>
        ${args.footerNote
          ? `<p style="font-size:11px;color:#737373;border-top:1px solid #E5E5E5;padding-top:16px;margin-top:24px;">${escape(args.footerNote)}</p>`
          : ""}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderReceiptText(args: {
  brandName: string;
  amount: string;
  orderRef: string;
  description: string | null;
  providerLabel: string;
}): string {
  const lines = [
    `Receipt from ${args.brandName}`,
    "",
    `Amount: ${args.amount}`,
    args.description ? `Item: ${args.description}` : null,
    `Order reference: ${args.orderRef}`,
    `Processed via ${args.providerLabel}`,
    "",
    "Thanks for your purchase. Keep this email as your receipt."
  ].filter(Boolean);
  return lines.join("\n");
}
