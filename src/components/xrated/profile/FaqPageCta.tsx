// Public profile — FAQ Page inline CTA card.
//
// Server component. Mirrors the TrustedTradesCta pattern: yellow ALL-CAPS
// eyebrow, h2 with the FAQ count + firstName, sub-copy, "See all →" link
// to /<slug>/faq. Silently hides when zero live FAQs so a freshly-enabled
// add-on doesn't leave a dead container on the profile.

import {
  supabase,
  type HammerexTradeOffListing
} from "@/lib/supabase";

async function loadLiveCount(listingId: string): Promise<number> {
  const res = await supabase
    .from("hammerex_xrated_faq_items")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .eq("status", "live");
  return res.count ?? 0;
}

export async function FaqPageCta({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const count = await loadLiveCount(listing.id);
  if (count === 0) return null;

  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const headline =
    count === 1
      ? `${count} answer from ${firstName}`
      : `${count} answers from ${firstName}`;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12">
      <a
        href={`/${listing.slug}/faq`}
        className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-[#FFB300] hover:shadow-lg sm:p-6"
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            FAQ
          </p>
          <p className="mt-1.5 text-lg font-extrabold leading-tight text-neutral-900 sm:text-xl">
            {headline}
          </p>
          <p className="mt-1 text-[13px] text-neutral-500 sm:text-sm">
            Reference-numbered questions and visual answers from real jobs.
          </p>
        </div>
        <span
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-4 text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-sm transition group-hover:scale-105 sm:h-12 sm:text-sm"
          style={{ background: "#FFB300" }}
        >
          See all {count}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </a>
    </section>
  );
}
