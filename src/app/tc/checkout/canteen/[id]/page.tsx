// /tc/checkout/canteen/[id] — canteen-product-aware checkout.
//
// Reads a canteen product by its Trade Center listing id (falls back
// to the row id), resolves the buyer's selected variant from ?v=, and
// renders a mobile-first order summary with a WhatsApp-handoff CTA
// as the confirmation step.
//
// Safe Trade / Stripe Connect / escrow integration is intentionally
// stubbed at "WhatsApp handoff" for now — the merchant confirms the
// order and takes payment via their existing channel. This keeps the
// buy-flow honest: no fake payment UI until we've wired the merchant
// KYC + Connect account setup.
//
// URL params:
//   ?v={comboKey}   — selected variant (M · Ivory Mist)
//   ?qty={n}        — pre-fill quantity (defaults to 1)
//
// Design:
//   - Order summary card on top (mobile) / right (desktop)
//   - Variant + quantity picker on left (desktop) / below summary (mobile)
//   - Sticky WhatsApp CTA at the bottom on mobile
//   - Zero-commission trust chip repeated
//   - "How this works" collapsible explaining the handoff model

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  canteenProductByTradeCenterListingIdFromDb,
  canteenHostForProductFromDb
} from "@/lib/canteens.server";
import { CanteenCheckoutBody } from "./CanteenCheckoutBody";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout · Trade Center · Thenetworkers",
  robots: { index: false, follow: false }
};

export default async function CanteenCheckoutPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await canteenProductByTradeCenterListingIdFromDb(id);
  if (!product) notFound();

  const host = await canteenHostForProductFromDb(product.hostSlug);
  if (!host) notFound();

  return (
    <CanteenCheckoutBody
      product={product}
      hostDisplayName={host.hostDisplayName}
      tradeLabel={host.tradeLabel}
      canteenSlug={host.canteenSlug}
      hostWhatsapp={host.whatsapp}
    />
  );
}
