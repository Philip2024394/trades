// TradePairsWith — trades-themed port of Hammerex's PairsWith.
//
// Hammerex's version pulled join-shaped rows from `hammerex_pair_with`
// where the accessory is another Hammerex product. Trades work the
// same shape but stay within a single trade's catalogue: each row of
// `hammerex_xrated_pair_with` points from an anchor product on this
// trade's shop to another product on the SAME trade's shop.
//
// The caller (PDP server component) resolves the accessory rows +
// their listing slug into `TradePairsWithRow[]` — a small shape that
// carries only what this component needs to render. Keeps the client
// bundle small (no `HammerexXratedProduct` type footprint).

import Link from "next/link";
import { formatGbp } from "@/lib/xratedCart";

export type TradePairsWithRow = {
  id: string;
  reason: string | null;
  accessory: {
    id: string;
    name: string;
    slug: string | null;
    coverUrl: string | null;
    pricePence: number;
  };
  /** Slug of the trade whose shop the accessory lives on — same trade
   *  as the anchor product, but the caller resolves it explicitly so
   *  this component doesn't need to touch the listing type. */
  sellerSlug: string;
};

export function TradePairsWith({ pairs }: { pairs: TradePairsWithRow[] }) {
  if (pairs.length === 0) return null;
  return (
    <section
      id="pairs-with"
      className="border-t border-[#1B1A17]/10 bg-[#FBF6EC] py-10"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <h2 className="mb-1 text-[18px] font-black text-[#1B1A17] md:text-[22px]">
          Pairs well with
        </h2>
        <p className="mb-6 text-[12.5px] text-[#1B1A17]/60">
          Curated picks from the same trade that make this better. Tap to
          open the product page.
        </p>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {pairs.map((p) => {
            const href = p.accessory.slug
              ? `/${encodeURIComponent(p.sellerSlug)}/shop/${encodeURIComponent(p.accessory.slug)}`
              : `/${encodeURIComponent(p.sellerSlug)}/shop/${encodeURIComponent(p.accessory.id)}`;
            return (
              <li
                key={p.id}
                className="overflow-hidden rounded-2xl border border-[#1B1A17]/10 bg-white shadow-sm transition hover:border-amber-400 hover:shadow-md"
              >
                <Link
                  href={href}
                  className="block h-40 w-full overflow-hidden bg-neutral-50"
                >
                  {p.accessory.coverUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.accessory.coverUrl}
                      alt={p.accessory.name}
                      className="h-full w-full object-contain p-3 transition-transform hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="grid h-full w-full place-items-center text-4xl font-black text-[#1B1A17]/25"
                    >
                      {p.accessory.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="flex flex-col gap-2 p-4">
                  <Link
                    href={href}
                    className="text-[13.5px] font-black text-[#1B1A17] hover:text-amber-700"
                  >
                    {p.accessory.name}
                  </Link>
                  {p.reason && (
                    <p className="text-[12px] leading-[1.45] text-[#1B1A17]/65">
                      {p.reason}
                    </p>
                  )}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[15px] font-black tracking-tight text-[#1B1A17] tabular-nums">
                      {formatGbp(p.accessory.pricePence)}
                    </span>
                    <Link
                      href={href}
                      className="inline-flex h-9 items-center gap-1 rounded-full bg-amber-400 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#0A0A0A] shadow-sm hover:bg-amber-300"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
