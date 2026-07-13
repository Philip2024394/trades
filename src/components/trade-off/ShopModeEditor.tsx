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
import type {
  HammerexXratedProduct,
  RetailShippingArea,
  RetailShippingIntl
} from "@/lib/supabase";
import { RetailShippingEditor } from "@/components/trade-off/RetailShippingEditor";
import { PairsWithEditor } from "@/components/trade-off/PairsWithEditor";
import { WhatInBoxEditor } from "@/components/trade-off/WhatInBoxEditor";
import { QAEditor } from "@/components/trade-off/QAEditor";
import {
  ItemSpecsForm,
  specMapToSaved,
  savedToSpecMap
} from "@/components/trade-off/ItemSpecsForm";
import {
  PRODUCT_CATEGORIES,
  categoryBySlug
} from "@/lib/productCategories";
import { SERVICE_CATEGORIES } from "@/lib/serviceCategories";
import {
  PaymentMethodMark,
  type PaymentMethodKey
} from "@/components/xrated/profile/merchant/PaymentIconsRow";
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
  // Manufacturer / trade-covered warranty in whole years. Empty ⇒ NULL
  // in the DB (no warranty section on the PDP). Range 1–25 enforced at
  // both edges — client for immediate feedback, DB for correctness.
  warranty_years: string;
  // Phase A taxonomy — nearby-installers pairing.
  // service_category = which install this service row COVERS (set on
  // kind='service' rows only). Empty ⇒ not surfaceable to the
  // "Independent local trades" strip on any PDP.
  service_category: string;
  // install_service_category = which install typically PAIRS with
  // this product (set on kind='product' rows only). Empty ⇒ no
  // installer strip renders on this product's PDP.
  install_service_category: string;
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
  // VAT — UK trades with turnover ≥ £90k must be VAT registered. Three
  // controls map to two nullable DB columns: vat_registered=false ⇒ both
  // DB cols NULL; true ⇒ both DB cols populated. vat_inclusive picks
  // whether the displayed price already contains VAT; vat_rate_pct is
  // the rate as a string for the input control.
  vat_registered: boolean;
  vat_inclusive: boolean;
  vat_rate_pct: string;
  // UK install-services flow. 'stock' = traditional add-to-cart product;
  // 'install' = labour service that ends at "Request site visit" on the
  // PDP. Hidden in service-kind mode (services have their own buying flow).
  product_kind: "stock" | "install";
  // Category-driven Item Specifics (Phase 1) — picked once at the top
  // of the form. Drives which structured spec fields render in the
  // "Specifications" block below. Empty = legacy free-text mode (the
  // existing specs_text textarea takes over).
  category_slug: string;
  /** Stable per-field map keyed by spec.key (e.g. {weight: "25"}).
   *  Built into the saved {label, value}[] shape at submit time. */
  specs_map: Record<string, string | string[]>;
  // PDP tabbed-details payload. specs_text + features_text are line-
  // oriented textareas (one row per line; specs use "Label: Value"); the
  // submit step parses them into the array shapes the API/DB expect.
  // video_url is a YouTube link. All three optional — empty ⇒ NULL.
  specs_text: string;
  features_text: string;
  video_url: string;
  // Warranty + Returns overrides — null in DB ⇒ empty string here. Render
  // a helper below each textarea ("Leave blank to use the default copy").
  // warranty_header overrides the block heading (default "Warranty / Returns").
  // returns_text is deprecated — kept in FormState to keep the diff minimal,
  // but never rendered and always submitted as null.
  warranty_header: string;
  warranty_text: string;
  returns_text: string;
};

const EMPTY_FORM: FormState = {
  id: "",
  name: "",
  description: "",
  price_pounds: "",
  stock_count: "",
  dispatch_days: "",
  warranty_years: "",
  service_category: "",
  install_service_category: "",
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
  size_chart_unit: "",
  vat_registered: true,
  vat_inclusive: true,
  vat_rate_pct: "20",
  product_kind: "stock",
  category_slug: "",
  specs_map: {},
  specs_text: "",
  features_text: "",
  video_url: "",
  warranty_header: "",
  warranty_text: "",
  returns_text: ""
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
    warranty_years:
      p.warranty_years === null || p.warranty_years === undefined
        ? ""
        : String(p.warranty_years),
    service_category: p.service_category ?? "",
    install_service_category: p.install_service_category ?? "",
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
    size_chart_unit: p.size_chart_unit ?? "",
    vat_registered: p.vat_rate_pct !== null,
    vat_inclusive: p.vat_inclusive ?? true,
    vat_rate_pct: p.vat_rate_pct === null ? "20" : String(p.vat_rate_pct),
    product_kind: p.product_kind ?? "stock",
    // Pre-fill the structured category + specs_map from the existing
    // product. category column stores the slug from PRODUCT_CATEGORIES
    // when picked through the new dropdown; legacy free-text values
    // (e.g. "Gardening") simply don't match a category and fall through
    // as an empty slug (the merchant can pick one when they edit).
    category_slug: (() => {
      const raw = typeof p.category === "string" ? p.category.trim().toLowerCase() : "";
      return categoryBySlug(raw) ? raw : "";
    })(),
    specs_map: (() => {
      const slug = typeof p.category === "string" ? p.category.trim().toLowerCase() : "";
      const cat = categoryBySlug(slug);
      const saved = Array.isArray(p.specs) ? p.specs : [];
      return cat ? savedToSpecMap(cat, saved) : {};
    })(),
    specs_text: Array.isArray(p.specs)
      ? p.specs.map((s) => `${s.label}: ${s.value}`).join("\n")
      : "",
    features_text: Array.isArray(p.features) ? p.features.join("\n") : "",
    video_url: p.video_url ?? "",
    warranty_header: p.warranty_header ?? "",
    warranty_text: p.warranty_text ?? "",
    returns_text: p.returns_text ?? ""
  };
}

// Parse a multi-line spec textarea into the {label, value} rows the
// DB stores. Lines without a colon are skipped (the editor's helper
// copy tells the trade to use "Label: Value" formatting). Whitespace
// is trimmed on both halves.
function parseSpecsText(text: string): { label: string; value: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes(":"))
    .map((line) => {
      const idx = line.indexOf(":");
      const label = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      return { label, value };
    })
    .filter((row) => row.label.length > 0 && row.value.length > 0);
}

