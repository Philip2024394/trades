// src/lib/nex/master-ai/capability-registry.ts
//
// NEX Master AI Engineer · M2 · Cross-agent capability model
// Philip 2026-09-07 · AUTHORIZE
//
// Append-only ledger of capability records across agents. Version
// chain integrity: a new record supersedes a prior one via
// `supersedes = prior_capability_id`. Authority tier propagates from
// evidence.
//
// Reuses Phase A vocabulary (AuthorityTier). Never conflicts with
// Programmer's own version-manifest (Phase E) — this is the cross-agent
// index, not the intra-agent version chain.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { capabilityLedgerPath } from "./paths";
import { getAgent } from "./agent-registry";
import type {
  CapabilityRecord,
  MasterAgentId,
  AuthorityTier,
  CapabilityPromotionStatus,
} from "./types";

export class UnknownAgentError extends Error {
  constructor(id: string) { super(`unknown_agent:${id}`); }
}

const CAPABILITY_SLUG_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export function validateCapabilitySlug(slug: string): void {
  if (!CAPABILITY_SLUG_PATTERN.test(slug)) throw new Error(`invalid_capability_slug:${slug}`);
}

export function registerCapability(input: {
  capability_slug: string;
  agent_id: MasterAgentId;
  version: string;
  evidence_refs: string[];
  benchmark_ref: string | null;
  performance_metrics: Record<string, number>;
  promotion_status: CapabilityPromotionStatus;
  authority_tier: AuthorityTier;
  created_by: string;
  supersedes: string | null;
}): CapabilityRecord {
  validateCapabilitySlug(input.capability_slug);
  if (!getAgent(input.agent_id)) throw new UnknownAgentError(input.agent_id);

  const record: CapabilityRecord = {
    capability_id: randomUUID(),
    capability_slug: input.capability_slug,
    agent_id: input.agent_id,
    version: input.version,
    evidence_refs: input.evidence_refs,
    benchmark_ref: input.benchmark_ref,
    performance_metrics: input.performance_metrics,
    promotion_status: input.promotion_status,
    authority_tier: input.authority_tier,
    created_at_iso: new Date().toISOString(),
    created_by: input.created_by,
    supersedes: input.supersedes,
  };
  appendJsonLine(capabilityLedgerPath(), record);
  return record;
}

export function readAllCapabilityHistory(): CapabilityRecord[] {
  return readJsonlAll<CapabilityRecord>(capabilityLedgerPath());
}

/** Current version per (agent_id, capability_slug) — latest wins. */
export function listCapabilities(): CapabilityRecord[] {
  const byKey = new Map<string, CapabilityRecord>();
  for (const r of readAllCapabilityHistory()) byKey.set(`${r.agent_id}::${r.capability_slug}`, r);
  return Array.from(byKey.values()).sort((a, b) =>
    (a.agent_id + a.capability_slug).localeCompare(b.agent_id + b.capability_slug)
  );
}

export function listCapabilitiesByAgent(agentId: MasterAgentId): CapabilityRecord[] {
  return listCapabilities().filter((c) => c.agent_id === agentId);
}

export function getCapability(agentId: MasterAgentId, slug: string): CapabilityRecord | null {
  return listCapabilities().find((c) => c.agent_id === agentId && c.capability_slug === slug) ?? null;
}

/** Walk the supersedes chain for a given capability. Returns records
 *  from newest to oldest. Used by M6 benchmark to compare v_new against
 *  the immediate predecessor. */
export function versionChain(agentId: MasterAgentId, slug: string): CapabilityRecord[] {
  const all = readAllCapabilityHistory().filter((r) => r.agent_id === agentId && r.capability_slug === slug);
  const byId = new Map(all.map((r) => [r.capability_id, r]));
  const latest = listCapabilities().find((c) => c.agent_id === agentId && c.capability_slug === slug);
  if (!latest) return [];
  const chain: CapabilityRecord[] = [];
  let cursor: CapabilityRecord | null = latest;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.capability_id)) {
    chain.push(cursor);
    seen.add(cursor.capability_id);
    cursor = cursor.supersedes ? byId.get(cursor.supersedes) ?? null : null;
  }
  return chain;
}

export function _resetCapabilityLedgerForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(capabilityLedgerPath())) fs.unlinkSync(capabilityLedgerPath()); } catch { /* ignore */ }
}
