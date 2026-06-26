"use client";

// Side-by-side compare modal. Opens from a ProductModal's "Compare"
// button. The anchor product (the one the customer opened) gets the
// yellow-bordered highlight so the eye always knows which column is
// "this one" vs "the alternatives".
//
// Sibling source:
//   – Phase 1: tradesperson hand-picked product.compare_with → passed in
//              as the `siblings` prop.
//   – Phase 2: if the prop list is empty we fall back to the auto-pick
//              endpoint /api/trade-off/products/siblings which scores
//              candidates by same-category + price proximity. Either
//              path empty + zero auto-picks → friendly empty state.

import { useEffect, useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";
import { addItem, formatGbp } from "@/lib/xratedCart";

// Light subset of HammerexXratedProduct returned by the siblings API.
// Kept narrow so the API can stay read-only (no need to fetch unused
// columns) and the column renderer only relies on what's present.
type AutoSibling = {
  id: string;
  name: string;
  cover_url: string | null;
  price_pence: number;
  dispatch_days: number | null;
  stock_count: number | null;
  category: string | null;
  unit: string | null;
};

type ColumnProduct = {
  id: string;
  name: string;
  cover_url: string | null;
  price_pence: number;
  dispatch_days: number | null;
  stock_count: number | null;
  description: string | null;
  unit: string | null;
};

function fromFullProduct(p: HammerexXratedProduct): ColumnProduct {
  return {
    id: p.id,
    name: p.name,
    cover_url: p.cover_url,
    price_pence: p.price_pence,
    dispatch_days: p.dispatch_days,
    stock_count: p.stock_count,
    description: p.description,
    unit: p.unit
  };
}

function fromAutoSibling(s: AutoSibling): ColumnProduct {
  return {
    id: s.id,
    name: s.name,
    cover_url: s.cover_url,
    price_pence: s.price_pence,
    dispatch_days: s.dispatch_days,
    stock_count: s.stock_count,
    description: null,
    unit: s.unit
  };
}

export function CompareProductsModal({
  anchor,
  siblings,
  slug,
  themeColor,
  onClose
}: {
  anchor: HammerexXratedProduct;
  siblings: HammerexXratedProduct[];
  slug: string;
  themeColor: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const hasManualSiblings = siblings.length > 0;
  const [autoSiblings, setAutoSiblings] = useState<AutoSibling[] | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);

  // Only fetch the auto-pick fallback when the tradesperson hasn't
  // hand-picked siblings — otherwise we'd waste a request on a list
  // we're not going to render.
  useEffect(() => {
    if (hasManualSiblings) {
      setAutoLoaded(true);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/trade-off/products/siblings?product_id=${encodeURIComponent(anchor.id)}&limit=3`,
          { method: "GET" }
        );
        const json = (await res.json()) as {
          ok: boolean;
          siblings?: AutoSibling[];
        };
        if (cancelled) return;
        setAutoSiblings(json.ok ? json.siblings ?? [] : []);
      } catch {
        if (!cancelled) setAutoSiblings([]);
      } finally {
        if (!cancelled) setAutoLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [anchor.id, hasManualSiblings]);

  const siblingColumns: ColumnProduct[] = hasManualSiblings
    ? siblings.map(fromFullProduct)
    : (autoSiblings ?? []).map(fromAutoSibling);

  const columns: Array<{ product: ColumnProduct; isAnchor: boolean }> = [
    { product: fromFullProduct(anchor), isAnchor: true },
    ...siblingColumns.map((p) => ({ product: p, isAnchor: false }))
  ];

  const noSiblingsToShow =
    !hasManualSiblings && autoLoaded && siblingColumns.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare products"
      className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/85 backdrop-blur sm:items-center sm:p-3"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl ring-4 ring-[#FFB300] sm:max-h-[95vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3 sm:px-5">
          <div>
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: "#FFB300" }}
            >
              Compare
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-neutral-900">
              {noSiblingsToShow
                ? "Just this product so far"
                : `${columns.length} products side by side`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close compare"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition hover:bg-black"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {!hasManualSiblings && !autoLoaded && (
            <p className="px-3 py-6 text-center text-[13px] text-neutral-500">
              Finding similar products…
            </p>
          )}
          {noSiblingsToShow && (
            <div className="mx-auto max-w-md px-3 py-6 text-center">
              <p className="text-[13px] font-bold text-neutral-700">
                No similar products to compare yet.
              </p>
              <p className="mt-1 text-[13px] text-neutral-500">
                Once this shop adds more, they&rsquo;ll appear here automatically.
              </p>
            </div>
          )}
          <div
            className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:gap-4 sm:overflow-visible"
            style={gridStyle(columns.length)}
          >
            {columns.map(({ product, isAnchor }) => (
              <CompareColumn
                key={product.id}
                product={product}
                isAnchor={isAnchor}
                slug={slug}
                themeColor={themeColor}
                onAdded={onClose}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function gridStyle(count: number): React.CSSProperties {
  // Mobile = horizontal scroll-snap; desktop overrides to a grid via
  // the sm: utility — gridTemplateColumns inline only matters at >=sm.
  return {
    gridTemplateColumns: `repeat(${Math.min(count, 3)}, minmax(0, 1fr))`
  };
}

function CompareColumn({
  product,
  isAnchor,
  slug,
  themeColor,
  onAdded
}: {
  product: ColumnProduct;
  isAnchor: boolean;
  slug: string;
  themeColor: string;
  onAdded: () => void;
}) {
  const outOfStock = product.stock_count !== null && product.stock_count <= 0;

  function handleAdd() {
    if (outOfStock) return;
    addItem(slug, {
      product_id: product.id,
      name: product.name,
      price_pence: product.price_pence,
      cover_url: product.cover_url,
      unit: product.unit ?? null
    });
    onAdded();
  }

  return (
    <div
      className={`flex w-[78%] shrink-0 flex-col gap-3 rounded-2xl border-2 bg-white p-3 sm:w-auto sm:p-4 ${
        isAnchor ? "shadow-md" : ""
      }`}
      style={{
        borderColor: isAnchor ? themeColor : "#E5E7EB"
      }}
    >
      {isAnchor && (
        <span
          className="self-start rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900"
          style={{ background: themeColor }}
        >
          You opened this
        </span>
      )}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100">
        {product.cover_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.cover_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[13px] text-neutral-400">
            No image
          </div>
        )}
      </div>
      <p className="line-clamp-2 text-[13px] font-extrabold leading-tight text-neutral-900 sm:text-sm">
        {product.name}
      </p>
      <p className="text-lg font-extrabold text-neutral-900">
        {formatGbp(product.price_pence)}
        {product.unit && (
          <span className="ml-1 text-[13px] font-bold text-neutral-500">
            {product.unit}
          </span>
        )}
      </p>
      <dl className="flex flex-col gap-1.5 text-[13px]">
        <Row label="Stock" value={stockLabel(product.stock_count)} />
        <Row
          label="Dispatch"
          value={
            typeof product.dispatch_days === "number" && product.dispatch_days > 0
              ? `${product.dispatch_days} ${product.dispatch_days === 1 ? "day" : "days"}`
              : "On enquiry"
          }
        />
        {product.description && (
          <div className="flex flex-col gap-1 pt-1">
            <dt className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
              Notes
            </dt>
            <dd className="line-clamp-4 text-[13px] leading-relaxed text-neutral-700">
              {product.description}
            </dd>
          </div>
        )}
      </dl>
      <button
        type="button"
        onClick={handleAdd}
        disabled={outOfStock}
        className="mt-auto inline-flex h-11 items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: outOfStock ? "#737373" : "#0F7A3F",
          boxShadow: outOfStock ? undefined : "0 6px 18px rgba(15,122,63,0.4)"
        }}
      >
        {outOfStock ? "Out of stock" : "Add to enquiry"}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-t border-neutral-100 pt-1.5">
      <dt className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
        {label}
      </dt>
      <dd className="text-right text-[13px] font-bold text-neutral-900">
        {value}
      </dd>
    </div>
  );
}

function stockLabel(stock: number | null): string {
  if (stock === null) return "On enquiry";
  if (stock <= 0) return "Out of stock";
  if (stock <= 5) return `${stock} left`;
  return "In stock";
}
