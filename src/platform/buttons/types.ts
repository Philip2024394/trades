// Xrated Button Studio — type surface.
//
// One vocabulary shared by the registry, the state machine, the theme
// adapter, the swap engine, and every button renderer. Adding a new
// button type is a single file — it imports these types, registers,
// done.
//
// Design rules baked in:
//   • Every button carries a semantic role. The role dictates default
//     appearance, state machine, telemetry, a11y label, and AI tone.
//   • Every visual field reads from brand tokens by default — no
//     hardcoded colours in renderer bodies.
//   • Every renderer is a pure React component. Studio preview,
//     published pages, and email templates all use the same renderer.

import type { ComponentType } from "react";
import type {
  BrandTokens,
  EditableField,
  MerchantData,
  SectionRenderMode
} from "@/lib/studio/sectionTypes";

// ─── Semantic role — the MEANING of a button ─────────────────────

export type ButtonRole =
  // Generic actions
  | "primary_action"
  | "secondary_action"
  | "danger_action"
  | "success_action"
  // Marketing intent
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
  | "cta_email"
  | "cta_messenger"
  // Commerce
  | "add_to_cart"
  | "buy_now"
  | "checkout"
  | "wishlist"
  | "compare"
  | "preorder"
  | "notify_me"
  | "quick_view"
  // Navigation
  | "nav_previous"
  | "nav_next"
  | "nav_back"
  | "nav_continue"
  | "nav_home"
  | "nav_menu"
  | "nav_search"
  | "nav_filter"
  | "nav_sort"
  // Social share
  | "share_facebook"
  | "share_instagram"
  | "share_tiktok"
  | "share_youtube"
  | "share_linkedin"
  | "share_pinterest"
  | "share_x"
  | "share_whatsapp"
  // Utility
  | "util_upload"
  | "util_download"
  | "util_print"
  | "util_copy"
  | "util_share"
  | "util_save"
  | "util_delete"
  | "util_undo"
  | "util_redo"
  // Floating / persistent
  | "floating_action"
  | "sticky_cta"
  | "scroll_to_top"
  | "corner_button"
  // Interactive containers
  | "expandable"
  | "split_button"
  | "dropdown"
  | "menu_trigger"
  | "toggle"
  | "chip"
  | "tag"
  | "segment";

// ─── Category — coarse grouping for the picker UI ────────────────

export type ButtonCategory =
  | "basic"
  | "marketing"
  | "ecommerce"
  | "navigation"
  | "social"
  | "utility"
  | "floating"
  | "interactive";

// ─── Style family — 18 mood variants applied as brand deltas ────

export type ButtonStyleFamily =
  | "modern"
  | "corporate"
  | "luxury"
  | "glass"
  | "minimal"
  | "neumorphism"
  | "soft_ui"
  | "material"
  | "apple"
  | "google"
  | "construction"
  | "industrial"
  | "bold"
  | "elegant"
  | "creative"
  | "dark"
  | "light"
  | "high_contrast";

// ─── Shape ───────────────────────────────────────────────────────

export type ShapeSpec =
  | { kind: "rect"; radiusPx: number }
  | { kind: "rounded"; perCornerPx: [number, number, number, number] } // tl, tr, br, bl
  | { kind: "pill" }
  | { kind: "circle" }
  | { kind: "capsule" }
  | { kind: "cut_corners"; corner: "tl" | "tr" | "br" | "bl" | "both"; depthPx: number }
  | { kind: "diamond" }
  | { kind: "hex" }
  | { kind: "arrow"; direction: "left" | "right" }
  | { kind: "ribbon" }
  | { kind: "ticket" }
  | { kind: "svg_mask"; url: string };

// ─── Size ────────────────────────────────────────────────────────

export type ButtonSize =
  | "xs" // 28px — icon only or tiny chip; NOT allowed for interactive without warning
  | "sm" // 36px
  | "md" // 44px — WCAG minimum tap target
  | "lg" // 52px
  | "xl" // 60px
  | { customPx: number };

// ─── State machine ───────────────────────────────────────────────

export type ButtonState =
  | "default"
  | "hover"
  | "focus_visible"
  | "pressed"
  | "active"
  | "loading"
  | "success"
  | "error"
  | "visited"
  | "disabled";

/** Per-state overrides. Every field is optional — missing state falls
 *  back to `default`. */
export type StateOverrides = Partial<{
  backgroundToken: string; // "color.accent"
  backgroundLiteral: string;
  inkToken: string;
  inkLiteral: string;
  borderToken: string;
  borderLiteral: string;
  borderWidthPx: number;
  shadowPreset: ShadowPreset;
  scale: number; // multiplier
  translateYPx: number;
  translateXPx: number;
  opacity: number;
  motionPreset: MotionPreset;
}>;

export type ShadowPreset =
  | "none"
  | "soft"
  | "hard"
  | "floating"
  | "glow"
  | "inner"
  | "long"
  | "glass"
  | "ambient"
  | "layered"
  | "neumorphic";

// ─── Motion ──────────────────────────────────────────────────────

