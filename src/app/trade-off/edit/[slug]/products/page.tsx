// /trade-off/edit/[slug]/products
//
// Merchant products list. Every product owned by the merchant with:
//   - thumb + name + price
//   - three small "surface" pips (canteen / trending / TC) showing at
//     a glance where this product is currently listed
//   - Edit link → /products/[id]
// + Add new button → /products/new

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { ArrowLeft, Plus, Store, Flame, ShoppingBag, Package } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Products · Merchant · Thenetworkers",
  robots: { index: false, follow: false }
};

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

type Row = {
  id: string;
  name: string;
  image_url: string | null;
  price_gbp: number | null;
  show_in_canteen_products: boolean | null;
  show_in_trending: boolean | null;
  show_in_trade_center: boolean | null;
  trade_center_listing_id: string | null;
  featured: boolean | null;
  updated_at: string | null;
};

export default async function MerchantProductsListPage({
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
    .select("id, slug, display_name, edit_token, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing || !constantTimeEq(listing.edit_token, token)) {
    redirect(`/trade-off/edit/${slug}`);
  }
  if (listing.status !== "live") redirect(`/trade-off/edit/${slug}`);

  const { data: canteen } = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("host_slug", slug)
    .maybeSingle();

  const rows: Row[] = canteen
    ? ((await supabaseAdmin
        .from("hammerex_canteen_products")
        .select("id, name, image_url, price_gbp, show_in_canteen_products, show_in_trending, show_in_trade_center, trade_center_listing_id, featured, updated_at")
        .eq("canteen_id", canteen.id)
        .order("updated_at", { ascending: false })
        .limit(200)).data ?? [])
    : [];

  const tokenQ = `?token=${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:px-6 md:pt-8">
        {/* Back + label */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/trade-off/edit/${slug}${tokenQ}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ArrowLeft size={14} strokeWidth={2.4}/>
            Dashboard
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#FFB300" }}/>
            Products
          </span>
        </div>

        <h1 className="text-[24px] font-black leading-tight tracking-tight md:text-[32px]">
          Your products.
        </h1>
        <p className="mt-2 text-[13px] leading-[1.55] text-[#1B1A17]/70 md:text-[14px]">
          Upload once. Choose which surfaces it shows on: your canteen, the trending swipe sheet, and Trade Center.
        </p>

        {/* Add button — sticks near the top on mobile */}
        <div className="mt-4">
          <Link
            href={`/trade-off/edit/${slug}/products/new${tokenQ}`}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-[12.5px] font-black uppercase tracking-wider text-[#0A0A0A] shadow-md active:scale-[0.98]"
            style={{ backgroundColor: "#FFB300" }}
          >
            <Plus size={14} strokeWidth={2.6}/>
            Add product
          </Link>
        </div>

        {/* Rows */}
        <div className="mt-6 space-y-2">
          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#E5D9BD] bg-white/50 p-8 text-center">
              <Package size={22} className="text-[#1B1A17]/40" strokeWidth={2.2}/>
              <p className="text-[13px] font-bold text-[#1B1A17]/70">
                No products yet.
              </p>
              <p className="max-w-[36ch] text-[11.5px] text-[#1B1A17]/50">
                Add your first product — it&apos;ll flow to your canteen page, the trending swipe, and Trade Center (if you&apos;re on the right tier).
              </p>
            </div>
          )}

          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/trade-off/edit/${slug}/products/${r.id}${tokenQ}`}
              className="flex items-center gap-3 rounded-xl border border-[#E5D9BD] bg-white/70 p-2.5 hover:bg-white"
            >
              {/* Thumb — object-contain per platform image rule */}
              <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-50">
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image_url}
                    alt=""
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#1B1A17]/30">
                    <Package size={18} strokeWidth={2}/>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {r.featured && (
                    <span
                      aria-label="Featured"
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: "#FFB300" }}
                    />
                  )}
                  <span className="truncate text-[13px] font-black text-[#1B1A17]">
                    {r.name}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] font-bold text-[#1B1A17]/60">
                  <span>{r.price_gbp && r.price_gbp > 0 ? `£${r.price_gbp}` : "POA"}</span>
                  <span className="text-[#1B1A17]/30">·</span>
                  {/* Three surface pips — green when live on that surface */}
                  <div className="inline-flex items-center gap-1">
                    <SurfacePip
                      on={r.show_in_canteen_products !== false}
                      label="Canteen"
                      icon={<Store size={9} strokeWidth={2.6}/>}
                    />
                    <SurfacePip
                      on={r.show_in_trending !== false}
                      label="Trending"
                      icon={<Flame size={9} strokeWidth={2.6}/>}
                    />
                    <SurfacePip
                      on={r.show_in_trade_center !== false && !!r.trade_center_listing_id}
                      label="Trade Center"
                      icon={<ShoppingBag size={9} strokeWidth={2.6}/>}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

function SurfacePip({ on, label, icon }: { on: boolean; label: string; icon: React.ReactNode }) {
  return (
    <span
      title={`${label}: ${on ? "on" : "off"}`}
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
        on ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-400"
      }`}
      aria-label={`${label} ${on ? "on" : "off"}`}
    >
      {icon}
    </span>
  );
}
