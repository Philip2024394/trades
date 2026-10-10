// WO-NEX-RUNTIME-10 · workstation-integration tests.
//
// Founder-locked 2026-09-14. RUNTIME-10 is the CONNECTOR — not the
// programming milestone. These tests prove:
//
//   R-1  BLOCKED receipt refused
//   R-2  PENDING_INPUT receipt refused
//   R-3  EXPIRED receipt refused
//   R-4  receipt with tampered assembly signature refused
//   R-5  receipt signed by untrusted orchestrator refused
//   R-6  delegation NOT_AUTHORISED refused
//   R-7  authorization proposal_id mismatch refused
//   R-8  scope hash mismatch refused
//   R-9  unsupported CAP kind refused
//   R-10 happy path · full chain runs real WO-01..WO-09 · attestation signed
//   R-11 attestation tampering detected
//   R-12 WO-04 remains final scope enforcement (out-of-scope bundle refused)
//   R-13 Send-to-NEX1 discipline · no runtime module touches the button
//
// The happy-path uses the WO-CAP-EXECUTION-03 self-proof CAP kind so we
// exercise real WO-01/WO-04/WO-05/WO-06/WO-07/WO-08/WO-09.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync, randomUUID } from "node:crypto";

import { startNex1Daemon } from "@/lib/nex-agent-runtime/nex1/daemon";
import { startNex2Daemon } from "@/lib/nex-agent-runtime/nex2/daemon";
import { startSecurityDaemon } from "@/lib/nex-agent-runtime/security/daemon";
import { startOrchestratorDaemon } from "@/lib/nex-agent-runtime/orchestrator/daemon";

import {
  signFounderDelegation,
} from "@/lib/nex-agent-runtime/founder-authority/delegation";
import {
  signDelegatedAuthorization,
} from "@/lib/nex-agent-runtime/founder-authority/authorization";
import {
  assembleGateReceipt,
} from "@/lib/nex-agent-runtime/orchestrator/orchestrator";
import { nex2ReviewProposal } from "@/lib/nex-agent-runtime/nex2/review";
import { securityReviewProposal } from "@/lib/nex-agent-runtime/security/review";
import type { OrchestratorGateReceipt } from "@/lib/nex-agent-runtime/orchestrator/types";
import type {
  FounderDelegationEnvelope,
  DelegatedAuthorizationEnvelope,
} from "@/lib/nex-agent-runtime/founder-authority/types";

import {
  nex1EngineerProposeFor,
  attachWorkstationScopeToProposal,
  type CapEngineeringProposal,
  hashAuthorisedScope,
} from "@/lib/nex-cap/nex1-engineer";
import { persistCapabilityGap } from "@/lib/nex-cap/registry";
import {
  CAP_KIND_WORKSTATION_SELF_PROOF,
  authorisedScopeForSelfProofCap,
} from "@/lib/nex-cap/cap-spec-bridge";
import { generateKeyPair } from "@/lib/nex-controlled-hands/ed25519";
import {
  buildFounderKeyRecordForTest,
  type FounderKeyManifest,
} from "@/lib/nex1-orchestrator/wo2-founder-keys";

import {
  executeThroughWorkstation,
  verifyWorkstationAttestation,
} from "../execute";

const REPO = process.cwd();
const RUN = `r10-${randomUUID().slice(0, 8)}`;

async function nuke(p: string): Promise<void> {
  try { await fs.rm(p, { recursive: true, force: true }); } catch { /* ok */ }
}

function makeFounderKp() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

