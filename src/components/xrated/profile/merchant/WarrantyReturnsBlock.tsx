/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */

// WarrantyReturnsBlock — single-container PDP section.
//
// One rounded card with a yellow shield icon, an editable header (default
// "Warranty / Returns") and an editable body. Tradies override both via
// product.warranty_header + product.warranty_text in the dashboard.
// Server component; no client state.

import type { HammerexXratedProduct } from "@/lib/supabase";

const DEFAULT_HEADER = "Warranty / Returns";
const DEFAULT_BODY =
  "Each product carries its manufacturer's own warranty and return window — the exact terms are printed on the packaging or product documentation. Not fully satisfied? Return any unused item in its original packaging within that window for a full refund. If a product is faulty, message us on WhatsApp and we'll handle the manufacturer claim directly on your behalf — no forms, no third-party back-and-forth.";

export function WarrantyReturnsBlock({
  product
}: {
  product: HammerexXratedProduct;
}) {
  const headerRaw = (product.warranty_header ?? "").trim();
  const bodyRaw = (product.warranty_text ?? "").trim();
  const header = headerRaw.length > 0 ? headerRaw : DEFAULT_HEADER;
  const body = bodyRaw.length > 0 ? bodyRaw : DEFAULT_BODY;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
            style={{ background: "#FFB30022" }}
            aria-hidden="true"
          >
            <ShieldIcon />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold leading-tight text-neutral-900 sm:text-2xl">
              {header}
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
              {body}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFB300"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
