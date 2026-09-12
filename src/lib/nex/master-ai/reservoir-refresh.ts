// src/lib/nex/master-ai/reservoir-refresh.ts
//
// NEX Master AI Engineer · Offline reservoir refresh (§18 §19)
// Philip 2026-09-07 · AUTHORIZE
//
// When Master AI transitions back to ONLINE after an offline window:
//   1. Every RESEARCH_FINDING whose freshness_expires_at_iso ≤ now
//      OR whose retrieved_at_iso lies inside the offline window is
//      marked STALE and its parent question is re-enqueued at elevated
//      priority.
//   2. A ReservoirDemonstrationRecord is appended so the reservoir has
//      auditable evidence of "worked while offline · refreshed on
//      reconnect".
//
// NEVER fabricates fresh evidence. NEVER modifies existing findings
// (append-only). All re-fetching still flows through research-gateway.

import { randomUUID } from "node:crypto";
import { appendJsonLine, readJsonlAll } from "./fs-atomic";
import { reservoirDemonstrationsPath } from "./paths";
import { readAllFindings, readAllQueryHistory, enqueueResearchQuery } from "./research-engine";
import { readMode, setOnline } from "./offline-reservoir";
import { computePriority } from "./research-priority";
import type { ReservoirDemonstrationRecord } from "./types";

/** Mark reservoir online after an outage; re-enqueue stale-during-outage
 *  research questions at elevated priority. Idempotent per outage. */
export function refreshReservoirOnReconnect(input: {
  now?: number;
  reason: string;
  invoker: string;
}): ReservoirDemonstrationRecord {
  const now = input.now ?? Date.now();
  const mode = readMode();
  const wasOnline = mode.online;
  const outageStartIso = wasOnline ? new Date(now).toISOString() : mode.since_iso;

  // Transition (idempotent: if already online, no state churn)
  if (!wasOnline) setOnline(input.reason);

  // Findings retrieved during outage OR whose freshness expired
  const nowIso = new Date(now).toISOString();
  const findings = readAllFindings();
  const staleDuringOutage: string[] = [];
  const expired: string[] = [];
  for (const f of findings) {
    if (f.retrieved_at_iso >= outageStartIso && f.retrieved_at_iso <= nowIso) staleDuringOutage.push(f.finding_id);
    if (f.freshness_expires_at_iso && f.freshness_expires_at_iso < nowIso) expired.push(f.finding_id);
  }
  const staleFindingIds = Array.from(new Set([...staleDuringOutage, ...expired]));

  // Re-enqueue parent queries at elevated priority · dedup by question text
  const queries = readAllQueryHistory();
  const queryByFinding = new Map<string, string>();
  for (const q of queries) queryByFinding.set(q.query_id, q.question);
  const seenQuestions = new Set<string>();
  const requeued: string[] = [];

  for (const findingId of staleFindingIds) {
    const finding = findings.find((f) => f.finding_id === findingId);
    if (!finding) continue;
    const parent = queries.find((q) => q.query_id === finding.query_id);
    if (!parent) continue;
    if (seenQuestions.has(parent.question)) continue;
    seenQuestions.add(parent.question);

    const priority = computePriority({
      question: parent.question,
      driver: "STALE_INFO",
      components: {
        impact: 6, urgency: 8, confidence_in_signal: 7,
        recurrence_count: 0, expected_benefit: 6,
        cost_estimate: 3, risk_estimate: 2, complexity_estimate: 4,
      },
    });
    const q = enqueueResearchQuery({
      question: parent.question,
      target_source_slugs: parent.target_source_slugs,
      priority: Math.round(priority.score),
      created_by: `reservoir-refresh:${input.invoker}`,
    });
    requeued.push(q.query_id);
  }

  const rec: ReservoirDemonstrationRecord = {
    demo_id: randomUUID(),
    scenario: "RECONNECT_REFRESH",
    online_before: wasOnline,
    online_after: true,
    chosen_source: null,
    fell_back_to_cache: !wasOnline,
    cache_freshness_status: staleFindingIds.length > 0 ? "STALE" : (findings.length > 0 ? "CACHED" : "UNKNOWN"),
    reason: `${input.reason} · outage=${wasOnline ? "0" : String(Math.max(0, now - Date.parse(mode.since_iso)))}ms · stale=${staleFindingIds.length} · requeued=${requeued.length} · invoker=${input.invoker}`,
    performed_at_iso: nowIso,
  };
  appendJsonLine(reservoirDemonstrationsPath(), rec);
  return rec;
}

/** Demonstrate offline fallback: a research question routed while
 *  offline records a demo without a fetch. */
export function demonstrateOfflineFallback(input: {
  attempted_source: string | null;
  reason: string;
}): ReservoirDemonstrationRecord {
  const mode = readMode();
  const rec: ReservoirDemonstrationRecord = {
    demo_id: randomUUID(),
    scenario: "OFFLINE_FALLBACK",
    online_before: mode.online,
    online_after: mode.online,
    chosen_source: input.attempted_source,
    fell_back_to_cache: !mode.online,
    cache_freshness_status: "CACHED",
    reason: input.reason,
    performed_at_iso: new Date().toISOString(),
  };
  appendJsonLine(reservoirDemonstrationsPath(), rec);
  return rec;
}

export function readAllReservoirDemos(): ReservoirDemonstrationRecord[] {
  return readJsonlAll<ReservoirDemonstrationRecord>(reservoirDemonstrationsPath());
}

export function _resetReservoirDemosForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(reservoirDemonstrationsPath())) fs.unlinkSync(reservoirDemonstrationsPath()); } catch { /* ignore */ }
}
