// src/lib/nex/master-ai/connectivity-yes-hunt.ts
//
// NEX Master AI · YES-Hunt Mission · Y-W4-11..14
// Philip 2026-09-07 · AUTHORIZE (research + evidence + verdict only)
//
// The Founder directive §12 is explicit: don't just say UNKNOWN because
// the problem is hard. Actively construct the strongest lawful YES case.
//
// This module provides:
//
//   · CANDIDATE_ARCHITECTURES (§5 A-H) frozen catalogue of 8 designs
//   · findReservoirSweetSpot (§6 · §W4-14) — optimum cache hit rate
//     across a scaled user base minimising TOTAL SYSTEM COST (not
//     max cache · optimises for cost)
//   · composeLegalMatrix (§11) — 12 capabilities × 5 categories
//   · runSelfCriticism (§13) — answer 15 questions honestly against
//     the current evidence and analysis
//   · constructYesCase (§12) — return YES / YES-SUBJECT-TO / NO /
//     UNKNOWN with named prerequisites
//
// PRESERVATION:
//   · Architectures are neutral designs · no jurisdiction claim
//   · Sweet-spot math is pure arithmetic · same inputs → identical
//     outputs · never invents cache-hit rates
//   · YES case can be constructed on the evidence in the ledger OR
//     honestly return YES-SUBJECT-TO with the specific evidence gaps
//   · UNKNOWN is a legitimate answer · never fabricate a YES
//   · Every verdict + self-criticism appended to ledgers

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import {
  yesHuntArchitecturesPath,
  yesHuntSweetSpotsPath,
  yesHuntVerdictsPath,
  yesHuntSelfCriticismPath,
} from "./paths";
import type { ConnectivityLegalCategory } from "./connectivity-domain";
import type { WhoPays } from "./connectivity-mission-domain";
import type { ConnectivityFinding } from "./connectivity-regulation";
import { computeMarginalCostPerUser } from "./connectivity-subsidisation";

// ═════════════════════════════════════════════════════════════════════
// §5 · Eight candidate NEX architectures
// ═════════════════════════════════════════════════════════════════════

export type CandidateArchitecture = {
  arch_code: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
  name: string;
  narrative: string;
  who_pays_expected: WhoPays;
  who_owns_expected: string;
  who_provides_upstream_expected: string;
  spectrum_kind: string;
  legal_pathway_hint: ConnectivityLegalCategory;   // hypothesis · verify with evidence
  minimum_partnerships: readonly string[];
  primary_regulatory_verifications_needed: readonly string[];
};

