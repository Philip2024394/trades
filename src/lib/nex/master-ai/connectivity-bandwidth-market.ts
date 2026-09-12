// src/lib/nex/master-ai/connectivity-bandwidth-market.ts
//
// NEX Master AI · Indonesian Bandwidth Market Investigation
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// The Founder question:
//   "Who can actually sell NEX the bandwidth, at what price, under
//    what contract, and how much capacity can we buy?"
//
// This module provides:
//   · Frozen catalogue of ~10 Indonesian bandwidth providers with
//     contract classes + handoff/POP locations
//   · 4-tier capacity ladder (1 · 10 · 100 · 1000 Gbps)
//   · Price ledger with mandatory source labels (PUBLIC_LIST_PRICE /
//     PUBLIC_ANNOUNCEMENT / ESTIMATE_FROM_ANALOGUE / QUOTE_ONLY /
//     UNKNOWN) · never invents pricing
//   · Per-member cost computer with realistic ranges
//   · Cost-per-member calculation across provider × capacity matrix
//
// PRESERVATION:
//   · Every price carries an explicit source label
//   · QUOTE_ONLY is the honest default for wholesale (most providers
//     do not publish · they quote per customer)
//   · UNKNOWN pricing yields UNKNOWN per-member cost · never guesses
//   · Per-member calculations use range (best/mid/worst) when input
//     is a range · single-point input produces single-point output

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { bandwidthPricesPath, bandwidthComputationsPath } from "./paths";

// ═════════════════════════════════════════════════════════════════════
// Provider catalogue (frozen)
// ═════════════════════════════════════════════════════════════════════

export type ContractClass =
  | "CONSUMER"                                    // ordinary consumer broadband
  | "SME_BUSINESS"                                 // small/medium enterprise business Internet
  | "ENTERPRISE"                                   // large enterprise / dedicated
  | "WHOLESALE_IP_TRANSIT"                         // bulk IP transit for ISPs
  | "OPERATOR_INTERCONNECT"                        // operator-to-operator (regulated)
  | "COLOCATION_CROSS_CONNECT";                    // datacenter cross-connect

export type ProviderRecord = {
  provider_slug: string;
  legal_name: string;
  parent: string | null;
  regulatory_status_ID: "LICENSED_ISP" | "LICENSED_TELCO" | "LICENSED_OPERATOR" | "UNKNOWN";
  contract_classes_offered: readonly ContractClass[];
  handoff_locations: readonly string[];            // major POPs / IX presence known publicly
  known_specialisation: string;
  public_pricing_availability: "PUBLIC_LIST" | "PARTIAL_LIST" | "QUOTE_ONLY" | "UNKNOWN";
  key_evidence_gaps: readonly string[];
};

