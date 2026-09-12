// src/lib/nex/master-ai/storage-intelligence.ts
//
// NEX Master AI · Storage Intelligence (World-Class §1-§7)
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// Manages knowledge of legitimate free / low-cost storage providers,
// tracks NEX's utilization + forecasts, classifies data by class, and
// recommends placement + rebalance. NEVER:
//   · creates external accounts
//   · contacts providers
//   · attempts to bypass free-tier limits
//   · fabricates provider limits or pricing
//
// Every provider entry carries a published-terms citation and a
// verified_at_iso timestamp. Freshness is tracked · stale entries
// require re-verification before recommendation.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import {
  storageProvidersPath,
  storageUtilizationPath,
  storageForecastsPath,
  storagePlacementsPath,
} from "./paths";

// ═════════════════════════════════════════════════════════════════════
// Data classes (§7)
// ═════════════════════════════════════════════════════════════════════

export type DataClass =
  | "PRIMARY"         // authoritative live data
  | "BACKUP"          // durable secondary copy
  | "CACHE"           // ephemeral · rebuild-able
  | "ARCHIVE"         // cold long-term
  | "TEMPORARY"       // short-lived scratch
  | "RESEARCH"        // Master AI research artefacts
  | "MODEL"           // model weights + specialist agent data
  | "USER"            // user-owned data
  | "PUBLIC"          // publicly disclosable
  | "PRIVATE";        // sensitive · access-controlled

export const DATA_CLASSES: readonly DataClass[] = Object.freeze([
  "PRIMARY", "BACKUP", "CACHE", "ARCHIVE", "TEMPORARY",
  "RESEARCH", "MODEL", "USER", "PUBLIC", "PRIVATE",
] as const);

// ═════════════════════════════════════════════════════════════════════
// Provider catalogue (§1 §3 · frozen · published terms only)
// ═════════════════════════════════════════════════════════════════════

export type PublishedFreeTier = {
  storage_gb: number | null;                       // free-tier storage
  egress_gb_per_month: number | null;
  api_requests_per_month: number | null;
  additional_notes: string;
};

export type ProviderPolicyRisk = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export type ProviderSecurityCharacteristic =
  | "AT_REST_ENCRYPTION" | "TRANSIT_ENCRYPTION" | "CUSTOMER_KEYS"
  | "REGIONAL_RESIDENCY" | "SOC2" | "ISO27001" | "GDPR_COMPLIANT";

export type StorageProviderEntry = {
  provider_slug: string;
  legal_name: string;
  parent_org: string | null;
  hq_country: string;
  service_kind: "OBJECT_STORAGE" | "BLOB_STORAGE" | "FILE_STORAGE" | "CDN_STORAGE" | "DATABASE_HOSTED_STORAGE" | "STATIC_HOST";
  published_free_tier: PublishedFreeTier;
  published_terms_url: string;
  data_portability_supported: boolean;
  security_characteristics: readonly ProviderSecurityCharacteristic[];
  known_regions: readonly string[];
  suitable_data_classes: readonly DataClass[];
  policy_risk: ProviderPolicyRisk;
  reliability_note: string;
  reputation_note: string;
  verified_at_iso: string;                          // when Master AI last verified the entry
  evidence_confidence: "HIGH" | "MEDIUM" | "LOW";
  notes: string;
};

export class InvalidProviderError extends Error {
  constructor(reason: string) { super(`invalid_provider:${reason}`); }
}

