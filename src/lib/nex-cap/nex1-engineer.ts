// WO-CAP-01 · NEX1 Engineer integration for CAP-driven governed self-improvement.
//
// Founder-locked 2026-09-13:
//   Discovery ≠ Authority.
//   CAP → diagnose → propose WO envelope → Authority Broker gates.
//   NEX1 Engineer never signs its own WO envelope · founder must sign.
//   AUTO_FIX only for pre-authorised safe scopes (currently empty · doctrine).
//
// This module produces an UNSIGNED engineering proposal from a CAP. The
// proposal contains: (a) diagnosis, (b) proposed fix summary, (c) evidence
// chain, (d) required Authority scope. It leaves the founder_signature
// slot empty · founder must sign before Broker allows execution.

import { randomUUID } from "node:crypto";
import { provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import { updateCapStatus, loadCap } from "./registry";
import { resolveCapProposal } from "./resolver";
import type { CapabilityGap } from "./types";

export const CAP_ENGINEERING_PROPOSAL_COLLECTION = "nex_cap_engineering_proposals";

// ── Proposal record ────────────────────────────────────────────────────

/**
 * Founder-signed workstation scope for a CAP proposal.
 *
 * WO-CAP-EXECUTION-02 · founder-locked 2026-09-13.
 *
 * Every proposal that intends to reach the workstation stages must declare
 * EXACTLY what the workstation is authorised to touch. The founder signs
 * this scope AS PART OF the proposal signature payload. Any workstation
 * stage attempting to write a path outside `files_may_touch` MUST be
 * rejected at the scope boundary — the negative test surface.
 *
 * `stages_required` lets the founder narrow WHICH of the 10 verification
 * points the CAP is asked to pass. For example, a docs-only CAP declares
 * `stages_required` without WO-06 runtime · the corresponding verifier
 * treats the omitted point as founder-scoped-out (NOT UNAVAILABLE→PASSED).
 * A CAP that omits a stage cannot claim its corresponding verification
 * point — the point is marked N/A_per_signed_scope and the CAP remains
 * OPEN unless the reduced set is genuinely sufficient (see verifier
 * logic in execution.ts).
 */
export interface AuthorisedWorkstationScope {
  readonly files_may_touch: readonly string[];         // paths relative to workspace_root
  readonly build_targets: readonly string[];           // e.g. ["next", "tsc"]; empty means no build required
  readonly collections_may_write: readonly string[];   // GB collections the fix may write
  readonly stages_required: readonly ("WO-01" | "WO-04" | "WO-05" | "WO-06" | "WO-07" | "WO-08" | "WO-09")[];
  readonly runtime_required: boolean;                   // false for docs/config-only fixes
}

export interface CapEngineeringProposal {
  readonly record_type: "NEX_CAP_ENGINEERING_PROPOSAL";
  readonly proposal_id: string;
  readonly cap_id: string;
  readonly diagnosed_by_agent: "nex1-master-engineer";
  readonly diagnosis: string;
  readonly proposed_fix_summary: string;
  readonly required_authority_scope: {
    readonly authorised_tools: readonly string[];
    readonly authorised_hosts: readonly string[];
    readonly authorised_collections_write: readonly string[];
    readonly requires_founder_signature: boolean;
  };
  /**
   * Optional workstation scope. Absent = this proposal is NOT authorised
   * to reach the workstation stages; only ESCALATE or non-workstation
   * remediation is available. Present + founder-signed = adapter runs
   * within these bounds.
   */
  readonly authorised_workstation_scope: AuthorisedWorkstationScope | null;
  readonly evidence_chain: readonly string[];
  readonly resolver_outcome: "AUTO_FIX" | "PROPOSE" | "ESCALATE";
  readonly founder_signature_slot: null;   // P-U · never signed by NEX1
  readonly created_at: string;
  readonly provenance_chain_hash: string;
}

/**
 * Canonical bytes that the founder Ed25519 signs for a CAP proposal.
 * Includes proposal_id, cap_id, and (if present) a hash of the workstation
 * scope — so ANY mutation of the scope invalidates the signature.
 */
export function canonicalSigningPayload(proposal: CapEngineeringProposal): Buffer {
  const scopeHash = proposal.authorised_workstation_scope
    ? hashAuthorisedScope(proposal.authorised_workstation_scope)
    : "no-workstation-scope";
  return Buffer.from(`${proposal.proposal_id}|${proposal.cap_id}|${scopeHash}`, "utf8");
}

export function hashAuthorisedScope(s: AuthorisedWorkstationScope): string {
  // Canonical JSON of the scope · sorted keys guaranteed by ordered destructure
  const canon = JSON.stringify({
    files_may_touch: [...s.files_may_touch].sort(),
    build_targets: [...s.build_targets].sort(),
    collections_may_write: [...s.collections_may_write].sort(),
    stages_required: [...s.stages_required].sort(),
    runtime_required: s.runtime_required,
  });
  return require("node:crypto").createHash("sha256").update(canon).digest("hex");
}

/**
 * Founder-locked deterministic diagnosis · pure function of CAP kind.
 * P-S: no LLM reasoning. Kind → structured diagnosis template.
 */
function diagnoseCap(cap: CapabilityGap): { diagnosis: string; proposed_fix_summary: string; required_authority_scope: CapEngineeringProposal["required_authority_scope"] } {
  switch (cap.kind) {
    case "guardian.te.evidence_source_unregistered":
      return {
        diagnosis: "Crawler attempted to acquire from a source_id absent from the founder-signed registry manifest. Either the source is genuinely new (needs addition to registry) or an agent is requesting an unauthorised source.",
        proposed_fix_summary: "Review requested source_id · if legitimate, sign a new registry manifest that includes it · if illegitimate, tighten agent authority envelope",
        required_authority_scope: {
          authorised_tools: ["sign_source_registry_manifest"],
          authorised_hosts: [], authorised_collections_write: ["nex_source_registry_manifests"],
          requires_founder_signature: true,
        },
      };
    case "rate_limiter.persistent_backoff":
      return {
        diagnosis: "One host has persistent rate-limit or backoff events. Either (a) our request rate is too high, (b) the source's rate limits changed, or (c) we should reduce priority of this source.",
        proposed_fix_summary: "Lower priority for the affected source_id in AUTHORISED_SOURCES · optionally increase min_interval_ms · re-sign registry manifest",
        required_authority_scope: {
          authorised_tools: ["modify_source_priority", "sign_source_registry_manifest"],
          authorised_hosts: [], authorised_collections_write: ["nex_source_registry_manifests"],
          requires_founder_signature: true,
        },
      };
    case "intelligence.growth_stalled":
      return {
        diagnosis: "NET NEX GROWTH has been zero for the last 3 snapshots. Either (a) all authorised sources are cooling off, (b) pipeline stages are stuck, or (c) input rate is throttled below productive throughput.",
        proposed_fix_summary: "Investigate agent heartbeat states · check source availability · consider adding new authorised source classes",
        required_authority_scope: {
          authorised_tools: ["diagnose_pipeline", "sign_source_registry_manifest"],
          authorised_hosts: [], authorised_collections_write: [],
          requires_founder_signature: true,
        },
      };
    case "guardian.te.evidence_source_registry_untrusted":
    case "guardian.te.evidence_source_test_masquerade":
      return {
        diagnosis: "Security-critical rejection · registry integrity or identity spoofing attempt. NEX1 CANNOT propose an autonomous fix.",
        proposed_fix_summary: "Founder must review the rejection evidence and decide on remediation. Do NOT auto-modify registry or authority manifests.",
        required_authority_scope: {
          authorised_tools: [], authorised_hosts: [], authorised_collections_write: [],
          requires_founder_signature: true,
        },
      };
    default:
      return {
        diagnosis: `CAP kind "${cap.kind}" has no NEX1 diagnosis template · treating as generic engineering proposal.`,
        proposed_fix_summary: `Investigate evidence · propose bounded fix within existing authority envelopes · seek founder review before implementation.`,
        required_authority_scope: {
          authorised_tools: [], authorised_hosts: [], authorised_collections_write: [],
          requires_founder_signature: true,
        },
      };
  }
}

// ── Create + persist proposal ──────────────────────────────────────────

export async function nex1EngineerProposeFor(cap: CapabilityGap): Promise<{ proposal: CapEngineeringProposal | null; outcome: "AUTO_FIX" | "PROPOSE" | "ESCALATE"; reason: string }> {
  const decision = resolveCapProposal({ cap });

  if (decision.outcome === "ESCALATE") {
    await updateCapStatus({
      cap_id: cap.cap_id, status: "ESCALATED",
      resolver_outcome: "ESCALATE",
      resolution_note: `NEX1 Engineer: ${decision.reason} · founder must review`,
    });
    return { proposal: null, outcome: "ESCALATE", reason: decision.reason };
  }

  // For PROPOSE and AUTO_FIX, NEX1 drafts an unsigned proposal.
  // AUTO_FIX still requires an Authority Broker gate before execution.
  const { diagnosis, proposed_fix_summary, required_authority_scope } = diagnoseCap(cap);
  const proposal_id = `CAP-PROP-${cap.cap_id}-${randomUUID().slice(0, 8)}`;
  const evidence_chain = [cap.cap_id, ...cap.evidence.map((e) => e.record_id)];
  const base = {
    record_type: "NEX_CAP_ENGINEERING_PROPOSAL" as const,
    proposal_id, cap_id: cap.cap_id,
    diagnosed_by_agent: "nex1-master-engineer" as const,
    diagnosis, proposed_fix_summary, required_authority_scope,
    // WO-CAP-EXECUTION-02: NEX1 never fabricates workstation scope. Scope is
    // attached by the founder-signed workstation-scope authoring path (a
    // separate NEX1 step keyed to specific CAP kinds with deterministic
    // templates). By default the workstation cannot be reached.
    authorised_workstation_scope: null as AuthorisedWorkstationScope | null,
    evidence_chain: Object.freeze([...evidence_chain]) as readonly string[],
    resolver_outcome: decision.outcome,
    founder_signature_slot: null as null,
    created_at: new Date().toISOString(),
  };
  const proposal: CapEngineeringProposal = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(CAP_ENGINEERING_PROPOSAL_COLLECTION, proposal);

  await updateCapStatus({
    cap_id: cap.cap_id,
    status: decision.next_status,
    resolver_outcome: decision.outcome,
    proposed_wo_id: proposal_id,
    resolution_note: `${decision.reason} · proposal ${proposal_id}`,
  });
  return { proposal, outcome: decision.outcome, reason: decision.reason };
}

/**
 * Authority Broker gate. Given a proposal and a founder attestation
 * signature, verify the signature and return whether execution is allowed.
 * Founder-locked: this is the ONLY path from CAP → executed change.
 */
export async function authorityBrokerGate(input: {
  proposal_id: string;
  founder_signature_hex: string;
  trusted_founder_public_keys_hex: readonly string[];
}): Promise<{ allowed: boolean; reason: string; proposal: CapEngineeringProposal | null }> {
  const store = getStorage();
  // Append-only JSONL may hold multiple versions per proposal_id (e.g.
  // after attachWorkstationScopeToProposal). Query by proposal_id with
  // newest-first ordering so a growing store cannot hide the latest
  // canonical form behind the limit boundary.
  const all = await store.query<CapEngineeringProposal>(CAP_ENGINEERING_PROPOSAL_COLLECTION, {
    where: { proposal_id: input.proposal_id },
    limit: 200,
    order_by: "created_at",
    order_dir: "desc",
  }).catch(() => []);
  const proposal = all[0];
  if (!proposal) return { allowed: false, reason: "proposal_not_found", proposal: null };

  if (proposal.resolver_outcome === "ESCALATE") {
    return { allowed: false, reason: "ESCALATE outcomes cannot be broker-approved · founder must resolve manually", proposal };
  }
  if (!input.founder_signature_hex || input.founder_signature_hex.length === 0) {
    return { allowed: false, reason: "no founder signature provided · Broker refuses execution", proposal };
  }
  // WO-CAP-EXECUTION-02: signature payload includes hash of authorised
  // workstation scope. Any tampering with the scope invalidates the sig.
  try {
    const { verify: ed25519Verify } = await import("node:crypto");
    const payload = canonicalSigningPayload(proposal);
    const sig = Buffer.from(input.founder_signature_hex, "hex");
    for (const pubHex of input.trusted_founder_public_keys_hex) {
      try {
        const pub = Buffer.from(pubHex, "hex");
        const ok = ed25519Verify(null, payload, { key: pub, format: "der", type: "spki" }, sig);
        if (ok) return { allowed: true, reason: "founder signature verified · execution authorised", proposal };
      } catch { /* try next */ }
    }
  } catch (e) {
    return { allowed: false, reason: `signature verification threw: ${(e as Error).message}`, proposal };
  }
  return { allowed: false, reason: "signature did not verify against any trusted founder key", proposal };
}

/**
 * Founder helper: sign the canonical scope-inclusive payload for a
 * proposal. In production the founder signs offline; this helper is for
 * dev/tests. The signature covers proposal_id, cap_id, AND the hash of
 * the authorised workstation scope · any scope tamper invalidates it.
 */
export async function founderSignProposal(input: {
  proposal: CapEngineeringProposal;
  founder_private_key_hex: string;
}): Promise<string> {
  const { sign: ed25519Sign } = await import("node:crypto");
  const payload = canonicalSigningPayload(input.proposal);
  const sig = ed25519Sign(null, payload, {
    key: Buffer.from(input.founder_private_key_hex, "hex"),
    format: "der", type: "pkcs8",
  });
  return sig.toString("hex");
}

/**
 * Founder helper: attach an authorised workstation scope to an existing
 * proposal. Returns the updated proposal · caller must sign this NEW
 * proposal shape (its scope_hash changes). Deterministic · founder-only
 * · not part of the AUTO_FIX surface.
 */
export async function attachWorkstationScopeToProposal(input: {
  proposal_id: string;
  scope: AuthorisedWorkstationScope;
}): Promise<CapEngineeringProposal | null> {
  const store = getStorage();
  const all = await store.query<CapEngineeringProposal>(CAP_ENGINEERING_PROPOSAL_COLLECTION, {
    where: { proposal_id: input.proposal_id },
    limit: 200,
    order_by: "created_at",
    order_dir: "desc",
  }).catch(() => []);
  const existing = all[0];
  if (!existing) return null;
  const { provenance_chain_hash: _drop, ...base } = existing;
  void _drop;
  // Refresh created_at so the append-only store's latest-per-key
  // ordering resolves to this version, not the earlier scopeless one.
  const withScope = { ...base, authorised_workstation_scope: input.scope, created_at: new Date().toISOString() };
  const withHash: CapEngineeringProposal = { ...withScope, provenance_chain_hash: provenanceChainHash(withScope, []) };
  await store.save(CAP_ENGINEERING_PROPOSAL_COLLECTION, withHash);
  return withHash;
}

export async function loadAllProposals(): Promise<CapEngineeringProposal[]> {
  return getStorage().query<CapEngineeringProposal>(CAP_ENGINEERING_PROPOSAL_COLLECTION, { limit: 5000, order_by: "created_at", order_dir: "desc" }).catch(() => []);
}
