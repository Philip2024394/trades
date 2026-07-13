"use client";

// Public marketplace grid — the eBay-style browse surface for /market.
//
// Client-side filters (kind, trade, price, search) so scrolling +
// filtering is instant with no server round-trips. Each card exposes
// two buy paths:
//   • Enquire on WhatsApp (opens wa.me/<seller>?text=…)
//   • Add to cart (per-seller localStorage cart via xratedCart lib)
//
// Cart is intentionally per-seller — each trade has their own Stripe
// account and delivery/pickup rules, so two lines from two different
// trades = two carts. Keeps checkout simple (pay each trade
// separately) and prevents accidental multi-merchant refund tangles.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  ShoppingCart,
  Search,
  X,
  Check,
  ExternalLink,
  Store
} from "lucide-react";
import { addItem, formatGbp } from "@/lib/xratedCart";

export type MarketRow = {
  productId: string;
  kind: "product" | "service";
  name: string;
  description: string | null;
  pricePence: number;
  coverUrl: string | null;
  category: string | null;
  unit: string | null;
  stockCount: number | null;
  sellerSlug: string;
  sellerName: string;
  sellerTrade: string;
  sellerTradeSlug: string;
  sellerCity: string | null;
  sellerWhatsapp: string;
  sellerTier: string | null;
};

type KindFilter = "all" | "product" | "service";
type PriceBand = "all" | "u25" | "25_100" | "100_500" | "500p";

const PRICE_BANDS: Array<{ id: PriceBand; label: string; range: [number, number] }> = [
  { id: "all", label: "Any price", range: [0, Number.MAX_SAFE_INTEGER] },
  { id: "u25", label: "Under £25", range: [0, 2500] },
  { id: "25_100", label: "£25–100", range: [2500, 10000] },
  { id: "100_500", label: "£100–500", range: [10000, 50000] },
  { id: "500p", label: "£500+", range: [50000, Number.MAX_SAFE_INTEGER] }
];

