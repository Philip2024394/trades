/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */

// ProductQABlock — empty-state Q&A prompt for the Xrated PDP.
//
// Phase 1 ships without a backing table — the goal is to nudge buyers to
// fire a structured WhatsApp question to the tradesperson, who answers
// inside their own thread. Once we have signal that this gets used we'll
// add a hammerex_xrated_questions table and show real Q&A rows above the
// CTA. Until then this is pure prompt-the-owner.
//
// House rules: 13px floor, yellow accent #FFB300, green WhatsApp CTA
// #0F7A3F. No "use client" — pure server render.

import type { HammerexTradeOffListing, HammerexXratedProduct } from "@/lib/supabase";

function refNumber(product: HammerexXratedProduct): string {
  const id = (product.id || "").replace(/[^0-9a-f]/gi, "").slice(0, 6);
  return id.toUpperCase() || "—";
}

export function ProductQABlock({
  product,
  listing
}: {
  product: HammerexXratedProduct;
  listing: HammerexTradeOffListing;
}) {
  const ref = refNumber(product);
  const digits = listing.whatsapp.replace(/[^0-9]/g, "");
  const msg = `Hi ${listing.display_name}, I have a question about "${product.name}" — ${ref}`;
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: "#FFB300" }}
      >
        Q&amp;A
      </p>
      <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
        Ask a question — owner answers within 24h
      </h2>
      <p className="mt-2 text-[13px] text-neutral-500">
        Got a specific question about &ldquo;{product.name}&rdquo;? Fire it on
        WhatsApp — {listing.display_name} replies direct, usually same day.
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98]"
        style={{
          background: "#0F7A3F",
          boxShadow: "0 8px 22px rgba(15,122,63,0.45)"
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
        </svg>
        Ask on WhatsApp
      </a>
    </section>
  );
}

export default ProductQABlock;
