// WO-NEX-RUNTIME-07 · Orchestrator gate-receipt tests.
//
// Founder-locked 2026-09-13.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { startOrchestratorDaemon } from "../daemon";
import { assembleGateReceipt, verifyGateReceipt, verifyGateReceiptDeep, loadReceiptsForProposal } from "../orchestrator";
import { startNex1Daemon } from "@/lib/nex-agent-runtime/nex1/daemon";
import { startNex2Daemon } from "@/lib/nex-agent-runtime/nex2/daemon";
import { startNex3Daemon } from "@/lib/nex-agent-runtime/nex3/daemon";
import { startSecurityDaemon } from "@/lib/nex-agent-runtime/security/daemon";
import { nex2ReviewProposal } from "@/lib/nex-agent-runtime/nex2/review";
import { securityReviewProposal } from "@/lib/nex-agent-runtime/security/review";
import { getStorage } from "@/lib/nex/storage/registry";
import { CAP_ENGINEERING_PROPOSAL_COLLECTION, type CapEngineeringProposal, founderSignProposal } from "@/lib/nex-cap/nex1-engineer";
import { persistCapabilityGap } from "@/lib/nex-cap/registry";

const REPO = process.cwd();
const RUN = `orc-${randomUUID().slice(0, 8)}`;

async function nuke(p: string): Promise<void> { try { await fs.rm(p, { recursive: true, force: true }); } catch { /* ok */ } }

/** Persist a proposal directly with a specific shape. */
async function seedProposal(overrides: Partial<CapEngineeringProposal>): Promise<CapEngineeringProposal> {
  const base: CapEngineeringProposal = {
    record_type: "NEX_CAP_ENGINEERING_PROPOSAL",
    proposal_id: `CAP-PROP-ORC-${RUN}-${randomUUID()}`,
    cap_id: null,
    diagnosed_by_agent: "nex1-master-engineer",
    diagnosis: "canonical bounded diagnosis text long enough to pass validation",
    proposed_fix_summary: "canonical bounded fix summary long enough to pass validation",
    required_authority_scope: { authorised_tools: [], authorised_hosts: [], authorised_collections_write: [], requires_founder_signature: true },
    authorised_workstation_scope: {
      files_may_touch: ["src/some-safe/module.ts"],
      build_targets: ["node"],
      collections_may_write: [],
      stages_required: ["WO-04", "WO-05"],
      runtime_required: false,
    },
    evidence_chain: ["e-1", "e-2"],
    resolver_outcome: "PROPOSE",
    founder_signature_slot: null,
    created_at: new Date().toISOString(),
    provenance_chain_hash: "hash",
    ...overrides,
  } as CapEngineeringProposal;
  await getStorage().save(CAP_ENGINEERING_PROPOSAL_COLLECTION, base);
  return base;
}

function makeFounderKp() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

