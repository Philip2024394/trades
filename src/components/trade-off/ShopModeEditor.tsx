"use client";

// ShopModeEditor — product CRUD for the Shop Mode add-on. Lists existing
// products with edit/archive; modal-style inline editor for create/edit.
// Cover + gallery uploads reuse /api/trade-off/upload-photo (same as the
// rest of the dashboard so we don't fork the storage path).
//
// Phase 2 additions:
//   – Variants section (single-axis size OR colour; axis locked once a
//     row exists; per-row stock + price delta).
//   – Size chart upload (image + unit picker locked to the schema's
//     five enum values).
//   – Drag-reorder for the product list and the per-product gallery
//     strip, both using dnd-kit with a 250 ms touch activation delay so
//     accidental taps don't trigger a drag on mobile.

import { useEffect, useMemo, useRef, useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Mode = "list" | "create" | { kind: "edit"; product: HammerexXratedProduct };

type VariantAxis = "size" | "colour";

type VariantRow = {
  // Local-only key so dnd-kit can identify rows that have no DB id yet.
  key: string;
  axis: VariantAxis;
  label: string;
  // Strings so the inputs stay controlled; sanitised at save time.
  stock_count: string;
  price_delta_pounds: string;
};

type FormState = {
  id: string;
  name: string;
  description: string;
  price_pounds: string;
  stock_count: string;
  dispatch_days: string;
  cover_url: string;
  gallery_urls: string[];
  compare_with: string[];
  sort_order: string;
  status: "live" | "archived";
  // Services Prices add-on fields. Editable when kind='service' — both
  // hidden in product-mode, where the API silently defaults unit=null and
  // category=null on save.
  unit: string;
  category: string;
  // Phase 2.
  has_variants: boolean;
  variants: VariantRow[];
  size_chart_url: string;
  size_chart_unit: "" | "size" | "kg" | "litre" | "cm" | "other";
};

const EMPTY_FORM: FormState = {
  id: "",
  name: "",
  description: "",
  price_pounds: "",
  stock_count: "",
  dispatch_days: "",
  cover_url: "",
  gallery_urls: [],
  compare_with: [],
  sort_order: "0",
  status: "live",
  unit: "",
  category: "",
  has_variants: false,
  variants: [],
  size_chart_url: "",
  size_chart_unit: ""
};

const UNIT_CHIPS = [
  "per hour",
  "per item",
  "per sqm",
  "per day",
  "per tree",
  "per kg"
] as const;

const CATEGORY_CHIPS = [
  "Gardening",
  "Machinery",
  "Hire",
  "Cleaning",
  "Labour",
  "Callout"
] as const;

const SIZE_CHART_UNITS: { value: "size" | "kg" | "litre" | "cm" | "other"; label: string }[] = [
  { value: "size", label: "Size" },
  { value: "kg", label: "Kilograms" },
  { value: "litre", label: "Litres" },
  { value: "cm", label: "Centimetres" },
  { value: "other", label: "Other" }
];

function poundsToPence(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function penceToPounds(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "0.00";
  return (p / 100).toFixed(2);
}

// Signed delta input: accepts "+2.50", "-1", "2.50" — all return pence.
function signedPoundsToPenceOrNull(input: string): number | null {
  const t = input.trim();
  if (t.length === 0) return null;
  // Strip a single leading + so Number() parses cleanly.
  const cleaned = t.startsWith("+") ? t.slice(1) : t;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function penceToSignedPounds(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "";
  if (p === 0) return "0.00";
  return p > 0 ? `+${(p / 100).toFixed(2)}` : (p / 100).toFixed(2);
}

let _keyCounter = 0;
function nextRowKey(): string {
  _keyCounter += 1;
  return `v-${Date.now().toString(36)}-${_keyCounter}`;
}

function productToForm(p: HammerexXratedProduct): FormState {
  const rawVariants = Array.isArray(p.variants) ? p.variants : [];
  const variants: VariantRow[] = rawVariants.map((v) => ({
    key: nextRowKey(),
    axis: v.axis === "colour" ? "colour" : "size",
    label: typeof v.label === "string" ? v.label : "",
    stock_count:
      v.stock_count === null || v.stock_count === undefined ? "" : String(v.stock_count),
    price_delta_pounds: penceToSignedPounds(v.price_delta_pence)
  }));
  return {
    id: p.id,
    name: p.name ?? "",
    description: p.description ?? "",
    price_pounds: penceToPounds(p.price_pence ?? 0),
    stock_count:
      p.stock_count === null || p.stock_count === undefined
        ? ""
        : String(p.stock_count),
    dispatch_days:
      p.dispatch_days === null || p.dispatch_days === undefined
        ? ""
        : String(p.dispatch_days),
    cover_url: p.cover_url ?? "",
    gallery_urls: Array.isArray(p.gallery_urls) ? p.gallery_urls : [],
    compare_with: Array.isArray(p.compare_with) ? p.compare_with : [],
    sort_order:
      typeof p.sort_order === "number" ? String(p.sort_order) : "0",
    status: p.status === "archived" ? "archived" : "live",
    unit: typeof p.unit === "string" ? p.unit : "",
    category: typeof p.category === "string" ? p.category : "",
    has_variants: variants.length > 0,
    variants,
    size_chart_url: p.size_chart_url ?? "",
    size_chart_unit: p.size_chart_unit ?? ""
  };
}

// Mobile-friendly dnd-kit sensor config. The 250 ms touch delay matches
// the spec — long-press triggers a drag, a normal tap on the row passes
// through to the Edit button. Pointer sensor uses a small move-distance
// threshold so click-and-release on desktop never starts a drag.
function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

export function ShopModeEditor({
  slug,
  editToken,
  initialProducts,
  kind = "product"
}: {
  slug: string;
  editToken: string;
  initialProducts: HammerexXratedProduct[];
  /** Switches the editor between Shop Mode (kind='product') and the
   *  Services Prices add-on (kind='service'). When 'service':
   *   – Header + row labels read "Service" instead of "Product".
   *   – Stock count + dispatch-day labels reshape ("Days from booking
   *     to first appointment", stock hidden — services never run out).
   *   – Unit becomes required & visible; category becomes visible.
   *   – Defaults persisted as service-rows so the public Services Grid
   *     picks them up. */
  kind?: "product" | "service";
}) {
  const isService = kind === "service";
  const noun = isService ? "service" : "product";
  const NounCap = isService ? "Service" : "Product";
  // Filter the in-editor list to the active kind so a tradesperson who
  // runs both add-ons never sees their products mixed in with their
  // services (or vice versa) on the editor surface.
  const [products, setProducts] = useState<HammerexXratedProduct[]>(
    initialProducts.filter((p) => (p.kind ?? "product") === kind)
  );
  const [mode, setMode] = useState<Mode>("list");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const liveProducts = useMemo(
    () => products.filter((p) => p.status === "live"),
    [products]
  );
  const compareOptions = useMemo(
    () =>
      products
        .filter((p) => p.status === "live" && p.id !== form.id)
        .map((p) => ({ id: p.id, name: p.name })),
    [products, form.id]
  );

  function startCreate() {
    setForm({ ...EMPTY_FORM, sort_order: String(products.length) });
    setErr(null);
    setMsg(null);
    setMode("create");
  }
  function startEdit(p: HammerexXratedProduct) {
    setForm(productToForm(p));
    setErr(null);
    setMsg(null);
    setMode({ kind: "edit", product: p });
  }
  function cancel() {
    setForm(EMPTY_FORM);
    setErr(null);
    setMode("list");
  }
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setErr(null);
    setMsg(null);
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setErr("Name is required.");
      return;
    }
    const price_pence = poundsToPence(form.price_pounds);
    if (price_pence <= 0) {
      setErr("Set a price greater than £0.");
      return;
    }
    const trimmedUnit = form.unit.trim();
    if (isService && trimmedUnit.length === 0) {
      setErr('Unit is required for services — e.g. "per hour", "per tree".');
      return;
    }
    // Variants validation. The API double-checks, but bouncing here
    // gives an instant error before we burn a network round-trip.
    let variantsOut: { axis: VariantAxis; label: string; stock_count: number | null; price_delta_pence: number | null }[] = [];
    if (form.has_variants) {
      if (form.variants.length === 0) {
        setErr("Add at least one variant, or turn variants off.");
        return;
      }
      for (const v of form.variants) {
        const label = v.label.trim();
        if (label.length === 0 || label.length > 32) {
          setErr("Each variant needs a label of 1-32 characters.");
          return;
        }
      }
      variantsOut = form.variants.map((v) => {
        const sc = v.stock_count.trim();
        const stock_count = sc.length === 0 ? null : Math.max(0, Math.round(Number(sc)));
        const pd = signedPoundsToPenceOrNull(v.price_delta_pounds);
        return {
          axis: v.axis,
          label: v.label.trim().slice(0, 32),
          stock_count: Number.isFinite(stock_count as number) ? stock_count : null,
          price_delta_pence: pd
        };
      });
    }
    // Size chart — require a unit when an image is uploaded.
    const sizeChartUrl = form.size_chart_url.trim();
    if (sizeChartUrl.length > 0 && form.size_chart_unit === "") {
      setErr("Pick a size-chart unit (or remove the chart).");
      return;
    }

    setSubmitting(true);
    try {
      // In service-mode stock is hidden (services don't run out) — force
      // null so an old edited row with a leftover stock value gets cleared.
      const stockN = isService
        ? null
        : form.stock_count.trim().length === 0
          ? null
          : Number(form.stock_count);
      const dispN = form.dispatch_days.trim().length === 0 ? null : Number(form.dispatch_days);
      const sortN = Number(form.sort_order);
      const product = {
        ...(form.id ? { id: form.id } : {}),
        kind,
        name: trimmedName.slice(0, 80),
        description: form.description.trim().slice(0, 1000),
        price_pence,
        stock_count: stockN === null || !Number.isFinite(stockN) || stockN < 0 ? null : Math.round(stockN),
        dispatch_days: dispN === null || !Number.isFinite(dispN) || dispN < 0 ? null : Math.round(dispN),
        cover_url: form.cover_url.trim(),
        gallery_urls: form.gallery_urls.slice(0, 3),
        compare_with: form.compare_with.slice(0, 10),
        status: form.status,
        sort_order: Number.isFinite(sortN) && sortN >= 0 ? Math.round(sortN) : 0,
        unit: trimmedUnit.length > 0 ? trimmedUnit.slice(0, 32) : null,
        category:
          form.category.trim().length > 0
            ? form.category.trim().slice(0, 40)
            : null,
        variants: variantsOut,
        size_chart_url: sizeChartUrl,
        size_chart_unit: sizeChartUrl.length > 0 ? form.size_chart_unit : null
      };
      const res = await fetch("/api/trade-off/products/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, product })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Save failed.");
        return;
      }
      const saved = json.product as HammerexXratedProduct;
      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      setMsg(form.id ? "Updated." : "Added.");
      setForm(EMPTY_FORM);
      setMode("list");
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function archive(p: HammerexXratedProduct) {
    if (!confirm(`Archive "${p.name}"? Customers won't see it any more.`)) return;
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/products/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, product_id: p.id })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Archive failed.");
        return;
      }
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, status: "archived" } : x))
      );
    } catch {
      setErr("Network error — try again.");
    }
  }

  // Product-list drag reorder. Local state updates immediately for
  // snappy feedback; a 500 ms debounce coalesces rapid drags before
  // posting to /products/reorder. On error we revert to the snapshot
  // we captured before the drag started.
  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
    };
  }, []);
  function persistReorder(nextProducts: HammerexXratedProduct[], snapshot: HammerexXratedProduct[]) {
    if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
    reorderTimeoutRef.current = setTimeout(async () => {
      // Space sort_order in tens so future single-row inserts can land
      // between two existing rows without renumbering everything.
      const ordering = nextProducts.map((p, idx) => ({
        id: p.id,
        sort_order: (idx + 1) * 10
      }));
      try {
        const res = await fetch("/api/trade-off/products/reorder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, edit_token: editToken, ordering })
        });
        const json = await res.json();
        if (!json.ok) {
          setProducts(snapshot);
          setErr(json.error ?? "Reorder failed — restored previous order.");
          return;
        }
        setProducts((prev) =>
          prev.map((p) => {
            const o = ordering.find((x) => x.id === p.id);
            return o ? { ...p, sort_order: o.sort_order } : p;
          })
        );
      } catch {
        setProducts(snapshot);
        setErr("Network error — restored previous order.");
      }
    }, 500);
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">
            Your {isService ? "services" : "products"}
          </h2>
          <p className="mt-1 text-xs text-brand-muted">
            {liveProducts.length} live · {products.length - liveProducts.length} archived
          </p>
        </div>
        {mode === "list" && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90"
          >
            + Add {noun}
          </button>
        )}
      </div>

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

      {mode === "list" ? (
        <ProductList
          products={products}
          onEdit={startEdit}
          onArchive={archive}
          isService={isService}
          onReorder={(next, snapshot) => {
            setProducts(next);
            persistReorder(next, snapshot);
          }}
        />
      ) : (
        <ProductForm
          form={form}
          update={update}
          slug={slug}
          editToken={editToken}
          compareOptions={compareOptions}
          submitting={submitting}
          onCancel={cancel}
          onSubmit={submit}
          mode={mode === "create" ? "create" : "edit"}
          isService={isService}
          NounCap={NounCap}
        />
      )}
    </div>
  );
}