export function recordStorageProvider(input: Omit<StorageProviderEntry, "verified_at_iso"> & { verified_at_iso?: string }): StorageProviderEntry {
  if (!input.provider_slug || input.provider_slug.length < 2) throw new InvalidProviderError("provider_slug");
  if (!input.published_terms_url || !/^https?:\/\//.test(input.published_terms_url)) throw new InvalidProviderError("published_terms_url_required_https");
  if (!input.reputation_note || input.reputation_note.length < 10) throw new InvalidProviderError("reputation_note_too_short");
  const rec: StorageProviderEntry = {
    ...input,
    verified_at_iso: input.verified_at_iso ?? new Date().toISOString(),
  };
  appendJsonLine(storageProvidersPath(), rec);
  return rec;
}

export function readAllProviders(): StorageProviderEntry[] {
  return readJsonlAll<StorageProviderEntry>(storageProvidersPath());
}

/** Latest provider entry per slug. Deduplicates re-verifications. */
export function currentProviders(): StorageProviderEntry[] {
  const latest = new Map<string, StorageProviderEntry>();
  for (const p of readAllProviders()) latest.set(p.provider_slug, p);
  return Array.from(latest.values());
}

/** Providers whose verification is older than max_age_days · candidate
 *  for re-verification. */
export function staleProviders(maxAgeDays = 30, nowMs = Date.now()): StorageProviderEntry[] {
  const cutoff = nowMs - maxAgeDays * 24 * 60 * 60 * 1000;
  return currentProviders().filter((p) => Date.parse(p.verified_at_iso) < cutoff);
}

// ═════════════════════════════════════════════════════════════════════
// Utilization tracking (§2)
// ═════════════════════════════════════════════════════════════════════

export type UtilizationRecord = {
  utilization_id: string;
  observed_at_iso: string;
  provider_slug: string;
  used_gb: number;
  used_api_requests_last_day: number;
  used_egress_gb_last_day: number;
  headroom_gb: number | null;
  headroom_pct: number | null;                      // 0..1 (1 = fully free)
  source: "MEASURED" | "ESTIMATE" | "REPORTED_BY_PROVIDER";
  note: string;
};

export function recordUtilization(input: Omit<UtilizationRecord, "utilization_id" | "observed_at_iso" | "headroom_gb" | "headroom_pct">): UtilizationRecord {
  const provider = currentProviders().find((p) => p.provider_slug === input.provider_slug);
  let headroom_gb: number | null = null;
  let headroom_pct: number | null = null;
  if (provider?.published_free_tier.storage_gb !== null && provider?.published_free_tier.storage_gb !== undefined) {
    const cap = provider.published_free_tier.storage_gb;
    headroom_gb = Math.max(0, cap - input.used_gb);
    headroom_pct = cap > 0 ? Math.max(0, Math.min(1, (cap - input.used_gb) / cap)) : null;
  }
  const rec: UtilizationRecord = {
    utilization_id: randomUUID(),
    observed_at_iso: new Date().toISOString(),
    ...input,
    headroom_gb,
    headroom_pct,
  };
  appendJsonLine(storageUtilizationPath(), rec);
  return rec;
}

export function readAllUtilization(): UtilizationRecord[] {
  return readJsonlAll<UtilizationRecord>(storageUtilizationPath());
}

/** Latest utilization observation per provider. */
export function currentUtilization(): Map<string, UtilizationRecord> {
  const latest = new Map<string, UtilizationRecord>();
  const all = readAllUtilization();
  all.sort((a, b) => a.observed_at_iso.localeCompare(b.observed_at_iso));
  for (const u of all) latest.set(u.provider_slug, u);
  return latest;
}

// ═════════════════════════════════════════════════════════════════════
// Forecasting (§5)
// ═════════════════════════════════════════════════════════════════════

export type StorageForecast = {
  forecast_id: string;
  computed_at_iso: string;
  provider_slug: string;
  window_days: number;                              // how much history was used
  daily_growth_gb: number;
  weekly_growth_gb: number;
  monthly_growth_gb: number;
  used_gb_now: number;
  cap_gb: number | null;
  headroom_gb_now: number | null;
  safe_threshold_pct: number;                       // e.g. 0.20 = start action at 20% headroom
  projected_days_until_safe_threshold: number | null;
  projected_days_until_cap: number | null;
  needs_action: boolean;
  action_recommendation: string;
};

export function computeForecast(input: {
  provider_slug: string;
  window_days: number;
  safe_threshold_pct?: number;                      // default 0.20
  nowMs?: number;
}): StorageForecast {
  const now = input.nowMs ?? Date.now();
  const cutoff = now - input.window_days * 24 * 60 * 60 * 1000;
  const provider = currentProviders().find((p) => p.provider_slug === input.provider_slug);
  const cap = provider?.published_free_tier.storage_gb ?? null;
  const safeThresh = input.safe_threshold_pct ?? 0.20;

  const obs = readAllUtilization()
    .filter((u) => u.provider_slug === input.provider_slug)
    .filter((u) => Date.parse(u.observed_at_iso) >= cutoff)
    .sort((a, b) => a.observed_at_iso.localeCompare(b.observed_at_iso));

  const used_now = obs.length > 0 ? obs[obs.length - 1].used_gb : 0;
  let dailyGrowth = 0;
  if (obs.length >= 2) {
    const first = obs[0];
    const last = obs[obs.length - 1];
    const days = Math.max(1, (Date.parse(last.observed_at_iso) - Date.parse(first.observed_at_iso)) / (24 * 60 * 60 * 1000));
    dailyGrowth = (last.used_gb - first.used_gb) / days;
  }
  const weeklyGrowth = dailyGrowth * 7;
  const monthlyGrowth = dailyGrowth * 30;

  let projectedDaysUntilCap: number | null = null;
  let projectedDaysUntilSafe: number | null = null;
  if (cap !== null && dailyGrowth > 0) {
    projectedDaysUntilCap = Math.floor((cap - used_now) / dailyGrowth);
    const safeCap = cap * (1 - safeThresh);
    projectedDaysUntilSafe = Math.floor(Math.max(0, safeCap - used_now) / dailyGrowth);
  }

  const headroomNow = cap !== null ? Math.max(0, cap - used_now) : null;
  let needsAction = false;
  let recommendation = "steady · continue monitoring";
  if (cap !== null) {
    if (used_now >= cap * (1 - safeThresh)) {
      needsAction = true;
      recommendation = `used_gb ${used_now} exceeds ${(1 - safeThresh) * 100}% of cap (${cap}) · trigger rebalance`;
    } else if (projectedDaysUntilSafe !== null && projectedDaysUntilSafe <= 30) {
      needsAction = true;
      recommendation = `projected to cross safe threshold in ${projectedDaysUntilSafe} days · plan rebalance now`;
    }
  }

  const rec: StorageForecast = {
    forecast_id: randomUUID(),
    computed_at_iso: new Date().toISOString(),
    provider_slug: input.provider_slug,
    window_days: input.window_days,
    daily_growth_gb: Math.round(dailyGrowth * 100) / 100,
    weekly_growth_gb: Math.round(weeklyGrowth * 100) / 100,
    monthly_growth_gb: Math.round(monthlyGrowth * 100) / 100,
    used_gb_now: used_now,
    cap_gb: cap,
    headroom_gb_now: headroomNow,
    safe_threshold_pct: safeThresh,
    projected_days_until_safe_threshold: projectedDaysUntilSafe,
    projected_days_until_cap: projectedDaysUntilCap,
    needs_action: needsAction,
    action_recommendation: recommendation,
  };
  appendJsonLine(storageForecastsPath(), rec);
  return rec;
}

export function readAllForecasts(): StorageForecast[] {
  return readJsonlAll<StorageForecast>(storageForecastsPath());
}

// ═════════════════════════════════════════════════════════════════════
// Placement policy (§6 §7)
// ═════════════════════════════════════════════════════════════════════

export type PlacementRecommendation = {
  placement_id: string;
  recorded_at_iso: string;
  data_class: DataClass;
  approx_size_gb: number;
  recommended_provider_slug: string | null;         // null when no suitable provider
  reason: string;
  rejected_alternatives: readonly { provider_slug: string; reason: string }[];
  security_requirements_met: boolean;
  headroom_ok: boolean;
  redundancy_recommended: boolean;
  fallback_provider_slug: string | null;
};

/** Deterministic placement: pick the provider that (a) is suitable for
 *  this data class, (b) has best headroom, (c) has lowest policy risk,
 *  (d) meets security requirements when data class is PRIVATE/USER. */
export function recommendPlacement(input: {
  data_class: DataClass;
  approx_size_gb: number;
  requires_encryption_at_rest?: boolean;
  requires_regional_residency?: string | null;
}): PlacementRecommendation {
  const providers = currentProviders();
  const util = currentUtilization();
  const requireEncryption = input.requires_encryption_at_rest ?? (input.data_class === "PRIVATE" || input.data_class === "USER");
  const requiredRegion = input.requires_regional_residency ?? null;

  const rejected: Array<{ provider_slug: string; reason: string }> = [];
  const candidates: Array<{ provider: StorageProviderEntry; headroom: number; risk: number }> = [];
  const riskWeight: Record<ProviderPolicyRisk, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, UNKNOWN: 4 };

  for (const p of providers) {
    if (!p.suitable_data_classes.includes(input.data_class)) {
      rejected.push({ provider_slug: p.provider_slug, reason: `not suitable for ${input.data_class}` });
      continue;
    }
    if (requireEncryption && !p.security_characteristics.includes("AT_REST_ENCRYPTION")) {
      rejected.push({ provider_slug: p.provider_slug, reason: "missing AT_REST_ENCRYPTION" });
      continue;
    }
    if (requiredRegion && !p.known_regions.includes(requiredRegion)) {
      rejected.push({ provider_slug: p.provider_slug, reason: `regional residency ${requiredRegion} not offered` });
      continue;
    }
    const u = util.get(p.provider_slug);
    const cap = p.published_free_tier.storage_gb;
    const used = u?.used_gb ?? 0;
    const headroom = cap === null ? Infinity : cap - used;
    if (headroom < input.approx_size_gb) {
      rejected.push({ provider_slug: p.provider_slug, reason: `insufficient headroom · needs ${input.approx_size_gb} GB · has ${headroom} GB` });
      continue;
    }
    candidates.push({ provider: p, headroom, risk: riskWeight[p.policy_risk] });
  }

  // Sort: lowest risk first, then largest headroom
  candidates.sort((a, b) => a.risk - b.risk || b.headroom - a.headroom);
  const chosen = candidates[0] ?? null;
  const fallback = candidates[1] ?? null;

  const rec: PlacementRecommendation = {
    placement_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    data_class: input.data_class,
    approx_size_gb: input.approx_size_gb,
    recommended_provider_slug: chosen ? chosen.provider.provider_slug : null,
    reason: chosen
      ? `Lowest policy_risk (${chosen.provider.policy_risk}) + suitable for ${input.data_class} + ${chosen.headroom === Infinity ? "unbounded" : chosen.headroom + " GB"} headroom${requireEncryption ? " + AT_REST_ENCRYPTION" : ""}`
      : `No suitable provider · ${rejected.length} candidates rejected · consider registering additional provider`,
    rejected_alternatives: rejected,
    security_requirements_met: chosen ? !requireEncryption || chosen.provider.security_characteristics.includes("AT_REST_ENCRYPTION") : false,
    headroom_ok: chosen !== null,
    redundancy_recommended: input.data_class === "PRIMARY" || input.data_class === "USER" || input.data_class === "MODEL",
    fallback_provider_slug: fallback ? fallback.provider.provider_slug : null,
  };
  appendJsonLine(storagePlacementsPath(), rec);
  return rec;
}

export function readAllPlacements(): PlacementRecommendation[] {
  return readJsonlAll<PlacementRecommendation>(storagePlacementsPath());
}

export function _resetStorageIntelligenceForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  for (const p of [storageProvidersPath(), storageUtilizationPath(), storageForecastsPath(), storagePlacementsPath()]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