export type MotionPreset =
  | "none"
  | "fade"
  | "grow"
  | "shrink"
  | "lift"
  | "slide"
  | "push"
  | "magnetic"
  | "ripple"
  | "pulse"
  | "bounce"
  | "glow"
  | "rotate"
  | "flip"
  | "stretch"
  | "border_draw"
  | "underline_grow"
  | "icon_slide"
  | "arrow_reveal"
  | "liquid_fill"
  | "wave"
  | "spotlight"
  | "morph"
  | "gradient_shift"
  | "mouse_follow"
  // Loading / success / error stitchers
  | "spinner"
  | "dots"
  | "progress_ring"
  | "checkmark_morph"
  | "shake"
  | "spring";

export type MotionSpec = {
  entrance?: MotionPreset;
  hover?: MotionPreset;
  focus?: MotionPreset;
  press?: MotionPreset;
  loading?: MotionPreset;
  success?: MotionPreset;
  error?: MotionPreset;
  idle?: MotionPreset;
};

// ─── A11y ────────────────────────────────────────────────────────

export type A11ySpec = {
  /** Default aria-label formatter — `(config) => string`. Overridable
   *  per instance. */
  ariaLabelFor: (config: Record<string, unknown>) => string;
  /** Whether this button carries a landmark role (e.g. "menu" for a
   *  menu trigger). */
  role?: "button" | "link" | "menu" | "menuitem" | "switch" | "tab";
  /** Whether the button needs an aria-pressed / aria-expanded flag. */
  toggleFlag?: "aria-pressed" | "aria-expanded";
  /** Whether Enter and Space both activate (buttons yes, links only
   *  Enter). */
  activateOnSpace: boolean;
};

// ─── Conversion hints ────────────────────────────────────────────

export type ConversionHints = {
  primaryActionRecommended: boolean;
  aboveFoldRecommended: boolean;
  minContrast: number; // default 4.5
  minTapTargetPx: number; // default 44
};

// ─── AI prompt set ───────────────────────────────────────────────

export type ButtonAiPromptSet = {
  explain: string;
  improveCopy: string;
  improveStyle: string;
  restyle: string;
  generateFromBrief: string;
  scoreConversion: string;
  scoreAccessibility: string;
  suggestIcon: string;
};

// ─── The registration ───────────────────────────────────────────

export type ButtonRegistration<
  TConfig extends Record<string, unknown> = Record<string, unknown>
> = {
  /** Namespaced id: `<role_group>.<variant>`, e.g. `primary.solid_1`,
   *  `whatsapp.pill_1`. */
  id: string;
  name: string;
  version: string;
  category: ButtonCategory;
  role: ButtonRole;
  description: string;
  shortPitch: string;
  /** Merchant-editable fields — reuses the section EditableField shape
   *  so the toolbar auto-generates the editor. */
  editableFields: EditableField[];
  /** Default state overrides for every state this variant supports. */
  states: Partial<Record<ButtonState, StateOverrides>>;
  motion: MotionSpec;
  shape: ShapeSpec;
  size: ButtonSize;
  /** Brand tokens this button reads. Documents dependency for the
   *  Design Score engine and blocks palette-swap silent breakage. */
  themeTokensUsed: string[];
  a11y: A11ySpec;
  telemetry: {
    eventOnClick: string;
    payloadKeys: string[];
  };
  conversionHints: ConversionHints;
  aiPrompts: ButtonAiPromptSet;
  /** Keywords for AI search. */
  searchKeywords: string[];
  /** Verticals this button lands best in — powers merchant-vertical
   *  starter picks. */
  bestForVerticals?: string[];
  defaultConfig: () => TConfig;
  renderer: ComponentType<ButtonRendererProps<TConfig>>;
};

// ─── Renderer contract ──────────────────────────────────────────

export type ButtonRendererProps<
  TConfig extends Record<string, unknown> = Record<string, unknown>
> = {
  instanceId: string;
  config: TConfig;
  state: ButtonState;
  tokens: BrandTokens;
  role: ButtonRole;
  size: ButtonSize;
  shape: ShapeSpec;
  motion: MotionSpec;
  data: MerchantData;
  mode: SectionRenderMode;
  onEvent?: (kind: ButtonTelemetryEvent) => void;
};

export type ButtonTelemetryEvent = {
  event: "view" | "hover" | "focus" | "click" | "success" | "error";
  metadata?: Record<string, unknown>;
};

/** Instance shape a page stores. Kept minimal — everything visual is
 *  derived from `variantKey` + `states` + `motion` + `shape`. */
export type ButtonInstance = {
  instanceId: string;
  variantKey: string;
  role: ButtonRole;
  config: Record<string, unknown>;
  states?: Partial<Record<ButtonState, StateOverrides>>;
  motion?: Partial<MotionSpec>;
  shape?: Partial<ShapeSpec>;
  size?: ButtonSize;
  responsive?: Partial<Record<"mobile" | "tablet" | "desktop", Partial<ButtonInstance>>>;
  visibility?: Record<"mobile" | "tablet" | "desktop", boolean>;
  /** Global-button reference — if set, this instance inherits from the
   *  brand's Global for this role, with local overrides applied on top. */
  globalRef?: { role: string; version: number };
  meta?: { testId?: string; ariaLabelOverride?: string };
};

/** Frozen registration — what the registry returns. */
export type FrozenButtonRegistration = Readonly<
  ButtonRegistration<Record<string, unknown>>
>;