export const CANDIDATE_ARCHITECTURES: readonly CandidateArchitecture[] = Object.freeze([
  Object.freeze({
    arch_code: "A", name: "NEX-pays-ISP · Users connect through NEX Wi-Fi",
    narrative: "NEX subscribes to a normal Indonesian ISP as an end-customer. NEX operates local Wi-Fi under class-licensed spectrum. Users of the NEX Wi-Fi pay nothing.",
    who_pays_expected: "SELF_PAY" as WhoPays,        // NEX is the paying customer of the ISP
    who_owns_expected: "NEX (local network) · ISP (upstream)",
    who_provides_upstream_expected: "Licensed Indonesian ISP",
    spectrum_kind: "2.4/5 GHz Wi-Fi class-licence (verify)",
    legal_pathway_hint: "REQUIRES_LICENSE",
    minimum_partnerships: Object.freeze(["licensed_indonesian_isp"]) as readonly string[],
    primary_regulatory_verifications_needed: Object.freeze([
      "2.4/5 GHz class-licence terms for indoor/outdoor use",
      "SDPPI equipment certification for AP hardware",
      "Whether reselling/sharing an ISP connection to third parties triggers a separate telecoms licence",
    ]) as readonly string[],
  }),
  Object.freeze({
    arch_code: "B", name: "NEX wholesale bandwidth → local hubs → users",
    narrative: "NEX contracts wholesale bandwidth from a licensed operator, operates neighbourhood hubs, distributes locally on class-licensed spectrum.",
    who_pays_expected: "ISP_WHOLESALE" as WhoPays,
    who_owns_expected: "NEX (hub + distribution) · Wholesale ISP (upstream + backhaul)",
    who_provides_upstream_expected: "Wholesale ISP partner",
    spectrum_kind: "2.4/5 GHz Wi-Fi + potentially licensed backhaul",
    legal_pathway_hint: "REQUIRES_PARTNERSHIP",
    minimum_partnerships: Object.freeze(["wholesale_isp_partner"]) as readonly string[],
    primary_regulatory_verifications_needed: Object.freeze([
      "Wholesale interconnection framework in Indonesia",
      "Whether NEX becomes classified as an operator under Indonesian telecoms rules at this scale",
    ]) as readonly string[],
  }),
  Object.freeze({
    arch_code: "C", name: "NEX fibre/backhaul → local wireless distribution",
    narrative: "NEX operates its own backhaul (fibre or microwave) and distributes locally. Requires licence for backhaul spectrum unless fibre.",
    who_pays_expected: "SELF_PAY" as WhoPays,
    who_owns_expected: "NEX (backhaul + distribution)",
    who_provides_upstream_expected: "Wholesale IP transit provider",
    spectrum_kind: "Fibre backhaul + 5/60 GHz for last-mile",
    legal_pathway_hint: "REQUIRES_LICENSE",
    minimum_partnerships: Object.freeze(["ip_transit_provider"]) as readonly string[],
    primary_regulatory_verifications_needed: Object.freeze([
      "Right to build and operate fibre backhaul in Indonesia",
      "60 GHz outdoor/backhaul licensing status",
      "IX/IXP peering possibilities",
    ]) as readonly string[],
  }),
  Object.freeze({
    arch_code: "D", name: "NEX local mesh + occasional upstream gateways",
    narrative: "NEX deploys community-mesh nodes (802.11s or similar) with a small number of gateway nodes that touch the Internet.",
    who_pays_expected: "COMMUNITY_COOPERATIVE" as WhoPays,
    who_owns_expected: "NEX or community cooperative (mesh) · Gateway operator (upstream)",
    who_provides_upstream_expected: "Gateway ISP or NEX gateway subscription",
    spectrum_kind: "2.4/5 GHz Wi-Fi mesh",
    legal_pathway_hint: "REQUIRES_PARTNERSHIP",
    minimum_partnerships: Object.freeze(["gateway_isp"]) as readonly string[],
    primary_regulatory_verifications_needed: Object.freeze([
      "Whether mesh operation across multiple households requires operator licence",
      "Community-network legal treatment",
    ]) as readonly string[],
  }),
  Object.freeze({
    arch_code: "E", name: "NEX local reservoir + occasional upstream sync",
    narrative: "Aggressive local content · NEX Reservoir serves most user requests · upstream is a thin sync channel. Legal only for NEX-owned/licensed content.",
    who_pays_expected: "SELF_PAY" as WhoPays,
    who_owns_expected: "NEX (reservoir + local network)",
    who_provides_upstream_expected: "Any ISP (sync only)",
    spectrum_kind: "2.4/5 GHz Wi-Fi",
    legal_pathway_hint: "REQUIRES_LICENSE",
    minimum_partnerships: Object.freeze(["ip_transit_provider"]) as readonly string[],
    primary_regulatory_verifications_needed: Object.freeze([
      "NEX-owned/licensed content rights for caching",
      "Third-party platform ToS for any external content served locally",
    ]) as readonly string[],
  }),
  Object.freeze({
    arch_code: "F", name: "NEX + ISP/MNO partnership (formal)",
    narrative: "NEX partners with a licensed Indonesian ISP or MNO under a formal commercial agreement. NEX handles user layer + subsidy; partner handles telecom-regulated layer.",
    who_pays_expected: "MULTIPLE" as WhoPays,
    who_owns_expected: "MNO/ISP (regulated layer) · NEX (user + subsidy layer)",
    who_provides_upstream_expected: "MNO/ISP partner",
    spectrum_kind: "MNO licensed spectrum · possibly NEX Wi-Fi extension",
    legal_pathway_hint: "REQUIRES_PARTNERSHIP",
    minimum_partnerships: Object.freeze(["licensed_indonesian_isp_or_mno"]) as readonly string[],
    primary_regulatory_verifications_needed: Object.freeze([
      "MVNO regulatory framework in Indonesia",
      "Sponsored-data / zero-rating regulatory position",
    ]) as readonly string[],
  }),
  Object.freeze({
    arch_code: "G", name: "NEX + government/community infrastructure (pilot)",
    narrative: "NEX participates in a government pilot (e.g. BAKTI / Palapa Ring adjacent) or a formally recognised community-network programme.",
    who_pays_expected: "GOVERNMENT" as WhoPays,
    who_owns_expected: "Government (infrastructure) · NEX (user + application layer)",
    who_provides_upstream_expected: "Government-funded backbone",
    spectrum_kind: "Government-allocated or Wi-Fi",
    legal_pathway_hint: "POSSIBLE_PILOT",
    minimum_partnerships: Object.freeze(["indonesian_government_programme"]) as readonly string[],
    primary_regulatory_verifications_needed: Object.freeze([
      "Existence and access rules of a Komdigi/BAKTI innovation sandbox",
      "Application process for pilot programmes",
    ]) as readonly string[],
  }),
  Object.freeze({
    arch_code: "H", name: "Hybrid · A+B+E composite",
    narrative: "NEX ISP-as-customer for backbone + hub-and-spoke for distribution + Reservoir for local content. The likely minimum-legal-risk starting shape.",
    who_pays_expected: "MULTIPLE" as WhoPays,
    who_owns_expected: "NEX (local + reservoir) · ISP (upstream)",
    who_provides_upstream_expected: "Licensed Indonesian ISP",
    spectrum_kind: "2.4/5 GHz Wi-Fi + fibre/upstream to ISP",
    legal_pathway_hint: "REQUIRES_PARTNERSHIP",
    minimum_partnerships: Object.freeze(["licensed_indonesian_isp"]) as readonly string[],
    primary_regulatory_verifications_needed: Object.freeze([
      "Whether sharing an ISP connection with third-party users triggers operator status",
      "Wi-Fi class-licence rules for public/quasi-public use",
      "SDPPI equipment certification for hub/AP hardware",
    ]) as readonly string[],
  }),
] as const);