function ProductList({
  products,
  onEdit,
  onArchive,
  isService,
  onReorder
}: {
  products: HammerexXratedProduct[];
  onEdit: (p: HammerexXratedProduct) => void;
  onArchive: (p: HammerexXratedProduct) => void;
  isService: boolean;
  onReorder: (
    next: HammerexXratedProduct[],
    snapshot: HammerexXratedProduct[]
  ) => void;
}) {
  const sensors = useDragSensors();

  if (products.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-brand-line bg-brand-bg px-4 py-6 text-center text-xs text-brand-muted">
        No {isService ? "services" : "products"} yet. Tap &ldquo;Add{" "}
        {isService ? "service" : "product"}&rdquo; to list your first{" "}
        {isService ? "service" : "item"}.
      </p>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(products, oldIndex, newIndex);
    onReorder(next, products);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {products.map((p) => (
            <SortableProductRow
              key={p.id}
              product={p}
              isService={isService}
              onEdit={onEdit}
              onArchive={onArchive}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableProductRow({
  product,
  isService,
  onEdit,
  onArchive
}: {
  product: HammerexXratedProduct;
  isService: boolean;
  onEdit: (p: HammerexXratedProduct) => void;
  onArchive: (p: HammerexXratedProduct) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-line bg-brand-bg p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="inline-flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-brand-line bg-brand-surface text-brand-muted transition hover:border-brand-accent hover:text-brand-accent active:cursor-grabbing"
      >
        <DragHandleIcon />
      </button>
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-brand-line bg-brand-surface">
        {product.cover_url ? (
          <img src={product.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-brand-muted">
            No img
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-brand-text">{product.name}</p>
        <p className="text-xs text-brand-muted">
          £{penceToPounds(product.price_pence ?? 0)}
          {isService
            ? product.unit
              ? ` ${product.unit}`
              : ""
            : ` · ${stockLabel(product.stock_count)}`}
        </p>
      </div>
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
          product.status === "live"
            ? "border-brand-accent/60 bg-brand-accent/10 text-brand-accent"
            : "border-brand-line bg-brand-surface text-brand-muted"
        }`}
      >
        {product.status}
      </span>
      <div className="flex w-full gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent sm:flex-none"
        >
          Edit
        </button>
        {product.status === "live" && (
          <button
            type="button"
            onClick={() => onArchive(product)}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/5 px-3 text-xs font-bold text-red-300 transition hover:bg-red-500/15 sm:flex-none"
          >
            Archive
          </button>
        )}
      </div>
    </li>
  );
}

function DragHandleIcon() {
  return (
    <svg
      width="14"
      height="20"
      viewBox="0 0 8 14"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="1.5" cy="2" r="1.2" />
      <circle cx="6.5" cy="2" r="1.2" />
      <circle cx="1.5" cy="7" r="1.2" />
      <circle cx="6.5" cy="7" r="1.2" />
      <circle cx="1.5" cy="12" r="1.2" />
      <circle cx="6.5" cy="12" r="1.2" />
    </svg>
  );
}

function stockLabel(s: number | null): string {
  if (s === null || s === undefined) return "Unlimited stock";
  if (s <= 0) return "Out of stock";
  if (s <= 5) return `${s} left`;
  return `${s} in stock`;
}

function ProductForm({
  form,
  update,
  slug,
  editToken,
  compareOptions,
  submitting,
  onCancel,
  onSubmit,
  mode,
  isService,
  NounCap
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  slug: string;
  editToken: string;
  compareOptions: { id: string; name: string }[];
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  mode: "create" | "edit";
  isService: boolean;
  NounCap: string;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-brand-line bg-brand-bg p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-accent">
          {mode === "create" ? `New ${NounCap.toLowerCase()}` : `Edit ${NounCap.toLowerCase()}`}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-md px-2 text-xs font-bold text-brand-muted transition hover:text-brand-text"
        >
          Cancel
        </button>
      </div>

      <Field label={`${NounCap} name *`}>
        <input
          type="text"
          value={form.name}
          maxLength={80}
          onChange={(e) => update("name", e.target.value)}
          placeholder={
            isService
              ? "e.g. Chop tree (up to 2m)"
              : "e.g. Hand-carved oak chopping board"
          }
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={form.description}
          maxLength={1000}
          onChange={(e) => update("description", e.target.value)}
          rows={4}
          placeholder="Materials, dimensions, who it's for…"
          className="block w-full rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
        />
        <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-muted">
          {form.description.length}/1000
        </p>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price (GBP) *">
          <div className="flex items-center gap-1">
            <span className="text-base font-bold text-brand-muted">£</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.price_pounds}
              onChange={(e) => update("price_pounds", e.target.value)}
              placeholder="0.00"
              className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </div>
        </Field>
        {!isService && (
          <Field label="Stock count (blank = unlimited)">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={form.stock_count}
              onChange={(e) => update("stock_count", e.target.value)}
              placeholder="Unlimited"
              className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </Field>
        )}
        {isService && (
          <Field label="Unit *">
            <div className="space-y-2">
              <div className="-mx-1 flex flex-wrap gap-1.5">
                {UNIT_CHIPS.map((chip) => {
                  const active = form.unit.trim().toLowerCase() === chip;
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => update("unit", chip)}
                      className={`inline-flex h-9 items-center rounded-full border px-3 text-[13px] font-bold transition ${
                        active
                          ? "border-brand-accent bg-brand-accent/15 text-brand-accent"
                          : "border-brand-line bg-brand-surface text-brand-text hover:border-brand-accent"
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={form.unit}
                maxLength={32}
                onChange={(e) => update("unit", e.target.value)}
                placeholder="per tree"
                className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
              />
            </div>
          </Field>
        )}
      </div>

      {isService && (
        <Field label="Category (optional)">
          <div className="space-y-2">
            <div className="-mx-1 flex flex-wrap gap-1.5">
              {CATEGORY_CHIPS.map((chip) => {
                const active = form.category.trim().toLowerCase() === chip.toLowerCase();
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => update("category", chip)}
                    className={`inline-flex h-9 items-center rounded-full border px-3 text-[13px] font-bold transition ${
                      active
                        ? "border-brand-accent bg-brand-accent/15 text-brand-accent"
                        : "border-brand-line bg-brand-surface text-brand-text hover:border-brand-accent"
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={form.category}
              maxLength={40}
              onChange={(e) => update("category", e.target.value)}
              placeholder="e.g. Gardening, Machinery"
              className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </div>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={
            isService
              ? "Days from booking to first appointment (optional)"
              : "Dispatch in N days (optional)"
          }
        >
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.dispatch_days}
            onChange={(e) => update("dispatch_days", e.target.value)}
            placeholder={isService ? "e.g. 5" : "e.g. 3"}
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
        </Field>
        <Field label="Sort order">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.sort_order}
            onChange={(e) => update("sort_order", e.target.value)}
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
        </Field>
      </div>

      <Field label="Cover image">
        <SingleImageUploader
          value={form.cover_url}
          onChange={(url) => update("cover_url", url)}
          slug={slug}
          editToken={editToken}
        />
      </Field>

      <Field label="Gallery (up to 3 extra images — drag to reorder)">
        <GalleryUploader
          urls={form.gallery_urls}
          onChange={(urls) => update("gallery_urls", urls)}
          slug={slug}
          editToken={editToken}
        />
      </Field>

      {!isService && (
        <CollapsibleSection
          title="Variants (optional)"
          subtitle={form.has_variants ? `${form.variants.length} variant${form.variants.length === 1 ? "" : "s"}` : "Off"}
        >
          <VariantsEditor form={form} update={update} />
        </CollapsibleSection>
      )}

      {!isService && (
        <CollapsibleSection
          title="Size chart (optional)"
          subtitle={form.size_chart_url ? `Uploaded · ${form.size_chart_unit || "no unit"}` : "Off"}
        >
          <SizeChartEditor form={form} update={update} slug={slug} editToken={editToken} />
        </CollapsibleSection>
      )}

      {compareOptions.length > 0 && (
        <Field label="Compare with your other products">
          <CompareWithPicker
            options={compareOptions}
            value={form.compare_with}
            onChange={(ids) => update("compare_with", ids)}
          />
        </Field>
      )}

      <Field label="Status">
        <select
          value={form.status}
          onChange={(e) =>
            update("status", e.target.value === "archived" ? "archived" : "live")
          }
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
        >
          <option value="live">Live (visible to customers)</option>
          <option value="archived">Archived (hidden)</option>
        </select>
      </Field>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? "Saving…"
            : mode === "create"
              ? `Add ${NounCap.toLowerCase()}`
              : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-bg px-4 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-brand-line bg-brand-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-sm font-bold text-brand-text transition hover:text-brand-accent"
        aria-expanded={open}
      >
        <span className="flex items-baseline gap-2">
          <span>{title}</span>
          {subtitle && (
            <span className="text-[13px] font-semibold text-brand-muted">{subtitle}</span>
          )}
        </span>
        <span className="text-brand-muted">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="space-y-3 border-t border-brand-line p-3">{children}</div>}
    </div>
  );
}

function VariantsEditor({
  form,
  update
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const sensors = useDragSensors();
  const lockedAxis: VariantAxis | null =
    form.variants.length > 0 ? form.variants[0].axis : null;

  function toggleHasVariants(next: boolean) {
    if (!next) {
      update("has_variants", false);
      update("variants", []);
    } else {
      update("has_variants", true);
    }
  }

  function setAxis(axis: VariantAxis) {
    if (lockedAxis && lockedAxis !== axis) return;
    // Stamp every row with the picked axis so the lock works on first add.
    update(
      "variants",
      form.variants.map((v) => ({ ...v, axis }))
    );
  }
  function addRow() {
    const axis: VariantAxis = lockedAxis ?? "size";
    update("variants", [
      ...form.variants,
      {
        key: nextRowKey(),
        axis,
        label: "",
        stock_count: "",
        price_delta_pounds: ""
      }
    ]);
  }
  function removeRow(key: string) {
    update("variants", form.variants.filter((v) => v.key !== key));
  }
  function patchRow(key: string, patch: Partial<VariantRow>) {
    update(
      "variants",
      form.variants.map((v) => (v.key === key ? { ...v, ...patch } : v))
    );
  }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = form.variants.findIndex((v) => v.key === active.id);
    const newIndex = form.variants.findIndex((v) => v.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    update("variants", arrayMove(form.variants, oldIndex, newIndex));
  }

  const activeAxis: VariantAxis = lockedAxis ?? "size";
  const labelPlaceholder = activeAxis === "size" ? "e.g. M, L, 1m, 2.5m" : "e.g. Red, Black, Yellow";

  return (
    <div className="space-y-3">
      <label className="flex h-11 items-center gap-3 rounded-md border border-brand-line bg-brand-bg px-3">
        <input
          type="checkbox"
          checked={form.has_variants}
          onChange={(e) => toggleHasVariants(e.target.checked)}
          className="h-5 w-5 accent-brand-accent"
        />
        <span className="text-[13px] font-bold text-brand-text">
          This product has variants
        </span>
      </label>

      {form.has_variants && (
        <>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
              Axis
            </p>
            <div className="flex flex-wrap gap-2">
              {(["size", "colour"] as VariantAxis[]).map((axis) => {
                const active = activeAxis === axis;
                const locked = lockedAxis !== null && lockedAxis !== axis;
                return (
                  <button
                    key={axis}
                    type="button"
                    onClick={() => setAxis(axis)}
                    disabled={locked}
                    className={`inline-flex h-11 items-center rounded-full border px-4 text-[13px] font-bold transition ${
                      active
                        ? "border-brand-accent bg-brand-accent/15 text-brand-accent"
                        : locked
                          ? "border-brand-line bg-brand-surface text-brand-muted opacity-60"
                          : "border-brand-line bg-brand-bg text-brand-text hover:border-brand-accent"
                    }`}
                  >
                    {axis === "size" ? "Size" : "Colour"}
                  </button>
                );
              })}
            </div>
            {lockedAxis && (
              <p className="text-[13px] text-brand-muted">
                Clear all variants to change the axis.
              </p>
            )}
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={form.variants.map((v) => v.key)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {form.variants.map((v) => (
                  <SortableVariantRow
                    key={v.key}
                    row={v}
                    labelPlaceholder={labelPlaceholder}
                    onPatch={(patch) => patchRow(v.key, patch)}
                    onRemove={() => removeRow(v.key)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <button
            type="button"
            onClick={addRow}
            className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          >
            + Add variant
          </button>
        </>
      )}
    </div>
  );
}

function SortableVariantRow({
  row,
  labelPlaceholder,
  onPatch,
  onRemove
}: {
  row: VariantRow;
  labelPlaceholder: string;
  onPatch: (patch: Partial<VariantRow>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.key
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="space-y-2 rounded-md border border-brand-line bg-brand-bg p-2"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder variant"
          className="inline-flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-brand-line bg-brand-surface text-brand-muted transition hover:border-brand-accent hover:text-brand-accent active:cursor-grabbing"
        >
          <DragHandleIcon />
        </button>
        <input
          type="text"
          value={row.label}
          maxLength={32}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder={labelPlaceholder}
          className="block h-11 w-full min-w-0 flex-1 rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove variant"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-red-500/40 bg-red-500/5 text-base font-bold text-red-300 transition hover:bg-red-500/15"
        >
          ×
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={row.stock_count}
          onChange={(e) => onPatch({ stock_count: e.target.value })}
          placeholder="Stock (inherit)"
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
        />
        <input
          type="text"
          inputMode="decimal"
          value={row.price_delta_pounds}
          onChange={(e) => onPatch({ price_delta_pounds: e.target.value })}
          placeholder="Price ± (e.g. +2.00)"
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
        />
      </div>
    </li>
  );
}

function SizeChartEditor({
  form,
  update,
  slug,
  editToken
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  slug: string;
  editToken: string;
}) {
  return (
    <div className="space-y-3">
      <SingleImageUploader
        value={form.size_chart_url}
        onChange={(url) => update("size_chart_url", url)}
        slug={slug}
        editToken={editToken}
      />
      {form.size_chart_url && (
        <button
          type="button"
          onClick={() => {
            update("size_chart_url", "");
            update("size_chart_unit", "");
          }}
          className="inline-flex h-11 items-center rounded-lg border border-red-500/40 bg-red-500/5 px-3 text-[13px] font-bold text-red-300 transition hover:bg-red-500/15"
        >
          Remove chart
        </button>
      )}
      {form.size_chart_url && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Unit *
          </p>
          <div className="flex flex-wrap gap-2">
            {SIZE_CHART_UNITS.map((u) => {
              const active = form.size_chart_unit === u.value;
              return (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => update("size_chart_unit", u.value)}
                  className={`inline-flex h-11 items-center rounded-full border px-4 text-[13px] font-bold transition ${
                    active
                      ? "border-brand-accent bg-brand-accent/15 text-brand-accent"
                      : "border-brand-line bg-brand-bg text-brand-text hover:border-brand-accent"
                  }`}
                >
                  {u.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function SingleImageUploader({
  value,
  onChange,
  slug,
  editToken
}: {
  value: string;
  onChange: (url: string) => void;
  slug: string;
  editToken: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug);
      fd.append("edit_token", editToken);
      const res = await fetch("/api/trade-off/upload-photo", {
        method: "POST",
        body: fd
      });
      const json = await res.json();
      if (!json.ok || typeof json.url !== "string") {
        setErr(json.error ?? "Upload failed.");
        return;
      }
      onChange(json.url);
    } catch {
      setErr("Upload error.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-brand-line bg-brand-surface">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-brand-muted">
              None
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-60"
          >
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-bg px-3 text-xs font-bold text-brand-muted transition hover:text-red-300"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {err && <p className="text-xs font-semibold text-red-300">{err}</p>}
    </div>
  );
}

function GalleryUploader({
  urls,
  onChange,
  slug,
  editToken
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  slug: string;
  editToken: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sensors = useDragSensors();

  async function handleFile(file: File) {
    if (urls.length >= 3) {
      setErr("Gallery is full — remove one first.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug);
      fd.append("edit_token", editToken);
      const res = await fetch("/api/trade-off/upload-photo", {
        method: "POST",
        body: fd
      });
      const json = await res.json();
      if (!json.ok || typeof json.url !== "string") {
        setErr(json.error ?? "Upload failed.");
        return;
      }
      onChange([...urls, json.url].slice(0, 3));
    } catch {
      setErr("Upload error.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = urls.findIndex((u, i) => `${i}-${u}` === active.id);
    const newIndex = urls.findIndex((u, i) => `${i}-${u}` === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(urls, oldIndex, newIndex));
  }

  const ids = urls.map((u, i) => `${i}-${u}`);

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {urls.map((u, i) => (
              <SortableGalleryThumb
                key={ids[i]}
                id={ids[i]}
                url={u}
                onRemove={() => onChange(urls.filter((_, idx) => idx !== i))}
              />
            ))}
            {urls.length < 3 && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="inline-flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-brand-line bg-brand-bg text-xs font-bold text-brand-muted transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-60"
              >
                {busy ? "…" : "+ Add"}
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {err && <p className="text-xs font-semibold text-red-300">{err}</p>}
    </div>
  );
}

function SortableGalleryThumb({
  id,
  url,
  onRemove
}: {
  id: string;
  url: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative h-20 w-20 overflow-hidden rounded-md border border-brand-line bg-brand-surface"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag thumbnail to reorder"
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      >
        <img src={url} alt="" className="h-full w-full object-cover pointer-events-none" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white"
        aria-label="Remove image"
      >
        ×
      </button>
    </div>
  );
}

function CompareWithPicker({
  options,
  value,
  onChange
}: {
  options: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id].slice(0, 10));
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            className={`inline-flex h-11 items-center rounded-full border px-3 text-xs font-bold transition ${
              on
                ? "border-brand-accent bg-brand-accent/15 text-brand-accent"
                : "border-brand-line bg-brand-bg text-brand-text hover:border-brand-accent hover:text-brand-accent"
            }`}
          >
            {on ? "✓ " : ""}
            {o.name}
          </button>
        );
      })}
    </div>
  );
}
