// Public profile — full Downloads grid for the dedicated
// /<slug>/downloads sub-page.
//
// Server component. No limit. Always groups by category — the public
// vocabulary (Brochure, Catalogue, Compliance, Form, Qualification,
// Other) is shorter than the services categories and the section
// header reads better than a flat grid even with a single category.

import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedDownload
} from "@/lib/supabase";
import { DownloadCard } from "./DownloadCard";

const CATEGORY_ORDER: HammerexXratedDownload["category"][] = [
  "brochure",
  "catalogue",
  "compliance",
  "form",
  "qualification",
  "other"
];

const CATEGORY_LABEL: Record<HammerexXratedDownload["category"], string> = {
  brochure: "Brochure",
  catalogue: "Catalogue",
  compliance: "Compliance",
  form: "Form",
  qualification: "Qualification",
  other: "Other"
};

async function loadAllDownloads(listingId: string): Promise<HammerexXratedDownload[]> {
  const res = await supabase
    .from("hammerex_xrated_downloads")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "live")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return (res.data ?? []) as HammerexXratedDownload[];
}

export async function DownloadsGrid({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const downloads = await loadAllDownloads(listing.id);
  if (downloads.length === 0) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-4 sm:px-6">
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
          <p className="text-[13px] text-neutral-600 sm:text-base">
            No files uploaded yet.
          </p>
        </div>
      </section>
    );
  }

  const grouped = new Map<HammerexXratedDownload["category"], HammerexXratedDownload[]>();
  for (const d of downloads) {
    const arr = grouped.get(d.category) ?? [];
    arr.push(d);
    grouped.set(d.category, arr);
  }
  const groups = CATEGORY_ORDER
    .map((cat) => ({ category: cat, items: grouped.get(cat) ?? [] }))
    .filter((g) => g.items.length > 0);
  // When everything sits in a single category, the per-section <h3>
  // adds visual noise without information. Drop it.
  const hideHeadings = groups.length === 1;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-col gap-10">
        {groups.map((g) => (
          <div key={g.category}>
            {!hideHeadings && (
              <h3 className="mb-4 text-lg font-extrabold text-neutral-900 sm:text-xl">
                {CATEGORY_LABEL[g.category]}
              </h3>
            )}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((d) => (
                <li key={d.id}>
                  <DownloadCard download={d} trackingSlug={listing.slug} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
