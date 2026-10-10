// WO-LIVE-WORKFORCE-PROOF-01 · signed growth snapshot with per-count provenance.
//
// Founder-locked 2026-09-13: every growth number in HQ must resolve to
// the underlying record IDs. This module captures a signed immutable
// snapshot every 60 seconds. Each metric carries `record_ids: string[]`
// so any displayed count can be drilled down to real evidence.
//
// Anti-bullshit rule: growth deltas are computed against the PREVIOUS
// snapshot. If there is no previous snapshot, deltas are zero — never
// synthetic history.

import { randomUUID, sign as ed25519Sign } from "node:crypto";
import { canonicalJson, provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";
import type { AgentIdentity } from "./types";
import { AGENT_HEARTBEAT_EVENT_COLLECTION } from "./runtime-loop";
import { PERFORMANCE_HISTORY_COLLECTION } from "./performance-history";
import { LEARNING_CONTRIBUTION_COLLECTION } from "./learning-contribution";
import { MISSION_ENVELOPES_COLLECTION, MISSION_OUTCOMES_COLLECTION } from "./mission-dispatcher";
import { agentMemoryCollectionName } from "./memory";
import { IDENTITIES_COLLECTION } from "./provisioning";

export const GROWTH_SNAPSHOT_COLLECTION = "nex_growth_snapshots";

// ── Metric with per-count provenance ───────────────────────────────────

export interface MetricWithProvenance {
  readonly count: number;
  readonly record_ids: readonly string[];      // exact IDs the count is derived from
  readonly source_collection: string;
}

// ── Snapshot record ────────────────────────────────────────────────────

export interface GrowthSnapshot {
  readonly record_type: "NEX_GROWTH_SNAPSHOT";
  readonly snapshot_id: string;
  readonly captured_at: string;
  readonly previous_snapshot_id: string | null;
  readonly observed_window_ms: number;         // real window (oldest record → now)
  readonly metrics: {
    readonly identities: MetricWithProvenance;
    readonly heartbeats: MetricWithProvenance;
    readonly mission_envelopes: MetricWithProvenance;
    readonly mission_outcomes: MetricWithProvenance;
    readonly performance_records: MetricWithProvenance;
    readonly learning_contributions: MetricWithProvenance;
    readonly memory_records_total: MetricWithProvenance;
  };
  readonly deltas_from_previous: {
    readonly identities: number;
    readonly heartbeats: number;
    readonly mission_envelopes: number;
    readonly mission_outcomes: number;
    readonly performance_records: number;
    readonly learning_contributions: number;
    readonly memory_records_total: number;
  } | null;
  readonly signature_hex: string;              // signed by SNAPSHOT_SIGNER key
  readonly signer_public_key_hex: string;
  readonly provenance_chain_hash: string;
}

// ── Signer keypair (in dev, ephemeral · in prod, founder-attested) ─────

interface SnapshotSigner {
  private_key_hex: string;
  public_key_hex: string;
}

let cachedSigner: SnapshotSigner | null = null;

function getOrCreateSigner(): SnapshotSigner {
  if (cachedSigner) return cachedSigner;
  const { generateKeyPairSync } = require("node:crypto") as typeof import("node:crypto");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  cachedSigner = {
    private_key_hex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
    public_key_hex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
  };
  return cachedSigner;
}

/** Reset for tests. */
export function _resetSnapshotSigner(): void { cachedSigner = null; }

/** Override for provisioning (production: founder-attested key). */
export function setSnapshotSigner(signer: SnapshotSigner): void { cachedSigner = { ...signer }; }

// ── Extract record ids for provenance ──────────────────────────────────

function idKeyForRecord(r: unknown): string | null {
  if (!r || typeof r !== "object") return null;
  const obj = r as Record<string, unknown>;
  const candidates = [
    "snapshot_id", "identity_id", "heartbeat_id", "envelope_id", "mission_id",
    "performance_id", "contribution_id", "memory_id", "check_id", "record_id",
  ];
  for (const k of candidates) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

async function collectMetric(collection: string): Promise<MetricWithProvenance> {
  try {
    const records = await getStorage().query<Record<string, unknown>>(collection, { limit: 100_000 });
    const ids: string[] = [];
    for (const r of records) {
      const id = idKeyForRecord(r);
      if (id) ids.push(id);
    }
    return { count: records.length, record_ids: Object.freeze([...ids]) as readonly string[], source_collection: collection };
  } catch {
    return { count: 0, record_ids: Object.freeze([]) as readonly string[], source_collection: collection };
  }
}

async function collectMemoryMetric(): Promise<MetricWithProvenance> {
  let totalCount = 0;
  const ids: string[] = [];
  for (const agent of AGENT_REGISTRY) {
    try {
      const records = await getStorage().query<Record<string, unknown>>(agentMemoryCollectionName(agent.id), { limit: 100_000 });
      totalCount += records.length;
      for (const r of records) {
        const id = idKeyForRecord(r);
        if (id) ids.push(id);
      }
    } catch { /* collection may not exist for this agent yet */ }
  }
  return { count: totalCount, record_ids: Object.freeze([...ids]) as readonly string[], source_collection: "nex_agent_memory_*" };
}

// ── Observed window computation (real · from oldest record on disk) ────

async function computeObservedWindowMs(): Promise<number> {
  const collectionsToInspect = [
    IDENTITIES_COLLECTION, AGENT_HEARTBEAT_EVENT_COLLECTION,
    MISSION_ENVELOPES_COLLECTION, MISSION_OUTCOMES_COLLECTION,
    PERFORMANCE_HISTORY_COLLECTION, LEARNING_CONTRIBUTION_COLLECTION,
  ];
  const timestampKeys = ["spawned_at", "emitted_at", "issued_at", "recorded_at", "finished_at", "proposed_at", "started_at"];
  let oldest: number | null = null;
  for (const coll of collectionsToInspect) {
    try {
      const records = await getStorage().query<Record<string, unknown>>(coll, { limit: 1000 });
      for (const r of records) {
        for (const k of timestampKeys) {
          const v = r[k];
          if (typeof v === "string") {
            const ms = Date.parse(v);
            if (!Number.isNaN(ms) && (oldest === null || ms < oldest)) oldest = ms;
          }
        }
      }
    } catch { /* skip */ }
  }
  if (oldest === null) return 0;
  return Math.max(0, Date.now() - oldest);
}

// ── Snapshot signature ─────────────────────────────────────────────────

function snapshotSignaturePayload(input: Omit<GrowthSnapshot, "record_type" | "signature_hex" | "signer_public_key_hex" | "provenance_chain_hash">): string {
  return canonicalJson({
    snapshot_id: input.snapshot_id,
    captured_at: input.captured_at,
    previous_snapshot_id: input.previous_snapshot_id,
    observed_window_ms: input.observed_window_ms,
    metrics: input.metrics,
    deltas_from_previous: input.deltas_from_previous,
  });
}

// ── Capture ────────────────────────────────────────────────────────────

export async function captureGrowthSnapshot(): Promise<GrowthSnapshot> {
  const signer = getOrCreateSigner();
  const captured_at = new Date().toISOString();
  const snapshot_id = `growth-${Date.now()}-${randomUUID().slice(0, 8)}`;

  // Load previous snapshot to compute deltas
  let previousSnapshot: GrowthSnapshot | null = null;
  try {
    const prior = await getStorage().query<GrowthSnapshot>(GROWTH_SNAPSHOT_COLLECTION, { limit: 1, order_by: "captured_at", order_dir: "desc" });
    previousSnapshot = prior[0] ?? null;
  } catch { previousSnapshot = null; }

  // Collect every metric
  const [identities, heartbeats, envelopes, outcomes, performance, learning, memory] = await Promise.all([
    collectMetric(IDENTITIES_COLLECTION),
    collectMetric(AGENT_HEARTBEAT_EVENT_COLLECTION),
    collectMetric(MISSION_ENVELOPES_COLLECTION),
    collectMetric(MISSION_OUTCOMES_COLLECTION),
    collectMetric(PERFORMANCE_HISTORY_COLLECTION),
    collectMetric(LEARNING_CONTRIBUTION_COLLECTION),
    collectMemoryMetric(),
  ]);
  const observed_window_ms = await computeObservedWindowMs();

  const deltas = previousSnapshot ? {
    identities: identities.count - previousSnapshot.metrics.identities.count,
    heartbeats: heartbeats.count - previousSnapshot.metrics.heartbeats.count,
    mission_envelopes: envelopes.count - previousSnapshot.metrics.mission_envelopes.count,
    mission_outcomes: outcomes.count - previousSnapshot.metrics.mission_outcomes.count,
    performance_records: performance.count - previousSnapshot.metrics.performance_records.count,
    learning_contributions: learning.count - previousSnapshot.metrics.learning_contributions.count,
    memory_records_total: memory.count - previousSnapshot.metrics.memory_records_total.count,
  } : null;

  const base = {
    record_type: "NEX_GROWTH_SNAPSHOT" as const,
    snapshot_id, captured_at,
    previous_snapshot_id: previousSnapshot?.snapshot_id ?? null,
    observed_window_ms,
    metrics: { identities, heartbeats, mission_envelopes: envelopes, mission_outcomes: outcomes, performance_records: performance, learning_contributions: learning, memory_records_total: memory },
    deltas_from_previous: deltas,
  };

  const payload = snapshotSignaturePayload(base);
  const signature = ed25519Sign(null, Buffer.from(payload, "utf8"), {
    key: Buffer.from(signer.private_key_hex, "hex"),
    format: "der", type: "pkcs8",
  });

  const withSig = {
    ...base,
    signature_hex: signature.toString("hex"),
    signer_public_key_hex: signer.public_key_hex,
  };
  const snapshot: GrowthSnapshot = { ...withSig, provenance_chain_hash: provenanceChainHash(withSig, previousSnapshot ? [previousSnapshot.provenance_chain_hash] : []) };
  await getStorage().save(GROWTH_SNAPSHOT_COLLECTION, snapshot);
  return snapshot;
}

// ── Query snapshots (for HQ display) ──────────────────────────────────

export async function loadRecentSnapshots(limit = 60): Promise<GrowthSnapshot[]> {
  try {
    return await getStorage().query<GrowthSnapshot>(GROWTH_SNAPSHOT_COLLECTION, {
      limit, order_by: "captured_at", order_dir: "desc",
    });
  } catch { return []; }
}
