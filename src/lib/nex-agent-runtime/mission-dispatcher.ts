// WO-AGENT-RUNTIME-01 · founder-signed mission envelope + per-agent dispatcher.
//
// Founder-locked 2026-09-13: every mission is signed by the founder
// attestation root. The dispatcher only surfaces missions whose envelope
// is covered by the agent's capability manifest + authority manifest.
//
// No mission may authorise action beyond what the agent's authority
// manifest already permits (P-U: intelligence never becomes authority).

import { randomUUID, sign as ed25519Sign, verify as ed25519Verify } from "node:crypto";
import { canonicalJson, provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AuthorityManifest, VerificationResult } from "./types";
import type { Mission, Dispatcher, MissionResult } from "./runtime-loop";

export const MISSION_ENVELOPES_COLLECTION = "nex_agent_mission_envelopes";
export const MISSION_ASSIGNMENTS_COLLECTION = "nex_agent_mission_assignments";
export const MISSION_OUTCOMES_COLLECTION = "nex_agent_mission_outcomes";

// ── Founder-signed mission envelope ────────────────────────────────────

export interface MissionEnvelope {
  readonly record_type: "NEX_AGENT_MISSION_ENVELOPE";
  readonly envelope_id: string;
  readonly mission_id: string;
  readonly target_agent_id: string;
  readonly target_lane: "orchestrator" | "intelligence" | "lab_security" | "nex_coding";
  readonly kind: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly authorised_hosts: readonly string[];
  readonly authorised_tools: readonly string[];
  readonly budget_ms: number;
  readonly deadline_iso: string;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly founder_attestation_signature_hex: string;
  readonly provenance_chain_hash: string;
}

function envelopeSignaturePayload(input: Omit<MissionEnvelope, "record_type" | "founder_attestation_signature_hex" | "provenance_chain_hash">): string {
  return canonicalJson({
    envelope_id: input.envelope_id,
    mission_id: input.mission_id,
    target_agent_id: input.target_agent_id,
    target_lane: input.target_lane,
    kind: input.kind,
    input: input.input,
    authorised_hosts: input.authorised_hosts,
    authorised_tools: input.authorised_tools,
    budget_ms: input.budget_ms,
    deadline_iso: input.deadline_iso,
    issued_at: input.issued_at,
    expires_at: input.expires_at,
  });
}

export interface SignEnvelopeInput {
  readonly mission_id?: string;
  readonly target_agent_id: string;
  readonly target_lane: MissionEnvelope["target_lane"];
  readonly kind: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly authorised_hosts: readonly string[];
  readonly authorised_tools: readonly string[];
  readonly budget_ms: number;
  readonly lifetime_ms?: number;
  readonly founder_attestation_private_key_hex: string;
  readonly issued_at?: string;
}

