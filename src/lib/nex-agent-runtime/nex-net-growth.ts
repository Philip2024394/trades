// WO-LIVE-WORKFORCE-PROOF-02 · NEX NET GROWTH · single headline metric.
//
// Founder-locked 2026-09-13: agents are not there to generate heartbeats.
// They are there to make NEX better. NET GROWTH measures whether NEX is
// genuinely richer between two snapshots — with per-record provenance so
// clicking any number drills down to the underlying evidence.
//
// Knowledge domains (derived from per-agent memory content by kind):
//   - crawler_source          — crawler-retrieved raw HTTP responses
//   - sanitized_fragments     — sanitizer canonical output
//   - discoveries             — discovery cluster records
//   - hypotheses              — hypothesis engine output
//   - experiments             — experiment measurements
//   - validated_knowledge     — scoring-promoted knowledge objects
//   - proposals               — proposal generator WO envelopes (unsigned)
//   - agent_memory_total      — all agent memory records
//   - evidence_records        — signed heartbeats with evidence_refs

import { randomUUID, sign as ed25519Sign } from "node:crypto";
import { canonicalJson, provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";
import { agentMemoryCollectionName } from "./memory";
import { AGENT_HEARTBEAT_EVENT_COLLECTION } from "./runtime-loop";
import { SOURCE_POOL_COLLECTION, SANITIZED_POOL_COLLECTION, DISCOVERY_POOL_COLLECTION, HYPOTHESIS_POOL_COLLECTION, EXPERIMENT_POOL_COLLECTION, KNOWLEDGE_POOL_COLLECTION, PROPOSAL_POOL_COLLECTION } from "@/lib/nex-intelligence/source-pool";
import { IDENTITIES_COLLECTION } from "./provisioning";
import type { AgentEnvironment, AgentHeartbeatEvent, AgentIdentity, AgentMemoryRecord } from "./types";

export const NEX_NET_GROWTH_COLLECTION = "nex_net_growth_snapshots";

// ── Metric shape ───────────────────────────────────────────────────────

export interface DomainMetric {
  readonly count: number;
  readonly record_ids: readonly string[];      // sample of underlying evidence IDs (up to 100)
  readonly total_available: number;             // total, for when record_ids is truncated
  readonly source_collections: readonly string[];
}

export interface NexNetGrowthSnapshot {
  readonly record_type: "NEX_NET_GROWTH_SNAPSHOT";
  readonly snapshot_id: string;
  readonly captured_at: string;
  readonly previous_snapshot_id: string | null;
  readonly observed_window_ms: number;

  // Knowledge-domain metrics
  readonly domains: {
    readonly crawler_source: DomainMetric;
    readonly sanitized_fragments: DomainMetric;
    readonly discoveries: DomainMetric;
    readonly hypotheses: DomainMetric;
    readonly experiments: DomainMetric;
    readonly validated_knowledge: DomainMetric;
    readonly proposals: DomainMetric;
    readonly agent_memory_total: DomainMetric;
    readonly evidence_records: DomainMetric;
  };

  // Deltas from previous snapshot (null if no prior)
  readonly deltas_from_previous: {
    readonly crawler_source: number;
    readonly sanitized_fragments: number;
    readonly discoveries: number;
    readonly hypotheses: number;
    readonly experiments: number;
    readonly validated_knowledge: number;
    readonly proposals: number;
    readonly agent_memory_total: number;
    readonly evidence_records: number;
    /** Founder-locked single headline: sum of all knowledge-domain deltas.
     *  Positive = NEX is richer; zero/negative = no useful growth. */
    readonly net_nex_growth: number;
  } | null;

  readonly signature_hex: string;
  readonly signer_public_key_hex: string;
  readonly provenance_chain_hash: string;
}

// ── Signer (reuses growth-snapshot signer for consistency) ─────────────

interface Signer { private_key_hex: string; public_key_hex: string; }
let cachedSigner: Signer | null = null;

export function _resetNexNetGrowthSigner(): void { cachedSigner = null; }
export function setNexNetGrowthSigner(s: Signer): void { cachedSigner = { ...s }; }

function getOrCreateSigner(): Signer {
  if (cachedSigner) return cachedSigner;
  const { generateKeyPairSync } = require("node:crypto") as typeof import("node:crypto");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  cachedSigner = {
    public_key_hex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    private_key_hex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
  return cachedSigner;
}

// ── Per-domain evidence collection ─────────────────────────────────────

interface MemoryRecordSummary {
  readonly memory_id: string;
  readonly kind: string;
  readonly source_collection: string;
  readonly content: Readonly<Record<string, unknown>>;
}

async function collectAllAgentMemory(): Promise<MemoryRecordSummary[]> {
  const out: MemoryRecordSummary[] = [];
  for (const agent of AGENT_REGISTRY) {
    try {
      const records = await getStorage().query<AgentMemoryRecord>(agentMemoryCollectionName(agent.id), { limit: 100_000 });
      for (const r of records) {
        out.push({ memory_id: r.memory_id, kind: r.kind, source_collection: agentMemoryCollectionName(agent.id), content: r.content });
      }
    } catch { /* collection may not exist for this agent yet */ }
  }
  return out;
}

function metricFrom(records: readonly MemoryRecordSummary[], sourceCollections: readonly string[]): DomainMetric {
  const ids = records.map((r) => r.memory_id);
  return {
    count: records.length,
    record_ids: Object.freeze(ids.slice(0, 100)) as readonly string[],
    total_available: ids.length,
    source_collections: Object.freeze([...sourceCollections]) as readonly string[],
  };
}

// ── Snapshot capture ───────────────────────────────────────────────────

function signaturePayload(input: Omit<NexNetGrowthSnapshot, "record_type" | "signature_hex" | "signer_public_key_hex" | "provenance_chain_hash">): string {
  return canonicalJson({
    snapshot_id: input.snapshot_id,
    captured_at: input.captured_at,
    previous_snapshot_id: input.previous_snapshot_id,
    observed_window_ms: input.observed_window_ms,
    domains: input.domains,
    deltas_from_previous: input.deltas_from_previous,
  });
}

/**
 * Founder-locked 2026-09-13: build the set of PRODUCTION_WORKFORCE
 * identity_ids so we can filter records emitted by non-production agents
 * (tests/fixtures) out of the growth counts.
 */
async function loadProductionIdentityIds(): Promise<Set<string>> {
  const identities = await getStorage().query<AgentIdentity>(IDENTITIES_COLLECTION, { limit: 5000 }).catch(() => []);
  const production = new Set<string>();
  for (const i of identities) {
    if (i.environment === "PRODUCTION_WORKFORCE") production.add(i.identity_id);
  }
  return production;
}

export async function captureNexNetGrowthSnapshot(): Promise<NexNetGrowthSnapshot> {
  const signer = getOrCreateSigner();
  const captured_at = new Date().toISOString();
  const snapshot_id = `net-growth-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const productionIdentityIds = await loadProductionIdentityIds();

  // Previous snapshot
  const prior = await getStorage().query<NexNetGrowthSnapshot>(NEX_NET_GROWTH_COLLECTION, { limit: 1, order_by: "captured_at", order_dir: "desc" }).catch(() => []);
  const previous: NexNetGrowthSnapshot | null = prior[0] ?? null;

  // Founder-locked 2026-09-13 · three-metric doctrine + production filter:
  //   NEX NET GROWTH counts records emitted by PRODUCTION_WORKFORCE agents ONLY.
  //   Test/fixture/simulation records still exist in the pool but do NOT
  //   inflate production growth metrics.
  const store = getStorage();
  const [rawSources, rawSanitized, rawDiscoveries, rawHypotheses, rawExperiments, rawKO, rawProposals] = await Promise.all([
    store.query<{ source_id?: string; emitter_identity_id?: string }>(SOURCE_POOL_COLLECTION, { limit: 100_000 }).catch(() => []),
    store.query<{ sanitized_id?: string; emitter_identity_id?: string }>(SANITIZED_POOL_COLLECTION, { limit: 100_000 }).catch(() => []),
    store.query<{ discovery_id?: string; emitter_identity_id?: string; emitter_agent_id?: string }>(DISCOVERY_POOL_COLLECTION, { limit: 100_000 }).catch(() => []),
    store.query<{ hypothesis_id?: string; emitter_identity_id?: string; emitter_agent_id?: string }>(HYPOTHESIS_POOL_COLLECTION, { limit: 100_000 }).catch(() => []),
    store.query<{ experiment_id?: string; emitter_identity_id?: string; emitter_agent_id?: string }>(EXPERIMENT_POOL_COLLECTION, { limit: 100_000 }).catch(() => []),
    store.query<{ knowledge_object_id?: string; emitter_identity_id?: string; emitter_agent_id?: string }>(KNOWLEDGE_POOL_COLLECTION, { limit: 100_000 }).catch(() => []),
    store.query<{ proposal_id?: string; emitter_identity_id?: string; emitter_agent_id?: string }>(PROPOSAL_POOL_COLLECTION, { limit: 100_000 }).catch(() => []),
  ]);

  // Some record shapes have emitter_identity_id; others only agent_id. For
  // filtering we use identity_id when available (strictest), else fall back
  // to a lookup of "which agent_ids belong to at least one production identity".
  const identities = await getStorage().query<AgentIdentity>(IDENTITIES_COLLECTION, { limit: 5000 }).catch(() => []);
  const productionAgentIds = new Set<string>();
  for (const i of identities) {
    if (i.environment === "PRODUCTION_WORKFORCE") productionAgentIds.add(i.agent_id);
  }
  const isProduction = (r: { emitter_identity_id?: string; emitter_agent_id?: string }): boolean => {
    if (r.emitter_identity_id && productionIdentityIds.has(r.emitter_identity_id)) return true;
    if (r.emitter_agent_id && productionAgentIds.has(r.emitter_agent_id)) return true;
    return false;
  };
  const crawlerSourceRecords = rawSources.filter(isProduction);
  const sanitizedRecords = rawSanitized.filter(isProduction);
  const discoveryRecords = rawDiscoveries.filter(isProduction);
  const hypothesisRecords = rawHypotheses.filter(isProduction);
  const experimentRecords = rawExperiments.filter(isProduction);
  const koRecords = rawKO.filter(isProduction);
  const proposalRecords = rawProposals.filter(isProduction);

  const allMem = await collectAllAgentMemory();
  const memColls = Array.from(new Set(allMem.map((m) => m.source_collection)));

  // Signed heartbeats · production-only · with real evidence_refs
  const heartbeats = await store.query<AgentHeartbeatEvent>(AGENT_HEARTBEAT_EVENT_COLLECTION, { limit: 100_000 }).catch(() => []);
  const heartbeatsWithEvidence = heartbeats.filter((h) =>
    h.evidence_refs.length > 0 && (productionIdentityIds.has(h.identity_id) || productionAgentIds.has(h.agent_id)),
  );

  function metricFromIds(records: readonly Record<string, unknown>[], idKey: string, coll: string): DomainMetric {
    const ids = records.map((r) => r[idKey]).filter((v): v is string => typeof v === "string");
    return {
      count: records.length,
      record_ids: Object.freeze(ids.slice(0, 100)) as readonly string[],
      total_available: ids.length,
      source_collections: [coll],
    };
  }

  const domains = {
    crawler_source: metricFromIds(crawlerSourceRecords, "source_id", SOURCE_POOL_COLLECTION),
    sanitized_fragments: metricFromIds(sanitizedRecords, "sanitized_id", SANITIZED_POOL_COLLECTION),
    discoveries: metricFromIds(discoveryRecords, "discovery_id", DISCOVERY_POOL_COLLECTION),
    hypotheses: metricFromIds(hypothesisRecords, "hypothesis_id", HYPOTHESIS_POOL_COLLECTION),
    experiments: metricFromIds(experimentRecords, "experiment_id", EXPERIMENT_POOL_COLLECTION),
    validated_knowledge: metricFromIds(koRecords, "knowledge_object_id", KNOWLEDGE_POOL_COLLECTION),
    proposals: metricFromIds(proposalRecords, "proposal_id", PROPOSAL_POOL_COLLECTION),
    agent_memory_total: metricFrom(allMem, memColls),
    evidence_records: {
      count: heartbeatsWithEvidence.length,
      record_ids: Object.freeze(heartbeatsWithEvidence.slice(0, 100).map((h) => h.heartbeat_id)) as readonly string[],
      total_available: heartbeatsWithEvidence.length,
      source_collections: [AGENT_HEARTBEAT_EVENT_COLLECTION],
    },
  };

  const deltas = previous ? {
    crawler_source: domains.crawler_source.count - previous.domains.crawler_source.count,
    sanitized_fragments: domains.sanitized_fragments.count - previous.domains.sanitized_fragments.count,
    discoveries: domains.discoveries.count - previous.domains.discoveries.count,
    hypotheses: domains.hypotheses.count - previous.domains.hypotheses.count,
    experiments: domains.experiments.count - previous.domains.experiments.count,
    validated_knowledge: domains.validated_knowledge.count - previous.domains.validated_knowledge.count,
    proposals: domains.proposals.count - previous.domains.proposals.count,
    agent_memory_total: domains.agent_memory_total.count - previous.domains.agent_memory_total.count,
    evidence_records: domains.evidence_records.count - previous.domains.evidence_records.count,
    // Founder-locked headline: sum of knowledge-domain deltas ONLY (not evidence
    // records — heartbeats existing does not equal NEX being richer).
    net_nex_growth: 0,   // filled below
  } : null;
  if (deltas) {
    deltas.net_nex_growth =
      deltas.crawler_source + deltas.sanitized_fragments + deltas.discoveries +
      deltas.hypotheses + deltas.experiments + deltas.validated_knowledge + deltas.proposals;
  }

  // Compute observed window from earliest memory record
  const earliestMemoryAt = allMem.reduce<number | null>((min, m) => {
    const c = m.content as { created_at?: unknown };
    // memory records also have `created_at` at the top-level; but we only have content here
    return min;   // approximation · TODO: pass created_at through
  }, null);
  const observed_window_ms = earliestMemoryAt ? Date.now() - earliestMemoryAt : 0;

  const base = {
    record_type: "NEX_NET_GROWTH_SNAPSHOT" as const,
    snapshot_id, captured_at,
    previous_snapshot_id: previous?.snapshot_id ?? null,
    observed_window_ms,
    domains, deltas_from_previous: deltas,
  };
  const payload = signaturePayload(base);
  const signature = ed25519Sign(null, Buffer.from(payload, "utf8"), {
    key: Buffer.from(signer.private_key_hex, "hex"),
    format: "der", type: "pkcs8",
  });
  const withSig = {
    ...base,
    signature_hex: signature.toString("hex"),
    signer_public_key_hex: signer.public_key_hex,
  };
  const snap: NexNetGrowthSnapshot = { ...withSig, provenance_chain_hash: provenanceChainHash(withSig, previous ? [previous.provenance_chain_hash] : []) };
  await getStorage().save(NEX_NET_GROWTH_COLLECTION, snap);
  return snap;
}

export async function loadRecentNexNetGrowthSnapshots(limit = 60): Promise<NexNetGrowthSnapshot[]> {
  try {
    return await getStorage().query<NexNetGrowthSnapshot>(NEX_NET_GROWTH_COLLECTION, {
      limit, order_by: "captured_at", order_dir: "desc",
    });
  } catch { return []; }
}
