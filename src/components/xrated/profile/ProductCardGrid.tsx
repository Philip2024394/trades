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
import { ProductCard } from "./ProductCard";

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

export async function ProductCardGrid({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const products = await loadProducts(listing.id);
  const firstName = listing.display_name.split(/\s+/)[0] ?? listing.display_name;

  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Shop
        </p>
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Products from {firstName}
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Add what you need to your cart and {firstName} will confirm the
          final price by WhatsApp. No card payments in the app.
        </p>
      </div>

      {products.length === 0 ? (
        <EmptyShop slug={listing.slug} firstName={firstName} whatsapp={listing.whatsapp} />
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const siblings = products.filter(
              (s) => (p.compare_with ?? []).includes(s.id) && s.id !== p.id
            );
            return (
              <li key={p.id}>
                <ProductCard
                  product={p}
                  slug={listing.slug}
                  siblings={siblings}
                  themeColor={listing.theme_color || "#FFB300"}
                />
              </li>
            );
          })}
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
    `Hi ${firstName}, I found your shop on Xrated — could you share what you sell?`
  )}`;
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center sm:p-8">
      <p className="text-sm font-extrabold text-neutral-900">
        This trade is setting up their shop.
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
        aria-label={`Send ${firstName} a WhatsApp message about their shop`}
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
