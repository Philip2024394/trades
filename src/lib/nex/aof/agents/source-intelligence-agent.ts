// src/lib/nex/aof/agents/source-intelligence-agent.ts
//
// NEX Autonomous Operations Framework · Source Intelligence Agent
// Founder-authorised programme · 2026-09-22.
//
// Responsibilities:
//   * pull the current list of Founder-signed sources from nex.harvest_source
//   * apply active cooldowns from nex.aof_source_cooldown
//   * pick the next source to try for a given country + term via failover
//   * classify failures and apply cooldown when a probe fails
//
// Never bypasses a source restriction · never fabricates provenance.

import type { PgClient, CooldownFailureKind } from "../types";
import { requireCapability } from "../capability";
import { logAgentEvent } from "../lifecycle";
import { selectNextSource, type SelectSourceResult, type SourceCandidate } from "../governors/failover";
import { applyCooldown, recordSourceSuccess } from "../governors/source-cooldown";

export interface SourceIntelligenceAgentDeps {
  readonly client: PgClient;
  readonly agent_id: string;
}

export interface SelectForInput {
  readonly country_iso: string;
  readonly term: string;
  readonly cycle_id?: string;
  readonly source_slug_filter?: ReadonlyArray<string>;
}

export async function loadFounderSignedSources(client: PgClient, filter?: ReadonlyArray<string>): Promise<ReadonlyArray<SourceCandidate>> {
  const wheres = [`enabled = TRUE`, `founder_signed_at IS NOT NULL`];
  const params: any[] = [];
  if (filter && filter.length > 0) {
    params.push(filter);
    wheres.push(`source_slug = ANY($${params.length})`);
  }
  const res = await client.query(
    `SELECT source_slug, priority, enabled, founder_signed_at, country_scope, category_scope
       FROM nex.harvest_source
      WHERE ${wheres.join(" AND ")}`,
    params,
  );
  return res.rows.map((r: any) => {
    const cs = Array.isArray(r.country_scope) && r.country_scope.length > 0 ? r.country_scope : null;
    const ts = Array.isArray(r.category_scope) && r.category_scope.length > 0 ? r.category_scope : null;
    return {
      source_slug: r.source_slug,
      priority: Number(r.priority ?? 0),
      founder_signed: Boolean(r.founder_signed_at),
      enabled: Boolean(r.enabled),
      country_scope: cs,
      term_scope: ts,
    };
  });
}

export async function selectSourceFor(deps: SourceIntelligenceAgentDeps, input: SelectForInput): Promise<SelectSourceResult> {
  await requireCapability(deps.client, deps.agent_id, "failover_source");
  const candidates = await loadFounderSignedSources(deps.client, input.source_slug_filter);
  const result = await selectNextSource(deps.client, {
    candidates, country_iso: input.country_iso, term: input.term,
  });
  await logAgentEvent(deps.client, {
    agent_id: deps.agent_id,
    event_kind: result.selected ? "decision" : "failover",
    cycle_id: input.cycle_id ?? null,
    payload: {
      op: "select_source", country_iso: input.country_iso, term: input.term,
      selected: result.selected?.source_slug ?? null, reason: result.reason,
      considered: result.considered, cooldowns_count: result.cooldowns_active.length,
    },
  });
  return result;
}

export async function recordFailure(deps: SourceIntelligenceAgentDeps, source_slug: string, failure_kind: CooldownFailureKind, extra?: Record<string, unknown>): Promise<void> {
  await requireCapability(deps.client, deps.agent_id, "manage_cooldown");
  const cd = await applyCooldown(deps.client, { source_slug, failure_kind, agent_id: deps.agent_id, metadata: extra });
  await logAgentEvent(deps.client, {
    agent_id: deps.agent_id, event_kind: "cooldown_applied",
    payload: { source_slug, failure_kind, cooldown_until: cd.cooldown_until, consecutive: cd.consecutive_failures, extra: extra ?? {} },
  });
}

export async function recordSuccess(deps: SourceIntelligenceAgentDeps, source_slug: string): Promise<void> {
  await recordSourceSuccess(deps.client, source_slug);
  await logAgentEvent(deps.client, {
    agent_id: deps.agent_id, event_kind: "decision",
    payload: { op: "record_success", source_slug },
  });
}
