// Public profile — full Services & Prices grid for the dedicated
// /<slug>/services-prices sub-page.
//
// Server component. No limit. Groups by category when any service has one
// set (e.g. "Gardening", "Machinery") — otherwise renders a single flat
// grid. Each tile reuses the same client ServiceCard the home-page teaser
// uses, so the modal behaviour stays consistent across both surfaces.

import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedProduct
} from "@/lib/supabase";
import { ServiceCard } from "./ServiceCard";

async function loadAllServices(
  listingId: string
): Promise<HammerexXratedProduct[]> {
  const res = await supabase
    .from("hammerex_xrated_products")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "live")
    .eq("kind", "service")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return (res.data ?? []) as HammerexXratedProduct[];
}

const UNCATEGORISED = "__uncategorised__";

function groupByCategory(
  services: HammerexXratedProduct[]
): { label: string | null; items: HammerexXratedProduct[] }[] {
  const buckets = new Map<string, HammerexXratedProduct[]>();
  for (const s of services) {
    const raw = (s.category ?? "").trim();
    const key = raw.length === 0 ? UNCATEGORISED : raw;
    const arr = buckets.get(key) ?? [];
    arr.push(s);
    buckets.set(key, arr);
  }
  // Sort: named categories alphabetical, uncategorised always last.
  const named = Array.from(buckets.entries())
    .filter(([k]) => k !== UNCATEGORISED)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ label: k, items: v }));
  const uncat = buckets.get(UNCATEGORISED);
  if (uncat && uncat.length > 0) {
    (named as { label: string | null; items: HammerexXratedProduct[] }[]).push({
      label: null,
      items: uncat
    });
  }
  return named as { label: string | null; items: HammerexXratedProduct[] }[];
}

export async function ServicesPricedGrid({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const services = await loadAllServices(listing.id);
  if (services.length === 0) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-4 sm:px-6">
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
          <p className="text-sm text-neutral-600 sm:text-base">
            No priced services listed yet.
          </p>
        </div>
      </section>
    );
  }

  const anyCategorised = services.some(
    (s) => typeof s.category === "string" && s.category.trim().length > 0
  );
  const groups = anyCategorised
    ? groupByCategory(services)
    : [{ label: null, items: services }];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-col gap-10">
        {groups.map((g, i) => (
          <div key={(g.label ?? "all") + i}>
            {g.label && (
              <h3 className="mb-4 text-lg font-extrabold text-neutral-900 sm:text-xl">
                {g.label}
              </h3>
            )}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((s) => (
                <li key={s.id}>
                  <ServiceCard service={s} listing={listing} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
