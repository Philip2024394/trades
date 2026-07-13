"use client";

// Merchant product editor form. Mobile-first single column, expands to a
// two-column layout at md+. Powers create ("new" id) + edit of an
// existing canteen product.
//
// Images: uploaded from device via /api/trade-off/canteen-product/upload-image.
// No editorial rules per ADR-0007 — any image the merchant has ships.
//
// Variants: single-axis (size OR color) or two-axis (size + color). Size
// presets cover shoes/clothes/numeric/trade-length; custom lets the
// merchant type their own labels.
//
// Three visibility toggles gate which surfaces the product appears on —
// the "upload once, flow to 3 surfaces" model. Tier gates render an
// upgrade CTA over locked toggles instead of disabling them.

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  Plus,
  X,
  ImageIcon,
  Store,
  Flame,
  ShoppingBag,
  Lock,
  Upload,
  Palette,
  Ruler,
  Truck,
  Layers,
  Zap,
  Info,
  Package,
  Undo2,
  Wrench,
  AlertTriangle,
  Tag,
  Video,
  PlayCircle,
  Receipt,
  PoundSterling,
  ArrowDownRight
} from "lucide-react";
import { PRODUCT_CATEGORIES, categoryBySlug, specsByStatus } from "@/lib/productCategories";
import { ImageCropSheet } from "@/components/shared/ImageCropSheet";

// ─── Types kept in sync with src/lib/canteens.ts ────────────

type SizePreset =
  | "uk_shoes"
  | "eu_shoes"
  | "uk_clothes"
  | "us_clothes"
  | "numeric"
  | "trade_length"
  | "custom";

type ProductVariants = {
  axis: "size" | "color" | "size_color";
  sizePreset?: SizePreset;
  sizeOptions?: string[];
  colorOptions?: { name: string; hex?: string }[];
  overrides?: Record<string, VariantOverride>;
};

type VariantOverride = {
  sku?: string;
  imageUrl?: string;
  priceGbp?: number;
  stock?: number;
  mpn?: string;
  gtin?: string;
};

const SIZE_PRESETS: Record<SizePreset, string[]> = {
  uk_shoes:     ["6", "7", "8", "9", "10", "11", "12"],
  eu_shoes:     ["39", "40", "41", "42", "43", "44", "45", "46"],
  uk_clothes:   ["XS", "S", "M", "L", "XL", "XXL"],
  us_clothes:   ["XS", "S", "M", "L", "XL", "XXL"],
  numeric:      ["30", "32", "34", "36", "38"],
  trade_length: ["1m", "2m", "2.4m", "3m", "4m"],
  custom:       []
};

const SIZE_PRESET_LABELS: Record<SizePreset, string> = {
  uk_shoes:     "UK shoe sizes",
  eu_shoes:     "EU shoe sizes",
  uk_clothes:   "UK clothing (S–XXL)",
  us_clothes:   "US clothing (S–XXL)",
  numeric:      "Numeric (30–38)",
  trade_length: "Trade lengths (1m–4m)",
  custom:       "Custom labels"
};

// ─── Types ──────────────────────────────────────────────────

export type ProductCondition =
  | "new"
  | "new-other"
  | "certified-refurbished"
  | "seller-refurbished"
  | "used"
  | "for-parts";

const CONDITION_LABELS: Record<ProductCondition, string> = {
  "new": "New",
  "new-other": "New — other",
  "certified-refurbished": "Certified refurbished",
  "seller-refurbished": "Seller refurbished",
  "used": "Used",
  "for-parts": "For parts / not working"
};

export type ProductCommerce = {
  brand?: string;
  model?: string;
  mpn?: string;
  gtin?: string;
  yearMade?: number;
  condition?: ProductCondition;
  conditionDescription?: string;
  countryOfOrigin?: string;
  warranty?: string;
  weightKg?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  dispatchDays?: number;
  returns?: {
    accepted: boolean;
    windowDays?: 14 | 30 | 60;
    paidBy?: "buyer" | "seller";
    restockingFeePercent?: number;
  };
  compatibility?: { label: string; value: string }[];
  ageRestriction?: 16 | 18 | null;
  shipping?: {
    freeLocalShipping?: boolean;
    localShippingGbp?: number;
    shipsInternationally?: boolean;
    internationalRates?: { country: string; priceGbp: number }[];
  };
  multiBuy?: {
    enabled: boolean;
    model: "tiered" | "additive";
    tiers?: { qty: number; unitPriceGbp: number }[];
    additive?: { secondUnitDiscountGbp: number; thirdPlusUnitDiscountGbp: number };
    deliveryModel: "single" | "per-item";
  };
  electrical?: {
    voltage?: string;
    wattage?: string;
    amps?: string;
    plugType?: string;
    certification?: string;
  };
};

export type ProductEditorInitial = {
  id: string;
  name: string;
  blurb: string;
  description: string;
  imageUrl: string;
  galleryUrls: string[];
  /** Uploaded video URLs. Each capped at 60s / 150MB by the upload
   *  endpoint. Number of videos gated by merchant tier + credit packs. */
  videoUrls: string[];
  priceGbp: number;
  currency: "GBP" | "USD" | "EUR" | "AUD" | "CAD";
  specs: string[];
  tradeCenterListingId: string | null;
  showInCanteenProducts: boolean;
  showInTrending: boolean;
  showInTradeCenter: boolean;
  featured: boolean;
  variants: ProductVariants | null;
  commerce: ProductCommerce | null;
  categorySlug: string;
  categoryAspects: Record<string, string | number>;
};

// Two-letter ISO countries commonly asked for by UK trade merchants.
// Merchant can add any country they ship to; this list just seeds the
// picker. Sorted with UK + Ireland first (closest markets).
const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: "IE", label: "Ireland" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "NL", label: "Netherlands" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "PT", label: "Portugal" },
  { code: "BE", label: "Belgium" },
  { code: "PL", label: "Poland" },
  { code: "CH", label: "Switzerland" },
  { code: "SE", label: "Sweden" },
  { code: "NO", label: "Norway" },
  { code: "DK", label: "Denmark" },
  { code: "AT", label: "Austria" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SG", label: "Singapore" }
];
const COUNTRY_LABEL: Record<string, string> = Object.fromEntries(
  COUNTRY_OPTIONS.map((c) => [c.code, c.label])
);

// Origin countries — where products are commonly made. UK first, then
// the usual manufacturing suspects for construction goods.
const ORIGIN_OPTIONS: { code: string; label: string }[] = [
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "DE", label: "Germany" },
  { code: "IT", label: "Italy" },
  { code: "PL", label: "Poland" },
  { code: "TR", label: "Turkey" },
  { code: "CN", label: "China" },
  { code: "VN", label: "Vietnam" },
  { code: "IN", label: "India" },
  { code: "US", label: "United States" },
  { code: "SE", label: "Sweden" }
];

export type MerchantTier = "free" | "canteen" | "marketplace" | "works";

type SurfaceMeta = {
  key: "canteen" | "trending" | "trade_center";
  title: string;
  detail: string;
  requiredTier: MerchantTier;
  icon: React.ReactNode;
};

const SURFACES: SurfaceMeta[] = [
  {
    key: "canteen",
    title: "Show on your canteen page",
    detail: "Appears in the Products tab on thenetworkers.app/{your-slug}. Every tier.",
    requiredTier: "free",
    icon: <Store size={16} strokeWidth={2.2}/>
  },
  {
    key: "trending",
    title: "Show in the trending swipe sheet",
    detail: "Appears in the Instagram-style swipe view when a homeowner taps a category tile on your mobile app.",
    requiredTier: "canteen",
    icon: <Flame size={16} strokeWidth={2.2}/>
  },
  {
    key: "trade_center",
    title: "List on Trade Center marketplace",
    detail: "Cross-lists on the marketplace with 'Buy on Trade Center' checkout. Requires a Trade Center listing id.",
    requiredTier: "marketplace",
    icon: <ShoppingBag size={16} strokeWidth={2.2}/>
  }
];

const TIER_RANK: Record<MerchantTier, number> = {
  free: 0,
  canteen: 1,
  marketplace: 2,
  works: 3
};

function isUnlocked(surface: SurfaceMeta, tier: MerchantTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[surface.requiredTier];
}

// ─── Component ──────────────────────────────────────────────

