"use client";

// NEX Market · Quantity Pricing editor (signature behaviour #2).
//
// Seller sets absolute Rp-per-unit at qty tiers (NOT %). Editor is collapsible
// and only meaningful for products WITHOUT variants (matches DB CHECK
// qty_tiers_only_when_no_variants). On submit the editor writes a JSON string
// to a hidden field `qtyPriceTiers` that the server action parses + validates
// with validateQtyPriceTiers (triple defence: client → server → DB CHECK).
//
// Doctrine: NO fake UI. Every row you see here saves to the DB and shows on
// the buyer's product page.

import { useMemo, useState } from "react";

interface Row { minQty: string; pricePerUnitIdr: string }

const DEFAULT_ROWS: Row[] = [
  { minQty: "2", pricePerUnitIdr: "" },
  { minQty: "3", pricePerUnitIdr: "" },
];

export default function QuantityPricingEditor(): React.JSX.Element {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);

  const jsonValue = useMemo<string>(() => {
    if (!enabled) return "[]";
    const parsed = rows
      .map((r) => ({ minQty: parseInt(r.minQty, 10), pricePerUnitIdr: parseInt(r.pricePerUnitIdr, 10) }))
      .filter((r) => Number.isFinite(r.minQty) && r.minQty >= 2 && Number.isFinite(r.pricePerUnitIdr) && r.pricePerUnitIdr > 0);
    return JSON.stringify(parsed);
  }, [enabled, rows]);

  return (
    <div style={{ marginTop: 4 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span style={{ fontWeight: 500 }}>Enable quantity pricing</span>
        <span style={{ color: "#8a8776", fontSize: 12 }}>· Buy more, pay less</span>
      </label>

      {enabled && (
        <div style={{ marginTop: 12, padding: 14, background: "#faf7f2", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, color: "#8a8776", marginBottom: 10, letterSpacing: 0.3 }}>
            Set the price PER UNIT at each quantity tier. Higher tiers must be cheaper than lower tiers.
            Do not include qty 1 · that's your base price above.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 40px", gap: 8, fontSize: 11, color: "#8a8776", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
            <span>Qty ≥</span>
            <span>Rp per unit</span>
            <span></span>
          </div>
          {rows.map((row, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "80px 1fr 40px", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input
                type="number"
                min={2}
                value={row.minQty}
                onChange={(e) => setRows((r) => r.map((rr, i) => i === idx ? { ...rr, minQty: e.target.value } : rr))}
                style={inputStyle}
              />
              <input
                type="number"
                min={1}
                placeholder="e.g. 142500"
                value={row.pricePerUnitIdr}
                onChange={(e) => setRows((r) => r.map((rr, i) => i === idx ? { ...rr, pricePerUnitIdr: e.target.value } : rr))}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setRows((r) => r.filter((_, i) => i !== idx))}
                disabled={rows.length <= 1}
                style={{ padding: "6px 10px", border: "1px solid rgba(0,0,0,0.14)", background: "#fff", borderRadius: 6, cursor: rows.length <= 1 ? "not-allowed" : "pointer", fontSize: 14, color: "#8a8776", opacity: rows.length <= 1 ? 0.35 : 1 }}
                aria-label="Remove tier"
              >−</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows((r) => [...r, { minQty: String(Math.max(...r.map((rr) => parseInt(rr.minQty, 10) || 1)) + 1), pricePerUnitIdr: "" }])}
            style={{ marginTop: 4, padding: "6px 12px", background: "#fff", border: "1px dashed rgba(0,0,0,0.2)", borderRadius: 999, fontSize: 12, cursor: "pointer", color: "#333" }}
          >+ add tier</button>
        </div>
      )}

      <input type="hidden" name="qtyPriceTiers" value={jsonValue} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid rgba(0,0,0,0.14)",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
};
