// WO-NEX-RUNTIME-05 · NEX3 arbitration tests.
//
// Founder-locked 2026-09-13. The load-bearing test is A-5: produce a
// REAL NEX1/NEX2 disagreement and prove NEX3 arbitrates INDEPENDENTLY.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { startNex1Daemon } from "@/lib/nex-agent-runtime/nex1/daemon";
import { startNex2Daemon } from "@/lib/nex-agent-runtime/nex2/daemon";
import { startNex3Daemon } from "../daemon";
import { nex3ArbitrationCompute, nex3ArbitrateProposal, loadArbitrationsForProposal, verifyNex3Arbitration } from "../arbitration";
import { nex2ReviewProposal } from "@/lib/nex-agent-runtime/nex2/review";
import { getStorage } from "@/lib/nex/storage/registry";
import { CAP_ENGINEERING_PROPOSAL_COLLECTION, type CapEngineeringProposal, type AuthorisedWorkstationScope } from "@/lib/nex-cap/nex1-engineer";
import { persistCapabilityGap } from "@/lib/nex-cap/registry";
import type { Nex2ReviewRecord } from "@/lib/nex-agent-runtime/nex2/types";
import type { MissionContextChain } from "@/lib/nex-agent-runtime/nex1/types";

const REPO = process.cwd();
const RUN = `nex3-${randomUUID().slice(0, 8)}`;

async function nuke(p: string): Promise<void> { try { await fs.rm(p, { recursive: true, force: true }); } catch { /* ok */ } }

async function seedProposal(overrides: Partial<CapEngineeringProposal>): Promise<CapEngineeringProposal> {
  const base: CapEngineeringProposal = {
    record_type: "NEX_CAP_ENGINEERING_PROPOSAL",
    proposal_id: `CAP-PROP-${RUN}-${randomUUID()}`,
    cap_id: null,
    diagnosed_by_agent: "nex1-master-engineer",
    diagnosis: "canonical bounded diagnosis text long enough",
    proposed_fix_summary: "canonical bounded fix summary long enough",
    required_authority_scope: { authorised_tools: [], authorised_hosts: [], authorised_collections_write: [], requires_founder_signature: true },
    authorised_workstation_scope: null,
    evidence_chain: ["e-1"],
    resolver_outcome: "PROPOSE",
    founder_signature_slot: null,
    created_at: new Date().toISOString(),
    provenance_chain_hash: "hash",
    ...overrides,
  } as CapEngineeringProposal;
  await getStorage().save(CAP_ENGINEERING_PROPOSAL_COLLECTION, base);
  return base;
}