export function findCandidateArchitecture(code: string): CandidateArchitecture | null {
  return CANDIDATE_ARCHITECTURES.find((a) => a.arch_code === code) ?? null;
}

// ═════════════════════════════════════════════════════════════════════
// §6 · §W4-14 · NEX Reservoir sweet-spot detector
// ═════════════════════════════════════════════════════════════════════
//
// Total system cost = fixed + upstream × (1 - cache_hit_rate)
//                     + reservoir_infra_cost(cache_hit_rate)
//
// reservoir_infra_cost grows nonlinearly with cache hit rate — higher
// hit rates need more sophisticated infrastructure (larger storage,
// better cache algorithms, more edge nodes).
//
// Sweet spot = cache_hit_rate that minimises total system cost.

export type SweetSpotInputs = {
  users: number;
  monthly_fixed_cost_idr: number;               // hardware amortisation + site + ops (excl reservoir)
  monthly_full_upstream_cost_idr: number;       // upstream cost at 0% cache
  reservoir_base_cost_idr: number;              // minimum reservoir infra even at 0% hit
  reservoir_scale_coeff_idr: number;            // marginal cost per hit-rate point (increases nonlinearly)
  provisioned_upstream_mbps: number;            // for marginal-cost derivation
  avg_bandwidth_per_active_user_mbps: number;
  concurrent_active_pct: number;
};

export type SweetSpotPoint = {
  cache_hit_rate: number;                       // 0..0.8
  monthly_upstream_cost_idr: number;
  monthly_reservoir_cost_idr: number;
  monthly_total_cost_idr: number;
  per_user_cost_idr: number;
  marginal_cost_per_next_user_idr: number;
};

export type SweetSpotResult = {
  sweet_spot_id: string;
  performed_at_iso: string;
  users: number;
  points: SweetSpotPoint[];                      // 9 points (0, 10, ..., 80)
  optimum_cache_hit_rate: number;
  optimum_per_user_cost_idr: number;
  optimum_total_cost_idr: number;
  optimum_marginal_cost_idr: number;
};

