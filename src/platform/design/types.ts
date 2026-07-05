// Xrated Design System — types.
//
// The single source of truth for every visual component on the
// platform. Studio, Apps, Industry Packs, AI, and future templates
// all consume this registry rather than duplicating UI.
//
// Three surfaces per component:
//   • props    — style configuration (weight, size, alignment)
//   • content  — the payload (text, href, image URL, etc.) preserved
//                across component swaps
//   • theme    — read from React context via useDesignTheme()
//
// Zero hardcoded colours anywhere in a component's renderer.

import type { ComponentType } from "react";
import type { DesignTheme } from "./theme/types";

// ─── Categories ─────────────────────────────────────────────────

export type DesignComponentCategory =
  | "typography"
  | "buttons"
  | "containers"
  | "cards"
  | "forms"
  | "navigation"
  | "sections"
  | "media"
  | "overlays"
  | "feedback"
  | "data-display"
  | "inputs";

// ─── Content shape ─────────────────────────────────────────────
//
// Canonical payload contracts. Same-shape swaps preserve every field;
// cross-shape swaps go through a best-effort mapper (see preservation).

export type ContentShape =
  | "button"       // { label, href?, action?, icon? }
  | "typography"   // { text }
  | "card"         // { title?, subtitle?, image?, body?, actionLabel?, actionHref? }
  | "container"    // { childrenSlots?: string[] }
  | "form"         // { fields: FormField[], submitLabel }
  | "navigation"   // { items: NavItem[] }
  | "section"      // { heading?, subheading?, body?, children? }
  | "media";       // { url, alt?, caption? }

// ─── Editable property schema ──────────────────────────────────

export type EditablePropKind =
  | { kind: "text"; maxLength?: number; multiline?: boolean }
  | { kind: "number"; min?: number; max?: number; step?: number; unit?: string }
  | { kind: "color"; bindsTo?: string }
  | { kind: "select"; options: { value: string; label: string }[] }
  | { kind: "boolean" }
  | { kind: "link" }
  | { kind: "icon" };

export type EditableProp = {
  key: string;
  label: string;
  type: EditablePropKind;
  default: unknown;
  /** Optional group name so the editor can stack related props. */
  group?: string;
  /** True when AI is allowed to rewrite / regenerate this prop. */
  aiConfigurable?: boolean;
  /** Short helper text shown under the field in the editor toolbar. */
  description?: string;
};

// ─── Responsive behaviour ──────────────────────────────────────

export type ResponsiveMode =
  | "unchanged"
  | "stack"
  | "compact"
  | "hide"
  | "collapse"
  | "carousel"
  | "sticky";

export type ResponsiveBehaviour = {
  mobile?: ResponsiveMode;
  tablet?: ResponsiveMode;
  desktop?: ResponsiveMode;
};

// ─── The registration ──────────────────────────────────────────

export type DesignComponentRegistration<
  TProps extends Record<string, unknown> = Record<string, unknown>,
  TContent extends Record<string, unknown> = Record<string, unknown>
> = {
  /** Namespaced id: `<category>.<name>`. e.g. `buttons.primary`. */
  id: string;
  /** Human-readable name for the picker + toolbar. */
  name: string;
  category: DesignComponentCategory;
  /** One-line pitch. Rendered in the picker card + AI search. */
  description: string;
  /** Semver — used by config migrations if the schema evolves. */
  version: string;
  /** Content payload shape — drives content preservation on swap. */
  contentShape: ContentShape;
  /** All props the merchant can tweak in the editor toolbar. */
  editableProps: EditableProp[];
  /** Theme token keys this component reads (e.g. "color.primary",
   *  "font.heading"). Documents theme dependencies; the theme validator
   *  cross-checks that every listed token exists on the active theme. */
  themeTokensUsed: string[];
  /** Named animations this component supports. */
  animations: string[];
  /** How the component adapts across breakpoints. */
  responsive: ResponsiveBehaviour;
  /** Optional list of container ids this component slots cleanly into. */
  compatibleLayouts?: string[];
  /** Keywords for AI search. Independent of description so short
   *  labels + synonyms don't clutter merchant-facing copy. */
  searchKeywords: string[];
  /** Starter props on insertion. */
  defaultProps: () => TProps;
  /** Starter content on insertion. */
  defaultContent: () => TContent;
  /** The pure React component that renders this design component. */
  renderer: ComponentType<DesignComponentRendererProps<TProps, TContent>>;

  // ─── Platform Constitution v1 fields (all optional) ────────────
  //
  // Mirror the fields added to RegistrationBase in Milestone 1/2 so
  // AI + marketplace + a11y audits have uniform metadata across
  // registered components.
  tags?: readonly string[];
  author?: string;
  compatibleContainers?: readonly string[];
  compatibleThemes?: readonly string[];
  supportedDevices?: readonly ("mobile" | "tablet" | "desktop")[];
  accessibilityStatus?: "wcag-aaa" | "wcag-aa" | "wcag-a" | "unverified";
  performanceCost?: "low" | "medium" | "high";
  documentationUrl?: string;

  /** Container tier (Constitution Amendment 6 §RGP-7).
   *  Required for `category === "containers"`; ignored otherwise. */
  tier?: "layout" | "content" | "utility";

  /** Legacy ids that transparently resolve to this component. Powers
   *  stable references across renames + composition-as-alias
   *  (`containers.grid` aliases `gallery` and `pricing` per ADR-012). */
  aliases?: readonly string[];
};

/** Every renderer receives exactly this shape. Theme comes from
 *  context — passed here as a prop only for the preview harness where
 *  bypassing the context is useful for A/B previews. */
export type DesignComponentRendererProps<
  TProps,
  TContent
> = {
  props: TProps;
  content: TContent;
  /** Optional theme override for preview surfaces. Runtime renders
   *  should leave this undefined so the component reads the active
   *  theme from useDesignTheme(). */
  themeOverride?: DesignTheme;
};

// ─── Type-erased convenience ───────────────────────────────────

export type AnyDesignComponentRegistration = DesignComponentRegistration<
  Record<string, unknown>,
  Record<string, unknown>
>;

/** Frozen registration — what the registry returns. */
export type FrozenDesignComponent = Readonly<AnyDesignComponentRegistration>;

// ─── Instance ──────────────────────────────────────────────────

/** Runtime shape when a component appears in a layout or slot.
 *  Instance carries the id + tuned props + content. Theme is applied
 *  from the surrounding context. */
export type DesignComponentInstance = {
  id: string;
  props: Record<string, unknown>;
  content: Record<string, unknown>;
};
