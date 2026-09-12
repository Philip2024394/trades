// src/lib/nex/master-ai/offline-resilience-manager.ts
//
// NEX Master AI · Offline Resilience Manager (World-First §5)
// Philip 2026-09-07 · AUTHORIZE
//
// Explicit 24/7 offline-capable orchestration on top of the existing
// offline-reservoir.ts. This manager:
//   · Tracks online/offline state transitions with audit trail
//   · Records reservoir freshness policy per data category
//   · Provides decision priorities when offline (favor authoritative
//     cached knowledge over fresh unverified research)
//   · Records ONLINE→OFFLINE and OFFLINE→ONLINE transitions
//     with what continued to work vs what degraded
//
// HONESTY:
//   · Cannot fabricate offline knowledge · when reservoir has nothing,
//     honestly reports NO_OFFLINE_KNOWLEDGE
//   · Cannot generate code offline without a local LLM (which is not
//     shipped in this module) · offline mode = read/reason/route only

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { offlineResilienceStatesPath } from "./paths";
import { readMode as readOfflineMode, setOffline, setOnline } from "./offline-reservoir";

// ═════════════════════════════════════════════════════════════════════
// Offline decision priorities
// ═════════════════════════════════════════════════════════════════════

export type OfflineDecisionMode =
  | "PREFER_CACHED_TIER_1"      // use cached TIER_1 evidence even if stale
  | "PREFER_CACHED_ANY"          // use any cached evidence · degrade gracefully
  | "REFUSE_ACTION"              // insufficient offline knowledge · defer
  | "OBSERVE_ONLY"               // continue observation but take no action
  | "UNKNOWN";

export type CategoryFreshnessPolicy = {
  category: string;                                 // e.g. "regulation" · "pricing" · "spectrum"
  fresh_ttl_hours: number;                          // how long to consider fresh
  stale_but_usable_ttl_hours: number;              // beyond fresh but still usable offline
  refuse_beyond_ttl: boolean;                       // if true, don't use past stale_but_usable
};

/** Default policies · conservative by default. */
export const DEFAULT_FRESHNESS_POLICIES: readonly CategoryFreshnessPolicy[] = Object.freeze([
  Object.freeze({ category: "regulation", fresh_ttl_hours: 24 * 30, stale_but_usable_ttl_hours: 24 * 90, refuse_beyond_ttl: true }),
  Object.freeze({ category: "pricing", fresh_ttl_hours: 24 * 7, stale_but_usable_ttl_hours: 24 * 30, refuse_beyond_ttl: false }),
  Object.freeze({ category: "spectrum", fresh_ttl_hours: 24 * 60, stale_but_usable_ttl_hours: 24 * 180, refuse_beyond_ttl: true }),
  Object.freeze({ category: "carrier_metadata", fresh_ttl_hours: 24 * 30, stale_but_usable_ttl_hours: 24 * 90, refuse_beyond_ttl: false }),
  Object.freeze({ category: "connectivity_architecture", fresh_ttl_hours: 24 * 90, stale_but_usable_ttl_hours: 24 * 365, refuse_beyond_ttl: false }),
  Object.freeze({ category: "local_knowledge", fresh_ttl_hours: 24 * 90, stale_but_usable_ttl_hours: 24 * 180, refuse_beyond_ttl: false }),
] as const);

export function findFreshnessPolicy(category: string): CategoryFreshnessPolicy | null {
  return DEFAULT_FRESHNESS_POLICIES.find((p) => p.category === category) ?? null;
}

export type FreshnessVerdict = "FRESH" | "STALE_BUT_USABLE" | "REFUSED_TOO_STALE" | "NO_POLICY";

/** Determine offline usability of a cached record by age. */
export function assessCachedFreshness(input: {
  category: string;
  cached_iso: string;
  now?: number;
}): FreshnessVerdict {
  const policy = findFreshnessPolicy(input.category);
  if (!policy) return "NO_POLICY";
  const ageMs = (input.now ?? Date.now()) - Date.parse(input.cached_iso);
  const ageHours = ageMs / (60 * 60 * 1000);
  if (ageHours <= policy.fresh_ttl_hours) return "FRESH";
  if (ageHours <= policy.stale_but_usable_ttl_hours) return "STALE_BUT_USABLE";
  if (policy.refuse_beyond_ttl) return "REFUSED_TOO_STALE";
  return "STALE_BUT_USABLE";                        // if not refuse_beyond_ttl, still usable
}

/** Given a decision context while offline, pick the appropriate mode. */
export function pickOfflineMode(input: {
  cached_tier_1_available: boolean;
  cached_any_available: boolean;
  action_requires_current_info: boolean;
  action_reversibility: "REVERSIBLE" | "IRREVERSIBLE" | "UNKNOWN";
}): { mode: OfflineDecisionMode; reasoning: string } {
  if (input.action_reversibility === "IRREVERSIBLE" && input.action_requires_current_info) {
    return { mode: "REFUSE_ACTION", reasoning: "irreversible action requiring current info + offline mode = refuse" };
  }
  if (input.cached_tier_1_available) {
    return { mode: "PREFER_CACHED_TIER_1", reasoning: "TIER_1 authoritative evidence in cache · use with stale flag" };
  }
  if (input.cached_any_available && !input.action_requires_current_info) {
    return { mode: "PREFER_CACHED_ANY", reasoning: "any cached evidence acceptable for non-current-info action" };
  }
  if (input.cached_any_available && input.action_requires_current_info) {
    return { mode: "REFUSE_ACTION", reasoning: "current info required but only stale cache available" };
  }
  return { mode: "OBSERVE_ONLY", reasoning: "no cached evidence · continue observation but take no action" };
}