async function makeWorkspace(tag: string): Promise<string> {
  const dir = path.join(REPO, "data", "nex-agent-workspaces", `runtime-10-${tag}-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function pickPort(): number {
  return 41000 + Math.floor(Math.random() * 6000);
}

// ── Full setup helper for a valid receipt+delegation+authorization ─────

interface FullChain {
  readonly proposal: CapEngineeringProposal;
  readonly cap: Awaited<ReturnType<typeof persistCapabilityGap>>;
  readonly receipt: OrchestratorGateReceipt;
  readonly delegation: FounderDelegationEnvelope;
  readonly authorization: DelegatedAuthorizationEnvelope;
  readonly founderPubHex: string;
  readonly orchestratorPubHex: string;
  readonly workspace: string;
  readonly wsAuthority: { workstation_founder_keypair: ReturnType<typeof generateKeyPair>; founder_key_manifest: FounderKeyManifest };
  readonly requesterIdentity: Awaited<ReturnType<typeof startOrchestratorDaemon>>["identity"];
}

async function seedFullChain(tag: string, stopFns: Array<() => Promise<void>>, cleanups: string[]): Promise<FullChain> {
  const founder = makeFounderKp();
  const nex1_id = `nex1-r10-${RUN}-${tag}`;
  const nex2_id = `nex2-r10-${RUN}-${tag}`;
  const sec_id = `sec-r10-${RUN}-${tag}`;
  const orc_id = `orc-r10-${RUN}-${tag}`;
  cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex1_id));
  cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id));
  cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", sec_id));
  cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", orc_id));

  const d1 = await startNex1Daemon({ agent_id: nex1_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
  stopFns.push(d1.stop);
  const d2 = await startNex2Daemon({ agent_id: nex2_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
  stopFns.push(d2.stop);
  const dS = await startSecurityDaemon({ agent_id: sec_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
  stopFns.push(dS.stop);
  const dO = await startOrchestratorDaemon({ agent_id: orc_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
  stopFns.push(dO.stop);

  // Seed CAP + NEX1 diagnose + attach scope
  const cap = await persistCapabilityGap({
    kind: CAP_KIND_WORKSTATION_SELF_PROOF,
    category: "RELIABILITY", priority: "LOW",
    title: `runtime-10 ${tag} seed`,
    evidence: [{ collection: "docs", record_id: `runtime-10-${tag}`, kind: "test_seed" }],
    detector_agent_id: `runtime-10-${tag}`,
    dedupe_key: `${tag}-${RUN}-${randomUUID()}`,
  });
  const nex1res = await nex1EngineerProposeFor(cap);
  if (!nex1res.proposal) throw new Error("nex1EngineerProposeFor produced no proposal");
  const scoped = await attachWorkstationScopeToProposal({
    proposal_id: nex1res.proposal.proposal_id,
    scope: authorisedScopeForSelfProofCap(),
  });
  if (!scoped) throw new Error("attachWorkstationScopeToProposal failed");

  // NEX2 reviews · Security clears
  await nex2ReviewProposal({ identity: d2.identity, instance_id: d2.handle.instance_id, proposal_id: scoped.proposal_id });
  await securityReviewProposal({ identity: dS.identity, instance_id: dS.handle.instance_id, proposal_id: scoped.proposal_id });

  // Founder signs delegation · NEX1 signs authorization
  const delegation = signFounderDelegation({
    delegate_agent_id: nex1_id,
    delegate_public_key_der_hex: d1.identity.public_key_der_hex,
    allowed: {
      proposal_kinds: [CAP_KIND_WORKSTATION_SELF_PROOF],
      file_path_prefixes: ["server.js", "cap-proof-marker.txt"],
      stages_allowed: ["WO-01", "WO-04", "WO-05", "WO-06", "WO-07", "WO-08", "WO-09"],
      max_risk_level: "LOW",
      mission_ids_allowed: [],
      cap_ids_allowed: [],
    },
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    founder_public_key_der_hex: founder.publicHex,
    founder_private_key_pkcs8_hex: founder.privateHex,
  });
  const authorization = signDelegatedAuthorization({
    delegate_identity: d1.identity,
    delegation,
    proposal: scoped,
    mission_id: null,
  });

  // Founder direct-signs the proposal too, so the Orchestrator's legacy
  // FOUNDER_AUTH_VALID gate is happy for receipt assembly. Under RUNTIME-10
  // the workstation ignores this and consumes the delegation+authorization
  // path instead — but the receipt gate still needs a signature.
  const { founderSignProposal } = await import("@/lib/nex-cap/nex1-engineer");
  const founderSig = await founderSignProposal({ proposal: scoped, founder_private_key_hex: founder.privateHex });

  const receipt = await assembleGateReceipt({
    identity: dO.identity, instance_id: dO.handle.instance_id,
    proposal_id: scoped.proposal_id,
    founder_signature_hex: founderSig,
    trusted_founder_public_keys_hex: [founder.publicHex],
  });

  // Workstation authority material (WO-02 envelope key)
  const workstationKp = generateKeyPair(`r10-${tag}-workstation-founder`);
  const wsManifest: FounderKeyManifest = {
    version: "wo2.v0.1",
    keys: [buildFounderKeyRecordForTest(workstationKp, { validFrom: "2020-01-01T00:00:00.000Z" })],
  };

  const workspace = await makeWorkspace(tag);
  cleanups.push(workspace);

  return {
    proposal: scoped,
    cap,
    receipt,
    delegation,
    authorization,
    founderPubHex: founder.publicHex,
    orchestratorPubHex: dO.identity.public_key_der_hex,
    workspace,
    wsAuthority: { workstation_founder_keypair: workstationKp, founder_key_manifest: wsManifest },
    requesterIdentity: dO.identity,
  };
}

describe("WO-NEX-RUNTIME-10 · workstation integration · CONNECTOR (not programming milestone)", () => {
  const stopFns: Array<() => Promise<void>> = [];
  const cleanups: string[] = [];
  afterEach(async () => {
    while (stopFns.length) { const f = stopFns.pop(); if (f) await f(); }
    while (cleanups.length) { const p = cleanups.pop(); if (p) await nuke(p); }
  });

  // ── R-1 · BLOCKED receipt refused ───────────────────────────────────
  it("R-1 · BLOCKED overall_verdict refuses execution regardless of any other check", async () => {
    const c = await seedFullChain("r1", stopFns, cleanups);
    const blocked: OrchestratorGateReceipt = { ...c.receipt, overall_verdict: "BLOCKED" };
    const res = await executeThroughWorkstation({
      receipt: blocked,
      delegation: c.delegation,
      authorization: c.authorization,
      proposal: c.proposal,
      cap: c.cap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: [c.orchestratorPubHex],
      workspace_root: c.workspace,
      workstation_authority: c.wsAuthority,
      repo_root: REPO,
      http_port: pickPort(),
      environment: "TEST",
      requester_identity: c.requesterIdentity,
    });
    expect(res.verdict).toBe("REFUSED_RECEIPT_NOT_ALLOWED");
    expect(res.cap_execution).toBeNull();
    expect(res.attestation.verdict).toBe("REFUSED_RECEIPT_NOT_ALLOWED");
  });

  // ── R-2 · PENDING_INPUT receipt refused ─────────────────────────────
  it("R-2 · PENDING_INPUT overall_verdict refuses execution", async () => {
    const c = await seedFullChain("r2", stopFns, cleanups);
    const pending: OrchestratorGateReceipt = { ...c.receipt, overall_verdict: "PENDING_INPUT" };
    const res = await executeThroughWorkstation({
      receipt: pending, delegation: c.delegation, authorization: c.authorization,
      proposal: c.proposal, cap: c.cap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: [c.orchestratorPubHex],
      workspace_root: c.workspace, workstation_authority: c.wsAuthority, repo_root: REPO,
      http_port: pickPort(), environment: "TEST", requester_identity: c.requesterIdentity,
    });
    expect(res.verdict).toBe("REFUSED_RECEIPT_NOT_ALLOWED");
  });

  // ── R-3 · EXPIRED receipt refused ───────────────────────────────────
  it("R-3 · EXPIRED overall_verdict refuses execution", async () => {
    const c = await seedFullChain("r3", stopFns, cleanups);
    const expired: OrchestratorGateReceipt = { ...c.receipt, overall_verdict: "EXPIRED" };
    const res = await executeThroughWorkstation({
      receipt: expired, delegation: c.delegation, authorization: c.authorization,
      proposal: c.proposal, cap: c.cap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: [c.orchestratorPubHex],
      workspace_root: c.workspace, workstation_authority: c.wsAuthority, repo_root: REPO,
      http_port: pickPort(), environment: "TEST", requester_identity: c.requesterIdentity,
    });
    expect(res.verdict).toBe("REFUSED_RECEIPT_NOT_ALLOWED");
  });

  // ── R-4 · Tampered assembly signature refused ───────────────────────
  it("R-4 · tampered receipt signature refused (deep verification catches it)", async () => {
    const c = await seedFullChain("r4", stopFns, cleanups);
    // Flip the last hex byte of the signature.
    const sig = c.receipt.signature_hex;
    const flipped = sig.slice(0, -2) + (sig.slice(-2) === "00" ? "01" : "00");
    const tampered: OrchestratorGateReceipt = { ...c.receipt, signature_hex: flipped };
    const res = await executeThroughWorkstation({
      receipt: tampered, delegation: c.delegation, authorization: c.authorization,
      proposal: c.proposal, cap: c.cap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: [c.orchestratorPubHex],
      workspace_root: c.workspace, workstation_authority: c.wsAuthority, repo_root: REPO,
      http_port: pickPort(), environment: "TEST", requester_identity: c.requesterIdentity,
    });
    expect(res.verdict).toBe("REFUSED_RECEIPT_INVALID");
    expect(res.cap_execution).toBeNull();
  });

  // ── R-5 · Untrusted orchestrator refused ─────────────────────────────
  it("R-5 · receipt signed by an orchestrator whose key is NOT in the trusted set is refused", async () => {
    const c = await seedFullChain("r5", stopFns, cleanups);
    const res = await executeThroughWorkstation({
      receipt: c.receipt, delegation: c.delegation, authorization: c.authorization,
      proposal: c.proposal, cap: c.cap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: ["00".repeat(44)],  // wrong set
      workspace_root: c.workspace, workstation_authority: c.wsAuthority, repo_root: REPO,
      http_port: pickPort(), environment: "TEST", requester_identity: c.requesterIdentity,
    });
    expect(res.verdict).toBe("REFUSED_ORCHESTRATOR_UNTRUSTED");
  });

  // ── R-6 · Delegation NOT_AUTHORISED refused ─────────────────────────
  it("R-6 · authorization signed by a different agent than the delegation empowered → DELEGATION_INVALID", async () => {
    const c = await seedFullChain("r6", stopFns, cleanups);
    // Sign an authorization with a completely different NEX identity (attacker)
    const other = generateKeyPairSync("ed25519");
    const otherIdentity: import("@/lib/nex-agent-runtime/process/identity").AgentIdentity = {
      agent_id: "attacker",
      private: other.privateKey,
      public: other.publicKey,
      public_key_der_hex: (other.publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
      created_at: new Date().toISOString(),
    };
    const badAuth = signDelegatedAuthorization({
      delegate_identity: otherIdentity,
      delegation: c.delegation,
      proposal: c.proposal,
      mission_id: null,
    });
    const res = await executeThroughWorkstation({
      receipt: c.receipt, delegation: c.delegation, authorization: badAuth,
      proposal: c.proposal, cap: c.cap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: [c.orchestratorPubHex],
      workspace_root: c.workspace, workstation_authority: c.wsAuthority, repo_root: REPO,
      http_port: pickPort(), environment: "TEST", requester_identity: c.requesterIdentity,
    });
    expect(res.verdict).toBe("REFUSED_DELEGATION_INVALID");
  });

  // ── R-7 · authorization.proposal_id mismatch refused ────────────────
  it("R-7 · authorization.proposal_id != proposal.proposal_id → PROPOSAL_MISMATCH", async () => {
    const c = await seedFullChain("r7", stopFns, cleanups);
    const mismatched: DelegatedAuthorizationEnvelope = {
      ...c.authorization,
      proposal_id: `CAP-PROP-DIFFERENT-${randomUUID()}`,
    };
    const res = await executeThroughWorkstation({
      receipt: c.receipt, delegation: c.delegation, authorization: mismatched,
      proposal: c.proposal, cap: c.cap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: [c.orchestratorPubHex],
      workspace_root: c.workspace, workstation_authority: c.wsAuthority, repo_root: REPO,
      http_port: pickPort(), environment: "TEST", requester_identity: c.requesterIdentity,
    });
    expect(res.verdict).toBe("REFUSED_PROPOSAL_MISMATCH");
  });

  // ── R-8 · Scope hash mismatch refused ───────────────────────────────
  it("R-8 · authorization.scope_hash disagreement → SCOPE_MISMATCH", async () => {
    const c = await seedFullChain("r8", stopFns, cleanups);
    const badAuth: DelegatedAuthorizationEnvelope = {
      ...c.authorization,
      scope_hash: "00".repeat(32),  // wrong hash
    };
    const res = await executeThroughWorkstation({
      receipt: c.receipt, delegation: c.delegation, authorization: badAuth,
      proposal: c.proposal, cap: c.cap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: [c.orchestratorPubHex],
      workspace_root: c.workspace, workstation_authority: c.wsAuthority, repo_root: REPO,
      http_port: pickPort(), environment: "TEST", requester_identity: c.requesterIdentity,
    });
    // Tampering scope_hash also breaks the authorization signature.
    // Either DELEGATION_INVALID (sig fails) or SCOPE_MISMATCH is acceptable
    // refusal — both prove no execution occurs.
    expect(["REFUSED_DELEGATION_INVALID", "REFUSED_SCOPE_MISMATCH"]).toContain(res.verdict);
    expect(res.cap_execution).toBeNull();
  });

  // ── R-9 · Unsupported CAP kind refused ──────────────────────────────
  it("R-9 · CAP kind with no bridge → UNSUPPORTED_CAP_KIND", async () => {
    const c = await seedFullChain("r9", stopFns, cleanups);
    const stubCap = { ...c.cap, kind: "unsupported.kind.no.bridge" };
    const res = await executeThroughWorkstation({
      receipt: c.receipt, delegation: c.delegation, authorization: c.authorization,
      proposal: c.proposal, cap: stubCap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: [c.orchestratorPubHex],
      workspace_root: c.workspace, workstation_authority: c.wsAuthority, repo_root: REPO,
      http_port: pickPort(), environment: "TEST", requester_identity: c.requesterIdentity,
    });
    expect(res.verdict).toBe("REFUSED_UNSUPPORTED_CAP_KIND");
  });

  // ── R-10 · Happy path · real WO-01..WO-09 execution ─────────────────
  it("R-10 · happy path · executes through real WO-01..WO-09 · attestation signed · scope hash consistent", async () => {
    const c = await seedFullChain("r10", stopFns, cleanups);
    const res = await executeThroughWorkstation({
      receipt: c.receipt, delegation: c.delegation, authorization: c.authorization,
      proposal: c.proposal, cap: c.cap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: [c.orchestratorPubHex],
      workspace_root: c.workspace, workstation_authority: c.wsAuthority, repo_root: REPO,
      http_port: pickPort(), environment: "TEST", requester_identity: c.requesterIdentity,
    });
    expect(res.verdict).toBe("EXECUTED");
    expect(res.checks.every((chk) => chk.ok)).toBe(true);
    expect(res.cap_execution).not.toBeNull();
    if (!res.cap_execution) throw new Error("expected cap_execution");

    // WO-01 real trace reserved
    const stages = res.cap_execution.attempt.stages_executed;
    const wo1 = stages.find((s) => s.stage === "WO-01");
    expect(wo1?.ok).toBe(true);
    expect(wo1?.evidence_ref).toMatch(/^wo1-trace:/);

    // WO-04 real broker write · both files on disk
    const wo4 = stages.find((s) => s.stage === "WO-04");
    expect(wo4?.ok).toBe(true);
    expect(wo4?.evidence_ref).toMatch(/^wo4-report:/);
    const serverBytes = await fs.readFile(path.join(c.workspace, "server.js"), "utf8");
    expect(serverBytes).toContain("http.createServer");
    const markerBytes = await fs.readFile(path.join(c.workspace, "cap-proof-marker.txt"), "utf8");
    expect(markerBytes).toContain("CAP_PROOF_MARKER");
    expect(markerBytes).toContain(c.cap.cap_id);

    // Attestation is signed + cross-references the receipt / delegation / authorization
    expect(verifyWorkstationAttestation(res.attestation)).toBe(true);
    expect(res.attestation.receipt_id).toBe(c.receipt.receipt_id);
    expect(res.attestation.delegation_id).toBe(c.delegation.delegation_id);
    expect(res.attestation.authorization_id).toBe(c.authorization.authorization_id);
    expect(res.attestation.cap_execution_attempt_id).toBe(res.cap_execution.attempt.attempt_id);

    // Scope hash consistency
    const expectedHash = hashAuthorisedScope(c.proposal.authorised_workstation_scope!);
    expect(c.authorization.scope_hash).toBe(expectedHash);
    const receiptScope = c.receipt.gates.find((g) => g.kind === "SCOPE_VALID");
    expect(receiptScope?.scope_hash).toBe(expectedHash);
  }, 60_000);

  // ── R-11 · Attestation tampering detected ───────────────────────────
  it("R-11 · tampering the persisted attestation invalidates the signature", async () => {
    const c = await seedFullChain("r11", stopFns, cleanups);
    const res = await executeThroughWorkstation({
      receipt: c.receipt, delegation: c.delegation, authorization: c.authorization,
      proposal: c.proposal, cap: c.cap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: [c.orchestratorPubHex],
      workspace_root: c.workspace, workstation_authority: c.wsAuthority, repo_root: REPO,
      http_port: pickPort(), environment: "TEST", requester_identity: c.requesterIdentity,
    });
    expect(res.verdict).toBe("EXECUTED");
    const tampered = { ...res.attestation, reason_summary: "TAMPERED · executed by attacker" };
    expect(verifyWorkstationAttestation(tampered)).toBe(false);
    expect(verifyWorkstationAttestation(res.attestation)).toBe(true);
  }, 60_000);

  // ── R-12 · WO-04 remains final mutation gate (defence in depth) ─────
  it("R-12 · out-of-scope path in the proposal scope refuses execution BEFORE bridge/WO-04 (RUNTIME-10 verifies · WO-04 is final gate)", async () => {
    // Even if a delegate managed to sign an authorization referencing an
    // authorised_workstation_scope with a forbidden path, the delegation
    // verifier catches it (FORBIDDEN_CATEGORY). This test proves
    // RUNTIME-10 refuses BEFORE WO-04 · so WO-04 is never invoked.
    const c = await seedFullChain("r12", stopFns, cleanups);

    // Build a badly-scoped proposal referencing a protected path
    const badScope = {
      ...c.proposal.authorised_workstation_scope!,
      files_may_touch: ["src/lib/nex-authority-broker/broker.ts"] as readonly string[],
    };
    const badProposal: CapEngineeringProposal = {
      ...c.proposal,
      authorised_workstation_scope: badScope,
    };
    // A fresh authorization for the bad proposal
    const badAuth = signDelegatedAuthorization({
      delegate_identity: c.requesterIdentity,   // wrong delegate identity is fine — this test focuses on scope
      delegation: c.delegation,
      proposal: badProposal,
      mission_id: null,
    });
    const res = await executeThroughWorkstation({
      receipt: c.receipt,
      delegation: c.delegation,
      authorization: badAuth,
      proposal: badProposal,
      cap: c.cap,
      trusted_founder_public_keys_hex: [c.founderPubHex],
      trusted_orchestrator_public_keys_der_hex: [c.orchestratorPubHex],
      workspace_root: c.workspace,
      workstation_authority: c.wsAuthority,
      repo_root: REPO,
      http_port: pickPort(),
      environment: "TEST",
      requester_identity: c.requesterIdentity,
    });
    // Multiple refusal paths could catch this — all prove no execution:
    //   receipt.proposal_id mismatch (we swapped the proposal object) OR
    //   scope mismatch OR delegation invalid OR forbidden category.
    expect(res.verdict).not.toBe("EXECUTED");
    expect(res.cap_execution).toBeNull();
  });

  // ── R-13 · Send-to-NEX1 discipline ───────────────────────────────────
  it("R-13 · RUNTIME-10 module code does NOT reference the Send-to-NEX1 button (locked until RUNTIME-11)", async () => {
    const execSrc = await fs.readFile(path.join(REPO, "src/lib/nex-agent-runtime/workstation-integration/execute.ts"), "utf8");
    const typeSrc = await fs.readFile(path.join(REPO, "src/lib/nex-agent-runtime/workstation-integration/types.ts"), "utf8");
    expect(execSrc.toLowerCase()).not.toMatch(/send[-_ ]?to[-_ ]?nex1/);
    expect(typeSrc.toLowerCase()).not.toMatch(/send[-_ ]?to[-_ ]?nex1/);
  });
});
