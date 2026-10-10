// src/lib/nex/create-banners/sandbox/composition-v2/types.ts
//
// NEX Composition Engineering Wave · v2 typed spine · 2026-09-23
// ==============================================================
// Every type here is engine-agnostic (SDXL/other are the input source
// only; composition is NEX-owned). No third-party AI runtime. No new
// external service. Deterministic.
//
// Founder principle enforced across this module:
// "AI generates the visual. NEX creates the advertisement."

import type { BannerFormat } from "../../formats";

// ────────────────────────────────────────────────────────────────────────────
// § Element hierarchy — the multi-element ad model
// ────────────────────────────────────────────────────────────────────────────
export type LayoutElementKind =
  | "logo"
  | "eyebrow"
  | "headline"
  | "subheadline"
  | "benefit"
  | "icon_group"
  | "cta"
  | "trust_element"
  | "footer";

export interface LayoutElement {
  readonly kind: LayoutElementKind;
  readonly text?: string;
  readonly asset_ref?: string; // for logo / icon
  readonly required: boolean;
  readonly weight: number; // 0..1 · visual dominance target
}

// ────────────────────────────────────────────────────────────────────────────
// § Brand token system — replaces hardcoded colours
// ────────────────────────────────────────────────────────────────────────────
export interface BrandTokens {
  readonly primary: string; // hex
  readonly secondary: string;
  readonly accent: string;
  readonly text_on_dark: string; // e.g. #ffffff
  readonly text_on_light: string; // e.g. #0a0a0a
  readonly muted: string;
  readonly surface: string;
  readonly cta_fill: string;
  readonly cta_text: string;
}

export const DEFAULT_BRAND_TOKENS: BrandTokens = {
  primary: "#166534",
  secondary: "#1e293b",
  accent: "#facc15",
  text_on_dark: "#ffffff",
  text_on_light: "#0a0a0a",
  muted: "#64748b",
  surface: "#ffffff",
  cta_fill: "#facc15",
  cta_text: "#0a0a0a",
} as const;

// ────────────────────────────────────────────────────────────────────────────
// § Negative-space analysis — deterministic image intelligence
// ────────────────────────────────────────────────────────────────────────────
export interface NegativeSpaceCell {
  /** Grid X (0-indexed). */
  readonly gx: number;
  /** Grid Y (0-indexed). */
  readonly gy: number;
  /** Cell area in absolute pixels for the source image. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** 0 = uniform (empty) · 1 = maximally busy. */
  readonly busy_score: number;
  /** 0 = black · 1 = white · used to choose text colour. */
  readonly luminance: number;
  /** derived · true when busy_score <= threshold. */
  readonly is_text_safe: boolean;
  /** derived · light or dark tendency. */
  readonly tendency: "dark" | "mid" | "light";
}

export interface NegativeSpaceMap {
  readonly grid_cols: number;
  readonly grid_rows: number;
  readonly cell_w: number;
  readonly cell_h: number;
  readonly cells: readonly NegativeSpaceCell[];
  readonly source_width: number;
  readonly source_height: number;
  /**
   * Approximate location of the primary visual subject (in pixels). Derived
   * from the highest-density busy region.
   */
  readonly primary_subject_bbox: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  } | null;
}

