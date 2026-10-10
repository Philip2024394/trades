// src/lib/nex/aof/agents/orbiting-agent.ts
//
// NEX Autonomous Operations Framework · Orbiting Agent (top-level orchestrator)
// Founder-authorised programme · 2026-09-22.
//
// One cycle:
//   1. startCycle
//   2. reap stale worker leases (recovery)
//   3. for each planned (country, term):
//        a. gate-adapter check
//        b. source-intelligence selectSourceFor → chosen source or all-cooled
//        c. discovery-agent.discover on that source
//        d. on failure: source-intelligence.recordFailure (cooldown) + try next
//        e. website-walk-agent drains its share of walk budget
//   4. evidence-audit-agent runs audit_evidence_chain (assert R1-R6 pass)
//   5. live-streaming-agent snapshots operational state
//   6. endCycle · completed / aborted / interrupted
//
// Asia-last remains an orchestration rule the orbiting agent respects
// (via country_scope on planned targets · planner decides order not agent).

import type { PgClient } from "../types";
import { requireCapability } from "../capability";
import { logAgentEvent } from "../lifecycle";
import { startCycle, endCycle, updateCycleCounters, type AofCycle } from "../cycle";
import { selectSourceFor, recordFailure, recordSuccess } from "./source-intelligence-agent";
import { discover } from "./discovery-agent";
import { drainWebsiteWalks } from "./website-walk-agent";
import { auditEvidenceChain, type AuditReport } from "./evidence-audit-agent";
import { reapStaleLeases } from "./recovery-agent";
import { streamOperationalSnapshot } from "./live-streaming-agent";
import { decideGateAllowed } from "./connections-agent";
import type { AdapterRegistry } from "../adapters/registry";
import type { PageFetcher } from "@/lib/nex/discovery-world";

export interface AgentBundle {
  readonly source_intelligence: string;      // agent_id
  readonly discovery: string;
  readonly website_walk: string;
  readonly evidence_audit: string;
  readonly recovery: string;
  readonly live_streaming: string;
  readonly gate_adapter: string;
  readonly orbiting: string;
}

export interface OrbitDeps {
  readonly client: PgClient;
  readonly agents: AgentBundle;
  readonly adapters: AdapterRegistry;
  readonly worker_id: string;
  readonly programme_id: string;
  readonly fetcher: PageFetcher;
  readonly env: NodeJS.ProcessEnv;
}

export interface Territory {
  readonly country_iso: string;
  readonly term: string;
  readonly candidate_sources: ReadonlyArray<string>;     // ordered try-list
}

export interface OrbitInput {
  readonly territories: ReadonlyArray<Territory>;
  readonly max_walks_per_cycle: number;
  readonly max_failover_attempts_per_territory?: number;
  readonly triggered_by?: string;
}

export interface OrbitOutcome {
  readonly cycle: AofCycle;
  readonly discovery_summary: ReadonlyArray<{ country_iso: string; term: string; used_source: string | null; kind: string; inserted: number; walks_enqueued: number }>;
  readonly walk_drain: { processed: number; walked_ok: number; emails_captured: number; outcomes: Record<string, number> };
  readonly audit: AuditReport;
  readonly reap: { released: number };
  readonly ended_kind: "completed" | "aborted" | "interrupted";
}