export function ProductEditorForm({
  slug,
  editToken,
  initial,
  isNew,
  merchantTier
}: {
  slug: string;
  editToken: string;
  initial: ProductEditorInitial;
  isNew: boolean;
  merchantTier: MerchantTier;
}) {
  const router = useRouter();

  const [name, setName] = useState(initial.name);
  const [blurb, setBlurb] = useState(initial.blurb);
  const [description, setDescription] = useState(initial.description);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [galleryUrls, setGalleryUrls] = useState<string[]>(initial.galleryUrls);
  const [videoUrls, setVideoUrls] = useState<string[]>(initial.videoUrls ?? []);
  const [priceGbp, setPriceGbp] = useState<string>(String(initial.priceGbp || ""));
  const [specs, setSpecs] = useState<string[]>(initial.specs);
  const [tradeCenterListingId, setTradeCenterListingId] = useState(initial.tradeCenterListingId ?? "");
  const [showInCanteenProducts, setShowInCanteenProducts] = useState(initial.showInCanteenProducts);
  const [showInTrending, setShowInTrending] = useState(initial.showInTrending);
  const [showInTradeCenter, setShowInTradeCenter] = useState(initial.showInTradeCenter);
  const [featured, setFeatured] = useState(initial.featured);

  // Variants state — we split axis + preset + options for form ergonomics
  // and reassemble on save.
  const [variantsEnabled, setVariantsEnabled] = useState<boolean>(!!initial.variants);
  const [variantAxis, setVariantAxis] = useState<ProductVariants["axis"]>(
    initial.variants?.axis ?? "size"
  );
  const [sizePreset, setSizePreset] = useState<SizePreset>(
    initial.variants?.sizePreset ?? "uk_clothes"
  );
  const [sizeOptions, setSizeOptions] = useState<string[]>(
    initial.variants?.sizeOptions ?? SIZE_PRESETS.uk_clothes
  );
  const [colorOptions, setColorOptions] = useState<{ name: string; hex?: string }[]>(
    initial.variants?.colorOptions ?? []
  );
  const [variantOverrides, setVariantOverrides] = useState<Record<string, VariantOverride>>(
    initial.variants?.overrides ?? {}
  );

  // ─── Commerce state ─────────────────────────────────────
  const c0 = initial.commerce ?? {};
  const [brand, setBrand] = useState<string>(c0.brand ?? "");
  const [yearMade, setYearMade] = useState<string>(c0.yearMade ? String(c0.yearMade) : "");
  const [condition, setCondition] = useState<ProductCondition | "">(c0.condition ?? "");
  const [countryOfOrigin, setCountryOfOrigin] = useState<string>(c0.countryOfOrigin ?? "");
  const [warranty, setWarranty] = useState<string>(c0.warranty ?? "");

  const [freeLocalShipping, setFreeLocalShipping] = useState<boolean>(c0.shipping?.freeLocalShipping ?? false);
  const [localShippingGbp, setLocalShippingGbp] = useState<string>(
    c0.shipping?.localShippingGbp ? String(c0.shipping.localShippingGbp) : ""
  );
  const [shipsInternationally, setShipsInternationally] = useState<boolean>(c0.shipping?.shipsInternationally ?? false);
  const [intlRates, setIntlRates] = useState<{ country: string; priceGbp: string }[]>(
    (c0.shipping?.internationalRates ?? []).map((r) => ({ country: r.country, priceGbp: String(r.priceGbp) }))
  );

  // VAT position — how the listed price relates to VAT. Default is
  // "not_registered" because the majority of UK trades are under the
  // £90k HMRC threshold. UK standard rate is 20% (Jan 2011 onwards).
  const [vatPosition, setVatPosition] = useState<"include" | "exclude" | "not_registered">(
    (c0 as { vatPosition?: "include" | "exclude" | "not_registered" }).vatPosition ?? "not_registered"
  );

  const [multiBuyEnabled, setMultiBuyEnabled] = useState<boolean>(c0.multiBuy?.enabled ?? false);
  const [multiBuyModel, setMultiBuyModel] = useState<"tiered" | "additive">(c0.multiBuy?.model ?? "tiered");
  const [multiBuyTiers, setMultiBuyTiers] = useState<{ qty: string; unitPriceGbp: string }[]>(
    (c0.multiBuy?.tiers ?? [{ qty: 2, unitPriceGbp: 0 }, { qty: 3, unitPriceGbp: 0 }]).map((t) => ({
      qty: String(t.qty),
      unitPriceGbp: String(t.unitPriceGbp)
    }))
  );
  const [secondUnitDiscountGbp, setSecondUnitDiscountGbp] = useState<string>(
    c0.multiBuy?.additive?.secondUnitDiscountGbp ? String(c0.multiBuy.additive.secondUnitDiscountGbp) : ""
  );
  const [thirdPlusUnitDiscountGbp, setThirdPlusUnitDiscountGbp] = useState<string>(
    c0.multiBuy?.additive?.thirdPlusUnitDiscountGbp ? String(c0.multiBuy.additive.thirdPlusUnitDiscountGbp) : ""
  );
  const [deliveryModel, setDeliveryModel] = useState<"single" | "per-item">(c0.multiBuy?.deliveryModel ?? "single");

  const [electricalEnabled, setElectricalEnabled] = useState<boolean>(!!c0.electrical);
  const [voltage, setVoltage] = useState<string>(c0.electrical?.voltage ?? "");
  const [wattage, setWattage] = useState<string>(c0.electrical?.wattage ?? "");
  const [amps, setAmps] = useState<string>(c0.electrical?.amps ?? "");
  const [plugType, setPlugType] = useState<string>(c0.electrical?.plugType ?? "");
  const [certification, setCertification] = useState<string>(c0.electrical?.certification ?? "");

  // eBay-critical additions
  const [model, setModel] = useState<string>(c0.model ?? "");
  const [mpn, setMpn] = useState<string>(c0.mpn ?? "");
  const [gtin, setGtin] = useState<string>(c0.gtin ?? "");
  const [conditionDescription, setConditionDescription] = useState<string>(c0.conditionDescription ?? "");
  const [weightKg, setWeightKg] = useState<string>(c0.weightKg ? String(c0.weightKg) : "");
  const [lengthMm, setLengthMm] = useState<string>(c0.lengthMm ? String(c0.lengthMm) : "");
  const [widthMm, setWidthMm] = useState<string>(c0.widthMm ? String(c0.widthMm) : "");
  const [heightMm, setHeightMm] = useState<string>(c0.heightMm ? String(c0.heightMm) : "");
  const [dispatchDays, setDispatchDays] = useState<string>(c0.dispatchDays != null ? String(c0.dispatchDays) : "1");
  const [returnsAccepted, setReturnsAccepted] = useState<boolean>(c0.returns?.accepted ?? true);
  const [returnsWindowDays, setReturnsWindowDays] = useState<14 | 30 | 60>(c0.returns?.windowDays ?? 30);
  const [returnsPaidBy, setReturnsPaidBy] = useState<"buyer" | "seller">(c0.returns?.paidBy ?? "buyer");
  const [restockingFeePercent, setRestockingFeePercent] = useState<string>(
    c0.returns?.restockingFeePercent ? String(c0.returns.restockingFeePercent) : ""
  );
  const [compatibility, setCompatibility] = useState<{ label: string; value: string }[]>(
    c0.compatibility ?? []
  );
  const [ageRestriction, setAgeRestriction] = useState<"none" | "16" | "18">(
    c0.ageRestriction === 16 ? "16" : c0.ageRestriction === 18 ? "18" : "none"
  );

  // Category + aspects
  const [categorySlug, setCategorySlug] = useState<string>(initial.categorySlug ?? "");
  const [categoryAspects, setCategoryAspects] = useState<Record<string, string | number>>(initial.categoryAspects ?? {});
  const activeCategory = useMemo(() => categoryBySlug(categorySlug), [categorySlug]);
  const aspectGroups = useMemo(() => activeCategory ? specsByStatus(activeCategory) : null, [activeCategory]);

  // Auto-suggest top-4 categories from the product name. Score is
  // token-hit count against the category label + blurb + spec labels +
  // dropdown option values. Zero-score categories are dropped. Ties
  // broken by taxonomy order (deterministic). Empty name → no
  // suggestions (dropdown-only mode).
  const suggestedCategories = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (q.length < 3) return [];
    const tokens = q.split(/[^a-z0-9]+/g).filter((t) => t.length >= 3);
    if (tokens.length === 0) return [];
    const scored = PRODUCT_CATEGORIES
      .filter((c) => c.slug !== "other")
      .map((c) => {
        // Build a haystack of every discoverable phrase in this category.
        const haystack: string[] = [c.label.toLowerCase(), c.blurb.toLowerCase()];
        for (const spec of c.specs) {
          haystack.push(spec.label.toLowerCase());
          if (spec.options) for (const o of spec.options) haystack.push(o.toLowerCase());
        }
        const combined = haystack.join(" ");
        let score = 0;
        for (const t of tokens) {
          if (combined.includes(t)) score += 1;
        }
        return { slug: c.slug, label: c.label, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    return scored;
  }, [name]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const mainInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  // Pre-upload crop editor state. When set, the ImageCropSheet renders
  // and the merchant frames the image before it's uploaded. Currently
  // only the main image goes through the crop sheet (that's the one
  // shown on TC cards); gallery uploads stay direct.
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  // ─── File upload ─────────────────────────────────────────

  async function uploadOne(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slug", slug);
    fd.append("edit_token", editToken);
    const res = await fetch("/api/trade-off/canteen-product/upload-image", {
      method: "POST",
      body: fd
    });
    const data = (await res.json()) as { ok: boolean; url?: string; error?: string; limitBytes?: number };
    if (!res.ok || !data.ok || !data.url) {
      if (data.error === "too_large") {
        setError("Image is too big (max 10 MB). Try a smaller file.");
      } else if (data.error === "not_an_image") {
        setError("That file isn't an image. Only jpg / png / webp / gif / avif work.");
      } else {
        setError("Upload failed. Please try again.");
      }
      return null;
    }
    return data.url;
  }

  async function onSelectMain(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Open the crop sheet — merchant frames the image before we upload.
    // "Use original" inside the sheet skips crop and uploads the file
    // as-is (existing behavior).
    setPendingCropFile(file);
    // Clear the input so re-selecting the same file re-triggers change.
    if (mainInputRef.current) mainInputRef.current.value = "";
  }

  async function uploadMainFromBlob(blob: Blob) {
    setUploadingMain(true);
    setError(null);
    try {
      // Wrap the blob in a File for the multipart uploader — the
      // endpoint expects a `file` field with a filename + type.
      const cropped = new File([blob], "cropped.jpg", { type: "image/jpeg" });
      const url = await uploadOne(cropped);
      if (url) setImageUrl(url);
    } finally {
      setUploadingMain(false);
      setPendingCropFile(null);
    }
  }

  async function uploadMainOriginal(file: File) {
    setUploadingMain(true);
    setError(null);
    try {
      const url = await uploadOne(file);
      if (url) setImageUrl(url);
    } finally {
      setUploadingMain(false);
      setPendingCropFile(null);
    }
  }

  async function onSelectGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingGallery(true);
    setError(null);
    try {
      const next: string[] = [...galleryUrls];
      for (const file of Array.from(files)) {
        if (next.length >= 12) break;
        const url = await uploadOne(file);
        if (url) next.push(url);
      }
      setGalleryUrls(next);
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  function removeGallery(i: number) {
    setGalleryUrls(galleryUrls.filter((_, idx) => idx !== i));
  }

  // ─── Specs ───────────────────────────────────────────────

  function addSpecSlot() {
    if (specs.length >= 12) return;
    setSpecs([...specs, ""]);
  }
  function updateSpec(i: number, v: string) {
    const next = specs.slice();
    next[i] = v;
    setSpecs(next);
  }
  function removeSpec(i: number) {
    setSpecs(specs.filter((_, idx) => idx !== i));
  }

  // ─── Variants ────────────────────────────────────────────

  function setSurfaceFlag(key: SurfaceMeta["key"], next: boolean) {
    if (key === "canteen") setShowInCanteenProducts(next);
    else if (key === "trending") setShowInTrending(next);
    else if (key === "trade_center") setShowInTradeCenter(next);
  }
  function getSurfaceFlag(key: SurfaceMeta["key"]): boolean {
    if (key === "canteen") return showInCanteenProducts;
    if (key === "trending") return showInTrending;
    return showInTradeCenter;
  }

  function applySizePreset(preset: SizePreset) {
    setSizePreset(preset);
    if (preset !== "custom") setSizeOptions(SIZE_PRESETS[preset]);
    else if (sizeOptions.length === 0) setSizeOptions([""]);
  }

  function updateSize(i: number, v: string) {
    const next = sizeOptions.slice();
    next[i] = v;
    setSizeOptions(next);
  }
  function addSize() {
    if (sizeOptions.length >= 24) return;
    setSizeOptions([...sizeOptions, ""]);
  }
  function removeSize(i: number) {
    setSizeOptions(sizeOptions.filter((_, idx) => idx !== i));
  }

  function updateColor(i: number, patch: Partial<{ name: string; hex: string }>) {
    const next = colorOptions.slice();
    next[i] = { ...next[i], ...patch };
    setColorOptions(next);
  }
  function addColor() {
    if (colorOptions.length >= 24) return;
    setColorOptions([...colorOptions, { name: "", hex: "" }]);
  }
  function removeColor(i: number) {
    setColorOptions(colorOptions.filter((_, idx) => idx !== i));
  }

  // ─── International shipping list helpers ─────────────────
  function addIntlRate() {
    if (intlRates.length >= 60) return;
    // Suggest the next country that isn't already in the list.
    const used = new Set(intlRates.map((r) => r.country));
    const next = COUNTRY_OPTIONS.find((c) => !used.has(c.code))?.code ?? "";
    setIntlRates([...intlRates, { country: next, priceGbp: "" }]);
  }
  function updateIntlRate(i: number, patch: Partial<{ country: string; priceGbp: string }>) {
    const next = intlRates.slice();
    next[i] = { ...next[i], ...patch };
    setIntlRates(next);
  }
  function removeIntlRate(i: number) {
    setIntlRates(intlRates.filter((_, idx) => idx !== i));
  }

  // ─── Multi-buy tier helpers ──────────────────────────────
  function addMultiBuyTier() {
    if (multiBuyTiers.length >= 8) return;
    const nextQty = multiBuyTiers.length + 2;
    setMultiBuyTiers([...multiBuyTiers, { qty: String(nextQty), unitPriceGbp: "" }]);
  }
  function updateMultiBuyTier(i: number, patch: Partial<{ qty: string; unitPriceGbp: string }>) {
    const next = multiBuyTiers.slice();
    next[i] = { ...next[i], ...patch };
    setMultiBuyTiers(next);
  }
  function removeMultiBuyTier(i: number) {
    setMultiBuyTiers(multiBuyTiers.filter((_, idx) => idx !== i));
  }

  // ─── Compatibility helpers ───────────────────────────────
  function addCompat() {
    if (compatibility.length >= 20) return;
    setCompatibility([...compatibility, { label: "", value: "" }]);
  }
  function updateCompat(i: number, patch: Partial<{ label: string; value: string }>) {
    const next = compatibility.slice();
    next[i] = { ...next[i], ...patch };
    setCompatibility(next);
  }
  function removeCompat(i: number) {
    setCompatibility(compatibility.filter((_, idx) => idx !== i));
  }

  // ─── Aspect setter ───────────────────────────────────────
  function setAspect(key: string, value: string | number) {
    setCategoryAspects((prev) => ({ ...prev, [key]: value }));
  }

  function buildCommerce(): ProductCommerce | null {
    const shipping = {
      freeLocalShipping,
      localShippingGbp: freeLocalShipping ? undefined : Math.max(0, Number.parseFloat(localShippingGbp) || 0),
      shipsInternationally,
      internationalRates: shipsInternationally
        ? intlRates
            .map((r) => ({
              country: r.country.trim().toUpperCase(),
              priceGbp: Math.max(0, Number.parseFloat(r.priceGbp) || 0)
            }))
            .filter((r) => r.country.length > 0)
        : undefined
    };

    let multiBuy: ProductCommerce["multiBuy"] | undefined;
    if (multiBuyEnabled) {
      multiBuy = {
        enabled: true,
        model: multiBuyModel,
        tiers: multiBuyModel === "tiered"
          ? multiBuyTiers
              .map((t) => ({
                qty: Math.max(2, Math.round(Number.parseFloat(t.qty) || 0)),
                unitPriceGbp: Math.max(0, Number.parseFloat(t.unitPriceGbp) || 0)
              }))
              .filter((t) => t.qty >= 2 && t.unitPriceGbp > 0)
          : undefined,
        additive: multiBuyModel === "additive"
          ? {
              secondUnitDiscountGbp: Math.max(0, Number.parseFloat(secondUnitDiscountGbp) || 0),
              thirdPlusUnitDiscountGbp: Math.max(0, Number.parseFloat(thirdPlusUnitDiscountGbp) || 0)
            }
          : undefined,
        deliveryModel
      };
    }

    const electrical = electricalEnabled ? {
      voltage: voltage.trim() || undefined,
      wattage: wattage.trim() || undefined,
      amps: amps.trim() || undefined,
      plugType: plugType.trim() || undefined,
      certification: certification.trim() || undefined
    } : undefined;

    const compat = compatibility
      .map((r) => ({ label: r.label.trim(), value: r.value.trim() }))
      .filter((r) => r.label.length > 0 && r.value.length > 0);

    const anythingSet =
      brand.trim() ||
      model.trim() ||
      mpn.trim() ||
      gtin.trim() ||
      yearMade.trim() ||
      condition ||
      conditionDescription.trim() ||
      countryOfOrigin ||
      warranty.trim() ||
      weightKg || lengthMm || widthMm || heightMm ||
      freeLocalShipping ||
      localShippingGbp ||
      shipsInternationally ||
      multiBuyEnabled ||
      electricalEnabled ||
      compat.length > 0 ||
      ageRestriction !== "none";
    if (!anythingSet) return null;

    return {
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      mpn: mpn.trim() || undefined,
      gtin: gtin.trim() || undefined,
      yearMade: yearMade ? Math.round(Number.parseFloat(yearMade)) : undefined,
      condition: condition || undefined,
      conditionDescription: conditionDescription.trim() || undefined,
      countryOfOrigin: countryOfOrigin || undefined,
      warranty: warranty.trim() || undefined,
      weightKg: weightKg ? Math.max(0, Number.parseFloat(weightKg)) : undefined,
      lengthMm: lengthMm ? Math.max(0, Number.parseFloat(lengthMm)) : undefined,
      widthMm: widthMm ? Math.max(0, Number.parseFloat(widthMm)) : undefined,
      heightMm: heightMm ? Math.max(0, Number.parseFloat(heightMm)) : undefined,
      dispatchDays: dispatchDays ? Math.max(0, Math.round(Number.parseFloat(dispatchDays))) : undefined,
      returns: {
        accepted: returnsAccepted,
        windowDays: returnsAccepted ? returnsWindowDays : undefined,
        paidBy: returnsAccepted ? returnsPaidBy : undefined,
        restockingFeePercent: returnsAccepted && restockingFeePercent
          ? Math.max(0, Math.min(25, Math.round(Number.parseFloat(restockingFeePercent))))
          : undefined
      },
      compatibility: compat.length > 0 ? compat : undefined,
      ageRestriction: ageRestriction === "16" ? 16 : ageRestriction === "18" ? 18 : null,
      shipping,
      multiBuy,
      electrical
    };
  }

  function buildVariants(): ProductVariants | null {
    if (!variantsEnabled) return null;
    const cleanSizes = sizeOptions.map((s) => s.trim()).filter(Boolean);
    const cleanColors = colorOptions
      .map((c) => ({
        name: c.name.trim(),
        hex: c.hex?.trim() || undefined
      }))
      .filter((c) => c.name.length > 0);
    const wantsSize = variantAxis === "size" || variantAxis === "size_color";
    const wantsColor = variantAxis === "color" || variantAxis === "size_color";
    if (wantsSize && cleanSizes.length === 0) return null;
    if (wantsColor && cleanColors.length === 0) return null;

    // Filter overrides down to keys that still exist in the current
    // shape — merchant might have removed a size/color while the
    // override lingered. Also drop overrides with zero populated
    // fields.
    const validKeys = new Set<string>();
    if (variantAxis === "size") for (const s of cleanSizes) validKeys.add(s);
    else if (variantAxis === "color") for (const c of cleanColors) validKeys.add(c.name);
    else for (const s of cleanSizes) for (const c of cleanColors) validKeys.add(`${s}|${c.name}`);

    const cleanOverrides: Record<string, VariantOverride> = {};
    for (const [k, ov] of Object.entries(variantOverrides)) {
      if (!validKeys.has(k)) continue;
      const cleaned: VariantOverride = {};
      if (ov.sku?.trim()) cleaned.sku = ov.sku.trim();
      if (ov.imageUrl?.trim()) cleaned.imageUrl = ov.imageUrl.trim();
      if (typeof ov.priceGbp === "number" && ov.priceGbp > 0) cleaned.priceGbp = ov.priceGbp;
      if (typeof ov.stock === "number" && ov.stock >= 0) cleaned.stock = ov.stock;
      if (ov.mpn?.trim()) cleaned.mpn = ov.mpn.trim();
      if (ov.gtin?.trim()) cleaned.gtin = ov.gtin.trim();
      if (Object.keys(cleaned).length > 0) cleanOverrides[k] = cleaned;
    }

    return {
      axis: variantAxis,
      sizePreset: wantsSize ? sizePreset : undefined,
      sizeOptions: wantsSize ? cleanSizes : undefined,
      colorOptions: wantsColor ? cleanColors : undefined,
      overrides: Object.keys(cleanOverrides).length > 0 ? cleanOverrides : undefined
    };
  }

  // ─── Combo-key helpers for the per-variant editor ────────
  function currentComboKeys(): string[] {
    const sizes = sizeOptions.map((s) => s.trim()).filter(Boolean);
    const colors = colorOptions.map((c) => c.name.trim()).filter(Boolean);
    if (variantAxis === "size") return sizes;
    if (variantAxis === "color") return colors;
    const out: string[] = [];
    for (const s of sizes) for (const c of colors) out.push(`${s}|${c}`);
    return out;
  }
  function labelForCombo(key: string): string {
    if (variantAxis !== "size_color") return key;
    const [size, color] = key.split("|");
    return `${size} · ${color}`;
  }
  function updateOverride(key: string, patch: Partial<VariantOverride>) {
    setVariantOverrides((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), ...patch }
    }));
  }
  function clearOverride(key: string) {
    setVariantOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // ─── Save + delete ───────────────────────────────────────

  async function save() {
    if (busy) return;
    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/canteen-product/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          id: isNew ? "new" : initial.id,
          product: {
            name: name.trim(),
            blurb: blurb.trim(),
            description: description.trim(),
            image_url: imageUrl.trim(),
            gallery_urls: galleryUrls,
            video_urls: videoUrls,
            price_gbp: Number.parseFloat(priceGbp) || 0,
            currency: "GBP",
            specs: specs.map((s) => s.trim()).filter(Boolean),
            trade_center_listing_id: tradeCenterListingId.trim() || null,
            show_in_canteen_products: showInCanteenProducts,
            show_in_trending: showInTrending,
            show_in_trade_center: showInTradeCenter,
            featured,
            variants: buildVariants(),
            commerce: buildCommerce(),
            category_slug: categorySlug || null,
            category_aspects: categoryAspects
          }
        })
      });
      const data = (await res.json()) as { ok: boolean; id?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError("Save failed. Please try again.");
        return;
      }
      if (isNew && data.id) {
        router.replace(`/trade-off/edit/${slug}/products/${data.id}?token=${encodeURIComponent(editToken)}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (busy || isNew) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete "${name}"? This can't be undone.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/canteen-product/save", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          id: initial.id
        })
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError("Delete failed. Please try again.");
        return;
      }
      router.replace(`/trade-off/edit/${slug}/products?token=${encodeURIComponent(editToken)}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const upgradeHref = `/trade-off/packages?from=product-editor&slug=${encodeURIComponent(slug)}`;
  const activeSurfaces = SURFACES.filter((s) => getSurfaceFlag(s.key) && isUnlocked(s, merchantTier)).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-4 md:px-6 md:pt-8">
      {/* Back + status */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/trade-off/edit/${slug}/products?token=${encodeURIComponent(editToken)}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ArrowLeft size={14} strokeWidth={2.4}/>
          Products
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#FFB300" }}/>
          {isNew ? "New product" : "Editing"}
        </span>
      </div>

      <h1 className="text-[24px] font-black leading-tight tracking-tight md:text-[32px]">
        {isNew ? "Add a product." : "Edit product."}
      </h1>
      <p className="mt-2 text-[13px] leading-[1.55] text-[#1B1A17]/70 md:text-[14px]">
        Upload once. Flows to <b>{activeSurfaces}</b> of 3 places — canteen page, trending swipe, Trade Center.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border-l-4 border-red-500 bg-red-50 p-3 text-[12.5px] font-semibold text-red-900"
        >
          {error}
        </div>
      )}

      {/* ─── Basics ────────────────────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
          Basics
        </h2>

        <label className="mt-3 block">
          <span className="text-[12px] font-bold text-[#1B1A17]/80">Product Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Solid Oak 40mm Worktop"
            maxLength={160}
            className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-[12px] font-bold text-[#1B1A17]/80">Short line (blurb)</span>
          <input
            type="text"
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="e.g. Cut to size — usually next day."
            maxLength={240}
            className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
          />
          <span className="mt-0.5 block text-[10.5px] text-[#1B1A17]/50">
            {blurb.length}/240 — shown under the name in the product list.
          </span>
        </label>

        <label className="mt-3 block">
          <span className="text-[12px] font-bold text-[#1B1A17]/80">Full description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Anything the buyer needs to know…"
            maxLength={4000}
            rows={5}
            className="mt-1 block w-full resize-y rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] leading-relaxed text-[#1B1A17] outline-none focus:border-[#FFB300]"
          />
        </label>

        <label className="mt-3 flex items-center gap-2 rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="h-4 w-4 accent-[#FFB300]"
          />
          <span className="text-[12.5px] text-[#1B1A17]/80">
            <b className="font-black">Featured</b> — pin to the featured strip on the canteen page
          </span>
        </label>
      </section>

      {/* ─── Category (auto-suggested from name) ───────────── */}
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-[#1B1A17]/60" strokeWidth={2.2}/>
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
            Category
          </h2>
        </div>

        {/* Category-moderation notice — amber banner, prominent so the
            merchant reads it before picking. Wrong categories tank
            search relevance for buyers, so we reserve the right to
            move a listing into the correct category if the merchant
            picks poorly. No user notification when we do this — the
            listing keeps working, just in the right place. */}
        <div
          role="note"
          className="mt-3 flex items-start gap-2.5 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3"
        >
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-700" strokeWidth={2.4}/>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-black uppercase tracking-[0.14em] text-amber-900">
              Pick the right category
            </div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-amber-900/80">
              Listings placed in the wrong category will be moved to the correct one <b>without notice</b> so buyers can find them. Not a penalty — just keeps the marketplace searchable.
            </p>
          </div>
        </div>

        {/* Auto-suggested chips from name — the eBay "we recommend"
            pattern. Merchant taps a chip to select, or picks from the
            full dropdown below. Suggestions score by keyword hits
            against category label / blurb / spec labels / dropdown
            values. Empty name → no suggestions, dropdown only. */}
        {suggestedCategories.length > 0 && (
          <>
            <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
              Suggested from &ldquo;{name.trim().slice(0, 60)}&rdquo; — tap one, or pick your own below.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedCategories.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => {
                    if (categorySlug !== s.slug) setCategoryAspects({});
                    setCategorySlug(s.slug);
                  }}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11.5px] font-black uppercase tracking-wider ${
                    categorySlug === s.slug
                      ? "border-[#FFB300] bg-[#FFB300] text-[#0A0A0A]"
                      : "border-[#E5D9BD] bg-white text-[#1B1A17] hover:bg-[#FFF8E6]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}
        {suggestedCategories.length === 0 && (
          <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
            Type a product name above to see suggested categories, or pick from the list.
          </p>
        )}

        <label className="mt-3 block">
          <span className="text-[12px] font-bold text-[#1B1A17]/80">All categories</span>
          <select
            value={categorySlug}
            onChange={(e) => {
              setCategorySlug(e.target.value);
              setCategoryAspects({});
            }}
            className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
          >
            <option value="">Choose category…</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
          {activeCategory && (
            <span className="mt-1 block text-[11px] text-[#1B1A17]/50">
              {activeCategory.blurb}
            </span>
          )}
        </label>

        {/* Category-specific aspects — required first, recommended
            second, optional collapsed. eBay "Item specifics" pattern. */}
        {aspectGroups && (aspectGroups.required.length + aspectGroups.recommended.length + aspectGroups.optional.length > 0) && (
          <div className="mt-4 space-y-3">
            {aspectGroups.required.length > 0 && (
              <AspectGroup
                title="Item specifics — required"
                accent
                specs={aspectGroups.required}
                values={categoryAspects}
                onChange={setAspect}
              />
            )}
            {aspectGroups.recommended.length > 0 && (
              <AspectGroup
                title="Recommended — buyers filter on these"
                specs={aspectGroups.recommended}
                values={categoryAspects}
                onChange={setAspect}
              />
            )}
            {aspectGroups.optional.length > 0 && (
              <details className="rounded-xl border border-[#E5D9BD] bg-white p-3">
                <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-[#1B1A17]/60">
                  More details ({aspectGroups.optional.length})
                </summary>
                <div className="mt-3">
                  <AspectGroup
                    title=""
                    specs={aspectGroups.optional}
                    values={categoryAspects}
                    onChange={setAspect}
                  />
                </div>
              </details>
            )}
          </div>
        )}
      </section>

      {/* ─── Images ────────────────────────────────────────── */}
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <div className="flex items-center gap-2">
          <ImageIcon size={14} className="text-[#1B1A17]/60" strokeWidth={2.2}/>
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
            Images
          </h2>
        </div>
        <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
          No editorial rules — any image you have. Pros will post polished shots; that&apos;s their edge.
        </p>

        {/* eBay layout: main image large on the LEFT, gallery
            thumbnails stacked on the RIGHT. On mobile we stack (main
            on top, thumbs below) since side-by-side is unreadable
            under 640px. Grid is 5-col at md+ so main gets 3 cols
            (60% width) and thumbs get 2 cols (40% width). */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
          {/* MAIN — spans 3/5 at md+ */}
          <div className="md:col-span-3">
            <span className="text-[12px] font-bold text-[#1B1A17]/80">Main image</span>
            <div className="mt-1">
              {imageUrl ? (
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-[#E5D9BD] bg-neutral-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Main preview" className="h-full w-full object-contain p-2"/>
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    aria-label="Remove main image"
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#1B1A17] shadow-md hover:bg-white"
                  >
                    <X size={14} strokeWidth={2.4}/>
                  </button>
                  <button
                    type="button"
                    onClick={() => mainInputRef.current?.click()}
                    disabled={uploadingMain}
                    className="absolute bottom-2 right-2 inline-flex h-8 items-center gap-1 rounded-full bg-[#0A0A0A]/85 px-3 text-[10.5px] font-black uppercase tracking-wider text-white hover:bg-black"
                  >
                    {uploadingMain ? <Loader2 size={11} className="animate-spin" strokeWidth={2.6}/> : <Upload size={11} strokeWidth={2.6}/>}
                    Replace
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => mainInputRef.current?.click()}
                  disabled={uploadingMain}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#E5D9BD] bg-white hover:bg-[#FFF8E6] disabled:opacity-60"
                >
                  {uploadingMain ? (
                    <Loader2 size={28} className="animate-spin text-[#1B1A17]/60" strokeWidth={2.2}/>
                  ) : (
                    <Upload size={28} className="text-[#1B1A17]/60" strokeWidth={2.2}/>
                  )}
                  <span className="text-[13px] font-black uppercase tracking-wider text-[#1B1A17]">
                    {uploadingMain ? "Uploading…" : "Upload main image"}
                  </span>
                  <span className="text-[10.5px] text-[#1B1A17]/50">
                    JPG · PNG · WEBP · up to 10 MB
                  </span>
                </button>
              )}
              <input
                ref={mainInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onSelectMain}
              />
            </div>
          </div>

          {/* GALLERY — spans 2/5 at md+, thumbnails column */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">
                Gallery ({galleryUrls.length}/12)
              </span>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={galleryUrls.length >= 12 || uploadingGallery}
                aria-label="Add gallery images"
                className="inline-flex items-center gap-1 rounded-full border border-[#E5D9BD] bg-white px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-[#1B1A17] disabled:opacity-40"
              >
                {uploadingGallery ? (
                  <Loader2 size={11} className="animate-spin" strokeWidth={2.6}/>
                ) : (
                  <Plus size={11} strokeWidth={2.6}/>
                )}
                Add
              </button>
            </div>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onSelectGallery}
            />
            {/* 2-column grid of small squares — mirrors the eBay
                right-hand thumbnail column. Empty slots hint at the
                12-cap so merchants understand they can add more. */}
            <div className="mt-2 grid grid-cols-3 gap-1.5 md:grid-cols-2">
              {galleryUrls.map((g, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-md border border-[#E5D9BD] bg-neutral-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g} alt={`Gallery ${i + 1}`} className="h-full w-full object-contain p-1"/>
                  <button
                    type="button"
                    onClick={() => removeGallery(i)}
                    aria-label="Remove image"
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/95 text-[#1B1A17] shadow hover:bg-white"
                  >
                    <X size={9} strokeWidth={2.8}/>
                  </button>
                </div>
              ))}
              {/* Empty add-slot when there's still capacity */}
              {galleryUrls.length < 12 && (
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={uploadingGallery}
                  aria-label="Add image"
                  className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-[#E5D9BD] bg-white text-[#1B1A17]/40 hover:bg-[#FFF8E6] hover:text-[#1B1A17]/60 disabled:opacity-60"
                >
                  <Plus size={16} strokeWidth={2.4}/>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Video (tier-gated) ────────────────────────────── */}
      <VideoSection
        slug={slug}
        merchantTier={merchantTier}
        videoUrls={videoUrls}
        setVideoUrls={setVideoUrls}
      />

      {/* ─── Specs ─────────────────────────────────────────── */}
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
            Specs / bullets
          </h2>
          <button
            type="button"
            onClick={addSpecSlot}
            disabled={specs.length >= 12}
            className="inline-flex items-center gap-1 rounded-full border border-[#E5D9BD] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#1B1A17] disabled:opacity-40"
          >
            <Plus size={12} strokeWidth={2.6}/>
            Add
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {specs.length === 0 && (
            <p className="text-[11.5px] text-[#1B1A17]/50">
              No specs yet. Tap Add to list features, dimensions, materials, etc.
            </p>
          )}
          {specs.map((sp, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[#1B1A17]/40">•</span>
              <input
                type="text"
                value={sp}
                onChange={(e) => updateSpec(i, e.target.value)}
                placeholder="e.g. 40mm oak, oil-finished"
                className="min-w-0 flex-1 rounded-lg border border-[#E5D9BD] bg-white px-3 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
              <button
                type="button"
                onClick={() => removeSpec(i)}
                aria-label="Remove spec"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5D9BD] bg-white text-[#1B1A17]/60 hover:text-red-600"
              >
                <X size={13} strokeWidth={2.4}/>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Details ───────────────────────────────────────── */}
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-[#1B1A17]/60" strokeWidth={2.2}/>
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
            Details
          </h2>
        </div>
        <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
          Optional but buyers trust listings with these filled in.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-bold text-[#1B1A17]/80">Brand</span>
            <input
              type="text"
              list="brand-suggestions"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Bosch, Howdens, Nolte"
              maxLength={80}
              className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-bold text-[#1B1A17]/80">Model</span>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Greenstar 30i"
              maxLength={80}
              className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-bold text-[#1B1A17]/80">MPN (Manufacturer Part Number)</span>
            <input
              type="text"
              value={mpn}
              onChange={(e) => setMpn(e.target.value)}
              placeholder="e.g. 7716701164"
              maxLength={60}
              className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-bold text-[#1B1A17]/80">GTIN / EAN / UPC</span>
            <input
              type="text"
              value={gtin}
              onChange={(e) => setGtin(e.target.value)}
              placeholder="13-digit barcode"
              maxLength={20}
              inputMode="numeric"
              className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
            />
          </label>
            <datalist id="brand-suggestions">
              {/* Small seed list — merchant can type any brand. Grows
                  organically as more merchants type + we later mine
                  the DB for common brands per trade. */}
              <option value="Bosch"/>
              <option value="Miele"/>
              <option value="Neff"/>
              <option value="Siemens"/>
              <option value="Howdens"/>
              <option value="Nolte"/>
              <option value="Symphony"/>
              <option value="Schneider Electric"/>
              <option value="Wago"/>
              <option value="MK"/>
              <option value="Worcester Bosch"/>
              <option value="Vaillant"/>
              <option value="Ideal"/>
              <option value="Grohe"/>
              <option value="Hansgrohe"/>
              <option value="Franke"/>
              <option value="Blanco"/>
              <option value="Kohler"/>
              <option value="Dulux"/>
              <option value="Farrow &amp; Ball"/>
            </datalist>

          <label className="block">
            <span className="text-[12px] font-bold text-[#1B1A17]/80">Year made</span>
            <input
              type="number"
              inputMode="numeric"
              value={yearMade}
              onChange={(e) => setYearMade(e.target.value)}
              placeholder={String(new Date().getUTCFullYear())}
              min="1900"
              max={new Date().getUTCFullYear() + 1}
              className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
            />
          </label>
        </div>

        <div className="mt-3">
          <span className="text-[12px] font-bold text-[#1B1A17]/80">Condition</span>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as ProductCondition | "")}
            className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
          >
            <option value="">Choose condition…</option>
            {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((v) => (
              <option key={v} value={v}>{CONDITION_LABELS[v]}</option>
            ))}
          </select>
          {condition && condition !== "new" && (
            <label className="mt-3 block">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">
                Condition detail <span className="text-[#1B1A17]/40">(recommended for used/refurb)</span>
              </span>
              <textarea
                value={conditionDescription}
                onChange={(e) => setConditionDescription(e.target.value)}
                placeholder="e.g. Screen has minor scratches. Works perfectly. Sold with original box."
                maxLength={1000}
                rows={3}
                className="mt-1 block w-full resize-y rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
              <span className="mt-0.5 block text-[10.5px] text-[#1B1A17]/50">
                {conditionDescription.length}/1000
              </span>
            </label>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-bold text-[#1B1A17]/80">Made in</span>
            <select
              value={countryOfOrigin}
              onChange={(e) => setCountryOfOrigin(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
            >
              <option value="">Choose country…</option>
              {ORIGIN_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-bold text-[#1B1A17]/80">Warranty</span>
            <input
              type="text"
              value={warranty}
              onChange={(e) => setWarranty(e.target.value)}
              placeholder="e.g. 2 years manufacturer"
              maxLength={240}
              className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
            />
          </label>
        </div>
      </section>

      {/* ─── Pricing & Delivery ─────────────────────────────
          The single economic decision. Grouped so the merchant sees
          price, VAT, delivery and multi-buy in one screen. Field-count
          research (Baymard) — fewer fields per section = less abandon.
          Optional sub-blocks (postage rates, multi-buy) collapse to
          zero when unused so a simple listing is 3 fields total. */}
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <div className="flex items-center gap-2">
          <Receipt size={14} className="text-[#1B1A17]/60" strokeWidth={2.2}/>
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
            Pricing &amp; Delivery
          </h2>
        </div>
        <p className="mt-1 text-[11.5px] leading-snug text-[#1B1A17]/60">
          Set your price, choose how it ships, offer a multi-buy discount if you want repeat orders, and tell buyers whether VAT is in or out. All four appear on the buyer&rsquo;s card.
        </p>

        {/* ── Price ── */}
        <div className="mt-3 rounded-xl border border-[#E5D9BD] bg-white p-3">
          <div className="flex items-center gap-2">
            <PoundSterling size={12} className="text-[#1B1A17]/50" strokeWidth={2.2}/>
            <span className="text-[11.5px] font-black uppercase tracking-wider text-[#1B1A17]/70">
              Price
            </span>
          </div>
          <label className="mt-2 block">
            <span className="text-[12px] font-bold text-[#1B1A17]/80">Price (£)</span>
            <input
              type="number"
              inputMode="decimal"
              value={priceGbp}
              onChange={(e) => setPriceGbp(e.target.value)}
              placeholder="0 = price on request"
              min="0"
              className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
            />
            <span className="mt-0.5 block text-[10.5px] text-[#1B1A17]/50">
              This is the base price. If a variant has a different price, set it below in the Variants section.
            </span>
          </label>
        </div>

        {/* Package dimensions — feeds any future calculated-shipping
            calculator and lets buyers see weight + size on the PDP */}
        <div className="mt-3 rounded-xl border border-[#E5D9BD] bg-white p-3">
          <div className="flex items-center gap-2">
            <Package size={12} className="text-[#1B1A17]/50" strokeWidth={2.2}/>
            <span className="text-[11.5px] font-black uppercase tracking-wider text-[#1B1A17]/70">
              Package size + weight
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <label className="block">
              <span className="text-[11px] font-bold text-[#1B1A17]/70">Weight (kg)</span>
              <input
                type="number" inputMode="decimal" min="0" step="0.1"
                value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
                placeholder="0"
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-2.5 py-1.5 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-[#1B1A17]/70">L (mm)</span>
              <input
                type="number" inputMode="numeric" min="0"
                value={lengthMm} onChange={(e) => setLengthMm(e.target.value)}
                placeholder="0"
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-2.5 py-1.5 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-[#1B1A17]/70">W (mm)</span>
              <input
                type="number" inputMode="numeric" min="0"
                value={widthMm} onChange={(e) => setWidthMm(e.target.value)}
                placeholder="0"
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-2.5 py-1.5 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-[#1B1A17]/70">H (mm)</span>
              <input
                type="number" inputMode="numeric" min="0"
                value={heightMm} onChange={(e) => setHeightMm(e.target.value)}
                placeholder="0"
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-2.5 py-1.5 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-[11.5px] font-bold text-[#1B1A17]/70">Dispatch time (working days)</span>
            <select
              value={dispatchDays}
              onChange={(e) => setDispatchDays(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
            >
              <option value="0">Same day</option>
              <option value="1">1 working day</option>
              <option value="2">2 working days</option>
              <option value="3">3 working days</option>
              <option value="5">5 working days</option>
              <option value="7">1 week</option>
              <option value="14">2 weeks</option>
              <option value="30">1 month</option>
            </select>
          </label>
        </div>

        {/* Local */}
        <div className="mt-3 rounded-xl border border-[#E5D9BD] bg-white p-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={freeLocalShipping}
              onChange={(e) => setFreeLocalShipping(e.target.checked)}
              className="h-4 w-4 accent-[#FFB300]"
            />
            <span className="text-[12.5px] font-black text-[#1B1A17]">
              Free local shipping (UK)
            </span>
          </label>
          {!freeLocalShipping && (
            <label className="mt-3 block">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">
                Local shipping (£)
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={localShippingGbp}
                onChange={(e) => setLocalShippingGbp(e.target.value)}
                placeholder="e.g. 8.50"
                min="0"
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            </label>
          )}
        </div>

        {/* International — gated by the "ships internationally" toggle */}
        <div className="mt-3 rounded-xl border border-[#E5D9BD] bg-white p-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={shipsInternationally}
              onChange={(e) => setShipsInternationally(e.target.checked)}
              className="h-4 w-4 accent-[#FFB300]"
            />
            <span className="text-[12.5px] font-black text-[#1B1A17]">
              Ships internationally
            </span>
          </label>

          {shipsInternationally && (
            <>
              <p className="mt-2 text-[11px] text-[#1B1A17]/60">
                Add a country and a price. Buyers only see countries you list.
              </p>
              <div className="mt-2 space-y-2">
                {intlRates.length === 0 && (
                  <p className="text-[11.5px] text-[#1B1A17]/50">
                    No countries added yet. Tap Add country below.
                  </p>
                )}
                {intlRates.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={r.country}
                      onChange={(e) => updateIntlRate(i, { country: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-[#E5D9BD] bg-white px-3 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                    >
                      <option value="">Country…</option>
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                      {/* Preserve any code the merchant already entered
                          that isn't in our seed list */}
                      {r.country && !COUNTRY_LABEL[r.country] && (
                        <option value={r.country}>{r.country}</option>
                      )}
                    </select>
                    <div className="relative">
                      <span aria-hidden className="absolute left-2 top-1/2 -translate-y-1/2 text-[13px] font-black text-[#1B1A17]/50">£</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={r.priceGbp}
                        onChange={(e) => updateIntlRate(i, { priceGbp: e.target.value })}
                        placeholder="0"
                        min="0"
                        className="w-24 rounded-lg border border-[#E5D9BD] bg-white pl-6 pr-2 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeIntlRate(i)}
                      aria-label="Remove country"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5D9BD] bg-white text-[#1B1A17]/60 hover:text-red-600"
                    >
                      <X size={13} strokeWidth={2.4}/>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addIntlRate}
                  disabled={intlRates.length >= 60}
                  className="inline-flex items-center gap-1 rounded-full border border-[#E5D9BD] bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#1B1A17] disabled:opacity-40"
                >
                  <Plus size={12} strokeWidth={2.6}/>
                  Add country
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Multi-buy discount (optional sub-block) ── */}
        <div className="mt-3 rounded-xl border border-[#E5D9BD] bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={12} className="text-[#1B1A17]/50" strokeWidth={2.2}/>
              <span className="text-[11.5px] font-black uppercase tracking-wider text-[#1B1A17]/70">
                Multi-buy discount
              </span>
            </div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={multiBuyEnabled}
              onChange={(e) => setMultiBuyEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#FFB300]"
            />
            <span className="text-[11.5px] font-bold text-[#1B1A17]/70">
              Enabled
            </span>
          </label>
        </div>

        {multiBuyEnabled && (
          <>
            {/* Model picker */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMultiBuyModel("tiered")}
                className={`rounded-lg border p-3 text-left ${
                  multiBuyModel === "tiered"
                    ? "border-[#FFB300] bg-[#FFF8E6]"
                    : "border-[#E5D9BD] bg-white"
                }`}
              >
                <div className="text-[12px] font-black uppercase tracking-wider text-[#1B1A17]">
                  Tiered pricing
                </div>
                <div className="mt-0.5 text-[10.5px] text-[#1B1A17]/60">
                  Set unit price per qty (buy 2 = £X, buy 3+ = £Y)
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMultiBuyModel("additive")}
                className={`rounded-lg border p-3 text-left ${
                  multiBuyModel === "additive"
                    ? "border-[#FFB300] bg-[#FFF8E6]"
                    : "border-[#E5D9BD] bg-white"
                }`}
              >
                <div className="text-[12px] font-black uppercase tracking-wider text-[#1B1A17]">
                  Ladder discount
                </div>
                <div className="mt-0.5 text-[10.5px] text-[#1B1A17]/60">
                  2nd unit £X off, 3rd+ unit £Y more off
                </div>
              </button>
            </div>

            {/* Tier editor */}
            {multiBuyModel === "tiered" && (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-[#1B1A17]/70">
                    Tiers ({multiBuyTiers.length}/8)
                  </span>
                  <button
                    type="button"
                    onClick={addMultiBuyTier}
                    disabled={multiBuyTiers.length >= 8}
                    className="inline-flex items-center gap-1 rounded-full border border-[#E5D9BD] bg-white px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-[#1B1A17] disabled:opacity-40"
                  >
                    <Plus size={11} strokeWidth={2.6}/>
                    Add tier
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {multiBuyTiers.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-[11.5px] font-bold text-[#1B1A17]/70">Buy</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={t.qty}
                          onChange={(e) => updateMultiBuyTier(i, { qty: e.target.value })}
                          min="2"
                          className="w-14 rounded-lg border border-[#E5D9BD] bg-white px-2 py-1.5 text-center text-[13px] font-black text-[#1B1A17] outline-none focus:border-[#FFB300]"
                        />
                        <span className="text-[11.5px] font-bold text-[#1B1A17]/70">for</span>
                      </div>
                      <div className="relative flex-1">
                        <span aria-hidden className="absolute left-2 top-1/2 -translate-y-1/2 text-[13px] font-black text-[#1B1A17]/50">£</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={t.unitPriceGbp}
                          onChange={(e) => updateMultiBuyTier(i, { unitPriceGbp: e.target.value })}
                          placeholder="0"
                          min="0"
                          className="w-full rounded-lg border border-[#E5D9BD] bg-white pl-6 pr-2 py-1.5 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                        />
                      </div>
                      <span className="text-[10.5px] text-[#1B1A17]/50">/ unit</span>
                      <button
                        type="button"
                        onClick={() => removeMultiBuyTier(i)}
                        aria-label="Remove tier"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5D9BD] bg-white text-[#1B1A17]/60 hover:text-red-600"
                      >
                        <X size={13} strokeWidth={2.4}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additive editor */}
            {multiBuyModel === "additive" && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-[12px] font-bold text-[#1B1A17]/80">
                    2nd unit discount (£)
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={secondUnitDiscountGbp}
                    onChange={(e) => setSecondUnitDiscountGbp(e.target.value)}
                    placeholder="e.g. 5"
                    min="0"
                    className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-bold text-[#1B1A17]/80">
                    3rd+ unit extra discount (£)
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={thirdPlusUnitDiscountGbp}
                    onChange={(e) => setThirdPlusUnitDiscountGbp(e.target.value)}
                    placeholder="e.g. 3"
                    min="0"
                    className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                  />
                </label>
              </div>
            )}

            {/* Delivery model */}
            <div className="mt-4">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">Delivery for multi-buy</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryModel("single")}
                  className={`rounded-lg border p-2.5 text-left ${
                    deliveryModel === "single"
                      ? "border-[#FFB300] bg-[#FFF8E6]"
                      : "border-[#E5D9BD] bg-white"
                  }`}
                >
                  <div className="text-[11.5px] font-black uppercase tracking-wider text-[#1B1A17]">
                    One delivery
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-[#1B1A17]/60">
                    Single shipping charge for the whole multi-buy
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryModel("per-item")}
                  className={`rounded-lg border p-2.5 text-left ${
                    deliveryModel === "per-item"
                      ? "border-[#FFB300] bg-[#FFF8E6]"
                      : "border-[#E5D9BD] bg-white"
                  }`}
                >
                  <div className="text-[11.5px] font-black uppercase tracking-wider text-[#1B1A17]">
                    Per item
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-[#1B1A17]/60">
                    Each unit gets its own shipping charge (bulky items)
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
        </div>

        {/* ── Prices vary by variant? ── Pointer only. The actual
            per-variant price editor lives in the Variants section
            below. eBay/Shopify/Etsy pattern: 1 price on the parent,
            override on child. Delivery is intentionally not per-variant
            (matches all top 4 platforms). If a variant genuinely ships
            differently — list it as its own product. */}
        <div className="mt-3 rounded-xl border border-[#E5D9BD] bg-white p-3">
          <div className="flex items-start gap-2">
            <ArrowDownRight size={12} className="mt-0.5 text-[#1B1A17]/50" strokeWidth={2.2}/>
            <div className="min-w-0 flex-1">
              <span className="text-[11.5px] font-black uppercase tracking-wider text-[#1B1A17]/70">
                Do prices vary by variant?
              </span>
              <p className="mt-1 text-[11.5px] leading-snug text-[#1B1A17]/60">
                Most merchants leave one price. If a size or colour genuinely costs more, set that per-variant price in the <b>Variants</b> section below — the base price above still applies to everything else.
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-[#1B1A17]/50">
                Delivery is set once for this whole listing. If one size ships very differently (huge, heavy, or oversized), it usually belongs as its own product — that&rsquo;s what eBay, Shopify and Etsy all recommend.
              </p>
            </div>
          </div>
        </div>

        {/* ── VAT position ── Last question in Pricing & Delivery.
            Three options because a large chunk of UK trades are under
            the £90k HMRC VAT threshold and shouldn't have to lie.
            Standard UK VAT: 20% (Jan 2011 onwards). */}
        <div className="mt-3 rounded-xl border-l-4 border-l-[#FFB300] border border-[#E5D9BD] bg-white p-3">
          <div className="flex items-center gap-2">
            <Receipt size={12} className="text-[#1B1A17]/50" strokeWidth={2.2}/>
            <span className="text-[11.5px] font-black uppercase tracking-wider text-[#1B1A17]/70">
              VAT position
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#1B1A17]/60">
            Last question — tells the buyer how tax works on this listing.
          </p>

          <div className="mt-2.5 space-y-2">
            <label
              className={`block cursor-pointer rounded-lg border p-2.5 transition ${
                vatPosition === "include"
                  ? "border-[#FFB300] bg-[#FFF8E6]"
                  : "border-[#E5D9BD] bg-white hover:bg-[#FFFBF0]"
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="vatPosition"
                  value="include"
                  checked={vatPosition === "include"}
                  onChange={() => setVatPosition("include")}
                  className="mt-0.5 h-4 w-4 accent-[#FFB300]"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-black uppercase tracking-wider text-[#1B1A17]">
                    Prices above INCLUDE VAT
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-[#1B1A17]/60">
                    Buyer pays exactly what you listed. VAT is already baked in. Example: £120 → buyer pays £120.
                  </div>
                </div>
              </div>
            </label>

            <label
              className={`block cursor-pointer rounded-lg border p-2.5 transition ${
                vatPosition === "exclude"
                  ? "border-[#FFB300] bg-[#FFF8E6]"
                  : "border-[#E5D9BD] bg-white hover:bg-[#FFFBF0]"
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="vatPosition"
                  value="exclude"
                  checked={vatPosition === "exclude"}
                  onChange={() => setVatPosition("exclude")}
                  className="mt-0.5 h-4 w-4 accent-[#FFB300]"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-black uppercase tracking-wider text-[#1B1A17]">
                    Prices above EXCLUDE VAT
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-[#1B1A17]/60">
                    Buyer pays your price + 20% at checkout. Example: £100 → buyer pays £120 (£100 + £20 VAT).
                  </div>
                </div>
              </div>
            </label>

            <label
              className={`block cursor-pointer rounded-lg border p-2.5 transition ${
                vatPosition === "not_registered"
                  ? "border-[#FFB300] bg-[#FFF8E6]"
                  : "border-[#E5D9BD] bg-white hover:bg-[#FFFBF0]"
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="vatPosition"
                  value="not_registered"
                  checked={vatPosition === "not_registered"}
                  onChange={() => setVatPosition("not_registered")}
                  className="mt-0.5 h-4 w-4 accent-[#FFB300]"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-black uppercase tracking-wider text-[#1B1A17]">
                    I&rsquo;m not VAT registered
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-[#1B1A17]/60">
                    No VAT added anywhere. For traders under the £90k HMRC threshold.
                  </div>
                </div>
              </div>
            </label>
          </div>

          <div className="mt-2.5 border-t border-[#E5D9BD] pt-2 text-[10.5px] text-[#1B1A17]/50">
            UK standard VAT rate: <b className="font-black text-[#1B1A17]/70">20%</b> (since Jan 2011). Check your registration status at <span className="font-black text-[#1B1A17]/70">gov.uk/vat</span>.
          </div>
        </div>
      </section>

      {/* ─── Electrical specs (opt-in) ─────────────────────── */}
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[#1B1A17]/60" strokeWidth={2.2}/>
            <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
              Electrical specs
            </h2>
          </div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={electricalEnabled}
              onChange={(e) => setElectricalEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#FFB300]"
            />
            <span className="text-[11.5px] font-bold text-[#1B1A17]/70">
              Add electrical specs
            </span>
          </label>
        </div>
        <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
          Turn on for anything with a plug — appliances, tools, power gear.
        </p>

        {electricalEnabled && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">Voltage</span>
              <input
                type="text"
                value={voltage}
                onChange={(e) => setVoltage(e.target.value)}
                placeholder="e.g. 230V"
                maxLength={40}
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">Wattage</span>
              <input
                type="text"
                value={wattage}
                onChange={(e) => setWattage(e.target.value)}
                placeholder="e.g. 1200W"
                maxLength={40}
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">Amps</span>
              <input
                type="text"
                value={amps}
                onChange={(e) => setAmps(e.target.value)}
                placeholder="e.g. 10A"
                maxLength={40}
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">Plug type</span>
              <input
                type="text"
                value={plugType}
                onChange={(e) => setPlugType(e.target.value)}
                placeholder="e.g. UK 3-pin (BS 1363)"
                maxLength={40}
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            </label>
            <label className="col-span-full block">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">Certification</span>
              <input
                type="text"
                value={certification}
                onChange={(e) => setCertification(e.target.value)}
                placeholder="e.g. BS EN 60335, CE marked, IP44"
                maxLength={80}
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[14px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            </label>
          </div>
        )}
      </section>

      {/* ─── Returns policy ────────────────────────────────── */}
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <div className="flex items-center gap-2">
          <Undo2 size={14} className="text-[#1B1A17]/60" strokeWidth={2.2}/>
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
            Returns policy
          </h2>
        </div>

        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={returnsAccepted}
            onChange={(e) => setReturnsAccepted(e.target.checked)}
            className="h-4 w-4 accent-[#FFB300]"
          />
          <span className="text-[12.5px] font-black text-[#1B1A17]">
            Accept returns
          </span>
        </label>

        {returnsAccepted && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">Return window</span>
              <select
                value={String(returnsWindowDays)}
                onChange={(e) => setReturnsWindowDays(Number(e.target.value) as 14 | 30 | 60)}
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              >
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">Return shipping paid by</span>
              <select
                value={returnsPaidBy}
                onChange={(e) => setReturnsPaidBy(e.target.value as "buyer" | "seller")}
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller (free return)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] font-bold text-[#1B1A17]/80">Restocking fee (%)</span>
              <input
                type="number" inputMode="numeric" min="0" max="25"
                value={restockingFeePercent}
                onChange={(e) => setRestockingFeePercent(e.target.value)}
                placeholder="0"
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            </label>
          </div>
        )}
      </section>

      {/* ─── Compatibility ("fits X") ──────────────────────── */}
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench size={14} className="text-[#1B1A17]/60" strokeWidth={2.2}/>
            <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
              Fits / compatibility
            </h2>
          </div>
          <button
            type="button"
            onClick={addCompat}
            disabled={compatibility.length >= 20}
            className="inline-flex items-center gap-1 rounded-full border border-[#E5D9BD] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#1B1A17] disabled:opacity-40"
          >
            <Plus size={12} strokeWidth={2.6}/>
            Add fit
          </button>
        </div>
        <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
          Optional. Buyers filter by these — huge for parts &amp; spares.
        </p>

        {compatibility.length === 0 && (
          <p className="mt-3 text-[11.5px] text-[#1B1A17]/50">
            No fits added yet. Add rows like &ldquo;Boiler: Worcester Greenstar 30i&rdquo; or &ldquo;Consumer unit: Wylex NM806L&rdquo;.
          </p>
        )}
        <div className="mt-3 space-y-2">
          {compatibility.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={c.label}
                onChange={(e) => updateCompat(i, { label: e.target.value })}
                placeholder="Category (e.g. Boiler)"
                className="w-1/3 rounded-lg border border-[#E5D9BD] bg-white px-3 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
              <input
                type="text"
                value={c.value}
                onChange={(e) => updateCompat(i, { value: e.target.value })}
                placeholder="Fits (e.g. Worcester Greenstar 30i)"
                className="min-w-0 flex-1 rounded-lg border border-[#E5D9BD] bg-white px-3 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
              <button
                type="button"
                onClick={() => removeCompat(i)}
                aria-label="Remove fit"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5D9BD] bg-white text-[#1B1A17]/60 hover:text-red-600"
              >
                <X size={13} strokeWidth={2.4}/>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Age restriction ───────────────────────────────── */}
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#1B1A17]/60" strokeWidth={2.2}/>
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
            Age restriction
          </h2>
        </div>
        <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
          For anything the buyer must be an adult to purchase (chemicals, blades, some tools).
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(["none", "16", "18"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAgeRestriction(v)}
              className={`rounded-lg border px-3 py-2.5 text-[12.5px] font-black uppercase tracking-wider ${
                ageRestriction === v
                  ? "border-[#FFB300] bg-[#FFF8E6] text-[#1B1A17]"
                  : "border-[#E5D9BD] bg-white text-[#1B1A17]/70"
              }`}
            >
              {v === "none" ? "No restriction" : `${v}+`}
            </button>
          ))}
        </div>
      </section>

      {/* ─── Variants ──────────────────────────────────────── */}
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
            Variants
          </h2>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={variantsEnabled}
              onChange={(e) => setVariantsEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#FFB300]"
            />
            <span className="text-[11.5px] font-bold text-[#1B1A17]/70">
              Product has variants
            </span>
          </label>
        </div>
        <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
          Sizes, colors, or both. Turn off if the product is a single SKU.
        </p>

        {variantsEnabled && (
          <>
            {/* Axis picker */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["size", "color", "size_color"] as const).map((ax) => (
                <button
                  key={ax}
                  type="button"
                  onClick={() => setVariantAxis(ax)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center ${
                    variantAxis === ax
                      ? "border-[#FFB300] bg-[#FFF8E6]"
                      : "border-[#E5D9BD] bg-white"
                  }`}
                >
                  {ax === "size" && <Ruler size={16} strokeWidth={2.2} className="text-[#1B1A17]/70"/>}
                  {ax === "color" && <Palette size={16} strokeWidth={2.2} className="text-[#1B1A17]/70"/>}
                  {ax === "size_color" && (
                    <div className="flex items-center gap-0.5">
                      <Ruler size={13} strokeWidth={2.2} className="text-[#1B1A17]/70"/>
                      <span className="text-[10px] text-[#1B1A17]/40">+</span>
                      <Palette size={13} strokeWidth={2.2} className="text-[#1B1A17]/70"/>
                    </div>
                  )}
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-[#1B1A17]">
                    {ax === "size" ? "Size" : ax === "color" ? "Color" : "Size + Color"}
                  </span>
                </button>
              ))}
            </div>

            {/* Size block */}
            {(variantAxis === "size" || variantAxis === "size_color") && (
              <div className="mt-4">
                <label className="block">
                  <span className="text-[12px] font-bold text-[#1B1A17]/80">Size scale</span>
                  <select
                    value={sizePreset}
                    onChange={(e) => applySizePreset(e.target.value as SizePreset)}
                    className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                  >
                    {(Object.keys(SIZE_PRESET_LABELS) as SizePreset[]).map((p) => (
                      <option key={p} value={p}>{SIZE_PRESET_LABELS[p]}</option>
                    ))}
                  </select>
                </label>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-[#1B1A17]/70">
                    Available sizes ({sizeOptions.length}/24)
                  </span>
                  <button
                    type="button"
                    onClick={addSize}
                    disabled={sizeOptions.length >= 24}
                    className="inline-flex items-center gap-1 rounded-full border border-[#E5D9BD] bg-white px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-[#1B1A17] disabled:opacity-40"
                  >
                    <Plus size={11} strokeWidth={2.6}/>
                    Add size
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sizeOptions.map((s, i) => (
                    <div key={i} className="inline-flex items-center gap-1 rounded-full border border-[#E5D9BD] bg-white pl-3 pr-1">
                      <input
                        type="text"
                        value={s}
                        onChange={(e) => updateSize(i, e.target.value)}
                        placeholder="Label"
                        size={Math.max(3, s.length + 1)}
                        className="border-0 bg-transparent py-1 text-[12.5px] font-bold text-[#1B1A17] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeSize(i)}
                        aria-label="Remove size"
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[#1B1A17]/50 hover:text-red-600"
                      >
                        <X size={11} strokeWidth={2.6}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Color block */}
            {(variantAxis === "color" || variantAxis === "size_color") && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-[#1B1A17]/70">
                    Available colors ({colorOptions.length}/24)
                  </span>
                  <button
                    type="button"
                    onClick={addColor}
                    disabled={colorOptions.length >= 24}
                    className="inline-flex items-center gap-1 rounded-full border border-[#E5D9BD] bg-white px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-[#1B1A17] disabled:opacity-40"
                  >
                    <Plus size={11} strokeWidth={2.6}/>
                    Add color
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {colorOptions.length === 0 && (
                    <p className="text-[11.5px] text-[#1B1A17]/50">
                      No colors yet. Tap Add color to list what&apos;s available.
                    </p>
                  )}
                  {colorOptions.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={c.hex || "#CCCCCC"}
                        onChange={(e) => updateColor(i, { hex: e.target.value })}
                        aria-label="Color swatch"
                        className="h-9 w-9 flex-shrink-0 cursor-pointer rounded border border-[#E5D9BD] bg-white"
                      />
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => updateColor(i, { name: e.target.value })}
                        placeholder="e.g. Ivory Mist"
                        className="min-w-0 flex-1 rounded-lg border border-[#E5D9BD] bg-white px-3 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                      />
                      <button
                        type="button"
                        onClick={() => removeColor(i)}
                        aria-label="Remove color"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5D9BD] bg-white text-[#1B1A17]/60 hover:text-red-600"
                      >
                        <X size={13} strokeWidth={2.4}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ─── Per-variant SKU / photo / price / stock ───────── */}
      <PerVariantDetails
        enabled={variantsEnabled}
        comboKeys={currentComboKeys()}
        axis={variantAxis}
        labelForCombo={labelForCombo}
        overrides={variantOverrides}
        onUpdate={updateOverride}
        onClear={clearOverride}
        basePriceGbp={Number.parseFloat(priceGbp) || 0}
        baseImageUrl={imageUrl}
        slug={slug}
        editToken={editToken}
      />

      {/* ─── Reach — the 3 surface toggles ─────────────────── */}
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
          Where this product shows
        </h2>
        <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
          One product, up to 3 surfaces. Toggle any surface off if you want to keep this piece exclusive.
        </p>

        <div className="mt-3 space-y-2.5">
          {SURFACES.map((surface) => {
            const unlocked = isUnlocked(surface, merchantTier);
            const on = getSurfaceFlag(surface.key);
            return (
              <div
                key={surface.key}
                className={`relative flex items-start gap-3 rounded-xl border p-3 ${
                  on && unlocked ? "border-[#FFB300] bg-[#FFF8E6]" : "border-[#E5D9BD] bg-white"
                }`}
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                  on && unlocked ? "bg-[#FFB300] text-[#0A0A0A]" : "bg-neutral-100 text-neutral-500"
                }`}>
                  {surface.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-black text-[#1B1A17]">
                      {surface.title}
                    </span>
                    {!unlocked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-white">
                        <Lock size={9} strokeWidth={2.8}/>
                        {surface.requiredTier}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[#1B1A17]/60">
                    {surface.detail}
                  </p>
                  {!unlocked && (
                    <Link
                      href={upgradeHref}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-700 hover:underline"
                    >
                      Upgrade to unlock
                    </Link>
                  )}
                </div>
                <label className="flex-shrink-0 pt-1">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!unlocked}
                    onChange={(e) => setSurfaceFlag(surface.key, e.target.checked)}
                    aria-label={`Toggle ${surface.title}`}
                    className="h-5 w-5 accent-[#FFB300] disabled:opacity-30"
                  />
                </label>
              </div>
            );
          })}
        </div>

        {showInTradeCenter && isUnlocked(SURFACES[2], merchantTier) && (
          <label className="mt-3 block">
            <span className="text-[12px] font-bold text-[#1B1A17]/80">
              Trade Center listing ID (optional)
            </span>
            <input
              type="text"
              value={tradeCenterListingId}
              onChange={(e) => setTradeCenterListingId(e.target.value)}
              placeholder="e.g. prod_oak_worktop_40mm"
              className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
            />
            <span className="mt-0.5 block text-[10.5px] text-[#1B1A17]/50">
              Set when you want the &ldquo;Buy on Trade Center&rdquo; button to appear alongside WhatsApp.
            </span>
          </label>
        )}
      </section>

      {/* Sticky action bar — mobile first so save/delete are thumb-
          reachable without scrolling to the bottom of a long form. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5D9BD] bg-[#FBF6EC]/95 px-4 py-3 backdrop-blur md:relative md:mt-6 md:border-none md:bg-transparent md:px-0 md:py-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={del}
              disabled={busy}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-4 text-[12px] font-black uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 size={13} strokeWidth={2.5}/>
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy || !name.trim()}
            className="ml-auto inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-6 text-[12.5px] font-black uppercase tracking-wider text-[#0A0A0A] shadow-md active:scale-[0.98] disabled:opacity-40"
            style={{ backgroundColor: "#FFB300" }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" strokeWidth={2.6}/> : <Save size={14} strokeWidth={2.6}/>}
            {isNew ? "Publish product" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Image crop editor — opens when the merchant picks a main
          image file. Aspect 4/3 matches the TC card render. "Use
          original" uploads the source file unchanged. */}
      {pendingCropFile && (
        <ImageCropSheet
          file={pendingCropFile}
          aspect={4 / 3}
          outputWidth={1600}
          title="Frame your main image"
          onCancel={() => setPendingCropFile(null)}
          onSave={(blob) => uploadMainFromBlob(blob)}
          onUseOriginal={() => uploadMainOriginal(pendingCropFile)}
        />
      )}
    </div>
  );
}

// ─── AspectGroup ────────────────────────────────────────────

type AspectSpec = {
  key: string;
  label: string;
  type: "text" | "number" | "dropdown" | "multiselect";
  status: "required" | "recommended" | "optional";
  options?: string[];
  unit?: string;
  placeholder?: string;
};

function AspectGroup({
  title,
  accent,
  specs,
  values,
  onChange
}: {
  title: string;
  accent?: boolean;
  specs: AspectSpec[];
  values: Record<string, string | number>;
  onChange: (key: string, value: string | number) => void;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-[#FFB300] bg-[#FFF8E6]" : "border-[#E5D9BD] bg-white"}`}>
      {title && (
        <div className={`text-[10.5px] font-black uppercase tracking-[0.16em] ${accent ? "text-amber-800" : "text-[#1B1A17]/60"}`}>
          {title}
        </div>
      )}
      <div className={`${title ? "mt-2" : ""} grid grid-cols-1 gap-3 md:grid-cols-2`}>
        {specs.map((spec) => (
          <label key={spec.key} className="block">
            <span className="text-[12px] font-bold text-[#1B1A17]/80">
              {spec.label}
              {spec.unit && <span className="ml-1 text-[#1B1A17]/40">({spec.unit})</span>}
            </span>
            {spec.type === "dropdown" || spec.type === "multiselect" ? (
              <select
                value={String(values[spec.key] ?? "")}
                onChange={(e) => onChange(spec.key, e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              >
                <option value="">Choose…</option>
                {(spec.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type={spec.type === "number" ? "number" : "text"}
                inputMode={spec.type === "number" ? "decimal" : undefined}
                value={String(values[spec.key] ?? "")}
                onChange={(e) => {
                  const v = e.target.value;
                  if (spec.type === "number") {
                    onChange(spec.key, v === "" ? "" : Number.parseFloat(v));
                  } else {
                    onChange(spec.key, v);
                  }
                }}
                placeholder={spec.placeholder ?? ""}
                className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── VideoSection ───────────────────────────────────────────
//
// Video is gated: every tier has a per-listing base allocation, and
// merchants can top up with video credit packs. Free tier is 0 (must
// upgrade to touch video at all). This is the "Free = access, Paid =
// upload" storage-cost rule applied to video.
//
// eBay allows 1 video per listing free. We do 5 on Canteen (£7.99),
// 15 on Marketplace (£11.99), unlimited (fair-use) on The Works
// (£15.99). Credit packs let a Canteen merchant temporarily jump up
// without an annual commitment.

const VIDEO_QUOTA_PER_LISTING: Record<MerchantTier, number> = {
  free:        0,
  canteen:     5,
  marketplace: 15,
  works:       200   // Fair-use "unlimited". Beyond this we contact the merchant.
};

// Video-pack presets kept as reference points; the primary UX is now
// "type the number you want" with a live-calculated price. Prices are
// set so that after UK Stripe fees (1.5% + £0.20 per charge) every
// preset clears at ~≥95% net-to-us. eBay can give video away because
// they take 12-15% commission per sale — we take none, so every
// add-on must self-fund. See ADR-0010.
const VIDEO_PACKS: { count: number; priceGbp: number; label: string }[] = [
  { count: 10,   priceGbp: 4.99,  label: "Starter" },
  { count: 20,   priceGbp: 7.99,  label: "Small" },
  { count: 30,   priceGbp: 10.99, label: "Medium" },
  { count: 50,   priceGbp: 16.99, label: "Large" },
  { count: 100,  priceGbp: 29.99, label: "Bulk" },
  { count: 150,  priceGbp: 39.99, label: "Bulk+" },
  { count: 200,  priceGbp: 49.99, label: "Wholesale" },
  { count: 300,  priceGbp: 69.99, label: "Wholesale+" },
  { count: -1,   priceGbp: 99.00, label: "Unlimited (30 days)" }
];

// Live per-video price ladder — bigger orders get bulk breaks. This
// mirrors the pack ladder above so 10 videos ≈ £4.99 (49.9p/video),
// 100 ≈ £29.99 (30p/video), 300 ≈ £69.99 (23.3p/video). Formula:
// piecewise-linear from the pack anchors. Result is always rounded up
// to the next .99 to keep the .99 pricing rule (see ADR-0010).
function priceForVideoCount(count: number): number {
  if (count <= 0) return 0;
  if (count >= 500) return 99;   // Unlimited-month price kicks in
  // Two-point interpolation between the nearest pack anchors.
  const anchors = VIDEO_PACKS.filter((p) => p.count > 0).sort((a, b) => a.count - b.count);
  if (count <= anchors[0].count) {
    // Below the smallest pack, use its per-video rate.
    const perVideo = anchors[0].priceGbp / anchors[0].count;
    const raw = perVideo * count;
    return Math.max(0.99, Math.ceil(raw) - 0.01);
  }
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (count > a.count && count <= b.count) {
      // Linear interpolation between anchor prices.
      const t = (count - a.count) / (b.count - a.count);
      const raw = a.priceGbp + t * (b.priceGbp - a.priceGbp);
      return Math.max(0.99, Math.ceil(raw) - 0.01);
    }
  }
  // Above the largest anchor but below unlimited — extrapolate.
  const last = anchors[anchors.length - 1];
  const perVideoAtTop = last.priceGbp / last.count;
  const raw = perVideoAtTop * count;
  return Math.max(last.priceGbp, Math.ceil(raw) - 0.01);
}

function VideoSection({
  slug,
  merchantTier,
  videoUrls,
  setVideoUrls
}: {
  slug: string;
  merchantTier: MerchantTier;
  videoUrls: string[];
  setVideoUrls: (next: string[]) => void;
}) {
  const quota = VIDEO_QUOTA_PER_LISTING[merchantTier];
  const canUpload = quota > 0;
  const remaining = Math.max(0, quota - videoUrls.length);
  const upgradeHref = `/trade-off/packages?from=video-app&slug=${encodeURIComponent(slug)}`;
  const videoAppHref = `/trade-off/edit/${slug}/app-studio?app=video-packs`;

  return (
    <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video size={14} className="text-[#1B1A17]/60" strokeWidth={2.2}/>
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
            Video
          </h2>
        </div>
        {canUpload && (
          <span className="text-[10.5px] font-black uppercase tracking-wider text-[#1B1A17]/60">
            {videoUrls.length} / {quota === 200 ? "∞" : quota} used
          </span>
        )}
      </div>

      {/* Free tier: locked. Show the app-unlock CTA + tier upgrade path. */}
      {!canUpload && (
        <div className="mt-3 flex flex-col items-start gap-3 rounded-xl border border-[#E5D9BD] bg-white p-4 md:flex-row md:items-center md:gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFF8E6]">
            <Lock size={18} className="text-amber-700" strokeWidth={2.4}/>
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-black text-[#1B1A17]">
              Unlock the Video app
            </div>
            <p className="mt-0.5 text-[11.5px] text-[#1B1A17]/60">
              60-second product videos with your own package: 10 / 20 / 30 / 50 / 100 / 150 / 200 / 300 or unlimited. Included on paid tiers.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 md:items-end">
            <Link
              href={upgradeHref}
              className="inline-flex h-9 items-center gap-1 rounded-full px-4 text-[11.5px] font-black uppercase tracking-wider text-[#0A0A0A] shadow-md"
              style={{ backgroundColor: "#FFB300" }}
            >
              Upgrade tier
            </Link>
            <Link
              href={videoAppHref}
              className="text-[10.5px] font-black uppercase tracking-wider text-amber-700 hover:underline"
            >
              Or buy a video pack →
            </Link>
          </div>
        </div>
      )}

      {/* Paid tier: uploader + quota + existing video thumbnails */}
      {canUpload && (
        <>
          <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
            60 seconds max. MP4 / MOV / WebM. Great for showing a finished job or how something fits.
          </p>

          {videoUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {videoUrls.map((v, i) => (
                <div key={i} className="relative aspect-video overflow-hidden rounded-lg border border-[#E5D9BD] bg-neutral-900">
                  <video
                    src={v}
                    className="h-full w-full object-contain"
                    controls
                    preload="metadata"
                  />
                  <button
                    type="button"
                    onClick={() => setVideoUrls(videoUrls.filter((_, idx) => idx !== i))}
                    aria-label="Remove video"
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-[#1B1A17] shadow hover:bg-white"
                  >
                    <X size={11} strokeWidth={2.6}/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload button (endpoint stub — /api/uploads accepts
              canteen-video kind; wiring the multi-video flow lands
              with the credit-ledger endpoint). For now this points
              at the app-studio video pack surface. */}
          <div className="mt-3">
            {remaining > 0 ? (
              <Link
                href={videoAppHref}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#E5D9BD] bg-white px-4 text-[11.5px] font-black uppercase tracking-wider text-[#1B1A17] hover:bg-[#FFF8E6]"
              >
                <PlayCircle size={13} strokeWidth={2.4}/>
                Add video · {remaining} left
              </Link>
            ) : (
              <div className="rounded-xl border border-[#E5D9BD] bg-[#FFF8E6] p-3">
                <div className="text-[12px] font-black text-[#1B1A17]">
                  You&apos;ve used every video on this listing.
                </div>
                <p className="mt-0.5 text-[11px] text-[#1B1A17]/60">
                  Buy a credit pack or upgrade to lift the per-listing cap.
                </p>
                <Link
                  href={videoAppHref}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-700 hover:underline"
                >
                  Get more videos →
                </Link>
              </div>
            )}
          </div>

          {/* Pack pricing preview — helps merchants estimate cost
              without navigating away. */}
          {/* Custom-count picker with live price. Merchant types the
              number they need; we quote instantly. Replaces the
              fixed-pack grid — more control, less guessing. */}
          <VideoQuoteCard />
        </>
      )}
    </section>
  );
}

function VideoQuoteCard() {
  const [count, setCount] = useState<string>("30");
  const parsed = Math.max(0, Math.min(500, Math.round(Number.parseFloat(count) || 0)));
  const price = priceForVideoCount(parsed);
  const perVideoPence = parsed > 0 ? Math.round((price / parsed) * 100) : 0;
  const isUnlimited = parsed >= 500;

  return (
    <div className="mt-3 rounded-xl border border-[#E5D9BD] bg-white p-3">
      <div className="text-[11px] font-black uppercase tracking-wider text-[#1B1A17]/60">
        How many videos do you need?
      </div>
      <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
        Type your number — we quote you instantly. Bigger orders get bulk pricing.
      </p>

      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:gap-4">
        <label className="block flex-1">
          <span className="text-[11.5px] font-bold text-[#1B1A17]/70">Number of videos</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="500"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2.5 text-[16px] font-black text-[#1B1A17] outline-none focus:border-[#FFB300]"
          />
        </label>
        <div className="flex-1 rounded-lg bg-[#FFF8E6] p-3">
          <div className="text-[10.5px] font-black uppercase tracking-wider text-amber-800">
            Your price
          </div>
          <div className="mt-0.5 text-[24px] font-black text-[#1B1A17]">
            £{price.toFixed(2)}
            {isUnlimited && <span className="ml-1 text-[11px] font-bold text-[#1B1A17]/60">/ month</span>}
          </div>
          {parsed > 0 && !isUnlimited && (
            <div className="mt-0.5 text-[10.5px] font-bold text-[#1B1A17]/60">
              ≈ {perVideoPence}p per video
            </div>
          )}
          {isUnlimited && (
            <div className="mt-0.5 text-[10.5px] font-bold text-[#1B1A17]/60">
              Unlimited for 30 days
            </div>
          )}
        </div>
      </div>

      {/* Common-count shortcut chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="mr-1 text-[10.5px] font-black uppercase tracking-wider text-[#1B1A17]/40">
          Quick pick:
        </span>
        {[10, 20, 30, 50, 100, 150, 200, 300].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCount(String(c))}
            className={`rounded-full border px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider ${
              parsed === c
                ? "border-[#FFB300] bg-[#FFB300] text-[#0A0A0A]"
                : "border-[#E5D9BD] bg-white text-[#1B1A17] hover:bg-[#FFF8E6]"
            }`}
          >
            {c}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCount("500")}
          className={`rounded-full border px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider ${
            isUnlimited
              ? "border-[#FFB300] bg-[#FFB300] text-[#0A0A0A]"
              : "border-[#E5D9BD] bg-white text-[#1B1A17] hover:bg-[#FFF8E6]"
          }`}
        >
          Unlimited
        </button>
      </div>

      {/* Honest-comparison note. Kept factual + generic ("many
          marketplaces" not eBay by name) to avoid discrimination
          risk while still educating the merchant that "free" video
          on other platforms is really commission-funded. */}
      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
        <div className="text-[10.5px] font-black uppercase tracking-wider text-emerald-900">
          Why not free?
        </div>
        <p className="mt-1 text-[11.5px] leading-snug text-emerald-900/80">
          Many marketplaces bundle &ldquo;free&rdquo; video into a listing — then take 12&ndash;15% commission on every sale you make.
          Trade Center never takes a cut of your sales. You pay for the bandwidth video costs us; you keep 100% of what you earn.
          Sell a £500 kitchen worktop and you keep the whole £500. Elsewhere that&apos;s £60&ndash;£75 gone.
        </p>
      </div>
    </div>
  );
}

// ─── PerVariantDetails ─────────────────────────────────────
//
// Per-combination override editor. Renders one collapsible row per
// combo (size / color / size×color). Each row lets the merchant set a
// SKU, replacement image, override price, stock count, MPN, GTIN.
// Any field left blank falls back to the product-level value —
// no override = "same as base product". Compact by default (just
// the label + a badge count of overridden fields); expand to edit.

function PerVariantDetails({
  enabled,
  comboKeys,
  axis,
  labelForCombo,
  overrides,
  onUpdate,
  onClear,
  basePriceGbp,
  baseImageUrl,
  slug,
  editToken
}: {
  enabled: boolean;
  comboKeys: string[];
  axis: "size" | "color" | "size_color";
  labelForCombo: (key: string) => string;
  overrides: Record<string, VariantOverride>;
  onUpdate: (key: string, patch: Partial<VariantOverride>) => void;
  onClear: (key: string) => void;
  basePriceGbp: number;
  baseImageUrl: string;
  slug: string;
  editToken: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  if (!enabled) return null;
  if (comboKeys.length === 0) {
    return (
      <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
          Per-variant details
        </h2>
        <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
          Add at least one size or colour above to unlock per-variant SKU, photo, price and stock.
        </p>
      </section>
    );
  }

  async function uploadVariantImage(key: string, file: File) {
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug);
      fd.append("edit_token", editToken);
      const res = await fetch("/api/trade-off/canteen-product/upload-image", {
        method: "POST",
        body: fd
      });
      const data = (await res.json()) as { ok: boolean; url?: string };
      if (data.ok && data.url) onUpdate(key, { imageUrl: data.url });
    } finally {
      setUploadingKey(null);
    }
  }

  function overriddenFieldCount(key: string): number {
    const o = overrides[key];
    if (!o) return 0;
    return [o.sku, o.imageUrl, o.priceGbp, o.stock, o.mpn, o.gtin].filter((x) => x !== undefined && x !== "").length;
  }

  return (
    <section className="mt-4 rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
      <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
        Per-variant details
      </h2>
      <p className="mt-1 text-[11.5px] text-[#1B1A17]/60">
        Optional. Leave a row untouched and every field falls back to the base product.
      </p>

      <div className="mt-3 space-y-2">
        {comboKeys.map((key) => {
          const o = overrides[key] ?? {};
          const overrideCount = overriddenFieldCount(key);
          const isOpen = openKey === key;
          const effectivePrice = o.priceGbp ?? basePriceGbp;
          const effectiveImage = o.imageUrl || baseImageUrl;

          return (
            <div key={key} className="rounded-xl border border-[#E5D9BD] bg-white">
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                {/* Thumbnail — variant image if set, else base */}
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-neutral-100">
                  {effectiveImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={effectiveImage} alt="" className="h-full w-full object-contain p-0.5"/>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#1B1A17]/30">
                      <ImageIcon size={14} strokeWidth={2}/>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-black text-[#1B1A17]">
                    {labelForCombo(key)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10.5px] font-bold text-[#1B1A17]/60">
                    <span>£{effectivePrice > 0 ? effectivePrice.toFixed(2) : "—"}</span>
                    {o.stock !== undefined && (
                      <>
                        <span className="text-[#1B1A17]/30">·</span>
                        <span className={o.stock === 0 ? "text-red-600" : ""}>
                          {o.stock === 0 ? "Out of stock" : `${o.stock} in stock`}
                        </span>
                      </>
                    )}
                    {o.sku && (
                      <>
                        <span className="text-[#1B1A17]/30">·</span>
                        <span className="truncate">Ref: {o.sku}</span>
                      </>
                    )}
                  </div>
                </div>
                {overrideCount > 0 && (
                  <span
                    className="flex-shrink-0 rounded-full bg-[#FFB300] px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-[#0A0A0A]"
                    title={`${overrideCount} field${overrideCount === 1 ? "" : "s"} overridden`}
                  >
                    {overrideCount}
                  </span>
                )}
                <span className="text-[#1B1A17]/40">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-[#E5D9BD] p-3">
                  {/* Copy-from-previous shortcut so merchants don't
                      re-enter identical data for every variant. */}
                  {Object.keys(overrides).length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10.5px] font-bold text-[#1B1A17]/60">Copy from:</span>
                      {Object.keys(overrides).filter((k) => k !== key).slice(0, 4).map((src) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => {
                            const patch = { ...overrides[src] };
                            delete patch.imageUrl; // don't copy image — always variant-specific
                            for (const [pk, pv] of Object.entries(patch)) {
                              onUpdate(key, { [pk as keyof VariantOverride]: pv } as Partial<VariantOverride>);
                            }
                          }}
                          className="rounded-full border border-[#E5D9BD] bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#1B1A17] hover:bg-[#FFF8E6]"
                        >
                          {labelForCombo(src).slice(0, 20)}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-[11px] font-bold text-[#1B1A17]/70">
                        Price override (£)
                        <span className="ml-1 text-[#1B1A17]/40">
                          (base £{basePriceGbp.toFixed(2)})
                        </span>
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={o.priceGbp ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          onUpdate(key, { priceGbp: v === "" ? undefined : Number.parseFloat(v) });
                        }}
                        placeholder={`${basePriceGbp || 0}`}
                        className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold text-[#1B1A17]/70">Stock</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={o.stock ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          onUpdate(key, { stock: v === "" ? undefined : Math.max(0, Math.round(Number.parseFloat(v) || 0)) });
                        }}
                        placeholder="Not tracked"
                        className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold text-[#1B1A17]/70">SKU / your reference</span>
                      <input
                        type="text"
                        value={o.sku ?? ""}
                        onChange={(e) => onUpdate(key, { sku: e.target.value })}
                        placeholder="e.g. KIT-BASE-M-IVORY"
                        maxLength={60}
                        className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold text-[#1B1A17]/70">Variant image</span>
                      <div className="mt-1 flex items-center gap-2">
                        <label className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-[#E5D9BD] bg-white px-3 text-[11px] font-black uppercase tracking-wider text-[#1B1A17]/70 hover:bg-[#FFF8E6]">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadVariantImage(key, f);
                              e.target.value = "";
                            }}
                          />
                          {uploadingKey === key ? (
                            <>
                              <Loader2 size={11} className="animate-spin" strokeWidth={2.4}/>
                              Uploading…
                            </>
                          ) : (
                            <>
                              <Upload size={11} strokeWidth={2.4}/>
                              {o.imageUrl ? "Replace" : "Upload"}
                            </>
                          )}
                        </label>
                        {o.imageUrl && (
                          <button
                            type="button"
                            onClick={() => onUpdate(key, { imageUrl: undefined })}
                            aria-label="Remove variant image"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5D9BD] bg-white text-[#1B1A17]/60 hover:text-red-600"
                          >
                            <X size={13} strokeWidth={2.4}/>
                          </button>
                        )}
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold text-[#1B1A17]/70">MPN (this variant)</span>
                      <input
                        type="text"
                        value={o.mpn ?? ""}
                        onChange={(e) => onUpdate(key, { mpn: e.target.value })}
                        placeholder="Optional"
                        maxLength={60}
                        className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold text-[#1B1A17]/70">GTIN (this variant)</span>
                      <input
                        type="text"
                        value={o.gtin ?? ""}
                        onChange={(e) => onUpdate(key, { gtin: e.target.value })}
                        placeholder="Optional"
                        maxLength={20}
                        inputMode="numeric"
                        className="mt-1 block w-full rounded-lg border border-[#E5D9BD] bg-white px-3 py-2 text-[13px] text-[#1B1A17] outline-none focus:border-[#FFB300]"
                      />
                    </label>
                  </div>

                  {overrideCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onClear(key)}
                      className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-red-700 hover:underline"
                    >
                      <X size={11} strokeWidth={2.4}/>
                      Reset all overrides for this variant
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
