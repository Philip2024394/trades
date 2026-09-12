// src/lib/nex/master-ai/research-gateway.ts
//
// NEX Master AI Engineer · Research Gateway (§7 §8)
// Philip 2026-09-07 · AUTHORIZE
//
// THE ONLY authorised path from a ResearchQuery to a stored
// ResearchFinding. Every real adapter fetch flows through here:
//
//   Query
//     ↓
//   selectSource (federation · quota · health)
//     ↓
//   authority check (implicit in getSource + selection)
//     ↓
//   tryConsume (quota fail-closed)
//     ↓
//   adapter.fetch (the only external call)
//     ↓
//   evidence
//     ↓
//   sha256 content hash (dedup in recordFinding)
//     ↓
//   classify (research-engine downgrades FACT if authority < TIER_2)
//     ↓
//   reconcile (optional cross-source)
//     ↓
//   store (findings ledger)
//
// Adapters do NOT store findings themselves. They do NOT consult
// quota themselves. The gateway is the enforcement point (§8).

import {
  updateQueryStatus,
  recordFinding,
  getAdapter,
  getSource,
} from "./research-engine";
import { selectSource } from "./source-federation";
import { tryConsume } from "./cost-intelligence";
import { recordSourceHealth } from "./source-federation";
import { readMode as readOfflineMode } from "./offline-reservoir";
import type {
  ResearchQuery,
  ResearchFinding,
  AuthorityTier,
  UsageMetric,
  ClaimClassification,
} from "./types";

export type GatewayFetchOutcome =
  | { status: "OK"; finding: ResearchFinding; source_slug: string }
  | { status: "BLOCKED"; reason: string; source_slug: string }
  | { status: "NOT_FOUND"; reason: string; source_slug: string }         // no article · source still HEALTHY
  | { status: "FALLTHROUGH_TO_OFFLINE"; reason: string; alternatives_skipped: Array<{ source_slug: string; reason: string }> }
  | { status: "OFFLINE_MODE"; reason: string }
  | { status: "ADAPTER_MISSING"; source_slug: string }
  | { status: "FETCH_FAILED"; reason: string; source_slug: string };

/** Execute one research query through the enforced gateway. Optional
 *  claim_classification argument lets the caller assert what kind of
 *  claim it believes the evidence supports · the classifier will still
 *  downgrade FACT if authority is insufficient. */
