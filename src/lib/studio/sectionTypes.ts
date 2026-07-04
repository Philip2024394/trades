// Section Registry — type surface.
//
// Every section (hero, product grid, banner, testimonials, footer, etc.)
// self-registers with a SectionRegistration<TConfig>. Renderer, editor
// toolbar, Library UI, AI features, Design Score engine, and Smart
// Recommendations all consume ONLY this contract — never touch the
// section internals directly. Adding a new section is one file.

import type { ComponentType, ReactNode } from "react";

// ─── The 18 canonical section libraries ────────────────────────────
//
// Adding a new library is a code change (renderer + editor need to
// understand what a new library implies). New sections within an
// existing library are single-file additions.

export type SectionLibrary =
  | "hero"
  | "product_grid"
  | "categories"
  | "banner"
  | "services"
  | "features"
  | "testimonials"
  | "faq"
  | "gallery"
  | "video"
  | "pricing"
  | "statistics"
  | "brands"
  | "team"
  | "newsletter"
  | "contact"
  | "map"
  | "footer"
  | "cta";

// ─── Editable field schema ─────────────────────────────────────────
//
// Every editable field the merchant can touch in the toolbar is
// described here. The editor uses this schema to render form inputs;
// the renderer receives resolved values as `config`; the AI reads the
// schema to know which fields are copy vs media vs style.

export type EditableFieldKind =
  | { kind: "text"; maxLength?: number; multiline?: boolean }
  | { kind: "rich_text" }
  | { kind: "image"; aspectRatio?: string; recommendedWidthPx?: number }
  | { kind: "color"; brandBindable?: boolean }
  | { kind: "number"; min?: number; max?: number; step?: number; unit?: string }
  | { kind: "select"; options: { value: string; label: string }[] }
  | { kind: "boolean" }
  | { kind: "link"; allowInternal?: boolean; allowExternal?: boolean }
  | { kind: "icon" }
  | { kind: "animation" };

/** Selection-priority tag on editable fields that render as their own
 *  DOM element. Powers three downstream systems:
 *
 *  1. Priority-routed selection (Module 1.2) — when a click lands on
 *     nested addressable elements, the router picks the highest-priority
 *     leaf. Priority chain, innermost to outermost:
 *       text → image → button → card → container → section → page
 *  2. Toolbar tool-set (Module 2) — text priority shows text tools,
 *     image priority shows image tools, etc.
 *  3. Keyboard shortcut routing (Module 1.6 + Module 13) — e.g. "Cmd+I"
 *     opens the image picker when a priority=image element is selected.
 *
 *  Fields without a corresponding DOM node (like URL hrefs, opacity
 *  numbers, boolean flags) leave this undefined — nothing to select. */
export type SelectionPriority =
  | "text"
  | "image"
  | "button"
  | "card"
  | "container";

/** Semantic role — the MEANING of a field, independent of the field
 *  type or the section it lives in. Powers the Universal Smart Section
 *  Engine (variant/category swap that preserves merchant content).
 *
 *  Rule: two fields with the same role carry the same meaning even if
 *  their `key` differs. Swap engine matches by role first, key second,
 *  so a Hero A `heading` (role: "headline") carries into Hero B
 *  `mainTitle` (role: "headline") without merchant intervention.
 *
 *  Adding a role is a schema change — coordinate with the swap engine
 *  in `smartSwap.ts` so orphan detection stays accurate. */
export type SemanticRole =
  // ─── Copy ────────────────────────────────────
  | "eyebrow"
  | "headline"
  | "subhead"
  | "body"
  | "supporting_copy"
  | "quote"
  | "quote_author"
  | "question"
  | "answer"
  | "step_title"
  | "step_body"
  | "list_item"
  | "caption"
  | "location_label"
  | "disclaimer"
  // ─── Actions ─────────────────────────────────
  | "primary_action_label"
  | "primary_action_href"
  | "secondary_action_label"
  | "secondary_action_href"
  // ─── Commerce ────────────────────────────────
  | "price_value"
  | "price_currency"
  | "price_period"
  | "product_name"
  | "product_badge"
  | "feature_line"
  | "discount_label"
  // ─── Media ───────────────────────────────────
  | "background_media"
  | "hero_media"
  | "gallery_media"
  | "logo_media"
  | "avatar_media"
  | "video_url"
  | "video_poster"
  // ─── Data / social proof ─────────────────────
  | "stat_value"
  | "stat_unit"
  | "stat_label"
  | "rating_value"
  | "rating_count"
  | "trust_line"
  // ─── Meta ────────────────────────────────────
  | "surface_mode"
  | "layout_variant"
  | "opacity"
  | "position_x"
  | "position_y"
  // ─── Button-scoped intents (Button Studio) ──
  | "cta_book"
  | "cta_buy"
  | "cta_quote"
  | "cta_contact"
  | "cta_download"
  | "cta_subscribe"
  | "cta_join"
  | "cta_learn_more"
  | "cta_call"
  | "cta_whatsapp"
  | "cta_email";

export type EditableField = {
  /** Key inside the section's `config` object. */
  key: string;
  /** Human-readable label shown in the editor toolbar. */
  label: string;
  /** How the merchant edits it. */
  type: EditableFieldKind;
  /** Default value when a new instance is created. */
  default: unknown;
  /** Selection-priority tag — see SelectionPriority above. Set on
   *  fields that render as a visible DOM element the merchant can
   *  click. Leave undefined for URL / number / boolean fields whose
   *  value is used but not directly rendered. */
  priority?: SelectionPriority;
  /** Semantic role — the MEANING of this field, independent of key
   *  or type. See SemanticRole above. Powers the Universal Smart
   *  Section Engine: swapping a section preserves the value of every
   *  field whose role matches on the target. */
  role?: SemanticRole;
  /** Whether AI is allowed to rewrite / regenerate this field.
   *  Prevents the AI Assistant from touching structural fields. */
  aiPromptable?: boolean;
  /** Optional binding to a brand token, e.g. "brand.color.primary".
   *  Editing the brand token updates every instance bound to it. */
  bindsTo?: string;
  /** Short helper text shown under the field in the toolbar. */
  description?: string;
  /** Group name for stacking related fields in the toolbar. */
  group?: string;
};

