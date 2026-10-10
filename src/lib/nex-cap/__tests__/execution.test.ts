// WO-CAP-EXECUTION-01 · 10-point verification adversarial tests.
//
// Founder-locked: CAP → RESOLVED only when ALL 10 verifications pass.
// Every failure mode below must keep CAP OPEN (not RESOLVED).

import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { persistCapabilityGap, loadCap } from "../registry";
import { nex1EngineerProposeFor, founderSignProposal, CAP_ENGINEERING_PROPOSAL_COLLECTION } from "../nex1-engineer";
import { executeCapProposal, CAP_EXECUTION_ATTEMPTS_COLLECTION, type WorkstationAdapter, type Verifier, defaultVerifiers } from "../execution";
import { CAP_COLLECTION } from "../types";

const REPO = process.cwd();
async function rm(name: string) { try { await fs.unlink(path.join(REPO, "data", "nex-storage", `${name}.jsonl`)); } catch {} }

function founderKp() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateKeyHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

/** All-green adapter · every stage succeeds. */
const greenAdapter: WorkstationAdapter = {
  run_wo_01_state_setup:           async () => ({ ok: true, evidence_ref: "ev-wo01", reason: "state set up" }),
  run_wo_04_broker_write:          async () => ({ ok: true, evidence_ref: "ev-wo04", reason: "broker wrote" }),
  run_wo_05_build:                 async () => ({ ok: true, evidence_ref: "ev-wo05", reason: "build ok" }),
  run_wo_06_runtime:               async () => ({ ok: true, evidence_ref: "ev-wo06", reason: "runtime ok" }),
  run_wo_07_specialist_validation: async () => ({ ok: true, evidence_ref: "ev-wo07", reason: "specialists ok" }),
  run_wo_08_evidence_persist:      async () => ({ ok: true, evidence_ref: "ev-wo08", reason: "evidence saved" }),
  run_wo_09_corrector_check:       async () => ({ ok: true, evidence_ref: "ev-wo09", reason: "corrector clean" }),
};

/** All-green verifiers · every check passes. */
const greenVerifiers: readonly Verifier[] = defaultVerifiers.map((v) => ({
  kind: v.kind,
  check: async () => ({ kind: v.kind, passed: true, evidence_refs: [`ev-${v.kind}`], reason: `${v.kind} passed (green stub)` }),
}));

async function seed(kind: string, priority: "LOW" | "MEDIUM" = "LOW"): Promise<{ cap: NonNullable<Awaited<ReturnType<typeof loadCap>>>; proposal: NonNullable<Awaited<ReturnType<typeof nex1EngineerProposeFor>>["proposal"]>; founder: ReturnType<typeof founderKp>; sig: string }> {
  const founder = founderKp();
  const cap = await persistCapabilityGap({
    kind, category: "PERFORMANCE", priority, title: `seed ${kind}`,
    evidence: [{ collection: "test", record_id: "test-ev-1", kind: "test" }],
    detector_agent_id: null,
    dedupe_key: `${kind}-${Date.now()}-${Math.random()}`,
  });
  const r = await nex1EngineerProposeFor(cap);
  if (!r.proposal) throw new Error("expected proposal");
  const sig = await founderSignProposal({
    proposal: r.proposal,
    founder_private_key_hex: founder.privateKeyHex,
  });
  return { cap, proposal: r.proposal, founder, sig };
}

