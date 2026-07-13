"use client";

// QuickPricesForm — editable list of the trade's starter template.
// Each row has an editable price + a "keep / skip" toggle. On save,
// we POST the kept rows to /api/trade-off/products/quick-prices as a
// bulk insert. On success, the trade is bounced back to their
// dashboard with a note about how many services were added.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Loader2,
  AlertTriangle,
  Check,
  X
} from "lucide-react";
import type { QuickPriceTemplate } from "@/lib/quickPriceTemplates";
import { serviceCategoryLabel } from "@/lib/serviceCategories";

type Row = {
  key: string;
  keep: boolean;
  label: string;
  pricePounds: string;
  unit: string;
  serviceCategory: string;
  description: string;
};

function toRow(t: QuickPriceTemplate, i: number): Row {
  return {
    key: `qp_${i}_${t.serviceCategory}`,
    keep: true,
    label: t.label,
    pricePounds: (t.suggestedPricePence / 100).toFixed(2),
    unit: t.unit,
    serviceCategory: t.serviceCategory,
    description: t.description
  };
}

export function QuickPricesForm({
  slug,
  editToken,
  template
}: {
  slug: string;
  editToken: string;
  template: QuickPriceTemplate[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => template.map(toRow));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keptCount = rows.filter((r) => r.keep).length;

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);
    setError(null);

    const items = rows
      .filter((r) => r.keep && r.label.trim().length > 0)
      .map((r) => {
        const pounds = parseFloat(r.pricePounds);
        const price = Number.isFinite(pounds) && pounds > 0
          ? Math.round(pounds * 100)
          : NaN;
        return {
          label: r.label.trim(),
          price_pence: price,
          unit: r.unit.trim(),
          service_category: r.serviceCategory,
          description: r.description.trim()
        };
      })
      .filter((it) => Number.isFinite(it.price_pence));

    if (items.length === 0) {
      setError("Keep at least one row with a valid price.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/trade-off/products/quick-prices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          items
        })
      });
      const json = (await res.json()) as
        | { ok: true; inserted: number }
        | { ok: false; error: string };
      if (!json.ok) {
        setError(
          json.error === "unauthorised"
            ? "Sign-in expired. Sign in from your dashboard and try again."
            : json.error === "listing_not_live"
              ? "Your listing must be live before adding services."
              : "Couldn't save your prices. Try again."
        );
        return;
      }
      // Bounce back to the dashboard with a success flag.
      router.push(
        `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(editToken)}&quick_prices_added=${json.inserted}`
      );
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-800"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <ol className="space-y-2">
        {rows.map((r) => {
          const catLabel =
            serviceCategoryLabel(r.serviceCategory) ?? r.serviceCategory;
          return (
            <li
              key={r.key}
              className={`rounded-2xl border p-4 shadow-sm transition ${
                r.keep
                  ? "border-[#1B1A17]/10 bg-white"
                  : "border-dashed border-[#1B1A17]/15 bg-white/60 opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <button
                  type="button"
                  onClick={() => updateRow(r.key, { keep: !r.keep })}
                  aria-pressed={r.keep}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                    r.keep
                      ? "bg-amber-400 text-[#0A0A0A]"
                      : "border border-[#1B1A17]/15 bg-white text-[#1B1A17]/40 hover:border-[#1B1A17]/40"
                  }`}
                  title={r.keep ? "Keep this row" : "Bin this row"}
                >
                  {r.keep ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <X className="h-4 w-4" aria-hidden />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={r.label}
                    onChange={(e) => updateRow(r.key, { label: e.target.value.slice(0, 80) })}
                    className="block w-full rounded-md border border-transparent bg-transparent px-1 text-[14px] font-black text-[#1B1A17] outline-none focus:border-amber-500 focus:bg-white"
                  />
                  <p className="mt-0.5 text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">
                    {catLabel}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-[1.45] text-[#1B1A17]/60">
                    {r.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-[15px] font-black text-[#1B1A17]/60">£</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={r.pricePounds}
                    onChange={(e) => updateRow(r.key, { pricePounds: e.target.value })}
                    className="block h-10 w-24 rounded-md border border-[#1B1A17]/15 bg-white px-2 text-right text-[14px] font-black text-[#1B1A17] tabular-nums outline-none focus:border-amber-500"
                  />
                  <span className="text-[11px] font-semibold text-[#1B1A17]/50">
                    / {r.unit}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-[12px] font-semibold text-[#1B1A17]/60">
          Saving <b className="text-[#1B1A17]">{keptCount}</b> service{keptCount === 1 ? "" : "s"}. Every kept row will appear on matching product PDPs.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving || keptCount === 0}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-400 px-5 text-[14px] font-black text-[#0A0A0A] shadow-sm transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            <>
              Save prices
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
