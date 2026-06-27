// Public profile — Materials Network inline teaser.
//
// Server component. Mirrors the visual rhythm of DownloadsSection &
// RecommendedTrades: yellow eyebrow, h2, max-3 merchant tile grid, View
// all link to /<slug>/materials. Self-renders nothing when the listing
// has zero live picks. Soft disclosure copy lives ONLY on the dedicated
// /materials page (the inline teaser stays compact).

import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";

const PREVIEW_LIMIT = 3;

type MerchantPickCard = {
  id: string;
  intro_note: string | null;
  sort_order: number;
  merchant: {
    slug: string;
    display_name: string;
    primary_trade: string;
    city: string;
    avatar_url: string | null;
  };
};

async function loadPicks(listingId: string): Promise<MerchantPickCard[]> {
  const picksRes = await supabase
    .from("hammerex_xrated_merchant_picks")
    .select("id, intro_note, sort_order, merchant_listing_id")
    .eq("tradie_listing_id", listingId)
    .eq("status", "live")
    .order("sort_order", { ascending: true })
    .limit(PREVIEW_LIMIT);

  const picks = picksRes.data ?? [];
  if (picks.length === 0) return [];

  const mRes = await supabase
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, primary_trade, city, avatar_url")
    .in(
      "id",
      picks.map((p) => p.merchant_listing_id)
    )
    .eq("status", "live");

  const byId = new Map((mRes.data ?? []).map((r) => [r.id, r]));
  return picks
    .map((p) => {
      const m = byId.get(p.merchant_listing_id);
      if (!m) return null;
      return {
        id: p.id,
        intro_note: p.intro_note,
        sort_order: p.sort_order,
        merchant: {
          slug: m.slug,
          display_name: m.display_name,
          primary_trade: m.primary_trade,
          city: m.city,
          avatar_url: m.avatar_url
        }
      } satisfies MerchantPickCard;
    })
    .filter((p): p is MerchantPickCard => p !== null);
}

export async function MaterialsNetworkSection({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const picks = await loadPicks(listing.id);
  if (picks.length === 0) return null;

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
            Trade Materials &amp; Companies
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            Where {firstName} buys
          </h2>
          <p className="mt-1 text-[13px] text-neutral-500 sm:text-sm">
            Builder&rsquo;s merchants and suppliers {firstName} actually works with.
          </p>
        </div>
        <a
          href={`/${listing.slug}/materials`}
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:inline-flex sm:h-10"
        >
          View all
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((p) => {
          const initials = p.merchant.display_name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase() ?? "")
            .join("");
          return (
            <li key={p.id}>
              <a
                href={`/${listing.slug}/materials/${p.merchant.slug}`}
                className="group flex h-full items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-[#FFB300] hover:shadow-md"
              >
                <span
                  className="block h-14 w-14 shrink-0 overflow-hidden rounded-full bg-neutral-200 ring-2 ring-white shadow-sm"
                  style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                >
                  {p.merchant.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.merchant.avatar_url}
                      alt={p.merchant.display_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-black text-base font-extrabold text-[#FFB300]">
                      {initials || "M"}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <span
                    className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900 sm:text-[11px]"
                    style={{ background: "#FFB300" }}
                  >
                    Merchant
                  </span>
                  <p className="mt-1.5 truncate text-sm font-extrabold text-neutral-900 sm:text-base">
                    {p.merchant.display_name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500 sm:text-sm">
                    {p.merchant.city}
                  </p>
                  {p.intro_note && (
                    <p className="mt-2 line-clamp-3 text-xs italic leading-relaxed text-neutral-600 sm:text-[13px]">
                      &ldquo;{p.intro_note}&rdquo;
                    </p>
                  )}
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 transition group-hover:text-[#FFB300] sm:text-xs">
                    Browse merchant
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition group-hover:translate-x-0.5">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </p>
                </div>
              </a>
            </li>
          );
        })}
      </ul>

      <a
        href={`/${listing.slug}/materials`}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:hidden"
      >
        View all materials
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </a>
    </section>
  );
}
