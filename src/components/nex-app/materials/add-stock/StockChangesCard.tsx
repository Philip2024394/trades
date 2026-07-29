"use client";
// StockChangesCard — "3 · Stock changes"
// Presents the material impact as clean deltas rather than a form
// summary. Feels like NEX handing you the outcome, not asking you to
// verify data cells.

import { MT } from "../_tokens";
import type { AddStockFormValues } from "./AddStockWorkflow";

export function StockChangesCard({ form }: { form: AddStockFormValues }) {
  const volume_m3 = form.length_mm && form.width_mm && form.thickness_mm && form.quantity
    ? (form.length_mm * form.width_mm * form.thickness_mm * form.quantity) / 1_000_000_000
    : null;
  const totalCost = form.price_per_unit != null ? form.price_per_unit * form.quantity : null;
  const sym = symbol(form.price_currency);

  return (
    <div
      className="px-5 py-4"
      style={{
        background: MT.primarySoft,
        border: `1px solid ${MT.primaryBorder}`,
        borderRadius: MT.radiusLg,
      }}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: MT.primary }}>
        3 · Stock changes
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Delta value={`+${form.quantity}`}                  label="Boards" />
        {volume_m3 && <Delta value={`+${volume_m3.toFixed(3)}`} unit="m³" label="Volume" />}
        {totalCost != null && <Delta value={`+${sym}${formatMoney(totalCost)}`} label="Value" />}
      </div>
    </div>
  );
}

function Delta({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1 leading-none">
        <span className="text-[24px] font-extrabold tracking-tight" style={{ color: MT.darkGrey, letterSpacing: -0.5 }}>{value}</span>
        {unit && <span className="text-[13px] font-bold" style={{ color: MT.darkGrey }}>{unit}</span>}
      </div>
      <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: MT.primary }}>{label}</div>
    </div>
  );
}

function symbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case "GBP": return "£";
    case "USD": return "$";
    case "EUR": return "€";
    default:    return `${currency} `;
  }
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
