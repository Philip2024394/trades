// WO-AGENT-RUNTIME-01 · signed heartbeat emitter.
//
// Founder-locked 2026-09-13: the AGENT emits heartbeats. NOT the runner.
// NOT the observer. Every heartbeat is signed with the agent's OWN
// runtime private key. The observer verifies each signature; forged /
// unsigned / stale / duplicate heartbeats are REJECTED (never counted).
//
// Progress-without-evidence protection: a heartbeat that claims
// progress_counter > 0 but has empty evidence_refs is REJECTED at
// emission time. NO EVIDENCE = NO CLAIM.

import { randomUUID, sign as ed25519Sign, verify as ed25519Verify } from "node:crypto";
import { canonicalJson, provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import type { AgentHeartbeatEvent, AgentIdentity, VerificationResult } from "./types";

// ── Canonical payload (excludes signature + provenance fields) ─────────

function heartbeatSignaturePayload(input: {
  heartbeat_id: string;
  agent_id: string;
  runtime_version: string;
  identity_id: string;
  emitted_at: string;
  mission_id: string | null;
  progress_counter: number;
  last_completed_work: string | null;
  evidence_refs: readonly string[];
}): string {
  return canonicalJson({
    heartbeat_id: input.heartbeat_id,
    agent_id: input.agent_id,
    runtime_version: input.runtime_version,
    identity_id: input.identity_id,
    emitted_at: input.emitted_at,
    mission_id: input.mission_id,
    progress_counter: input.progress_counter,
    last_completed_work: input.last_completed_work,
    evidence_refs: input.evidence_refs,
  });
}

// ── Emit (agent side) ──────────────────────────────────────────────────

export interface EmitHeartbeatInput {
  readonly identity: AgentIdentity;
  readonly runtime_private_key_hex: string;
  readonly mission_id: string | null;
  readonly progress_counter: number;
  readonly last_completed_work: string | null;
  readonly evidence_refs: readonly string[];
  readonly emitted_at?: string;                    // defaults to now
}

export interface EmitHeartbeatResult {
  readonly ok: true;
  readonly heartbeat: AgentHeartbeatEvent;
}
export interface EmitHeartbeatFailure {
  readonly ok: false;
  readonly rejection: "PROGRESS_WITHOUT_EVIDENCE";
  readonly reason: string;
}

/**
 * Agent-side heartbeat emission. Signs with the agent's private key.
 * Refuses to sign a heartbeat that claims progress but has no evidence
 * (founder-locked: NO EVIDENCE = NO CLAIM at emission, not just at
 * observation).
 */
export function emitHeartbeat(input: EmitHeartbeatInput): EmitHeartbeatResult | EmitHeartbeatFailure {
  // Founder-locked emission guard: progress without evidence is refused.
  // A pure liveness heartbeat (progress_counter === 0, evidence_refs = [])
  // is allowed — that is the ALIVE / ALIVE_NO_PROGRESS state signal.
  if (input.progress_counter > 0 && input.evidence_refs.length === 0) {
    return {
      ok: false,
      rejection: "PROGRESS_WITHOUT_EVIDENCE",
      reason: `agent ${input.identity.agent_id} attempted to emit heartbeat with progress_counter=${input.progress_counter} but empty evidence_refs · NO EVIDENCE = NO CLAIM`,
    };
  }

  const emitted_at = input.emitted_at ?? new Date().toISOString();
  const heartbeat_id = `agent-hb-${input.identity.agent_id}-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const payload = heartbeatSignaturePayload({
    heartbeat_id,
    agent_id: input.identity.agent_id,
    runtime_version: input.identity.runtime_version,
    identity_id: input.identity.identity_id,
    emitted_at,
    mission_id: input.mission_id,
    progress_counter: input.progress_counter,
    last_completed_work: input.last_completed_work,
    evidence_refs: input.evidence_refs,
  });

  const privateKey = Buffer.from(input.runtime_private_key_hex, "hex");
  const signature = ed25519Sign(null, Buffer.from(payload, "utf8"), { key: privateKey, format: "der", type: "pkcs8" });
  const runtime_signature_hex = signature.toString("hex");

  const base = {
    record_type: "NEX_AGENT_HEARTBEAT_EVENT" as const,
    heartbeat_id,
    agent_id: input.identity.agent_id,
    runtime_version: input.identity.runtime_version,
    identity_id: input.identity.identity_id,
    emitted_at,
    mission_id: input.mission_id,
    progress_counter: input.progress_counter,
    last_completed_work: input.last_completed_work,
    evidence_refs: Object.freeze([...input.evidence_refs]) as readonly string[],
    runtime_signature_hex,
  };
  return { ok: true, heartbeat: { ...base, provenance_chain_hash: provenanceChainHash(base, []) } };
}

// ── Verify (observer side) ─────────────────────────────────────────────

export interface VerifyHeartbeatInput {
  readonly heartbeat: AgentHeartbeatEvent;
  readonly expected_agent_id: string;
  readonly expected_runtime_public_key_hex: string;
  readonly now?: Date;
  /** Max clock skew allowed in the future direction (ms). Founder-locked default 5s. */
  readonly max_future_skew_ms?: number;
  /** Max age allowed (ms). Founder-locked default 24h — beyond that, STALE. */
  readonly max_age_ms?: number;
}

const DEFAULT_MAX_FUTURE_SKEW_MS = 5_000;
const DEFAULT_MAX_AGE_MS = 24 * 3600 * 1000;

/**
 * Observer-side heartbeat verification. Founder-locked 2026-09-13:
 * every rejection has a distinct category (never lumped as "invalid").
 *
 * Checks (in order):
 *  1. signature present
 *  2. agent_id matches expected
 *  3. emitted_at not in the future beyond max_future_skew_ms
 *  4. emitted_at not older than max_age_ms
 *  5. progress_counter > 0 implies evidence_refs non-empty
 *  6. Ed25519 signature verifies against expected_runtime_public_key_hex
 */
export function verifyHeartbeat(input: VerifyHeartbeatInput): VerificationResult {
  const { heartbeat: h, expected_agent_id, expected_runtime_public_key_hex } = input;
  const now = input.now ?? new Date();
  const maxFuture = input.max_future_skew_ms ?? DEFAULT_MAX_FUTURE_SKEW_MS;
  const maxAge = input.max_age_ms ?? DEFAULT_MAX_AGE_MS;

  if (!h.runtime_signature_hex || h.runtime_signature_hex.length === 0) {
    return { ok: false, rejection: "MISSING_SIGNATURE", reason: "heartbeat runtime_signature_hex is empty" };
  }
  if (h.agent_id !== expected_agent_id) {
    return { ok: false, rejection: "AGENT_ID_MISMATCH", reason: `heartbeat agent_id "${h.agent_id}" != expected "${expected_agent_id}"` };
  }
  const emittedMs = Date.parse(h.emitted_at);
  if (Number.isNaN(emittedMs)) {
    return { ok: false, rejection: "STALE_TIMESTAMP", reason: `heartbeat emitted_at "${h.emitted_at}" is not a valid ISO timestamp` };
  }
  const nowMs = now.getTime();
  if (emittedMs > nowMs + maxFuture) {
    return { ok: false, rejection: "FUTURE_TIMESTAMP", reason: `heartbeat emitted_at is ${emittedMs - nowMs}ms in the future beyond skew tolerance ${maxFuture}ms` };
  }
  if (nowMs - emittedMs > maxAge) {
    return { ok: false, rejection: "STALE_TIMESTAMP", reason: `heartbeat is ${nowMs - emittedMs}ms old, exceeds max_age_ms ${maxAge}` };
  }
  if (h.progress_counter > 0 && h.evidence_refs.length === 0) {
    return { ok: false, rejection: "PROGRESS_WITHOUT_EVIDENCE", reason: `progress_counter=${h.progress_counter} but evidence_refs is empty · NO EVIDENCE = NO CLAIM` };
  }
  const payload = heartbeatSignaturePayload({
    heartbeat_id: h.heartbeat_id,
    agent_id: h.agent_id,
    runtime_version: h.runtime_version,
    identity_id: h.identity_id,
    emitted_at: h.emitted_at,
    mission_id: h.mission_id,
    progress_counter: h.progress_counter,
    last_completed_work: h.last_completed_work,
    evidence_refs: h.evidence_refs,
  });
  try {
    const pub = Buffer.from(expected_runtime_public_key_hex, "hex");
    const ok = ed25519Verify(null, Buffer.from(payload, "utf8"), { key: pub, format: "der", type: "spki" }, Buffer.from(h.runtime_signature_hex, "hex"));
    if (!ok) return { ok: false, rejection: "WRONG_KEY", reason: "signature did not verify against expected runtime public key" };
  } catch (e) {
    return { ok: false, rejection: "SIGNATURE_INVALID", reason: (e as Error).message };
  }
  return { ok: true };
}
