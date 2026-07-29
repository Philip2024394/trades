"use client";
// ConfirmationForm — editable form pre-filled from intent + memory match.
// Owner reviews and adjusts before Applying.

import { MT } from "../_tokens";
import type { SpeciesRow } from "@/apps/materials/_schema/types";
import type { MemoryCategory } from "@/apps/materials/_schema/memory_types";
import type { AddStockFormValues } from "./AddStockWorkflow";

const CATEGORIES: MemoryCategory[] = ["hardwood", "softwood", "sheet", "stair_part", "consumable", "hardware", "finish", "other"];
const CURRENCIES = ["GBP", "USD", "EUR"];

export function ConfirmationForm({
  value, onChange, species,
}: {
  value: AddStockFormValues;
  onChange: (v: AddStockFormValues) => void;
  species: SpeciesRow[];
}) {
  const set = <K extends keyof AddStockFormValues>(k: K, v: AddStockFormValues[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div
      className="px-4 py-4"
      style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, borderRadius: MT.radiusLg, boxShadow: MT.shadowSoft }}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: MT.secondaryGrey }}>
        2 · This is what I&apos;m going to do
      </div>
      <p className="mt-1 mb-2 text-[12px]" style={{ color: MT.secondaryGrey }}>
        Review and edit anything before you confirm.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Material name">
          <input
            type="text"
            value={value.material_name}
            onChange={(e) => set("material_name", e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Category">
          <select value={value.category} onChange={(e) => set("category", e.target.value as MemoryCategory)} style={inputStyle}>
            {CATEGORIES.map(c => <option key={c} value={c}>{prettyCat(c)}</option>)}
          </select>
        </Field>

        <Field label="Species">
          <select
            value={value.species_id ?? ""}
            onChange={(e) => set("species_id", e.target.value || null)}
            style={inputStyle}
          >
            <option value="">— Select species —</option>
            {species.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
          </select>
        </Field>

        <Field label="Quantity">
          <input
            type="number" min={1}
            value={value.quantity}
            onChange={(e) => set("quantity", Math.max(1, Number(e.target.value) || 0))}
            style={inputStyle}
          />
        </Field>

        <Field label="Length (mm)">
          <input type="number" value={value.length_mm ?? ""} onChange={(e) => set("length_mm", e.target.value === "" ? null : Number(e.target.value))} style={inputStyle} />
        </Field>
        <Field label="Width (mm)">
          <input type="number" value={value.width_mm ?? ""} onChange={(e) => set("width_mm", e.target.value === "" ? null : Number(e.target.value))} style={inputStyle} />
        </Field>
        <Field label="Thickness (mm)">
          <input type="number" value={value.thickness_mm ?? ""} onChange={(e) => set("thickness_mm", e.target.value === "" ? null : Number(e.target.value))} style={inputStyle} />
        </Field>

        <Field label="Grade">
          <input type="text" value={value.typical_grade ?? ""} onChange={(e) => set("typical_grade", e.target.value || null)} placeholder="Prime · FAS · Select…" style={inputStyle} />
        </Field>

        <Field label="Supplier">
          <input type="text" value={value.supplier_name ?? ""} onChange={(e) => set("supplier_name", e.target.value || null)} placeholder="e.g. James Latham" style={inputStyle} />
        </Field>

        <Field label="Reference">
          <input type="text" value={value.reference ?? ""} onChange={(e) => set("reference", e.target.value || null)} placeholder="INV-12345 · PO-42" style={inputStyle} />
        </Field>

        <Field label="Price per unit">
          <div className="flex gap-2">
            <input
              type="number" step="0.01"
              value={value.price_per_unit ?? ""}
              onChange={(e) => set("price_per_unit", e.target.value === "" ? null : Number(e.target.value))}
              style={{ ...inputStyle, flex: 1 }}
            />
            <select value={value.price_currency} onChange={(e) => set("price_currency", e.target.value)} style={{ ...inputStyle, width: 84, flex: "none" }}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </Field>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  background: MT.bg,
  color: MT.darkGrey,
  border: `1px solid ${MT.border}`,
  borderRadius: MT.radiusSm,
  outline: "none",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: MT.secondaryGrey }}>{label}</span>
      {children}
    </label>
  );
}

function prettyCat(c: MemoryCategory): string {
  return c[0].toUpperCase() + c.slice(1).replaceAll("_", " ");
}
