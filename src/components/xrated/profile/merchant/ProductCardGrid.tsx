/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */

// Xrated Shop Mode — public product grid.
//
// Server component. Renders the tradesperson's live products in a
// 2-col (mobile) / 3-col (lg) grid. Replaces ServicesTabbedGallery on
// the public profile when the shop_mode add-on is on AND the tradie
// is on a paid tier. The cart, modal, and WhatsApp composer are all
// handled by client islands.

import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedProduct
} from "@/lib/supabase";
import { ProductCardLink } from "./ProductCardLink";
import { tradeLabel } from "@/lib/tradeOff";
import { isStorefrontOn } from "@/lib/xratedAddons";
import { assertMerchantContext } from "@/lib/devAssert";

async function loadProducts(listingId: string): Promise<HammerexXratedProduct[]> {
  const res = await supabase
    .from("hammerex_xrated_products")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "live")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return (res.data ?? []) as HammerexXratedProduct[];
}

// Batch-fetch review aggregates so every grid card can render the
// stars-left-of-View pattern without N+1 queries. Returns a Map keyed
// by product_id → { rating, count }. Products without any live reviews
// are simply absent from the map.
async function loadProductStats(
  productIds: string[]
): Promise<Map<string, { rating: number; count: number }>> {
  const out = new Map<string, { rating: number; count: number }>();
  if (productIds.length === 0) return out;
  const res = await supabase
    .from("hammerex_xrated_reviews")
    .select("product_id, overall_rating")
    .in("product_id", productIds)
    .eq("status", "live")
    // 24h cool-down + admin-Hide gate. Admin Mark Safe clamps
    // goes_live_at = now(), so this surfaces straight away.
    .lte("goes_live_at", new Date().toISOString());
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const row of res.data ?? []) {
    const pid = (row as { product_id: string | null }).product_id;
    const r = (row as { overall_rating: number | null }).overall_rating;
    if (!pid || typeof r !== "number") continue;
    const b = buckets.get(pid) ?? { sum: 0, n: 0 };
    b.sum += r;
    b.n += 1;
    buckets.set(pid, b);
  }
  for (const [pid, b] of buckets.entries()) {
    out.set(pid, { rating: b.sum / b.n, count: b.n });
  }
  return out;
}

export async function ProductCardGrid({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  // Defence-in-depth: hard-stop if a future caller renders this from a
  // non-storefront listing. The parent already gates — this catches
  // refactor drift before products surface on a service profile.
  if (!isStorefrontOn(listing)) return null;
  assertMerchantContext(listing, "ProductCardGrid");
  const products = await loadProducts(listing.id);
  const statsByProduct = await loadProductStats(products.map((p) => p.id));
  const firstName = listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const appName = `${tradeLabel(listing.primary_trade)} Service`;

  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Trade Center
        </p>
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
          <span>Products</span>
          {/* Count chip — yellow pill with the live product count so the
              header reads as "Products · 8" instead of the awkward
              run-on "Products 8". Helps customers spot at a glance how
              big the catalogue is. */}
          <span
            className="inline-flex h-7 items-center justify-center rounded-full px-2.5 text-[13px] font-extrabold text-neutral-900 sm:h-8 sm:text-sm"
            style={{ background: "#FFB300" }}
            aria-label={`${products.length} products in catalogue`}
          >
            {products.length}
          </span>
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Add what you need to your cart and {appName} will confirm the
          final price by WhatsApp. No card payments in the app.
        </p>
      </div>

      {products.length === 0 ? (
        <EmptyShop slug={listing.slug} firstName={firstName} whatsapp={listing.whatsapp} />
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCardLink
                product={p}
                slug={listing.slug}
                stats={statsByProduct.get(p.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyShop({
  slug,
  firstName,
  whatsapp
}: {
  slug: string;
  firstName: string;
  whatsapp: string;
}) {
  const digits = whatsapp.replace(/[^0-9]/g, "");
  const waHref = `https://wa.me/${digits}?text=${encodeURIComponent(
    `Hi ${firstName}, I found your trade center on Xrated — could you share what you sell?`
  )}`;
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center sm:p-8">
      <p className="text-sm font-extrabold text-neutral-900">
        This trade is setting up their trade center.
      </p>
      <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
        Products will appear here soon — meanwhile send {firstName} a quick
        message.
      </p>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-5 text-xs font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98] sm:text-sm"
        style={{ background: "#0F7A3F", boxShadow: "0 8px 22px rgba(15,122,63,0.45)" }}
        aria-label={`Send ${firstName} a WhatsApp message about their trade center`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Z" />
        </svg>
        Send an enquiry on WhatsApp
      </a>
      <p className="mt-3 text-[11px] text-neutral-400">
        Profile: <span className="font-mono">/{slug}</span>
      </p>
    </div>
  );
}
