// src/lib/nex/master-ai/connectivity-provider-comparison.ts
//
// NEX Master AI · Wholesale + Satellite Provider Comparison
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// Compare 4 candidate connectivity provider routes for NEX:
//
//   R1 · Fibre/ISP wholesale (Telkom IP Transit, Moratelindo, Biznet enterprise, etc.)
//   R2 · Mobile wholesale / MVNO (Indonesian MNOs · potentially interesting for phones)
//   R3 · Starlink Direct-to-Cell (satellite direct-to-standard-phone · via operator partnership)
//   R4 · AST SpaceMobile (satellite direct-to-standard-phone · targets normal smartphones)
//
// The membership feasibility gate answers: does the per-user monthly
// connectivity cost NEX would absorb FIT inside a ~Rp25,000 ($1.70)
// NEX membership fee, assuming NEX has non-connectivity revenue in
// addition?
//
// PRESERVATION:
//   · Every cost input carries an INPUT SOURCE label (ASSUMPTION /
//     PUBLIC_LIST_PRICE / CITED_PRIMARY / ESTIMATE_FROM_ANALOGUE)
//   · Never invent pricing · UNKNOWN input yields UNKNOWN output
//   · Membership-fit verdict is deterministic arithmetic
//   · No claim of contract or availability without evidence

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { providerComparisonsPath, providerCostAssumptionsPath } from "./paths";

// ═════════════════════════════════════════════════════════════════════
// Route catalogue (frozen)
// ═════════════════════════════════════════════════════════════════════

export type RouteCode = "R1_FIBRE_ISP" | "R2_MOBILE_MVNO" | "R3_STARLINK_DTC" | "R4_AST_SPACEMOBILE";

export type WholesaleRoute = {
  route_code: RouteCode;
  name: string;
  narrative: string;
  primary_use_case: string;
  provider_examples: readonly string[];
  requires_regulatory_licence: "UNKNOWN" | "LIKELY_YES_ISP" | "LIKELY_YES_TELECOM_OPERATOR" | "LIKELY_YES_MVNO" | "LIKELY_NO_IF_USER";
  typical_indonesian_availability: "WIDE_URBAN" | "MODERATE_URBAN_AND_SOME_RURAL" | "LIMITED_URBAN" | "EMERGING" | "UNKNOWN";
  key_evidence_gaps: readonly string[];
};

export const WHOLESALE_ROUTES: readonly WholesaleRoute[] = Object.freeze([
  Object.freeze({
    route_code: "R1_FIBRE_ISP",
    name: "Fibre / ISP wholesale → NEX → users",
    narrative: "NEX purchases wholesale IP transit or enterprise fibre from a licensed Indonesian ISP (e.g. Telkom IP Transit, Moratelindo, Biznet enterprise). NEX distributes locally on class-licensed Wi-Fi.",
    primary_use_case: "Urban and semi-urban dense-user deployments where fibre reaches or can be trenched",
    provider_examples: Object.freeze(["Telkom Indonesia (IP Transit)", "Moratelindo", "Biznet Networks (enterprise)", "First Media (business)", "Indosat Business", "XL Axiata Business"]) as readonly string[],
    requires_regulatory_licence: "LIKELY_YES_ISP",   // Provider needs ISP licence · NEX as customer likely doesn't per UU 36/1999
    typical_indonesian_availability: "WIDE_URBAN",
    key_evidence_gaps: Object.freeze([
      "Actual Indonesian wholesale IP-transit price per Mbps",
      "Whether Telkom IP Transit permits resale/redistribution in T&Cs",
      "Enterprise contract minimum commitments",
    ]) as readonly string[],
  }),
  Object.freeze({
    route_code: "R2_MOBILE_MVNO",
    name: "Mobile wholesale / MVNO → NEX → users",
    narrative: "NEX partners with an Indonesian MNO (Telkomsel, Indosat Ooredoo Hutchison, XL Axiata, Smartfren) as an MVNO or wholesale bulk-data customer. Users receive connectivity via existing cellular infrastructure.",
    primary_use_case: "Any-location mobile phones · leverages existing cellular coverage · no NEX deployment needed",
    provider_examples: Object.freeze(["Telkomsel", "Indosat Ooredoo Hutchison", "XL Axiata", "Smartfren", "Tri (3)"]) as readonly string[],
    requires_regulatory_licence: "LIKELY_YES_MVNO",
    typical_indonesian_availability: "WIDE_URBAN",
    key_evidence_gaps: Object.freeze([
      "Indonesian MVNO regulatory framework (does it exist? conditions?)",
      "MNO wholesale pricing for bulk mobile data",
      "Sponsored-data / bulk-plan availability",
    ]) as readonly string[],
  }),
  Object.freeze({
    route_code: "R3_STARLINK_DTC",
    name: "Starlink Direct-to-Cell → operator partnership → NEX users",
    narrative: "Satellite direct-to-standard-phone via SpaceX Starlink · integrated with existing MNOs. NEX would partner with a Starlink-integrated Indonesian MNO for coverage-hole users.",
    primary_use_case: "Coverage-hole rural/remote users · SMS and basic data first · higher-capacity later phases",
    provider_examples: Object.freeze(["SpaceX Starlink", "T-Mobile Starlink (US precedent)"]) as readonly string[],
    requires_regulatory_licence: "LIKELY_YES_TELECOM_OPERATOR",   // Requires MNO partner + spectrum authorization
    typical_indonesian_availability: "EMERGING",
    key_evidence_gaps: Object.freeze([
      "Whether any Indonesian MNO has announced Starlink DTC partnership",
      "Indonesian regulatory approval for satellite direct-to-cell",
      "Wholesale price to MNO partners",
      "Data rate limitations of current DTC service",
    ]) as readonly string[],
  }),
  Object.freeze({
    route_code: "R4_AST_SPACEMOBILE",
    name: "AST SpaceMobile → mobile operator partnership → NEX users",
    narrative: "AST SpaceMobile builds satellite-to-standard-phone service via its BlueBird satellites; commercial partnerships with global MNOs (Vodafone, Rakuten, AT&T, others). NEX would partner with an AST-integrated Indonesian MNO.",
    primary_use_case: "Coverage-hole users · targeting normal smartphone connectivity without dedicated hardware",
    provider_examples: Object.freeze(["AST SpaceMobile", "Vodafone AST partnership", "AT&T AST partnership"]) as readonly string[],
    requires_regulatory_licence: "LIKELY_YES_TELECOM_OPERATOR",
    typical_indonesian_availability: "EMERGING",
    key_evidence_gaps: Object.freeze([
      "Whether any Indonesian MNO has announced AST SpaceMobile partnership",
      "Indonesian spectrum authorization for AST",
      "Commercial service launch date in Indonesia",
      "Per-user pricing model to MNO partners",
    ]) as readonly string[],
  }),
] as const);

