// src/lib/nex/master-ai/connectivity-mission-domain.ts
//
// NEX Master AI · Global Free/Low-Cost Connectivity Intelligence Mission
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// This module adds three primitives on top of the Wave-4 W4-B doctrine:
//
//   · WhoPays enum       (§5 · never call something "free" without saying who pays)
//   · Country catalogue  (§6 · at-minimum-10 countries as neutral discovery scaffold)
//   · Report composer    (§14 · Global Connectivity Intelligence Report)
//
// PRESERVATION:
//   · Country catalogue lists what EXISTS (regulator name, ISO code, known
//     programme names) — it makes NO legal claim about any jurisdiction.
//   · WhoPays is an enum · every value carries a meaning statement so
//     no reader can mistake "unknown" for "free."
//   · Report composer is READ-ONLY — synthesises the ledger. Never
//     mutates evidence, never invents categorisation.
//   · Empty ledger produces an honest "NO_EVIDENCE_YET" report — never
//     forced YES.

import type { ConnectivityLegalCategory } from "./connectivity-domain";

// ─── §5 · WhoPays (mandatory attribution of who funds connectivity) ─
export type WhoPays =
  | "SELF_PAY"                                    // The end user pays directly
  | "GOVERNMENT"                                  // National government funds
  | "MUNICIPALITY"                                // City / local government funds
  | "UNIVERSAL_SERVICE_FUND"                      // Regulated USF pays (e.g. BAKTI)
  | "ISP_WHOLESALE"                               // Wholesale ISP charges partner rather than user
  | "SPONSOR_ADVERTISER"                          // Advertiser / sponsored data
  | "UNIVERSITY_INSTITUTION"                      // Educational institution funds (eduroam etc.)
  | "COMMUNITY_COOPERATIVE"                       // Members pool costs
  | "DONOR_PHILANTHROPY"                          // Non-profit / donor funded
  | "CROSS_SUBSIDY"                               // Provider funds via other revenue
  | "GENUINELY_OPEN_LOCAL"                        // No upstream · genuinely local traffic only
  | "MULTIPLE"                                    // Combination · itemise in note
  | "UNKNOWN";                                    // Evidence insufficient · NOT the same as free

export const WHO_PAYS_MEANING: Readonly<Record<WhoPays, string>> = Object.freeze({
  SELF_PAY: "End user pays the operator directly",
  GOVERNMENT: "National government funds the connectivity",
  MUNICIPALITY: "City / local government funds the connectivity",
  UNIVERSAL_SERVICE_FUND: "Universal service / rural fund pays (e.g. BAKTI in Indonesia)",
  ISP_WHOLESALE: "Licensed ISP is paid wholesale by a partner rather than by the user",
  SPONSOR_ADVERTISER: "Advertiser or sponsor pays; user sees ads or accepts branding",
  UNIVERSITY_INSTITUTION: "Educational or research institution funds it (e.g. eduroam)",
  COMMUNITY_COOPERATIVE: "Community pools the cost cooperatively",
  DONOR_PHILANTHROPY: "Non-profit / philanthropic donation funds it",
  CROSS_SUBSIDY: "Provider funds via other revenue streams (e.g. retail store Wi-Fi)",
  GENUINELY_OPEN_LOCAL: "No upstream Internet · genuinely local-only traffic (mesh-only, LAN-only)",
  MULTIPLE: "Combination of the above · caller must itemise in note",
  UNKNOWN: "Evidence insufficient to determine who funds the connectivity",
});

// ─── §6 · Country catalogue (neutral discovery scaffold) ────────────
// Every entry describes what EXISTS in the country — regulator name,
// known Wikipedia article names for the mission runner to query. No
// legal claim is made about any specific configuration.

export type CountryEntry = {
  code: string;                                   // ISO 3166-1 alpha-2
  name: string;                                   // English name
  regulator_name: string;                         // primary telecoms regulator
  regulator_wikipedia_title: string | null;       // Wikipedia article name if known
  connectivity_wikipedia_titles: readonly string[]; // e.g. "Telecommunications in X"
  known_public_programmes: readonly string[];     // programme names for research targeting
  notes: string;
};