describe("WO-NEX-RUNTIME-05 · NEX3 evidence-based arbitrator", () => {
  const stopFns: Array<() => Promise<void>> = [];
  const cleanups: string[] = [];
  afterEach(async () => {
    while (stopFns.length) { const f = stopFns.pop(); if (f) await f(); }
    while (cleanups.length) { const p = cleanups.pop(); if (p) await nuke(p); }
  });

  // ── A-1 · Identity distinct from NEX1 and NEX2 ───────────────────────
  it("A-1 · NEX3 identity is distinct from BOTH NEX1 and NEX2 · three-way distinct keypairs", async () => {
    const n1 = `nex1-${RUN}-a1`;
    const n2 = `nex2-${RUN}-a1`;
    const n3 = `nex3-${RUN}-a1`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n2));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n3));

    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const d2 = await startNex2Daemon({ agent_id: n2, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d2.stop);
    const d3 = await startNex3Daemon({ agent_id: n3, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d3.stop);

    const keys = new Set([d1.identity.public_key_der_hex, d2.identity.public_key_der_hex, d3.identity.public_key_der_hex]);
    expect(keys.size).toBe(3);   // all three DIFFERENT
  });

  // ── A-2 · deterministic arbitration ───────────────────────────────────
  it("A-2 · pure nex3ArbitrationCompute is deterministic · same input → same verdict + same signals", async () => {
    const proposal = await seedProposal({ evidence_chain: ["e-1"] });
    const nex2_review: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW",
      review_id: "review-x",
      proposal_id: proposal.proposal_id,
      cap_id: null, mission_id: null, nex1_context_id: null,
      reviewed_by_agent_id: "nex2-x", reviewed_by_instance_id: "inst-x", reviewed_by_public_key_der_hex: "aa".repeat(46),
      reviewed_at: new Date().toISOString(),
      verdict: "REJECTED_UNSAFE",
      findings: [{ kind: "workstation_scope_touches_protected_root", severity: "critical", detail: "test", evidence_ref: null }],
      reason_summary: "test", evidence_ref: null,
      signature_hex: "00",
    };
    const a = nex3ArbitrationCompute({ proposal, cap: null, nex2_review, nex1_context: null });
    const b = nex3ArbitrationCompute({ proposal, cap: null, nex2_review, nex1_context: null });
    expect(a.verdict).toBe(b.verdict);
    expect(a.reject_score).toBe(b.reject_score);
    expect(a.signals.length).toBe(b.signals.length);
  });

  // ── A-3 · no review to arbitrate against → INSUFFICIENT_INPUT ─────────
  it("A-3 · no NEX2 review record · NEX3 reports INSUFFICIENT_INPUT (does NOT fabricate)", async () => {
    const proposal = await seedProposal({ evidence_chain: ["e-1"] });
    const r = nex3ArbitrationCompute({ proposal, cap: null, nex2_review: null, nex1_context: null });
    expect(r.verdict).toBe("INSUFFICIENT_INPUT");
  });

  // ── A-4 · NEX2 already agreed · no conflict to arbitrate ──────────────
  it("A-4 · NEX2 INDEPENDENTLY_VERIFIED · NEX3 returns INSUFFICIENT_INPUT (no conflict exists)", async () => {
    const proposal = await seedProposal({ evidence_chain: ["e-1"] });
    const nex2_review: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW",
      review_id: "review-verified",
      proposal_id: proposal.proposal_id,
      cap_id: null, mission_id: null, nex1_context_id: null,
      reviewed_by_agent_id: "nex2-x", reviewed_by_instance_id: "inst-x", reviewed_by_public_key_der_hex: "aa".repeat(46),
      reviewed_at: new Date().toISOString(),
      verdict: "INDEPENDENTLY_VERIFIED",
      findings: [], reason_summary: "clean", evidence_ref: null,
      signature_hex: "00",
    };
    const r = nex3ArbitrationCompute({ proposal, cap: null, nex2_review, nex1_context: null });
    expect(r.verdict).toBe("INSUFFICIENT_INPUT");
    expect(r.reason_summary).toMatch(/no NEX1\/NEX2 conflict/);
  });

  // ── A-5 · LOAD-BEARING · NEX2 rejected with only procedural mediums
  //         but NEX1 provided a complete chain · NEX3 ALLOWS ────────────
  it("A-5 · LOAD-BEARING · NEX2 rejects on procedural mediums · NEX1 chain complete · NEX3 independently ALLOWS", async () => {
    const proposal = await seedProposal({ evidence_chain: ["e-1", "e-2"] });
    const nex2_review: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW",
      review_id: "review-procedural",
      proposal_id: proposal.proposal_id,
      cap_id: null, mission_id: null, nex1_context_id: null,
      reviewed_by_agent_id: "nex2-x", reviewed_by_instance_id: "inst-x", reviewed_by_public_key_der_hex: "aa".repeat(46),
      reviewed_at: new Date().toISOString(),
      verdict: "CONFLICT_WITH_NEX1",   // NEX2 called it a conflict due to missing chain
      findings: [
        { kind: "context_chain_missing", severity: "medium", detail: "no chain observed at review time", evidence_ref: null },
        { kind: "context_chain_no_observations", severity: "medium", detail: "chain had no obs", evidence_ref: null },
      ],
      reason_summary: "procedural conflict", evidence_ref: null,
      signature_hex: "00",
    };
    const richChain: MissionContextChain = {
      record_type: "NEX1_MISSION_CONTEXT_CHAIN",
      context_id: "ctx-rich",
      agent_id: "nex1", instance_id: "inst-1",
      mission_id: "m-a5",
      observations: [{ at: "now", kind: "read_file", detail: "read src/x.ts", evidence_ref: "ev-1" }],
      knowledge_used: [{ at: "now", kind: "cap_kind", detail: "known kind", evidence_ref: null }],
      analysis: [{ at: "now", kind: "cap_diagnosis_prepared", detail: "analysed", evidence_ref: null }],
      files_considered: ["src/x.ts"], tests_considered: [],
      proposed_solution: { at: "now", kind: "proposed_solution", detail: "fix", evidence_ref: null },
      evidence_refs: ["ev-1"], handoff: null,
      started_at: "now", closed_at: "now",
      signature_hex: "00",
    };
    const r = nex3ArbitrationCompute({ proposal, cap: null, nex2_review, nex1_context: richChain });
    // NEX3 should ALLOW: procedural-only rejection + complete NEX1 chain
    expect(r.verdict).toBe("ALLOW");
    expect(r.allow_score).toBeGreaterThan(r.reject_score);
    // Must cite chain-complete + medium-findings-only reasoning
    expect(r.signals.some((s) => s.kind === "nex1_chain_complete")).toBe(true);
    expect(r.signals.some((s) => s.kind === "nex2_medium_findings_only")).toBe(true);
  });

  // ── A-6 · CAP security-critical + critical NEX2 finding → REJECT gate ─
  it("A-6 · security-critical CAP kind + NEX2 critical finding · NEX3 REJECT via risk-asymmetry gate", async () => {
    const cap = await persistCapabilityGap({
      kind: "guardian.te.evidence_source_registry_untrusted",
      category: "SECURITY", priority: "HIGH",
      title: "registry-tamper adversarial test", evidence: [{ collection: "test", record_id: "a6", kind: "t" }],
      detector_agent_id: "nex3-adversarial",
      dedupe_key: `a6-${RUN}-${randomUUID()}`,
    });
    const proposal = await seedProposal({ cap_id: cap.cap_id, evidence_chain: [cap.cap_id] });
    const nex2_review: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW", review_id: "review-crit",
      proposal_id: proposal.proposal_id, cap_id: cap.cap_id, mission_id: null, nex1_context_id: null,
      reviewed_by_agent_id: "nex2-x", reviewed_by_instance_id: "inst-x", reviewed_by_public_key_der_hex: "aa".repeat(46),
      reviewed_at: new Date().toISOString(),
      verdict: "REJECTED_UNSAFE",
      findings: [{ kind: "escalate_only_kind_not_escalated", severity: "critical", detail: "security-critical", evidence_ref: null }],
      reason_summary: "critical rejection", evidence_ref: null,
      signature_hex: "00",
    };
    const r = nex3ArbitrationCompute({ proposal, cap, nex2_review, nex1_context: null });
    expect(r.verdict).toBe("REJECT");
    expect(r.signals.some((s) => s.kind === "risk_asymmetry_reject")).toBe(true);
  });

  // ── A-7 · Signed arbitration · verifiable by external process ────────
  it("A-7 · arbitration record is signed by NEX3's key · verifiable · queryable by proposal_id", async () => {
    const n3 = `nex3-${RUN}-a7`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n3));
    const d3 = await startNex3Daemon({ agent_id: n3, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d3.stop);

    // Set up an unarbitrated conflict: seed a proposal + write a NEX2
    // rejection review directly.
    const proposal = await seedProposal({ evidence_chain: ["e-1"] });
    const n2Fake = `nex2-fake-${RUN}-a7`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n2Fake));
    const d2 = await startNex2Daemon({ agent_id: n2Fake, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d2.stop);
    // Force NEX2 to review this proposal so we have a real rejection review
    await nex2ReviewProposal({ identity: d2.identity, instance_id: d2.handle.instance_id, proposal_id: proposal.proposal_id });

    // Now NEX3 arbitrates
    const arb = await nex3ArbitrateProposal({ identity: d3.identity, instance_id: d3.handle.instance_id, proposal_id: proposal.proposal_id });
    expect(arb.arbitrated_by_agent_id).toBe(n3);
    expect(arb.arbitrated_by_public_key_der_hex).toBe(d3.identity.public_key_der_hex);
    expect(verifyNex3Arbitration(d3.identity.public_key_der_hex, arb)).toBe(true);
    // Not verifiable against wrong key
    expect(verifyNex3Arbitration("00".repeat(46), arb)).toBe(false);

    const rows = await loadArbitrationsForProposal(proposal.proposal_id);
    expect(rows.some((r) => r.arbitration_id === arb.arbitration_id)).toBe(true);
  });

  // ── A-8 · stolen-key defence: NEX3 refuses if keypair matches any other identity
  it("A-8 · NEX3 refuses to start if its identity keypair matches ANY other agent's published identity", async () => {
    const n1 = `nex1-${RUN}-a8`;
    const n3 = `nex3-${RUN}-a8`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n3));

    // Start NEX1 to publish its identity
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);

    // Copy NEX1's identity file over NEX3's
    const src = path.join(REPO, "data", "nex-agent-runtime", "identities", n1, "keypair.jsonl");
    const raw = await fs.readFile(src, "utf8");
    const stolen = raw.replace(new RegExp(n1, "g"), n3);
    const dst = path.join(REPO, "data", "nex-agent-runtime", "identities", n3);
    await fs.mkdir(dst, { recursive: true });
    await fs.writeFile(path.join(dst, "keypair.jsonl"), stolen, "utf8");

    await expect(startNex3Daemon({ agent_id: n3, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true })).rejects.toThrow(/collapse team independence/);
  });

  // ── A-9 · Ambiguous conflict → ESCALATE_TO_FOUNDER ───────────────────
  it("A-9 · balanced signals · NEX3 escalates to founder rather than guessing", async () => {
    const proposal = await seedProposal({ evidence_chain: ["e-1"] });
    // Construct a NEX2 review with ONE high finding (25 reject weight)
    // and provide a complete NEX1 chain (20 allow weight). Neither
    // dominates → ESCALATE (or ALLOW/REJECT depending on 3x rule).
    // With reject_score=25 and allow_score=20+5(evidence)=25, tie →
    // ESCALATE_TO_FOUNDER by the derivation rule.
    const nex2_review: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW", review_id: "review-balanced",
      proposal_id: proposal.proposal_id, cap_id: null, mission_id: null, nex1_context_id: null,
      reviewed_by_agent_id: "nex2-x", reviewed_by_instance_id: "inst-x", reviewed_by_public_key_der_hex: "aa".repeat(46),
      reviewed_at: new Date().toISOString(),
      verdict: "REJECTED_INCOMPLETE_EVIDENCE",
      findings: [
        { kind: "empty_evidence_chain", severity: "high", detail: "gap", evidence_ref: null },
      ],
      reason_summary: "single high", evidence_ref: null,
      signature_hex: "00",
    };
    const chain: MissionContextChain = {
      record_type: "NEX1_MISSION_CONTEXT_CHAIN", context_id: "ctx-a9",
      agent_id: "nex1", instance_id: "i1", mission_id: "m-a9",
      observations: [{ at: "now", kind: "x", detail: "obs", evidence_ref: null }],
      knowledge_used: [], analysis: [{ at: "now", kind: "y", detail: "an", evidence_ref: null }],
      files_considered: ["f.ts"], tests_considered: [],
      proposed_solution: { at: "now", kind: "z", detail: "sol", evidence_ref: null },
      evidence_refs: ["e-1"], handoff: null, started_at: "now", closed_at: "now",
      signature_hex: "00",
    };
    // Add extra evidence for evidence-chain-length signal +5
    const p2 = { ...proposal, evidence_chain: ["e-1", "e-2"] } as CapEngineeringProposal;
    const r = nex3ArbitrationCompute({ proposal: p2, cap: null, nex2_review, nex1_context: chain });
    // reject_score=25 (high finding), allow_score=20 (chain complete) + 5 (evidence >= 2) = 25
    // neither 3x dominates → ESCALATE
    expect(r.verdict).toBe("ESCALATE_TO_FOUNDER");
  });
});
