"use client";

// ProductCategoriesEditor — bulk-set merchant_category + calculator
// override per product. Lives at /trade-off/edit/<slug>/product-categories.
//
// Per-row save through /api/trade-off/products/upsert with just the
// changed fields (id + name + price_pence are mandatory but unchanged).
// For service products (kind='service') also exposes service_trade_type
// + service_rate_pence + service_rate_unit so installers can plug into
// the calculator's labour line.

import { useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";
import {
  MERCHANT_CATEGORIES,
  SERVICE_TRADES,
  subcategoriesForCategory,
  type MerchantCategory,
  type ServiceTradeType
} from "@/lib/merchantCategories";

type RowState = {
  merchant_category: MerchantCategory | "";
  merchant_subcategory: string;
  calculator_override: "auto" | "none" | "";
  service_trade_type: ServiceTradeType | "";
  service_rate_pounds: string;
  service_rate_unit: "" | "m2" | "linear_m" | "item" | "tonne" | "hour" | "day";
  busy: boolean;
  err: string | null;
  msg: string | null;
};

function initialRow(p: HammerexXratedProduct): RowState {
  return {
    merchant_category: (p.merchant_category as MerchantCategory | null) ?? "",
    merchant_subcategory: p.merchant_subcategory ?? "",
    calculator_override:
      p.calculator_override === "auto" || p.calculator_override === "none"
        ? p.calculator_override
        : "",
    service_trade_type: (p.service_trade_type as ServiceTradeType | null) ?? "",
    service_rate_pounds:
      typeof p.service_rate_pence === "number" && p.service_rate_pence > 0
        ? (p.service_rate_pence / 100).toFixed(2)
        : "",
    service_rate_unit: (p.service_rate_unit as RowState["service_rate_unit"]) ?? "",
    busy: false,
    err: null,
    msg: null
  };
}

export function ProductCategoriesEditor({
  slug,
  editToken,
  initialProducts
}: {
  slug: string;
  editToken: string;
  initialProducts: HammerexXratedProduct[];
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const out: Record<string, RowState> = {};
    for (const p of initialProducts) out[p.id] = initialRow(p);
    return out;
  });

  function patch(id: string, p: Partial<RowState>) {
    setRows((s) => ({ ...s, [id]: { ...s[id], ...p } }));
  }

  async function save(product: HammerexXratedProduct) {
    const row = rows[product.id];
    if (!row) return;
    patch(product.id, { busy: true, err: null, msg: null });

    const ratePence = (() => {
      const n = Number(row.service_rate_pounds);
      if (!Number.isFinite(n) || n <= 0) return null;
      return Math.round(n * 100);
    })();

    try {
      const res = await fetch("/api/trade-off/products/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          product: {
            id: product.id,
            name: product.name,
            price_pence: product.price_pence,
            merchant_category: row.merchant_category || null,
            merchant_subcategory: row.merchant_subcategory || null,
            calculator_override: row.calculator_override || null,
            service_trade_type: row.service_trade_type || null,
            service_rate_pence: ratePence,
            service_rate_unit: row.service_rate_unit || null
          }
        })
      });
      const json = await res.json();
      if (!json.ok) {
        patch(product.id, { busy: false, err: json.error ?? "Save failed." });
        return;
      }
      patch(product.id, { busy: false, msg: "Saved ✓" });
      setTimeout(() => patch(product.id, { msg: null }), 2400);
    } catch {
      patch(product.id, { busy: false, err: "Network error — try again." });
    }
  }

  if (initialProducts.length === 0) {
    return (
      <div className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <p className="text-[13px] text-brand-muted">
          No products yet — open Trade Center to add some, then come back
          here to set their categories.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {initialProducts.map((product) => {
          const row = rows[product.id];
          if (!row) return null;
          const isService = (product.kind ?? "product") === "service";
          return (
            <li
              key={product.id}
              className="space-y-3 rounded-xl border border-brand-line bg-brand-bg p-4"
            >
              <div className="flex items-start gap-3">
                {product.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.cover_url}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md border border-brand-line object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-brand-line bg-brand-surface text-[10px] font-bold uppercase text-brand-muted">
                    No image
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-extrabold text-brand-text">
                    {product.name}
                  </p>
                  <p className="text-[11px] text-brand-muted">
                    £{(product.price_pence / 100).toFixed(2)} each ·{" "}
                    {isService ? "Service" : "Product"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                    Category
                  </span>
                  <select
                    value={row.merchant_category}
                    onChange={(e) =>
                      patch(product.id, {
                        merchant_category: e.target.value as MerchantCategory | ""
                      })
                    }
                    className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                  >
                    <option value="">— Uncategorised —</option>
                    {MERCHANT_CATEGORIES.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.label}
                        {c.calculator ? ` (calc: ${c.calculator})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                    Calculator on PDP
                  </span>
                  <select
                    value={row.calculator_override}
                    onChange={(e) =>
                      patch(product.id, {
                        calculator_override: e.target.value as RowState["calculator_override"]
                      })
                    }
                    className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                  >
                    <option value="">Auto (use category)</option>
                    <option value="auto">Auto (explicit)</option>
                    <option value="none">Hide calculator</option>
                  </select>
                </label>
              </div>

              {/* Subcategory — only meaningful when category is set.
               *  Drives the calculator cross-sell engine: a product
               *  tagged "paint_brush" surfaces under any paint
               *  calculator's "Complete your project" section. */}
              {row.merchant_category && (() => {
                const subOptions = subcategoriesForCategory(
                  row.merchant_category as MerchantCategory
                );
                if (subOptions.length === 0) return null;
                return (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                      Subcategory (for calculator cross-sell)
                    </span>
                    <select
                      value={row.merchant_subcategory}
                      onChange={(e) =>
                        patch(product.id, { merchant_subcategory: e.target.value })
                      }
                      className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                    >
                      <option value="">— None —</option>
                      {subOptions.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })()}

              {isService && (
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                      Trade type (installer)
                    </span>
                    <select
                      value={row.service_trade_type}
                      onChange={(e) =>
                        patch(product.id, {
                          service_trade_type: e.target.value as ServiceTradeType | ""
                        })
                      }
                      className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                    >
                      <option value="">— Not an installer —</option>
                      {SERVICE_TRADES.map((t) => (
                        <option key={t.slug} value={t.slug}>
                          {t.label} ({t.calculators.join(" / ")})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                      Rate (£)
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={row.service_rate_pounds}
                      onChange={(e) =>
                        patch(product.id, { service_rate_pounds: e.target.value })
                      }
                      placeholder="0.00"
                      className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                      Per
                    </span>
                    <select
                      value={row.service_rate_unit}
                      onChange={(e) =>
                        patch(product.id, {
                          service_rate_unit: e.target.value as RowState["service_rate_unit"]
                        })
                      }
                      className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                    >
                      <option value="">—</option>
                      <option value="m2">m²</option>
                      <option value="linear_m">linear m</option>
                      <option value="item">item</option>
                      <option value="tonne">tonne</option>
                      <option value="hour">hour</option>
                      <option value="day">day</option>
                    </select>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                {row.err ? (
                  <p className="text-[12px] font-bold text-red-400">{row.err}</p>
                ) : row.msg ? (
                  <p className="text-[12px] font-bold text-brand-accent">{row.msg}</p>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => save(product)}
                  disabled={row.busy}
                  className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-[13px] font-bold text-black transition hover:opacity-90 disabled:opacity-60"
                >
                  {row.busy ? "Saving…" : "Save"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
