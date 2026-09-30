// src/lib/nex-native/info-pages.ts
//
// Client-safe constants + types for the cover-composer info tray.
// -----------------------------------------------------------------------------
// Founder direction 2026-09-30 · every cover has a + button that opens a
// tray of "curiosity buttons" backed by nex_business.info_pages (jsonb).
// Sellers author on /manage/info, buyers browse on the cover.
//
// This file is client-safe (no "server-only" import) so cover client
// components can import the types + icon list without dragging Supabase
// into the browser bundle. Server-side get / update helpers live in
// info-pages-service.ts.

/** All sealed info-page keys. Order here matches tray display order. */
export const NEX_INFO_PAGE_KEYS = [
  "about_us",
  "delivery",
  "hours",
  "payment",
  "returns",
  "catering",
  "gallery",
  "custom_orders",
  "services",
] as const;
export type NexInfoPageKey = (typeof NEX_INFO_PAGE_KEYS)[number];

/** Which vertical each page applies to. Category-adaptive buttons only
 *  render for the matching vertical AND when enabled. */
export const NEX_INFO_PAGE_SCOPE: Record<
  NexInfoPageKey,
  "all" | "venue_only" | "product_or_service"
> = {
  about_us: "all",
  delivery: "all",
  hours: "all",
  payment: "all",
  returns: "all",
  catering: "venue_only",
  gallery: "venue_only",
  custom_orders: "product_or_service",
  services: "product_or_service",
};

/** Icon + human label per sealed page. Icons chosen so a tray of six
 *  reads fast at a glance. */
export const NEX_INFO_PAGE_META: Record<
  NexInfoPageKey,
  { icon: string; label: string; blurb: string }
> = {
  about_us: {
    icon: "📖",
    label: "About Us",
    blurb: "The seller's story · why they exist",
  },
  delivery: {
    icon: "🛵",
    label: "Delivery",
    blurb: "How they fulfil orders · last-order times",
  },
  hours: {
    icon: "⏰",
    label: "Hours",
    blurb: "Opening hours",
  },
  payment: {
    icon: "💰",
    label: "Payment",
    blurb: "Which payment methods they accept",
  },
  returns: {
    icon: "↩️",
    label: "Returns",
    blurb: "Refund window · who pays return shipping",
  },
  catering: {
    icon: "🎉",
    label: "Catering / Events",
    blurb: "Bulk orders · private events · parties",
  },
  gallery: {
    icon: "📸",
    label: "Gallery",
    blurb: "Venue photos",
  },
  custom_orders: {
    icon: "📦",
    label: "Custom Orders",
    blurb: "Bespoke work · own packaging · special requests",
  },
  services: {
    icon: "🔧",
    label: "What we fix / stock",
    blurb: "Brands · models · parts",
  },
};

/** Curated icon set for seller-added custom buttons. Locked to 30
 *  glyphs so the tray never becomes a Unicode zoo. */
export const NEX_INFO_CUSTOM_ICONS = [
  "📖", "🛵", "⏰", "💰", "↩️", "🎉", "📸", "📦", "🔧", "☕",
  "🍽", "🎨", "✂️", "🧵", "🪴", "🎁", "🛠", "🧴", "📿", "🍞",
  "📞", "📧", "🌐", "📍", "🚚", "✈️", "🏪", "⭐", "❤️", "✨",
] as const;
export type NexInfoCustomIcon = (typeof NEX_INFO_CUSTOM_ICONS)[number];

/** Founder-sealed caps · match /manage/info form validation. */
export const NEX_INFO_MAX_CUSTOM_BUTTONS = 3;
export const NEX_INFO_TITLE_MAX = 24;
export const NEX_INFO_BODY_MAX = 400;

/** Shape stored in nex_business.info_pages (jsonb). Every field
 *  optional · service layer normalises the read path so callers can
 *  always treat missing keys as "not set / default enabled". */
export interface NexInfoPagesJson {
  /** Per-page on/off toggle. Missing key = enabled by default (only
   *  hidden if the backing data is also empty). Seller flips these
   *  from /manage/info. */
  enabled?: Partial<Record<NexInfoPageKey, boolean>>;
  /** Free-text answer for the delivery page (last-order times, zones,
   *  etc.). Complements the sealed Migration 108 shipping_scope label. */
  delivery_details?: string | null;
  /** Free-text for the Custom Orders page. */
  custom_orders?: string | null;
  /** Free-text for the Services page (what we fix / stock / brands). */
  services_scope?: string | null;
  /** Up to 3 seller-defined buttons · each with its own toggle. */
  custom_buttons?: NexInfoCustomButton[];
}

export interface NexInfoCustomButton {
  /** Stable id · used as React key + form field prefix. Assigned on
   *  create · never reused. */
  id: string;
  /** Buyer-side visibility toggle. Missing = enabled. */
  enabled?: boolean;
  /** One of NEX_INFO_CUSTOM_ICONS. Invalid values fall back to "✨". */
  icon: string;
  /** 1-24 chars. Empty = don't render. */
  label: string;
  /** 0-400 chars. Line breaks preserved · plain text only. */
  body: string;
  /** Optional https:// image URL. */
  image_url?: string | null;
  /** Optional https:// external link (e.g. "Book on OpenTable"). */
  external_url?: string | null;
}

/** Read helper · returns true unless the seller has explicitly
 *  toggled the page off in info_pages.enabled. */
export function isInfoPageEnabled(
  pages: NexInfoPagesJson | null | undefined,
  key: NexInfoPageKey,
): boolean {
  if (!pages || !pages.enabled) return true;
  const v = pages.enabled[key];
  return v === undefined ? true : v === true;
}

/** Read helper · normalises a custom button's enabled flag (default true). */
export function isCustomButtonEnabled(btn: NexInfoCustomButton): boolean {
  return btn.enabled === undefined ? true : btn.enabled === true;
}

/** Validators shared between the seller-form and the server action.
 *  Return null on OK, string error message on fail. Reuse in
 *  /manage/info before writing to the DB. */
export function validateInfoTitle(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "Give the button a name";
  if (trimmed.length > NEX_INFO_TITLE_MAX)
    return `Name too long (max ${NEX_INFO_TITLE_MAX} chars)`;
  return null;
}
export function validateInfoBody(raw: string): string | null {
  if (raw.length > NEX_INFO_BODY_MAX)
    return `Content too long (max ${NEX_INFO_BODY_MAX} chars)`;
  return null;
}
export function validateInfoUrl(
  raw: string,
  { allowEmpty = true }: { allowEmpty?: boolean } = {},
): string | null {
  const v = raw.trim();
  if (v === "") return allowEmpty ? null : "URL required";
  if (!/^https:\/\//i.test(v)) return "URL must start with https://";
  if (v.length > 500) return "URL too long";
  return null;
}