/** Reservoir cost model: base + scale × hit_rate²
 *  Rationale: getting from 0% → 10% is cheap (basic edge cache); from
 *  70% → 80% is expensive (deep integration, aggressive prefetch). */
function reservoirCostAt(hitRate: number, base: number, scale: number): number {
  return base + scale * hitRate * hitRate;
}

export function findReservoirSweetSpot(input: SweetSpotInputs): SweetSpotResult {
  const points: SweetSpotPoint[] = [];
  for (let i = 0; i <= 8; i++) {
    const hitRate = i * 0.1;                    // 0.0, 0.1, ..., 0.8
    const upstream = input.monthly_full_upstream_cost_idr * (1 - hitRate);
    const reservoir = reservoirCostAt(hitRate, input.reservoir_base_cost_idr, input.reservoir_scale_coeff_idr);
    const total = input.monthly_fixed_cost_idr + upstream + reservoir;
    const perUser = input.users > 0 ? total / input.users : 0;
    const marginal = computeMarginalCostPerUser({
      monthly_fixed_cost_idr: input.monthly_fixed_cost_idr + reservoir,
      monthly_upstream_cost_idr: upstream,
      provisioned_upstream_mbps: input.provisioned_upstream_mbps,
      avg_bandwidth_per_active_user_mbps: input.avg_bandwidth_per_active_user_mbps,
      concurrent_active_pct: input.concurrent_active_pct,
      cache_hit_rate: hitRate,
      users: input.users,
    });
    points.push({
      cache_hit_rate: Math.round(hitRate * 100) / 100,
      monthly_upstream_cost_idr: Math.round(upstream),
      monthly_reservoir_cost_idr: Math.round(reservoir),
      monthly_total_cost_idr: Math.round(total),
      per_user_cost_idr: Math.round(perUser),
      marginal_cost_per_next_user_idr: marginal.marginal_cost_per_next_user_idr,
    });
  }
  let optimum = points[0];
  for (const p of points) if (p.monthly_total_cost_idr < optimum.monthly_total_cost_idr) optimum = p;
  const rec: SweetSpotResult = {
    sweet_spot_id: randomUUID(),
    performed_at_iso: new Date().toISOString(),
    users: input.users,
    points,
    optimum_cache_hit_rate: optimum.cache_hit_rate,
    optimum_per_user_cost_idr: optimum.per_user_cost_idr,
    optimum_total_cost_idr: optimum.monthly_total_cost_idr,
    optimum_marginal_cost_idr: optimum.marginal_cost_per_next_user_idr,
  };
  appendJsonLine(yesHuntSweetSpotsPath(), rec);
  return rec;
}

// ═════════════════════════════════════════════════════════════════════
// §11 · Legal decision matrix (12 capabilities × 5 categories)
// ═════════════════════════════════════════════════════════════════════

export type LegalMatrixCapability =
  | "unlicensed_local_wireless"
  | "nex_local_network"
  | "device_to_device"
  | "mesh"
  | "nex_reservoir"
  | "nex_subsidised_internet"
  | "public_internet_resale_or_access"
  | "isp_partnership"
  | "mvno_partnership"
  | "government_pilot"
  | "zero_rating"
  | "third_party_service_integration";

export const LEGAL_MATRIX_CAPABILITIES: readonly LegalMatrixCapability[] = Object.freeze([
  "unlicensed_local_wireless", "nex_local_network", "device_to_device", "mesh",
  "nex_reservoir", "nex_subsidised_internet", "public_internet_resale_or_access",
  "isp_partnership", "mvno_partnership", "government_pilot", "zero_rating",
  "third_party_service_integration",
] as const);

export type LegalMatrixCell = {
  capability: LegalMatrixCapability;
  jurisdiction: string;
  category: ConnectivityLegalCategory;
  evidence_count: number;
  strongest_tier: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  best_supporting_finding_id: string | null;
};

