// WO-NEX-RUNTIME-11 · programming mission orchestrator.
//
// Founder-locked 2026-09-14. This is where the workforce actually
// programs. The orchestrator:
//   1. Persists the mission brief (link 1)
//   2. NEX1 reads target files → inspects style (link 2 · signed evidence)
//   3. NEX1 authors real bytes deterministically (via code-authoring)
//   4. Persists a CapEngineeringProposal with authored evidence (link 3)
//   5. NEX2 reviews the proposal (link 10)
//   6. Security clears (link 11)
//   7. Founder signs delegation offline · NEX1 signs authorization (link 5)
//   8. Orchestrator assembles gate receipt (link 6)
//   9. Hands off to RUNTIME-10 workstation integration with the
//      programming-mission bridge · which runs real WO-01..WO-09 →
//      producing WO-04 execution report (link 7), WO-05 build report
//      (link 8), WO-07 syntax specialist (link 9), and RUNTIME-10
//      signed attestation (link 12)
//  10. Assembles a signed ProgrammingMissionCompletionReceipt
//      with all 12 links · only VERIFIED_END_TO_END iff every link is
//      non-null and every stage passed.
//
// Founder rule (locked): "SUCCESS" language is BANNED when any required
// stage is NOT_VERIFIED / MISSING / EXPIRED.

import {
  randomUUID,
  sign as ed25519Sign,
  createPublicKey,
  verify as ed25519Verify,
} from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import { signEvidence, type AgentEvidenceRecord } from "@/lib/nex-agent-runtime/process/identity";
import { AGENT_EVIDENCE_COLLECTION } from "@/lib/nex-agent-runtime/process/types";
import type { FounderDelegationEnvelope, DelegatedAuthorizationEnvelope } from "@/lib/nex-agent-runtime/founder-authority/types";
import type { OrchestratorGateReceipt } from "@/lib/nex-agent-runtime/orchestrator/types";
import { executeThroughWorkstation } from "@/lib/nex-agent-runtime/workstation-integration/execute";
import type { CapabilityGap } from "@/lib/nex-cap/types";
import type { CapEngineeringProposal } from "@/lib/nex-cap/nex1-engineer";
import {
  CAP_KIND_PROGRAMMING_SMALL_CHANGE,
  buildProgrammingMissionBridge,
  verifiersForProgrammingMission,
  type CapWorkstationAuthorityInput,
} from "@/lib/nex-cap/cap-spec-bridge";
import { inspectWorkspaceStyle } from "./style-inspector";
import { authorProgrammingChange } from "./code-authoring";
import {
  type ProgrammingMissionBrief,
  type ProgrammingMissionCompletionReceipt,
  type ProgrammingMissionVerdict,
  type TwelveEvidenceLinks,
  PROGRAMMING_MISSION_COMPLETION_COLLECTION,
  PROGRAMMING_MISSION_BRIEF_COLLECTION,
  PROGRAMMING_MISSION_INSPECTION_COLLECTION,
  allTwelveLinksPresent,
} from "./types";

// ── Canonical serialisation of the completion receipt ──────────────────

