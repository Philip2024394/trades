// Studio schema — TypeScript mirror of the SQL tables introduced in
// 20260703030000_studio_foundation.sql. Every Studio module imports
// these types instead of shaping ad-hoc payloads. Keeping the schema
// mirror colocated here means the DB and TS drift can only be reviewed
// in a single place.

// ─── Enumerations ──────────────────────────────────────────────────

export type BrandTokenKind =
  | "color"
  | "font"
  | "radius"
  | "spacing"
  | "shadow"
  | "logo"
  | "icon"
  | "button";

export type LayoutStatus = "draft" | "published" | "archived";

export type LayoutBreakpoint = "default" | "mobile" | "tablet" | "desktop";

export type SavedComponentScope = "personal" | "company";

export type LayoutEventKind =
  | "pick"
  | "edit"
  | "move"
  | "remove"
  | "publish"
  | "revert"
  | "view"
  | "convert"
  | "score";

// ─── Layout JSON shape ─────────────────────────────────────────────
// Persisted inside studio_layouts.layout_json. Every Studio consumer
// (renderer, editor, AI, score engine) reads exactly this shape.

/** One rendered section instance on a page. */
export type SectionInstance = {
  /** Section registry id, e.g. "hero.trade_vertical_1". */
  key: string;
  /** Per-instance config the section renderer needs (copy, image URLs,
   *  colour override, animation choice, etc.). Shape is dictated by the
   *  SectionRegistration.editableFields schema. */
  config: Record<string, unknown>;
  /** Optional per-instance overrides for design tokens (colour, radius,
   *  spacing) that the merchant explicitly set on THIS instance and want
   *  to detach from brand-token propagation. */
  tokenOverrides?: Record<string, unknown>;
  /** Merchant toggled Hide on this section — Module 9. Hidden sections
   *  render at 35% opacity + "Hidden" chip in edit mode so the merchant
   *  can un-hide, and are skipped entirely in preview / published mode. */
  hidden?: boolean;
  /** Per-breakpoint hide list — Module 12 responsive editing. The
   *  section renders on breakpoints NOT in this list. In edit mode
   *  hidden-on-current-BP sections still render at 40% opacity + a
   *  "Hidden on mobile" chip so the merchant can un-hide. */
  hiddenOn?: ("mobile" | "tablet" | "desktop")[];
  /** Stable identifier so drag-and-drop / animations track this instance
   *  even when its key changes (rare: happens when swapping variants). */
  instanceId: string;
};

/** One layout row. A row is a horizontal grouping of section instances
 *  that share a grid on wider viewports. Single-instance rows render
 *  full-width; multi-instance rows render `grid-cols-N` on desktop. */
export type LayoutRow = {
  id: string;
  columns: string[]; // instanceId[]
};

/** The full layout JSON. `sections` is the flat instance pool; `rows`
 *  gives their arrangement. Splitting them means moving instances
 *  between rows never rewrites their config, and merged/split rows
 *  don't create orphans. */
export type StudioLayoutJson = {
  sections: SectionInstance[];
  rows: LayoutRow[];
};

// ─── Table row types ──────────────────────────────────────────────

export type StudioBrand = {
  id: string;
  merchant_id: string;
  name: string;
  slug: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type StudioBrandToken = {
  id: string;
  brand_id: string;
  kind: BrandTokenKind;
  key: string;
  value_json: unknown;
  updated_at: string;
};

export type StudioLayout = {
  id: string;
  merchant_id: string;
  brand_id: string;
  page_id: string;
  breakpoint: LayoutBreakpoint;
  layout_json: StudioLayoutJson;
  status: LayoutStatus;
  version: number;
  parent_layout_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StudioSavedComponent = {
  id: string;
  merchant_id: string;
  brand_id: string | null;
  kind: string;
  name: string;
  config_json: Record<string, unknown>;
  scope: SavedComponentScope;
  source_layout_id: string | null;
  thumbnail_url: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

export type StudioLayoutEvent = {
  id: string;
  merchant_id: string | null;
  brand_id: string | null;
  page_id: string | null;
  section_key: string | null;
  layout_variant: string | null;
  event: LayoutEventKind;
  payload_json: Record<string, unknown> | null;
  created_at: string;
};

// ─── Helper constructors ──────────────────────────────────────────

/** Generates a stable id prefixed with the kind, e.g. `sec_ab12cd`.
 *  Kept short + URL-safe so instance IDs travel through query params
 *  and postMessage payloads without escaping headaches. */
export function studioId(prefix: "sec" | "row" | "layout" | "brand" | "token" = "sec"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

/** Empty layout — used when a merchant opens a page for the first time
 *  and hasn't picked any sections yet. Renderer treats this as "show the
 *  Section Library picker inline until the merchant chooses at least
 *  one section". */
export function emptyLayout(): StudioLayoutJson {
  return { sections: [], rows: [] };
}
