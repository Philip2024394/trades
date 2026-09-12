// src/lib/nex/master-ai/connectivity-domain.ts
//
// NEX Master AI Engineer · Wave 4 · W4-B · NEX Connectivity Intelligence
// Philip 2026-09-07 · AUTHORIZE (Wave-4 continuous mission)
//
// The DOMAIN VOCABULARY Master AI uses to reason about connectivity.
//
// PRESERVATION:
//   · Catalogues here list what EXISTS in the world (spectrum bands,
//     architecture patterns, business models). They are neutral —
//     they do NOT claim Indonesian legal status.
//   · Legal / regulatory status is a SEPARATE ledger (connectivity-
//     regulation.ts) and every finding must carry a categorisation +
//     evidence tier.
//   · No finding is ever presented as FACT without TIER_1/TIER_2
//     evidence · empty state is UNKNOWN (never invented).

// ─── Categorisation (mandatory on every regulation finding) ─────────
export type ConnectivityLegalCategory =
  | "ALLOWED_NOW"                                 // legal, no license required
  | "REQUIRES_LICENSE"                            // legal but needs formal authorization
  | "REQUIRES_PARTNERSHIP"                        // must work with a licensed operator
  | "POSSIBLE_PILOT"                              // sandboxable via regulator pilot programme
  | "UNKNOWN";                                    // insufficient evidence · flag for further research

// ─── Spectrum options (world catalogue · neutral) ───────────────────
export type SpectrumBand = {
  band_slug: string;                              // "2.4ghz_isb"
  band_name: string;                              // "2.4 GHz ISM"
  centre_frequency_mhz: number;
  typical_channel_bw_mhz: number[];
  common_use: string;                             // "Wi-Fi 802.11b/g/n/ax"
  notes: string;                                  // neutral · no jurisdiction claims
};

export const SPECTRUM_CATALOGUE: readonly SpectrumBand[] = Object.freeze([
  Object.freeze({
    band_slug: "2_4ghz_isb", band_name: "2.4 GHz ISM",
    centre_frequency_mhz: 2450, typical_channel_bw_mhz: [20, 40],
    common_use: "Wi-Fi 802.11b/g/n/ax · Bluetooth · Zigbee",
    notes: "Globally unlicensed in most jurisdictions but heavily congested. Verify local rules.",
  }),
  Object.freeze({
    band_slug: "5ghz_unii", band_name: "5 GHz UNII",
    centre_frequency_mhz: 5500, typical_channel_bw_mhz: [20, 40, 80, 160],
    common_use: "Wi-Fi 802.11a/n/ac/ax",
    notes: "Multiple sub-bands with different rules (DFS, indoor-only, EIRP caps). Verify per-country.",
  }),
  Object.freeze({
    band_slug: "6ghz_unii", band_name: "6 GHz UNII-5/6/7/8",
    centre_frequency_mhz: 6425, typical_channel_bw_mhz: [20, 40, 80, 160, 320],
    common_use: "Wi-Fi 6E / Wi-Fi 7",
    notes: "Not open in every country. Verify Indonesian regulator status before deployment.",
  }),
  Object.freeze({
    band_slug: "60ghz_mmw", band_name: "60 GHz mmWave",
    centre_frequency_mhz: 60000, typical_channel_bw_mhz: [2160],
    common_use: "802.11ad/ay high-capacity short-range backhaul",
    notes: "High bandwidth, short range, line-of-sight. Weather-sensitive.",
  }),
  Object.freeze({
    band_slug: "sub_ghz_isb", band_name: "Sub-GHz ISM",
    centre_frequency_mhz: 915, typical_channel_bw_mhz: [1, 2, 5],
    common_use: "LoRa · Zigbee · long-range IoT",
    notes: "Long range, low bandwidth. Not suitable for general internet.",
  }),
] as const);

// ─── Architecture options (patterns · neutral) ──────────────────────
export type ArchitectureTopology =
  | "POINT_TO_POINT"
  | "POINT_TO_MULTIPOINT"
  | "MESH"
  | "STAR_HUB"
  | "TREE_BACKHAUL";

export type ArchitecturePattern = {
  pattern_slug: string;
  name: string;
  topology: ArchitectureTopology;
  suits_user_count_range: { min: number; max: number };
  typical_upstream_dependency: "FIBRE" | "MICROWAVE" | "SATELLITE" | "CELLULAR_UPLINK";
  strengths: string[];
  weaknesses: string[];
};