export const BANDWIDTH_PROVIDERS: readonly ProviderRecord[] = Object.freeze([
  Object.freeze({
    provider_slug: "telkom_indonesia",
    legal_name: "PT Telekomunikasi Indonesia (Persero) Tbk",
    parent: "State-owned (Government of Indonesia majority)",
    regulatory_status_ID: "LICENSED_TELCO",
    contract_classes_offered: Object.freeze(["CONSUMER", "SME_BUSINESS", "ENTERPRISE", "WHOLESALE_IP_TRANSIT", "OPERATOR_INTERCONNECT"]) as readonly ContractClass[],
    handoff_locations: Object.freeze(["Jakarta (multiple)", "Bandung", "Surabaya", "Medan", "Denpasar", "Makassar", "IIX (Indonesian Internet Exchange)"]) as readonly string[],
    known_specialisation: "National incumbent · owns backbone fibre + Palapa Ring · IP Transit product publicly announced but pricing per quote",
    public_pricing_availability: "QUOTE_ONLY",
    key_evidence_gaps: Object.freeze([
      "Actual Telkom IP Transit Rp per Mbps/mo at 1/10/100 Gbps tiers",
      "Minimum contract term",
      "Whether contract explicitly permits downstream distribution",
    ]) as readonly string[],
  }),
  Object.freeze({
    provider_slug: "moratelindo",
    legal_name: "PT Mora Telematika Indonesia Tbk",
    parent: null,
    regulatory_status_ID: "LICENSED_ISP",
    contract_classes_offered: Object.freeze(["SME_BUSINESS", "ENTERPRISE", "WHOLESALE_IP_TRANSIT", "COLOCATION_CROSS_CONNECT"]) as readonly ContractClass[],
    handoff_locations: Object.freeze(["Jakarta", "Batam", "Surabaya", "IIX"]) as readonly string[],
    known_specialisation: "One of the larger independent wholesale + retail ISPs · publicly listed",
    public_pricing_availability: "QUOTE_ONLY",
    key_evidence_gaps: Object.freeze(["Wholesale IP transit Rp per Mbps"]) as readonly string[],
  }),
  Object.freeze({
    provider_slug: "biznet",
    legal_name: "PT Supra Primatama Nusantara (Biznet Networks)",
    parent: null,
    regulatory_status_ID: "LICENSED_ISP",
    contract_classes_offered: Object.freeze(["CONSUMER", "SME_BUSINESS", "ENTERPRISE", "COLOCATION_CROSS_CONNECT"]) as readonly ContractClass[],
    handoff_locations: Object.freeze(["Jakarta", "Bandung", "Surabaya", "Bali", "Biznet own data centres"]) as readonly string[],
    known_specialisation: "Consumer + enterprise fibre · own data centre network · direct-to-customer emphasis",
    public_pricing_availability: "PARTIAL_LIST",
    key_evidence_gaps: Object.freeze(["Enterprise/wholesale Rp per Mbps"]) as readonly string[],
  }),
  Object.freeze({
    provider_slug: "indosat_business",
    legal_name: "PT Indosat Tbk (Business unit)",
    parent: "Indosat Ooredoo Hutchison",
    regulatory_status_ID: "LICENSED_TELCO",
    contract_classes_offered: Object.freeze(["SME_BUSINESS", "ENTERPRISE", "WHOLESALE_IP_TRANSIT", "OPERATOR_INTERCONNECT"]) as readonly ContractClass[],
    handoff_locations: Object.freeze(["Jakarta", "Surabaya", "IIX", "submarine cable landing stations"]) as readonly string[],
    known_specialisation: "Second-largest Indonesian telco · mobile + fixed + submarine cable",
    public_pricing_availability: "QUOTE_ONLY",
    key_evidence_gaps: Object.freeze(["Bulk IP transit pricing"]) as readonly string[],
  }),
  Object.freeze({
    provider_slug: "xl_business",
    legal_name: "PT XL Axiata Tbk (Business unit)",
    parent: "Axiata Group",
    regulatory_status_ID: "LICENSED_TELCO",
    contract_classes_offered: Object.freeze(["SME_BUSINESS", "ENTERPRISE", "OPERATOR_INTERCONNECT"]) as readonly ContractClass[],
    handoff_locations: Object.freeze(["Jakarta", "Surabaya", "Bandung"]) as readonly string[],
    known_specialisation: "Third-largest MNO · fixed + enterprise offerings",
    public_pricing_availability: "QUOTE_ONLY",
    key_evidence_gaps: Object.freeze(["Enterprise Internet pricing"]) as readonly string[],
  }),
  Object.freeze({
    provider_slug: "lintasarta",
    legal_name: "PT Aplikanusa Lintasarta",
    parent: "Indosat Ooredoo Hutchison (majority)",
    regulatory_status_ID: "LICENSED_ISP",
    contract_classes_offered: Object.freeze(["ENTERPRISE", "WHOLESALE_IP_TRANSIT", "COLOCATION_CROSS_CONNECT"]) as readonly ContractClass[],
    handoff_locations: Object.freeze(["Jakarta", "Surabaya", "Bandung", "Multi-city coverage"]) as readonly string[],
    known_specialisation: "Enterprise + banking + financial services connectivity · well-established B2B",
    public_pricing_availability: "QUOTE_ONLY",
    key_evidence_gaps: Object.freeze(["Wholesale Rp per Mbps · reseller programme"]) as readonly string[],
  }),
  Object.freeze({
    provider_slug: "cbn",
    legal_name: "PT Cyberindo Aditama (CBN)",
    parent: null,
    regulatory_status_ID: "LICENSED_ISP",
    contract_classes_offered: Object.freeze(["CONSUMER", "SME_BUSINESS", "ENTERPRISE"]) as readonly ContractClass[],
    handoff_locations: Object.freeze(["Jakarta", "IIX"]) as readonly string[],
    known_specialisation: "One of Indonesia's oldest ISPs · consumer + business",
    public_pricing_availability: "PARTIAL_LIST",
    key_evidence_gaps: Object.freeze(["Enterprise dedicated Internet pricing"]) as readonly string[],
  }),
  Object.freeze({
    provider_slug: "myrepublic_id",
    legal_name: "PT Eka Mas Republik (MyRepublic Indonesia)",
    parent: "Sinar Mas",
    regulatory_status_ID: "LICENSED_ISP",
    contract_classes_offered: Object.freeze(["CONSUMER", "SME_BUSINESS", "ENTERPRISE"]) as readonly ContractClass[],
    handoff_locations: Object.freeze(["Jakarta", "Surabaya", "Bandung", "Bali"]) as readonly string[],
    known_specialisation: "Consumer fibre + business · Sinar Mas group",
    public_pricing_availability: "PARTIAL_LIST",
    key_evidence_gaps: Object.freeze(["Business/enterprise pricing tiers"]) as readonly string[],
  }),
  Object.freeze({
    provider_slug: "fiberstar",
    legal_name: "PT Mega Akses Persada (Fiberstar)",
    parent: null,
    regulatory_status_ID: "LICENSED_ISP",
    contract_classes_offered: Object.freeze(["WHOLESALE_IP_TRANSIT", "OPERATOR_INTERCONNECT", "ENTERPRISE"]) as readonly ContractClass[],
    handoff_locations: Object.freeze(["Jakarta", "Multi-city backbone"]) as readonly string[],
    known_specialisation: "Backbone infrastructure + wholesale bandwidth to smaller ISPs",
    public_pricing_availability: "QUOTE_ONLY",
    key_evidence_gaps: Object.freeze(["Wholesale rates for smaller ISPs"]) as readonly string[],
  }),
  Object.freeze({
    provider_slug: "international_transit_indonesia_pop",
    legal_name: "International IP transit providers with Indonesian POPs",
    parent: null,
    regulatory_status_ID: "UNKNOWN",   // Depends on carrier · some have local subsidiaries
    contract_classes_offered: Object.freeze(["WHOLESALE_IP_TRANSIT"]) as readonly ContractClass[],
    handoff_locations: Object.freeze(["Jakarta submarine cable landing", "IIX", "specific data centres"]) as readonly string[],
    known_specialisation: "Global carriers (NTT · Tata · Cogent · Hurricane Electric · Zayo etc.) with POPs in Jakarta · typically require local partnership for last-mile delivery",
    public_pricing_availability: "QUOTE_ONLY",
    key_evidence_gaps: Object.freeze(["Which specific carriers have POPs in Indonesia", "Whether they sell direct to Indonesian entities"]) as readonly string[],
  }),
] as const);

