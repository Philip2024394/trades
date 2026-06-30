"use client";

// CrossSellPanel — "Complete your project" section under every Material
// Calculator output. Pulls the merchant's OWN complementary products
// (matched by subcategory) so a paint calc on Dulux 5L surfaces the
// same merchant's brushes, rollers, masking tape, etc. Missing
// categories still surface as plain advisory tips so the customer
// knows what they need even if the merchant doesn't stock it.

import { useState } from "react";
import Link from "next/link";
import { formatGbp, addItem } from "@/lib/xratedCart";
import { crossSellFor, type CrossSellProductRef } from "@/lib/calculators/crossSell";

export function CrossSellPanel({
  listingSlug,
  currentProductId,
  siblings,
  requiredSubcategories
}: {
  listingSlug: string;
  currentProductId: string;
  siblings: CrossSellProductRef[];
  requiredSubcategories: string[];
}) {
  const result = crossSellFor(requiredSubcategories, currentProductId, siblings);
  const [toast, setToast] = useState<string | null>(null);

  // No matches AND no missing tips → render nothing (no products yet on
  // the merchant + no advisory to surface).
  if (result.matches.length === 0 && result.missing.length === 0) {
    return null;
  }

  function addOne(p: CrossSellProductRef) {
    addItem(listingSlug, {
      product_id: p.id,
      name: p.name,
      price_pence: p.price_pence,
      cover_url: p.cover_url,
      qty: 1
    });
    setToast(`Added ${p.name} to cart.`);
    setTimeout(() => setToast(null), 2400);
  }

  function addAll() {
    for (const m of result.matches) {
      for (const p of m.products) {
        addItem(listingSlug, {
          product_id: p.id,
          name: p.name,
          price_pence: p.price_pence,
          cover_url: p.cover_url,
          qty: 1
        });
      }
    }
    setToast("All complementary items added to cart.");
    setTimeout(() => setToast(null), 2400);
  }

  const totalMatchPence = result.matches.reduce(
    (acc, m) => acc + m.products.reduce((a, p) => a + p.price_pence, 0),
    0
  );

  return (
    <div className="mt-4 rounded-2xl border border-[#FFB300]/40 bg-[#FFFBEC] p-4 sm:p-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#7A4F00]">
        Complete your project
      </p>
      <p className="mt-1 text-[13px] text-neutral-700">
        Items from this merchant&rsquo;s catalogue that pair with this calculator.
      </p>

      {result.matches.length > 0 && (
        <div className="mt-3 space-y-2">
          {result.matches.map((m) => (
            <div
              key={m.subcategory_slug}
              className="flex items-center gap-3 rounded-lg border border-[#FFB300]/40 bg-white p-2.5"
            >
              {m.products[0].cover_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={m.products[0].cover_url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-md border border-neutral-200 object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-[9px] font-bold uppercase text-neutral-400">
                  No image
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A4F00]">
                  {m.subcategory_label}
                </p>
                <Link
                  href={
                    m.products[0].slug
                      ? `/${listingSlug}/shop/${m.products[0].slug}`
                      : `/${listingSlug}/shop`
                  }
                  className="block truncate text-[13px] font-extrabold text-neutral-900 hover:underline"
                >
                  {m.products[0].name}
                </Link>
                <p className="text-[12px] font-bold text-neutral-700">
                  {formatGbp(m.products[0].price_pence)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => addOne(m.products[0])}
                className="inline-flex h-9 items-center rounded-full bg-[#FFB300] px-3 text-[12px] font-extrabold text-neutral-900"
              >
                + Add
              </button>
            </div>
          ))}
        </div>
      )}

      {result.matches.length > 1 && (
        <button
          type="button"
          onClick={addAll}
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#FFB300] px-4 text-[13px] font-extrabold text-neutral-900"
        >
          Add all {result.matches.length} items · {formatGbp(totalMatchPence)}
        </button>
      )}

      {result.missing.length > 0 && (
        <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-orange-700">
            You&rsquo;ll also need
          </p>
          <p className="mt-1 text-[12px] font-semibold text-orange-800">
            {result.missing.map((m) => m.label).join(" · ")}
          </p>
          <p className="mt-1 text-[11px] text-orange-700">
            Not stocked here — try a hardware store or message the merchant on
            WhatsApp.
          </p>
        </div>
      )}

      {toast && (
        <p className="mt-3 rounded-lg bg-neutral-900 px-3 py-2 text-center text-[12px] font-bold text-white">
          {toast}
        </p>
      )}
    </div>
  );
}