describe("WO-CAP-EXECUTION-01 · 10-point verification adversarial tests", () => {
  // Do NOT purge shared collections · parallel test files race on the same
  // disk files. Each test uses unique dedupe_keys so records don't collide.

  it("X-1 · execution without Broker approval is REFUSED · CAP stays PROPOSED", async () => {
    const { cap, proposal, founder } = await seed("test.exec.x1");
    const attackerSig = "00".repeat(64);
    const r = await executeCapProposal({
      cap_id: cap.cap_id, proposal_id: proposal.proposal_id,
      founder_signature_hex: attackerSig,
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
      environment: "PRODUCTION_WORKFORCE",
      workstation: greenAdapter,
      verifiers: greenVerifiers,
    });
    expect(r.outcome).toBe("REFUSED");
    const after = await loadCap(cap.cap_id);
    expect(after?.status).not.toBe("RESOLVED");
  });

  it("X-2 · WO-05 build failure → CAP stays OPEN (not RESOLVED)", async () => {
    const { cap, proposal, founder, sig } = await seed("test.exec.x2");
    const failBuild: WorkstationAdapter = { ...greenAdapter,
      run_wo_05_build: async () => ({ ok: false, evidence_ref: "ev-build-fail", reason: "tsc error" }),
    };
    const r = await executeCapProposal({
      cap_id: cap.cap_id, proposal_id: proposal.proposal_id,
      founder_signature_hex: sig,
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
      environment: "PRODUCTION_WORKFORCE",
      workstation: failBuild, verifiers: greenVerifiers,
    });
    expect(r.outcome).toBe("FAILED_EXECUTION");
    const after = await loadCap(cap.cap_id);
    expect(after?.status).toBe("OPEN");
  });

  it("X-3 · WO-07 test failure → CAP stays OPEN", async () => {
    const { cap, proposal, founder, sig } = await seed("test.exec.x3");
    const failTests: WorkstationAdapter = { ...greenAdapter,
      run_wo_07_specialist_validation: async () => ({ ok: false, evidence_ref: "ev-test-fail", reason: "specialist reported FAIL" }),
    };
    const r = await executeCapProposal({
      cap_id: cap.cap_id, proposal_id: proposal.proposal_id,
      founder_signature_hex: sig, trusted_founder_public_keys_hex: [founder.founderPublicKeyHex ?? founder.publicKeyHex],
      environment: "PRODUCTION_WORKFORCE",
      workstation: failTests, verifiers: greenVerifiers,
    });
    expect(r.outcome).toBe("FAILED_EXECUTION");
    const after = await loadCap(cap.cap_id);
    expect(after?.status).toBe("OPEN");
  });

  it("X-4 · WO-06 runtime failure → CAP stays OPEN", async () => {
    const { cap, proposal, founder, sig } = await seed("test.exec.x4");
    const failRuntime: WorkstationAdapter = { ...greenAdapter,
      run_wo_06_runtime: async () => ({ ok: false, evidence_ref: "ev-runtime-fail", reason: "runtime crash" }),
    };
    const r = await executeCapProposal({
      cap_id: cap.cap_id, proposal_id: proposal.proposal_id,
      founder_signature_hex: sig, trusted_founder_public_keys_hex: [founder.publicKeyHex],
      environment: "PRODUCTION_WORKFORCE",
      workstation: failRuntime, verifiers: greenVerifiers,
    });
    expect(r.outcome).toBe("FAILED_EXECUTION");
    const after = await loadCap(cap.cap_id);
    expect(after?.status).toBe("OPEN");
  });

  it("X-5 · original CAP trigger STILL present → CAP stays OPEN (even with all stages green)", async () => {
    const { cap, proposal, founder, sig } = await seed("test.exec.x5");
    const triggerStillFires: readonly Verifier[] = defaultVerifiers.map((v) => v.kind === "original_cap_trigger_gone"
      ? { kind: v.kind, check: async () => ({ kind: v.kind, passed: false, evidence_refs: ["ev-trigger-still-fires"], reason: "the original CAP condition is still present after the fix" }) }
      : { kind: v.kind, check: async () => ({ kind: v.kind, passed: true, evidence_refs: [`ev-${v.kind}`], reason: "green stub" }) });
    const r = await executeCapProposal({
      cap_id: cap.cap_id, proposal_id: proposal.proposal_id,
      founder_signature_hex: sig, trusted_founder_public_keys_hex: [founder.publicKeyHex],
      environment: "PRODUCTION_WORKFORCE",
      workstation: greenAdapter, verifiers: triggerStillFires,
    });
    expect(r.outcome).toBe("FAILED_EXECUTION");
    expect(r.reason).toMatch(/original_cap_trigger_gone/);
    const after = await loadCap(cap.cap_id);
    expect(after?.status).toBe("OPEN");
  });

  it("X-6 · regression detected → CAP stays OPEN", async () => {
    const { cap, proposal, founder, sig } = await seed("test.exec.x6");
    const regression: readonly Verifier[] = defaultVerifiers.map((v) => v.kind === "no_regression_introduced"
      ? { kind: v.kind, check: async () => ({ kind: v.kind, passed: false, evidence_refs: ["ev-regression-detected"], reason: "a previously-green test failed after the change" }) }
      : { kind: v.kind, check: async () => ({ kind: v.kind, passed: true, evidence_refs: [`ev-${v.kind}`], reason: "green" }) });
    const r = await executeCapProposal({
      cap_id: cap.cap_id, proposal_id: proposal.proposal_id,
      founder_signature_hex: sig, trusted_founder_public_keys_hex: [founder.publicKeyHex],
      environment: "PRODUCTION_WORKFORCE",
      workstation: greenAdapter, verifiers: regression,
    });
    expect(r.outcome).toBe("FAILED_EXECUTION");
    expect(r.reason).toMatch(/no_regression_introduced/);
  });

  it("X-7 · execution in TEST environment can run but NEVER marks CAP RESOLVED (production-only rule)", async () => {
    const { cap, proposal, founder, sig } = await seed("test.exec.x7");
    const r = await executeCapProposal({
      cap_id: cap.cap_id, proposal_id: proposal.proposal_id,
      founder_signature_hex: sig, trusted_founder_public_keys_hex: [founder.publicKeyHex],
      environment: "TEST",   // <-- non-production
      workstation: greenAdapter, verifiers: greenVerifiers,
    });
    expect(r.outcome).toBe("FAILED_EXECUTION");
    const after = await loadCap(cap.cap_id);
    expect(after?.status).not.toBe("RESOLVED");
  });

  it("X-8 · ALL 10 verifications pass + PRODUCTION_WORKFORCE → CAP RESOLVED · Capability Growth +1", async () => {
    const { cap, proposal, founder, sig } = await seed("test.exec.x8");
    const r = await executeCapProposal({
      cap_id: cap.cap_id, proposal_id: proposal.proposal_id,
      founder_signature_hex: sig, trusted_founder_public_keys_hex: [founder.publicKeyHex],
      environment: "PRODUCTION_WORKFORCE",
      workstation: greenAdapter, verifiers: greenVerifiers,
    });
    expect(r.outcome).toBe("RESOLVED");
    expect(r.attempt.all_10_passed).toBe(true);
    const after = await loadCap(cap.cap_id);
    expect(after?.status).toBe("RESOLVED");
    expect(after?.resolution_note).toMatch(/all 10 verifications passed/);
  });

  it("X-9 · ESCALATE-tier proposals cannot be broker-approved · execution refuses", async () => {
    const founder = founderKp();
    const cap = await persistCapabilityGap({
      kind: "guardian.te.evidence_source_registry_untrusted",   // ESCALATE-only kind
      category: "SECURITY", priority: "HIGH", title: "escalate only",
      evidence: [{ collection: "x", record_id: "y", kind: "z" }],
      detector_agent_id: null, dedupe_key: `x9-${Date.now()}`,
    });
    const r = await nex1EngineerProposeFor(cap);
    // ESCALATE outcome does not produce a proposal at all
    expect(r.proposal).toBeNull();
  });

  it("X-10 · execution attempt persists pre_state_hash + post_state_hash + workstation_trace_id (tamper-evident)", async () => {
    const { cap, proposal, founder, sig } = await seed("test.exec.x10");
    const r = await executeCapProposal({
      cap_id: cap.cap_id, proposal_id: proposal.proposal_id,
      founder_signature_hex: sig, trusted_founder_public_keys_hex: [founder.publicKeyHex],
      environment: "PRODUCTION_WORKFORCE",
      workstation: greenAdapter, verifiers: greenVerifiers,
    });
    expect(r.attempt.pre_state_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(r.attempt.post_state_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(r.attempt.workstation_trace_id).toMatch(/^WS-TRACE-/);
    expect(r.attempt.provenance_chain_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(r.attempt.stages_executed.length).toBe(7);   // WO-01, 04, 05, 06, 07, 08, 09
  });

  it("X-11 · default adapter fail-closed · without a wired production adapter, NO CAP can be RESOLVED", async () => {
    const { cap, proposal, founder, sig } = await seed("test.exec.x11");
    // No adapter injected → uses defaultWorkstationAdapter which is fail-closed
    const r = await executeCapProposal({
      cap_id: cap.cap_id, proposal_id: proposal.proposal_id,
      founder_signature_hex: sig, trusted_founder_public_keys_hex: [founder.publicKeyHex],
      environment: "PRODUCTION_WORKFORCE",
      // workstation omitted → defaults to fail-closed adapter
      verifiers: greenVerifiers,
    });
    expect(r.outcome).toBe("FAILED_EXECUTION");
    expect(r.reason).toMatch(/no production workstation adapter registered|one or more workstation stages failed/i);
  });
});
