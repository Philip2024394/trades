import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendLeadAlert } from "@/lib/leadAlerts";
import { adminWhatsapp } from "@/lib/whatsapp";
import { whatsappDigits } from "@/lib/tradeOff";
import { siteUrl } from "@/lib/seo";

// notifyOrderPaid — the ONE call every payment provider makes when a
// customer's payment flips an order to 'paid'. Fires in parallel:
//   1. Push notification via Lead Alerts (if merchant has the add-on on)
//   2. Email to the merchant with order details + link to /orders
//   3. Email receipt to the customer (if we have their address)
//
// Idempotent guardrail — checks the order's `notified_at` timestamp
// (added in migration 20260702170000) so re-delivered webhooks don't
// spam the merchant. Bumps notified_at on first success.

type OrderRow = {
  id: string;
  listing_id: string;
  order_ref: string;
  amount_pence: number;
  currency: string;
  provider: string;
  customer_email: string | null;
  customer_name: string | null;
  cart_items: unknown[];
  paid_at: string | null;
  notified_at: string | null;
};

type ListingRow = {
  id: string;
  slug: string;
  display_name: string | null;
  email: string | null;
  whatsapp: string | null;
};

function poundsFrom(pence: number): string {
  const pounds = Math.max(0, Math.round(pence)) / 100;
  return `£${pounds.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function providerLabel(p: string): string {
  if (p === "stripe") return "Stripe";
  if (p === "paypal") return "PayPal";
  if (p === "square") return "Square";
  if (p === "payment_link") return "Payment Link";
  return p;
}

/** Sends all notifications. Silent-fail per channel — a broken email
 *  provider can never block a push notification (or vice versa). */
export async function notifyOrderPaid(orderRef: string): Promise<{
  push: number;
  merchant_email: boolean;
  customer_email: boolean;
  skipped_duplicate: boolean;
}> {
  const orderRes = await supabaseAdmin
    .from("hammerex_xrated_orders")
    .select(
      "id, listing_id, order_ref, amount_pence, currency, provider, customer_email, customer_name, cart_items, paid_at, notified_at"
    )
    .eq("order_ref", orderRef)
    .maybeSingle();
  if (orderRes.error || !orderRes.data) {
    return { push: 0, merchant_email: false, customer_email: false, skipped_duplicate: false };
  }
  const order = orderRes.data as OrderRow;
  if (order.notified_at) {
    return { push: 0, merchant_email: false, customer_email: false, skipped_duplicate: true };
  }

  const listingRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, email, whatsapp")
    .eq("id", order.listing_id)
    .maybeSingle();
  if (!listingRes.data) {
    return { push: 0, merchant_email: false, customer_email: false, skipped_duplicate: false };
  }
  const listing = listingRes.data as ListingRow;

  const results = { push: 0, merchant_email: false, customer_email: false, skipped_duplicate: false };

  // Fire push + emails in parallel; each channel's failure is isolated.
  const pushPromise = sendLeadAlert(listing.id, {
    type: "order_paid",
    data: {
      order_ref: order.order_ref,
      amount_pence: order.amount_pence,
      provider: order.provider,
      customer_name: order.customer_name,
      customer_email: order.customer_email
    }
  })
    .then((r) => {
      results.push = r.delivered;
    })
    .catch(() => {
      /* silent */
    });

  const merchantEmailPromise = sendMerchantEmail(listing, order)
    .then(() => {
      results.merchant_email = true;
    })
    .catch(() => {
      /* silent */
    });

  const customerEmailPromise = order.customer_email
    ? sendCustomerReceipt(listing, order)
        .then(() => {
          results.customer_email = true;
        })
        .catch(() => {
          /* silent */
        })
    : Promise.resolve();

  await Promise.all([pushPromise, merchantEmailPromise, customerEmailPromise]);

  await supabaseAdmin
    .from("hammerex_xrated_orders")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", order.id);

  return results;
}

async function sendMerchantEmail(listing: ListingRow, order: OrderRow): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.HAMMEREX_TRADE_FROM_EMAIL;
  if (!apiKey || !from) return;
  const to = listing.email;
  if (!to) return;
  const resend = new Resend(apiKey);
  const dashboardUrl = `${siteUrl()}/trade-off/edit/${encodeURIComponent(
    listing.slug
  )}/orders?ref=${encodeURIComponent(order.order_ref)}`;
  const amount = poundsFrom(order.amount_pence);
  const items = Array.isArray(order.cart_items)
    ? (order.cart_items as Array<{ name?: string; qty?: number; price_pence?: number }>)
    : [];
  const itemsHtml = items
    .map((it) => {
      const name = (it.name ?? "").toString();
      const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
      const total = poundsFrom((it.price_pence ?? 0) * qty);
      return `<li>${qty} × ${name} — ${total}</li>`;
    })
    .join("");
  const customer =
    order.customer_name?.trim() || order.customer_email?.trim() || "A customer";
  await resend.emails.send({
    from,
    to,
    subject: `💰 ${amount} paid via ${providerLabel(order.provider)} — order ${order.order_ref}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; max-width: 560px;">
        <p style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800;">thenetworkers.app</p>
        <h1 style="margin: 8px 0 4px 0; font-size: 24px;">New paid order</h1>
        <p style="margin: 0 0 24px 0; color: #666;">${customer} just paid <strong>${amount}</strong> via ${providerLabel(order.provider)}.</p>
        <div style="border: 1px solid #eee; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Order reference</p>
          <p style="margin: 0 0 12px 0; font-family: monospace; font-weight: 700; font-size: 16px;">${order.order_ref}</p>
          ${itemsHtml ? `<ul style="margin: 0; padding-left: 20px; font-size: 14px;">${itemsHtml}</ul>` : ""}
          <p style="margin: 12px 0 0 0; padding-top: 12px; border-top: 1px solid #eee; font-weight: 800; font-size: 16px;">Total: ${amount}</p>
        </div>
        <a href="${dashboardUrl}" style="display: inline-block; background: #FFB300; color: #000; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 12px;">View order →</a>
        <p style="margin: 24px 0 0 0; font-size: 12px; color: #999;">
          Money settles direct to your ${providerLabel(order.provider)} account. Verify in your ${providerLabel(order.provider)} dashboard before dispatching.
        </p>
      </div>
    `
  });
}

async function sendCustomerReceipt(listing: ListingRow, order: OrderRow): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.HAMMEREX_TRADE_FROM_EMAIL;
  if (!apiKey || !from || !order.customer_email) return;
  const resend = new Resend(apiKey);
  const amount = poundsFrom(order.amount_pence);
  const items = Array.isArray(order.cart_items)
    ? (order.cart_items as Array<{ name?: string; qty?: number; price_pence?: number }>)
    : [];
  const itemsHtml = items
    .map((it) => {
      const name = (it.name ?? "").toString();
      const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
      const total = poundsFrom((it.price_pence ?? 0) * qty);
      return `<li>${qty} × ${name} — ${total}</li>`;
    })
    .join("");
  const merchantWa = whatsappDigits(listing.whatsapp ?? adminWhatsapp());
  await resend.emails.send({
    from,
    to: order.customer_email,
    subject: `Receipt: ${amount} to ${listing.display_name ?? "your merchant"} — ${order.order_ref}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; max-width: 560px;">
        <h1 style="margin: 0 0 4px 0; font-size: 22px;">Thanks — payment received</h1>
        <p style="margin: 0 0 20px 0; color: #666;">Your ${amount} payment to <strong>${listing.display_name ?? "your merchant"}</strong> completed successfully.</p>
        <div style="border: 1px solid #eee; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Order reference</p>
          <p style="margin: 0 0 12px 0; font-family: monospace; font-weight: 700; font-size: 16px;">${order.order_ref}</p>
          ${itemsHtml ? `<ul style="margin: 0; padding-left: 20px; font-size: 14px;">${itemsHtml}</ul>` : ""}
          <p style="margin: 12px 0 0 0; padding-top: 12px; border-top: 1px solid #eee; font-weight: 800; font-size: 16px;">Total paid: ${amount}</p>
        </div>
        <p style="font-size: 14px; color: #333;">${listing.display_name ?? "The merchant"} will be in touch about delivery. Any questions — WhatsApp them direct:</p>
        <a href="https://wa.me/${merchantWa}?text=${encodeURIComponent(`Hi, my order reference is ${order.order_ref}`)}" style="display: inline-block; background: #25D366; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 13px;">Message on WhatsApp →</a>
        <p style="margin: 24px 0 0 0; font-size: 11px; color: #999;">This receipt is from thenetworkers.app on behalf of ${listing.display_name ?? "the merchant"}. Payment processed by ${providerLabel(order.provider)}.</p>
      </div>
    `
  });
}
