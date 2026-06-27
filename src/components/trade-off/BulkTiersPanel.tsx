"use client";

// BulkTiersPanel — per-product bulk-pricing tier editor.
//
// Each product row is a collapsible card. Tiers list shape:
//   [{ min_qty, max_qty?, price_pence }, …]
// Last tier may omit max_qty ("50+ each"). Save POSTs the entire
// product row to /api/trade-off/products/upsert with the bulk_tiers
// patch — same endpoint Shop Mode uses, so the API double-checks.

import { useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";

type TierRow = {
  key: string;
  min_qty: string;
  max_qty: string; // empty = "and above"
  price_pounds: string;
};

let _keyCounter = 0;
function nextRowKey(): string {
  _keyCounter += 1;
  return `t-${Date.now().toString(36)}-${_keyCounter}`;
}

function poundsToPence(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function penceToPounds(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "0.00";
  return (p / 100).toFixed(2);
}

function tiersToRows(p: HammerexXratedProduct): TierRow[] {
  const arr = Array.isArray(p.bulk_tiers) ? p.bulk_tiers : [];
  return arr.map((t) => ({
    key: nextRowKey(),
    min_qty: String(t.min_qty ?? 1),
    max_qty: t.max_qty === null || t.max_qty === undefined ? "" : String(t.max_qty),
    price_pounds: penceToPounds(t.price_pence ?? 0)
  }));
}

export function BulkTiersPanel({
  slug,
  editToken,
  initialProducts
}: {
  slug: string;
  editToken: string;
  initialProducts: HammerexXratedProduct[];
}) {
  const [products, setProducts] = useState<HammerexXratedProduct[]>(initialProducts);
  const liveCount = products.filter((p) => p.status === "live").length;

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
      <div>
        <h2 className="text-lg font-extrabold">Bulk pricing tiers</h2>
        <p className="mt-1 text-xs text-brand-muted">
          Set quantity bands per product — e.g. 10 sheets £8 each, 50
          sheets £6 each. {liveCount} live product{liveCount === 1 ? "" : "s"}.
        </p>
      </div>

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-brand-line bg-brand-bg px-4 py-6 text-center text-xs text-brand-muted">
          Add products in Shop Mode first, then come back to set bulk
          tiers.
        </p>
      ) : (
        <ul className="space-y-2">
          {products.map((p) => (
            <BulkTierRow
              key={p.id}
              product={p}
              slug={slug}
              editToken={editToken}
              onSaved={(saved) => {
                setProducts((prev) =>
                  prev.map((x) => (x.id === saved.id ? saved : x))
                );
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BulkTierRow({
  product,
  slug,
  editToken,
  onSaved
}: {
  product: HammerexXratedProduct;
  slug: string;
  editToken: string;
  onSaved: (saved: HammerexXratedProduct) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tiers, setTiers] = useState<TierRow[]>(tiersToRows(product));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function addTier() {
    setTiers((rows) => [
      ...rows,
      { key: nextRowKey(), min_qty: "", max_qty: "", price_pounds: "" }
    ]);
  }
  function removeTier(key: string) {
    setTiers((rows) => rows.filter((r) => r.key !== key));
  }
  function patchTier(key: string, patch: Partial<TierRow>) {
    setTiers((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function save() {
    setErr(null);
    setMsg(null);

    // Build the bulk_tiers payload.
    const built: { min_qty: number; max_qty: number | null; price_pence: number }[] = [];
    if (tiers.length > 5) {
      setErr("Up to 5 bulk tiers per product.");
      return;
    }
    let prev = 0;
    for (let i = 0; i < tiers.length; i++) {
      const r = tiers[i];
      const minQ = Number(r.min_qty);
      if (!Number.isFinite(minQ) || minQ < 1) {
        setErr("Each tier needs a positive min qty.");
        return;
      }
      const minR = Math.round(minQ);
      const maxRaw = r.max_qty.trim();
      let maxR: number | null = null;
      if (maxRaw.length > 0) {
        const maxN = Number(maxRaw);
        if (!Number.isFinite(maxN) || maxN < minR) {
          setErr("Tier max qty must be ≥ min qty.");
          return;
        }
        maxR = Math.round(maxN);
      } else if (i !== tiers.length - 1) {
        setErr("Only the top tier may have a blank max qty.");
        return;
      }
      if (i > 0 && minR <= prev) {
        setErr("Tiers must ascend without overlap.");
        return;
      }
      const pricePence = poundsToPence(r.price_pounds);
      if (pricePence < 1) {
        setErr("Each tier needs a price (in £).");
        return;
      }
      built.push({ min_qty: minR, max_qty: maxR, price_pence: pricePence });
      prev = maxR ?? minR;
    }

    setSubmitting(true);
    try {
      // We re-send the whole product row (the API requires name +
      // price_pence to pass its validation). All other fields stay as
      // they were — the patch object on the server replaces the row,
      // so we mirror existing values verbatim.
      const productPayload = {
        id: product.id,
        kind: product.kind ?? "product",
        name: product.name,
        description: product.description ?? "",
        price_pence: product.price_pence,
        stock_count: product.stock_count ?? null,
        dispatch_days: product.dispatch_days ?? null,
        cover_url: product.cover_url ?? "",
        gallery_urls: product.gallery_urls ?? [],
        compare_with: product.compare_with ?? [],
        status: product.status,
        sort_order: product.sort_order ?? 0,
        unit: product.unit ?? null,
        category: product.category ?? null,
        variants: product.variants ?? [],
        size_chart_url: product.size_chart_url ?? "",
        size_chart_unit: product.size_chart_unit ?? null,
        bulk_tiers: built
      };
      const res = await fetch("/api/trade-off/products/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, product: productPayload })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Save failed.");
        return;
      }
      onSaved(json.product as HammerexXratedProduct);
      setMsg("Tiers saved.");
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="rounded-lg border border-brand-line bg-brand-bg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-md px-3 text-left transition hover:text-brand-accent"
        aria-expanded={open}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-brand-line bg-brand-surface">
            {product.cover_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={product.cover_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] uppercase tracking-widest text-brand-muted">—</span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-brand-text">
              {product.name}
            </span>
            <span className="block text-[13px] text-brand-muted">
              {tiers.length === 0
                ? "No bulk tiers yet"
                : `${tiers.length} tier${tiers.length === 1 ? "" : "s"}`}
            </span>
          </span>
        </span>
        <span className="text-brand-muted">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-brand-line p-3">
          {err && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
              {err}
            </p>
          )}
          {msg && (
            <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-xs font-semibold text-brand-accent">
              {msg}
            </p>
          )}
          {tiers.length === 0 ? (
            <p className="text-[13px] text-brand-muted">
              No tiers yet. Add the first row to start tier pricing.
            </p>
          ) : (
            <ul className="space-y-2">
              {tiers.map((row, idx) => (
                <li
                  key={row.key}
                  className="rounded-md border border-brand-line bg-brand-surface p-3"
                >
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                    Tier {idx + 1}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        Min qty
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={row.min_qty}
                        onChange={(e) => patchTier(row.key, { min_qty: e.target.value })}
                        className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        Max qty (blank = and above)
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={row.max_qty}
                        onChange={(e) => patchTier(row.key, { max_qty: e.target.value })}
                        placeholder={idx === tiers.length - 1 ? "and above" : ""}
                        className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        Each (£)
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        value={row.price_pounds}
                        onChange={(e) => patchTier(row.key, { price_pounds: e.target.value })}
                        className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeTier(row.key)}
                      className="inline-flex h-9 items-center rounded-md border border-red-500/40 bg-red-500/5 px-3 text-[13px] font-bold text-red-300 transition hover:bg-red-500/15"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addTier}
              disabled={tiers.length >= 5}
              className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Add tier
            </button>
            <button
              type="button"
              onClick={save}
              disabled={submitting}
              className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save tiers"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