export const ARCHITECTURE_CATALOGUE: readonly ArchitecturePattern[] = Object.freeze([
  Object.freeze({
    pattern_slug: "single_hub_wifi",
    name: "Single NEX Hub with local Wi-Fi",
    topology: "STAR_HUB",
    suits_user_count_range: { min: 10, max: 100 },
    typical_upstream_dependency: "FIBRE",
    strengths: ["simple ops", "low capex", "fast to deploy"],
    weaknesses: ["single point of failure", "coverage limited to one radio horizon"],
  }),
  Object.freeze({
    pattern_slug: "hub_and_spoke_ptmp",
    name: "Hub-and-spoke with point-to-multipoint backhaul",
    topology: "POINT_TO_MULTIPOINT",
    suits_user_count_range: { min: 50, max: 500 },
    typical_upstream_dependency: "FIBRE",
    strengths: ["extends reach beyond Wi-Fi range", "central control"],
    weaknesses: ["needs line-of-sight per spoke", "regulatory checks per link"],
  }),
  Object.freeze({
    pattern_slug: "neighbourhood_mesh",
    name: "Neighbourhood Wi-Fi mesh",
    topology: "MESH",
    suits_user_count_range: { min: 50, max: 500 },
    typical_upstream_dependency: "FIBRE",
    strengths: ["resilient", "no single point of failure", "self-healing"],
    weaknesses: ["complex ops", "capacity degrades with hop count"],
  }),
  Object.freeze({
    pattern_slug: "60ghz_backhaul_with_5ghz_access",
    name: "60 GHz backhaul + 5 GHz user access",
    topology: "TREE_BACKHAUL",
    suits_user_count_range: { min: 200, max: 2000 },
    typical_upstream_dependency: "FIBRE",
    strengths: ["very high capacity backhaul", "cheap per Gbps"],
    weaknesses: ["strict line-of-sight", "weather attenuation"],
  }),
] as const);

// ─── Business models ────────────────────────────────────────────────
export type BusinessModelKind =
  | "OWN_ISP_LICENSED"
  | "WHOLESALE_TRANSIT_RESELLER"
  | "MVNO"
  | "COMMUNITY_COOPERATIVE"
  | "REGULATOR_SANDBOX_PILOT"
  | "PARTNERSHIP_WITH_LICENSED_OPERATOR";

export type BusinessModelOption = {
  model_slug: string;
  kind: BusinessModelKind;
  name: string;
  typical_time_to_launch_months: { min: number; max: number };
  regulatory_burden: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  notes: string;
};

export const BUSINESS_MODEL_CATALOGUE: readonly BusinessModelOption[] = Object.freeze([
  Object.freeze({
    model_slug: "partnership_with_licensed_isp",
    kind: "PARTNERSHIP_WITH_LICENSED_OPERATOR",
    name: "Partner with an existing licensed Indonesian ISP",
    typical_time_to_launch_months: { min: 3, max: 9 },
    regulatory_burden: "LOW",
    notes: "Wholesale bandwidth agreement · NEX handles distribution + brand · ISP holds spectrum/licence.",
  }),
  Object.freeze({
    model_slug: "regulator_sandbox_pilot",
    kind: "REGULATOR_SANDBOX_PILOT",
    name: "Regulator-sponsored pilot (e.g. Komdigi sandbox)",
    typical_time_to_launch_months: { min: 6, max: 18 },
    regulatory_burden: "MEDIUM",
    notes: "Time-boxed proof-of-concept with formal regulator involvement. Excellent for evidence.",
  }),
  Object.freeze({
    model_slug: "own_isp_licensed",
    kind: "OWN_ISP_LICENSED",
    name: "NEX obtains own ISP licence",
    typical_time_to_launch_months: { min: 12, max: 36 },
    regulatory_burden: "VERY_HIGH",
    notes: "Full operator responsibilities · long lead time · significant capex + compliance overhead.",
  }),
  Object.freeze({
    model_slug: "community_cooperative_class_licence",
    kind: "COMMUNITY_COOPERATIVE",
    name: "Community cooperative on class-licensed spectrum",
    typical_time_to_launch_months: { min: 6, max: 18 },
    regulatory_burden: "MEDIUM",
    notes: "Only viable if class-licensed spectrum + community-ownership legally support this in Indonesia.",
  }),
] as const);

// ─── Helpers ────────────────────────────────────────────────────────

/** Returns spectrum band metadata by slug, or null. */
export function findSpectrumBand(slug: string): SpectrumBand | null {
  return SPECTRUM_CATALOGUE.find((b) => b.band_slug === slug) ?? null;
}
export function findArchitecture(slug: string): ArchitecturePattern | null {
  return ARCHITECTURE_CATALOGUE.find((a) => a.pattern_slug === slug) ?? null;
}
export function findBusinessModel(slug: string): BusinessModelOption | null {
  return BUSINESS_MODEL_CATALOGUE.find((m) => m.model_slug === slug) ?? null;
}
