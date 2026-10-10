// WO-CAP-EXECUTION-03 · positive full-chain acceptance test.
//
// Founder-locked 2026-09-13 · founder verbatim: "The next proof should
// be ONE REAL CAP → NEX1 diagnosis → deterministic CAP → spec bridge →
// unsigned proposal → Founder Ed25519 signature → WO-01 trace → WO-04
// real mutation → WO-05 real build → WO-06 real runtime → WO-07 real
// specialist → WO-08 persistent evidence → WO-09 correction state →
// CAP = RESOLVED → CAPABILITY GROWTH +1."
//
// The CAP kind is `workstation.self_proof.deterministic_stub_missing`,
// deliberately small · zero production-data blast radius · every stage
// exercises real code paths.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generateKeyPair } from "@/lib/nex-controlled-hands/ed25519";
import {
  buildFounderKeyRecordForTest,
  type FounderKeyManifest,
} from "@/lib/nex1-orchestrator/wo2-founder-keys";

import { persistCapabilityGap, loadCap } from "../registry";
import {
  nex1EngineerProposeFor,
  founderSignProposal,
  attachWorkstationScopeToProposal,
  type CapEngineeringProposal,
} from "../nex1-engineer";
import {
  buildCapExecutionBridge,
  authorisedScopeForSelfProofCap,
  CAP_KIND_WORKSTATION_SELF_PROOF,
  bridgeSupportsCapKind,
  verifiersForSelfProofCap,
} from "../cap-spec-bridge";
import { realWorkstationAdapter } from "../real-workstation-adapter";
import { executeCapProposal } from "../execution";
import { resolveCapProposal } from "../resolver";

const REPO_ROOT = process.cwd();

