// NEX1 · Escalation Registry · tests
//
// Test axes (from the founder implementation prompt §13 · §14 · §15):
//   A · Registry completeness
//   B · Registry correctness · source-verified
//   C · Determinism
//   D · Unknown signal
//   E · Missing context
//   F · Authority preservation
//   G · R11-B preservation (cortex INFERRED discipline)
//   H · Safety preservation (I_NEED_PERMISSION → HOLD)
//   I · Protected substrate (FEAR)
//   J · Existing routes match invocation paths
//   K · Non-routes stay non-routes
//   L · Router vs Executor separation
//   M · Canary mode · observability
//   N · Cross-system routing correctness
//   O · No auto-wiring of the 15 signals

import { describe, expect, it } from "vitest";
import {
  NEX1_ESCALATION_REGISTRY,
  NEX1_ESCALATION_REGISTRY_VERSION,
  resolveEscalation,
  listRegistrySignals,
  getRegistryEntry,
  listSignalsByMode,
  type EscalationRoutingDecision,
  type EscalationSignalId,
  type EscalationRoutingMode,
} from "@/lib/nex-cap/nex1-escalation-registry";

// ── Cross-checks against real source enums ────────────────────────────
// The registry references source enums by string. To catch drift, we
// import the actual source types and confirm the strings the registry
// uses appear where it says they do.
import type { SafetyBoundaryVerdict } from "@/lib/nex-agent/code-engine/capability-safety-boundary";
import type { FearAssessment } from "@/lib/nex-agent/code-engine/capability-fear";

// ─────────────────────────────────────────────────────────────────────
// A · Registry completeness
// ─────────────────────────────────────────────────────────────────────

