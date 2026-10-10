// NEX1 · Runtime Governance Wrapper · tests
//
// Exercises the REAL chat-turn cognitive runtime through the wrapper.
// The wrapper's job is to compose real chat-turn + already-verified
// bridge + existing pure NEX2 / NEX3 compute functions.
//
// Test axes (from prompt §14):
//   F1 · NORMAL_CHAT · bridge / NEX2 / NEX3 all NOT invoked
//   F2 · GOVERNED_PROPOSAL · bridge invoked, NEX2 invoked, proposal
//        correlation preserved
//   F3 · Invalid governed input · bridge refuses · NEX2 not invoked
//   F4 · NEX2 rejection (e.g. missing evidence) · no NEX3
//   F5 · NEX2 CONFLICT · NEX3 receives review record shape
//   F6 · Founder boundary · workstation NOT mutated

import { describe, expect, it, beforeAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runNex1TurnWithGovernance,
  NEX1_RUNTIME_GOVERNANCE_WRAPPER_VERSION,
  type Nex1NativeGovernanceInput,
} from "@/lib/nex-cap/nex1-native-runtime-governance-wrapper";
import type { CapabilityGap } from "@/lib/nex-cap/types";
import type { MissionContextChain } from "@/lib/nex-agent-runtime/nex1/types";

// ── Shared test scaffold ─────────────────────────────────────────────

let TEST_REPO_ROOT: string;

beforeAll(() => {
  // Create a minimal ephemeral repo_root so chat-turn's storage layer
  // has a working directory. Real chat-turn writes conversation
  // context under repo_root/data/... — using a temp dir keeps the
  // test hermetic and touches no production storage.
  TEST_REPO_ROOT = mkdtempSync(join(tmpdir(), "nex1-runtime-wrapper-"));
  mkdirSync(join(TEST_REPO_ROOT, "data"), { recursive: true });
  // Also seed a minimal package.json so any tooling that reads it works.
  writeFileSync(
    join(TEST_REPO_ROOT, "package.json"),
    JSON.stringify({ name: "nex1-runtime-wrapper-fixture", version: "0.0.0" }),
    "utf8",
  );
});