// Features are one bullet per non-empty line. Trim + drop blanks.
function parseFeaturesText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Loose YouTube URL check — the API does the strict validation but a
// cheap early bounce keeps the editor responsive.
function isYouTubeUrl(url: string): boolean {
  const t = url.trim();
  if (t.length === 0) return false;
  return /(youtube\.com|youtu\.be)/i.test(t);
}

// UK installation trades — these primary_trade slugs default new products
// to the install kind so a stair fitter doesn't have to manually pick
// "Install service" every time they add a row.
const INSTALL_TRADES = new Set(["stair-fitter", "kitchen-fitter"]);

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

export type LegalLinksInitial = {
  terms_url: string | null;
  privacy_url: string | null;
  returns_url: string | null;
  about_url: string | null;
};

export type RetailShippingInitial = {
  mode: "free" | "uk_flat" | "uk_areas" | null;
  uk_pence: number | null;
  uk_areas: RetailShippingArea[] | null;
  international: RetailShippingIntl[] | null;
};

export function ShopModeEditor({
  slug,
  editToken,
  initialProducts,
  kind = "product",
  primaryTrade,
  initialAddonsEnabled,
  initialPaymentMethods,
  initialLegalLinks,
  initialRetailShipping
}: {
  slug: string;
  editToken: string;
  initialProducts: HammerexXratedProduct[];
  /** Optional — current `addons_enabled` JSON from the listing. Used to
   *  seed the PDP-options toggles (compare section / Q&A). Omit when
   *  rendering the editor from a context where the listing isn't loaded
   *  yet; the toggles UI hides itself entirely in that case. */
  initialAddonsEnabled?: Record<string, boolean> | null;
  /** Optional — current listing.payment_methods array. Drives the
   *  PaymentsAcceptedPanel checkboxes. Omit on call-sites that don't
   *  load the listing row. */
  initialPaymentMethods?: string[] | null;
  /** Optional — current tradesperson-set legal URLs (Terms / Privacy /
   *  Returns / About). Drives the LegalLinksPanel; surfaced on the lean
   *  tradie footer. Omit when the editor is mounted without a listing
   *  row in scope — the panel hides itself in that case. */
  initialLegalLinks?: LegalLinksInitial | null;
  /** Optional — current retail-shipping config from the listing row.
   *  Drives the RetailShippingEditor; surfaced on the PDP. Omit when
   *  the editor is mounted without a listing row in scope — the panel
   *  hides itself in that case. */
  initialRetailShipping?: RetailShippingInitial | null;
  /** Switches the editor between Shop Mode (kind='product') and the
   *  Services Prices add-on (kind='service'). When 'service':
   *   – Header + row labels read "Service" instead of "Product".
   *   – Stock count + dispatch-day labels reshape ("Days from booking
   *     to first appointment", stock hidden — services never run out).
   *   – Unit becomes required & visible; category becomes visible.
   *   – Defaults persisted as service-rows so the public Services Grid
   *     picks them up. */
  kind?: "product" | "service";
  /** Optional — listing.primary_trade slug. Used only to set the default
   *  product_kind on new products: install-style trades (stair / kitchen
   *  fitters) default to 'install'; everyone else defaults to 'stock'.
   *  Omit for old call-sites — defaults to undefined which means 'stock'. */
  primaryTrade?: string;
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
        .map((p) => ({
          id: p.id,
          name: p.name,
          cover_url: p.cover_url ?? null
        })),
    [products, form.id]
  );

  function startCreate() {
    const defaultKind: "stock" | "install" =
      typeof primaryTrade === "string" && INSTALL_TRADES.has(primaryTrade)
        ? "install"
        : "stock";
    setForm({
      ...EMPTY_FORM,
      sort_order: String(products.length),
      product_kind: defaultKind
    });
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
    // Video URL — only YouTube links are accepted; the PDP embed expects
    // a parseable video id. Skip for service rows (no PDP tabs there).
    if (!isService && form.video_url.trim().length > 0 && !isYouTubeUrl(form.video_url)) {
      setErr("Video URL must be a YouTube link (youtube.com or youtu.be).");
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
      // Warranty — clamp 1-25 years (DB CHECK constraint). Empty ⇒ null
      // so the PDP's warranty timeline auto-hides for products without
      // a cover.
      const warN = form.warranty_years.trim().length === 0
        ? null
        : Math.max(1, Math.min(25, Math.round(Number(form.warranty_years))));
      const sortN = Number(form.sort_order);
      const product = {
        ...(form.id ? { id: form.id } : {}),
        kind,
        name: trimmedName.slice(0, 80),
        description: form.description.trim().slice(0, 1000),
        price_pence,
        stock_count: stockN === null || !Number.isFinite(stockN) || stockN < 0 ? null : Math.round(stockN),
        dispatch_days: dispN === null || !Number.isFinite(dispN) || dispN < 0 ? null : Math.round(dispN),
        warranty_years: warN === null || !Number.isFinite(warN) ? null : warN,
        // Phase A taxonomy — normalise to null when empty so the DB
        // stores a clean NULL rather than an empty string.
        service_category: isService
          ? (form.service_category.trim() || null)
          : null,
        install_service_category: !isService
          ? (form.install_service_category.trim() || null)
          : null,
        cover_url: form.cover_url.trim(),
        gallery_urls: form.gallery_urls.slice(0, 3),
        compare_with: form.compare_with.slice(0, 10),
        status: form.status,
        sort_order: Number.isFinite(sortN) && sortN >= 0 ? Math.round(sortN) : 0,
        unit: trimmedUnit.length > 0 ? trimmedUnit.slice(0, 32) : null,
        // Category — prefer the structured slug picked from the new
        // PRODUCT_CATEGORIES taxonomy (used by buyer-side facets);
        // fall back to the legacy free-text value if a service uses
        // the chip picker without a structured slug.
        category: (() => {
          const slug = form.category_slug.trim();
          if (slug.length > 0) return slug.slice(0, 40);
          return form.category.trim().length > 0
            ? form.category.trim().slice(0, 40)
            : null;
        })(),
        variants: variantsOut,
        size_chart_url: sizeChartUrl,
        size_chart_unit: sizeChartUrl.length > 0 ? form.size_chart_unit : null,
        vat_inclusive: form.vat_registered ? form.vat_inclusive : null,
        vat_rate_pct: form.vat_registered ? (parseFloat(form.vat_rate_pct) || 0) : null,
        // Products only — services have their own buying flow and the API
        // defaults to 'stock' if the field is missing.
        product_kind: isService ? "stock" : form.product_kind,
        // PDP tabbed-details payload. Empty array ⇒ null so the DB stores
        // a clean NULL rather than `[]` (the public PDP checks `?.length`,
        // both work, but NULL keeps the row tidy and surfaces in
        // information_schema queries as "unset" rather than "empty").
        ...(isService
          ? {
              specs: null,
              features: null,
              video_url: null,
              warranty_header: null,
              warranty_text: null,
              // returns_text is deprecated — always send null.
              returns_text: null
            }
          : (() => {
              // Merge the structured Item Specifics (from the picked
              // category dropdown) with any free-text rows the merchant
              // typed into the legacy "Additional specs" textarea.
              // Structured specs come first so they render on the PDP in
              // the order defined by productCategories.ts.
              const structuredCat = categoryBySlug(form.category_slug);
              const structured = structuredCat
                ? specMapToSaved(structuredCat, form.specs_map)
                : [];
              const freeText = parseSpecsText(form.specs_text);
              const specs = [...structured, ...freeText];
              const features = parseFeaturesText(form.features_text);
              const videoTrim = form.video_url.trim();
              const headerTrim = form.warranty_header.trim();
              const warrantyTrim = form.warranty_text.trim();
              return {
                specs: specs.length > 0 ? specs : null,
                features: features.length > 0 ? features : null,
                video_url: videoTrim.length > 0 ? videoTrim : null,
                warranty_header: headerTrim.length > 0 ? headerTrim.slice(0, 80) : null,
                warranty_text: warrantyTrim.length > 0 ? warrantyTrim.slice(0, 500) : null,
                // returns_text is deprecated — always send null going forward.
                returns_text: null
              };
            })())
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
      {/* Phase 3 — Featured products drag-picker. The 6 "front window"
          slots double as the public profile's ShopTeaser rail and the
          default sort on the /<slug>/shop storefront. Only renders in
          product-mode (services aren't surfaced on the storefront). */}
      {!isService && (
        <FeaturedProductsEditor
          products={products}
          slug={slug}
          editToken={editToken}
          onSaved={(savedRows) => {
            setProducts((prev) =>
              prev.map((p) => {
                const saved = savedRows.find((s) => s.id === p.id);
                return saved ? { ...p, featured_at: saved.featured_at } : p;
              })
            );
          }}
        />
      )}

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

      {mode === "list" && !isService && initialAddonsEnabled !== undefined && (
        <PdpOptionsPanel
          slug={slug}
          editToken={editToken}
          initialAddonsEnabled={initialAddonsEnabled ?? {}}
        />
      )}

      {mode === "list" && !isService && initialLegalLinks !== undefined && (
        <LegalLinksPanel
          slug={slug}
          editToken={editToken}
          initialLegalLinks={initialLegalLinks ?? null}
        />
      )}

      {mode === "list" && !isService && initialRetailShipping !== undefined && (
        <RetailShippingEditor
          slug={slug}
          editToken={editToken}
          initialMode={initialRetailShipping?.mode ?? null}
          initialUkPence={initialRetailShipping?.uk_pence ?? null}
          initialUkAreas={initialRetailShipping?.uk_areas ?? null}
          initialIntl={initialRetailShipping?.international ?? null}
        />
      )}

      {mode === "list" && !isService && (
        <PaymentsAcceptedPanel
          slug={slug}
          editToken={editToken}
          initialSelected={initialPaymentMethods ?? null}
        />
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

// Compact pair of toggles for PDP rendering preferences. Hits the
// dedicated /api/trade-off/addons/pdp-toggle endpoint so the main
// add-ons toggle route doesn't have to know about "settings" keys.
// Optimistic update + revert-on-error matches the AddOnsHub pattern.
function PdpOptionsPanel({
  slug,
  editToken,
  initialAddonsEnabled
}: {
  slug: string;
  editToken: string;
  initialAddonsEnabled: Record<string, boolean>;
}) {
  const [map, setMap] = useState<Record<string, boolean>>(initialAddonsEnabled);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Compare section defaults to ON when the key is absent.
  const compareOn = map.compare_section !== false;
  // Q&A defaults to OFF.
  const qaOn = map.qa === true;
  // Warranty & Returns block defaults to ON when the key is absent.
  const warrantyOn = map.warranty_returns !== false;
  // Spec tab on the PDP defaults to ON when the key is absent.
  const specTabOn = map.spec_tab !== false;
  // Delivery Details tab on the PDP defaults to ON when the key is absent.
  const deliveryTabOn = map.delivery_tab !== false;

  async function toggle(
    key:
      | "compare_section"
      | "qa"
      | "warranty_returns"
      | "spec_tab"
      | "delivery_tab",
    next: boolean
  ) {
    const prevVal =
      key === "compare_section"
        ? compareOn
        : key === "qa"
        ? qaOn
        : key === "warranty_returns"
        ? warrantyOn
        : key === "spec_tab"
        ? specTabOn
        : deliveryTabOn;
    setMap((m) => ({ ...m, [key]: next }));
    setBusyKey(key);
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/addons/pdp-toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, key, enabled: next })
      });
      const json = await res.json();
      if (!json.ok) {
        setMap((m) => ({ ...m, [key]: prevVal }));
        setErr(json.error ?? "Couldn't update.");
        return;
      }
      if (json.addons_enabled && typeof json.addons_enabled === "object") {
        setMap(json.addons_enabled as Record<string, boolean>);
      }
    } catch {
      setMap((m) => ({ ...m, [key]: prevVal }));
      setErr("Network error — try again.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="rounded-lg border border-brand-line bg-brand-bg p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">
        Product page options
      </p>
      <ul className="mt-2 space-y-2">
        <li className="flex items-start gap-3 rounded-md border border-brand-line bg-brand-surface px-3 py-2">
          <input
            id="pdp-toggle-compare"
            type="checkbox"
            checked={compareOn}
            disabled={busyKey === "compare_section"}
            onChange={(e) => toggle("compare_section", e.target.checked)}
            className="mt-1 h-5 w-5 accent-brand-accent"
          />
          <label htmlFor="pdp-toggle-compare" className="flex-1 cursor-pointer">
            <span className="block text-[13px] font-extrabold text-brand-text">
              Show compare section on product pages
            </span>
            <span className="block text-[13px] text-brand-muted">
              Side-by-side panel comparing this product against two others
              you sell. On by default.
            </span>
          </label>
        </li>
        <li className="flex items-start gap-3 rounded-md border border-brand-line bg-brand-surface px-3 py-2">
          <input
            id="pdp-toggle-qa"
            type="checkbox"
            checked={qaOn}
            disabled={busyKey === "qa"}
            onChange={(e) => toggle("qa", e.target.checked)}
            className="mt-1 h-5 w-5 accent-brand-accent"
          />
          <label htmlFor="pdp-toggle-qa" className="flex-1 cursor-pointer">
            <span className="block text-[13px] font-extrabold text-brand-text">
              Show Q&amp;A on product pages
            </span>
            <span className="block text-[13px] text-brand-muted">
              Recommend if you respond to WhatsApp quickly. Off by default.
            </span>
          </label>
        </li>
        <li className="flex items-start gap-3 rounded-md border border-brand-line bg-brand-surface px-3 py-2">
          <input
            id="pdp-toggle-warranty"
            type="checkbox"
            checked={warrantyOn}
            disabled={busyKey === "warranty_returns"}
            onChange={(e) => toggle("warranty_returns", e.target.checked)}
            className="mt-1 h-5 w-5 accent-brand-accent"
          />
          <label htmlFor="pdp-toggle-warranty" className="flex-1 cursor-pointer">
            <span className="block text-[13px] font-extrabold text-brand-text">
              Show warranty &amp; returns block on product pages
            </span>
            <span className="block text-[13px] text-brand-muted">
              Standalone trust block with 1-year guarantee, 14-day returns
              and a faulty-items message. On by default.
            </span>
          </label>
        </li>
        <li className="flex items-start gap-3 rounded-md border border-brand-line bg-brand-surface px-3 py-2">
          <input
            id="pdp-toggle-spec"
            type="checkbox"
            checked={specTabOn}
            disabled={busyKey === "spec_tab"}
            onChange={(e) => toggle("spec_tab", e.target.checked)}
            className="mt-1 h-5 w-5 accent-brand-accent"
          />
          <label htmlFor="pdp-toggle-spec" className="flex-1 cursor-pointer">
            <span className="block text-[13px] font-extrabold text-brand-text">
              Show Spec tab on product pages
            </span>
            <span className="block text-[13px] text-brand-muted">
              Pulls from the Specifications you set per product. Hidden when
              you have no specs to show. On by default.
            </span>
          </label>
        </li>
        <li className="flex items-start gap-3 rounded-md border border-brand-line bg-brand-surface px-3 py-2">
          <input
            id="pdp-toggle-delivery"
            type="checkbox"
            checked={deliveryTabOn}
            disabled={busyKey === "delivery_tab"}
            onChange={(e) => toggle("delivery_tab", e.target.checked)}
            className="mt-1 h-5 w-5 accent-brand-accent"
          />
          <label htmlFor="pdp-toggle-delivery" className="flex-1 cursor-pointer">
            <span className="block text-[13px] font-extrabold text-brand-text">
              Show Delivery Details tab on product pages
            </span>
            <span className="block text-[13px] text-brand-muted">
              Small fact grid — dispatch days, ships-from city, returns,
              delivery cost &amp; tracking. Honest about WhatsApp coordination.
              On by default.
            </span>
          </label>
        </li>
      </ul>
      {err && (
        <p className="mt-2 text-[13px] font-semibold text-red-300">{err}</p>
      )}
    </div>
  );
}

// LegalLinksPanel — 4 URL inputs (Terms / Privacy / Returns / About)
// surfaced on the lean tradie footer (TradeProfileFooter). Each field
// saves on blur with an 800 ms debounce while typing; empty input clears
// the field (saved as NULL). Optimistic UI: local state updates
// instantly, the API confirms in the background. Hits
// /api/trade-off/listings/legal-links.
function LegalLinksPanel({
  slug,
  editToken,
  initialLegalLinks
}: {
  slug: string;
  editToken: string;
  initialLegalLinks: LegalLinksInitial | null;
}) {
  const FIELDS = [
    { key: "terms_url", label: "Terms & Conditions URL" },
    { key: "privacy_url", label: "Privacy Policy URL" },
    { key: "returns_url", label: "Returns & Refunds URL" },
    { key: "about_url", label: "About page URL" }
  ] as const;
  type Key = (typeof FIELDS)[number]["key"];

  const seed: Record<Key, string> = {
    terms_url: initialLegalLinks?.terms_url ?? "",
    privacy_url: initialLegalLinks?.privacy_url ?? "",
    returns_url: initialLegalLinks?.returns_url ?? "",
    about_url: initialLegalLinks?.about_url ?? ""
  };
  const [values, setValues] = useState<Record<Key, string>>(seed);
  const [busyKey, setBusyKey] = useState<Key | null>(null);
  const [savedKey, setSavedKey] = useState<Key | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timersRef = useRef<Partial<Record<Key, ReturnType<typeof setTimeout>>>>({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const k of Object.keys(timers) as Key[]) {
        const t = timers[k];
        if (t) clearTimeout(t);
      }
    };
  }, []);

  async function persist(key: Key, value: string) {
    setBusyKey(key);
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/listings/legal-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          [key]: value.trim()
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Couldn't save.");
        return;
      }
      setSavedKey(key);
      setTimeout(() => {
        setSavedKey((s) => (s === key ? null : s));
      }, 1500);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusyKey((b) => (b === key ? null : b));
    }
  }

  function onChange(key: Key, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    const existing = timersRef.current[key];
    if (existing) clearTimeout(existing);
    timersRef.current[key] = setTimeout(() => {
      persist(key, value);
    }, 800);
  }

  function onBlur(key: Key) {
    const existing = timersRef.current[key];
    if (existing) {
      clearTimeout(existing);
      timersRef.current[key] = undefined;
    }
    persist(key, values[key]);
  }

  return (
    <div className="rounded-lg border border-brand-line bg-brand-bg p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">
        Legal &amp; company links
      </p>
      <p className="mt-1 text-[13px] text-brand-muted">
        Surfaced on the footer of every customer-facing page on your profile.
      </p>
      <ul className="mt-3 space-y-3">
        {FIELDS.map((f) => (
          <li key={f.key}>
            <label
              htmlFor={`legal-${f.key}`}
              className="block text-[13px] font-extrabold text-brand-text"
            >
              {f.label}
            </label>
            <input
              id={`legal-${f.key}`}
              type="url"
              inputMode="url"
              placeholder="https://..."
              value={values[f.key]}
              onChange={(e) => onChange(f.key, e.target.value)}
              onBlur={() => onBlur(f.key)}
              maxLength={500}
              className="mt-1 block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none transition focus:border-brand-accent"
            />
            <p className="mt-1 text-[13px] text-brand-muted">
              Optional — leave blank to hide from your footer.
              {busyKey === f.key && " · Saving…"}
              {savedKey === f.key && " · Saved"}
            </p>
          </li>
        ))}
      </ul>
      {err && (
        <p className="mt-2 text-[13px] font-semibold text-red-300">{err}</p>
      )}
    </div>
  );
}