function canonicaliseReceipt(r: Omit<ProgrammingMissionCompletionReceipt, "signature_hex">): Buffer {
  const ordered = {
    record_type: r.record_type,
    receipt_id: r.receipt_id,
    mission_id: r.mission_id,
    title: r.title,
    verdict: r.verdict,
    links: {
      link_1_mission_record_id: r.links.link_1_mission_record_id,
      link_2_nex1_inspection_evidence_id: r.links.link_2_nex1_inspection_evidence_id,
      link_3_proposal_record_id: r.links.link_3_proposal_record_id,
      link_4_authorised_diff_bundle_id: r.links.link_4_authorised_diff_bundle_id,
      link_5_delegated_authorization_id: r.links.link_5_delegated_authorization_id,
      link_6_workstation_gate_receipt_id: r.links.link_6_workstation_gate_receipt_id,
      link_7_wo04_execution_report_id: r.links.link_7_wo04_execution_report_id,
      link_8_wo05_build_report_id: r.links.link_8_wo05_build_report_id,
      link_9_wo07_test_report_id: r.links.link_9_wo07_test_report_id,
      link_10_nex2_review_id: r.links.link_10_nex2_review_id,
      link_11_security_veto_id: r.links.link_11_security_veto_id,
      link_12_workstation_execution_attestation_id: r.links.link_12_workstation_execution_attestation_id,
    },
    stage_summary: r.stage_summary,
    reason_summary: r.reason_summary,
    attempted_at: r.attempted_at,
    finished_at: r.finished_at,
    requester_agent_id: r.requester_agent_id,
    requester_public_key_der_hex: r.requester_public_key_der_hex,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

export function verifyProgrammingMissionReceipt(r: ProgrammingMissionCompletionReceipt): boolean {
  try {
    const { signature_hex: _drop, ...base } = r;
    void _drop;
    const pub = createPublicKey({ key: Buffer.from(r.requester_public_key_der_hex, "hex"), format: "der", type: "spki" });
    return ed25519Verify(null, canonicaliseReceipt(base), pub, Buffer.from(r.signature_hex, "hex"));
  } catch {
    return false;
  }
}

// ── Public API · execute a programming mission end-to-end ─────────────

export interface ExecuteProgrammingMissionInput {
  readonly brief: ProgrammingMissionBrief;
  readonly requester_identity: AgentIdentity;         // will sign the completion receipt
  readonly nex1_identity: AgentIdentity;              // real NEX1 daemon identity
  readonly nex1_instance_id: string;
  readonly nex2_identity: AgentIdentity;
  readonly nex2_instance_id: string;
  readonly security_identity: AgentIdentity;
  readonly security_instance_id: string;
  readonly orchestrator_identity: AgentIdentity;
  readonly orchestrator_instance_id: string;
  readonly founder_public_key_hex: string;
  readonly founder_private_key_pkcs8_hex: string;      // OFFLINE in production; injected for test
  readonly workstation_authority: CapWorkstationAuthorityInput;
  readonly repo_root: string;
  readonly environment: "PRODUCTION_WORKFORCE" | "TEST" | "SIMULATION" | "FIXTURE" | "DEVELOPMENT";
}

export interface ExecuteProgrammingMissionResult {
  readonly receipt: ProgrammingMissionCompletionReceipt;
}

export async function executeProgrammingMission(
  input: ExecuteProgrammingMissionInput,
): Promise<ExecuteProgrammingMissionResult> {
  const attempted_at = new Date().toISOString();
  const links: {
    link_1_mission_record_id: string | null;
    link_2_nex1_inspection_evidence_id: string | null;
    link_3_proposal_record_id: string | null;
    link_4_authorised_diff_bundle_id: string | null;
    link_5_delegated_authorization_id: string | null;
    link_6_workstation_gate_receipt_id: string | null;
    link_7_wo04_execution_report_id: string | null;
    link_8_wo05_build_report_id: string | null;
    link_9_wo07_test_report_id: string | null;
    link_10_nex2_review_id: string | null;
    link_11_security_veto_id: string | null;
    link_12_workstation_execution_attestation_id: string | null;
  } = {
    link_1_mission_record_id: null,
    link_2_nex1_inspection_evidence_id: null,
    link_3_proposal_record_id: null,
    link_4_authorised_diff_bundle_id: null,
    link_5_delegated_authorization_id: null,
    link_6_workstation_gate_receipt_id: null,
    link_7_wo04_execution_report_id: null,
    link_8_wo05_build_report_id: null,
    link_9_wo07_test_report_id: null,
    link_10_nex2_review_id: null,
    link_11_security_veto_id: null,
    link_12_workstation_execution_attestation_id: null,
  };
  const stageSummary: ProgrammingMissionCompletionReceipt["stage_summary"] = {
    nex1_inspection: "NOT_REACHED",
    code_authored: "NOT_REACHED",
    proposal_valid: "NOT_REACHED",
    delegation_authorised: "NOT_REACHED",
    orchestrator_receipt: "NOT_REACHED",
    wo04_broker_write: "NOT_REACHED",
    wo05_build: "NOT_REACHED",
    wo07_tests: "NOT_REACHED",
    nex2_review: "NOT_REACHED",
    security_verdict: "NOT_REACHED",
    workstation_attestation: "NOT_REACHED",
  };
  const stages: Partial<Record<keyof typeof stageSummary, ProgrammingMissionCompletionReceipt["stage_summary"][keyof ProgrammingMissionCompletionReceipt["stage_summary"]]>> = {};

  const finalise = async (
    verdict: ProgrammingMissionVerdict,
    reason_summary: string,
  ): Promise<ExecuteProgrammingMissionResult> => {
    const finished_at = new Date().toISOString();
    const twelve: TwelveEvidenceLinks = Object.freeze({ ...links });
    const base: Omit<ProgrammingMissionCompletionReceipt, "signature_hex"> = {
      record_type: "NEX_PROGRAMMING_MISSION_COMPLETION_RECEIPT",
      receipt_id: `PROG-RCPT-${randomUUID()}`,
      mission_id: input.brief.mission_id,
      title: input.brief.title,
      verdict,
      links: twelve,
      stage_summary: {
        nex1_inspection: stages.nex1_inspection as ProgrammingMissionCompletionReceipt["stage_summary"]["nex1_inspection"] ?? "NOT_REACHED",
        code_authored: stages.code_authored as ProgrammingMissionCompletionReceipt["stage_summary"]["code_authored"] ?? "NOT_REACHED",
        proposal_valid: stages.proposal_valid as ProgrammingMissionCompletionReceipt["stage_summary"]["proposal_valid"] ?? "NOT_REACHED",
        delegation_authorised: stages.delegation_authorised as ProgrammingMissionCompletionReceipt["stage_summary"]["delegation_authorised"] ?? "NOT_REACHED",
        orchestrator_receipt: stages.orchestrator_receipt as ProgrammingMissionCompletionReceipt["stage_summary"]["orchestrator_receipt"] ?? "NOT_REACHED",
        wo04_broker_write: stages.wo04_broker_write as ProgrammingMissionCompletionReceipt["stage_summary"]["wo04_broker_write"] ?? "NOT_REACHED",
        wo05_build: stages.wo05_build as ProgrammingMissionCompletionReceipt["stage_summary"]["wo05_build"] ?? "NOT_REACHED",
        wo07_tests: stages.wo07_tests as ProgrammingMissionCompletionReceipt["stage_summary"]["wo07_tests"] ?? "NOT_REACHED",
        nex2_review: stages.nex2_review as ProgrammingMissionCompletionReceipt["stage_summary"]["nex2_review"] ?? "NOT_REACHED",
        security_verdict: stages.security_verdict as ProgrammingMissionCompletionReceipt["stage_summary"]["security_verdict"] ?? "NOT_REACHED",
        workstation_attestation: stages.workstation_attestation as ProgrammingMissionCompletionReceipt["stage_summary"]["workstation_attestation"] ?? "NOT_REACHED",
      },
      reason_summary,
      attempted_at,
      finished_at,
      requester_agent_id: input.requester_identity.agent_id,
      requester_public_key_der_hex: input.requester_identity.public_key_der_hex,
    };
    // Defensive: if verdict claims VERIFIED_END_TO_END but any link is
    // missing, forcibly downgrade to NOT_VERIFIED_EVIDENCE_INCOMPLETE.
    // Founder-locked rule: "SUCCESS" language banned when any required
    // stage is NOT_VERIFIED.
    const actualVerdict: ProgrammingMissionVerdict =
      verdict === "VERIFIED_END_TO_END" && !allTwelveLinksPresent(twelve)
        ? "NOT_VERIFIED_EVIDENCE_INCOMPLETE"
        : verdict;
    const baseFinal = { ...base, verdict: actualVerdict };
    const sig = ed25519Sign(null, canonicaliseReceipt(baseFinal), input.requester_identity.private).toString("hex");
    const receipt: ProgrammingMissionCompletionReceipt = { ...baseFinal, signature_hex: sig };
    await getStorage().save(PROGRAMMING_MISSION_COMPLETION_COLLECTION, receipt);
    return { receipt };
  };

  // ── Link 1 · persist mission brief ──────────────────────────────────
  await getStorage().save(PROGRAMMING_MISSION_BRIEF_COLLECTION, {
    record_type: "NEX_PROGRAMMING_MISSION_BRIEF",
    ...input.brief,
    persisted_at: new Date().toISOString(),
  });
  links.link_1_mission_record_id = input.brief.mission_id;

  // ── Link 2 · NEX1 inspects target files ─────────────────────────────
  const inspection = await inspectWorkspaceStyle({
    workspace_root: input.brief.workspace_root,
    file_paths: input.brief.target_files_to_inspect,
  });
  if (!inspection.ok) {
    stages.nex1_inspection = "FAILED";
    return finalise("NOT_VERIFIED_INSPECTION_FAILED", `NEX1 could not inspect target files: ${inspection.reason}`);
  }
  stages.nex1_inspection = "PASSED";
  // Persist signed inspection evidence · NEX1 identity signs
  const inspectionEvidence: Omit<AgentEvidenceRecord, "signature_hex"> = {
    record_type: "NEX_AGENT_EVIDENCE",
    evidence_id: `NEX1-INSPECT-${randomUUID()}`,
    agent_id: input.nex1_identity.agent_id,
    instance_id: input.nex1_instance_id,
    mission_id: input.brief.mission_id,
    emitted_at: new Date().toISOString(),
    kind: "programming_mission_inspection",
    payload: {
      workspace_root: input.brief.workspace_root,
      files_read: inspection.file_contents_read,
      style_detected: inspection.style,
      detection_confidence: inspection.style.detection_confidence,
    },
  };
  const signedInspection = signEvidence(input.nex1_identity, inspectionEvidence);
  await getStorage().save(AGENT_EVIDENCE_COLLECTION, signedInspection);
  await getStorage().save(PROGRAMMING_MISSION_INSPECTION_COLLECTION, signedInspection);
  links.link_2_nex1_inspection_evidence_id = signedInspection.evidence_id;

  // ── Link 3 · NEX1 authors real bytes deterministically ──────────────
  // For this first-proof, the brief supplies pairs of implementation+test
  // paths. NEX1 authors both from the FunctionSpec + detected style.
  const authored: Array<{
    path: string;
    content: string;
    extension: "ts" | "tsx" | "js" | "json" | "md" | "css" | "txt";
    kind: "implementation" | "test";
  }> = [];
  const implFile = input.brief.proposed_new_files.find((f) => f.kind === "implementation");
  const testFile = input.brief.proposed_new_files.find((f) => f.kind === "test");
  if (!implFile || !testFile) {
    stages.code_authored = "FAILED";
    return finalise("REFUSED_MISSION_INVALID", "brief must specify exactly one implementation + one test file");
  }
  const authoring = await authorProgrammingChange({
    spec: implFile.function_spec,
    style: inspection.style,
    implementation_path: implFile.path,
    test_path: testFile.path,
  });
  if (!authoring.ok) {
    stages.code_authored = "FAILED";
    return finalise("NOT_VERIFIED_AUTHORING_FAILED", `code authoring failed: ${authoring.reason}`);
  }
  stages.code_authored = "PASSED";
  authored.push({ path: authoring.implementation.path, content: authoring.implementation.content, extension: authoring.implementation.extension, kind: "implementation" });
  authored.push({ path: authoring.test.path, content: authoring.test.content, extension: authoring.test.extension, kind: "test" });

  // ── Create CAP + NEX1 proposal + attach founder-signed scope ────────
  const { persistCapabilityGap } = await import("@/lib/nex-cap/registry");
  const cap = await persistCapabilityGap({
    kind: CAP_KIND_PROGRAMMING_SMALL_CHANGE,
    category: "RELIABILITY",
    priority: "LOW",
    title: input.brief.title,
    evidence: [{ collection: PROGRAMMING_MISSION_BRIEF_COLLECTION, record_id: input.brief.mission_id, kind: "programming_mission_brief" }],
    detector_agent_id: input.requester_identity.agent_id,
    dedupe_key: `${input.brief.mission_id}-${randomUUID()}`,
  });
  const { nex1EngineerProposeFor, attachWorkstationScopeToProposal, founderSignProposal } = await import("@/lib/nex-cap/nex1-engineer");
  const { authorisedScopeForProgrammingMission } = await import("@/lib/nex-cap/cap-spec-bridge");
  const nex1Res = await nex1EngineerProposeFor(cap);
  if (!nex1Res.proposal) {
    stages.proposal_valid = "FAILED";
    return finalise("NOT_VERIFIED_PROPOSAL_INVALID", `NEX1 refused to propose: ${nex1Res.reason}`);
  }
  const scope = authorisedScopeForProgrammingMission([implFile.path, testFile.path]);
  const scoped = await attachWorkstationScopeToProposal({ proposal_id: nex1Res.proposal.proposal_id, scope });
  if (!scoped) {
    stages.proposal_valid = "FAILED";
    return finalise("NOT_VERIFIED_PROPOSAL_INVALID", "scope attach failed");
  }
  stages.proposal_valid = "PASSED";
  links.link_3_proposal_record_id = scoped.proposal_id;

  // ── NEX2 reviews the proposal ────────────────────────────────────────
  const { nex2ReviewProposal } = await import("@/lib/nex-agent-runtime/nex2/review");
  const nex2Review = await nex2ReviewProposal({
    identity: input.nex2_identity,
    instance_id: input.nex2_instance_id,
    proposal_id: scoped.proposal_id,
  });
  if (nex2Review.verdict === "INDEPENDENTLY_VERIFIED") {
    stages.nex2_review = "INDEPENDENTLY_VERIFIED";
    links.link_10_nex2_review_id = nex2Review.review_id;
  } else {
    stages.nex2_review = "REJECTED";
    links.link_10_nex2_review_id = nex2Review.review_id;
    return finalise("NOT_VERIFIED_NEX2_REJECTED", `NEX2 verdict=${nex2Review.verdict}: ${nex2Review.findings.map((f) => f.detail).join(" · ").slice(0, 300)}`);
  }

  // ── Security reviews the proposal ────────────────────────────────────
  const { securityReviewProposal } = await import("@/lib/nex-agent-runtime/security/review");
  const secVeto = await securityReviewProposal({
    identity: input.security_identity,
    instance_id: input.security_instance_id,
    proposal_id: scoped.proposal_id,
  });
  if (secVeto.verdict === "CLEARED") {
    stages.security_verdict = "CLEARED";
    links.link_11_security_veto_id = secVeto.veto_id;
  } else {
    stages.security_verdict = "REJECTED";
    links.link_11_security_veto_id = secVeto.veto_id;
    return finalise("NOT_VERIFIED_SECURITY_REJECTED", `Security ${secVeto.verdict}: ${secVeto.findings.map((f) => f.detail).join(" · ").slice(0, 300)}`);
  }

  // ── Founder delegation + NEX authorization ──────────────────────────
  const { signFounderDelegation } = await import("@/lib/nex-agent-runtime/founder-authority/delegation");
  const { signDelegatedAuthorization } = await import("@/lib/nex-agent-runtime/founder-authority/authorization");
  const delegation: FounderDelegationEnvelope = signFounderDelegation({
    delegate_agent_id: input.nex1_identity.agent_id,
    delegate_public_key_der_hex: input.nex1_identity.public_key_der_hex,
    allowed: {
      proposal_kinds: [CAP_KIND_PROGRAMMING_SMALL_CHANGE],
      file_path_prefixes: [implFile.path, testFile.path],
      stages_allowed: ["WO-01", "WO-04", "WO-05", "WO-06", "WO-07", "WO-08", "WO-09"],
      max_risk_level: "LOW",
      mission_ids_allowed: [input.brief.mission_id],
      cap_ids_allowed: [],
    },
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    founder_public_key_der_hex: input.founder_public_key_hex,
    founder_private_key_pkcs8_hex: input.founder_private_key_pkcs8_hex,
  });
  const authorization: DelegatedAuthorizationEnvelope = signDelegatedAuthorization({
    delegate_identity: input.nex1_identity,
    delegation,
    proposal: scoped,
    mission_id: input.brief.mission_id,
  });
  stages.delegation_authorised = "PASSED";
  links.link_5_delegated_authorization_id = authorization.authorization_id;

  // ── Orchestrator assembles receipt ──────────────────────────────────
  const { assembleGateReceipt } = await import("@/lib/nex-agent-runtime/orchestrator/orchestrator");
  // Orchestrator receipt still needs a direct founder signature on the
  // legacy path for the FOUNDER_AUTH_VALID gate. RUNTIME-08 delegation
  // model is what RUNTIME-10 actually consumes · they are complementary.
  const founderSig = await founderSignProposal({ proposal: scoped, founder_private_key_hex: input.founder_private_key_pkcs8_hex });
  const receipt: OrchestratorGateReceipt = await assembleGateReceipt({
    identity: input.orchestrator_identity,
    instance_id: input.orchestrator_instance_id,
    proposal_id: scoped.proposal_id,
    founder_signature_hex: founderSig,
    trusted_founder_public_keys_hex: [input.founder_public_key_hex],
  });
  links.link_6_workstation_gate_receipt_id = receipt.receipt_id;
  stages.orchestrator_receipt = receipt.overall_verdict;
  if (receipt.overall_verdict !== "WORKSTATION_ALLOWED") {
    return finalise("NOT_VERIFIED_RECEIPT_NOT_ALLOWED", `Orchestrator receipt ${receipt.overall_verdict}: ${receipt.reason_summary}`);
  }

  // ── Hand off to RUNTIME-10 with programming-mission bridge ──────────
  const port = 42000 + Math.floor(Math.random() * 5000);
  const wsResult = await executeThroughWorkstation({
    receipt,
    delegation,
    authorization,
    proposal: scoped,
    cap,
    trusted_founder_public_keys_hex: [input.founder_public_key_hex],
    trusted_orchestrator_public_keys_der_hex: [input.orchestrator_identity.public_key_der_hex],
    workspace_root: input.brief.workspace_root,
    workstation_authority: input.workstation_authority,
    repo_root: input.repo_root,
    http_port: port,
    environment: input.environment,
    requester_identity: input.requester_identity,
    bridge_factory: {
      build: async (a) =>
        buildProgrammingMissionBridge({
          cap,
          proposal: scoped,
          workstation_trace_id: a.workstation_trace_id,
          workspace_root: a.workspace_root,
          authority: a.workstation_authority,
          repo_root: a.repo_root,
          nex1_execution_instance_id: a.nex1_execution_instance_id,
          authored_files: authored,
          test_runner_relative_path: testFile.path,
        }),
      verifiers: (v) =>
        verifiersForProgrammingMission({
          workspace_root: v.workspace_root,
          authored_file_paths: authored.map((f) => f.path),
        }),
    },
  });
  links.link_12_workstation_execution_attestation_id = wsResult.attestation.attestation_id;
  if (wsResult.verdict !== "EXECUTED") {
    stages.workstation_attestation = "REFUSED";
    return finalise("NOT_VERIFIED_WORKSTATION_REFUSED", `RUNTIME-10 refused: ${wsResult.reason_summary}`);
  }
  stages.workstation_attestation = "EXECUTED";

  // Pull WO-* evidence IDs from the CAP execution attempt
  const exec = wsResult.cap_execution;
  if (!exec) {
    return finalise("NOT_VERIFIED_WORKSTATION_REFUSED", "RUNTIME-10 reported EXECUTED but no cap_execution result");
  }
  const stagesRan = exec.attempt.stages_executed;
  const wo04 = stagesRan.find((s) => s.stage === "WO-04");
  const wo05 = stagesRan.find((s) => s.stage === "WO-05");
  const wo07 = stagesRan.find((s) => s.stage === "WO-07");
  if (wo04?.ok) { stages.wo04_broker_write = "PASSED"; links.link_7_wo04_execution_report_id = wo04.evidence_ref; } else { stages.wo04_broker_write = "FAILED"; }
  if (wo05?.ok) { stages.wo05_build = "PASSED"; links.link_8_wo05_build_report_id = wo05.evidence_ref; } else { stages.wo05_build = "FAILED"; }
  if (wo07?.ok) { stages.wo07_tests = "PASSED"; links.link_9_wo07_test_report_id = wo07.evidence_ref; } else { stages.wo07_tests = "FAILED"; }

  // Extract authorised diff bundle id from wo04 evidence_ref format `wo4-report:<id>`
  if (wo04?.evidence_ref?.startsWith("wo4-report:")) {
    links.link_4_authorised_diff_bundle_id = wo04.evidence_ref.replace(/^wo4-report:/, "").replace(/:unpersisted$/, "");
  }

  if (!wo05?.ok) return finalise("NOT_VERIFIED_BUILD_FAILED", `WO-05 did not succeed: ${wo05?.reason ?? "no WO-05 record"}`);
  if (!wo07?.ok) return finalise("NOT_VERIFIED_TESTS_FAILED", `WO-07 syntax specialist did not succeed: ${wo07?.reason ?? "no WO-07 record"}`);
  if (!wo04?.ok) return finalise("NOT_VERIFIED_WORKSTATION_REFUSED", `WO-04 did not succeed: ${wo04?.reason ?? "no WO-04 record"}`);

  // All 12 links must be non-null AND all stage checks passed. The
  // finalise() function will forcibly downgrade to NOT_VERIFIED_EVIDENCE
  // if any link is null · defence in depth.
  const allLinks = allTwelveLinksPresent(links);
  if (!allLinks) return finalise("NOT_VERIFIED_EVIDENCE_INCOMPLETE", "one or more of the 12 evidence links is missing");

  return finalise(
    "VERIFIED_END_TO_END",
    `RUNTIME-11 mission ${input.brief.mission_id} · 12 evidence links present · every stage passed · signed`,
  );
}
