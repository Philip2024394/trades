/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */

// CompareCell — single cell rendered inside the 3-up compare strip on
// the PDP. Originally lived inline at the bottom of the product page;
// extracted here so both the PDP and the SiblingsWithCompare toggle can
// render the same shape without divergence.
//
// Shape: square cover image, optional "This product" pill on the current
// product, name (clamp-2 with min height for visual alignment), price.

import type { HammerexXratedProduct } from "@/lib/supabase";

function formatGbp(pence: number): string {
  if (!Number.isFinite(pence) || pence <= 0) return "£0";
  const pounds = pence / 100;
  return pounds % 1 === 0
    ? `£${pounds.toLocaleString("en-GB")}`
    : `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CompareCell({
  product,
  slug,
  current = false
}: {
  product: HammerexXratedProduct;
  slug?: string;
  current?: boolean;
}) {
  const body = (
    <>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100">
        {product.cover_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.cover_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-neutral-400">
            No image
          </div>
        )}
        {current && (
          <span
            className="absolute left-2 top-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-sm"
            style={{ background: "#FFB300" }}
          >
            This product
          </span>
        )}
      </div>
      <p
        className="mt-2 line-clamp-2 text-[13px] font-extrabold leading-tight text-neutral-900"
        style={{ minHeight: "2.4em" }}
      >
        {product.name}
      </p>
      <p className="mt-1 text-[13px] font-extrabold text-neutral-900">
        {formatGbp(product.price_pence)}
      </p>
    </>
  );
  if (current || !slug || !product.slug) {
    return <div>{body}</div>;
  }
  return (
    <a
      href={`/${slug}/shop/${product.slug}`}
      className="block transition hover:opacity-90"
      aria-label={`View ${product.name}`}
    >
      {body}
    </a>
  );
}