export function findRoute(code: RouteCode): WholesaleRoute | null {
  return WHOLESALE_ROUTES.find((r) => r.route_code === code) ?? null;
}

// ═════════════════════════════════════════════════════════════════════
// Cost assumption records (traceable inputs)
// ═════════════════════════════════════════════════════════════════════

export type InputSource = "ASSUMPTION" | "PUBLIC_LIST_PRICE" | "CITED_PRIMARY" | "ESTIMATE_FROM_ANALOGUE" | "UNKNOWN";

export type CostAssumption = {
  assumption_id: string;
  recorded_at_iso: string;
  route_code: RouteCode;
  attribute: string;                                // e.g. "wholesale_ip_transit_rp_per_mbps_per_month"
  value: number | null;                             // null = UNKNOWN
  unit: string;
  source: InputSource;
  citation: string;
  note: string;
};

export function recordCostAssumption(input: Omit<CostAssumption, "assumption_id" | "recorded_at_iso">): CostAssumption {
  const rec: CostAssumption = {
    ...input,
    assumption_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
  };
  appendJsonLine(providerCostAssumptionsPath(), rec);
  return rec;
}

export function readAllCostAssumptions(): CostAssumption[] {
  return readJsonlAll<CostAssumption>(providerCostAssumptionsPath());
}

// ═════════════════════════════════════════════════════════════════════
// Membership feasibility gate
// ═════════════════════════════════════════════════════════════════════

export type MembershipFitVerdict =
  | "FITS_IN_MEMBERSHIP"          // NEX per-user cost ≤ 50% of membership fee (room for non-connectivity opex + profit)
  | "TIGHT"                        // 50-100% of membership fee (works if NEX subsidises heavily)
  | "DOES_NOT_FIT"                 // > 100% of membership fee (loses money on every user without external revenue)
  | "UNKNOWN";                     // No credible pricing input

export type RouteComparisonInput = {
  route_code: RouteCode;
  users: number;
  membership_price_idr_month: number;               // e.g. 25000 for Rp25k
  per_user_wholesale_cost_idr_month: number | null; // null = UNKNOWN
  fixed_monthly_operational_cost_idr: number;       // hardware amortization + site + ops
  cache_hit_rate: number;                            // 0..1 (only affects R1 fibre variants meaningfully)
  cost_source_label: InputSource;
  note: string;
};

