// AddNotebookItemModal — trade adds a new item to their notebook.
//
// Category dropdown mirrors the builder-merchant taxonomy used by the
// carousel strip so counts + filtering line up. Unit list covers the
// UK trades staples (each, bag, sheet, box, roll, tin, litre, m, m2).

"use client";

import { useEffect, useState } from "react";
import { X, Package, Loader2 } from "lucide-react";
import { BUILDER_MERCHANT_CATEGORIES } from "./NotebookCategoriesStrip";

const UNITS = ["each", "bag", "box", "sheet", "roll", "tin", "litre", "m", "m²", "pack", "pallet"];

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  add: (input: {
    productName: string;
    spec?: string;
    categorySlug?: string;
    usualQty?: number;
    unit?: string;
  }) => Promise<unknown>;
};

export function AddNotebookItemModal({ open, onClose, onSaved, add }: Props) {
  const [productName, setProductName] = useState("");
  const [spec, setSpec] = useState("");
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [usualQty, setUsualQty] = useState<number>(1);
  const [unit, setUnit] = useState("each");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProductName("");
    setSpec("");
    setCategorySlug("");
    setUsualQty(1);
    setUnit("each");
    setError(null);
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
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await add({
        productName: productName.trim(),
        spec: spec.trim() || undefined,
        categorySlug: categorySlug || undefined,
        usualQty,
        unit
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add notebook item"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header
          className="flex items-center justify-between border-b p-4"
          style={{ borderColor: "rgba(139,69,19,0.10)" }}
        >
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">TC · Notebook</div>
            <h2 className="mt-0.5 text-[16px] font-black leading-tight text-neutral-900">Add a usual item</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            <X size={16}/>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
          <Field label="Product name" required>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Nela Plastering Trowel"
              className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
              autoFocus
            />
          </Field>

          <Field label="Spec" hint="Size, material, model number — anything a merchant needs.">
            <input
              type="text"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder='14" · Stainless · Flexi'
              className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
            />
          </Field>

          <Field label="Category">
            <select
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] text-neutral-900 outline-none"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
            >
              <option value="">— No category —</option>
              {BUILDER_MERCHANT_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Usual qty">
              <input
                type="number"
                min="1"
                max="9999"
                value={usualQty}
                onChange={(e) => setUsualQty(Math.max(1, Math.min(9999, Number(e.target.value))))}
                className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] text-neutral-900 outline-none"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
              />
            </Field>
            <Field label="Unit">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] text-neutral-900 outline-none"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </Field>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-2 text-[10.5px] text-red-700">
              Couldn&apos;t save: {error}. Try again.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center rounded-full border bg-white px-4 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-sm hover:bg-neutral-50"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !productName.trim()}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
              style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
            >
              {saving && <Loader2 size={12} className="animate-spin"/>}
              <Package size={12}/>
              {saving ? "Saving…" : "Add to notebook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
      {hint && <span className="text-[9.5px] leading-snug text-neutral-500">{hint}</span>}
    </label>
  );
}