export const COUNTRY_CATALOGUE: readonly CountryEntry[] = Object.freeze([
  Object.freeze({
    code: "ID", name: "Indonesia",
    regulator_name: "Kementerian Komunikasi dan Digital (Komdigi, formerly Kominfo)",
    regulator_wikipedia_title: "Kementerian Komunikasi dan Digital Republik Indonesia",
    connectivity_wikipedia_titles: Object.freeze(["Telecommunications in Indonesia", "Internet in Indonesia"]) as readonly string[],
    known_public_programmes: Object.freeze(["BAKTI", "Palapa Ring"]) as readonly string[],
    notes: "Primary target jurisdiction for INDOLOCAL",
  }),
  Object.freeze({
    code: "DE", name: "Germany",
    regulator_name: "Bundesnetzagentur",
    regulator_wikipedia_title: "Bundesnetzagentur",
    connectivity_wikipedia_titles: Object.freeze(["Internet in Germany", "Telecommunications in Germany"]) as readonly string[],
    known_public_programmes: Object.freeze(["Freifunk"]) as readonly string[],
    notes: "Home of Freifunk community mesh",
  }),
  Object.freeze({
    code: "ES", name: "Spain",
    regulator_name: "Comisión Nacional de los Mercados y la Competencia",
    regulator_wikipedia_title: "Comisión Nacional de los Mercados y la Competencia",
    connectivity_wikipedia_titles: Object.freeze(["Internet in Spain", "Telecommunications in Spain"]) as readonly string[],
    known_public_programmes: Object.freeze(["Guifi.net"]) as readonly string[],
    notes: "Home of Guifi.net cooperative broadband",
  }),
  Object.freeze({
    code: "US", name: "United States",
    regulator_name: "Federal Communications Commission",
    regulator_wikipedia_title: "Federal Communications Commission",
    connectivity_wikipedia_titles: Object.freeze(["Internet in the United States", "Telecommunications in the United States"]) as readonly string[],
    known_public_programmes: Object.freeze(["Chattanooga EPB", "NYC Mesh"]) as readonly string[],
    notes: "Municipal broadband + community mesh precedents",
  }),
  Object.freeze({
    code: "GB", name: "United Kingdom",
    regulator_name: "Ofcom",
    regulator_wikipedia_title: "Ofcom",
    connectivity_wikipedia_titles: Object.freeze(["Internet in the United Kingdom", "Telecommunications in the United Kingdom"]) as readonly string[],
    known_public_programmes: Object.freeze(["B4RN"]) as readonly string[],
    notes: "B4RN rural community fibre cooperative",
  }),
  Object.freeze({
    code: "IN", name: "India",
    regulator_name: "Telecom Regulatory Authority of India",
    regulator_wikipedia_title: "Telecom Regulatory Authority of India",
    connectivity_wikipedia_titles: Object.freeze(["Internet in India", "Telecommunications in India"]) as readonly string[],
    known_public_programmes: Object.freeze(["BharatNet", "Digital India"]) as readonly string[],
    notes: "Government-funded rural connectivity at scale",
  }),
  Object.freeze({
    code: "SG", name: "Singapore",
    regulator_name: "Infocomm Media Development Authority",
    regulator_wikipedia_title: "Infocomm Media Development Authority",
    connectivity_wikipedia_titles: Object.freeze(["Internet in Singapore", "Telecommunications in Singapore"]) as readonly string[],
    known_public_programmes: Object.freeze(["Wireless@SG"]) as readonly string[],
    notes: "Nationwide free public Wi-Fi programme",
  }),
  Object.freeze({
    code: "JP", name: "Japan",
    regulator_name: "Ministry of Internal Affairs and Communications",
    regulator_wikipedia_title: "Ministry of Internal Affairs and Communications",
    connectivity_wikipedia_titles: Object.freeze(["Internet in Japan", "Telecommunications in Japan"]) as readonly string[],
    known_public_programmes: Object.freeze([]) as readonly string[],
    notes: "",
  }),
  Object.freeze({
    code: "KR", name: "South Korea",
    regulator_name: "Ministry of Science and ICT",
    regulator_wikipedia_title: "Ministry of Science and ICT",
    connectivity_wikipedia_titles: Object.freeze(["Internet in South Korea", "Telecommunications in South Korea"]) as readonly string[],
    known_public_programmes: Object.freeze([]) as readonly string[],
    notes: "",
  }),
  Object.freeze({
    code: "AU", name: "Australia",
    regulator_name: "Australian Communications and Media Authority",
    regulator_wikipedia_title: "Australian Communications and Media Authority",
    connectivity_wikipedia_titles: Object.freeze(["Internet in Australia", "Telecommunications in Australia"]) as readonly string[],
    known_public_programmes: Object.freeze(["National Broadband Network"]) as readonly string[],
    notes: "Government wholesale broadband model",
  }),
  Object.freeze({
    code: "NZ", name: "New Zealand",
    regulator_name: "Commerce Commission",
    regulator_wikipedia_title: "Commerce Commission (New Zealand)",
    connectivity_wikipedia_titles: Object.freeze(["Internet in New Zealand", "Telecommunications in New Zealand"]) as readonly string[],
    known_public_programmes: Object.freeze(["Ultra-Fast Broadband"]) as readonly string[],
    notes: "",
  }),
] as const);

