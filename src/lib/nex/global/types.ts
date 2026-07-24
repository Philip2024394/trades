// Nex Global Intelligence — contracts.
//
// This module EXTENDS Phase 20 world/ with:
//   • Country profiles (industry overview + typical materials + climate zone
//     + labour rate baseline + trade bodies)
//   • Clarification when Nex can't confidently resolve a location
//   • Regional terminology dictionary (drywall ↔ plasterboard, etc.)
//   • Regulation-preamble helper — spec-mandated
//     "I've answered using [X] for [country]" line
//
// It never duplicates Phase 20's RegionConfig / regulation-source
// data. It adds the layer that makes the reply feel local.

import type { Evidence } from "../pi/types";
import type { CountryCode } from "../world/types";
export type { CountryCode, Evidence };

/** Broad climate-zone label per country. Values here are conservative
 *  descriptions — a merchant may work across zones within a large
 *  country (Canada / Australia / US). */
export type ClimateZoneLabel = "temperate" | "temperate_wet" | "tropical" | "desert" | "cold" | "mixed";

export type CountryProfile = {
  country:            CountryCode;
  country_label:      string;
  industry_overview:  string;
  typical_materials:  string[];          // dominant construction methods/materials
  climate_zone:       ClimateZoneLabel;
  labour_baseline:    string;            // human-readable "£40–55/h skilled trade"
  currency_symbol:    string;
  trade_bodies:       Array<{ name: string; url: string | null }>;
  government_link:    { name: string; url: string | null };
  notes:              string[];
  evidence:           Evidence;
};

/** A regional term swap. `standard` is the term Nex uses internally;
 *  `local` is what merchants in that country actually say. Keep this
 *  short — every entry is manually curated. */
export type TerminologyEntry = {
  standard: string;
  local:    Partial<Record<CountryCode, string>>;
};

/** When Nex can't resolve a country with confidence, it emits a
 *  ClarificationRequest instead of guessing. The chat surface renders
 *  it as a "which country?" prompt. */
export type ClarificationRequest = {
  reason:   string;                      // "Location fell back to engine default."
  choices:  Array<{ code: CountryCode; label: string }>;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}
