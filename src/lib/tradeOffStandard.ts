// Auto-match a Trade Off listing against historical Hammerex quote requests.
// If the listing's email or WhatsApp digits matches a past hammerex_quote_requests
// row that bought a flagship Hammerex Standard product, the badge + blurb
// are populated on the listing automatically.
//
// Blurb policy: when multiple Standard products match, the highest-priority
// product's blurb is used (priority = order in HAMMEREX_STANDARD_BLURBS).
// We keep one clean blurb rather than concatenating to avoid wall-of-text
// profiles.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HAMMEREX_STANDARD_BLURBS, whatsappDigits } from "@/lib/tradeOff";

type QuoteRow = {
  buyer_email: string | null;
  buyer_whatsapp: string | null;
  line_items: unknown;
};

type LineItemLite = {
  slug?: unknown;
  productId?: unknown;
};

const STANDARD_SLUGS = Object.keys(HAMMEREX_STANDARD_BLURBS);

export async function recomputeHammerexStandard(listingId: string) {
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, email, whatsapp")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing.data) return null;

  const email = (listing.data.email ?? "").toLowerCase().trim();
  const waDigits = whatsappDigits(listing.data.whatsapp ?? "");

  // Pull a generous candidate set — we filter further in JS so we can match
  // on normalised whatsapp digits without a Postgres function dependency.
  const candidates = await supabaseAdmin
    .from("hammerex_quote_requests")
    .select("buyer_email, buyer_whatsapp, line_items")
    .or(`buyer_email.ilike.${email},buyer_whatsapp.ilike.%${waDigits.slice(-9)}%`);

  const rows = (candidates.data ?? []) as QuoteRow[];

  const matchedSlugs = new Set<string>();
  // line_items entries may carry `slug` directly OR only `productId`. Collect
  // productIds first, then resolve them in a single batched query.
  const productIdsToResolve = new Set<string>();

  for (const row of rows) {
    const rowEmail = (row.buyer_email ?? "").toLowerCase().trim();
    const rowDigits = whatsappDigits(row.buyer_whatsapp ?? "");
    const emailMatch = email && rowEmail && rowEmail === email;
    const waMatch = waDigits && rowDigits && rowDigits === waDigits;
    if (!emailMatch && !waMatch) continue;

    const items = Array.isArray(row.line_items) ? (row.line_items as LineItemLite[]) : [];
    for (const item of items) {
      if (typeof item.slug === "string" && item.slug.length > 0) {
        if (STANDARD_SLUGS.includes(item.slug)) matchedSlugs.add(item.slug);
      } else if (typeof item.productId === "string" && item.productId.length > 0) {
        productIdsToResolve.add(item.productId);
      }
    }
  }

  if (productIdsToResolve.size > 0) {
    const productRows = await supabaseAdmin
      .from("hammerex_products")
      .select("id, slug")
      .in("id", Array.from(productIdsToResolve));
    for (const p of productRows.data ?? []) {
      if (p.slug && STANDARD_SLUGS.includes(p.slug)) matchedSlugs.add(p.slug);
    }
  }

  // Preserve canonical priority order from HAMMEREX_STANDARD_BLURBS.
  const orderedMatches = STANDARD_SLUGS.filter((s) => matchedSlugs.has(s));
  const verified = orderedMatches.length > 0;
  const blurb = verified ? HAMMEREX_STANDARD_BLURBS[orderedMatches[0]] ?? null : null;

  const update = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({
      hammerex_standard_products: orderedMatches,
      hammerex_standard_verified: verified,
      hammerex_standard_blurb: blurb
    })
    .eq("id", listingId)
    .select("*")
    .maybeSingle();

  return update.data ?? null;
}
