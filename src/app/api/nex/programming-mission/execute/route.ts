// POST /api/nex/programming-mission/execute
//
// Founder-locked 2026-09-14. PHASE 2 of the two-phase Send-to-NEX1
// button. Takes { draft_id, delegation } where delegation is a
// founder-signed envelope produced OFFLINE by:
//
//     scripts/nex-founder-sign-delegation.mjs
//
// The founder's private key NEVER enters NEX. This endpoint verifies
// the delegation, runs the full RUNTIME-11 chain against the previously
// drafted mission, and returns the 12-link completion receipt.
//
// Refuses if:
//   - draft not found
//   - draft already executed (idempotency · no double-execute)
//   - delegation signature invalid
//   - delegation expired · revoked
//   - delegation scope ≠ drafted mission scope
//   - delegation allowed paths ≠ drafted authored file paths
//   - founder authorized file A but proposal attempts file B
//   - any downstream gate fails (NEX2 · Security · Orchestrator · WO-04 · build · test)

import { NextResponse } from "next/server";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createOrLoadIdentity } from "@/lib/nex-agent-runtime/process/identity";
import { loadDraft, markDraftExecuted } from "@/lib/nex-agent-runtime/programming-mission/draft";
import type { FounderDelegationEnvelope, DelegatedAuthorizationEnvelope } from "@/lib/nex-agent-runtime/founder-authority/types";
import { verifyDelegationSignature, persistDelegation } from "@/lib/nex-agent-runtime/founder-authority/delegation";
import { checkFounderKeyTrusted } from "@/lib/nex-agent-runtime/founder-authority/trusted-anchors";
import { acquireExecutionLock } from "@/lib/nex-agent-runtime/programming-mission/execution-lock";
import {
  signDelegatedAuthorization,
  persistDelegatedAuthorization,
} from "@/lib/nex-agent-runtime/founder-authority/authorization";
import { generateKeyPair } from "@/lib/nex-controlled-hands/ed25519";
import { buildFounderKeyRecordForTest, type FounderKeyManifest } from "@/lib/nex1-orchestrator/wo2-founder-keys";
import { getStorage } from "@/lib/nex/storage/registry";
import { assembleGateReceipt } from "@/lib/nex-agent-runtime/orchestrator/orchestrator";
import { nex2ReviewProposal } from "@/lib/nex-agent-runtime/nex2/review";
import { securityReviewProposal } from "@/lib/nex-agent-runtime/security/review";
import { CAP_ENGINEERING_PROPOSAL_COLLECTION, founderSignProposal, hashAuthorisedScope, type CapEngineeringProposal } from "@/lib/nex-cap/nex1-engineer";
import { persistCapabilityGap } from "@/lib/nex-cap/registry";
import {
  CAP_KIND_PROGRAMMING_SMALL_CHANGE,
  buildProgrammingMissionBridge,
  verifiersForProgrammingMission,
  authorisedScopeForProgrammingMission,
} from "@/lib/nex-cap/cap-spec-bridge";
import { executeThroughWorkstation } from "@/lib/nex-agent-runtime/workstation-integration/execute";
import { provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import type { OrchestratorGateReceipt } from "@/lib/nex-agent-runtime/orchestrator/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ExecuteBody {
  readonly draft_id?: string;
  readonly delegation?: FounderDelegationEnvelope;
}

const HQ_NEX1_AGENT_ID = "nex1-hq-server" as const;
const HQ_NEX2_AGENT_ID = "nex2-hq-server" as const;
const HQ_SECURITY_AGENT_ID = "security-hq-server" as const;
const HQ_ORCHESTRATOR_AGENT_ID = "orchestrator-hq-server" as const;