const CAPABILITY_TO_SIGNATURE: Record<LegalMatrixCapability, RegExp[]> = {
  unlicensed_local_wireless: [/class-?licen[cs]e/i, /unlicen[cs]ed/i, /ism/i, /RLAN/i, /wi-?fi/i],
  nex_local_network:         [/community\s+network/i, /local\s+area/i, /public\s+wi-?fi/i, /wi-?fi/i],
  device_to_device:          [/wi-?fi\s?direct/i, /ad[- ]?hoc/i, /802\.11s/i, /peer[- ]?to[- ]?peer/i],
  mesh:                      [/mesh/i, /802\.11s/i, /guifi|freifunk|nyc\s?mesh|athens\s?wireless/i],
  nex_reservoir:             [/content\s+delivery|cdn|edge/i, /cache|caching/i, /reservoir/i, /openwisp/i],
  nex_subsidised_internet:   [/sponsored\s+data|zero[- ]?rating|free\s+basics|internet\.org/i, /universal\s+service/i],
  public_internet_resale_or_access: [/wholesale/i, /internet\s+service\s+provider/i, /local\s+loop/i],
  isp_partnership:           [/wholesale|local\s+loop/i, /internet\s+service\s+provider/i],
  mvno_partnership:          [/mvno|mobile\s+virtual|mobile\s+network\s+operator/i],
  government_pilot:          [/bharatnet|wireless@sg|palapa|bakti|chattanooga|national\s+broadband|ultra[- ]?fast/i, /pilot|sandbox/i],
  zero_rating:               [/zero[- ]?rating|sponsored\s+data|free\s+basics/i, /net\s+neutrality/i],
  third_party_service_integration: [/whatsapp|instagram|tiktok|meta\s+platforms|api|graph\s+api/i],
};

export function composeLegalMatrix(findings: ConnectivityFinding[], jurisdiction: string): LegalMatrixCell[] {
  const tierRank: Record<string, number> = { TIER_1: 5, TIER_2: 4, TIER_3: 3, TIER_4: 2, TIER_5: 1 };
  const inJurisdiction = findings.filter((f) => f.jurisdiction === jurisdiction);
  const cells: LegalMatrixCell[] = [];
  for (const cap of LEGAL_MATRIX_CAPABILITIES) {
    const sigs = CAPABILITY_TO_SIGNATURE[cap];
    const matches = inJurisdiction.filter((f) => sigs.some((rx) => rx.test(f.statement) || rx.test(f.citation)));
    // Determine cell category · most-common non-UNKNOWN wins · else UNKNOWN
    let category: ConnectivityLegalCategory = "UNKNOWN";
    let strongestTier = "TIER_5";
    let bestFinding: string | null = null;
    if (matches.length > 0) {
      const counts: Record<ConnectivityLegalCategory, number> = { ALLOWED_NOW: 0, REQUIRES_LICENSE: 0, REQUIRES_PARTNERSHIP: 0, POSSIBLE_PILOT: 0, UNKNOWN: 0 };
      for (const m of matches) counts[m.category]++;
      const nonUnknown = Object.entries(counts).filter(([k, v]) => k !== "UNKNOWN" && v > 0);
      if (nonUnknown.length > 0) {
        nonUnknown.sort((a, b) => b[1] - a[1]);
        category = nonUnknown[0][0] as ConnectivityLegalCategory;
      }
      for (const m of matches) {
        const r = tierRank[m.authority_tier] ?? 0;
        if (r > (tierRank[strongestTier] ?? 0)) { strongestTier = m.authority_tier; bestFinding = m.finding_id; }
      }
      if (!bestFinding) bestFinding = matches[0].finding_id;
    }
    let confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
    if (matches.length === 0) confidence = "NONE";
    else if (strongestTier === "TIER_1" || strongestTier === "TIER_2") confidence = matches.length >= 2 ? "HIGH" : "MEDIUM";
    else confidence = matches.length >= 3 ? "MEDIUM" : "LOW";
    cells.push({ capability: cap, jurisdiction, category, evidence_count: matches.length,
                 strongest_tier: matches.length === 0 ? "NONE" : strongestTier,
                 confidence, best_supporting_finding_id: bestFinding });
  }
  return cells;
}

// ═════════════════════════════════════════════════════════════════════
// §13 · Self-criticism · 15 mandatory questions
// ═════════════════════════════════════════════════════════════════════

