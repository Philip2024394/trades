// /tc/product/[id] — Trade Center Product Detail Page.
//
// Consumes canteen products by the merchant-declared Trade Center
// listing id (falls back to the row id so URLs from both surfaces
// resolve). Handoff points into this page:
//   - Canteen ProductQuickView "Buy on Trade Center" button
//   - CanteenTrendingSwipeSheet "Buy on Trade Center" button
//   - Trade Center browse product cards
//
// URL params:
//   ?v={comboKey}    — pre-select this variant (M · Ivory Mist)
//   ?from=canteen    — sets the back-link target
//   ?slug={slug}     — canteen slug for the back-link
//
// Renders TcPdpBody (client) so the variant picker owns interactive
// state while the server does the DB fetch. Notes:
//   - Product identifier can be either the TC listing id (merchant-
//     declared string like "prod_oak_worktop_40mm") or the row uuid.
//   - Returns 404 when neither lookup matches, or when the product's
//     merchant has flipped `send_to_trade_center` off.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  canteenProductByTradeCenterListingIdFromDb,
  canteenHostForProductFromDb
} from "@/lib/canteens.server";
import { TcPdpBody } from "./TcPdpBody";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await canteenProductByTradeCenterListingIdFromDb(id);
  if (!product) {
    return {
      title: "Product not found · Trade Center · Thenetworkers",
      robots: { index: false, follow: false }
    };
  }
  const title = `${product.name} · Trade Center · Thenetworkers`;
  const description = product.blurb || `Buy ${product.name} from a real UK trade. 0% commission. WhatsApp handoff.`;
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title,
      description,
      url: absolute(`/tc/product/${id}`),
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.name }] : undefined
    }
  };
}

export default async function TradeCenterProductPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await canteenProductByTradeCenterListingIdFromDb(id);
  if (!product) notFound();

  // Master switch — if the merchant flipped `send_to_trade_center` off
  // at the profile level, the product row's `show_in_trade_center` gate
  // has already excluded it inside the DB helper. Belt-and-braces: no
  // check needed here.

  const host = await canteenHostForProductFromDb(product.hostSlug);
  if (!host) notFound();

  return (
    <TcPdpBody
      product={product}
      hostDisplayName={host.hostDisplayName}
      tradeLabel={host.tradeLabel}
      canteenSlug={host.canteenSlug}
      hostWhatsapp={host.whatsapp}
    />
  );
}