export function findCountry(code: string): CountryEntry | null {
  return COUNTRY_CATALOGUE.find((c) => c.code === code) ?? null;
}

// ─── §14 · Global Connectivity Intelligence Report composer ─────────

import type { ConnectivityFinding } from "./connectivity-regulation";

export type GlobalConnectivityReport = {
  composed_at_iso: string;
  question: string;
  global_discoveries: {
    total_findings: number;
    findings_by_country: Record<string, number>;
    by_category: Record<ConnectivityLegalCategory, number>;
    by_who_pays: Record<WhoPays, number>;
  };
  indonesia_analysis: {
    total_findings: number;
    by_category: Record<ConnectivityLegalCategory, number>;
    by_who_pays: Record<WhoPays, number>;
    strongest_authority_tier_seen: string;
    primary_regulator_evidence_present: boolean;
  };
  best_architecture_by_category: {
    allowed_now: string | null;
    requires_license: string | null;
    requires_partnership: string | null;
    possible_pilot: string | null;
  };
  evidence_strength: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  final_answer: "YES" | "NO" | "PARTIAL" | "CONDITIONAL" | "UNKNOWN";
  final_answer_reasoning: string;
  biggest_risks: string[];
  biggest_unknowns: string[];
  two_phone_proof_ready: boolean;
  two_phone_proof_reasoning: string;
};

const CATEGORY_ZERO: Record<ConnectivityLegalCategory, number> = Object.freeze({
  ALLOWED_NOW: 0, REQUIRES_LICENSE: 0, REQUIRES_PARTNERSHIP: 0, POSSIBLE_PILOT: 0, UNKNOWN: 0,
});
const WHO_PAYS_ZERO: Record<WhoPays, number> = Object.freeze({
  SELF_PAY: 0, GOVERNMENT: 0, MUNICIPALITY: 0, UNIVERSAL_SERVICE_FUND: 0,
  ISP_WHOLESALE: 0, SPONSOR_ADVERTISER: 0, UNIVERSITY_INSTITUTION: 0,
  COMMUNITY_COOPERATIVE: 0, DONOR_PHILANTHROPY: 0, CROSS_SUBSIDY: 0,
  GENUINELY_OPEN_LOCAL: 0, MULTIPLE: 0, UNKNOWN: 0,
});

