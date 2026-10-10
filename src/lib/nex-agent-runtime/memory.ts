// WO-AGENT-RUNTIME-01 · per-agent persistent memory.
//
// Founder-locked 2026-09-13: every agent has its OWN memory store, keyed
// by agent_id. Survives orchestrator + runner restart (real filesystem
// persistence via the existing GB storage layer). Every write is signed
// with the agent's runtime private key.

import { randomUUID, sign as ed25519Sign } from "node:crypto";
import { canonicalJson, provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity, AgentMemoryKind, AgentMemoryRecord } from "./types";

/**
 * Per-agent collection name. Founder-locked convention: one collection
 * per agent, keyed by agent_id.
 */
export function agentMemoryCollectionName(agent_id: string): string {
  return `nex_agent_memory_${agent_id.replace(/[^a-z0-9_]+/gi, "_")}`;
}

// ── Signature payload ──────────────────────────────────────────────────

function memorySignaturePayload(input: {
  memory_id: string;
  agent_id: string;
  kind: AgentMemoryKind;
  mission_id: string | null;
  content_hash: string;
  created_at: string;
}): string {
  return canonicalJson({
    memory_id: input.memory_id,
    agent_id: input.agent_id,
    kind: input.kind,
    mission_id: input.mission_id,
    content_hash: input.content_hash,
    created_at: input.created_at,
  });
}

// ── Write ──────────────────────────────────────────────────────────────

export interface WriteMemoryInput {
  readonly identity: AgentIdentity;
  readonly runtime_private_key_hex: string;
  readonly kind: AgentMemoryKind;
  readonly mission_id: string | null;
  readonly content: Readonly<Record<string, unknown>>;
  readonly created_at?: string;
}

export async function writeAgentMemory(input: WriteMemoryInput): Promise<AgentMemoryRecord> {
  const created_at = input.created_at ?? new Date().toISOString();
  const memory_id = `agent-mem-${input.identity.agent_id}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const content_hash = sha256Hex(canonicalJson(input.content));

  const payload = memorySignaturePayload({
    memory_id,
    agent_id: input.identity.agent_id,
    kind: input.kind,
    mission_id: input.mission_id,
    content_hash,
    created_at,
  });

  const signature = ed25519Sign(null, Buffer.from(payload, "utf8"), {
    key: Buffer.from(input.runtime_private_key_hex, "hex"),
    format: "der",
    type: "pkcs8",
  });
  const runtime_signature_hex = signature.toString("hex");

  const base = {
    record_type: "NEX_AGENT_MEMORY_RECORD" as const,
    memory_id,
    agent_id: input.identity.agent_id,
    kind: input.kind,
    mission_id: input.mission_id,
    content_hash,
    content: input.content,
    created_at,
    runtime_signature_hex,
  };
  const record: AgentMemoryRecord = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(agentMemoryCollectionName(input.identity.agent_id), record);
  return record;
}

// ── Read ───────────────────────────────────────────────────────────────

export interface ReadMemoryInput {
  readonly agent_id: string;
  readonly kind?: AgentMemoryKind;
  readonly mission_id?: string | null;
  readonly limit?: number;
}

export async function readAgentMemory(input: ReadMemoryInput): Promise<AgentMemoryRecord[]> {
  const records = await getStorage().query<AgentMemoryRecord>(
    agentMemoryCollectionName(input.agent_id),
    { limit: input.limit ?? 200, order_by: "created_at", order_dir: "desc" },
  );
  return records.filter((r) => {
    if (input.kind && r.kind !== input.kind) return false;
    if (input.mission_id !== undefined && r.mission_id !== input.mission_id) return false;
    return true;
  });
}