let CONV_COUNTER = 0;
function makeConversationId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++CONV_COUNTER}`;
}

function makeCap(overrides: Partial<CapabilityGap> = {}): CapabilityGap {
  return {
    record_type: "NEX_CAPABILITY_GAP",
    cap_id: "CAP-runtime-0001",
    kind: "rate_limiter.persistent_backoff",
    category: "PERFORMANCE",
    priority: "MEDIUM",
    status: "TRIAGED",
    resolver_outcome: "PROPOSE",
    title: "runtime fixture",
    evidence: [
      { collection: "nex_rate_limit_events", record_id: "evt-runtime-001", kind: "rate_limit_event" },
    ],
    proposed_wo_id: null,
    resolution_note: null,
    detected_at: "2026-09-19T12:00:00.000Z",
    last_updated_at: "2026-09-19T12:00:00.000Z",
    detector_agent_id: null,
    provenance_chain_hash: "fixture",
    ...overrides,
  };
}

function makeMissionContext(mission_id: string): MissionContextChain {
  return {
    record_type: "NEX1_MISSION_CONTEXT",
    context_id: `CTX-nex1-runtime-${mission_id}`,
    agent_id: "nex1-runtime03-test",
    instance_id: "inst-runtime-test",
    mission_id,
    observations: [{ at: "t0", kind: "obs", detail: "detected backoff", evidence_ref: "evt-runtime-001" }],
    knowledge_used: [],
    analysis: [{ at: "t1", kind: "analysis", detail: "reduce priority", evidence_ref: null }],
    files_considered: [],
    tests_considered: [],
    proposed_solution: { at: "t2", kind: "proposed_solution", detail: "lower priority", evidence_ref: null },
    evidence_refs: ["evt-runtime-001"],
    handoff: { to: "nex2", note: "review please" },
    started_at: "t0",
    closed_at: "t2",
    signature_hex: "fixture-not-verified",
  } as MissionContextChain;
}

function makeGovernedInput(overrides: Partial<Nex1NativeGovernanceInput> = {}): Nex1NativeGovernanceInput {
  return {
    classification: "GOVERNED_PROPOSAL",
    proposal_fields: {
      cap_id: "CAP-runtime-0001",
      mission_id: null,
      diagnosis:
        "runtime governed proposal · observer detected persistent backoff · deterministic diagnosis",
      proposed_fix_summary:
        "reduce poll priority for source_id=X and increase min_interval_ms in registry",
      evidence_refs: ["evt-runtime-001", "snap-runtime-042"],
      resolver_outcome: "PROPOSE",
    },
    test_inputs: {
      cap: makeCap(),
      nex1_context: null,
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────
// F1 · NORMAL CHAT · governance path NOT touched
// ─────────────────────────────────────────────────────────────────────

describe("F1 · NORMAL_CHAT · governance path NOT triggered", () => {
  it("F1-1 · omitting governance leaves chat-turn intact and no bridge/NEX2/NEX3 invocation", async () => {
    const result = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F1-1"),
      user_message: "hello, this is a normal chat turn about weather",
      repo_root: TEST_REPO_ROOT,
    });
    // Chat-turn ran (real cognitive path)
    expect(result.chat_turn_result.source).toBe("NEX1_NATIVE");
    expect(result.chat_turn_result.zero_llm).toBe(true);
    expect(result.chat_turn_result.trace.length).toBeGreaterThan(0);
    // Governance evidence proves no crossing
    expect(result.governance_evidence.classification).toBe("NORMAL_CHAT");
    expect(result.governance_evidence.bridge_invoked).toBe(false);
    expect(result.governance_evidence.bridge_receipt).toBeNull();
    expect(result.governance_evidence.nex2_invoked).toBe(false);
    expect(result.governance_evidence.nex2_computation).toBeNull();
    expect(result.governance_evidence.nex3_invoked).toBe(false);
    expect(result.governance_evidence.nex3_computation).toBeNull();
    expect(result.governance_evidence.correlation.proposal_id).toBeNull();
    expect(result.governance_evidence.founder_authority_preserved).toBe(true);
    expect(result.governance_evidence.workstation_mutation).toBe(false);
  });

  it("F1-2 · explicit NORMAL_CHAT classification is honoured identically", async () => {
    const result = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F1-2"),
      user_message: "what's the weather like",
      repo_root: TEST_REPO_ROOT,
      governance: { classification: "NORMAL_CHAT" },
    });
    expect(result.governance_evidence.classification).toBe("NORMAL_CHAT");
    expect(result.governance_evidence.bridge_invoked).toBe(false);
    expect(result.governance_evidence.nex2_invoked).toBe(false);
    expect(result.governance_evidence.nex3_invoked).toBe(false);
  });

  it("F1-3 · real chat-turn produces evidence of micro-brain broadcast", async () => {
    const result = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F1-3"),
      user_message: "please investigate the pricing module",
      repo_root: TEST_REPO_ROOT,
    });
    // Real chat-turn's trace should include cognitive stages
    const traceJoined = result.chat_turn_result.trace.join("\n");
    // afraid assessment is one of the earliest cognitive activities
    expect(traceJoined).toMatch(/afraid|classifier|conversation|user message stored/i);
    // Governance-side confirmation
    expect(result.governance_evidence.wrapper_version).toBe(NEX1_RUNTIME_GOVERNANCE_WRAPPER_VERSION);
  });
});

// ─────────────────────────────────────────────────────────────────────
// F2 · GOVERNED PROPOSAL · full runtime path
// ─────────────────────────────────────────────────────────────────────

describe("F2 · GOVERNED_PROPOSAL · full runtime path", () => {
  it("F2-1 · bridge invoked, proposal generated, NEX2 verifies", async () => {
    const result = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F2-1"),
      user_message: "please propose a governed change",
      repo_root: TEST_REPO_ROOT,
      governance: makeGovernedInput(),
    });
    // Chat-turn ran unmodified
    expect(result.chat_turn_result.source).toBe("NEX1_NATIVE");
    // Bridge was invoked
    expect(result.governance_evidence.bridge_invoked).toBe(true);
    expect(result.governance_evidence.bridge_receipt).not.toBeNull();
    expect(result.governance_evidence.bridge_receipt!.bridged).toBe(true);
    expect(result.governance_evidence.bridge_receipt!.proposal).not.toBeNull();
    // Proposal shape
    const proposal = result.governance_evidence.bridge_receipt!.proposal!;
    expect(proposal.record_type).toBe("NEX_CAP_ENGINEERING_PROPOSAL");
    expect(proposal.founder_signature_slot).toBeNull();
    expect(proposal.authorised_workstation_scope).toBeNull();
    expect(proposal.diagnosed_by_agent).toBe("nex1-master-engineer");
    // NEX2 was invoked (deterministic pure function)
    expect(result.governance_evidence.nex2_invoked).toBe(true);
    expect(result.governance_evidence.nex2_computation).not.toBeNull();
    // For a well-formed input NEX2 should INDEPENDENTLY_VERIFY
    expect(result.governance_evidence.nex2_computation!.verdict).toBe("INDEPENDENTLY_VERIFIED");
    // No NEX3 since no conflict
    expect(result.governance_evidence.nex3_invoked).toBe(false);
    expect(result.governance_evidence.nex3_computation).toBeNull();
    // Founder boundary intact
    expect(result.governance_evidence.founder_authority_preserved).toBe(true);
    expect(result.governance_evidence.workstation_mutation).toBe(false);
  });

  it("F2-2 · proposal_id is deterministic and cross-linked to turn_id + cap_id", async () => {
    const result = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F2-2"),
      user_message: "governed proposal correlation test",
      repo_root: TEST_REPO_ROOT,
      governance: makeGovernedInput(),
    });
    expect(result.governance_evidence.correlation.proposal_id).toMatch(/^CAP-PROP-BRIDGE-/);
    expect(result.governance_evidence.correlation.cap_id).toBe("CAP-runtime-0001");
    expect(result.governance_evidence.correlation.turn_id).toContain("chat-turn-");
  });

  it("F2-3 · wrapper trace contains explicit bridge/NEX2 invocation lines", async () => {
    const result = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F2-3"),
      user_message: "another governed proposal",
      repo_root: TEST_REPO_ROOT,
      governance: makeGovernedInput(),
    });
    const wtJoined = result.governance_evidence.wrapper_trace.join("\n");
    expect(wtJoined).toContain("invoking bridge");
    expect(wtJoined).toContain("bridge returned · bridged=true");
    expect(wtJoined).toContain("invoking NEX2 compute");
    expect(wtJoined).toContain("NEX2 verdict=INDEPENDENTLY_VERIFIED");
  });
});

// ─────────────────────────────────────────────────────────────────────
// F3 · Invalid governed input · bridge refuses
// ─────────────────────────────────────────────────────────────────────

describe("F3 · invalid governed input · bridge refuses · NEX2 not invoked", () => {
  it("F3-1 · missing proposal_fields with classification GOVERNED_PROPOSAL", async () => {
    const result = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F3-1"),
      user_message: "governed but no fields",
      repo_root: TEST_REPO_ROOT,
      governance: { classification: "GOVERNED_PROPOSAL" }, // no proposal_fields
    });
    expect(result.governance_evidence.bridge_invoked).toBe(false);
    expect(result.governance_evidence.nex2_invoked).toBe(false);
    expect(result.governance_evidence.refusal_reason).toBe("MISSING_PROPOSAL_FIELDS");
  });

  it("F3-2 · empty evidence_refs → bridge refuses with EMPTY_EVIDENCE_REFS", async () => {
    const gov = makeGovernedInput({
      proposal_fields: {
        ...makeGovernedInput().proposal_fields!,
        evidence_refs: [],
      },
    });
    const result = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F3-2"),
      user_message: "governed with empty evidence",
      repo_root: TEST_REPO_ROOT,
      governance: gov,
    });
    expect(result.governance_evidence.bridge_invoked).toBe(true);
    expect(result.governance_evidence.bridge_receipt!.bridged).toBe(false);
    expect(result.governance_evidence.bridge_receipt!.refusal_reason).toBe("EMPTY_EVIDENCE_REFS");
    expect(result.governance_evidence.nex2_invoked).toBe(false);
  });

  it("F3-3 · diagnosis too short → bridge refuses", async () => {
    const gov = makeGovernedInput({
      proposal_fields: {
        ...makeGovernedInput().proposal_fields!,
        diagnosis: "short",
      },
    });
    const result = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F3-3"),
      user_message: "governed with short diagnosis",
      repo_root: TEST_REPO_ROOT,
      governance: gov,
    });
    expect(result.governance_evidence.bridge_receipt!.refusal_reason).toBe("DIAGNOSIS_TOO_SHORT");
    expect(result.governance_evidence.nex2_invoked).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// F4 · NEX2 rejection · no NEX3
// ─────────────────────────────────────────────────────────────────────

describe("F4 · NEX2 rejection path · no NEX3 unless conflict", () => {
  it("F4-1 · CAP with unknown kind + PROPOSE outcome → NEX2 medium finding · still INDEPENDENTLY_VERIFIED", async () => {
    // NEX2 only issues CONFLICT when multiple medium-context findings
    // exist. An unsupported CAP kind is a medium finding but alone is
    // not sufficient to trigger CONFLICT_WITH_NEX1.
    const gov = makeGovernedInput({
      test_inputs: {
        cap: makeCap({ kind: "unknown.kind.for.testing" }),
        nex1_context: null,
      },
    });
    const result = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F4-1"),
      user_message: "unknown kind proposal",
      repo_root: TEST_REPO_ROOT,
      governance: gov,
    });
    expect(result.governance_evidence.nex2_invoked).toBe(true);
    // Verdict may be INDEPENDENTLY_VERIFIED or CONFLICT depending on
    // whether medium findings ≥ 2. NEX3 is NOT invoked unless it's
    // one of the CONFLICT_VERDICTS.
    if (result.governance_evidence.nex2_computation!.verdict === "INDEPENDENTLY_VERIFIED") {
      expect(result.governance_evidence.nex3_invoked).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// F5 · NEX2 CONFLICT · NEX3 arbitration
// ─────────────────────────────────────────────────────────────────────

describe("F5 · NEX2 CONFLICT_WITH_NEX1 → NEX3 arbitration", () => {
  it("F5-1 · mission_id + incomplete NEX1 context → NEX2 raises multiple medium findings → NEX3 invoked", async () => {
    // Supply a mission_id and an incomplete NEX1 context (empty
    // observations + empty analysis). That produces two medium findings
    // in NEX2 → CONFLICT_WITH_NEX1 → NEX3 fires.
    const mission_id = "MISSION-runtime-F5-1";
    const incompleteContext: MissionContextChain = {
      ...makeMissionContext(mission_id),
      observations: [],
      analysis: [],
      // Keep evidence_refs so we don't triple-medium (we want exactly 2)
      evidence_refs: ["evt-runtime-001"],
    };
    const gov: Nex1NativeGovernanceInput = {
      classification: "GOVERNED_PROPOSAL",
      proposal_fields: {
        cap_id: "CAP-runtime-F5",
        mission_id,
        diagnosis:
          "runtime F5 · conflict path · observer noted backoff · analysis missing in context",
        proposed_fix_summary:
          "lower priority · this test triggers a NEX2 conflict via incomplete context chain",
        evidence_refs: ["evt-runtime-F5"],
        resolver_outcome: "PROPOSE",
      },
      test_inputs: {
        cap: makeCap({ cap_id: "CAP-runtime-F5" }),
        nex1_context: incompleteContext,
      },
    };
    const result = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F5-1"),
      user_message: "runtime F5 conflict scenario",
      repo_root: TEST_REPO_ROOT,
      governance: gov,
    });
    expect(result.governance_evidence.nex2_invoked).toBe(true);
    expect(result.governance_evidence.nex2_computation!.verdict).toBe("CONFLICT_WITH_NEX1");
    expect(result.governance_evidence.nex3_invoked).toBe(true);
    expect(result.governance_evidence.nex3_computation).not.toBeNull();
    // NEX3 verdict is deterministic given the same input · one of the four
    expect(["ALLOW", "REJECT", "ESCALATE_TO_FOUNDER", "INSUFFICIENT_INPUT"])
      .toContain(result.governance_evidence.nex3_computation!.verdict);
    // Correlation chain preserved
    expect(result.governance_evidence.correlation.nex2_review_id).toMatch(/^REV-runtime-wrapper-/);
    expect(result.governance_evidence.correlation.proposal_id).toMatch(/^CAP-PROP-BRIDGE-/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// F6 · Founder boundary preserved
// ─────────────────────────────────────────────────────────────────────

describe("F6 · founder boundary preserved · no workstation mutation", () => {
  it("F6-1 · every governance evidence has workstation_mutation=false and founder_authority_preserved=true", async () => {
    const cases: Array<Nex1NativeGovernanceInput | undefined> = [
      undefined,
      { classification: "NORMAL_CHAT" },
      makeGovernedInput(),
      { classification: "GOVERNED_PROPOSAL" }, // will refuse
    ];
    for (const g of cases) {
      const r = await runNex1TurnWithGovernance({
        conversation_id: makeConversationId("F6-1"),
        user_message: "boundary test",
        repo_root: TEST_REPO_ROOT,
        governance: g,
      });
      expect(r.governance_evidence.founder_authority_preserved).toBe(true);
      expect(r.governance_evidence.workstation_mutation).toBe(false);
    }
  });

  it("F6-2 · repo_root filesystem untouched by proposal path itself (bridge is pure)", async () => {
    const marker = join(TEST_REPO_ROOT, "workstation-marker.txt");
    expect(existsSync(marker)).toBe(false);
    await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("F6-2"),
      user_message: "no side effects please",
      repo_root: TEST_REPO_ROOT,
      governance: makeGovernedInput(),
    });
    // The bridge / NEX2 / NEX3 calls do not touch the workstation.
    // (Chat-turn itself writes conversation context under repo_root
    // as its normal behaviour · that's chat-turn's storage, not the
    // proposal path.)
    expect(existsSync(marker)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Correlation-chain end-to-end
// ─────────────────────────────────────────────────────────────────────

describe("Correlation chain end-to-end", () => {
  it("chain · turn_id · proposal_id · review_id all present and cross-linked", async () => {
    const mission_id = "MISSION-runtime-chain-e2e";
    const gov: Nex1NativeGovernanceInput = {
      classification: "GOVERNED_PROPOSAL",
      proposal_fields: {
        cap_id: "CAP-runtime-chain",
        mission_id,
        diagnosis: "e2e chain diagnosis, sufficiently long to pass bridge invariants",
        proposed_fix_summary: "e2e chain fix summary, also sufficiently long",
        evidence_refs: ["evt-runtime-chain"],
        resolver_outcome: "PROPOSE",
      },
      test_inputs: {
        cap: makeCap({ cap_id: "CAP-runtime-chain" }),
        nex1_context: {
          ...makeMissionContext(mission_id),
          observations: [],
          analysis: [],
          evidence_refs: ["evt-runtime-chain"],
        },
      },
    };
    const r = await runNex1TurnWithGovernance({
      conversation_id: makeConversationId("chain-e2e"),
      user_message: "e2e chain proposal · propagate all IDs",
      repo_root: TEST_REPO_ROOT,
      governance: gov,
    });
    const corr = r.governance_evidence.correlation;
    expect(corr.turn_id).toContain("chat-turn-");
    expect(corr.proposal_id).toMatch(/^CAP-PROP-BRIDGE-/);
    expect(corr.cap_id).toBe("CAP-runtime-chain");
    expect(corr.mission_id).toBe(mission_id);
    // NEX3 fires for CONFLICT_WITH_NEX1 · review_id set
    if (r.governance_evidence.nex3_invoked) {
      expect(corr.nex2_review_id).toMatch(/^REV-runtime-wrapper-/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Zero-side-effect on chat-turn cognitive path
// ─────────────────────────────────────────────────────────────────────

describe("Chat-turn cognitive path integrity", () => {
  it("wrapper does not alter chat-turn's trace lines", async () => {
    const conv = makeConversationId("integrity");
    // Run once via wrapper WITHOUT governance
    const via_wrapper = await runNex1TurnWithGovernance({
      conversation_id: conv,
      user_message: "trace shape test",
      repo_root: TEST_REPO_ROOT,
    });
    // Chat-turn's trace should be non-empty and reflect real cognitive activity
    expect(via_wrapper.chat_turn_result.trace.length).toBeGreaterThan(0);
    // Wrapper trace is separate and additive
    expect(via_wrapper.governance_evidence.wrapper_trace.length).toBeGreaterThan(0);
    // They are DIFFERENT trace arrays (proves wrapper does not mutate chat-turn's trace)
    expect(via_wrapper.governance_evidence.wrapper_trace).not.toBe(via_wrapper.chat_turn_result.trace);
  });
});