describe("WO-NEX-RUNTIME-07 · Orchestrator gate receipt", () => {
  const stopFns: Array<() => Promise<void>> = [];
  const cleanups: string[] = [];
  afterEach(async () => {
    while (stopFns.length) { const f = stopFns.pop(); if (f) await f(); }
    while (cleanups.length) { const p = cleanups.pop(); if (p) await nuke(p); }
  });

  // ── O-1 · Fifth distinct identity ────────────────────────────────────
  it("O-1 · Orchestrator identity is a FIFTH distinct keypair (NEX1 ≠ NEX2 ≠ NEX3 ≠ Security ≠ Orchestrator)", async () => {
    const ids = ["nex1", "nex2", "nex3", "security", "orchestrator"].map((s) => `${s}-${RUN}-o1`);
    for (const id of ids) cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", id));
    const d1 = await startNex1Daemon({ agent_id: ids[0], repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const d2 = await startNex2Daemon({ agent_id: ids[1], repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d2.stop);
    const d3 = await startNex3Daemon({ agent_id: ids[2], repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d3.stop);
    const ds = await startSecurityDaemon({ agent_id: ids[3], repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(ds.stop);
    const dO = await startOrchestratorDaemon({ agent_id: ids[4], repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dO.stop);
    const keys = new Set([d1.identity.public_key_der_hex, d2.identity.public_key_der_hex, d3.identity.public_key_der_hex, ds.identity.public_key_der_hex, dO.identity.public_key_der_hex]);
    expect(keys.size).toBe(5);
  });

  // ── O-2 · Happy path · full receipt WORKSTATION_ALLOWED ──────────────
  it("O-2 · happy path · all agents clean + valid founder sig → WORKSTATION_ALLOWED", async () => {
    const nex2_id = `nex2-${RUN}-o2`;
    const sec_id = `security-${RUN}-o2`;
    const orc_id = `orchestrator-${RUN}-o2`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", sec_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", orc_id));
    const d2 = await startNex2Daemon({ agent_id: nex2_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d2.stop);
    const dS = await startSecurityDaemon({ agent_id: sec_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dS.stop);
    const dO = await startOrchestratorDaemon({ agent_id: orc_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dO.stop);

    const founder = makeFounderKp();
    const proposal = await seedProposal({});
    // NEX2 review → INDEPENDENTLY_VERIFIED
    await nex2ReviewProposal({ identity: d2.identity, instance_id: d2.handle.instance_id, proposal_id: proposal.proposal_id });
    // Security → CLEARED
    await securityReviewProposal({ identity: dS.identity, instance_id: dS.handle.instance_id, proposal_id: proposal.proposal_id });
    // Founder signs
    const founderSig = await founderSignProposal({ proposal, founder_private_key_hex: founder.privateHex });

    const receipt = await assembleGateReceipt({
      identity: dO.identity, instance_id: dO.handle.instance_id,
      proposal_id: proposal.proposal_id,
      founder_signature_hex: founderSig,
      trusted_founder_public_keys_hex: [founder.publicHex],
    });
    expect(receipt.overall_verdict).toBe("WORKSTATION_ALLOWED");
    const gateKinds = receipt.gates.map((g) => g.kind);
    expect(gateKinds).toContain("NEX1_VALID");
    expect(gateKinds).toContain("NEX2_VALID");
    expect(gateKinds).toContain("NEX3_VALID");    // NA when NEX2 approves
    expect(gateKinds).toContain("SECURITY_VALID");
    expect(gateKinds).toContain("FOUNDER_AUTH_VALID");
    expect(gateKinds).toContain("SCOPE_VALID");
    expect(gateKinds).toContain("WORKSTATION_ALLOWED");
    const nex3 = receipt.gates.find((g) => g.kind === "NEX3_VALID")!;
    expect(nex3.verdict).toBe("NA");   // no conflict · NEX3 not required
    const wsGate = receipt.gates.find((g) => g.kind === "WORKSTATION_ALLOWED")!;
    expect(wsGate.verdict).toBe("VALID");
  });

  // ── O-3 · Security rejects · overall BLOCKED even with NEX2 approve ──
  it("O-3 · Security REJECTED · overall BLOCKED (even if NEX1/NEX2 approve)", async () => {
    const nex2_id = `nex2-${RUN}-o3`;
    const sec_id = `security-${RUN}-o3`;
    const orc_id = `orchestrator-${RUN}-o3`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", sec_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", orc_id));
    const d2 = await startNex2Daemon({ agent_id: nex2_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d2.stop);
    const dS = await startSecurityDaemon({ agent_id: sec_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dS.stop);
    const dO = await startOrchestratorDaemon({ agent_id: orc_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dO.stop);

    // Proposal is clean at NEX2 layer · but Security sees a credential in a file_write_intent
    const proposal = await seedProposal({});
    await nex2ReviewProposal({ identity: d2.identity, instance_id: d2.handle.instance_id, proposal_id: proposal.proposal_id });
    // Security review with credential-leak intent → REJECTED_CREDENTIAL_LEAK
    await securityReviewProposal({
      identity: dS.identity, instance_id: dS.handle.instance_id, proposal_id: proposal.proposal_id,
      file_write_intents: [{ path: "src/config.ts", content_preview: "const key='AKIAIOSFODNN7EXAMPLE';" }],
    });
    const founder = makeFounderKp();
    const sig = await founderSignProposal({ proposal, founder_private_key_hex: founder.privateHex });

    const receipt = await assembleGateReceipt({
      identity: dO.identity, instance_id: dO.handle.instance_id,
      proposal_id: proposal.proposal_id, founder_signature_hex: sig,
      trusted_founder_public_keys_hex: [founder.publicHex],
    });
    expect(receipt.overall_verdict).toBe("BLOCKED");
    const secGate = receipt.gates.find((g) => g.kind === "SECURITY_VALID")!;
    expect(secGate.verdict).toBe("INVALID");
    const wsGate = receipt.gates.find((g) => g.kind === "WORKSTATION_ALLOWED")!;
    expect(wsGate.verdict).toBe("INVALID");
  });

  // ── O-4 · Missing founder signature → PENDING_INPUT ─────────────────
  it("O-4 · no founder signature supplied · overall PENDING_INPUT", async () => {
    const nex2_id = `nex2-${RUN}-o4`;
    const sec_id = `security-${RUN}-o4`;
    const orc_id = `orchestrator-${RUN}-o4`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", sec_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", orc_id));
    const d2 = await startNex2Daemon({ agent_id: nex2_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d2.stop);
    const dS = await startSecurityDaemon({ agent_id: sec_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dS.stop);
    const dO = await startOrchestratorDaemon({ agent_id: orc_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dO.stop);

    const proposal = await seedProposal({});
    await nex2ReviewProposal({ identity: d2.identity, instance_id: d2.handle.instance_id, proposal_id: proposal.proposal_id });
    await securityReviewProposal({ identity: dS.identity, instance_id: dS.handle.instance_id, proposal_id: proposal.proposal_id });

    const receipt = await assembleGateReceipt({
      identity: dO.identity, instance_id: dO.handle.instance_id,
      proposal_id: proposal.proposal_id,   // NO founder signature supplied
    });
    expect(receipt.overall_verdict).toBe("PENDING_INPUT");
    const founderGate = receipt.gates.find((g) => g.kind === "FOUNDER_AUTH_VALID")!;
    expect(founderGate.verdict).toBe("MISSING");
  });

  // ── O-5 · Founder signature made with WRONG key → INVALID ────────────
  it("O-5 · founder signature with untrusted key · FOUNDER_AUTH_VALID=INVALID → BLOCKED", async () => {
    const nex2_id = `nex2-${RUN}-o5`;
    const sec_id = `security-${RUN}-o5`;
    const orc_id = `orchestrator-${RUN}-o5`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", sec_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", orc_id));
    const d2 = await startNex2Daemon({ agent_id: nex2_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d2.stop);
    const dS = await startSecurityDaemon({ agent_id: sec_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dS.stop);
    const dO = await startOrchestratorDaemon({ agent_id: orc_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dO.stop);

    const realFounder = makeFounderKp();
    const attacker = makeFounderKp();
    const proposal = await seedProposal({});
    await nex2ReviewProposal({ identity: d2.identity, instance_id: d2.handle.instance_id, proposal_id: proposal.proposal_id });
    await securityReviewProposal({ identity: dS.identity, instance_id: dS.handle.instance_id, proposal_id: proposal.proposal_id });
    const forgedSig = await founderSignProposal({ proposal, founder_private_key_hex: attacker.privateHex });

    const receipt = await assembleGateReceipt({
      identity: dO.identity, instance_id: dO.handle.instance_id,
      proposal_id: proposal.proposal_id,
      founder_signature_hex: forgedSig,
      trusted_founder_public_keys_hex: [realFounder.publicHex],   // only real founder trusted
    });
    expect(receipt.overall_verdict).toBe("BLOCKED");
    const founderGate = receipt.gates.find((g) => g.kind === "FOUNDER_AUTH_VALID")!;
    expect(founderGate.verdict).toBe("INVALID");
  });

  // ── O-6 · Receipt signature verifies · deep re-verify each gate ─────
  it("O-6 · receipt is signed by Orchestrator's key · verifyGateReceipt() succeeds · verifyGateReceiptDeep() reloads records + verifies each signature", async () => {
    const nex2_id = `nex2-${RUN}-o6`;
    const sec_id = `security-${RUN}-o6`;
    const orc_id = `orchestrator-${RUN}-o6`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", sec_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", orc_id));
    const d2 = await startNex2Daemon({ agent_id: nex2_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d2.stop);
    const dS = await startSecurityDaemon({ agent_id: sec_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dS.stop);
    const dO = await startOrchestratorDaemon({ agent_id: orc_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dO.stop);

    const founder = makeFounderKp();
    const proposal = await seedProposal({});
    await nex2ReviewProposal({ identity: d2.identity, instance_id: d2.handle.instance_id, proposal_id: proposal.proposal_id });
    await securityReviewProposal({ identity: dS.identity, instance_id: dS.handle.instance_id, proposal_id: proposal.proposal_id });
    const sig = await founderSignProposal({ proposal, founder_private_key_hex: founder.privateHex });

    const receipt = await assembleGateReceipt({
      identity: dO.identity, instance_id: dO.handle.instance_id,
      proposal_id: proposal.proposal_id, founder_signature_hex: sig,
      trusted_founder_public_keys_hex: [founder.publicHex],
    });
    const shallow = verifyGateReceipt(receipt);
    expect(shallow.overall_ok).toBe(true);
    expect(shallow.assembly_signature_valid).toBe(true);

    const deep = await verifyGateReceiptDeep(receipt);
    expect(deep.overall_ok).toBe(true);
    expect(deep.per_gate.every((g) => g.gate_signature_valid)).toBe(true);
  });

  // ── O-7 · Tampered receipt · assembly signature fails ────────────────
  it("O-7 · any tampered field on the receipt · assembly signature FAILS to verify", async () => {
    const nex2_id = `nex2-${RUN}-o7`;
    const sec_id = `security-${RUN}-o7`;
    const orc_id = `orchestrator-${RUN}-o7`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", sec_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", orc_id));
    const d2 = await startNex2Daemon({ agent_id: nex2_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d2.stop);
    const dS = await startSecurityDaemon({ agent_id: sec_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dS.stop);
    const dO = await startOrchestratorDaemon({ agent_id: orc_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dO.stop);

    const founder = makeFounderKp();
    const proposal = await seedProposal({});
    await nex2ReviewProposal({ identity: d2.identity, instance_id: d2.handle.instance_id, proposal_id: proposal.proposal_id });
    await securityReviewProposal({ identity: dS.identity, instance_id: dS.handle.instance_id, proposal_id: proposal.proposal_id });
    const sig = await founderSignProposal({ proposal, founder_private_key_hex: founder.privateHex });

    const receipt = await assembleGateReceipt({
      identity: dO.identity, instance_id: dO.handle.instance_id,
      proposal_id: proposal.proposal_id, founder_signature_hex: sig,
      trusted_founder_public_keys_hex: [founder.publicHex],
    });
    // Tamper: flip the overall_verdict
    const tampered = { ...receipt, overall_verdict: "WORKSTATION_ALLOWED" as const, reason_summary: "tampered" };
    const r = verifyGateReceipt(tampered);
    expect(r.assembly_signature_valid).toBe(false);
    expect(r.overall_ok).toBe(false);
  });

  // ── O-8 · No override field exists on the receipt ────────────────────
  it("O-8 · the receipt schema exposes NO override field · agents cannot bypass any gate", async () => {
    const orc_id = `orchestrator-${RUN}-o8`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", orc_id));
    const dO = await startOrchestratorDaemon({ agent_id: orc_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dO.stop);
    const proposal = await seedProposal({});
    const receipt = await assembleGateReceipt({
      identity: dO.identity, instance_id: dO.handle.instance_id,
      proposal_id: proposal.proposal_id,
    });
    const anyOverride =
      (receipt as unknown as Record<string, unknown>).overridden_by_agent !== undefined ||
      (receipt as unknown as Record<string, unknown>).override_ok !== undefined ||
      (receipt as unknown as Record<string, unknown>).can_override !== undefined;
    expect(anyOverride).toBe(false);
  });

  // ── O-9 · Stolen-key defence ─────────────────────────────────────────
  it("O-9 · Orchestrator refuses to start if its identity keypair matches any other agent's identity", async () => {
    const n1 = `nex1-${RUN}-o9`;
    const orc = `orchestrator-${RUN}-o9`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", orc));
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const src = path.join(REPO, "data", "nex-agent-runtime", "identities", n1, "keypair.jsonl");
    const raw = await fs.readFile(src, "utf8");
    const stolen = raw.replace(new RegExp(n1, "g"), orc);
    const dst = path.join(REPO, "data", "nex-agent-runtime", "identities", orc);
    await fs.mkdir(dst, { recursive: true });
    await fs.writeFile(path.join(dst, "keypair.jsonl"), stolen, "utf8");
    await expect(startOrchestratorDaemon({ agent_id: orc, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true }))
      .rejects.toThrow(/refusing to start/);
  });

  // ── O-10 · Non-existent proposal → PENDING_INPUT ────────────────────
  it("O-10 · non-existent proposal · receipt is PENDING_INPUT · gates empty · no fabrication", async () => {
    const orc_id = `orchestrator-${RUN}-o10`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", orc_id));
    const dO = await startOrchestratorDaemon({ agent_id: orc_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dO.stop);
    const receipt = await assembleGateReceipt({
      identity: dO.identity, instance_id: dO.handle.instance_id,
      proposal_id: `NONEXISTENT-${randomUUID()}`,
    });
    expect(receipt.overall_verdict).toBe("PENDING_INPUT");
    expect(receipt.gates.length).toBe(0);
  });

  // ── O-11 · Persisted + queryable ─────────────────────────────────────
  it("O-11 · receipt is persisted to GB storage and queryable by proposal_id", async () => {
    const orc_id = `orchestrator-${RUN}-o11`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", orc_id));
    const dO = await startOrchestratorDaemon({ agent_id: orc_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dO.stop);
    const proposal = await seedProposal({});
    const receipt = await assembleGateReceipt({
      identity: dO.identity, instance_id: dO.handle.instance_id,
      proposal_id: proposal.proposal_id,
    });
    const rows = await loadReceiptsForProposal(proposal.proposal_id);
    expect(rows.some((r) => r.receipt_id === receipt.receipt_id)).toBe(true);
  });
});