export function findProvider(slug: string): ProviderRecord | null {
  return BANDWIDTH_PROVIDERS.find((p) => p.provider_slug === slug) ?? null;
}

// ═════════════════════════════════════════════════════════════════════
// Capacity tier ladder
// ═════════════════════════════════════════════════════════════════════

export type CapacityTier = "TIER_1_GBPS" | "TIER_10_GBPS" | "TIER_100_GBPS" | "TIER_1_TBPS";

export const CAPACITY_LADDER: readonly { tier: CapacityTier; mbps: number; label: string; typical_buyer: string }[] = Object.freeze([
  Object.freeze({ tier: "TIER_1_GBPS", mbps: 1_000, label: "1 Gbps", typical_buyer: "Medium enterprise or small WISP" }),
  Object.freeze({ tier: "TIER_10_GBPS", mbps: 10_000, label: "10 Gbps", typical_buyer: "Large enterprise or mid-size WISP/regional ISP" }),
  Object.freeze({ tier: "TIER_100_GBPS", mbps: 100_000, label: "100 Gbps", typical_buyer: "National-tier ISP" }),
  Object.freeze({ tier: "TIER_1_TBPS", mbps: 1_000_000, label: "1 Tbps", typical_buyer: "Very-large-scale operator (national telco level)" }),
] as const);

