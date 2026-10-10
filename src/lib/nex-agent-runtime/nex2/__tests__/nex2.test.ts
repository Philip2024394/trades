// WO-NEX-RUNTIME-04 · NEX2 independent reviewer tests.
//
// Founder-locked 2026-09-13. The LOAD-BEARING test is R-5: give NEX1
// a deliberately BAD proposal and prove NEX2 catches and rejects it.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { startNex1Daemon } from "@/lib/nex-agent-runtime/nex1/daemon";
import { startNex2Daemon } from "../daemon";
import { nex2ReviewCompute, nex2ReviewProposal, loadReviewsForProposal, verifyNex2Review } from "../review";
import { getStorage } from "@/lib/nex/storage/registry";
import { CAP_ENGINEERING_PROPOSAL_COLLECTION, type CapEngineeringProposal, type AuthorisedWorkstationScope } from "@/lib/nex-cap/nex1-engineer";
import { persistCapabilityGap } from "@/lib/nex-cap/registry";
import type { MissionContextChain } from "@/lib/nex-agent-runtime/nex1/types";

const REPO = process.cwd();
const RUN = `nex2-${randomUUID().slice(0, 8)}`;

async function nuke(p: string): Promise<void> { try { await fs.rm(p, { recursive: true, force: true }); } catch { /* ok */ } }

/** Persist a raw proposal into GB directly · lets us construct proposals
 *  the resolver wouldn't produce, for adversarial testing. */
async function seedRawProposal(overrides: Partial<CapEngineeringProposal>): Promise<CapEngineeringProposal> {
  const base: CapEngineeringProposal = {
    record_type: "NEX_CAP_ENGINEERING_PROPOSAL",
    proposal_id: `CAP-PROP-BAD-${randomUUID()}`,
    cap_id: null,
    diagnosed_by_agent: "nex1-master-engineer",
    diagnosis: "canonical bounded diagnosis text long enough to pass length check",
    proposed_fix_summary: "canonical bounded fix summary long enough to pass length check",
    required_authority_scope: {
      authorised_tools: [], authorised_hosts: [], authorised_collections_write: [],
      requires_founder_signature: true,
    },
    authorised_workstation_scope: null,
    evidence_chain: ["cap-evidence-1"],
    resolver_outcome: "PROPOSE",
    founder_signature_slot: null,
    created_at: new Date().toISOString(),
    provenance_chain_hash: "hash",
    ...overrides,
  } as CapEngineeringProposal;
  await getStorage().save(CAP_ENGINEERING_PROPOSAL_COLLECTION, base);
  return base;
}