export function MarketplaceGrid({ rows }: { rows: MarketRow[] }) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [priceBand, setPriceBand] = useState<PriceBand>("all");
  const [trade, setTrade] = useState<string>("all");
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<Record<string, number>>({});

  const trades = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.sellerTradeSlug, r.sellerTrade);
    return Array.from(map.entries())
      .map(([slug, label]) => ({ slug, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filtered = useMemo(() => {
    const band = PRICE_BANDS.find((b) => b.id === priceBand)!;
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (trade !== "all" && r.sellerTradeSlug !== trade) return false;
      if (r.pricePence < band.range[0] || r.pricePence >= band.range[1])
        return false;
      if (needle) {
        const hay = `${r.name} ${r.description ?? ""} ${r.sellerName} ${r.sellerTrade} ${r.category ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, kind, priceBand, trade, q]);

  function handleAdd(row: MarketRow) {
    addItem(row.sellerSlug, {
      product_id: row.productId,
      name: row.name,
      price_pence: row.pricePence,
      cover_url: row.coverUrl,
      unit: row.unit
    });
    setAdded((prev) => ({
      ...prev,
      [row.productId]: (prev[row.productId] ?? 0) + 1
    }));
    // Broadcast so any open cart pill / cart page re-reads.
    window.dispatchEvent(new CustomEvent("xrated-cart-change"));
  }

  return (
    <>
      {/* Filter bar */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-[#1B1A17]/10 bg-[#FBF6EC]/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[#FBF6EC]/80 md:mx-0 md:rounded-2xl md:border md:px-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1B1A17]/40"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products, services, trades…"
              className="h-11 w-full rounded-full border border-[#1B1A17]/10 bg-white pl-10 pr-9 text-[13.5px] outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-300/40"
              aria-label="Search The Network"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#1B1A17]/40 hover:text-[#1B1A17]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>

          <select
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            aria-label="Filter by trade"
            className="h-11 rounded-full border border-[#1B1A17]/10 bg-white px-3 text-[12.5px] font-semibold text-[#1B1A17] outline-none focus:border-amber-500"
          >
            <option value="all">All trades</option>
            {trades.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={priceBand}
            onChange={(e) => setPriceBand(e.target.value as PriceBand)}
            aria-label="Filter by price"
            className="h-11 rounded-full border border-[#1B1A17]/10 bg-white px-3 text-[12.5px] font-semibold text-[#1B1A17] outline-none focus:border-amber-500"
          >
            {PRICE_BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Product kind">
          <KindTab active={kind === "all"} onClick={() => setKind("all")}>
            All
          </KindTab>
          <KindTab
            active={kind === "product"}
            onClick={() => setKind("product")}
          >
            Products
          </KindTab>
          <KindTab
            active={kind === "service"}
            onClick={() => setKind("service")}
          >
            Services
          </KindTab>
          <span className="ml-auto self-center text-[11px] font-black uppercase tracking-[0.14em] text-[#1B1A17]/50 tabular-nums">
            {filtered.length} of {rows.length}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[#1B1A17]/15 bg-white px-6 py-8 text-center text-[13px] text-[#1B1A17]/60">
          No matches. Try a wider price band or clear the trade filter.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((row) => (
            <li key={row.productId}>
              <ProductCard
                row={row}
                justAddedCount={added[row.productId] ?? 0}
                onAdd={() => handleAdd(row)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function KindTab({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-full px-3 text-[11.5px] font-black uppercase tracking-[0.14em] transition ${
        active
          ? "bg-[#0A0A0A] text-white"
          : "bg-white text-[#1B1A17]/60 hover:bg-[#1B1A17]/5"
      }`}
    >
      {children}
    </button>
  );
}

function ProductCard({
  row,
  justAddedCount,
  onAdd
}: {
  row: MarketRow;
  justAddedCount: number;
  onAdd: () => void;
}) {
  const waMessage = `Hi ${row.sellerName.split(/\s+/)[0]}, I'm interested in your "${row.name}" (£${(row.pricePence / 100).toFixed(2)}) — is it available?`;
  const waHref = row.sellerWhatsapp
    ? `https://wa.me/${row.sellerWhatsapp}?text=${encodeURIComponent(waMessage)}`
    : null;
  const priceLabel = formatGbp(row.pricePence);
  const isService = row.kind === "service";
  const outOfStock =
    !isService && typeof row.stockCount === "number" && row.stockCount <= 0;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#1B1A17]/10 bg-white shadow-sm transition hover:border-[#1B1A17]/25 hover:shadow-md">
      <Link
        href={`/${encodeURIComponent(row.sellerSlug)}/shop/${encodeURIComponent(row.productId)}`}
        className="relative block aspect-square w-full overflow-hidden bg-neutral-50"
        aria-label={`View ${row.name}`}
      >
        {row.coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={row.coverUrl}
            alt={row.name}
            className="h-full w-full object-contain p-3"
            loading="lazy"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-full w-full items-center justify-center text-4xl font-black text-[#1B1A17]/25"
          >
            {row.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white shadow"
          style={{ background: isService ? "#0F7A3D" : "#0A0A0A" }}
        >
          {isService ? "Service" : "Product"}
        </span>
        {outOfStock && (
          <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white shadow">
            Sold out
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 min-h-[36px] text-[13.5px] font-black leading-[1.25] text-[#1B1A17]">
          {row.name}
        </p>
        <Link
          href={`/${encodeURIComponent(row.sellerSlug)}/shop`}
          className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#1B1A17]/55 hover:text-amber-700"
        >
          <Store className="h-3 w-3" aria-hidden />
          {row.sellerName}
          {row.sellerCity && (
            <span className="text-[#1B1A17]/35"> · {row.sellerCity}</span>
          )}
        </Link>

        <p className="mt-2 flex items-baseline gap-1 text-[18px] font-black tracking-tight text-[#1B1A17] tabular-nums">
          {priceLabel}
          {row.unit && (
            <span className="text-[11px] font-semibold text-[#1B1A17]/55">
              {" "}
              / {row.unit}
            </span>
          )}
        </p>

        <div className="mt-3 flex flex-1 flex-col justify-end gap-1.5">
          <button
            type="button"
            onClick={onAdd}
            disabled={outOfStock}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-amber-400 px-3 text-[12.5px] font-black text-[#0A0A0A] shadow-sm transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {justAddedCount > 0 ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden />
                In cart ({justAddedCount})
              </>
            ) : (
              <>
                <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
                Add to cart
              </>
            )}
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-full border border-[#1B1A17]/15 bg-white px-2 text-[11.5px] font-black text-[#0F7A3D] hover:border-[#0F7A3D]"
              >
                <MessageCircle className="h-3 w-3" aria-hidden />
                WhatsApp
              </a>
            ) : (
              <span
                aria-hidden
                className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#1B1A17]/10 bg-white px-2 text-[11px] font-semibold text-[#1B1A17]/30"
              >
                No WhatsApp
              </span>
            )}
            <Link
              href={`/${encodeURIComponent(row.sellerSlug)}/shop`}
              className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-full border border-[#1B1A17]/15 bg-white px-2 text-[11.5px] font-black text-[#1B1A17]/80 hover:border-amber-400"
            >
              <ExternalLink className="h-3 w-3" aria-hidden />
              Shop
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
