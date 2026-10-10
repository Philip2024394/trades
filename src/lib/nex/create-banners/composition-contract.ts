// src/lib/nex/create-banners/composition-contract.ts
//
// NEX Create Banners · Composition seam · Founder Authorisation A · 2026-09-23
// ============================================================================
// The composition layer is NEX-owned. It receives the raw generated visual
// plus the NEX-controlled overlay data (copy, logo, brand colours, safe
// zones) and produces the final banner asset. Text is NEVER rendered by
// the pixel engine — see D9 text-safety and concept.ts guard.

import type { BannerConcept, CopyRequirements, BannerVariant } from "./types";
import type { BannerFormat } from "./formats";

export interface CompositionRequest {
  readonly composition_request_id: string;
  readonly variant_id: string;
  readonly raw_generated_asset_path: string;
  readonly format: BannerFormat;
  readonly copy: CopyRequirements;
  readonly brand: {
    readonly logo_asset_path_or_null: string | null;
    readonly colour_palette_hex: readonly string[];
    readonly must_include_logo: boolean;
  };
  readonly safe_zones: readonly SafeZone[];
}

export interface SafeZone {
  readonly zone_id: string;
  readonly role: "headline" | "offer" | "cta" | "logo" | "phone" | "url";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CompositionResult {
  readonly result_id: string;
  readonly variant_id: string;
  readonly kind: "SUCCESS" | "FAILURE";
  readonly composed_asset_path: string | null;
  readonly composed_asset_sha256: string | null;
  readonly composed_at: string;
  readonly failure_reason: string | null;
}

/**
 * Composition seam. Real implementations may use Sharp/svg-renderer/etc.
 * At Authorisation A time this contract exists but no default implementation
 * is bundled — an implementation is a separate authorised piece of work.
 */
export interface CompositionEngine {
  readonly engine_slug: "nex.create_banners.composition_engine";
  compose(request: CompositionRequest): Promise<CompositionResult>;
}

/**
 * Derives safe zones for a variant from concept + format hints. Deterministic.
 */
export function planSafeZones(
  concept: BannerConcept,
  format: BannerFormat
): readonly SafeZone[] {
  const zones: SafeZone[] = [];
  const w = format.width;
  const h = format.height;
  const marginX = Math.round(w * 0.05);
  const marginY = Math.round(h * 0.05);

  if (concept.copy_requirements.headline) {
    zones.push({
      zone_id: "headline",
      role: "headline",
      x: marginX,
      y: marginY,
      width: w - marginX * 2,
      height: Math.round(h * 0.15),
    });
  }
  if (concept.copy_requirements.offer) {
    zones.push({
      zone_id: "offer",
      role: "offer",
      x: marginX,
      y: Math.round(h * 0.7),
      width: w - marginX * 2,
      height: Math.round(h * 0.1),
    });
  }
  if (concept.copy_requirements.cta) {
    zones.push({
      zone_id: "cta",
      role: "cta",
      x: marginX,
      y: h - Math.round(h * 0.15) - marginY,
      width: w - marginX * 2,
      height: Math.round(h * 0.1),
    });
  }
  return zones;
}

export const _COMPOSITION_IS_NEX_OWNED_NEVER_ENGINE_RENDERED = true as const;
export const _COMPOSITION_CONTRACT_HAS_NO_DEFAULT_IMPLEMENTATION_AT_AUTH_A =
  true as const;
export type BannerVariantForComposition = Pick<
  BannerVariant,
  "variant_id" | "format_id" | "concept_id"
>;
