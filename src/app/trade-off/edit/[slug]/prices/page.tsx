// /trade-off/edit/[slug]/prices — merchant live-price dashboard.
//
// Server shell: validates magic-link, loads existing rows, hands the
// client component the merchant identity + rows so publish/edit/
// remove all round-trip through the same auth.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PricesForm, type PriceRow } from "./PricesForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live prices · Merchant · The Construction Notebook",
  robots: { index: false, follow: false }
};

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

export default async function MerchantPricesPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const token = Array.isArray(sp.token) ? sp.token[0] : sp.token ?? "";
  if (!token) redirect(`/trade-off/edit/${slug}`);

  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, edit_token, status, postcode_prefix, city")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing || !constantTimeEq(listing.edit_token, token)) {
    redirect(`/trade-off/edit/${slug}`);
  }
  if (listing.status !== "live") redirect(`/trade-off/edit/${slug}`);

  const { data: rows } = await supabaseAdmin
    .from("hammerex_material_prices")
    .select(
      "id, item_slug, item_label, unit_label, price_pence, currency, qty_included, postcode_prefix, region, is_live, updated_at, expires_at"
    )
    .eq("merchant_listing_id", listing.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  const initialRows: PriceRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    itemSlug: r.item_slug,
    itemLabel: r.item_label,
    unitLabel: r.unit_label,
    pricePence: r.price_pence,
    currency: r.currency as PriceRow["currency"],
    qtyIncluded: r.qty_included,
    postcodePrefix: r.postcode_prefix,
    region: r.region,
    isLive: r.is_live,
    updatedAt: r.updated_at,
    expiresAt: r.expires_at
  }));

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 md:px-8 md:pt-10">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/trade-off/edit/${slug}?token=${encodeURIComponent(token)}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            ← Dashboard
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "#FFB300" }}
            />
            Live prices
          </span>
        </div>

        <h1 className="text-[26px] font-black leading-tight tracking-tight md:text-[34px]">
          Publish your live prices.
        </h1>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.55] text-[#1B1A17]/70 md:text-[15px]">
          Every trade nearby who searches for these items sees your price
          instantly. Rows update the moment you save; they auto-expire after
          14 days so nothing goes stale.
        </p>

        <div className="mt-8">
          <PricesForm
            slug={listing.slug}
            editToken={token}
            defaultPostcodePrefix={listing.postcode_prefix ?? ""}
            defaultRegion={listing.city ?? ""}
            initialRows={initialRows}
          />
        </div>
      </div>
    </main>
  );
}