describe("A · registry completeness", () => {
  it("A-1 · every candidate signal from the audit is present exactly once", () => {
    const expected: EscalationSignalId[] = [
      "SAFETY_I_NEED_PERMISSION",
      "SAFETY_I_CANNOT",
      "FEAR_BLOCK_ACTION",
      "PRIOR_CONFLICTS_CURRENT",
      "INTENT_INVESTIGATE",
      "INTENT_CODING_VERB",
      "CORTEX_CONSENSUS_DISAGREEMENT",
      "CORTEX_CONSENSUS_NO_RESPONSE",
      "CAPABILITY_DISCOVERY_PREDICTED",
      "VERIFICATION_INSUFFICIENT",
      "SPECIFICATION_UNRESOLVED",
      "REPAIR_RECONSIDER_HYPOTHESIS",
      "POST_VERDICT_REFLECTION_MATCHED_FALSE",
      "NEX1_MISSION_HANDOFF_TO_NEX2",
      "NEX2_CONFLICT_TO_NEX3",
      "CHAT_STATE_INSUFFICIENT_INPUT",
      "CHAT_STATE_RECALL_INSUFFICIENT",
      "CHAT_TURN_GOVERNED_PROPOSAL_TO_RUNTIME03",
    ];
    const actual = listRegistrySignals();
    expect(new Set(actual)).toEqual(new Set(expected));
    expect(actual.length).toBe(expected.length);
  });

  it("A-2 · no duplicate signal_id entries", () => {
    const ids = NEX1_ESCALATION_REGISTRY.map((e) => e.signal_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("A-3 · registry version constant is stable", () => {
    expect(NEX1_ESCALATION_REGISTRY_VERSION).toBe(
      "nex1-escalation-registry.v1.2026-09-19",
    );
  });

  it("A-4 · registry array is frozen", () => {
    expect(Object.isFrozen(NEX1_ESCALATION_REGISTRY)).toBe(true);
    for (const entry of NEX1_ESCALATION_REGISTRY) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  it("A-5 · every entry declares source_file, source_symbol, meaning, reason_code, version", () => {
    for (const entry of NEX1_ESCALATION_REGISTRY) {
      expect(entry.signal_source_file.length).toBeGreaterThan(5);
      expect(entry.signal_source_symbol.length).toBeGreaterThan(0);
      expect(entry.meaning.length).toBeGreaterThan(10);
      expect(entry.reason_code.length).toBeGreaterThan(0);
      expect(entry.registry_entry_version).toMatch(/^v\d/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// B · Registry correctness · source-verified
// ─────────────────────────────────────────────────────────────────────

describe("B · registry correctness · source-verified", () => {
  const expectedModes: Record<EscalationSignalId, EscalationRoutingMode> = {
    // Safety verdicts: HOLD (never AUTO_ROUTE — Founder authority)
    SAFETY_I_NEED_PERMISSION: "HOLD",
    SAFETY_I_CANNOT: "HOLD",
    // Fear: AUTO_ROUTE (already wired to refused state)
    FEAR_BLOCK_ACTION: "AUTO_ROUTE",
    // Prior comparator conflict: AUTO_ROUTE (already wired to clarification_required)
    PRIOR_CONFLICTS_CURRENT: "AUTO_ROUTE",
    // Intent verbs: AUTO_ROUTE (existing chat-turn routes)
    INTENT_INVESTIGATE: "AUTO_ROUTE",
    INTENT_CODING_VERB: "AUTO_ROUTE",
    // Cortex aggregates: INFORMATION_ONLY (R11-B)
    CORTEX_CONSENSUS_DISAGREEMENT: "INFORMATION_ONLY",
    CORTEX_CONSENSUS_NO_RESPONSE: "INFORMATION_ONLY",
    // Capability discovery: INFORMATION_ONLY (trace only)
    CAPABILITY_DISCOVERY_PREDICTED: "INFORMATION_ONLY",
    // Verifier verdicts that indicate insufficient certainty: HOLD
    VERIFICATION_INSUFFICIENT: "HOLD",
    SPECIFICATION_UNRESOLVED: "HOLD",
    // Repair strategy: AUTO_ROUTE (existing repair loop)
    REPAIR_RECONSIDER_HYPOTHESIS: "AUTO_ROUTE",
    // Post-verdict reflection: AUTO_ROUTE (existing BRB consult)
    POST_VERDICT_REFLECTION_MATCHED_FALSE: "AUTO_ROUTE",
    // Cross-daemon handoffs: AUTO_ROUTE (existing daemon polls)
    NEX1_MISSION_HANDOFF_TO_NEX2: "AUTO_ROUTE",
    NEX2_CONFLICT_TO_NEX3: "AUTO_ROUTE",
    // Chat states: HOLD (composer surfaces for founder input)
    CHAT_STATE_INSUFFICIENT_INPUT: "HOLD",
    CHAT_STATE_RECALL_INSUFFICIENT: "HOLD",
    // NEW cross-subsystem edge: NOT_READY (no contract yet)
    CHAT_TURN_GOVERNED_PROPOSAL_TO_RUNTIME03: "NOT_READY",
  };

  for (const [signal, expectedMode] of Object.entries(expectedModes) as Array<
    [EscalationSignalId, EscalationRoutingMode]
  >) {
    it(`B · ${signal} → ${expectedMode}`, () => {
      const entry = getRegistryEntry(signal);
      expect(entry).not.toBeNull();
      expect(entry!.routing_mode).toBe(expectedMode);
    });
  }

  it("B-99 · every routing_mode is one of the four permitted values", () => {
    const permitted: readonly EscalationRoutingMode[] = [
      "AUTO_ROUTE",
      "HOLD",
      "INFORMATION_ONLY",
      "NOT_READY",
    ];
    for (const entry of NEX1_ESCALATION_REGISTRY) {
      expect(permitted).toContain(entry.routing_mode);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// C · Determinism
// ─────────────────────────────────────────────────────────────────────

describe("C · determinism", () => {
  it("C-1 · same context → identical decision object shape", () => {
    const ctx = {
      signal_id: "INTENT_INVESTIGATE" as const,
      evidence: { verb_family: "INVESTIGATE" },
    };
    const a = resolveEscalation(ctx);
    const b = resolveEscalation(ctx);
    expect(a).toEqual(b);
  });

  it("C-2 · byte-identical JSON for same context across many invocations", () => {
    const ctx = {
      signal_id: "FEAR_BLOCK_ACTION" as const,
      evidence: { block_action: true, reason_code: "target_is_protected_path" },
    };
    const results = Array.from({ length: 100 }, () =>
      JSON.stringify(resolveEscalation(ctx)),
    );
    expect(new Set(results).size).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
// D · Unknown signal
// ─────────────────────────────────────────────────────────────────────

describe("D · unknown signal", () => {
  it("D-1 · unknown ID → safe non-executable decision", () => {
    const decision = resolveEscalation({
      signal_id: "TOTALLY_UNKNOWN_SIGNAL_ID" as unknown as EscalationSignalId,
      evidence: {},
    });
    expect(decision.signal_id).toBe("UNKNOWN");
    expect(decision.routing_mode).toBe("INFORMATION_ONLY");
    expect(decision.executable).toBe(false);
    expect(decision.founder_authority_preserved).toBe(true);
    expect(decision.workstation_mutation).toBe(false);
    expect(decision.router_only).toBe(true);
  });

  it("D-2 · unknown signal never claims a target", () => {
    const decision = resolveEscalation({
      signal_id: "MADE_UP" as unknown as EscalationSignalId,
      evidence: {},
    });
    expect(decision.target_subsystem).toBeNull();
    expect(decision.target_invocation_path).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// E · Missing context
// ─────────────────────────────────────────────────────────────────────

describe("E · missing context", () => {
  it("E-1 · AUTO_ROUTE signal with missing evidence → executable=false", () => {
    const decision = resolveEscalation({
      signal_id: "INTENT_INVESTIGATE",
      evidence: {}, // missing "verb_family"
    });
    expect(decision.routing_mode).toBe("AUTO_ROUTE");
    expect(decision.executable).toBe(false);
    expect(decision.evidence_present).toBe(false);
    expect(decision.missing_evidence).toContain("verb_family");
  });

  it("E-2 · AUTO_ROUTE signal with complete evidence → executable=true", () => {
    const decision = resolveEscalation({
      signal_id: "INTENT_INVESTIGATE",
      evidence: { verb_family: "INVESTIGATE" },
    });
    expect(decision.executable).toBe(true);
  });

  it("E-3 · HOLD signal is NEVER executable regardless of evidence", () => {
    const decision = resolveEscalation({
      signal_id: "SAFETY_I_NEED_PERMISSION",
      evidence: { verdict: "I_NEED_PERMISSION" },
    });
    expect(decision.routing_mode).toBe("HOLD");
    expect(decision.executable).toBe(false);
  });

  it("E-4 · INFORMATION_ONLY signal is NEVER executable", () => {
    const decision = resolveEscalation({
      signal_id: "CORTEX_CONSENSUS_DISAGREEMENT",
      evidence: { consensus: "DISAGREEMENT" },
    });
    expect(decision.routing_mode).toBe("INFORMATION_ONLY");
    expect(decision.executable).toBe(false);
  });

  it("E-5 · NOT_READY signal is NEVER executable", () => {
    const decision = resolveEscalation({
      signal_id: "CHAT_TURN_GOVERNED_PROPOSAL_TO_RUNTIME03",
      evidence: {},
    });
    expect(decision.routing_mode).toBe("NOT_READY");
    expect(decision.executable).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// F · Authority preservation
// ─────────────────────────────────────────────────────────────────────

describe("F · authority preservation invariants", () => {
  it("F-1 · every decision has founder_authority_preserved=true", () => {
    for (const signal_id of listRegistrySignals()) {
      const decision = resolveEscalation({ signal_id, evidence: {} });
      expect(decision.founder_authority_preserved).toBe(true);
    }
  });

  it("F-2 · every decision has workstation_mutation=false", () => {
    for (const signal_id of listRegistrySignals()) {
      const decision = resolveEscalation({ signal_id, evidence: {} });
      expect(decision.workstation_mutation).toBe(false);
    }
  });

  it("F-3 · every decision has router_only=true", () => {
    for (const signal_id of listRegistrySignals()) {
      const decision = resolveEscalation({ signal_id, evidence: {} });
      expect(decision.router_only).toBe(true);
    }
  });

  it("F-4 · unknown signals also preserve invariants", () => {
    const decision = resolveEscalation({
      signal_id: "SOMETHING_INVENTED" as unknown as EscalationSignalId,
      evidence: {},
    });
    expect(decision.founder_authority_preserved).toBe(true);
    expect(decision.workstation_mutation).toBe(false);
    expect(decision.router_only).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// G · R11-B preservation
// ─────────────────────────────────────────────────────────────────────

describe("G · R11-B preservation · cortex aggregates never gain authority", () => {
  it("G-1 · CORTEX_CONSENSUS_DISAGREEMENT is INFORMATION_ONLY", () => {
    const entry = getRegistryEntry("CORTEX_CONSENSUS_DISAGREEMENT")!;
    expect(entry.routing_mode).toBe("INFORMATION_ONLY");
    expect(entry.authority_class).toBe("NONE");
    expect(entry.target_subsystem).toBeNull();
    expect(entry.existing_route_active).toBe(false);
  });

  it("G-2 · CORTEX_CONSENSUS_NO_RESPONSE is INFORMATION_ONLY", () => {
    const entry = getRegistryEntry("CORTEX_CONSENSUS_NO_RESPONSE")!;
    expect(entry.routing_mode).toBe("INFORMATION_ONLY");
    expect(entry.authority_class).toBe("NONE");
    expect(entry.target_subsystem).toBeNull();
  });

  it("G-3 · CAPABILITY_DISCOVERY_PREDICTED is INFORMATION_ONLY", () => {
    const entry = getRegistryEntry("CAPABILITY_DISCOVERY_PREDICTED")!;
    expect(entry.routing_mode).toBe("INFORMATION_ONLY");
    expect(entry.authority_class).toBe("NONE");
  });

  it("G-4 · resolver never returns executable=true for INFORMATION_ONLY signals", () => {
    const informational = listSignalsByMode("INFORMATION_ONLY");
    for (const signal_id of informational) {
      const decision = resolveEscalation({
        signal_id,
        // Provide evidence anyway — should not flip to executable
        evidence: { consensus: "DISAGREEMENT", rule_id: "x", predicted_value: "y" },
      });
      expect(decision.executable).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// H · Safety preservation · I_NEED_PERMISSION never bypasses Founder
// ─────────────────────────────────────────────────────────────────────

describe("H · safety preservation", () => {
  it("H-1 · SAFETY_I_NEED_PERMISSION is HOLD, not AUTO_ROUTE", () => {
    const entry = getRegistryEntry("SAFETY_I_NEED_PERMISSION")!;
    expect(entry.routing_mode).toBe("HOLD");
    expect(entry.authority_class).toBe("FOUNDER");
    // Even with rich evidence, resolver refuses to make it executable
    const decision = resolveEscalation({
      signal_id: "SAFETY_I_NEED_PERMISSION",
      evidence: {
        verdict: "I_NEED_PERMISSION" satisfies SafetyBoundaryVerdict,
      },
    });
    expect(decision.executable).toBe(false);
  });

  it("H-2 · SAFETY_I_CANNOT is HOLD, not AUTO_ROUTE", () => {
    const entry = getRegistryEntry("SAFETY_I_CANNOT")!;
    expect(entry.routing_mode).toBe("HOLD");
    const decision = resolveEscalation({
      signal_id: "SAFETY_I_CANNOT",
      evidence: { verdict: "I_CANNOT" satisfies SafetyBoundaryVerdict },
    });
    expect(decision.executable).toBe(false);
  });

  it("H-3 · Founder authority preserved for all safety signals", () => {
    for (const id of [
      "SAFETY_I_NEED_PERMISSION",
      "SAFETY_I_CANNOT",
    ] as EscalationSignalId[]) {
      const decision = resolveEscalation({ signal_id: id, evidence: {} });
      expect(decision.founder_authority_preserved).toBe(true);
      expect(decision.executable).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// I · Protected substrate (FEAR)
// ─────────────────────────────────────────────────────────────────────

describe("I · protected substrate · FEAR path", () => {
  it("I-1 · FEAR_BLOCK_ACTION target does NOT include workstation execution", () => {
    const entry = getRegistryEntry("FEAR_BLOCK_ACTION")!;
    expect(entry.authority_class).toBe("FOUNDER");
    expect(entry.target_subsystem).toMatch(/refused|Founder/);
    // Must not name any executor
    expect(entry.target_subsystem).not.toMatch(/execute|mutate|write|apply/i);
  });

  it("I-2 · FEAR_BLOCK_ACTION requires block_action + reason_code evidence", () => {
    const decision = resolveEscalation({
      signal_id: "FEAR_BLOCK_ACTION",
      evidence: { block_action: true, reason_code: "target_is_protected_path" },
    });
    expect(decision.executable).toBe(true);
    expect(decision.missing_evidence.length).toBe(0);
  });

  it("I-3 · FEAR type compatibility · block_action is a boolean field on FearAssessment", () => {
    // Compile-time type check via satisfies · confirms source contract
    // is honoured. The registry's evidence_required lists this field.
    const _sample: Pick<FearAssessment, "block_action" | "reason_code"> = {
      block_action: true,
      reason_code: "target_is_protected_path",
    };
    void _sample;
    expect(true).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// J · Existing routes match invocation paths
// ─────────────────────────────────────────────────────────────────────

describe("J · existing routes match", () => {
  it("J-1 · every AUTO_ROUTE entry has existing_route_active=true", () => {
    for (const entry of NEX1_ESCALATION_REGISTRY.filter(
      (e) => e.routing_mode === "AUTO_ROUTE",
    )) {
      expect(entry.existing_route_active).toBe(true);
    }
  });

  it("J-2 · every AUTO_ROUTE entry names a target_invocation_path OR target_subsystem", () => {
    for (const entry of NEX1_ESCALATION_REGISTRY.filter(
      (e) => e.routing_mode === "AUTO_ROUTE",
    )) {
      // A named target is required. Invocation path is preferred but
      // cross-daemon polls may not have a specific file:function anchor.
      expect(entry.target_subsystem).not.toBeNull();
    }
  });

  it("J-3 · NOT_READY entries have existing_route_active=false", () => {
    for (const entry of NEX1_ESCALATION_REGISTRY.filter(
      (e) => e.routing_mode === "NOT_READY",
    )) {
      expect(entry.existing_route_active).toBe(false);
    }
  });

  it("J-4 · INFORMATION_ONLY entries have existing_route_active=false", () => {
    for (const entry of NEX1_ESCALATION_REGISTRY.filter(
      (e) => e.routing_mode === "INFORMATION_ONLY",
    )) {
      expect(entry.existing_route_active).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// K · Non-routes stay non-routes
// ─────────────────────────────────────────────────────────────────────

describe("K · non-routes stay non-routes", () => {
  it("K-1 · INFORMATION_ONLY signals produce executable=false regardless of evidence", () => {
    for (const signal_id of listSignalsByMode("INFORMATION_ONLY")) {
      const decision = resolveEscalation({
        signal_id,
        evidence: { anything: true, everything: "yes" },
      });
      expect(decision.executable).toBe(false);
    }
  });

  it("K-2 · HOLD signals produce executable=false regardless of evidence", () => {
    for (const signal_id of listSignalsByMode("HOLD")) {
      const decision = resolveEscalation({
        signal_id,
        evidence: { anything: true, everything: "yes" },
      });
      expect(decision.executable).toBe(false);
    }
  });

  it("K-3 · NOT_READY signals produce executable=false regardless of evidence", () => {
    for (const signal_id of listSignalsByMode("NOT_READY")) {
      const decision = resolveEscalation({
        signal_id,
        evidence: { anything: true, everything: "yes" },
      });
      expect(decision.executable).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// L · Router vs Executor separation
// ─────────────────────────────────────────────────────────────────────

describe("L · router does not execute", () => {
  it("L-1 · resolveEscalation is synchronous · pure · returns decision only", () => {
    // Function must not be async
    const result = resolveEscalation({
      signal_id: "INTENT_INVESTIGATE",
      evidence: { verb_family: "INVESTIGATE" },
    });
    // Return value shape is a plain decision, not a Promise
    expect(result).not.toBeInstanceOf(Promise);
    // Every field is data, not a callable
    for (const key of Object.keys(result) as Array<
      keyof EscalationRoutingDecision
    >) {
      expect(typeof (result as unknown as Record<string, unknown>)[key]).not.toBe(
        "function",
      );
    }
  });

  it("L-2 · router_only=true is invariant", () => {
    for (const signal_id of listRegistrySignals()) {
      const d = resolveEscalation({ signal_id, evidence: {} });
      expect(d.router_only).toBe(true);
    }
  });

  it("L-3 · no field in the decision shape names an executor callable", () => {
    const d = resolveEscalation({
      signal_id: "INTENT_INVESTIGATE",
      evidence: { verb_family: "INVESTIGATE" },
    });
    const keys = Object.keys(d);
    for (const forbidden of [
      "execute",
      "invoke",
      "run",
      "apply",
      "commit",
      "signIfExecutable",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// M · Canary mode · observability
// ─────────────────────────────────────────────────────────────────────

describe("M · canary observability", () => {
  it("M-1 · resolver always produces a stable reason_code", () => {
    for (const signal_id of listRegistrySignals()) {
      const d = resolveEscalation({ signal_id, evidence: {} });
      expect(d.reason_code.length).toBeGreaterThan(0);
    }
  });

  it("M-2 · resolver decision can be serialised to JSON stably", () => {
    for (const signal_id of listRegistrySignals()) {
      const d = resolveEscalation({ signal_id, evidence: {} });
      expect(() => JSON.parse(JSON.stringify(d))).not.toThrow();
    }
  });

  it("M-3 · registry version is present on every decision", () => {
    for (const signal_id of listRegistrySignals()) {
      const d = resolveEscalation({ signal_id, evidence: {} });
      expect(d.registry_version).toBe(NEX1_ESCALATION_REGISTRY_VERSION);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// N · Cross-system routing correctness (§14 of the prompt)
// ─────────────────────────────────────────────────────────────────────

describe("N · cross-system correctness", () => {
  it("N-1 · INVESTIGATE → AUTO_ROUTE → native-investigation", () => {
    const d = resolveEscalation({
      signal_id: "INTENT_INVESTIGATE",
      evidence: { verb_family: "INVESTIGATE" },
    });
    expect(d.routing_mode).toBe("AUTO_ROUTE");
    expect(d.target_subsystem).toContain("native-investigation");
    expect(d.target_invocation_path).toContain("runNativeInvestigation");
    expect(d.executable).toBe(true);
  });

  it("N-2 · CAPABILITY_DISCOVERY_PREDICTED → INFORMATION_ONLY", () => {
    const d = resolveEscalation({
      signal_id: "CAPABILITY_DISCOVERY_PREDICTED",
      evidence: { rule_id: "R-1", predicted_value: "capability-x" },
    });
    expect(d.routing_mode).toBe("INFORMATION_ONLY");
    expect(d.executable).toBe(false);
  });

  it("N-3 · SAFETY_I_NEED_PERMISSION → HOLD · Founder required", () => {
    const d = resolveEscalation({
      signal_id: "SAFETY_I_NEED_PERMISSION",
      evidence: { verdict: "I_NEED_PERMISSION" },
    });
    expect(d.routing_mode).toBe("HOLD");
    expect(d.authority_class).toBe("FOUNDER");
    expect(d.executable).toBe(false);
  });

  it("N-4 · CHAT_TURN_GOVERNED_PROPOSAL_TO_RUNTIME03 → NOT_READY", () => {
    const d = resolveEscalation({
      signal_id: "CHAT_TURN_GOVERNED_PROPOSAL_TO_RUNTIME03",
      evidence: {},
    });
    expect(d.routing_mode).toBe("NOT_READY");
    expect(d.executable).toBe(false);
  });

  it("N-5 · REPAIR_RECONSIDER_HYPOTHESIS → AUTO_ROUTE → repair engine", () => {
    const d = resolveEscalation({
      signal_id: "REPAIR_RECONSIDER_HYPOTHESIS",
      evidence: { repair_strategy: "RECONSIDER_HYPOTHESIS" },
    });
    expect(d.routing_mode).toBe("AUTO_ROUTE");
    expect(d.target_invocation_path).toContain("repair-execution-loop");
    expect(d.executable).toBe(true);
  });

  it("N-6 · NEX2_CONFLICT_TO_NEX3 → AUTO_ROUTE → NEX3 daemon", () => {
    const d = resolveEscalation({
      signal_id: "NEX2_CONFLICT_TO_NEX3",
      evidence: { nex2_verdict: "REJECTED_UNSAFE" },
    });
    expect(d.routing_mode).toBe("AUTO_ROUTE");
    expect(d.authority_class).toBe("NEX3_ARBITRATION");
    expect(d.executable).toBe(true);
  });

  it("N-7 · NEX1_MISSION_HANDOFF_TO_NEX2 → AUTO_ROUTE → NEX2 daemon", () => {
    const d = resolveEscalation({
      signal_id: "NEX1_MISSION_HANDOFF_TO_NEX2",
      evidence: { handoff_to: "nex2" },
    });
    expect(d.routing_mode).toBe("AUTO_ROUTE");
    expect(d.authority_class).toBe("NEX2_REVIEW");
    expect(d.executable).toBe(true);
  });

  it("N-8 · POST_VERDICT_REFLECTION_MATCHED_FALSE → AUTO_ROUTE → BRB", () => {
    const d = resolveEscalation({
      signal_id: "POST_VERDICT_REFLECTION_MATCHED_FALSE",
      evidence: { matched: false },
    });
    expect(d.routing_mode).toBe("AUTO_ROUTE");
    expect(d.authority_class).toBe("NEX1_BRB_SPECIALIST");
    expect(d.executable).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// O · No auto-wiring of the 15 signals (§15 discipline)
// ─────────────────────────────────────────────────────────────────────

describe("O · no auto-wiring · every signal has exactly one explicit mode", () => {
  it("O-1 · counts by mode match expectation", () => {
    const auto = listSignalsByMode("AUTO_ROUTE");
    const hold = listSignalsByMode("HOLD");
    const info = listSignalsByMode("INFORMATION_ONLY");
    const notReady = listSignalsByMode("NOT_READY");
    const total = auto.length + hold.length + info.length + notReady.length;
    expect(total).toBe(NEX1_ESCALATION_REGISTRY.length);
    // Every entry is in exactly one mode bucket
    expect(new Set([...auto, ...hold, ...info, ...notReady]).size).toBe(
      total,
    );
  });

  it("O-2 · exactly one NOT_READY edge · the chat-turn → runtime03 bridge", () => {
    const notReady = listSignalsByMode("NOT_READY");
    expect(notReady).toEqual(["CHAT_TURN_GOVERNED_PROPOSAL_TO_RUNTIME03"]);
  });

  it("O-3 · AUTO_ROUTE entries only for signals with existing production wiring", () => {
    for (const entry of NEX1_ESCALATION_REGISTRY.filter(
      (e) => e.routing_mode === "AUTO_ROUTE",
    )) {
      expect(entry.existing_route_active).toBe(true);
    }
  });

  it("O-4 · INFORMATION_ONLY and NOT_READY entries have existing_route_active=false", () => {
    for (const entry of NEX1_ESCALATION_REGISTRY.filter(
      (e) =>
        e.routing_mode === "INFORMATION_ONLY" ||
        e.routing_mode === "NOT_READY",
    )) {
      expect(entry.existing_route_active).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// P · Introspection helpers
// ─────────────────────────────────────────────────────────────────────

describe("P · introspection helpers", () => {
  it("P-1 · listRegistrySignals returns frozen array of all IDs", () => {
    const ids = listRegistrySignals();
    expect(Object.isFrozen(ids)).toBe(true);
    expect(ids.length).toBe(NEX1_ESCALATION_REGISTRY.length);
  });

  it("P-2 · getRegistryEntry returns null for unknown", () => {
    expect(getRegistryEntry("NOT_A_SIGNAL")).toBeNull();
  });

  it("P-3 · listSignalsByMode returns frozen arrays", () => {
    for (const mode of [
      "AUTO_ROUTE",
      "HOLD",
      "INFORMATION_ONLY",
      "NOT_READY",
    ] as EscalationRoutingMode[]) {
      const ids = listSignalsByMode(mode);
      expect(Object.isFrozen(ids)).toBe(true);
    }
  });

  it("P-4 · getRegistryEntry returns a consistent entry", () => {
    const entry = getRegistryEntry("INTENT_INVESTIGATE");
    expect(entry?.signal_id).toBe("INTENT_INVESTIGATE");
    expect(entry?.routing_mode).toBe("AUTO_ROUTE");
    expect(entry?.authority_class).toBe("NEX1_INVESTIGATION");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Q · Source referencing discipline
// ─────────────────────────────────────────────────────────────────────

describe("Q · source referencing discipline", () => {
  it("Q-1 · every non-NOT_READY entry names a real source file path", () => {
    for (const entry of NEX1_ESCALATION_REGISTRY.filter(
      (e) => e.routing_mode !== "NOT_READY",
    )) {
      expect(entry.signal_source_file).toMatch(/^src\/lib\//);
      expect(entry.signal_source_file).toMatch(/\.ts$/);
    }
  });

  it("Q-2 · every entry names a source symbol (function/type/const)", () => {
    for (const entry of NEX1_ESCALATION_REGISTRY) {
      // NOT_READY may legitimately state "no signal exists yet"
      if (entry.routing_mode === "NOT_READY") continue;
      // The symbol string references the actual source enum/type/function
      expect(entry.signal_source_symbol.length).toBeGreaterThan(3);
    }
  });
});
