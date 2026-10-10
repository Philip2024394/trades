// src/lib/nex/aof/agents/connections-agent.ts
//
// NEX Autonomous Operations Framework · Connections + Gate-Adapter agents
// Founder-authorised programme · 2026-09-22.
//
// Connections Agent = enumerates authorised connections between NEX
// components (adapters registered · sources allowlisted · fetcher gate
// state · runtime env presence). Read-only surface for HQ observability.
//
// Gate-Adapter Agent = the boundary through which agents ask "am I
// allowed to reach adapter X for source Y?" · answers based on
// harvest_source founder_signed_at + allowlist file + activation env.
// Never opens a connection itself · only says yes/no + reason.

import type { PgClient } from "../types";
import { requireCapability } from "../capability";
import { logAgentEvent } from "../lifecycle";
import type { AdapterRegistry } from "../adapters/registry";

export interface ConnectionsDeps {
  readonly client: PgClient;
  readonly agent_id: string;
  readonly adapters: AdapterRegistry;
  readonly env: NodeJS.ProcessEnv;
}

export interface ConnectionSurface {
  readonly at: string;
  readonly page_fetcher_activation: boolean;
  readonly cron_activation: boolean;
  readonly adapters: ReadonlyArray<{ source_slug: string; kind: string; adapter_source_id: string }>;
  readonly founder_signed_sources: ReadonlyArray<{ source_slug: string; founder_signed_at: string; enabled: boolean }>;
}

export async function enumerateConnections(deps: ConnectionsDeps): Promise<ConnectionSurface> {
  await requireCapability(deps.client, deps.agent_id, "connect_adapter");
  const src = await deps.client.query(
    `SELECT source_slug, founder_signed_at, enabled FROM nex.harvest_source WHERE founder_signed_at IS NOT NULL ORDER BY priority DESC`,
  );
  const surface: ConnectionSurface = {
    at: new Date().toISOString(),
    page_fetcher_activation: deps.env.NEX_PAGE_FETCHER_ACTIVATION === "on",
    cron_activation: deps.env.NEX_DISCOVERY_CRON_ACTIVATION === "on",
    adapters: deps.adapters.list().map(e => ({ source_slug: e.source_slug, kind: e.kind, adapter_source_id: (e.adapter as any).source_id ?? "unknown" })),
    founder_signed_sources: src.rows.map(r => ({ source_slug: r.source_slug, founder_signed_at: r.founder_signed_at, enabled: r.enabled })),
  };
  await logAgentEvent(deps.client, { agent_id: deps.agent_id, event_kind: "decision",
    payload: { op: "enumerate_connections", surface } });
  return surface;
}

// ─── Gate-Adapter Agent ───────────────────────────────────────────
export interface GateAdapterDeps {
  readonly client: PgClient;
  readonly agent_id: string;
  readonly adapters: AdapterRegistry;
  readonly env: NodeJS.ProcessEnv;
}

export interface GateDecision {
  readonly allowed: boolean;
  readonly source_slug: string;
  readonly reasons: ReadonlyArray<string>;
}

export async function decideGateAllowed(deps: GateAdapterDeps, source_slug: string): Promise<GateDecision> {
  await requireCapability(deps.client, deps.agent_id, "connect_adapter");
  const reasons: string[] = [];
  // 1 · adapter present
  const entry = deps.adapters.get(source_slug);
  if (!entry) reasons.push("adapter_not_registered");
  // 2 · source Founder-signed + enabled
  const s = await deps.client.query(`SELECT founder_signed_at, enabled FROM nex.harvest_source WHERE source_slug = $1`, [source_slug]);
  if (s.rowCount === 0) reasons.push("source_not_in_harvest_source");
  else {
    if (!s.rows[0].founder_signed_at) reasons.push("source_not_founder_signed");
    if (s.rows[0].enabled === false) reasons.push("source_disabled");
  }
  // 3 · activation env
  if (deps.env.NEX_PAGE_FETCHER_ACTIVATION !== "on") reasons.push("page_fetcher_not_activated");
  // 4 · no active cooldown
  const cd = await deps.client.query(`SELECT cooldown_until FROM nex.aof_source_cooldown WHERE source_slug = $1 AND cooldown_until > now()`, [source_slug]);
  if ((cd.rowCount ?? 0) > 0) reasons.push("source_on_cooldown");
  const allowed = reasons.length === 0;
  await logAgentEvent(deps.client, { agent_id: deps.agent_id, event_kind: allowed ? "decision" : "cooldown_applied",
    payload: { op: "gate_check", source_slug, allowed, reasons } });
  return { allowed, source_slug, reasons };
}