export function findTier(tier: CapacityTier): typeof CAPACITY_LADDER[number] | null {
  return CAPACITY_LADDER.find((t) => t.tier === tier) ?? null;
}

// ═════════════════════════════════════════════════════════════════════
// Price ledger
// ═════════════════════════════════════════════════════════════════════

export type PriceSource =
  | "PUBLIC_LIST_PRICE"        // provider publishes on their site
  | "PUBLIC_ANNOUNCEMENT"       // press release / annual report / regulator filing
  | "INDUSTRY_REPORT"           // e.g. TeleGeography public benchmark
  | "ESTIMATE_FROM_ANALOGUE"    // global market benchmark applied to Indonesia
  | "QUOTE_ONLY"                // no public pricing · provider quotes per customer
  | "UNKNOWN";                  // insufficient data

export type PriceRecord = {
  price_id: string;
  recorded_at_iso: string;
  provider_slug: string;
  capacity_tier: CapacityTier;
  contract_class: ContractClass;
  rp_per_mbps_per_month_best: number | null;      // best-case low end
  rp_per_mbps_per_month_worst: number | null;     // worst-case high end
  source: PriceSource;
  citation: string;
  note: string;
};

export class InvalidPriceError extends Error {
  constructor(reason: string) { super(`invalid_price:${reason}`); }
}

export function recordPrice(input: Omit<PriceRecord, "price_id" | "recorded_at_iso">): PriceRecord {
  if (!input.provider_slug || input.provider_slug.length < 2) throw new InvalidPriceError("provider_slug");
  if (!findProvider(input.provider_slug)) throw new InvalidPriceError(`unknown_provider:${input.provider_slug}`);
  if (!findTier(input.capacity_tier)) throw new InvalidPriceError(`unknown_tier:${input.capacity_tier}`);
  if (!input.source) throw new InvalidPriceError("source_required");
  // If source is QUOTE_ONLY or UNKNOWN, both bounds must be null
  if ((input.source === "QUOTE_ONLY" || input.source === "UNKNOWN") &&
      (input.rp_per_mbps_per_month_best !== null || input.rp_per_mbps_per_month_worst !== null)) {
    throw new InvalidPriceError("quote_only_or_unknown_requires_null_bounds");
  }
  // If a bound is provided the other must also be provided (range or nothing)
  if ((input.rp_per_mbps_per_month_best === null) !== (input.rp_per_mbps_per_month_worst === null)) {
    throw new InvalidPriceError("both_bounds_or_neither");
  }
  if (input.rp_per_mbps_per_month_best !== null && input.rp_per_mbps_per_month_worst !== null &&
      input.rp_per_mbps_per_month_best > input.rp_per_mbps_per_month_worst) {
    throw new InvalidPriceError("best_greater_than_worst");
  }
  const rec: PriceRecord = {
    ...input,
    price_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
  };
  appendJsonLine(bandwidthPricesPath(), rec);
  return rec;
}

export function readAllPrices(): PriceRecord[] {
  return readJsonlAll<PriceRecord>(bandwidthPricesPath());
}

export function currentPricesFor(providerSlug: string, tier: CapacityTier): PriceRecord[] {
  return readAllPrices().filter((p) => p.provider_slug === providerSlug && p.capacity_tier === tier);
}