export async function runOrbit(deps: OrbitDeps, input: OrbitInput): Promise<OrbitOutcome> {
  await requireCapability(deps.client, deps.agents.orbiting, "orbit_territories");

  // Asia-last enforcement at territory-iteration time · reads world_country.region
  // (same authority the H5 country-scheduler uses · never bypassed by agent decision)
  const asiaIsoRes = await deps.client.query(`SELECT iso_alpha_2 FROM nex.world_country WHERE region = 'Asia'`);
  const asiaIsos: Set<string> = new Set(asiaIsoRes.rows.map((r: any) => String(r.iso_alpha_2).toUpperCase()));
  const isAsia = (iso: string) => asiaIsos.has(iso.toUpperCase());
  const nonAsiaFirst = [...input.territories].sort((a, b) => Number(isAsia(a.country_iso)) - Number(isAsia(b.country_iso)));
  const asiaDeferredCount = nonAsiaFirst.filter(t => isAsia(t.country_iso)).length;
  const nonAsiaCount = nonAsiaFirst.length - asiaDeferredCount;

  const cycle = await startCycle(deps.client, {
    triggered_by: input.triggered_by ?? "orbiting_agent",
    programme_id: deps.programme_id,
    metadata: {
      territories: input.territories, max_walks_per_cycle: input.max_walks_per_cycle,
      asia_last_enforced: nonAsiaCount > 0 || asiaDeferredCount > 0,
      non_asia_count: nonAsiaCount, asia_count: asiaDeferredCount,
    },
  });
  await logAgentEvent(deps.client, { agent_id: deps.agents.orbiting, event_kind: "cycle_start", cycle_id: cycle.cycle_id,
    payload: { territories_planned: input.territories.length, non_asia_count: nonAsiaCount, asia_count: asiaDeferredCount, asia_last_enforced: nonAsiaCount > 0 || asiaDeferredCount === 0 } });

  // 1 · reap first (recovery)
  const reap = await reapStaleLeases({ client: deps.client, agent_id: deps.agents.recovery, worker_id: deps.worker_id, cycle_id: cycle.cycle_id });

  // 2 · discovery loop with failover · iterate non-Asia first per Asia-last invariant
  const discoverySummary: OrbitOutcome["discovery_summary"] = [];
  const maxTries = input.max_failover_attempts_per_territory ?? 3;
  for (const t of nonAsiaFirst) {
    let done = false;
    let attempts = 0;
    let usedSource: string | null = null;
    let lastKind = "not_attempted";
    let lastInserted = 0, lastWalksEnqueued = 0;

    while (!done && attempts < maxTries) {
      attempts++;
      const sel = await selectSourceFor(
        { client: deps.client, agent_id: deps.agents.source_intelligence },
        { country_iso: t.country_iso, term: t.term, cycle_id: cycle.cycle_id, source_slug_filter: t.candidate_sources },
      );
      if (!sel.selected) { lastKind = `no_source_available:${sel.reason}`; break; }
      usedSource = sel.selected.source_slug;

      const gate = await decideGateAllowed(
        { client: deps.client, agent_id: deps.agents.gate_adapter, adapters: deps.adapters, env: deps.env },
        usedSource,
      );
      if (!gate.allowed) {
        lastKind = `gate_denied:${gate.reasons.join(",")}`;
        // If the gate says cooldown, apply escalating cooldown; if not-signed, we can't fix -- break out
        if (gate.reasons.includes("source_on_cooldown")) continue;      // failover
        if (gate.reasons.includes("page_fetcher_not_activated")) { lastKind = "gate_denied:page_fetcher_not_activated"; break; }
        break;
      }

      const disc = await discover(
        { client: deps.client, agent_id: deps.agents.discovery, adapters: deps.adapters, programme_id: deps.programme_id },
        { source_slug: usedSource, country_iso: t.country_iso, term: t.term, cycle_id: cycle.cycle_id, max_results: 30 },
      );
      lastKind = disc.kind;
      lastInserted = disc.candidates_inserted;
      lastWalksEnqueued = disc.walks_enqueued;

      if (disc.kind === "ok" || disc.kind === "zero_results") {
        await recordSuccess({ client: deps.client, agent_id: deps.agents.source_intelligence }, usedSource);
        done = true;
      } else {
        const failureKind =
          disc.kind === "rate_limited" ? "rate_limited"
          : disc.kind === "source_unavailable" ? "source_unavailable"
          : disc.kind === "parse_error" ? "parse_error"
          : disc.kind === "adapter_dormant" ? "source_unavailable"
          : "other";
        await recordFailure({ client: deps.client, agent_id: deps.agents.source_intelligence }, usedSource, failureKind as any, { during_orbit: cycle.cycle_id });
      }
    }

    discoverySummary.push({ country_iso: t.country_iso, term: t.term, used_source: usedSource, kind: lastKind, inserted: lastInserted, walks_enqueued: lastWalksEnqueued });
  }

  // 3 · walk drain
  const walk = await drainWebsiteWalks(
    { client: deps.client, agent_id: deps.agents.website_walk, worker_id: deps.worker_id, fetcher: deps.fetcher, cycle_id: cycle.cycle_id },
    { max_walks: input.max_walks_per_cycle, per_walk_lease_seconds: 180, between_walks_ms: 500 },
  );

  // 4 · evidence audit
  const audit = await auditEvidenceChain({ client: deps.client, agent_id: deps.agents.evidence_audit, cycle_id: cycle.cycle_id });

  // 5 · operational snapshot
  await streamOperationalSnapshot({ client: deps.client, agent_id: deps.agents.live_streaming, cycle_id: cycle.cycle_id });

  // 6 · update evidence counters + end cycle
  await updateCycleCounters(deps.client, { cycle_id: cycle.cycle_id, evidence_added_delta: audit.summary.evidence_rows_with_email });

  const endedKind: "completed" | "aborted" =
    !audit.pass ? "aborted"
    : "completed";
  const ended = await endCycle(deps.client, { cycle_id: cycle.cycle_id, ended_kind: endedKind, metadata_merge: { audit_pass: audit.pass, reap_released: reap.released } });
  await logAgentEvent(deps.client, { agent_id: deps.agents.orbiting, event_kind: "cycle_end", cycle_id: cycle.cycle_id,
    payload: { ended_kind: endedKind, audit_pass: audit.pass, walk_drain: walk, discovery_summary: discoverySummary } });

  return {
    cycle: ended ?? cycle,
    discovery_summary: discoverySummary,
    walk_drain: { processed: walk.processed, walked_ok: walk.walked_ok, emails_captured: walk.emails_captured, outcomes: walk.outcomes },
    audit,
    reap,
    ended_kind: endedKind,
  };
}

export const _ORBIT_NEVER_BYPASSES_GATE =
  "orbiting_agent_defers_to_gate_adapter_and_source_intelligence_never_forces_source";
export const _ORBIT_ABORTS_ON_AUDIT_FAIL =
  "cycle_marked_aborted_when_evidence_audit_reports_pass_false";
export const _ORBIT_ASIA_LAST_ENFORCED_AT_TERRITORY_ITERATION =
  "nonAsiaFirst_sort_puts_asia_iso_countries_last_reads_world_country_region_never_bypassed";
