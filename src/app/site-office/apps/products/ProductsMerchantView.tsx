// Merchant offer manager — list + search-to-add + inline edit.

"use client";

import { useMemo, useState } from "react";
import {
  Package,
  Search,
  Loader2,
  Plus,
  ImageOff,
  AlertTriangle
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";

type OfferRow = {
  id: string;
  pricePence: number;
  rrpPence: number | null;
  stockStatus: string;
  stockQuantity: number | null;
  merchantSku: string | null;
  isActive: boolean;
  localImageCount: number;
  canonical: {
    id: string;
    brandName: string;
    name: string;
    heroImageUrl: string | null;
    categoryPath: string[];
    msrpPence: number | null;
  };
};

type CanonicalResult = {
  id: string;
  brandName: string;
  name: string;
  heroImageUrl: string | null;
  msrpPence: number | null;
  categoryPath: string[];
};

function gbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export function ProductsMerchantView({
  initialOffers
}: {
  initialOffers: OfferRow[];
}) {
  const [offers, setOffers] = useState<OfferRow[]>(initialOffers);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter.trim()) return offers;
    const q = filter.trim().toLowerCase();
    return offers.filter(
      (o) =>
        o.canonical.name.toLowerCase().includes(q) ||
        o.canonical.brandName.toLowerCase().includes(q) ||
        (o.merchantSku || "").toLowerCase().includes(q)
    );
  }, [offers, filter]);

  return (
    <>
      <SurfaceCard variant="primary" padding="md" className="mb-4">
        <AddOfferPanel
          onCreated={(row) => setOffers((v) => [row, ...v])}
        />
      </SurfaceCard>

      <div className="mb-3 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3">
        <Search className="h-4 w-4 text-neutral-500" aria-hidden />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter your offers"
          className="min-h-[40px] flex-1 border-0 bg-transparent p-0 text-[14px] outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <SurfaceCard variant="secondary" padding="md">
          <div className="text-[13px] font-semibold text-neutral-600">
            No offers yet.
          </div>
          <p className="mt-1 text-[13px] text-neutral-500">
            Search for a canonical product above and add it with your
            price + stock.
          </p>
        </SurfaceCard>
      ) : (
        <div className="space-y-2">
          {filtered.map((offer) => (
            <OfferRowCard
              key={offer.id}
              offer={offer}
              onUpdate={(next) =>
                setOffers((v) =>
                  v.map((o) => (o.id === next.id ? next : o))
                )
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

function AddOfferPanel({
  onCreated
}: {
  onCreated: (row: OfferRow) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CanonicalResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CanonicalResult | null>(null);
  const [pricePence, setPricePence] = useState("");
  const [stockStatus, setStockStatus] = useState<
    "in_stock" | "low" | "out" | "preorder" | "discontinued"
  >("in_stock");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    if (q.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/apps/products/search?q=${encodeURIComponent(q)}`
      );
      const data: { ok: boolean; results?: CanonicalResult[] } = await res.json();
      if (data.ok && data.results) setResults(data.results);
    } finally {
      setSearching(false);
    }
  }

  async function create() {
    if (!selected) return;
    const pence = Math.round(parseFloat(pricePence) * 100);
    if (!Number.isFinite(pence) || pence < 0) {
      setError("Enter a valid price.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/apps/products/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          canonicalProductId: selected.id,
          pricePence: pence,
          stockStatus
        })
      });
      const data: {
        ok: boolean;
        offer?: {
          id: string;
          pricePence: number;
          rrpPence: number | null;
          stockStatus: string;
          stockQuantity: number | null;
          merchantSku: string | null;
          isActive: boolean;
          localImageUrls: string[];
        };
        error?: string;
      } = await res.json();
      if (!data.ok || !data.offer) {
        setError(data.error || "Could not save offer.");
        return;
      }
      onCreated({
        id: data.offer.id,
        pricePence: data.offer.pricePence,
        rrpPence: data.offer.rrpPence,
        stockStatus: data.offer.stockStatus,
        stockQuantity: data.offer.stockQuantity,
        merchantSku: data.offer.merchantSku,
        isActive: data.offer.isActive,
        localImageCount: 0,
        canonical: {
          id: selected.id,
          brandName: selected.brandName,
          name: selected.name,
          heroImageUrl: selected.heroImageUrl,
          categoryPath: selected.categoryPath,
          msrpPence: selected.msrpPence
        }
      });
      setSelected(null);
      setPricePence("");
      setQ("");
      setResults([]);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Add offer
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runSearch();
          }}
          placeholder="Search brand + product name"
          className="min-h-[40px] flex-1 rounded-lg border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-neutral-900"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={searching}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {searching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Search className="h-3.5 w-3.5" aria-hidden />
          )}
          Search
        </button>
      </div>

      {results.length > 0 && !selected ? (
        <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="flex w-full items-center gap-3 p-2 text-left hover:bg-neutral-50"
              >
                {r.heroImageUrl ? (
                  <img
                    src={r.heroImageUrl}
                    alt=""
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-neutral-100">
                    <Package className="h-4 w-4 text-neutral-400" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-neutral-900">
                    {r.brandName} · {r.name}
                  </div>
                  <div className="text-[13px] text-neutral-500">
                    {r.categoryPath.join(" · ")}
                  </div>
                </div>
                {r.msrpPence != null ? (
                  <div className="text-[13px] text-neutral-500">
                    MSRP {gbp(r.msrpPence)}
                  </div>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3">
          <div className="text-[13px] text-neutral-500">Adding:</div>
          <div className="text-[14px] font-semibold text-neutral-900">
            {selected.brandName} · {selected.name}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-[13px]">
              <span className="block font-semibold text-neutral-700">
                Your price (£)
              </span>
              <input
                value={pricePence}
                onChange={(e) => setPricePence(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="mt-1 block min-h-[36px] w-full rounded border border-neutral-200 bg-white px-2 text-right"
              />
            </label>
            <label className="text-[13px]">
              <span className="block font-semibold text-neutral-700">Stock</span>
              <select
                value={stockStatus}
                onChange={(e) =>
                  setStockStatus(e.target.value as typeof stockStatus)
                }
                className="mt-1 block min-h-[36px] w-full rounded border border-neutral-200 bg-white px-2"
              >
                <option value="in_stock">In stock</option>
                <option value="low">Low</option>
                <option value="out">Out</option>
                <option value="preorder">Pre-order</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </label>
          </div>
          {error ? (
            <p className="mt-2 text-[13px] text-red-600">{error}</p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              Save offer
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="min-h-[36px] rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:border-neutral-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function OfferRowCard({
  offer,
  onUpdate
}: {
  offer: OfferRow;
  onUpdate: (next: OfferRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [priceInput, setPriceInput] = useState((offer.pricePence / 100).toFixed(2));
  const [stockStatus, setStockStatus] = useState(offer.stockStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function savePrice() {
    const pence = Math.round(parseFloat(priceInput) * 100);
    if (!Number.isFinite(pence) || pence < 0) {
      setError("Enter a valid price.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/apps/products/offers/${offer.id}/price`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pricePence: pence })
        }
      );
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Save failed.");
        return;
      }
      onUpdate({ ...offer, pricePence: pence });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function saveStock(next: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/apps/products/offers/${offer.id}/stock`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stockStatus: next })
        }
      );
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Save failed.");
        return;
      }
      setStockStatus(next);
      onUpdate({ ...offer, stockStatus: next });
    } finally {
      setBusy(false);
    }
  }

  const isProblematic =
    stockStatus === "out" || offer.localImageCount === 0;

  return (
    <SurfaceCard
      variant={isProblematic ? "warning" : "primary"}
      padding="md"
    >
      <div className="flex items-center gap-3">
        {offer.canonical.heroImageUrl ? (
          <img
            src={offer.canonical.heroImageUrl}
            alt=""
            className="h-12 w-12 rounded object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded bg-neutral-100">
            <Package className="h-5 w-5 text-neutral-400" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-neutral-900">
            {offer.canonical.brandName} · {offer.canonical.name}
          </div>
          <div className="text-[13px] text-neutral-500">
            {offer.canonical.categoryPath.join(" · ")}
          </div>
          {offer.localImageCount === 0 ? (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[13px] font-semibold text-amber-800">
              <ImageOff className="h-3 w-3" aria-hidden />
              Manufacturer image only
            </div>
          ) : null}
        </div>
        <div className="text-right">
          {editing ? (
            <div className="flex items-center gap-1">
              <span className="text-[13px]">£</span>
              <input
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                inputMode="decimal"
                className="min-h-[36px] w-24 rounded border border-neutral-200 bg-white px-2 text-right text-[14px]"
              />
              <button
                type="button"
                onClick={savePrice}
                disabled={busy}
                className="inline-flex min-h-[36px] items-center rounded bg-neutral-900 px-2 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  "Save"
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[16px] font-bold text-neutral-900 hover:underline"
            >
              {gbp(offer.pricePence)}
            </button>
          )}
        </div>
        <div>
          <select
            value={stockStatus}
            onChange={(e) => saveStock(e.target.value)}
            disabled={busy}
            className="min-h-[36px] rounded border border-neutral-200 bg-white px-2 text-[13px]"
          >
            <option value="in_stock">In stock</option>
            <option value="low">Low</option>
            <option value="out">Out</option>
            <option value="preorder">Pre-order</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-[13px] text-red-600">{error}</p>
      ) : null}
      {stockStatus === "out" ? (
        <div className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-red-800">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Appears in AI Visualiser renders as "currently unavailable"
        </div>
      ) : null}
    </SurfaceCard>
  );
}
