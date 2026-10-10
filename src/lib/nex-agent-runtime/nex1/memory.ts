// WO-NEX-RUNTIME-03 · NEX1 seven-layer persistent memory.
//
// Founder-locked 2026-09-13. Memory is signed by the agent identity so
// records can be independently attributed. Different layers have
// different semantics · KNOWLEDGE is query-only for callers outside of
// a founder-authorised knowledge writer; WORKING is scoped to a mission
// and expires with it; ENGINEERING accumulates across missions.

import { randomUUID, sign as ed25519Sign, createPublicKey, verify as ed25519Verify } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import {
  type MemoryLayer,
  type NexMemoryRecord,
  NEX1_MEMORY_COLLECTION,
} from "./types";

// ── Canonical serialisation ────────────────────────────────────────────

function canonicalise(record: Omit<NexMemoryRecord, "signature_hex">): Buffer {
  const ordered = {
    record_type: record.record_type,
    memory_id: record.memory_id,
    agent_id: record.agent_id,
    layer: record.layer,
    mission_id: record.mission_id,
    key: record.key,
    value: record.value,
    kind: record.kind,
    created_at: record.created_at,
    source_evidence_refs: [...record.source_evidence_refs],
    provenance: record.provenance,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

// ── Write ──────────────────────────────────────────────────────────────

export interface WriteMemoryInput {
  readonly identity: AgentIdentity;
  readonly layer: MemoryLayer;
  readonly key: string;
  readonly value: unknown;
  readonly kind: string;
  readonly mission_id?: string | null;
  readonly source_evidence_refs?: readonly string[];
  readonly provenance: string;
}

export async function writeMemory(input: WriteMemoryInput): Promise<NexMemoryRecord> {
  const base = {
    record_type: "NEX1_MEMORY_RECORD" as const,
    memory_id: `MEM-${input.identity.agent_id}-${input.layer}-${randomUUID()}`,
    agent_id: input.identity.agent_id,
    layer: input.layer,
    mission_id: input.mission_id ?? null,
    key: input.key,
    value: typeof input.value === "string" ? input.value : JSON.stringify(input.value),
    kind: input.kind,
    created_at: new Date().toISOString(),
    source_evidence_refs: Object.freeze([...(input.source_evidence_refs ?? [])]) as readonly string[],
    provenance: input.provenance,
  };
  const sig = ed25519Sign(null, canonicalise(base), input.identity.private).toString("hex");
  const record: NexMemoryRecord = { ...base, signature_hex: sig };
  await getStorage().save(NEX1_MEMORY_COLLECTION, record);
  return record;
}

// ── Read ───────────────────────────────────────────────────────────────

export async function readMemoryByLayer(agent_id: string, layer: MemoryLayer, limit = 500): Promise<NexMemoryRecord[]> {
  const rows = await getStorage().query<NexMemoryRecord>(NEX1_MEMORY_COLLECTION, {
    where: { agent_id, layer }, limit, order_by: "created_at", order_dir: "desc",
  }).catch(() => [] as NexMemoryRecord[]);
  return rows;
}

export async function readMemoryForMission(agent_id: string, mission_id: string, limit = 500): Promise<NexMemoryRecord[]> {
  const rows = await getStorage().query<NexMemoryRecord>(NEX1_MEMORY_COLLECTION, {
    where: { agent_id, mission_id }, limit, order_by: "created_at", order_dir: "asc",
  }).catch(() => [] as NexMemoryRecord[]);
  return rows;
}

export async function readMemoryByKey(agent_id: string, layer: MemoryLayer, key: string, limit = 20): Promise<NexMemoryRecord[]> {
  const rows = await getStorage().query<NexMemoryRecord>(NEX1_MEMORY_COLLECTION, {
    where: { agent_id, layer, key }, limit, order_by: "created_at", order_dir: "desc",
  }).catch(() => [] as NexMemoryRecord[]);
  return rows;
}

// ── Verify ─────────────────────────────────────────────────────────────

export function verifyMemoryRecord(publicKeyDerHex: string, record: NexMemoryRecord): boolean {
  try {
    const pub = createPublicKey({ key: Buffer.from(publicKeyDerHex, "hex"), format: "der", type: "spki" });
    const { signature_hex: _drop, ...base } = record;
    void _drop;
    return ed25519Verify(null, canonicalise(base), pub, Buffer.from(record.signature_hex, "hex"));
  } catch { return false; }
}
