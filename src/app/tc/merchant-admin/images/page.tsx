// /tc/merchant-admin/images — merchant image manager (demo).
//
// Lists the merchant's products; tapping one reveals the primary-image
// uploader with side-by-side auto-clean review. This is a fixture-mode
// demo — in production the uploader hits real storage (S3 / ImageKit).

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Package, ImageIcon } from "lucide-react";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { PrimaryImageUploader } from "@/apps/marketplace/components/PrimaryImageUploader";
import { PRODUCT_FIXTURES } from "@/apps/marketplace/data/products";
import { MERCHANT_FIXTURES } from "@/apps/marketplace/data/merchants";

const MERCHANT_SLUG = "manchester-tools-direct";

export default function MerchantImageAdminPage() {
  const merchant = MERCHANT_FIXTURES.find((m) => m.slug === MERCHANT_SLUG);
  const [query, setQuery] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const products = useMemo(
    () =>
      PRODUCT_FIXTURES.filter((p) => p.merchantSlug === MERCHANT_SLUG).filter(
        (p) =>
          !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.spec.toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  );

  const activeProduct = activeSlug ? products.find((p) => p.slug === activeSlug) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              Merchant admin · Image manager
            </div>
            <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
              {merchant?.displayName ?? "Merchant"} — Product images
            </h1>
            <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
              Upload one primary image per product. We auto-clean the background so category grids
              look consistent. Additional gallery images have no restrictions.
            </p>
          </div>
          <Link
            href={`/tc/trade-center/merchant/${MERCHANT_SLUG}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border bg-white px-4 text-[11px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            View store front
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Product list */}
          <aside
            className="flex flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {/* Search */}
            <label
              className="flex min-h-[44px] items-center gap-2 rounded-md border bg-neutral-50 px-3"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <Search size={13} className="text-neutral-500"/>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products"
                className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-neutral-400"
              />
            </label>

            <ul className="flex max-h-[520px] flex-col overflow-y-auto">
              {products.length === 0 && (
                <li className="p-4 text-center text-[11.5px] text-neutral-500">
                  No products match your search.
                </li>
              )}
              {products.map((p) => {
                const isActive = p.slug === activeSlug;
                return (
                  <li key={p.slug}>
                    <button
                      type="button"
                      onClick={() => setActiveSlug(p.slug)}
                      aria-pressed={isActive}
                      className="flex min-h-[64px] w-full items-center gap-3 rounded-md px-2 py-2 text-left transition"
                      style={{ backgroundColor: isActive ? "#FEF3C7" : "transparent" }}
                    >
                      <div
                        className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md"
                        style={{ backgroundColor: "#F5F0E4" }}
                        aria-hidden
                      >
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="h-full w-full object-contain p-1"/>
                        ) : (
                          <Package size={18} strokeWidth={1.5} className="text-neutral-400"/>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[12px] font-black leading-tight text-neutral-900">
                          {p.name}
                        </div>
                        <div className="mt-0.5 text-[10.5px] text-neutral-500">
                          {p.spec}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Uploader / instructions */}
          <div>
            {activeProduct ? (
              <PrimaryImageUploader
                key={activeProduct.slug}
                productSlug={activeProduct.slug}
                productName={activeProduct.name}
                currentImageUrl={activeProduct.imageUrl}
              />
            ) : (
              <section
                className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center"
                style={{ borderColor: "rgba(139,69,19,0.20)" }}
              >
                <ImageIcon size={32} strokeWidth={1.5} className="text-neutral-400"/>
                <div className="text-[13px] font-black text-neutral-900">
                  Pick a product on the left
                </div>
                <p className="max-w-md text-[11.5px] leading-snug text-neutral-500">
                  We&apos;ll auto-clean the background of whatever primary image you upload. Additional
                  images stay untouched.
                </p>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