// ═════════════════════════════════════════════════════════════════════
// State transition audit
// ═════════════════════════════════════════════════════════════════════

export type ResilienceTransition = "ONLINE_TO_OFFLINE" | "OFFLINE_TO_ONLINE" | "STEADY_ONLINE" | "STEADY_OFFLINE";

export type OfflineResilienceState = {
  state_id: string;
  recorded_at_iso: string;
  transition: ResilienceTransition;
  reason: string;
  online_at_start: boolean;
  online_at_end: boolean;
  offline_duration_ms: number | null;               // populated on OFFLINE_TO_ONLINE
  what_continued_to_work: readonly string[];
  what_degraded: readonly string[];
  cached_findings_count: number;
  actions_deferred_count: number;
};

export function recordTransition(input: Omit<OfflineResilienceState, "state_id" | "recorded_at_iso">): OfflineResilienceState {
  const rec: OfflineResilienceState = {
    ...input,
    state_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
  };
  appendJsonLine(offlineResilienceStatesPath(), rec);
  return rec;
}

export function readAllTransitions(): OfflineResilienceState[] {
  return readJsonlAll<OfflineResilienceState>(offlineResilienceStatesPath());
}

/** Simulate a bounded ONLINE→OFFLINE→ONLINE transition for demonstration
 *  purposes. Returns two records (transition to offline · transition back
 *  to online) that codify what continued to work. */
export function simulateOfflineToOnlineCycle(input: {
  reason: string;
  simulated_offline_duration_ms: number;
  cached_findings_count: number;
  what_continues: readonly string[];
  what_degrades: readonly string[];
}): { to_offline: OfflineResilienceState; back_to_online: OfflineResilienceState } {
  const startMode = readOfflineMode();
  const wasOnline = startMode.online;
  // Transition to offline
  setOffline(input.reason);
  const toOffline = recordTransition({
    transition: wasOnline ? "ONLINE_TO_OFFLINE" : "STEADY_OFFLINE",
    reason: input.reason,
    online_at_start: wasOnline, online_at_end: false,
    offline_duration_ms: null,
    what_continued_to_work: input.what_continues,
    what_degraded: input.what_degrades,
    cached_findings_count: input.cached_findings_count,
    actions_deferred_count: input.what_degrades.length,
  });
  // Transition back to online
  setOnline("simulated_reconnect");
  const backToOnline = recordTransition({
    transition: "OFFLINE_TO_ONLINE",
    reason: "simulated_reconnect",
    online_at_start: false, online_at_end: true,
    offline_duration_ms: input.simulated_offline_duration_ms,
    what_continued_to_work: input.what_continues,
    what_degraded: input.what_degrades,
    cached_findings_count: input.cached_findings_count,
    actions_deferred_count: input.what_degrades.length,
  });
  return { to_offline: toOffline, back_to_online: backToOnline };
}

/** What subsystems continue working offline (based on architectural knowledge)? */
export const OFFLINE_CAPABLE_SUBSYSTEMS: readonly string[] = Object.freeze([
  "observatoryTick",              // reads local heartbeats
  "failureIntelligence",          // reads local events
  "failureTrajectory",             // reads failure_patterns
  "knowledgeLedger",               // reads local knowledge
  "philipIntelligence",            // reads local claims
  "selfCriticism",                 // reads local ledgers
  "dailyIntelligence",             // reads local ledgers
  "decisionIntelligence",          // pure function on inputs
  "multilingualIntelligence",      // recordTranslation + local detection
  "storageIntelligence",           // catalogue + policy computations
  "localKnowledgeIntelligence",    // read cached profiles
  "crossAgentIntelligence",        // pure compatibility assessment
  "taskComplexityClassification",  // pure function
  "delegationExecutor",            // observation-only execution
  "errorDetectionEngine",          // reads local events + ledgers
  "autoRepairProposer",            // creates local delegations
  "selfImprovementScheduler",      // scans local state
]);

/** What subsystems degrade offline? */
export const OFFLINE_DEGRADED_SUBSYSTEMS: readonly string[] = Object.freeze([
  "researchGateway_live_fetch",    // no HTTPS = no new research
  "compliantHttpAdapter",          // requires network
  "wikipediaAdapter",              // requires network
  "primarySourceAdapter",          // requires network
  "internetProbe",                 // requires network
  "reconciliation_new_sources",    // limited to already-cached findings
]);

export function _resetOfflineResilienceForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(offlineResilienceStatesPath())) fs.unlinkSync(offlineResilienceStatesPath()); } catch { /* ignore */ }
}
