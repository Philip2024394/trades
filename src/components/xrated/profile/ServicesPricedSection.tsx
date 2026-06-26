// Public profile — "Services & Prices" inline teaser.
//
// Server component. Mirrors the visual rhythm of RecommendedTrades (yellow
// eyebrow, h2, "View all →" link). Server-fetches the listing's live
// services from Supabase, caps at 6, hands each tile to the client
// ServiceCard which owns the modal interaction. Empty list = render
// nothing (no dead teaser on a profile without services yet).

import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedProduct
} from "@/lib/supabase";
import { ServiceCard } from "./ServiceCard";

const PREVIEW_LIMIT = 6;

async function loadServices(listingId: string): Promise<HammerexXratedProduct[]> {
  const res = await supabase
    .from("hammerex_xrated_products")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "live")
    .eq("kind", "service")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(PREVIEW_LIMIT);
  return (res.data ?? []) as HammerexXratedProduct[];
}

export async function ServicesPricedSection({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const services = await loadServices(listing.id);
  if (services.length === 0) return null;

  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Services &amp; Prices
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {firstName}&rsquo;s priced services
          </h2>
          <p className="mt-1 text-[13px] text-neutral-500 sm:text-sm">
            Tap any tile to see the detail or send a quick enquiry.
          </p>
        </div>
        <a
          href={`/${listing.slug}/services-prices`}
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:inline-flex sm:h-10"
        >
          View all
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <li key={s.id}>
            <ServiceCard service={s} listing={listing} />
          </li>
        ))}
      </ul>

      {/* Mobile-only view-all CTA — the header link above is sm:inline only
          so we surface a full-width pill here for thumbs. */}
      <a
        href={`/${listing.slug}/services-prices`}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:hidden"
      >
        View all services &amp; prices
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </a>
    </section>
  );
}