// PaymentsAcceptedPanel — listing-level checkbox grid for the
// PaymentIconsRow on the PDP. Persists to listing.payment_methods via
// /api/trade-off/payment-methods. Default = NULL (PDP renders the
// platform default set of 5).
function PaymentsAcceptedPanel({
  slug,
  editToken,
  initialSelected
}: {
  slug: string;
  editToken: string;
  initialSelected: string[] | null;
}) {
  const ALL = [
    { key: "visa", label: "Visa" },
    { key: "mastercard", label: "Mastercard" },
    { key: "amex", label: "American Express" },
    { key: "apple_pay", label: "Apple Pay" },
    { key: "google_pay", label: "Google Pay" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "cash", label: "Cash" },
    { key: "bank_transfer", label: "Bank transfer" }
  ] as const;

  // NULL on the server = "use defaults"; we seed the editor with the
  // explicit default set so the user can see what's on. The first save
  // captures the explicit selection.
  const DEFAULT_KEYS = ["visa", "mastercard", "amex", "apple_pay", "whatsapp"];
  const seed =
    Array.isArray(initialSelected) && initialSelected.length > 0
      ? initialSelected
      : DEFAULT_KEYS;

  const [selected, setSelected] = useState<string[]>(seed);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function isOn(k: string) {
    return selected.includes(k);
  }

  async function toggle(k: string) {
    const next = isOn(k) ? selected.filter((x) => x !== k) : [...selected, k];
    setSelected(next);
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/trade-off/payment-methods", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          payment_methods: next
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setSelected(selected);
        setErr(json.error ?? "Couldn't update.");
        return;
      }
      setMsg("Saved.");
      window.setTimeout(() => setMsg(null), 1600);
    } catch {
      setSelected(selected);
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-brand-line bg-brand-bg p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">
        Payments accepted
      </p>
      <p className="mt-1 text-[13px] text-brand-muted">
        Tick the payment surfaces you accept. They render as brand pills
        on every product page.
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ALL.map((m) => {
          const on = isOn(m.key);
          return (
            <li key={m.key}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition ${
                  on
                    ? "border-brand-accent bg-brand-accent/10"
                    : "border-brand-line bg-brand-surface"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={busy}
                  onChange={() => toggle(m.key)}
                  className="h-5 w-5 accent-brand-accent"
                />
                <span className="grid h-9 w-14 shrink-0 place-items-center rounded-md border border-brand-line bg-white">
                  <PaymentMethodMark k={m.key as PaymentMethodKey} />
                </span>
                <span className="text-[13px] font-extrabold text-brand-text">
                  {m.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {err && (
        <p className="mt-2 text-[13px] font-semibold text-red-300">{err}</p>
      )}
      {msg && (
        <p className="mt-2 text-[13px] font-semibold text-brand-accent">{msg}</p>
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
  compareOptions: { id: string; name: string; cover_url: string | null }[];
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

      {!isService && (
        <Field label="What is this?">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => update("product_kind", "stock")}
              className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-3 text-left transition ${
                form.product_kind === "stock"
                  ? "border-brand-accent bg-brand-accent/15 text-brand-accent"
                  : "border-brand-line bg-brand-bg text-brand-text hover:border-brand-accent"
              }`}
            >
              <span className="text-[13px] font-extrabold">Stock item</span>
              <span className="text-[13px] font-semibold text-brand-muted">
                Customer adds to cart
              </span>
            </button>
            <button
              type="button"
              onClick={() => update("product_kind", "install")}
              className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-3 text-left transition ${
                form.product_kind === "install"
                  ? "border-brand-accent bg-brand-accent/15 text-brand-accent"
                  : "border-brand-line bg-brand-bg text-brand-text hover:border-brand-accent"
              }`}
            >
              <span className="text-[13px] font-extrabold">Install service</span>
              <span className="text-[13px] font-semibold text-brand-muted">
                Customer books a site visit
              </span>
            </button>
          </div>
        </Field>
      )}

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

      {!isService && (
        <Field label="VAT">
          <div className="space-y-2">
            <label className="flex h-11 items-center gap-3 rounded-md border border-brand-line bg-brand-bg px-3">
              <input
                type="checkbox"
                checked={form.vat_registered}
                onChange={(e) => update("vat_registered", e.target.checked)}
                className="h-5 w-5 accent-brand-accent"
              />
              <span className="text-[13px] font-bold text-brand-text">
                VAT registered?
              </span>
            </label>
            <p className="text-[13px] text-brand-muted">
              Tick if you charge VAT on this product.
            </p>
            {form.vat_registered && (
              <>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => update("vat_inclusive", true)}
                    className={`inline-flex h-11 items-center rounded-full border px-4 text-[13px] font-bold transition ${
                      form.vat_inclusive
                        ? "border-brand-accent bg-brand-accent/15 text-brand-accent"
                        : "border-brand-line bg-brand-bg text-brand-text hover:border-brand-accent"
                    }`}
                  >
                    Price includes VAT
                  </button>
                  <button
                    type="button"
                    onClick={() => update("vat_inclusive", false)}
                    className={`inline-flex h-11 items-center rounded-full border px-4 text-[13px] font-bold transition ${
                      !form.vat_inclusive
                        ? "border-brand-accent bg-brand-accent/15 text-brand-accent"
                        : "border-brand-line bg-brand-bg text-brand-text hover:border-brand-accent"
                    }`}
                  >
                    Price excludes VAT
                  </button>
                </div>
                <label className="block pt-1">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                    VAT rate (%)
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    max="100"
                    value={form.vat_rate_pct}
                    onChange={(e) => update("vat_rate_pct", e.target.value)}
                    placeholder="20"
                    className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                  />
                </label>
              </>
            )}
          </div>
        </Field>
      )}

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
              className="block h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </div>
        </Field>
      )}

      {!isService && (
        <Field label="Category *">
          <div className="space-y-3">
            <p className="text-[12px] leading-snug text-brand-muted">
              Pick the closest category — drives the structured detail
              fields below and powers buyer-side search filters on your
              trade center page.
            </p>
            <select
              value={form.category_slug}
              onChange={(e) => {
                const next = e.target.value;
                const cat = categoryBySlug(next);
                update("category_slug", next);
                // Reset specs_map when the category changes — old keys
                // don't carry meaning under the new category's schema.
                update("specs_map", cat ? {} : form.specs_map);
              }}
              className="block h-11 w-full rounded-xl border border-brand-line bg-brand-surface px-3 text-[13px] font-bold text-brand-text outline-none focus:border-brand-accent"
            >
              <option value="">— Pick a category —</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            {form.category_slug && (
              <p className="text-[12px] leading-snug text-brand-muted">
                {categoryBySlug(form.category_slug)?.blurb}
              </p>
            )}
            {(() => {
              const cat = categoryBySlug(form.category_slug);
              if (!cat || cat.specs.length === 0) return null;
              return (
                <div className="rounded-xl border border-brand-line bg-brand-surface p-3 sm:p-4">
                  <p
                    className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em]"
                    style={{ color: "var(--trade-accent, #FFB300)" }}
                  >
                    Specifications · {cat.label}
                  </p>
                  <ItemSpecsForm
                    category={cat}
                    values={form.specs_map}
                    onChange={(next) => update("specs_map", next)}
                  />
                </div>
              );
            })()}
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
        {!isService && (
          <Field label="Warranty (years, optional)">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="25"
              value={form.warranty_years}
              onChange={(e) => update("warranty_years", e.target.value)}
              placeholder="e.g. 2"
              className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
            <p className="mt-1 text-[11px] text-brand-muted">
              Adds the warranty timeline block to the PDP. Leave blank
              if the item isn&apos;t covered.
            </p>
          </Field>
        )}
        {/* Phase A taxonomy — install pairing.
            For products: which install typically pairs with this SKU
            (adds a "get it fitted nearby" strip to the PDP).
            For services: which install this service row covers
            (surfaces this trade on matching product PDPs). */}
        {!isService && (
          <Field label="Typical install (optional)">
            <select
              value={form.install_service_category}
              onChange={(e) => update("install_service_category", e.target.value)}
              className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            >
              <option value="">Not applicable</option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-brand-muted">
              Pick when this product typically needs an install. The
              PDP will show independent local trades who offer that
              install (WhatsApp handoff, no vetting badge).
            </p>
          </Field>
        )}
        {isService && (
          <Field label="This service covers">
            <select
              value={form.service_category}
              onChange={(e) => update("service_category", e.target.value)}
              className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            >
              <option value="">Not tagged (won&apos;t surface on product PDPs)</option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-brand-muted">
              Tag this service so it surfaces on product PDPs whose
              seller marked them as needing this install.
            </p>
          </Field>
        )}
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
      {!isService && (
        <p className="-mt-2 text-[13px] text-brand-muted">
          Set dispatch to 1 or 2 for the FAST badge.
        </p>
      )}

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

      {/* Optional product details — powers the PDP tabbed panel. Specs +
          features ship as line-oriented textareas (simpler than per-row
          repeaters for v1). Video URL is any YouTube link. All three
          empty ⇒ the PDP just shows Description + Ref tabs. */}
      {!isService && (
        <CollapsibleSection
          title="Optional product details"
          subtitle={(() => {
            const bits: string[] = [];
            const sCount = parseSpecsText(form.specs_text).length;
            const fCount = parseFeaturesText(form.features_text).length;
            if (sCount > 0) bits.push(`${sCount} spec${sCount === 1 ? "" : "s"}`);
            if (fCount > 0) bits.push(`${fCount} feature${fCount === 1 ? "" : "s"}`);
            if (form.video_url.trim().length > 0) bits.push("video");
            return bits.length === 0 ? "Off" : bits.join(" · ");
          })()}
        >
          <div className="space-y-4">
            <Field label="Specs (optional)">
              <textarea
                value={form.specs_text}
                onChange={(e) => update("specs_text", e.target.value)}
                rows={4}
                placeholder={"Material: Solid oak\nWeight: 1.4kg\nFinish: Beeswax"}
                className="block w-full rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
              />
              <p className="mt-1 text-[13px] text-brand-muted">
                One spec per line, format: &ldquo;Material: Solid oak&rdquo;.
                Lines without a colon are ignored.
              </p>
            </Field>

            <Field label="Features (optional)">
              <textarea
                value={form.features_text}
                onChange={(e) => update("features_text", e.target.value)}
                rows={4}
                placeholder={"Fully insured installation\nNo callout fee\n2-year guarantee"}
                className="block w-full rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
              />
              <p className="mt-1 text-[13px] text-brand-muted">
                One feature per line. e.g. &ldquo;Fully insured installation&rdquo;.
              </p>
            </Field>

            <Field label="Video URL (optional)">
              <input
                type="url"
                value={form.video_url}
                maxLength={300}
                onChange={(e) => update("video_url", e.target.value)}
                placeholder="https://youtu.be/…"
                className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
              />
              <p className="mt-1 text-[13px] text-brand-muted">
                Optional YouTube link. Renders as a Video tab on the PDP.
              </p>
            </Field>

            {/* Warranty / Returns block on the PDP — single-container layout.
                warranty_header overrides the heading ("Warranty / Returns"),
                warranty_text overrides the body. Both NULL ⇒ defaults render.
                Header capped at 80 chars, body at 500 chars by the upsert API.
                returns_text is deprecated — no longer rendered as a field. */}
            <Field label="Warranty / Returns header (optional)">
              <input
                type="text"
                value={form.warranty_header}
                maxLength={80}
                onChange={(e) => update("warranty_header", e.target.value)}
                placeholder="Warranty / Returns"
                className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
              />
              <p className="mt-1 text-[13px] text-brand-muted">
                Leave blank to use the default header.
              </p>
            </Field>

            <Field label="Warranty / Returns body (optional)">
              <textarea
                value={form.warranty_text}
                maxLength={500}
                onChange={(e) => update("warranty_text", e.target.value)}
                rows={4}
                placeholder="Each product carries its manufacturer's own warranty and return window. Unused items in original packaging can be returned within that window for a full refund. Faulty products — we handle the manufacturer claim direct."
                className="block w-full rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
              />
              <p className="mt-1 text-[13px] text-brand-muted">
                Leave blank to use the default text.
              </p>
            </Field>
          </div>
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

      {/* Phase 7b — pairs-with editor. Only renders once the product
          row exists so the anchor id is stable; hidden for services
          (they don't ship products the buyer can bolt-on to). */}
      {mode === "edit" && !isService && form.id && (
        <PairsWithEditor
          slug={slug}
          editToken={editToken}
          productId={form.id}
          siblings={compareOptions}
        />
      )}

      {/* Phase 8b — in-the-box bento editor. Same gate as pairs-with. */}
      {mode === "edit" && !isService && form.id && (
        <WhatInBoxEditor
          slug={slug}
          editToken={editToken}
          productId={form.id}
        />
      )}

      {/* Phase 9b — Q&A merchant reply editor. Shows every question
          shoppers have asked, badges pending count, inline reply form
          per question. Same product-row-must-exist gate. */}
      {mode === "edit" && form.id && (
        <QAEditor
          slug={slug}
          editToken={editToken}
          productId={form.id}
        />
      )}

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
const FEATURED_SLOTS = 6;

function FeaturedProductsEditor({
  products,
  slug,
  editToken,
  onSaved
}: {
  products: HammerexXratedProduct[];
  slug: string;
  editToken: string;
  onSaved: (saved: { id: string; featured_at: string | null }[]) => void;
}) {
  // Filter to live products only — archived rows can't be featured.
  const live = useMemo(
    () => products.filter((p) => p.status === "live" && (p.kind ?? "product") === "product"),
    [products]
  );
  // Derive the initial featured order from featured_at DESC (newest
  // pick first) so re-opening the editor matches what the public page
  // shows. Pad with empty slots up to FEATURED_SLOTS.
  const initialFeaturedIds = useMemo(() => {
    return live
      .filter((p) => p.featured_at)
      .sort((a, b) => {
        const ta = a.featured_at ? Date.parse(a.featured_at) : 0;
        const tb = b.featured_at ? Date.parse(b.featured_at) : 0;
        return tb - ta;
      })
      .slice(0, FEATURED_SLOTS)
      .map((p) => p.id);
  }, [live]);

  const [featuredIds, setFeaturedIds] = useState<string[]>(initialFeaturedIds);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Re-sync when the underlying products list refreshes (after a save
  // elsewhere in the editor) — keeps the slots in sync without forcing
  // a page reload.
  useEffect(() => {
    setFeaturedIds(initialFeaturedIds);
  }, [initialFeaturedIds]);

  const featuredSet = new Set(featuredIds);
  const pool = live.filter((p) => !featuredSet.has(p.id));

  const productById = useMemo(() => {
    const m: Record<string, HammerexXratedProduct> = {};
    for (const p of live) m[p.id] = p;
    return m;
  }, [live]);

  function pick(id: string) {
    if (featuredIds.length >= FEATURED_SLOTS) {
      setErr(`Only ${FEATURED_SLOTS} featured slots — drop one first.`);
      return;
    }
    if (featuredSet.has(id)) return;
    setErr(null);
    setFeaturedIds((prev) => [...prev, id]);
  }
  function drop(id: string) {
    setErr(null);
    setFeaturedIds((prev) => prev.filter((x) => x !== id));
  }
  function clearAll() {
    setErr(null);
    setFeaturedIds([]);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      // Diff: rows that are now featured but weren't, plus rows that
      // were featured but aren't. We POST each one separately to the
      // existing /upsert route since that already handles auth + slug
      // backfill + collision retry.
      const wantFeatured = new Set(featuredIds);
      const wereFeatured = new Set(
        live.filter((p) => p.featured_at).map((p) => p.id)
      );
      const toFeature: string[] = [];
      const toUnfeature: string[] = [];
      for (const id of wantFeatured) {
        if (!wereFeatured.has(id)) toFeature.push(id);
      }
      for (const id of wereFeatured) {
        if (!wantFeatured.has(id)) toUnfeature.push(id);
      }
      const ops = [
        ...toFeature.map((id) => ({ id, featured: true })),
        ...toUnfeature.map((id) => ({ id, featured: false }))
      ];
      if (ops.length === 0) {
        setMsg("No changes to save.");
        return;
      }
      const saved: { id: string; featured_at: string | null }[] = [];
      for (const op of ops) {
        const product = productById[op.id];
        if (!product) continue;
        const res = await fetch("/api/trade-off/products/upsert", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug,
            edit_token: editToken,
            product: {
              id: product.id,
              name: product.name,
              description: product.description ?? "",
              price_pence: product.price_pence,
              stock_count: product.stock_count,
              dispatch_days: product.dispatch_days,
              cover_url: product.cover_url ?? "",
              gallery_urls: product.gallery_urls ?? [],
              compare_with: product.compare_with ?? [],
              status: product.status,
              sort_order: product.sort_order,
              kind: product.kind ?? "product",
              unit: product.unit ?? "",
              category: product.category ?? "",
              variants: product.variants ?? [],
              size_chart_url: product.size_chart_url ?? "",
              size_chart_unit: product.size_chart_unit ?? "",
              bulk_tiers: product.bulk_tiers ?? [],
              featured: op.featured
            }
          })
        });
        const json = await res.json();
        if (!json.ok) {
          setErr(json.error ?? "Save failed mid-batch.");
          if (saved.length > 0) onSaved(saved);
          return;
        }
        saved.push({
          id: json.product.id,
          featured_at: json.product.featured_at ?? null
        });
      }
      onSaved(saved);
      setMsg(`Saved — ${saved.length} update${saved.length === 1 ? "" : "s"}.`);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  const sensors = useDragSensors();
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    // Pool → slot drop. Pool items have ids like "pool-<uuid>"; slots
    // have ids "slot-<index>" or "slot-empty-<index>". Featured rail
    // re-order: dragging a featured item onto another featured item
    // swaps positions.
    if (String(active.id).startsWith("pool-")) {
      const productId = String(active.id).replace(/^pool-/, "");
      if (overId.startsWith("slot-")) {
        pick(productId);
      }
      return;
    }
    if (String(active.id).startsWith("slot-")) {
      // Reorder within the featured rail.
      const fromIdx = featuredIds.findIndex((id) => `slot-${id}` === String(active.id));
      const toIdx = featuredIds.findIndex((id) => `slot-${id}` === overId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
      setFeaturedIds((prev) => arrayMove(prev, fromIdx, toIdx));
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand-accent/40 bg-brand-accent/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">
            Featured products
          </p>
          <h3 className="mt-1 text-base font-extrabold text-brand-text">
            Front window — pick up to {FEATURED_SLOTS}
          </h3>
          <p className="mt-1 text-[13px] text-brand-muted">
            Tap a product to feature it. These show first on your profile and
            at the top of your storefront.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save featured"}
        </button>
      </div>

      {err && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-md border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-xs font-semibold text-brand-accent">
          {msg}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          <SortableContext
            items={featuredIds.map((id) => `slot-${id}`)}
            strategy={horizontalListSortingStrategy}
          >
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: FEATURED_SLOTS }).map((_, i) => {
                const id = featuredIds[i];
                if (!id) {
                  return (
                    <EmptyFeaturedSlot
                      key={`empty-${i}`}
                      idx={i}
                    />
                  );
                }
                const product = productById[id];
                if (!product) return null;
                return (
                  <SortableFeaturedSlot
                    key={id}
                    product={product}
                    onRemove={() => drop(id)}
                  />
                );
              })}
            </ul>
          </SortableContext>

          {featuredIds.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex h-9 items-center text-[11px] font-bold text-brand-muted transition hover:text-brand-text"
            >
              Clear all featured
            </button>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
              Pool — drag (or tap) into a slot above
            </p>
            {pool.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-brand-line bg-brand-bg px-3 py-3 text-[13px] text-brand-muted">
                Every live product is featured. Drop a slot above to free one
                up.
              </p>
            ) : (
              <SortableContext
                items={pool.map((p) => `pool-${p.id}`)}
                strategy={horizontalListSortingStrategy}
              >
                <ul className="mt-2 flex flex-wrap gap-2">
                  {pool.map((p) => (
                    <SortablePoolItem
                      key={p.id}
                      product={p}
                      onPick={() => pick(p.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            )}
          </div>
        </div>
      </DndContext>
    </div>
  );
}

function EmptyFeaturedSlot({ idx }: { idx: number }) {
  const { setNodeRef, isOver } = useSortable({ id: `slot-empty-${idx}` });
  return (
    <li
      ref={setNodeRef}
      className={`flex h-24 items-center justify-center rounded-lg border-2 border-dashed text-[11px] font-bold transition ${
        isOver
          ? "border-brand-accent bg-brand-accent/15 text-brand-accent"
          : "border-brand-line bg-brand-bg text-brand-muted"
      }`}
      aria-label={`Featured slot ${idx + 1} (empty)`}
    >
      Slot {idx + 1}
    </li>
  );
}

function SortableFeaturedSlot({
  product,
  onRemove
}: {
  product: HammerexXratedProduct;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `slot-${product.id}`
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
      className="relative flex h-24 items-center gap-2 rounded-lg border border-brand-accent bg-brand-bg p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${product.name}`}
        className="flex h-full w-12 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-brand-line bg-brand-surface text-brand-muted transition hover:border-brand-accent hover:text-brand-accent active:cursor-grabbing"
      >
        <DragHandleIcon />
      </button>
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-brand-line bg-brand-surface">
        {product.cover_url ? (
          <img src={product.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-brand-muted">
            None
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-bold text-brand-text">
          {product.name}
        </p>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${product.name} from featured`}
          className="mt-1 inline-flex h-7 items-center rounded-md border border-red-500/40 bg-red-500/5 px-2 text-[11px] font-bold text-red-300 transition hover:bg-red-500/15"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

function SortablePoolItem({
  product,
  onPick
}: {
  product: HammerexXratedProduct;
  onPick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `pool-${product.id}`
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
      className="inline-flex items-center gap-2 rounded-lg border border-brand-line bg-brand-bg p-1.5 pr-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${product.name} into a featured slot`}
        className="inline-flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-brand-line bg-brand-surface text-brand-muted transition hover:border-brand-accent hover:text-brand-accent active:cursor-grabbing"
      >
        <DragHandleIcon />
      </button>
      <button
        type="button"
        onClick={onPick}
        className="flex items-center gap-2 text-left"
        aria-label={`Feature ${product.name}`}
      >
        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-brand-line bg-brand-surface">
          {product.cover_url ? (
            <img src={product.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="block h-full w-full bg-brand-bg" />
          )}
        </span>
        <span className="line-clamp-1 max-w-[180px] text-[13px] font-bold text-brand-text">
          {product.name}
        </span>
      </button>
    </li>
  );
}