export function signMissionEnvelope(input: SignEnvelopeInput): MissionEnvelope {
  const issued_at = input.issued_at ?? new Date().toISOString();
  const lifetime = input.lifetime_ms ?? 24 * 3600 * 1000;
  const expires_at = new Date(Date.parse(issued_at) + lifetime).toISOString();
  const mission_id = input.mission_id ?? `mission-${randomUUID()}`;
  const envelope_id = `envelope-${input.target_agent_id}-${randomUUID().slice(0, 8)}`;
  const deadline_iso = new Date(Date.parse(issued_at) + input.budget_ms).toISOString();

  const payload = envelopeSignaturePayload({
    envelope_id, mission_id,
    target_agent_id: input.target_agent_id, target_lane: input.target_lane,
    kind: input.kind, input: input.input,
    authorised_hosts: input.authorised_hosts, authorised_tools: input.authorised_tools,
    budget_ms: input.budget_ms, deadline_iso, issued_at, expires_at,
  });
  const signature = ed25519Sign(null, Buffer.from(payload, "utf8"), {
    key: Buffer.from(input.founder_attestation_private_key_hex, "hex"),
    format: "der", type: "pkcs8",
  });
  const base = {
    record_type: "NEX_AGENT_MISSION_ENVELOPE" as const,
    envelope_id, mission_id,
    target_agent_id: input.target_agent_id, target_lane: input.target_lane,
    kind: input.kind,
    input: input.input,
    authorised_hosts: Object.freeze([...input.authorised_hosts]) as readonly string[],
    authorised_tools: Object.freeze([...input.authorised_tools]) as readonly string[],
    budget_ms: input.budget_ms,
    deadline_iso, issued_at, expires_at,
    founder_attestation_signature_hex: signature.toString("hex"),
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
}

// ── Verify envelope ────────────────────────────────────────────────────

export interface VerifyEnvelopeInput {
  readonly envelope: MissionEnvelope;
  readonly trusted_founder_public_keys_hex: readonly string[];
  readonly now?: Date;
}

export function verifyMissionEnvelope(input: VerifyEnvelopeInput): VerificationResult {
  const e = input.envelope;
  const now = input.now ?? new Date();
  if (!e.founder_attestation_signature_hex || e.founder_attestation_signature_hex.length === 0) {
    return { ok: false, rejection: "MISSING_SIGNATURE", reason: "envelope has no founder attestation signature" };
  }
  const nowMs = now.getTime();
  if (Date.parse(e.expires_at) < nowMs) {
    return { ok: false, rejection: "STALE_TIMESTAMP", reason: `envelope expired at ${e.expires_at}` };
  }
  const payload = envelopeSignaturePayload({
    envelope_id: e.envelope_id, mission_id: e.mission_id,
    target_agent_id: e.target_agent_id, target_lane: e.target_lane,
    kind: e.kind, input: e.input,
    authorised_hosts: e.authorised_hosts, authorised_tools: e.authorised_tools,
    budget_ms: e.budget_ms, deadline_iso: e.deadline_iso,
    issued_at: e.issued_at, expires_at: e.expires_at,
  });
  const signature = Buffer.from(e.founder_attestation_signature_hex, "hex");
  for (const pubHex of input.trusted_founder_public_keys_hex) {
    try {
      const pub = Buffer.from(pubHex, "hex");
      const ok = ed25519Verify(null, Buffer.from(payload, "utf8"), { key: pub, format: "der", type: "spki" }, signature);
      if (ok) return { ok: true };
    } catch { /* try next */ }
  }
  return { ok: false, rejection: "WRONG_KEY", reason: "envelope signature did not verify against any trusted founder key" };
}

// ── Envelope-vs-authority subset check ─────────────────────────────────

/**
 * Founder-locked: an envelope may not request an action beyond the
 * agent's authority manifest. authorised_hosts and authorised_tools in
 * the envelope must be a subset of the agent's authority.
 */
export function envelopeSubsetOfAuthority(input: { envelope: MissionEnvelope; authority: AuthorityManifest }): { ok: boolean; reason: string } {
  const { envelope: e, authority: a } = input;
  for (const host of e.authorised_hosts) {
    if (!a.authorised_hosts.includes(host)) return { ok: false, reason: `envelope host "${host}" not in agent's authorised_hosts` };
  }
  for (const tool of e.authorised_tools) {
    // Wildcard in envelope means "any tool the agent already has". Not
    // an authority expansion — the agent's own tool list still bounds it.
    if (tool === "*") continue;
    if (a.authorised_tools.includes("*")) continue;
    if (!a.authorised_tools.includes(tool)) return { ok: false, reason: `envelope tool "${tool}" not in agent's authorised_tools` };
  }
  if (a.prohibited_actions.some((p) => e.authorised_tools.includes(p))) {
    return { ok: false, reason: `envelope contains a tool that is in agent's prohibited_actions` };
  }
  return { ok: true, reason: "envelope is a subset of agent's authority" };
}

// ── Persistence ────────────────────────────────────────────────────────

export async function persistEnvelope(e: MissionEnvelope): Promise<void> {
  await getStorage().save(MISSION_ENVELOPES_COLLECTION, e);
}

export async function loadUnassignedEnvelopesForAgent(agent_id: string): Promise<MissionEnvelope[]> {
  const envelopes = await getStorage().query<MissionEnvelope>(MISSION_ENVELOPES_COLLECTION, {
    limit: 5000, order_by: "issued_at", order_dir: "desc",
  });
  const assignments = await getStorage().query<{ mission_id: string }>(MISSION_ASSIGNMENTS_COLLECTION, { limit: 5000 }).catch(() => []);
  const assigned = new Set(assignments.map((a) => a.mission_id));
  return envelopes.filter((e) => e.target_agent_id === agent_id && !assigned.has(e.mission_id));
}

async function markAssigned(mission_id: string, agent_id: string): Promise<void> {
  await getStorage().save(MISSION_ASSIGNMENTS_COLLECTION, {
    record_type: "NEX_AGENT_MISSION_ASSIGNMENT",
    mission_id, agent_id, assigned_at: new Date().toISOString(),
  });
}

async function persistOutcome(mission_id: string, agent_id: string, result: MissionResult): Promise<void> {
  await getStorage().save(MISSION_OUTCOMES_COLLECTION, {
    record_type: "NEX_AGENT_MISSION_OUTCOME",
    mission_id, agent_id, result_outcome: result.outcome, items_processed: result.items_processed, evidence_refs: result.evidence_refs,
    summary: result.summary, recorded_at: new Date().toISOString(),
  });
}

// ── Dispatcher factory ─────────────────────────────────────────────────

/**
 * Founder-locked dispatcher: pulls the next authorised envelope for an
 * agent. Verifies the founder signature + envelope-vs-authority subset
 * BEFORE surfacing the mission. If verification fails, the envelope is
 * skipped and the failure recorded as an assignment refusal.
 */
export function makeEnvelopeDispatcher(input: {
  authority: AuthorityManifest;
  trusted_founder_public_keys_hex: readonly string[];
}): Dispatcher {
  return {
    poll: async (agent_id: string): Promise<Mission | null> => {
      const envelopes = await loadUnassignedEnvelopesForAgent(agent_id);
      for (const envelope of envelopes) {
        const v = verifyMissionEnvelope({ envelope, trusted_founder_public_keys_hex: input.trusted_founder_public_keys_hex });
        if (!v.ok) continue;   // skip forged/expired envelopes
        const subset = envelopeSubsetOfAuthority({ envelope, authority: input.authority });
        if (!subset.ok) continue;   // skip envelopes that exceed authority (P-U)
        await markAssigned(envelope.mission_id, agent_id);
        return {
          mission_id: envelope.mission_id,
          kind: envelope.kind,
          authorised_hosts: envelope.authorised_hosts,
          input: envelope.input,
          budget_ms: envelope.budget_ms,
          deadline_iso: envelope.deadline_iso,
        };
      }
      return null;
    },
    report: async (agent_id, mission_id, result) => {
      await persistOutcome(mission_id, agent_id, result);
    },
  };
}
