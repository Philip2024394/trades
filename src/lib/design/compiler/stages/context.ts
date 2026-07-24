// Stage 2 — Context resolution.
//
// Merges every non-brand contextual signal into the compiler's working
// state: which trade, which locale, print vs digital surface, time of
// year for seasonal marketing, and any A/B experiment flag. Nothing
// AI-generated — purely deterministic lookup + light heuristics.

import type { DesignIR } from "../ir";

export const CONTEXT_STAGE_VERSION = "1.0.0";

export type ResolvedContext = {
  trade:         string;
  region:        "UK" | "IE";
  surface_kind:  "print" | "digital" | "vehicle" | "textile" | "signage";
  season:        "winter" | "spring" | "summer" | "autumn";
  experiment?:   string;
  version:       string;
};

const PRINT_SURFACES = new Set(["business-card", "invoice", "letterhead", "print"]);
const DIGITAL_SURFACES = new Set(["website", "social", "email-signature"]);
const TEXTILE_SURFACES = new Set(["workwear"]);

export function resolveContext(ir: DesignIR): ResolvedContext {
  const surface = ir.intent.surface;
  const surface_kind =
    PRINT_SURFACES.has(surface)   ? "print"    :
    DIGITAL_SURFACES.has(surface) ? "digital"  :
    TEXTILE_SURFACES.has(surface) ? "textile"  :
    surface === "signage"          ? "signage"  :
    "vehicle";

  const month = new Date().getUTCMonth();
  const season =
    month <= 1 || month === 11 ? "winter" :
    month <= 4                 ? "spring" :
    month <= 7                 ? "summer" :
    "autumn";

  return {
    trade:         ir.trade,
    region:        "UK",
    surface_kind,
    season,
    version:       CONTEXT_STAGE_VERSION
  };
}