function refuse(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function POST(req: Request): Promise<Response> {
  let body: ExecuteBody;
  try { body = (await req.json()) as ExecuteBody; }
  catch { return refuse(400, "invalid_json_body"); }

  if (!body.draft_id || typeof body.draft_id !== "string") return refuse(400, "missing_draft_id");
  if (!body.delegation || typeof body.delegation !== "object") return refuse(400, "missing_delegation");

  // ── Load draft ──────────────────────────────────────────────────────
  const draft = await loadDraft(body.draft_id);
  if (!draft) return refuse(404, "draft_not_found", { draft_id: body.draft_id });
  if (draft.verdict !== "DRAFT_READY_FOR_FOUNDER_AUTHORIZATION") {
    return refuse(409, "draft_not_ready", { draft_verdict: draft.verdict, refusal_reason: draft.refusal_reason });
  }
  if (draft.executed_at !== null) {
    return refuse(409, "draft_already_executed", { executed_at: draft.executed_at, executed_receipt_id: draft.executed_receipt_id });
  }

  // ── RUNTIME-12 A-16 fix · OS-level exclusive lock ────────────────
  // Atomic lock via fs.openSync(..., "wx") · guarantees at-most-one
  // /execute in flight for a given draft_id · TOCTOU-safe. The lock
  // MUST be released on every exit path below · we use try/finally.
  const lockRes = await acquireExecutionLock({ repo_root: process.cwd(), draft_id: body.draft_id });
  if (!lockRes.ok) {
    return refuse(409, "draft_execution_in_progress", { held_by_pid: lockRes.held_by_pid });
  }

  try {
    return await executeWithLock(body, draft, lockRes.release);
  } catch (e) {
    await lockRes.release();
    throw e;
  }
}

async function executeWithLock(
  body: { readonly draft_id?: string; readonly delegation?: FounderDelegationEnvelope },
  draft: NonNullable<Awaited<ReturnType<typeof loadDraft>>>,
  release: () => Promise<void>,
): Promise<Response> {
  const refuseInLock = async (status: number, error: string, extra: Record<string, unknown> = {}): Promise<Response> => {
    await release();
    return refuse(status, error, extra);
  };
  const okReturn = async (status: number, body: Record<string, unknown>): Promise<Response> => {
    await release();
    return NextResponse.json(body, { status });
  };

  if (!body.delegation) return refuseInLock(400, "missing_delegation");

  // ── Load NEX server identities ──────────────────────────────────────
  const repoRoot = process.cwd();
  const ids = await Promise.all([
    createOrLoadIdentity({ repoRoot, agent_id: HQ_NEX1_AGENT_ID, createIfMissing: true }),
    createOrLoadIdentity({ repoRoot, agent_id: HQ_NEX2_AGENT_ID, createIfMissing: true }),
    createOrLoadIdentity({ repoRoot, agent_id: HQ_SECURITY_AGENT_ID, createIfMissing: true }),
    createOrLoadIdentity({ repoRoot, agent_id: HQ_ORCHESTRATOR_AGENT_ID, createIfMissing: true }),
  ]);
  for (const r of ids) {
    if (!r.ok) return refuseInLock(500, "identity_load_failed", { reason: r.reason });
  }
  const [n1, n2, sec, orc] = ids.map((r) => (r.ok ? r.identity : null!));

  // ── RUNTIME-12 · trust-anchor lockdown ────────────────────────────────
  // Locked order (founder-locked 2026-09-14):
  //   1. Extract the CLAIMED founder public key from the incoming delegation.
  //   2. Check it is in the SERVER trusted-founder-key set (env var
  //      NEX_TRUSTED_FOUNDER_KEYS_HEX). If not → 403 · fail-closed.
  //   3. Only then verify the delegation signature using THAT trusted key.
  //
  // The delegation's own founder_public_key_der_hex is DATA to verify
  // against · never the trust anchor.
  const anchorCheck = checkFounderKeyTrusted(body.delegation.founder_public_key_der_hex);
  if (!anchorCheck.ok) {
    return refuseInLock(403, anchorCheck.reason, { detail: anchorCheck.detail });
  }
  // Verify signature using ONLY the trusted key (not the delegation's
  // claim). If the founder key set legitimately contains this specific
  // pubkey and the signature actually verifies against it, we proceed.
  const trustedFounderKeys: readonly string[] = [anchorCheck.trusted_key_hex];
  const delSigOk = verifyDelegationSignature(body.delegation, trustedFounderKeys);
  if (!delSigOk) return refuseInLock(403, "delegation_signature_invalid");

  // Delegation must be for programming.small_change
  if (!body.delegation.allowed.proposal_kinds.includes(CAP_KIND_PROGRAMMING_SMALL_CHANGE)) {
    return refuseInLock(403, "delegation_wrong_kind", { allowed_kinds: body.delegation.allowed.proposal_kinds });
  }
  // Delegate must be the HQ NEX1 identity
  if (body.delegation.delegate_agent_id !== HQ_NEX1_AGENT_ID) {
    return refuseInLock(403, "delegation_wrong_delegate", { expected: HQ_NEX1_AGENT_ID, got: body.delegation.delegate_agent_id });
  }
  if (body.delegation.delegate_public_key_der_hex !== n1.public_key_der_hex) {
    return refuseInLock(403, "delegation_wrong_delegate_key", { expected: n1.public_key_der_hex, got: body.delegation.delegate_public_key_der_hex });
  }
  // Delegation allowed_paths must exactly cover the drafted paths
  const draftedPaths = draft.authored_files.map((f) => f.path).sort();
  const allowedPaths = [...body.delegation.allowed.file_path_prefixes].sort();
  for (const p of draftedPaths) {
    const covered = allowedPaths.some((a) => p === a || p.startsWith(a));
    if (!covered) return refuseInLock(403, "delegation_scope_mismatch", { unauthorized_path: p, allowed_paths: allowedPaths });
  }

  // Persist delegation so downstream verifiers can load it
  await persistDelegation(body.delegation).catch(() => { /* idempotent */ });

  // ── Reconstruct authored files for the bridge ───────────────────────
  // Supports both M-01 (single impl + single test) and M-02+ (multi-file).
  const implsInDraft = draft.proposed_new_files.filter((f) => f.kind === "implementation");
  const testsInDraft = draft.proposed_new_files.filter((f) => f.kind === "test");
  if (implsInDraft.length === 0 || testsInDraft.length === 0) return refuseInLock(500, "draft_shape_invalid");
  const authored: Array<{ path: string; content: string; extension: "js"; kind: "implementation" | "test" }> = [];
  for (const spec of [...implsInDraft, ...testsInDraft]) {
    const full = draft.authored_files_full.find((f) => f.path === spec.path);
    if (!full) return refuseInLock(500, "authored_content_missing", { missing_path: spec.path });
    authored.push({ path: spec.path, content: full.content, extension: "js", kind: spec.kind });
  }
  const primaryImpl = implsInDraft[0];
  const testRunnerRel = draft.test_runner_relative_path;

  // ── Persist a CAP + engineering proposal on the fly ─────────────────
  const cap = await persistCapabilityGap({
    kind: CAP_KIND_PROGRAMMING_SMALL_CHANGE,
    category: "RELIABILITY", priority: "LOW",
    title: draft.title,
    evidence: [{ collection: "nex_programming_mission_drafts", record_id: draft.draft_id, kind: "programming_mission_draft" }],
    detector_agent_id: HQ_NEX1_AGENT_ID,
    dedupe_key: `${draft.draft_id}-${randomUUID()}`,
  });

  // Build the proposal record directly (avoid re-running NEX1 diagnose logic · we already have authored files)
  const allPaths = authored.map((a) => a.path);
  const scope = authorisedScopeForProgrammingMission(allPaths);
  const scopeHash = hashAuthorisedScope(scope);
  const proposalBase = {
    record_type: "NEX_CAP_ENGINEERING_PROPOSAL" as const,
    proposal_id: `CAP-PROP-${cap.cap_id}-${randomUUID().slice(0, 8)}`,
    cap_id: cap.cap_id,
    diagnosed_by_agent: HQ_NEX1_AGENT_ID,
    diagnosis: `Programming mission ${draft.mission_id} · ${draft.title} · algorithms=${[...new Set(implsInDraft.map((i) => i.function_spec.algorithm_kind))].join(",")} · style from ${draft.target_files_to_inspect.join(", ")}${draft.dependency_graph && draft.dependency_graph.cross_file_edge_count > 0 ? ` · dependency-chain detected (${draft.dependency_graph.cross_file_edge_count} edge${draft.dependency_graph.cross_file_edge_count === 1 ? "" : "s"})` : ""}`,
    proposed_fix_summary: `Write ${allPaths.length} file(s): ${allPaths.join(", ")} · total ${draft.authored_files.reduce((n, f) => n + f.bytes, 0)}B`,
    required_authority_scope: { authorised_tools: [], authorised_hosts: [], authorised_collections_write: [], requires_founder_signature: true },
    authorised_workstation_scope: scope,
    evidence_chain: [
      draft.draft_id,
      draft.nex1_inspection_evidence_id ?? "no-inspection-evidence",
      draft.mission_id,
    ],
    resolver_outcome: "PROPOSE" as const,
    founder_signature_slot: null,
    created_at: new Date().toISOString(),
  };
  const proposal: CapEngineeringProposal = { ...proposalBase, provenance_chain_hash: provenanceChainHash(proposalBase, []) };
  await getStorage().save(CAP_ENGINEERING_PROPOSAL_COLLECTION, proposal);

  // ── NEX signs a per-authorization envelope (its own identity · not founder) ──
  const authorization: DelegatedAuthorizationEnvelope = signDelegatedAuthorization({
    delegate_identity: n1,
    delegation: body.delegation,
    proposal,
    mission_id: draft.mission_id,
  });
  await persistDelegatedAuthorization(authorization).catch(() => { /* idempotent */ });

  // ── NEX2 + Security review the proposal ─────────────────────────────
  const nex2Review = await nex2ReviewProposal({ identity: n2, instance_id: `hq-nex2-${randomUUID().slice(0, 8)}`, proposal_id: proposal.proposal_id });
  const secReview = await securityReviewProposal({ identity: sec, instance_id: `hq-sec-${randomUUID().slice(0, 8)}`, proposal_id: proposal.proposal_id });

  // ── Founder direct-signature for the LEGACY receipt gate ─────────────
  // The delegation-model gate is what RUNTIME-10 actually consumes · this
  // legacy signature is only needed so assembleGateReceipt's
  // FOUNDER_AUTH_VALID gate can mark itself VALID under the old path.
  // Both paths verify the founder key · double-defence.
  // NOTE: We do NOT hold the founder private key. The workstation-side
  // WO-02 authority key IS server-generated for this MVP · that's the
  // internal workstation authority (WO-13 substrate-guarded pathway) ·
  // distinct from the founder-authority delegation.
  const workstationKp = generateKeyPair(`hq-ws-founder-${randomUUID().slice(0, 8)}`);
  const wsManifest: FounderKeyManifest = {
    version: "wo2.v0.1",
    keys: [buildFounderKeyRecordForTest(workstationKp, { validFrom: "2020-01-01T00:00:00.000Z" })],
  };

  // The Orchestrator's legacy FOUNDER_AUTH_VALID gate needs a direct
  // founder signature over the proposal's canonical payload. Since NEX
  // never holds the founder private key, we CANNOT produce this. We
  // need to invert the Orchestrator receipt to use the delegation path
  // instead. Fortunately RUNTIME-08 already exposes
  // `computeFounderAuthGateDelegated` and assembleGateReceipt accepts
  // `{ delegation, authorization }` in place of `founder_signature_hex`.
  const receipt: OrchestratorGateReceipt = await assembleGateReceipt({
    identity: orc,
    instance_id: `hq-orc-${randomUUID().slice(0, 8)}`,
    proposal_id: proposal.proposal_id,
    delegation: body.delegation,
    authorization,
    trusted_founder_public_keys_hex: trustedFounderKeys,
  });
  if (receipt.overall_verdict !== "WORKSTATION_ALLOWED") {
    await markDraftExecuted(draft, { executed_at: new Date().toISOString(), executed_receipt_id: null });
    return refuseInLock(403, "orchestrator_receipt_blocked", {
      overall_verdict: receipt.overall_verdict,
      reason: receipt.reason_summary,
      nex2_verdict: nex2Review.verdict,
      security_verdict: secReview.verdict,
    });
  }

  // ── Execute through RUNTIME-10 with programming-mission bridge ──────
  const wsResult = await executeThroughWorkstation({
    receipt,
    delegation: body.delegation,
    authorization,
    proposal,
    cap,
    trusted_founder_public_keys_hex: trustedFounderKeys,
    trusted_orchestrator_public_keys_der_hex: [orc.public_key_der_hex],
    workspace_root: draft.workspace_root,
    workstation_authority: { workstation_founder_keypair: workstationKp, founder_key_manifest: wsManifest },
    repo_root: repoRoot,
    http_port: 42000 + Math.floor(Math.random() * 5000),
    environment: "TEST",
    requester_identity: orc,
    bridge_factory: {
      build: async (a) => buildProgrammingMissionBridge({
        cap, proposal,
        workstation_trace_id: a.workstation_trace_id,
        workspace_root: a.workspace_root,
        authority: a.workstation_authority,
        repo_root: a.repo_root,
        nex1_execution_instance_id: a.nex1_execution_instance_id,
        authored_files: authored,
        test_runner_relative_path: testRunnerRel,
      }),
      verifiers: (v) => verifiersForProgrammingMission({
        workspace_root: v.workspace_root,
        authored_file_paths: authored.map((f) => f.path),
      }),
    },
  });

  await markDraftExecuted(draft, {
    executed_at: new Date().toISOString(),
    executed_receipt_id: wsResult.attestation.attestation_id,
  });

  const stages = wsResult.cap_execution?.attempt.stages_executed ?? [];
  const wo04 = stages.find((s) => s.stage === "WO-04");
  const wo05 = stages.find((s) => s.stage === "WO-05");
  const wo07 = stages.find((s) => s.stage === "WO-07");

  return okReturn(wsResult.verdict === "EXECUTED" ? 200 : 403, {
    ok: wsResult.verdict === "EXECUTED",
    workstation_verdict: wsResult.verdict,
    reason: wsResult.reason_summary,
    draft_id: draft.draft_id,
    mission_id: draft.mission_id,
    receipt_id: receipt.receipt_id,
    attestation_id: wsResult.attestation.attestation_id,
    twelve_link_evidence: {
      link_1_mission_record_id: draft.mission_id,
      link_2_nex1_inspection_evidence_id: draft.nex1_inspection_evidence_id,
      link_3_proposal_record_id: proposal.proposal_id,
      link_4_authorised_diff_bundle_id: wo04?.evidence_ref?.replace(/^wo4-report:/, "").replace(/:unpersisted$/, "") ?? null,
      link_5_delegated_authorization_id: authorization.authorization_id,
      link_6_workstation_gate_receipt_id: receipt.receipt_id,
      link_7_wo04_execution_report_id: wo04?.ok ? wo04.evidence_ref : null,
      link_8_wo05_build_report_id: wo05?.ok ? wo05.evidence_ref : null,
      link_9_wo07_test_report_id: wo07?.ok ? wo07.evidence_ref : null,
      link_10_nex2_review_id: nex2Review.review_id,
      link_11_security_veto_id: secReview.veto_id,
      link_12_workstation_execution_attestation_id: wsResult.attestation.attestation_id,
    },
    stage_summary: {
      nex2_review: nex2Review.verdict,
      security_verdict: secReview.verdict,
      orchestrator_receipt: receipt.overall_verdict,
      wo04: wo04?.ok ? "PASSED" : (wo04 ? "FAILED" : "NOT_REACHED"),
      wo05: wo05?.ok ? "PASSED" : (wo05 ? "FAILED" : "NOT_REACHED"),
      wo07: wo07?.ok ? "PASSED" : (wo07 ? "FAILED" : "NOT_REACHED"),
      workstation_attestation: wsResult.verdict,
    },
  });
}

export async function GET(): Promise<Response> {
  return NextResponse.json({
    error: "method_not_allowed",
    note: "POST { draft_id, delegation } to execute a drafted mission. The delegation must be founder-signed offline via scripts/nex-founder-sign-delegation.mjs.",
  }, { status: 405 });
}
