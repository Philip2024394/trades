// Public profile — Downloads inline teaser.
//
// Server component. Mirrors the visual rhythm of RecommendedTrades:
// yellow ALL-CAPS eyebrow, h2 with the trade's first name, sub-copy,
// "View all →" link to /<slug>/downloads, max-6 tile grid. Self-renders
// nothing if the listing has zero live downloads.

import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedDownload
} from "@/lib/supabase";
import { DownloadCard } from "./DownloadCard";

const PREVIEW_LIMIT = 6;

async function loadDownloads(listingId: string): Promise<HammerexXratedDownload[]> {
  const res = await supabase
    .from("hammerex_xrated_downloads")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "live")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(PREVIEW_LIMIT);
  return (res.data ?? []) as HammerexXratedDownload[];
}

export async function DownloadsSection({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const downloads = await loadDownloads(listing.id);
  if (downloads.length === 0) return null;

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
            Downloads
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            Files from {firstName}
          </h2>
          <p className="mt-1 text-[13px] text-neutral-500 sm:text-sm">
            Brochures, forms, compliance documents &mdash; tap to download.
          </p>
        </div>
        <a
          href={`/${listing.slug}/downloads`}
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:inline-flex sm:h-10"
        >
          View all
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {downloads.map((d) => (
          <li key={d.id}>
            <DownloadCard download={d} trackingSlug={listing.slug} />
          </li>
        ))}
      </ul>

      <a
        href={`/${listing.slug}/downloads`}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:hidden"
      >
        View all downloads
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </a>
    </section>
  );
}
