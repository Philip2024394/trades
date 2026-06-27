// Public profile — past projects swipeable strip.
//
// Horizontal scroll-snap strip rendered just below the hero. Surfaces
// the 5 most-recent COMPLETED projects on mobile, 8 on desktop. Tap a
// tile to open the per-project page.
//
// Hidden entirely when zero completed projects exist (per user default
// — no empty graveyard).

import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedProject
} from "@/lib/supabase";

const MAX_TILES = 8; // desktop cap; mobile uses scroll overflow

async function loadCompleted(listingId: string): Promise<HammerexXratedProject[]> {
  const res = await supabase
    .from("hammerex_xrated_projects")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(MAX_TILES);
  return (res.data ?? []) as HammerexXratedProject[];
}

function monthYear(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export async function PastProjectsStrip({
  listing,
  heading = "Past projects"
}: {
  listing: HammerexTradeOffListing;
  heading?: string;
}) {
  const projects = await loadCompleted(listing.id);
  if (projects.length === 0) return null;

  return (
    <section className="w-full px-4 pt-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-neutral-700 sm:text-sm">
            {heading}
          </h3>
          <a
            href={`/${listing.slug}/job-diary`}
            className="text-[13px] font-bold text-neutral-500 transition hover:text-[#FFB300]"
          >
            View all
          </a>
        </div>
        <ul
          className="-mx-1 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3"
          style={{ scrollPaddingLeft: "0.25rem" }}
        >
          {projects.map((p) => (
            <li
              key={p.id}
              className="w-40 shrink-0 snap-start sm:w-48"
            >
              <a
                href={`/${listing.slug}/job-diary/${p.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-[#FFB300] hover:shadow-md"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.cover_image_url}
                    alt={p.title}
                    className="h-full w-full object-cover transition group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                  <span
                    className="absolute right-2 top-2 inline-flex h-6 items-center rounded-full px-2 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900"
                    style={{ background: "#FFB300" }}
                  >
                    Done
                  </span>
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <p className="line-clamp-2 text-[13px] font-extrabold leading-tight text-neutral-900">
                    {p.title}
                  </p>
                  <p className="text-[13px] text-neutral-500">
                    {p.location_label}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    {monthYear(p.started_at)}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
