// WO-AGENT-RUNTIME-01 · learning contribution channel.
//
// Founder-locked 2026-09-13: every agent contributes validated knowledge
// back to NEX post-mission. Contributions are signed by the agent's
// runtime key and land in nex_agent_learning_contributions. The Scoring
// agent later evaluates them; only causally-supported contributions get
// promoted to nex_intelligence_knowledge_objects (P-U preserved: no
// self-authorisation).

import { randomUUID, sign as ed25519Sign } from "node:crypto";
import { canonicalJson, provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity, AgentLearningContribution } from "./types";

export const LEARNING_CONTRIBUTION_COLLECTION = "nex_agent_learning_contributions";

function contribSignaturePayload(input: {
  contribution_id: string;
  agent_id: string;
  mission_id: string;
  kind: "VALIDATED_LESSON" | "NEW_PATTERN" | "RETRACTED_ASSUMPTION";
  content: Readonly<Record<string, unknown>>;
  evidence_refs: readonly string[];
  proposed_at: string;
}): string {
  return canonicalJson({
    contribution_id: input.contribution_id,
    agent_id: input.agent_id,
    mission_id: input.mission_id,
    kind: input.kind,
    content: input.content,
    evidence_refs: input.evidence_refs,
    proposed_at: input.proposed_at,
  });
}

export interface EmitLearningInput {
  readonly identity: AgentIdentity;
  readonly runtime_private_key_hex: string;
  readonly mission_id: string;
  readonly kind: "VALIDATED_LESSON" | "NEW_PATTERN" | "RETRACTED_ASSUMPTION";
  readonly content: Readonly<Record<string, unknown>>;
  readonly evidence_refs: readonly string[];
}

export type EmitLearningResult =
  | { readonly ok: true; readonly contribution: AgentLearningContribution }
  | { readonly ok: false; readonly rejection: "NO_EVIDENCE"; readonly reason: string };

/**
 * Founder-locked emission guard: NO EVIDENCE = NO CLAIM. A learning
 * contribution with empty evidence_refs is REFUSED at emission.
 */
export async function emitLearningContribution(input: EmitLearningInput): Promise<EmitLearningResult> {
  if (input.evidence_refs.length === 0) {
    return { ok: false, rejection: "NO_EVIDENCE", reason: `agent ${input.identity.agent_id} attempted to contribute learning "${input.kind}" without evidence · NO EVIDENCE = NO CLAIM` };
  }
  const proposed_at = new Date().toISOString();
  const contribution_id = `agent-learn-${input.identity.agent_id}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const payload = contribSignaturePayload({
    contribution_id,
    agent_id: input.identity.agent_id,
    mission_id: input.mission_id,
    kind: input.kind,
    content: input.content,
    evidence_refs: input.evidence_refs,
    proposed_at,
  });
  const signature = ed25519Sign(null, Buffer.from(payload, "utf8"), {
    key: Buffer.from(input.runtime_private_key_hex, "hex"),
    format: "der", type: "pkcs8",
  });
  const base = {
    record_type: "NEX_AGENT_LEARNING_CONTRIBUTION" as const,
    contribution_id,
    agent_id: input.identity.agent_id,
    mission_id: input.mission_id,
    kind: input.kind,
    content: input.content,
    evidence_refs: Object.freeze([...input.evidence_refs]) as readonly string[],
    proposed_at,
    runtime_signature_hex: signature.toString("hex"),
  };
  const record: AgentLearningContribution = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(LEARNING_CONTRIBUTION_COLLECTION, record);
  return { ok: true, contribution: record };
}

export async function queryLearningContributions(agent_id: string, limit = 5000): Promise<AgentLearningContribution[]> {
  const records = await getStorage().query<AgentLearningContribution>(
    LEARNING_CONTRIBUTION_COLLECTION, { limit, order_by: "proposed_at", order_dir: "desc" },
  );
  return records.filter((r) => r.agent_id === agent_id);
}
