"use client";

// Item Specifics renderer — category-driven per-spec input grid for the
// ShopModeEditor product form. Reads the picked category from
// productCategories.ts, splits the specs into Required / Recommended /
// Optional, and renders type-aware inputs (text, number, dropdown,
// multiselect).
//
// Output: an array of { label, value } pairs that drops straight into
// the existing `specs` JSONB column on hammerex_xrated_products via
// the products/upsert API. Specs not filled in are dropped — buyers
// only ever see the values the merchant actually provided.

import { specsByStatus, type ProductCategory, type SpecField } from "@/lib/productCategories";

export type SpecValue = string | string[];
export type SpecMap = Record<string, SpecValue>;

export function ItemSpecsForm({
  category,
  values,
  onChange
}: {
  category: ProductCategory;
  values: SpecMap;
  onChange: (next: SpecMap) => void;
}) {
  const { required, recommended, optional } = specsByStatus(category);

  function setValue(key: string, v: SpecValue) {
    onChange({ ...values, [key]: v });
  }

  if (category.specs.length === 0) {
    return (
      <p className="text-[12px] leading-snug text-brand-muted">
        No structured specs for this category — add any extra detail as
        plain text in the Description field.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {required.length > 0 && (
        <SpecGroup
          eyebrow="Required"
          accent="#0F7A3F"
          fields={required}
          values={values}
          setValue={setValue}
        />
      )}
      {recommended.length > 0 && (
        <SpecGroup
          eyebrow="Recommended"
          accent="#FFB300"
          fields={recommended}
          values={values}
          setValue={setValue}
        />
      )}
      {optional.length > 0 && (
        <details className="rounded-xl border border-brand-line bg-brand-surface">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[12px] font-extrabold text-brand-text">
            <span>More details (optional · {optional.length})</span>
            <span className="text-[11px] font-bold text-brand-muted">Tap to expand</span>
          </summary>
          <div className="border-t border-brand-line p-3">
            <SpecGroup
              eyebrow=""
              accent="#9CA3AF"
              fields={optional}
              values={values}
              setValue={setValue}
            />
          </div>
        </details>
      )}
    </div>
  );
}

function SpecGroup({
  eyebrow,
  accent,
  fields,
  values,
  setValue
}: {
  eyebrow: string;
  accent: string;
  fields: SpecField[];
  values: SpecMap;
  setValue: (key: string, v: SpecValue) => void;
}) {
  return (
    <div className="space-y-2">
      {eyebrow && (
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: accent }}
        >
          {eyebrow}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <SpecInput
            key={f.key}
            field={f}
            value={values[f.key] ?? (f.type === "multiselect" ? [] : "")}
            onChange={(v) => setValue(f.key, v)}
          />
        ))}
      </div>
    </div>
  );
}

function SpecInput({
  field,
  value,
  onChange
}: {
  field: SpecField;
  value: SpecValue;
  onChange: (v: SpecValue) => void;
}) {
  const str = typeof value === "string" ? value : "";
  const arr = Array.isArray(value) ? value : [];
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
        {field.label}
        {field.unit && (
          <span className="ml-1 text-[10px] font-bold text-brand-muted/80">
            ({field.unit})
          </span>
        )}
      </span>
      {field.type === "text" && (
        <input
          type="text"
          value={str}
          onChange={(e) => onChange(e.target.value.slice(0, 80))}
          placeholder={field.placeholder}
          maxLength={80}
          className="mt-1.5 h-10 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
        />
      )}
      {field.type === "number" && (
        <div className="mt-1.5 flex items-stretch overflow-hidden rounded-xl border border-brand-line bg-brand-bg focus-within:border-[#FFB300]">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={str}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="h-10 w-full bg-transparent px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:outline-none"
          />
          {field.unit && (
            <span className="inline-flex items-center bg-neutral-100 px-3 text-[12px] font-bold uppercase tracking-widest text-brand-muted">
              {field.unit}
            </span>
          )}
        </div>
      )}
      {field.type === "dropdown" && (
        <select
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-[#FFB300] focus:outline-none"
        >
          <option value="">— Pick —</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
      {field.type === "multiselect" && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(field.options ?? []).map((o) => {
            const on = arr.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() =>
                  onChange(on ? arr.filter((x) => x !== o) : [...arr, o])
                }
                className="inline-flex h-9 items-center rounded-xl border-2 px-3 text-[12px] font-extrabold transition active:scale-[0.97]"
                style={{
                  background: on ? "var(--trade-accent, #FFB300)" : "#FFFFFF",
                  borderColor: on
                    ? "var(--trade-accent, #FFB300)"
                    : "rgba(255,179,0,0.4)",
                  color: "#0A0A0A"
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}
    </label>
  );
}

/** Convert the SpecMap into the { label, value } JSONB shape the
 *  products/upsert API expects. Empty values are dropped so buyers
 *  never see "Brand: —". Multiselect values join with " · ". */
export function specMapToSaved(
  category: ProductCategory,
  values: SpecMap
): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const f of category.specs) {
    const v = values[f.key];
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length === 0) continue;
      out.push({ label: f.label, value: t });
    } else if (Array.isArray(v) && v.length > 0) {
      out.push({ label: f.label, value: v.join(" · ") });
    }
  }
  return out;
}

/** Read the saved { label, value }[] back into a SpecMap so the
 *  editor pre-fills with whatever's already on the listing. We match
 *  on label (case-insensitive) since that's what the API stores. */
export function savedToSpecMap(
  category: ProductCategory,
  saved: { label: string; value: string }[]
): SpecMap {
  const byLabel = new Map(
    saved.map((s) => [s.label.trim().toLowerCase(), s.value])
  );
  const out: SpecMap = {};
  for (const f of category.specs) {
    const v = byLabel.get(f.label.toLowerCase());
    if (v === undefined) continue;
    if (f.type === "multiselect") {
      out[f.key] = v.split(/[·,]/).map((s) => s.trim()).filter(Boolean);
    } else {
      out[f.key] = v;
    }
  }
  return out;
}