export async function performResearch(input: {
  query: ResearchQuery;
  invoker: string;
  units_required?: number;                       // default 1 REQUEST
  metric?: UsageMetric;
  claimed_classification?: ClaimClassification;
  now?: number;
}): Promise<GatewayFetchOutcome> {
  const metric = input.metric ?? "REQUEST";
  const units = input.units_required ?? 1;

  // Step 0 · Offline enforcement — never fetch while offline (§18)
  const mode = readOfflineMode();
  if (!mode.online) {
    updateQueryStatus({ query_id: input.query.query_id, status: "BLOCKED", blocked_reason: `offline_mode:${mode.reason}` });
    return { status: "OFFLINE_MODE", reason: `offline_mode:${mode.reason}` };
  }

  // Step 1 · Source selection through federation (respects health + quota + authorization)
  const selection = selectSource({
    candidate_slugs: input.query.target_source_slugs,
    metric,
    units_required: units,
    now: input.now,
  });
  if (selection.chosen === null) {
    updateQueryStatus({ query_id: input.query.query_id, status: "BLOCKED", blocked_reason: selection.reason });
    return {
      status: "FALLTHROUGH_TO_OFFLINE",
      reason: selection.reason,
      alternatives_skipped: selection.alternatives_skipped,
    };
  }

  const chosen = selection.chosen;
  const source = getSource(chosen);
  if (!source) {
    updateQueryStatus({ query_id: input.query.query_id, status: "BLOCKED", blocked_reason: `source_disappeared:${chosen}` });
    return { status: "BLOCKED", reason: `source_disappeared:${chosen}`, source_slug: chosen };
  }

  // Step 2 · Adapter must be registered
  const adapter = getAdapter(chosen);
  if (!adapter) {
    updateQueryStatus({ query_id: input.query.query_id, status: "BLOCKED", blocked_reason: `no_adapter:${chosen}` });
    return { status: "ADAPTER_MISSING", source_slug: chosen };
  }

  // Step 3 · Consume quota BEFORE the fetch (fail-closed enforcement)
  const usage = tryConsume({
    source_slug: chosen, metric, units, invoker: input.invoker, now: input.now,
  });
  if (usage.status !== "OK") {
    updateQueryStatus({ query_id: input.query.query_id, status: "BLOCKED", blocked_reason: `quota:${usage.status}` });
    return { status: "BLOCKED", reason: `quota:${usage.status}`, source_slug: chosen };
  }

  // Step 4 · The ONE external call permitted by the gateway
  updateQueryStatus({ query_id: input.query.query_id, status: "IN_PROGRESS" });
  const result = await adapter.fetch(input.query);
  const nowIso = new Date().toISOString();

  if (result.status === "BLOCKED") {
    recordSourceHealth({
      source_slug: chosen, health: "UNAVAILABLE",
      requests_last_hour: 1, requests_last_day: 1, failures_last_hour: 1,
      quota_used_ratio: -1,
      latest_success_iso: null,
      latest_failure_iso: nowIso,
      latest_failure_reason: result.reason,
    });
    updateQueryStatus({ query_id: input.query.query_id, status: "BLOCKED", blocked_reason: result.reason });
    return { status: "BLOCKED", reason: result.reason, source_slug: chosen };
  }
  if (result.status === "FAILED") {
    recordSourceHealth({
      source_slug: chosen, health: "DEGRADED",
      requests_last_hour: 1, requests_last_day: 1, failures_last_hour: 1,
      quota_used_ratio: -1,
      latest_success_iso: null,
      latest_failure_iso: nowIso,
      latest_failure_reason: result.reason,
    });
    updateQueryStatus({ query_id: input.query.query_id, status: "FAILED", blocked_reason: result.reason });
    return { status: "FETCH_FAILED", reason: result.reason, source_slug: chosen };
  }
  if (result.status === "NOT_FOUND") {
    // Source is HEALTHY · this specific query just has no answer at this source
    recordSourceHealth({
      source_slug: chosen, health: "HEALTHY",
      requests_last_hour: 1, requests_last_day: 1, failures_last_hour: 0,
      quota_used_ratio: -1,
      latest_success_iso: nowIso,                // the source responded correctly
      latest_failure_iso: null, latest_failure_reason: null,
    });
    updateQueryStatus({ query_id: input.query.query_id, status: "FAILED", blocked_reason: result.reason });
    return { status: "NOT_FOUND", reason: result.reason, source_slug: chosen };
  }

  // Step 5 · Success · classify + store (dedup by content hash inside recordFinding)
  recordSourceHealth({
    source_slug: chosen, health: "HEALTHY",
    requests_last_hour: 1, requests_last_day: 1, failures_last_hour: 0,
    quota_used_ratio: -1,
    latest_success_iso: nowIso,
    latest_failure_iso: null, latest_failure_reason: null,
  });

  const authority_tier: AuthorityTier = source.authority_tier;
  const finding = recordFinding({
    query_id: input.query.query_id,
    source_slug: chosen,
    authority_tier,
    claimed_classification: input.claimed_classification,
    raw_evidence: result.raw_evidence,
    normalized_claim: result.raw_evidence.trim(),
    retrieved_at_iso: result.retrieved_at_iso,
    freshness_expires_at_iso: null,
    language: result.language,
    license: result.license,
  });
  updateQueryStatus({ query_id: input.query.query_id, status: "COMPLETED" });
  return { status: "OK", finding, source_slug: chosen };
}
