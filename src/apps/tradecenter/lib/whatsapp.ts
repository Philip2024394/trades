// WhatsApp handoff deep-link builder.
//
// Builds a `wa.me/<phone>?text=<encoded>` URL that opens WhatsApp on
// mobile or WhatsApp Web on desktop, pre-filled with a formatted cart
// message the buyer can send verbatim. Used only for the "message
// merchant on WhatsApp" checkout route (never for trade quote flow —
// quotes MUST live in the in-platform message system per the
// project_trade_center_checkout_model rule).

import type { GuestBasketItem } from "./useGuestBasket";
import type { TradeCenterMerchant } from "../data/merchants";

/** Convert a stored E.164 number to the digits-only shape wa.me expects
 *  ("+441612000000" → "441612000000"). Strips anything non-numeric so
 *  merchant-side typos in spacing/parentheses don't break the link. */
function toWaMePhone(e164: string): string {
  return e164.replace(/[^\d]/g, "");
}

function formatCurrency(gbp: number): string {
  return `£${gbp.toFixed(2)}`;
}

export function buildWhatsAppCartMessage(
  merchant: TradeCenterMerchant,
  items: GuestBasketItem[],
  deliveryChargeGbp: number
): string {
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPriceGbp, 0);
  const total = subtotal + deliveryChargeGbp;

  const lines: string[] = [];
  lines.push(`Hi ${merchant.displayName},`);
  lines.push("");
  lines.push("I'd like to place an order via Trade Center:");
  lines.push("");
  for (const item of items) {
    lines.push(
      `• ${item.qty} × ${item.productName} — ${formatCurrency(item.unitPriceGbp)} ea`
    );
  }
  lines.push("");
  lines.push(`Subtotal: ${formatCurrency(subtotal)}`);
  if (deliveryChargeGbp > 0) {
    lines.push(`Delivery: ${formatCurrency(deliveryChargeGbp)}`);
  } else {
    lines.push("Delivery: Free");
  }
  lines.push(`Total: ${formatCurrency(total)}`);
  lines.push("");
  lines.push("Please confirm availability, delivery ETA and payment method. Thanks.");
  return lines.join("\n");
}

export function buildWhatsAppCartUrl(
  merchant: TradeCenterMerchant,
  items: GuestBasketItem[],
  deliveryChargeGbp: number
): string | null {
  if (!merchant.whatsappNumber) return null;
  const phone = toWaMePhone(merchant.whatsappNumber);
  const text = buildWhatsAppCartMessage(merchant, items, deliveryChargeGbp);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