// ────────────────────────────────────────────────────────────────────────────
// § Region — a rectangular composition region on the target canvas
// ────────────────────────────────────────────────────────────────────────────
export interface Region {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// ────────────────────────────────────────────────────────────────────────────
// § Layout candidate — one proposed layout for a target format
// ────────────────────────────────────────────────────────────────────────────
export interface LayoutCandidate {
  readonly candidate_id: string;
  readonly anchor: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "centre-strip";
  readonly regions: {
    readonly logo?: Region;
    readonly eyebrow?: Region;
    readonly headline?: Region;
    readonly subheadline?: Region;
    readonly benefits?: Region;
    readonly cta?: Region;
    readonly trust?: Region;
    readonly footer?: Region;
  };
  /**
   * Which side of the negative-space map this candidate targets. Used for
   * scoring; the scorer prefers candidates that align with the emptiest
   * area of the target-format-cropped image.
   */
  readonly targets_region_of_interest: "top" | "bottom" | "left" | "right" | "centre";
}

// ────────────────────────────────────────────────────────────────────────────
// § Layout score — deterministic composition quality
// ────────────────────────────────────────────────────────────────────────────
export interface LayoutScore {
  readonly candidate_id: string;
  readonly total: number;
  readonly breakdown: {
    readonly safe_zone_fit: number;
    readonly negative_space_alignment: number;
    readonly contrast_readability: number;
    readonly hierarchy_preserved: number;
    readonly no_collisions: number;
    readonly alignment_consistency: number;
    readonly balance: number;
  };
  readonly reasons: readonly string[];
}

// ────────────────────────────────────────────────────────────────────────────
// § Typography plan — dynamic auto-fit result per text element
// ────────────────────────────────────────────────────────────────────────────
export interface TypographyPlan {
  readonly font_family: string; // e.g. "Inter, Segoe UI, Arial, sans-serif"
  readonly font_weight: number;
  readonly font_size_px: number;
  readonly line_height_px: number;
  readonly wrapped_lines: readonly string[];
  readonly measured_width_px: number;
  readonly measured_height_px: number;
  readonly overflow: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// § Contrast plan — chosen text colour + optional treatment
// ────────────────────────────────────────────────────────────────────────────
export interface ContrastPlan {
  readonly text_color: string;
  readonly stroke_color: string | null;
  readonly stroke_width_px: number;
  readonly shadow: string | null; // svg drop-shadow filter string
  readonly backing:
    | { readonly kind: "none" }
    | {
        readonly kind: "gradient";
        readonly stops: readonly { readonly offset: number; readonly color: string }[];
      }
    | {
        readonly kind: "solid";
        readonly color: string;
        readonly opacity: number;
      };
}

// ────────────────────────────────────────────────────────────────────────────
// § Composition v2 result — full lineage for provenance
// ────────────────────────────────────────────────────────────────────────────
export interface CompositionV2Result {
  readonly kind: "SUCCESS" | "FAILURE";
  readonly composed_asset_absolute_path: string | null;
  readonly composed_asset_sha256: string | null;
  readonly composed_asset_bytes: number | null;
  readonly duration_ms: number;
  readonly failure_reason: string | null;

  // Full provenance & decisions the compositor made
  readonly chosen_candidate_id: string | null;
  readonly chosen_score: LayoutScore | null;
  readonly candidates_considered: readonly LayoutScore[];
  readonly typography: {
    readonly headline: TypographyPlan | null;
    readonly cta: TypographyPlan | null;
  };
  readonly contrast: {
    readonly headline: ContrastPlan | null;
    readonly cta: ContrastPlan | null;
  };
  readonly crop_applied: {
    readonly source_x: number;
    readonly source_y: number;
    readonly source_w: number;
    readonly source_h: number;
  } | null;
  readonly negative_space_summary: {
    readonly busy_fraction: number;
    readonly primary_subject_bbox:
      | NegativeSpaceMap["primary_subject_bbox"]
      | null;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// § Compose input for v2
// ────────────────────────────────────────────────────────────────────────────
export interface CompositionV2Input {
  readonly raw_generated_asset_absolute_path: string;
  readonly format: BannerFormat;
  readonly headline: string;
  readonly cta: string;
  readonly eyebrow?: string;
  readonly subheadline?: string;
  readonly trust_element?: string;
  readonly footer_line?: string;
  readonly brand_tokens?: BrandTokens;
  readonly logo_asset_absolute_path?: string | null;
  readonly output_absolute_path: string;
}

// Doctrine locks
export const _V2_COMPOSITION_IS_DETERMINISTIC = true as const;
export const _V2_COMPOSITION_NEVER_INTRODUCES_THIRD_PARTY_AI = true as const;
export const _V2_COMPOSITION_NEVER_MODIFIES_RAW_GENERATION = true as const;
export const _V2_COMPOSITION_PRESERVES_UNPROVEN_STATUS = true as const;
