// "For sale on The Yard" — trade profile shop section.
//
// Complements (does NOT replace) the merchant storefront system
// (ProductCardGrid + hammerex_xrated_products). This surface shows
// the SERVICE trade's live yard product / tools-sell / materials-
// surplus posts as a compact grid — a one-tap way for visitors to
// see what a trade is currently offering without having to browse
// The Yard.
//
// Reuses the visual language of the merchant ProductCard (aspect-
// square image, price bubble, condition/stock chip) so the two
// commerce surfaces feel like one product family.
//
// Server component — one query per profile, no client fetching.

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { HammerexTradeOffYardPost } from "@/lib/supabase";
import { YARD_CONDITION_LABEL, formatPostPriceCurrency } from "@/lib/yardPosts";
import { Store, ArrowRight } from "lucide-react";

const BRAND_YELLOW = "#FFB300";

const SHOP_KINDS = new Set([
  "product",
  "tools-sell",
  "tools-rent",
  "materials-surplus"
]);

async function loadYardShop(listingId: string) {
  const res = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select(
      "id, kind, title, body, image_urls, product_price_pence, price_currency, condition, stock_qty, delivery_options, is_boosted_until, created_at, expires_at"
    )
    .eq("listing_id", listingId)
    .eq("status", "live")
    .in("kind", Array.from(SHOP_KINDS))
    .gt("expires_at", new Date().toISOString())
    .order("is_boosted_until", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(12);
  return (res.data ?? []) as Array<
    Pick<
      HammerexTradeOffYardPost,
      | "id"
      | "kind"
      | "title"
      | "body"
      | "image_urls"
      | "product_price_pence"
      | "price_currency"
      | "condition"
      | "stock_qty"
      | "delivery_options"
      | "is_boosted_until"
      | "created_at"
      | "expires_at"
    >
  >;
}

const KIND_LABEL: Record<string, string> = {
  product: "For sale",
  "tools-sell": "Tools for sale",
  "tools-rent": "For hire",
  "materials-surplus": "Surplus"
};

export async function YardShopSection({
  listingId,
  slug,
  displayName
}: {
  listingId: string;
  slug: string;
  displayName: string;
}) {
  const posts = await loadYardShop(listingId);
  if (posts.length === 0) return null;

  const firstName = displayName.split(/\s+/)[0] ?? displayName;

  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: BRAND_YELLOW }}
        >
          On The Yard
        </p>
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
          <Store className="h-5 w-5 text-amber-700" aria-hidden />
          <span>For sale</span>
          <span
            className="inline-flex h-7 items-center justify-center rounded-full px-2.5 text-[13px] font-extrabold text-neutral-900 sm:h-8 sm:text-sm"
            style={{ background: BRAND_YELLOW }}
            aria-label={`${posts.length} items currently listed`}
          >
            {posts.length}
          </span>
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          What {firstName} is currently offering on The Yard — tools, materials,
          surplus stock. Tap a card to see the full listing.
        </p>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => {
          const heroImage = p.image_urls?.[0] ?? null;
          const isBoosted = Boolean(
            p.is_boosted_until && Date.parse(p.is_boosted_until) > Date.now()
          );
          const conditionLabel = p.condition
            ? YARD_CONDITION_LABEL[p.condition] ?? p.condition
            : null;
          const priceText =
            p.product_price_pence !== null
              ? formatPostPriceCurrency(
                  p.product_price_pence,
                  p.price_currency
                )
              : null;
          return (
            <li key={p.id}>
              <Link
                href={`/trade-off/yard/${p.id}`}
                className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition hover:border-amber-400 hover:shadow-md"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
                  {heroImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={heroImage}
                      alt={p.title}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                      No image
                    </div>
                  )}
                  {/* Kind chip top-left */}
                  <span
                    className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white backdrop-blur"
                  >
                    {KIND_LABEL[p.kind] ?? p.kind}
                  </span>
                  {/* Price bubble top-right */}
                  {priceText && (
                    <span
                      className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums shadow-md"
                      style={{ background: BRAND_YELLOW, color: "#0A0A0A" }}
                    >
                      {priceText}
                    </span>
                  )}
                  {/* Boosted ribbon bottom */}
                  {isBoosted && (
                    <span
                      className="absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white shadow"
                      style={{ background: "#0F7A3D" }}
                    >
                      Boosted
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1 p-3 sm:p-3.5">
                  <p
                    className="line-clamp-2 text-[13px] font-extrabold leading-tight text-neutral-900 sm:text-sm"
                    style={{ minHeight: "2.4em" }}
                  >
                    {p.title}
                  </p>
                  {(conditionLabel || p.stock_qty > 0) && (
                    <p className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-neutral-600">
                      {conditionLabel && (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5">
                          {conditionLabel}
                        </span>
                      )}
                      {p.stock_qty > 1 && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
                          {p.stock_qty} in stock
                        </span>
                      )}
                      {p.stock_qty === 0 && (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-red-800">
                          Out of stock
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footer CTA — see all live listings from this trade in the
          Yard's own search view. */}
      <div className="mt-5 flex justify-center">
        <Link
          href={`/trade-off/yard?q=${encodeURIComponent(slug)}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-[12px] font-black text-neutral-700 hover:border-amber-400 hover:text-amber-700"
        >
          See all listings on The Yard
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