export type SelfCriticismChecklist = {
  q1_confused_free_spectrum_with_free_internet: string;
  q2_confused_zero_user_price_with_zero_system_cost: string;
  q3_relied_on_secondary_when_primary_existed: string;
  q4_assumed_indonesian_rule_could_not_verify: string;
  q5_assumed_third_party_content_can_be_cached: string;
  q6_assumed_device_ownership_creates_content_rights: string;
  q7_underestimated_upstream_bandwidth: string;
  q8_overestimated_cache_savings: string;
  q9_ignored_redundancy: string;
  q10_ignored_security: string;
  q11_ignored_certification: string;
  q12_ignored_licensing: string;
  q13_ignored_operational_labour: string;
  q14_ignored_growth: string;
  q15_single_fact_that_invalidates_yes_case: string;
};

const SELF_CRITICISM_KEYS: readonly (keyof SelfCriticismChecklist)[] = [
  "q1_confused_free_spectrum_with_free_internet",
  "q2_confused_zero_user_price_with_zero_system_cost",
  "q3_relied_on_secondary_when_primary_existed",
  "q4_assumed_indonesian_rule_could_not_verify",
  "q5_assumed_third_party_content_can_be_cached",
  "q6_assumed_device_ownership_creates_content_rights",
  "q7_underestimated_upstream_bandwidth",
  "q8_overestimated_cache_savings",
  "q9_ignored_redundancy",
  "q10_ignored_security",
  "q11_ignored_certification",
  "q12_ignored_licensing",
  "q13_ignored_operational_labour",
  "q14_ignored_growth",
  "q15_single_fact_that_invalidates_yes_case",
] as const;

export type SelfCriticismRecord = {
  criticism_id: string;
  recorded_at_iso: string;
  mission_slug: string;
  checklist: SelfCriticismChecklist;
};

export class IncompleteSelfCriticismError extends Error {
  constructor(missing: string) { super(`incomplete_self_criticism:${missing}`); }
}

export function recordSelfCriticism(input: { mission_slug: string; checklist: SelfCriticismChecklist }): SelfCriticismRecord {
  for (const key of SELF_CRITICISM_KEYS) {
    const v = input.checklist[key];
    if (v === undefined || v === null || String(v).trim().length < 3) {
      throw new IncompleteSelfCriticismError(key);
    }
  }
  const rec: SelfCriticismRecord = {
    criticism_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    mission_slug: input.mission_slug,
    checklist: input.checklist,
  };
  appendJsonLine(yesHuntSelfCriticismPath(), rec);
  return rec;
}

// ═════════════════════════════════════════════════════════════════════
// §12 · YES-construction · Return the strongest evidence-based verdict
// ═════════════════════════════════════════════════════════════════════

export type YesVerdict = "YES" | "YES_SUBJECT_TO" | "NO" | "UNKNOWN";

export type YesConstructionInputs = {
  legal_matrix: LegalMatrixCell[];
  sweet_spot: SweetSpotResult;
  chosen_architecture: CandidateArchitecture;
  self_criticism: SelfCriticismRecord | null;
};

export type YesConstructionResult = {
  verdict_id: string;
  recorded_at_iso: string;
  verdict: YesVerdict;
  evidence_strength: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  chosen_architecture: string;
  why_it_works: string;
  who_pays: string;
  what_nex_controls: string[];
  what_requires_a_partner: string[];
  what_requires_a_licence: string[];
  what_nex_can_do_now: string[];
  what_nex_cannot_do: string[];
  yes_prerequisites: string[];              // named blockers · empty if YES · non-empty if YES_SUBJECT_TO
  biggest_unknown: string;
  single_most_important_next_test: string;
  reasoning_trace: string[];
};