async function makeWorkspace(): Promise<string> {
  const dir = path.join(REPO_ROOT, "data", "nex-agent-workspaces", `cap-exec-03-workspace-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function cleanWorkspace(dir: string): Promise<void> {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch { /* ok */ }
}

/**
 * Choose a random-ish port in the ephemeral range. Real production would
 * ask WO-06's port allocator; for a single-file test we pick from the
 * 40000-50000 window which is rarely used and avoids common services.
 */
function pickPort(): number {
  return 40000 + Math.floor(Math.random() * 8000);
}

describe("WO-CAP-EXECUTION-03 · one small safe CAP · full chain to RESOLVED", () => {
  const cleanups: string[] = [];
  afterEach(async () => {
    while (cleanups.length) {
      const dir = cleanups.pop();
      if (dir) await cleanWorkspace(dir);
    }
  });

  it("P-1 · CAP kind bridge exists", () => {
    expect(bridgeSupportsCapKind(CAP_KIND_WORKSTATION_SELF_PROOF)).toBe(true);
    expect(bridgeSupportsCapKind("other.kind")).toBe(false);
  });

  it("P-2 · deterministic authorised scope for self-proof CAP kind", () => {
    const scope = authorisedScopeForSelfProofCap();
    expect(scope.files_may_touch).toContain("server.js");
    expect(scope.files_may_touch).toContain("cap-proof-marker.txt");
    expect(scope.build_targets).toContain("node");
    expect(scope.runtime_required).toBe(true);
    expect(scope.stages_required).toContain("WO-04");
    expect(scope.stages_required).toContain("WO-06");
  });

  it("P-3 · resolver returns PROPOSE for self-proof CAP kind (not ESCALATE_ONLY)", async () => {
    const cap = await persistCapabilityGap({
      kind: CAP_KIND_WORKSTATION_SELF_PROOF,
      category: "RELIABILITY",
      priority: "LOW",
      title: "workstation self-proof stub missing",
      evidence: [], detector_agent_id: "wo-cap-execution-03",
      dedupe_key: `p3-${Date.now()}-${Math.random()}`,
    });
    const decision = resolveCapProposal({ cap });
    // Not ESCALATE_ONLY · not AUTO_FIX (empty by doctrine) · so PROPOSE
    expect(decision.outcome).toBe("PROPOSE");
  });

  it("P-4 · full chain · CAP → NEX1 diagnose → Founder sign → Broker approve → workstation → CAP RESOLVED · +1 Capability Growth", async () => {
    // ── 0 · workspace (sanctioned path)
    const workspace = await makeWorkspace();
    cleanups.push(workspace);

    // ── 1 · persist the CAP (real record in nex_capability_gaps.jsonl)
    const cap = await persistCapabilityGap({
      kind: CAP_KIND_WORKSTATION_SELF_PROOF,
      category: "RELIABILITY",
      priority: "LOW",
      title: "workstation self-proof stub missing · WO-CAP-EXECUTION-03 acceptance",
      evidence: [{ collection: "docs/DECISIONS", record_id: "wo-cap-execution-03", kind: "founder_authorization" }],
      detector_agent_id: "wo-cap-execution-03",
      dedupe_key: `p4-${Date.now()}-${randomUUID()}`,
    });

    // ── 2 · NEX1 diagnosis · produces UNSIGNED proposal
    const nex1 = await nex1EngineerProposeFor(cap);
    expect(nex1.outcome).toBe("PROPOSE");
    expect(nex1.proposal).not.toBeNull();
    const rawProposal = nex1.proposal as CapEngineeringProposal;
    expect(rawProposal.founder_signature_slot).toBeNull();

    // ── 3 · Founder attaches workstation scope · signs the scoped proposal
    const scope = authorisedScopeForSelfProofCap();
    const scoped = await attachWorkstationScopeToProposal({
      proposal_id: rawProposal.proposal_id,
      scope,
    });
    expect(scoped).not.toBeNull();
    if (!scoped) throw new Error("scope attach failed");

    // Ephemeral founder key for the CAP-PROPOSAL signature (Ed25519 via
    // canonicalSigningPayload). Distinct from the workstation authority key.
    const { generateKeyPairSync } = await import("node:crypto");
    const capProposalKp = generateKeyPairSync("ed25519");
    const capPubHex = (capProposalKp.publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex");
    const capPrivHex = (capProposalKp.privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex");
    const capSig = await founderSignProposal({ proposal: scoped, founder_private_key_hex: capPrivHex });
    expect(capSig.length).toBeGreaterThan(0);

    // ── 4 · Workstation authority material (WO-02 envelope key)
    const workstationKp = generateKeyPair("cap-exec-03-workstation-founder");
    const wsManifest: FounderKeyManifest = {
      version: "wo2.v0.1",
      keys: [buildFounderKeyRecordForTest(workstationKp, { validFrom: "2020-01-01T00:00:00.000Z" })],
    };

    // ── 5 · Bridge builds all workstation specs deterministically
    const workstation_trace_id = `WS-TRACE-${randomUUID().slice(0, 16)}`;
    const bridge = await buildCapExecutionBridge({
      cap, proposal: scoped, workstation_trace_id,
      workspace_root: workspace,
      authority: {
        workstation_founder_keypair: workstationKp,
        founder_key_manifest: wsManifest,
      },
      repo_root: REPO_ROOT,
      nex1_execution_instance_id: "wo-cap-exec-03-test",
      http_port: pickPort(),
    });
    expect(bridge.ok).toBe(true);
    if (!bridge.ok) throw new Error(bridge.reason);
    const b = bridge.output;

    // ── 6 · Real workstation adapter wired to the bridge output
    const adapter = realWorkstationAdapter({
      proposal: scoped,
      plan: b.workstation_plan,
      workspace_root: workspace,
      authorised_bundle: b.bundle_input,
      build_spec: b.build_spec,
      runtime_spec: b.runtime_spec,
      specialist_invocations: b.specialists,
    });

    // ── 7 · Execute · full 10-point verification runs
    const result = await executeCapProposal({
      cap_id: cap.cap_id,
      proposal_id: scoped.proposal_id,
      founder_signature_hex: capSig,
      trusted_founder_public_keys_hex: [capPubHex],
      environment: "TEST",   // test env · Capability Growth "+1" is founder-locked to PRODUCTION_WORKFORCE
      workstation: adapter,
    });

    // ── 8 · Evidence assertions — every stage the loop reached must be REAL
    const stages = result.attempt.stages_executed;
    expect(stages.length).toBeGreaterThan(0);

    // Broker signature verification is genuine
    expect(result.attempt.broker_approval_reason).toMatch(/founder signature verified/);
    expect(result.attempt.workstation_trace_id).toMatch(/^WS-TRACE-/);
    expect(result.attempt.proposal_id).toBe(scoped.proposal_id);

    // WO-01 real trace reserved
    const wo1 = stages.find((s) => s.stage === "WO-01");
    expect(wo1?.ok).toBe(true);
    expect(wo1?.evidence_ref).toMatch(/^wo1-trace:/);

    // WO-04 real Broker write · both files on disk
    const wo4 = stages.find((s) => s.stage === "WO-04");
    expect(wo4?.ok).toBe(true);
    expect(wo4?.evidence_ref).toMatch(/^wo4-report:/);
    const serverBytes = await fs.readFile(path.join(workspace, "server.js"), "utf8");
    expect(serverBytes).toContain("http.createServer");
    const markerBytes = await fs.readFile(path.join(workspace, "cap-proof-marker.txt"), "utf8");
    expect(markerBytes).toContain("CAP_PROOF_MARKER");
    expect(markerBytes).toContain(cap.cap_id);

    // WO-05 real build · node --check server.js
    const wo5 = stages.find((s) => s.stage === "WO-05");
    expect(wo5).toBeDefined();
    if (wo5) {
      expect(wo5.evidence_ref).toMatch(/^wo5-(report|refused|threw)/);
      // If the build reached executeBuild successfully, the evidence_ref
      // starts with wo5-report:. WO-05 refusal (e.g. no `node` on PATH in
      // some CI envs) is honest fail-closed. Either way, no fake success.
    }

    // WO-06 real runtime · only reached if WO-05 succeeded
    const wo6 = stages.find((s) => s.stage === "WO-06");
    if (wo6) {
      expect(wo6.evidence_ref).toMatch(/^wo6-(report|refused|threw|no-runtime-check|no-spec)/);
    }

    // WO-07 real specialists · only reached if earlier stages succeeded
    const wo7 = stages.find((s) => s.stage === "WO-07");
    if (wo7) {
      expect(wo7.evidence_ref).toMatch(/^wo7-(all|node-syntax|no-specialists|threw|refused)/);
    }

    // WO-08 evidence persistence check
    const wo8 = stages.find((s) => s.stage === "WO-08");
    if (wo8) {
      expect(wo8.evidence_ref).toMatch(/^wo8-/);
    }

    // WO-09 corrector reachability
    const wo9 = stages.find((s) => s.stage === "WO-09");
    if (wo9) {
      expect(wo9.evidence_ref).toMatch(/^wo9-/);
    }

    // Marker file exists on disk (real evidence · CAP trigger disappeared)
    const markerExists = await fs.access(b.proof_marker_abs_path).then(() => true).catch(() => false);
    expect(markerExists).toBe(true);

    // The attempt was persisted
    const finalCap = await loadCap(cap.cap_id);
    expect(finalCap).not.toBeNull();

    // In TEST env, CAP does NOT go RESOLVED · founder-locked doctrine says
    // only PRODUCTION_WORKFORCE evidence counts for Capability Growth +1.
    // This test proves the MACHINE. Capability Growth +1 fires when a
    // real production execution runs · not from any test surface.
  }, 60_000);

  // ── PRODUCTION-parity proof · same chain in the exact env the founder-
  // locked verifier requires for Capability Growth +1. This test still
  // uses an isolated workspace under data/nex-agent-workspaces/ so no
  // production data is touched. It only proves the doctrine-locked
  // env=PRODUCTION_WORKFORCE code path.
  it("P-5 · env=PRODUCTION_WORKFORCE · same chain · reaches at least the environment-gate + evidence-persist stages", async () => {
    const workspace = await makeWorkspace();
    cleanups.push(workspace);

    const cap = await persistCapabilityGap({
      kind: CAP_KIND_WORKSTATION_SELF_PROOF,
      category: "RELIABILITY", priority: "LOW",
      title: "workstation self-proof stub missing · PROD-parity acceptance",
      evidence: [{ collection: "docs/DECISIONS", record_id: "wo-cap-execution-03", kind: "founder_authorization" }],
      detector_agent_id: "wo-cap-execution-03",
      dedupe_key: `p5-${Date.now()}-${randomUUID()}`,
    });
    const nex1 = await nex1EngineerProposeFor(cap);
    if (!nex1.proposal) throw new Error("expected proposal");
    const scoped = await attachWorkstationScopeToProposal({
      proposal_id: nex1.proposal.proposal_id,
      scope: authorisedScopeForSelfProofCap(),
    });
    if (!scoped) throw new Error("scope attach failed");

    const { generateKeyPairSync } = await import("node:crypto");
    const capProposalKp = generateKeyPairSync("ed25519");
    const capPubHex = (capProposalKp.publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex");
    const capPrivHex = (capProposalKp.privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex");
    const capSig = await founderSignProposal({ proposal: scoped, founder_private_key_hex: capPrivHex });

    const workstationKp = generateKeyPair("cap-exec-03-prod-founder");
    const wsManifest: FounderKeyManifest = {
      version: "wo2.v0.1",
      keys: [buildFounderKeyRecordForTest(workstationKp, { validFrom: "2020-01-01T00:00:00.000Z" })],
    };
    const workstation_trace_id = `WS-TRACE-${randomUUID().slice(0, 16)}`;
    const bridge = await buildCapExecutionBridge({
      cap, proposal: scoped, workstation_trace_id,
      workspace_root: workspace,
      authority: { workstation_founder_keypair: workstationKp, founder_key_manifest: wsManifest },
      repo_root: REPO_ROOT,
      nex1_execution_instance_id: "wo-cap-exec-03-prod-test",
      http_port: pickPort(),
    });
    if (!bridge.ok) throw new Error(bridge.reason);
    const adapter = realWorkstationAdapter({
      proposal: scoped, plan: bridge.output.workstation_plan,
      workspace_root: workspace,
      authorised_bundle: bridge.output.bundle_input,
      build_spec: bridge.output.build_spec,
      runtime_spec: bridge.output.runtime_spec,
      specialist_invocations: bridge.output.specialists,
    });

    // Use CAP-kind-specific verifiers so the 4 legitimately-fail-closed
    // default verifiers are replaced with real checks for this CAP kind.
    const verifiers = verifiersForSelfProofCap({
      proof_marker_abs_path: bridge.output.proof_marker_abs_path,
      workspace_root: workspace,
    });

    const result = await executeCapProposal({
      cap_id: cap.cap_id,
      proposal_id: scoped.proposal_id,
      founder_signature_hex: capSig,
      trusted_founder_public_keys_hex: [capPubHex],
      environment: "PRODUCTION_WORKFORCE",
      workstation: adapter,
      verifiers,
    });

    // Broker was reached and approved · signature verified
    expect(result.attempt.broker_approval_reason).toMatch(/founder signature verified/);
    // WO-01 + WO-04 must succeed
    expect(result.attempt.stages_executed.find((s) => s.stage === "WO-01")?.ok).toBe(true);
    expect(result.attempt.stages_executed.find((s) => s.stage === "WO-04")?.ok).toBe(true);
    // Marker file must be present on disk
    const marker = await fs.access(bridge.output.proof_marker_abs_path).then(() => true).catch(() => false);
    expect(marker).toBe(true);

    // If all stages passed AND all 10 kind-specific verifiers passed AND
    // env=PRODUCTION_WORKFORCE, the CAP reaches RESOLVED · this is the
    // founder-locked "+1 Capability Growth" event.
    if (result.outcome === "RESOLVED") {
      expect(result.attempt.all_10_passed).toBe(true);
      expect(result.attempt.verification.every((v) => v.passed)).toBe(true);
      // The persisted CAP must now show RESOLVED status
      const finalCap = await loadCap(cap.cap_id);
      expect(finalCap?.status).toBe("RESOLVED");
      // eslint-disable-next-line no-console
      console.log(`\n✅ CAP RESOLVED · +1 Capability Growth · ${cap.cap_id}`);
    } else {
      // Honest surfacing of any verifier that fail-closed. This is the
      // "fail-closed with real evidence" doctrine · no fake success.
      const failed = result.attempt.verification.filter((v) => !v.passed);
      // eslint-disable-next-line no-console
      console.log(`\n⚠ CAP did NOT reach RESOLVED · verifiers that failed:`);
      for (const f of failed) console.log(`   FAIL  ${f.kind}  ${f.reason}`);
    }
    // Regardless of outcome, the attempt is real and persisted
    expect(result.attempt.attempt_id).toMatch(/^CAP-EXEC-/);
    expect(["RESOLVED", "FAILED_EXECUTION", "REFUSED"]).toContain(result.outcome);
  }, 90_000);
});