// ═════════════════════════════════════════════════════════════════════
// Per-member cost computer
// ═════════════════════════════════════════════════════════════════════

export type PerMemberInputs = {
  provider_slug: string;
  capacity_tier: CapacityTier;
  rp_per_mbps_per_month_best: number | null;
  rp_per_mbps_per_month_worst: number | null;
  avg_bandwidth_per_active_user_mbps: number;
  concurrent_active_pct: number;                    // 0..1
  cache_hit_rate: number;                            // 0..1
  fixed_monthly_ops_idr: number;                     // hub/site/staff · flat
};

export type PerMemberResult = {
  computation_id: string;
  recorded_at_iso: string;
  provider_slug: string;
  capacity_tier: CapacityTier;
  supported_members_estimate: number | null;         // capacity mbps ÷ effective per-member mbps
  monthly_bandwidth_cost_idr_best: number | null;
  monthly_bandwidth_cost_idr_worst: number | null;
  monthly_total_cost_idr_best: number | null;        // + fixed_ops
  monthly_total_cost_idr_worst: number | null;
  per_member_cost_idr_best: number | null;
  per_member_cost_idr_worst: number | null;
  note: string;
};

export function computePerMemberCost(input: PerMemberInputs): PerMemberResult {
  const tier = findTier(input.capacity_tier);
  if (!tier) throw new InvalidPriceError(`unknown_tier:${input.capacity_tier}`);
  const cache = Math.max(0, Math.min(1, input.cache_hit_rate));
  const concurrent = Math.max(0, Math.min(1, input.concurrent_active_pct));
  const effectivePerUserMbps = input.avg_bandwidth_per_active_user_mbps * concurrent * (1 - cache);
  const supportedMembers = effectivePerUserMbps > 0
    ? Math.floor(tier.mbps / effectivePerUserMbps)
    : null;

  let bwBest: number | null = null;
  let bwWorst: number | null = null;
  let totBest: number | null = null;
  let totWorst: number | null = null;
  let perBest: number | null = null;
  let perWorst: number | null = null;

  if (input.rp_per_mbps_per_month_best !== null && input.rp_per_mbps_per_month_worst !== null) {
    bwBest = input.rp_per_mbps_per_month_best * tier.mbps;
    bwWorst = input.rp_per_mbps_per_month_worst * tier.mbps;
    totBest = bwBest + input.fixed_monthly_ops_idr;
    totWorst = bwWorst + input.fixed_monthly_ops_idr;
    if (supportedMembers && supportedMembers > 0) {
      perBest = Math.round(totBest / supportedMembers);
      perWorst = Math.round(totWorst / supportedMembers);
    }
  }

  const rec: PerMemberResult = {
    computation_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    provider_slug: input.provider_slug,
    capacity_tier: input.capacity_tier,
    supported_members_estimate: supportedMembers,
    monthly_bandwidth_cost_idr_best: bwBest === null ? null : Math.round(bwBest),
    monthly_bandwidth_cost_idr_worst: bwWorst === null ? null : Math.round(bwWorst),
    monthly_total_cost_idr_best: totBest === null ? null : Math.round(totBest),
    monthly_total_cost_idr_worst: totWorst === null ? null : Math.round(totWorst),
    per_member_cost_idr_best: perBest,
    per_member_cost_idr_worst: perWorst,
    note: `avg=${input.avg_bandwidth_per_active_user_mbps}Mbps × ${concurrent * 100}% concurrent × (1 - ${cache * 100}% cache) = ${Math.round(effectivePerUserMbps * 100) / 100} effective Mbps/member`,
  };
  appendJsonLine(bandwidthComputationsPath(), rec);
  return rec;
}

export function readAllComputations(): PerMemberResult[] {
  return readJsonlAll<PerMemberResult>(bandwidthComputationsPath());
}

export function _resetBandwidthMarketForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  for (const p of [bandwidthPricesPath(), bandwidthComputationsPath()]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
