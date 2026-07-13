"use client";

// Merchant live-prices editor. Row list + a compact form for
// publish/update. Each row shows its own "Remove" (soft-delete).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

export type PriceRow = {
  id: string;
  itemSlug: string;
  itemLabel: string;
  unitLabel: string;
  pricePence: number;
  currency: "GBP" | "USD" | "EUR";
  qtyIncluded: number;
  postcodePrefix: string | null;
  region: string | null;
  isLive: boolean;
  updatedAt: string;
  expiresAt: string;
};

const CUR_SYM: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

function fmtPrice(pence: number, currency: string, qty: number): string {
  const sym = CUR_SYM[currency] ?? "£";
  const amt = pence / 100;
  const base = `${sym}${amt.toLocaleString("en-GB", {
    minimumFractionDigits: amt % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
  return qty > 1 ? `${base} / ${qty}` : base;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function PricesForm({
  slug,
  editToken,
  defaultPostcodePrefix,
  defaultRegion,
  initialRows
}: {
  slug: string;
  editToken: string;
  defaultPostcodePrefix: string;
  defaultRegion: string;
  initialRows: PriceRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<PriceRow[]>(initialRows);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New/edit form state.
  const [itemLabel, setItemLabel] = useState("");
  const [unitLabel, setUnitLabel] = useState("each");
  const [priceStr, setPriceStr] = useState("");
  const [qty, setQty] = useState(1);
  const [currency, setCurrency] = useState<"GBP" | "USD" | "EUR">("GBP");
  const [postcodePrefix, setPostcodePrefix] = useState(defaultPostcodePrefix);
  const [region, setRegion] = useState(defaultRegion);
  const [notes, setNotes] = useState("");

  async function publish() {
    if (busy) return;
    const price = Number.parseFloat(priceStr);
    if (!itemLabel.trim() || !Number.isFinite(price) || price < 0) {
      setError("Enter an item name and a valid price.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/prices/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          item_label: itemLabel.trim(),
          item_slug: itemLabel.trim(),
          unit_label: unitLabel.trim() || "each",
          price_pounds: price,
          qty_included: qty,
          currency,
          postcode_prefix: postcodePrefix.trim() || undefined,
          region: region.trim() || undefined,
          notes: notes.trim() || undefined
        })
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError("Publish failed — try again.");
        return;
      }
      setItemLabel("");
      setPriceStr("");
      setQty(1);
      setNotes("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(itemSlug: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/prices/publish", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          item_slug: itemSlug
        })
      });
      const data = (await res.json()) as { ok: boolean };
      if (!res.ok || !data.ok) {
        setError("Remove failed — try again.");
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.itemSlug === itemSlug ? { ...r, isLive: false } : r
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Publish form */}
      <section className="rounded-2xl border border-[#1B1A17]/10 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.18em] text-amber-700">
          <Plus className="h-4 w-4" aria-hidden />
          Publish a price
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55">
              Item
            </span>
            <input
              value={itemLabel}
              onChange={(e) => setItemLabel(e.target.value)}
              placeholder="e.g. 6-inch angle iron"
              maxLength={140}
              className="mt-1 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2 text-[13px] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55">
              Unit
            </span>
            <input
              value={unitLabel}
              onChange={(e) => setUnitLabel(e.target.value)}
              placeholder="each, m, bag, pallet…"
              maxLength={40}
              className="mt-1 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2 text-[13px] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </label>
          <div className="grid grid-cols-[1fr,110px,90px] gap-2 sm:col-span-2">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55">
                Price
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="4.20"
                className="mt-1 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2 text-[13px] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55">
                Qty
              </span>
              <input
                type="number"
                step="1"
                min="1"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2 text-[13px] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55">
                Cur
              </span>
              <select
                value={currency}
                onChange={(e) =>
                  setCurrency(e.target.value as "GBP" | "USD" | "EUR")
                }
                className="mt-1 w-full appearance-none rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2 text-[13px] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              >
                <option value="GBP" className="text-black">
                  £
                </option>
                <option value="USD" className="text-black">
                  $
                </option>
                <option value="EUR" className="text-black">
                  €
                </option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55">
              Postcode prefix
            </span>
            <input
              value={postcodePrefix}
              onChange={(e) =>
                setPostcodePrefix(e.target.value.toUpperCase())
              }
              placeholder="M3"
              maxLength={6}
              className="mt-1 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2 text-[13px] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55">
              Region
            </span>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Manchester"
              maxLength={120}
              className="mt-1 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2 text-[13px] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B1A17]/55">
              Notes (optional)
            </span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Collection only · Trade card discount"
              maxLength={400}
              className="mt-1 w-full rounded-xl border border-[#1B1A17]/12 bg-white px-3 py-2 text-[13px] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={publish}
            disabled={busy}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-5 text-[13px] font-black text-neutral-900 shadow-sm disabled:opacity-60"
            style={{ background: "#FFB300" }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            Publish price
          </button>
          {error && (
            <span className="text-[12px] font-semibold text-red-700">
              {error}
            </span>
          )}
        </div>
      </section>

      {/* Existing rows */}
      <section>
        <div className="mb-3 text-[13px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
          Your live prices
        </div>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#1B1A17]/15 bg-white p-4 text-[13px] text-[#1B1A17]/60">
            You haven&apos;t published any prices yet. Add one above to
            appear in trade searches and beacon hints.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className={`rounded-xl border bg-white p-3 shadow-sm ${
                  r.isLive
                    ? "border-[#1B1A17]/10"
                    : "border-[#1B1A17]/8 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-black text-[#1B1A17]">
                      {r.itemLabel}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#1B1A17]/55">
                      {fmtPrice(r.pricePence, r.currency, r.qtyIncluded)} /{" "}
                      {r.unitLabel}
                      {r.postcodePrefix ? ` · ${r.postcodePrefix}` : ""}
                      {r.region ? ` · ${r.region}` : ""}
                      {" · "}
                      updated {timeAgo(r.updatedAt)}
                    </p>
                  </div>
                  {r.isLive ? (
                    <button
                      type="button"
                      onClick={() => remove(r.itemSlug)}
                      disabled={busy}
                      aria-label={`Remove ${r.itemLabel}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                      Hidden
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