// ─── AI prompt templates ──────────────────────────────────────────
//
// The AI Gateway reads these when a merchant triggers AI Explain, AI
// Improve, AI Score, etc. Templates are per-section so the AI has
// section-specific context (e.g. "this is a plant hire hero — the CTA
// should mention machinery / delivery").

export type AiPromptSet = {
  /** "Why does this section work? Where does it fail?" — used by AI
   *  Explain on hover. */
  explain: string;
  /** "Improve this instance without changing the layout." — used by
   *  AI Improve button. */
  improve: string;
  /** "Rewrite this copy in a {tone} voice." — used by inline text
   *  rewrite. */
  rewrite: string;
  /** "Which section in the same library would work better here?" —
   *  used by Smart Layout Recommendations. */
  suggestAlternative: string;
  /** "Score this section against loading / a11y / sales / SEO /
   *  mobile / brand consistency." — used by AI Design Score. */
  score: string;
};

// ─── Score hints ──────────────────────────────────────────────────
//
// Hints the AI Design Score engine uses to evaluate this section.
// Deterministic heuristics run first (cheap); AI passes fill in the
// judgment calls.

export type ScoreHints = {
  loading?: {
    imageWeightBudgetKb?: number;
    blockingResources?: string[];
  };
  accessibility?: {
    contrastMin?: number;
    requiredAlt?: string[];
  };
  sales?: {
    ctaAboveFold?: boolean;
    primaryActionRequired?: boolean;
    socialProofRecommended?: boolean;
  };
  seo?: {
    headingLevel?: 1 | 2 | 3;
    structuredData?: string;
  };
  mobile?: {
    minTapTargetPx?: number;
    noHorizontalScroll?: boolean;
  };
  brandConsistency?: {
    /** Config keys that MUST be bound to brand tokens for full score. */
    boundTokens: string[];
  };
};

// ─── Renderer contract ────────────────────────────────────────────
//
// Every section renderer is a React component that accepts this exact
// prop shape. Uniform contract means the shell doesn't care which
// section it's rendering.

export type MerchantData = {
  merchantId: string;
  slug: string;
  merchantName: string;
  city: string;
  whatsappHref: string | null;
  brandName: string;
  /** Vertical-specific data the section may need. Type-erased here;
   *  each section that needs data casts + validates. */
  domain: Record<string, unknown>;
};

/** Brand tokens as a flat map keyed by "kind.key" (e.g. "color.primary",
 *  "font.heading", "radius.md"). Renderers use `tokens["color.primary"]`
 *  or read via the studioTokens() helper. */
export type BrandTokens = Record<string, unknown>;

export type SectionRenderMode = "preview" | "edit" | "published";

export type SectionRendererProps<TConfig> = {
  instanceId: string;
  config: TConfig;
  tokens: BrandTokens;
  data: MerchantData;
  mode: SectionRenderMode;
};

// ─── Variants ─────────────────────────────────────────────────────
//
// A section can ship with named variants — same renderer, different
// baseline config. Think Figma component variants. Merchant sees the
// variants as a mini-carousel in the Library UI.

export type SectionVariant<TConfig> = {
  id: string;
  name: string;
  configOverride: Partial<TConfig>;
  thumbnail: string;
};

// ─── The registration itself ──────────────────────────────────────

export type SectionRegistration<TConfig extends Record<string, unknown> = Record<string, unknown>> = {
  /** Namespaced id: "hero.plant_hire_bold_1", "product_grid.classic_3col". */
  id: string;
  /** Human-readable name for the Library UI + toolbar. */
  name: string;
  /** Semver — used by config migrations when schema evolves. */
  version: string;
  /** Which library this section belongs to. */
  library: SectionLibrary;
  /** Short one-line pitch for the Library UI card. */
  description: string;
  /** All fields the merchant can edit. Drives the toolbar form. */
  editableFields: EditableField[];
  /** Named animations this section supports, e.g. "fade", "slide-up". */
  animations: string[];
  /** AI Gateway prompt templates for this section. */
  aiPrompts: AiPromptSet;
  /** URL to the Library UI thumbnail. */
  thumbnail: string;
  /** Score-engine hints. */
  scoreHints?: ScoreHints;
  /** Tags for telemetry grouping (Live Component Intelligence uses
   *  these to slice usage stats). */
  telemetryTags: string[];
  /** Verticals this section is best for. Powers "Best for Builders
   *  Merchants" badge in the Library UI. */
  bestForVerticals?: string[];
  /** Factory returning a starter config when a merchant picks this
   *  section fresh. */
  defaultConfig: () => TConfig;
  /** The React component that renders this section. Must be pure —
   *  never reach for I/O, cookies, or external state. All data enters
   *  via props. */
  renderer: ComponentType<SectionRendererProps<TConfig>>;
  /** Optional variants — same renderer, different baseline configs. */
  variants?: SectionVariant<TConfig>[];
};

// Convenience: a registration with type erasure for storing in the Map.
export type AnySectionRegistration = SectionRegistration<Record<string, unknown>>;

// A ready-to-render section node — the shell composes these.
export type SectionNode = {
  instanceId: string;
  registration: AnySectionRegistration;
  config: Record<string, unknown>;
  children?: ReactNode;
};