export type RouteComparisonResult = {
  comparison_id: string;
  recorded_at_iso: string;
  route_code: RouteCode;
  users: number;
  membership_price_idr_month: number;
  per_user_wholesale_cost_idr_month: number | null;
  per_user_effective_cost_idr_month: number | null; // wholesale × (1 - cache) + fixed/users
  per_user_ratio_to_membership: number | null;      // effective / membership
  membership_fit: MembershipFitVerdict;
  headroom_idr_per_user_per_month: number | null;   // membership - effective · positive = fits
  note: string;
  cost_source_label: InputSource;
};

export function evaluateRoute(input: RouteComparisonInput): RouteComparisonResult {
  const nowIso = new Date().toISOString();
  const users = Math.max(1, input.users);
  let per_user_effective: number | null = null;
  let ratio: number | null = null;
  let fit: MembershipFitVerdict = "UNKNOWN";
  let headroom: number | null = null;

  if (input.per_user_wholesale_cost_idr_month === null) {
    fit = "UNKNOWN";
  } else {
    // Cache reduces wholesale demand · only applies to fibre-like routes where NEX operates local cache
    const cachedShare = input.route_code === "R1_FIBRE_ISP" ? (1 - Math.max(0, Math.min(1, input.cache_hit_rate))) : 1;
    per_user_effective = Math.round(
      input.per_user_wholesale_cost_idr_month * cachedShare +
      input.fixed_monthly_operational_cost_idr / users
    );
    ratio = input.membership_price_idr_month > 0 ? per_user_effective / input.membership_price_idr_month : Infinity;
    headroom = input.membership_price_idr_month - per_user_effective;
    if (ratio > 1) fit = "DOES_NOT_FIT";
    else if (ratio > 0.5) fit = "TIGHT";
    else fit = "FITS_IN_MEMBERSHIP";
  }

  const rec: RouteComparisonResult = {
    comparison_id: randomUUID(),
    recorded_at_iso: nowIso,
    route_code: input.route_code,
    users,
    membership_price_idr_month: input.membership_price_idr_month,
    per_user_wholesale_cost_idr_month: input.per_user_wholesale_cost_idr_month,
    per_user_effective_cost_idr_month: per_user_effective,
    per_user_ratio_to_membership: ratio === null ? null : Math.round(ratio * 100) / 100,
    membership_fit: fit,
    headroom_idr_per_user_per_month: headroom === null ? null : Math.round(headroom),
    note: input.note,
    cost_source_label: input.cost_source_label,
  };
  appendJsonLine(providerComparisonsPath(), rec);
  return rec;
}

export function readAllComparisons(): RouteComparisonResult[] {
  return readJsonlAll<RouteComparisonResult>(providerComparisonsPath());
}

// ═════════════════════════════════════════════════════════════════════
// Cross-route summary
// ═════════════════════════════════════════════════════════════════════

export type RouteSummary = {
  route_code: RouteCode;
  best_fit_at_any_scale: MembershipFitVerdict;
  cheapest_per_user_effective_idr: number | null;
  cheapest_at_users: number | null;
  evidence_source_labels: string[];
  key_gaps: string[];
};

export function summariseRoutes(): RouteSummary[] {
  const all = readAllComparisons();
  const out: RouteSummary[] = [];
  for (const r of WHOLESALE_ROUTES) {
    const forRoute = all.filter((c) => c.route_code === r.route_code);
    const withCost = forRoute.filter((c) => c.per_user_effective_cost_idr_month !== null);
    let cheapest: RouteComparisonResult | null = null;
    for (const c of withCost) {
      if (!cheapest || (c.per_user_effective_cost_idr_month! < cheapest.per_user_effective_cost_idr_month!)) cheapest = c;
    }
    // Best fit ranked FITS > TIGHT > DOES_NOT_FIT > UNKNOWN
    const rank: Record<MembershipFitVerdict, number> = { FITS_IN_MEMBERSHIP: 4, TIGHT: 3, DOES_NOT_FIT: 2, UNKNOWN: 1 };
    const bestFit = forRoute.length === 0 ? "UNKNOWN" as MembershipFitVerdict :
      forRoute.reduce<MembershipFitVerdict>((best, c) => rank[c.membership_fit] > rank[best] ? c.membership_fit : best, "UNKNOWN" as MembershipFitVerdict);
    const sources = Array.from(new Set(forRoute.map((c) => c.cost_source_label)));
    out.push({
      route_code: r.route_code,
      best_fit_at_any_scale: bestFit,
      cheapest_per_user_effective_idr: cheapest?.per_user_effective_cost_idr_month ?? null,
      cheapest_at_users: cheapest?.users ?? null,
      evidence_source_labels: sources,
      key_gaps: [...r.key_evidence_gaps],
    });
  }
  return out;
}

export function _resetProviderComparisonForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  for (const p of [providerComparisonsPath(), providerCostAssumptionsPath()]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
