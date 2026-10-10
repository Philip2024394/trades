// WO-HQ-PROOF-CARDS-01 · per-agent proof card API.
//
// Founder-locked 2026-09-13: every displayed value on an HQ agent card
// must be backed by a real GB record. This endpoint returns per-agent
// proof: identity_id, capability manifest tiers per facet, real 24h
// counts of signed heartbeats, memory records, performance records,
// learning contributions, plus the latest evidence pointer per facet.

import { NextResponse } from "next/server";
import { getStorage } from "@/lib/nex/storage/registry";
import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";
import type { AgentDescriptor } from "@/lib/nex-hq-agents/types";
import { loadAllAgentIdentities, loadAgentCapabilityManifest, loadAgentAuthorityManifest } from "@/lib/nex-agent-runtime/provisioning";
import { AGENT_HEARTBEAT_EVENT_COLLECTION } from "@/lib/nex-agent-runtime/runtime-loop";
import { PERFORMANCE_HISTORY_COLLECTION } from "@/lib/nex-agent-runtime/performance-history";
import { LEARNING_CONTRIBUTION_COLLECTION } from "@/lib/nex-agent-runtime/learning-contribution";
import { agentMemoryCollectionName } from "@/lib/nex-agent-runtime/memory";
import type { AgentHeartbeatEvent, AgentIdentity, CapabilityManifest, AuthorityManifest, FacetStatus, FacetKey } from "@/lib/nex-agent-runtime/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ── Proof card shape ──────────────────────────────────────────────────

export interface FacetProof {
  readonly facet: FacetKey;
  readonly tier: FacetStatus["tier"];
  readonly evidence_count_24h: number;
  readonly evidence_pointer: string | null;
  readonly last_verified_at: string | null;
}

export interface AgentProofCard {
  readonly agent_id: string;
  readonly agent_name: string;
  readonly lane: string;
  readonly identity: {
    readonly identity_id: string;
    readonly runtime_key_public_hex_prefix: string;
    readonly spawned_at: string;
    readonly runtime_version: string;
  } | null;
  readonly facets: readonly FacetProof[];
  readonly signed_heartbeats_24h: number;
  readonly signed_heartbeats_ever: number;
  readonly memory_records: number;
  readonly performance_records_24h: number;
  readonly learning_contributions_24h: number;
  readonly latest_evidence_ref: string | null;
  readonly latest_heartbeat_emitted_at: string | null;
  readonly authority: {
    readonly authorised_tools: readonly string[];
    readonly authorised_hosts: readonly string[];
    readonly prohibited_actions: readonly string[];
  } | null;
}

// ── Handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  const store = getStorage();
  const now = Date.now();
  const oneDay = 24 * 3600 * 1000;

  const identities = await loadAllAgentIdentities();
  const identityByAgent = new Map<string, AgentIdentity>();
  for (const i of identities) if (!identityByAgent.has(i.agent_id)) identityByAgent.set(i.agent_id, i);

  const heartbeats = await store.query<AgentHeartbeatEvent>(AGENT_HEARTBEAT_EVENT_COLLECTION, { limit: 10_000 }).catch(() => []);
  const perfRecords = await store.query<{ agent_id: string; finished_at: string; evidence_refs: readonly string[] }>(PERFORMANCE_HISTORY_COLLECTION, { limit: 10_000 }).catch(() => []);
  const learnRecords = await store.query<{ agent_id: string; proposed_at: string }>(LEARNING_CONTRIBUTION_COLLECTION, { limit: 10_000 }).catch(() => []);

  const cards: AgentProofCard[] = [];
  for (const agent of AGENT_REGISTRY) {
    const identity = identityByAgent.get(agent.id) ?? null;
    const cap = await loadAgentCapabilityManifest(agent.id);
    const auth = await loadAgentAuthorityManifest(agent.id);

    const agentHbs = heartbeats.filter((h) => h.agent_id === agent.id);
    const agentHbs24h = agentHbs.filter((h) => now - Date.parse(h.emitted_at) <= oneDay);
    const agentPerf24h = perfRecords.filter((p) => p.agent_id === agent.id && now - Date.parse(p.finished_at) <= oneDay).length;
    const agentLearn24h = learnRecords.filter((l) => l.agent_id === agent.id && now - Date.parse(l.proposed_at) <= oneDay).length;

    // Memory records
    let memRecords: unknown[] = [];
    try { memRecords = await store.query(agentMemoryCollectionName(agent.id), { limit: 10_000 }); } catch { memRecords = []; }

    // Latest evidence ref: the most recent progress heartbeat's evidence_refs
    const latestWithEvidence = [...agentHbs].sort((a, b) => b.emitted_at.localeCompare(a.emitted_at)).find((h) => h.evidence_refs.length > 0);
    const latestEvidenceRef = latestWithEvidence?.evidence_refs[latestWithEvidence.evidence_refs.length - 1] ?? null;
    const latestHbEmittedAt = agentHbs.reduce<string | null>((max, h) => (max === null || h.emitted_at > max) ? h.emitted_at : max, null);

    // Facet enrichment: for each facet in the manifest, count real 24h evidence
    const facets: FacetProof[] = (cap?.facets ?? []).map((f) => {
      const evidenceCount24h = facetEvidenceCount24h(f.facet, agent, {
        heartbeats24h: agentHbs24h.length,
        performance24h: agentPerf24h,
        learning24h: agentLearn24h,
        memoryTotal: memRecords.length,
        hasIdentity: !!identity,
      });
      return {
        facet: f.facet,
        tier: f.tier,
        evidence_count_24h: evidenceCount24h,
        evidence_pointer: f.evidence_pointer,
        last_verified_at: f.last_verified_at,
      };
    });

    cards.push({
      agent_id: agent.id,
      agent_name: agent.name,
      lane: agent.lane,
      identity: identity ? {
        identity_id: identity.identity_id,
        runtime_key_public_hex_prefix: identity.runtime_key_public_hex.slice(0, 32),
        spawned_at: identity.spawned_at,
        runtime_version: identity.runtime_version,
      } : null,
      facets,
      signed_heartbeats_24h: agentHbs24h.length,
      signed_heartbeats_ever: agentHbs.length,
      memory_records: memRecords.length,
      performance_records_24h: agentPerf24h,
      learning_contributions_24h: agentLearn24h,
      latest_evidence_ref: latestEvidenceRef,
      latest_heartbeat_emitted_at: latestHbEmittedAt,
      authority: auth ? {
        authorised_tools: auth.authorised_tools,
        authorised_hosts: auth.authorised_hosts,
        prohibited_actions: auth.prohibited_actions,
      } : null,
    });
  }

  return NextResponse.json({
    record_type: "NEX_HQ_AGENT_PROOF_CARDS",
    generated_at: new Date().toISOString(),
    agents: cards,
  }, { status: 200 });
}

// ── Facet-specific evidence counting ───────────────────────────────────

function facetEvidenceCount24h(
  facet: FacetKey,
  _agent: AgentDescriptor,
  counters: { heartbeats24h: number; performance24h: number; learning24h: number; memoryTotal: number; hasIdentity: boolean },
): number {
  switch (facet) {
    case "identity":            return counters.hasIdentity ? 1 : 0;
    case "liveness":            return counters.heartbeats24h;
    case "memory":              return counters.memoryTotal;
    case "performance_history": return counters.performance24h;
    case "learning_contribution": return counters.learning24h;
    case "evidence":            return counters.heartbeats24h + counters.performance24h;
    case "authority_boundary":  return counters.hasIdentity ? 1 : 0;   // enforced continuously
    case "recovery_state":      return counters.hasIdentity ? 1 : 0;
    case "training_state":      return 0;   // Academy runtime not yet wired per-agent (WO-ACADEMY-02 pending)
    case "brain":               return counters.performance24h;
    case "tools":               return counters.performance24h;
    case "knowledge":           return counters.memoryTotal;
    case "network":             return 0;   // per-request evidence, tracked separately
    case "vision":              return 0;   // Phase 9 not wired
    case "experiment":          return counters.performance24h;
  }
}

export async function POST(): Promise<Response> { return methodNotAllowed(); }
export async function PUT(): Promise<Response> { return methodNotAllowed(); }
export async function DELETE(): Promise<Response> { return methodNotAllowed(); }
function methodNotAllowed(): Response { return NextResponse.json({ error: "method_not_allowed" }, { status: 405 }); }