describe("WO-NEX-RUNTIME-04 · NEX2 independent reviewer", () => {
  const stopFns: Array<() => Promise<void>> = [];
  const cleanups: string[] = [];
  afterEach(async () => {
    while (stopFns.length) { const f = stopFns.pop(); if (f) await f(); }
    while (cleanups.length) { const p = cleanups.pop(); if (p) await nuke(p); }
  });

  // ── R-1 · NEX2 identity is DISTINCT from NEX1 identity ───────────────
  it("R-1 · NEX2's Ed25519 identity is different from NEX1's · they are architecturally distinct", async () => {
    const nex1_id = `nex1-${RUN}-r1`;
    const nex2_id = `nex2-${RUN}-r1`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex1_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id));

    const nex1 = await startNex1Daemon({ agent_id: nex1_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(nex1.stop);
    const nex2 = await startNex2Daemon({ agent_id: nex2_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(nex2.stop);

    expect(nex2.identity.public_key_der_hex).not.toBe(nex1.identity.public_key_der_hex);
    expect(nex2.identity.agent_id).not.toBe(nex1.identity.agent_id);
  });

  // ── R-2 · pure review logic · deterministic ──────────────────────────
  it("R-2 · nex2ReviewCompute is deterministic · same input → same verdict + same findings", async () => {
    const proposal = await seedRawProposal({
      proposal_id: `CAP-PROP-DET-${RUN}-${randomUUID()}`,
      cap_id: null, evidence_chain: ["e-1"],
    });
    const a = nex2ReviewCompute({ proposal, cap: null, nex1_context: null, mission_id: null });
    const b = nex2ReviewCompute({ proposal, cap: null, nex1_context: null, mission_id: null });
    expect(a.verdict).toBe(b.verdict);
    expect(a.findings.length).toBe(b.findings.length);
    expect(a.reason_summary).toBe(b.reason_summary);
  });

  // ── R-3 · empty evidence chain → REJECTED_INCOMPLETE_EVIDENCE ────────
  it("R-3 · empty evidence chain · NEX2 rejects", async () => {
    const proposal = await seedRawProposal({
      proposal_id: `CAP-PROP-NOEV-${RUN}-${randomUUID()}`,
      evidence_chain: [],  // BAD: empty
    });
    const r = nex2ReviewCompute({ proposal, cap: null, nex1_context: null, mission_id: null });
    expect(r.verdict).toBe("REJECTED_INCOMPLETE_EVIDENCE");
    expect(r.findings.some((f) => f.kind === "empty_evidence_chain")).toBe(true);
  });

  // ── R-4 · escalate-only kind with PROPOSE outcome → ESCALATE_TO_FOUNDER
  it("R-4 · escalate-only CAP kind with PROPOSE outcome · NEX2 escalates", async () => {
    const cap = await persistCapabilityGap({
      kind: "guardian.te.evidence_source_registry_untrusted",
      category: "SECURITY", priority: "HIGH",
      title: "test registry-tamper (adversarial)",
      evidence: [{ collection: "test", record_id: "r4", kind: "test" }],
      detector_agent_id: "nex2-adversarial-test",
      dedupe_key: `r4-${RUN}-${randomUUID()}`,
    });
    const proposal = await seedRawProposal({
      proposal_id: `CAP-PROP-ESC-${RUN}-${randomUUID()}`,
      cap_id: cap.cap_id,
      resolver_outcome: "PROPOSE",   // BAD: should be ESCALATE for this kind
      evidence_chain: [cap.cap_id],
    });
    const r = nex2ReviewCompute({ proposal, cap, nex1_context: null, mission_id: null });
    expect(r.verdict).toBe("ESCALATE_TO_FOUNDER");
    expect(r.findings.some((f) => f.kind === "escalate_only_kind_not_escalated")).toBe(true);
  });

  // ── R-5 · LOAD-BEARING · workstation scope covers protected substrate ─
  //          the founder-named "bad proposal · NEX2 catches" test.
  it("R-5 · LOAD-BEARING · BAD proposal with scope covering protected substrate · NEX2 REJECTS_UNSAFE", async () => {
    // Adversarial scope: authorised_workstation_scope covers the Authority
    // Broker itself · a legitimate resolver would NEVER produce this
    const badScope: AuthorisedWorkstationScope = Object.freeze({
      files_may_touch: Object.freeze(["src/lib/nex-authority-broker/broker.ts", "some-other-file.ts"]) as readonly string[],
      build_targets: Object.freeze([]) as readonly string[],
      collections_may_write: Object.freeze([]) as readonly string[],
      stages_required: Object.freeze(["WO-04"]) as readonly ("WO-04")[],
      runtime_required: false,
    });
    const proposal = await seedRawProposal({
      proposal_id: `CAP-PROP-EVIL-${RUN}-${randomUUID()}`,
      authorised_workstation_scope: badScope,
      evidence_chain: ["e-1"],
    });
    const r = nex2ReviewCompute({ proposal, cap: null, nex1_context: null, mission_id: null });
    expect(r.verdict).toBe("REJECTED_UNSAFE");
    expect(r.findings.some((f) => f.kind === "workstation_scope_touches_protected_root")).toBe(true);
    expect(r.findings.some((f) => f.detail.includes("nex-authority-broker"))).toBe(true);
  });

  // ── R-6 · clean proposal → INDEPENDENTLY_VERIFIED ────────────────────
  it("R-6 · clean proposal (evidence + no scope violations) · NEX2 independently VERIFIES", async () => {
    const proposal = await seedRawProposal({
      proposal_id: `CAP-PROP-CLEAN-${RUN}-${randomUUID()}`,
      evidence_chain: ["e-1", "e-2"],
      authorised_workstation_scope: null,
    });
    const r = nex2ReviewCompute({ proposal, cap: null, nex1_context: null, mission_id: null });
    expect(r.verdict).toBe("INDEPENDENTLY_VERIFIED");
    expect(r.findings.length).toBe(0);
  });

  // ── R-7 · non-existent proposal → INSUFFICIENT_REVIEW_INPUT ──────────
  it("R-7 · proposal not found · NEX2 records INSUFFICIENT_REVIEW_INPUT (does NOT fabricate)", async () => {
    const nex2_id = `nex2-${RUN}-r7`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id));
    const nex2 = await startNex2Daemon({ agent_id: nex2_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(nex2.stop);

    const review = await nex2ReviewProposal({
      identity: nex2.identity, instance_id: nex2.handle.instance_id,
      proposal_id: "CAP-PROP-DOES-NOT-EXIST-9999",
    });
    expect(review.verdict).toBe("INSUFFICIENT_REVIEW_INPUT");
    // Review is signed by nex2's identity · verifiable
    expect(verifyNex2Review(nex2.identity.public_key_der_hex, review)).toBe(true);
    // NOT verifiable against a different key
    expect(verifyNex2Review("00".repeat(46), review)).toBe(false);
  });

  // ── R-8 · Written review is agent-signed and reconstructable ─────────
  it("R-8 · full review record is signed by NEX2 identity · verifiable · queryable by proposal_id", async () => {
    const nex2_id = `nex2-${RUN}-r8`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id));
    const nex2 = await startNex2Daemon({ agent_id: nex2_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(nex2.stop);

    const proposal = await seedRawProposal({
      proposal_id: `CAP-PROP-SIG-${RUN}-${randomUUID()}`,
      evidence_chain: ["e-sig"],
    });
    const review = await nex2ReviewProposal({
      identity: nex2.identity, instance_id: nex2.handle.instance_id,
      proposal_id: proposal.proposal_id,
    });
    expect(review.reviewed_by_agent_id).toBe(nex2_id);
    expect(review.reviewed_by_public_key_der_hex).toBe(nex2.identity.public_key_der_hex);
    expect(verifyNex2Review(nex2.identity.public_key_der_hex, review)).toBe(true);

    // Query back from storage
    const rows = await loadReviewsForProposal(proposal.proposal_id);
    const mine = rows.find((r) => r.review_id === review.review_id);
    expect(mine).toBeDefined();
    expect(verifyNex2Review(nex2.identity.public_key_der_hex, mine!)).toBe(true);
  });

  // ── R-9 · NEX1 and NEX2 keys must differ · daemon refuses to start otherwise
  it("R-9 · NEX2 refuses to start if its identity keypair matches NEX1's (defence in depth)", async () => {
    const nex1_id = `nex1-${RUN}-r9`;
    const nex2_id = `nex2-${RUN}-r9`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex1_id));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id));

    // Bootstrap NEX1's identity
    const nex1 = await startNex1Daemon({ agent_id: nex1_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(nex1.stop);

    // Copy NEX1's identity file over NEX2's (adversarial)
    const nex1Kp = path.join(REPO, "data", "nex-agent-runtime", "identities", nex1_id, "keypair.jsonl");
    const raw = await fs.readFile(nex1Kp, "utf8");
    const stolen = raw.replace(new RegExp(nex1_id, "g"), nex2_id);
    const nex2Dir = path.join(REPO, "data", "nex-agent-runtime", "identities", nex2_id);
    await fs.mkdir(nex2Dir, { recursive: true });
    await fs.writeFile(path.join(nex2Dir, "keypair.jsonl"), stolen, "utf8");

    // Attempt to start NEX2 with the stolen (NEX1-copied) keypair
    await expect(startNex2Daemon({ agent_id: nex2_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true })).rejects.toThrow(/collapse team independence/);
  });

  // ── R-10 · Findings on missing context chain → CONFLICT_WITH_NEX1 ────
  it("R-10 · NEX1 context chain missing observations + analysis + evidence · NEX2 flags CONFLICT_WITH_NEX1", async () => {
    const proposal = await seedRawProposal({
      proposal_id: `CAP-PROP-BADCTX-${RUN}-${randomUUID()}`,
      evidence_chain: ["e-1"],
    });
    const emptyChain: MissionContextChain = {
      record_type: "NEX1_MISSION_CONTEXT_CHAIN",
      context_id: "ctx-empty",
      agent_id: "nex1",
      instance_id: "inst-x",
      mission_id: "m-x",
      observations: [], knowledge_used: [], analysis: [],
      files_considered: [], tests_considered: [],
      proposed_solution: null, evidence_refs: [],
      handoff: null, started_at: "", closed_at: "",
      signature_hex: "00",
    };
    const r = nex2ReviewCompute({ proposal, cap: null, nex1_context: emptyChain, mission_id: null });
    expect(r.verdict).toBe("CONFLICT_WITH_NEX1");
    expect(r.findings.filter((f) => f.kind.startsWith("context_chain_")).length).toBeGreaterThanOrEqual(2);
  });
});