export function composeGlobalConnectivityReport(findings: ConnectivityFinding[]): GlobalConnectivityReport {
  const nowIso = new Date().toISOString();
  const total = findings.length;
  const byCountry: Record<string, number> = {};
  const byCat: Record<ConnectivityLegalCategory, number> = { ...CATEGORY_ZERO };
  const byPay: Record<WhoPays, number> = { ...WHO_PAYS_ZERO };
  for (const f of findings) {
    byCountry[f.jurisdiction] = (byCountry[f.jurisdiction] ?? 0) + 1;
    byCat[f.category]++;
    const who: WhoPays = (f.who_pays ?? "UNKNOWN") as WhoPays;
    byPay[who]++;
  }

  const idFindings = findings.filter((f) => f.jurisdiction === "ID");
  const idByCat: Record<ConnectivityLegalCategory, number> = { ...CATEGORY_ZERO };
  const idByPay: Record<WhoPays, number> = { ...WHO_PAYS_ZERO };
  for (const f of idFindings) {
    idByCat[f.category]++;
    idByPay[(f.who_pays ?? "UNKNOWN") as WhoPays]++;
  }
  const tierRank: Record<string, number> = { TIER_1: 5, TIER_2: 4, TIER_3: 3, TIER_4: 2, TIER_5: 1 };
  const strongestTier = idFindings.reduce((best, f) => {
    const r = tierRank[f.authority_tier] ?? 0;
    return r > tierRank[best] ? f.authority_tier : best;
  }, "TIER_5");
  const primaryEvidence = idFindings.some((f) => f.authority_tier === "TIER_1" || f.authority_tier === "TIER_2");

  // Best architecture per category — pick the finding with highest authority tier
  const best_architecture_by_category: GlobalConnectivityReport["best_architecture_by_category"] = {
    allowed_now: pickBest(findings, "ALLOWED_NOW"),
    requires_license: pickBest(findings, "REQUIRES_LICENSE"),
    requires_partnership: pickBest(findings, "REQUIRES_PARTNERSHIP"),
    possible_pilot: pickBest(findings, "POSSIBLE_PILOT"),
  };

  // Evidence strength · fail closed at NONE unless real evidence exists
  let evidence_strength: GlobalConnectivityReport["evidence_strength"] = "NONE";
  if (total === 0) evidence_strength = "NONE";
  else if (primaryEvidence && total >= 10) evidence_strength = "HIGH";
  else if (total >= 20) evidence_strength = "MEDIUM";
  else evidence_strength = "LOW";

  // Final answer — honest matrix
  //   NO evidence for ALLOWED_NOW + NO primary regulator source → UNKNOWN (cannot say NO either)
  //   Some ALLOWED_NOW + primary evidence → CONDITIONAL / PARTIAL
  //   Rich evidence + explicit ALLOWED_NOW → YES
  let final_answer: GlobalConnectivityReport["final_answer"] = "UNKNOWN";
  let final_reason = "";
  const idAllowed = idByCat.ALLOWED_NOW;
  const globalAllowed = byCat.ALLOWED_NOW;
  if (total === 0) {
    final_answer = "UNKNOWN";
    final_reason = "no_findings_recorded";
  } else if (idAllowed > 0 && primaryEvidence) {
    final_answer = "CONDITIONAL";
    final_reason = `${idAllowed}_ALLOWED_NOW_indonesian_finding(s)_with_primary_evidence · conditions apply per stated finding conditions`;
  } else if (globalAllowed > 0 && idAllowed === 0) {
    final_answer = "PARTIAL";
    final_reason = `${globalAllowed}_global_ALLOWED_NOW_finding(s)_exist_but_none_yet_translated_to_indonesian_jurisdiction`;
  } else if (!primaryEvidence && idAllowed === 0) {
    final_answer = "UNKNOWN";
    final_reason = "no_primary_indonesian_regulator_evidence_recorded_and_no_ALLOWED_NOW_finding · cannot say YES or NO";
  } else {
    final_answer = "UNKNOWN";
    final_reason = "insufficient_or_ambiguous_evidence_matrix";
  }

  // Biggest risks and unknowns · sourced from the categorisation, not invented
  const biggest_risks: string[] = [];
  if (byCat.UNKNOWN > 0) biggest_risks.push(`${byCat.UNKNOWN}_UNKNOWN_findings_signal_evidence_gap`);
  if (byCat.REQUIRES_LICENSE > 0) biggest_risks.push(`${byCat.REQUIRES_LICENSE}_configurations_need_regulatory_authorisation`);
  if (!primaryEvidence) biggest_risks.push("no_primary_indonesian_regulator_evidence_in_ledger");
  const biggest_unknowns: string[] = [];
  if (!primaryEvidence) biggest_unknowns.push("indonesian_class_licence_and_EIRP_specifics");
  if (byPay.UNKNOWN > total / 2) biggest_unknowns.push("more_than_half_of_findings_lack_who_pays_evidence");

  // Two-phone proof · requires at minimum ALLOWED_NOW device-to-device tech + Indonesian legality
  const wifiDirectAllowedInID = idFindings.some((f) =>
    f.architecture_slug === null && f.category === "ALLOWED_NOW" &&
    /wi-?fi\s?direct|802\.11s|ibss|ad[- ]?hoc/i.test(f.statement)
  );
  const two_phone_proof_ready = wifiDirectAllowedInID;
  const two_phone_proof_reasoning = wifiDirectAllowedInID
    ? "wifi_direct_or_equivalent_device_to_device_documented_ALLOWED_NOW_in_ID"
    : "no_ALLOWED_NOW_evidence_for_device_to_device_wireless_in_ID_yet · defer physical proof";

  return {
    composed_at_iso: nowIso,
    question: "Can a lawful architecture provide Internet to users at Rp0 or dramatically reduced cost in Indonesia?",
    global_discoveries: {
      total_findings: total,
      findings_by_country: byCountry,
      by_category: byCat,
      by_who_pays: byPay,
    },
    indonesia_analysis: {
      total_findings: idFindings.length,
      by_category: idByCat,
      by_who_pays: idByPay,
      strongest_authority_tier_seen: idFindings.length === 0 ? "NONE" : strongestTier,
      primary_regulator_evidence_present: primaryEvidence,
    },
    best_architecture_by_category,
    evidence_strength,
    final_answer,
    final_answer_reasoning: final_reason,
    biggest_risks,
    biggest_unknowns,
    two_phone_proof_ready,
    two_phone_proof_reasoning,
  };
}

function pickBest(findings: ConnectivityFinding[], category: ConnectivityLegalCategory): string | null {
  const candidates = findings.filter((f) => f.category === category);
  if (candidates.length === 0) return null;
  const tierRank: Record<string, number> = { TIER_1: 5, TIER_2: 4, TIER_3: 3, TIER_4: 2, TIER_5: 1 };
  candidates.sort((a, b) => (tierRank[b.authority_tier] ?? 0) - (tierRank[a.authority_tier] ?? 0));
  const top = candidates[0];
  return `${top.jurisdiction}:${top.architecture_slug ?? top.business_model_slug ?? top.topic}:tier=${top.authority_tier}`;
}