export function constructYesCase(input: YesConstructionInputs): YesConstructionResult {
  const trace: string[] = [];
  const cells = input.legal_matrix;
  const cellsByCap = new Map<LegalMatrixCapability, LegalMatrixCell>();
  for (const c of cells) cellsByCap.set(c.capability, c);

  // Which primitive capabilities does the chosen architecture depend on?
  const dependsOn: LegalMatrixCapability[] = [];
  const arch = input.chosen_architecture;
  if (arch.spectrum_kind.match(/wi-?fi|class-licence/i)) dependsOn.push("unlicensed_local_wireless", "nex_local_network");
  if (arch.arch_code === "D") dependsOn.push("mesh", "device_to_device");
  if (arch.arch_code === "E") dependsOn.push("nex_reservoir");
  if (arch.minimum_partnerships.includes("licensed_indonesian_isp") || arch.minimum_partnerships.includes("wholesale_isp_partner")) dependsOn.push("isp_partnership");
  if (arch.minimum_partnerships.includes("licensed_indonesian_isp_or_mno")) dependsOn.push("mvno_partnership", "isp_partnership");
  if (arch.minimum_partnerships.includes("indonesian_government_programme")) dependsOn.push("government_pilot");
  dependsOn.push("nex_subsidised_internet");                     // subsidy is core to the mission

  trace.push(`chosen_architecture=${arch.arch_code}`);
  trace.push(`depends_on=${dependsOn.join(",")}`);

  // For each dependency, look at the matrix cell and derive prerequisites/blockers
  const prereqs: string[] = [];
  const needsLicence: string[] = [];
  const needsPartner: string[] = [];
  const canDoNow: string[] = [];
  const cannotDo: string[] = [];
  let anyForbidden = false;

  for (const cap of dependsOn) {
    const cell = cellsByCap.get(cap);
    if (!cell) { prereqs.push(`ledger_missing_matrix_cell:${cap}`); continue; }
    switch (cell.category) {
      case "ALLOWED_NOW":
        canDoNow.push(`${cap} (${cell.confidence})`);
        trace.push(`${cap} = ALLOWED_NOW · ${cell.confidence}`);
        break;
      case "REQUIRES_LICENSE":
        needsLicence.push(cap);
        prereqs.push(`obtain_licence_for:${cap}`);
        trace.push(`${cap} = REQUIRES_LICENSE`);
        break;
      case "REQUIRES_PARTNERSHIP":
        needsPartner.push(cap);
        prereqs.push(`arrange_partnership_for:${cap}`);
        trace.push(`${cap} = REQUIRES_PARTNERSHIP`);
        break;
      case "POSSIBLE_PILOT":
        prereqs.push(`pursue_pilot_for:${cap}`);
        trace.push(`${cap} = POSSIBLE_PILOT`);
        break;
      case "UNKNOWN":
        prereqs.push(`verify_primary_evidence_for:${cap}`);
        trace.push(`${cap} = UNKNOWN · needs primary evidence`);
        break;
    }
  }

  // Explicit "what NEX cannot do" from mission doctrine
  cannotDo.push("Make third-party platform traffic (TikTok/Instagram/WhatsApp) free by operating a local network");
  cannotDo.push("Cache third-party protected content without permission");
  cannotDo.push("Bypass authentication / DRM / carrier controls / paid access / API restrictions / robots.txt / rate limits / ToS");
  cannotDo.push("Transmit on unverified spectrum");
  cannotDo.push("Operate as an ISP in Indonesia without proper licensing (evidence: multiple TIER_3 findings)");

  // Verdict logic:
  // · if any cell is explicitly forbidden (none currently modelled) → NO
  // · else if no UNKNOWNs and no partnerships and no licences → YES
  // · else if unknowns/partnerships/licences are named and finite → YES_SUBJECT_TO
  // · else UNKNOWN
  let verdict: YesVerdict;
  const unknownDeps = dependsOn.filter((c) => (cellsByCap.get(c)?.category ?? "UNKNOWN") === "UNKNOWN");
  if (anyForbidden) {
    verdict = "NO";
  } else if (needsLicence.length === 0 && needsPartner.length === 0 && unknownDeps.length === 0) {
    verdict = "YES";
  } else if (prereqs.length > 0 && prereqs.length <= dependsOn.length * 2) {
    // A YES-SUBJECT-TO answer requires the prerequisites to be enumerable and finite ·
    // this is the mission's §12 route.
    verdict = "YES_SUBJECT_TO";
  } else {
    verdict = "UNKNOWN";
  }
  trace.push(`verdict=${verdict}`);
  trace.push(`prereq_count=${prereqs.length}`);
  trace.push(`unknown_deps=${unknownDeps.length}`);

  // Evidence strength: derived from strongest tier + coverage across matrix
  const strongestPrimary = cells.some((c) => c.strongest_tier === "TIER_1" || c.strongest_tier === "TIER_2");
  const covered = cells.filter((c) => c.evidence_count > 0).length;
  let evidence_strength: YesConstructionResult["evidence_strength"];
  if (strongestPrimary && covered >= 10) evidence_strength = "VERY_HIGH";
  else if (strongestPrimary && covered >= 6) evidence_strength = "HIGH";
  else if (covered >= 8) evidence_strength = "MEDIUM";
  else evidence_strength = "LOW";

  // Biggest unknown = first UNKNOWN cell we depend on, else "None named"
  const biggestUnknownCell = dependsOn.map((c) => cellsByCap.get(c)).find((c) => c && c.category === "UNKNOWN");
  const biggest_unknown = biggestUnknownCell
    ? `${biggestUnknownCell.capability} · ${biggestUnknownCell.jurisdiction} · zero primary evidence yet`
    : "No named unknown among architecture's direct dependencies";

  // Single most important next test = obtain a TIER_1 Indonesian source for the biggest unknown
  const single_most_important_next_test = biggestUnknownCell
    ? `Register a TIER_1 Indonesian primary regulator source and verify ${biggestUnknownCell.capability} explicitly.`
    : "Register a TIER_1 Indonesian Komdigi primary regulation source and validate all matrix cells against it.";

  // Who pays / what NEX controls
  const whoPays = arch.who_pays_expected === "MULTIPLE"
    ? "NEX + partner (see architecture narrative)"
    : arch.who_pays_expected;
  const whatNexControls = [
    "User application layer",
    "NEX Reservoir + edge cache",
    "Local Wi-Fi hub operation (subject to class-licence verification)",
    "Subsidy pool + billing / non-billing to end user",
  ];

  const whyItWorks =
    verdict === "YES_SUBJECT_TO"
      ? `Architecture ${arch.arch_code} composes a lawful upstream path (${arch.who_provides_upstream_expected}) with a NEX-controlled local layer where cost per user drops to ~Rp10k/month at scale. User pays Rp0 by NEX absorbing that cost. Prerequisites are enumerable and finite (${prereqs.length} items).`
      : verdict === "YES"
      ? `All dependencies are ALLOWED_NOW under existing evidence · no partnership or licence gap remains.`
      : verdict === "NO"
      ? "One or more architectural dependencies is explicitly forbidden by evidence."
      : "Evidence coverage is insufficient to construct a defensible YES; primary Indonesian regulator sources needed.";

  const rec: YesConstructionResult = {
    verdict_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    verdict,
    evidence_strength,
    chosen_architecture: `${arch.arch_code} · ${arch.name}`,
    why_it_works: whyItWorks,
    who_pays: whoPays,
    what_nex_controls: whatNexControls,
    what_requires_a_partner: needsPartner,
    what_requires_a_licence: needsLicence,
    what_nex_can_do_now: canDoNow.length > 0 ? canDoNow : ["Nothing yet elevated to ALLOWED_NOW by evidence"],
    what_nex_cannot_do: cannotDo,
    yes_prerequisites: prereqs,
    biggest_unknown,
    single_most_important_next_test,
    reasoning_trace: trace,
  };
  appendJsonLine(yesHuntVerdictsPath(), rec);
  return rec;
}

export function readAllYesVerdicts(): YesConstructionResult[] {
  return readJsonlAll<YesConstructionResult>(yesHuntVerdictsPath());
}
export function readAllSweetSpots(): SweetSpotResult[] {
  return readJsonlAll<SweetSpotResult>(yesHuntSweetSpotsPath());
}
export function readAllSelfCriticism(): SelfCriticismRecord[] {
  return readJsonlAll<SelfCriticismRecord>(yesHuntSelfCriticismPath());
}

export function _resetYesHuntForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  for (const p of [yesHuntArchitecturesPath(), yesHuntSweetSpotsPath(), yesHuntVerdictsPath(), yesHuntSelfCriticismPath()]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
