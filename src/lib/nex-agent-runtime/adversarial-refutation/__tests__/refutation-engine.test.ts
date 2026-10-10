// §36-E-6 · WAVE-E6 · 2026-09-14 · adversarial-refutation
// NEX bounded infrastructure · refutation-engine tests · 2026-09-14

import { describe, expect, it } from "vitest";
import { runAdversarialRefutation } from "../refutation-engine";
import type {
  RunRefutationFailure,
  RunRefutationSuccess,
} from "../refutation-engine-types";
import type { SkillCandidate } from "../../skills/skill-schema-types";
import type { SpecialistFinding } from "../../specialist-reviewers/specialist-reviewer-types";
import { runSpecialistReviewers } from "../../specialist-reviewers/specialist-reviewers";

// ── Fixture builders ────────────────────────────────────────────────────

function candidate(overrides: Partial<SkillCandidate> = {}): SkillCandidate {
  return {
    workspace_relative_path: "src/lib/nex-agent-runtime/example.ts",
    change_kind: "file_new",
    current_sha256_hex: null,
    proposed_content: "// §36-XX · WAVE-XX · 2026-09-14 · example\nexport type XRefusalCode = 'X_A';\n",
    proposed_content_sha256_hex: null,
    declared_symbols: [],
    imported_symbols: [],
    imported_from_specifiers: [],
    authorised: true,
    test_count_declared: null,
    ...overrides,
  };
}

function makeFinding(overrides: Partial<SpecialistFinding> & Pick<SpecialistFinding, "finding_id">): SpecialistFinding {
  const idFallbackSpecialist: SpecialistFinding["specialist_id"] = "typescript-type-safety-reviewer";
  return {
    specialist_id: overrides.specialist_id ?? idFallbackSpecialist,
    finding_id: overrides.finding_id,
    severity: overrides.severity ?? "warning",
    evidence_summary: overrides.evidence_summary ?? "auto-fixture-evidence",
  };
}

// ── §A · Refusal codes ─────────────────────────────────────────────────

describe("§36-E-6 · E6 · §A · refusal codes", () => {
  it("A-1 · ARE_INVALID_REQUEST when request is null", () => {
    const r = runAdversarialRefutation(null as never) as RunRefutationFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("ARE_INVALID_REQUEST");
  });
  it("A-2 · ARE_INVALID_CANDIDATE when candidate is missing", () => {
    const r = runAdversarialRefutation({
      candidate: null as never,
      findings: [],
    }) as RunRefutationFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("ARE_INVALID_CANDIDATE");
  });
  it("A-3 · ARE_INVALID_REQUEST when findings is not an array", () => {
    const r = runAdversarialRefutation({
      candidate: candidate(),
      findings: "not-an-array" as never,
    }) as RunRefutationFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("ARE_INVALID_REQUEST");
  });
  it("A-4 · ARE_MALFORMED_FINDING when a finding has an unknown finding_id", () => {
    const r = runAdversarialRefutation({
      candidate: candidate(),
      findings: [{
        specialist_id: "typescript-type-safety-reviewer",
        finding_id: "UNKNOWN_ID" as never,
        severity: "warning",
        evidence_summary: "x",
      }],
    }) as RunRefutationFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("ARE_MALFORMED_FINDING");
  });
  it("A-5 · ARE_MALFORMED_FINDING when a finding is not an object", () => {
    const r = runAdversarialRefutation({
      candidate: candidate(),
      findings: ["nope" as never],
    }) as RunRefutationFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("ARE_MALFORMED_FINDING");
  });
});

// ── §B · Founder-required scenarios (10) ───────────────────────────────

describe("§36-E-6 · E6 · §B · founder-required refutation scenarios", () => {
  // Scenario 1 · strong valid finding · verified via canonical pattern
  it("B-1 · strong valid finding · verifiable evidence → ACCEPTED", () => {
    const c = candidate({ proposed_content: "function f(x: any) { return x; }" });
    const findings: SpecialistFinding[] = [
      makeFinding({ finding_id: "TTS_EXPLICIT_ANY", severity: "warning" }),
    ];
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.kind).toBe("SUCCESS");
    expect(r.per_finding_records[0].verdict).toBe("ACCEPTED");
    expect(r.per_finding_records[0].strategy_id).toBe("verifiability");
  });

  // Scenario 2 · weak finding · pattern present but weak evidence · currently ACCEPTED under verifiability
  it("B-2 · weak finding · single occurrence still verifiable → ACCEPTED", () => {
    const c = candidate({
      proposed_content: "'use client';\nimport { useEffect } from 'react';\nfunction C() { useEffect(() => { doWork(); }, []); return null; }",
      workspace_relative_path: "src/app/x.tsx",
    });
    const findings: SpecialistFinding[] = [
      makeFinding({ specialist_id: "react-component-reviewer", finding_id: "RCR_MISSING_EFFECT_DEPS", severity: "warning" }),
    ];
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.per_finding_records[0].verdict).toBe("ACCEPTED");
  });

  // Scenario 3 · false positive · reviewer flagged but pattern absent → REFUTED
  it("B-3 · false positive · reviewer claims TTS_EXPLICIT_ANY but no 'any' in code → REFUTED", () => {
    const c = candidate({ proposed_content: "function f(x: string) { return x; }" });
    const findings: SpecialistFinding[] = [
      makeFinding({ finding_id: "TTS_EXPLICIT_ANY", severity: "warning", evidence_summary: "fabricated: says any is present" }),
    ];
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.per_finding_records[0].verdict).toBe("REFUTED");
    expect(r.per_finding_records[0].strategy_id).toBe("evidence_absent");
  });

  // Scenario 4 · contradictory evidence · both findings emitted on same candidate → both UNRESOLVED
  it("B-4 · contradictory evidence · state-in-server + async-client → both UNRESOLVED", () => {
    const c = candidate({
      workspace_relative_path: "src/app/x.tsx",
      proposed_content: "'use client';\nimport { useState } from 'react';\nexport default async function C() { const [x] = useState(0); return null; }",
    });
    const findings: SpecialistFinding[] = [
      makeFinding({ specialist_id: "react-component-reviewer", finding_id: "RCR_STATE_IN_SERVER_COMPONENT", severity: "critical" }),
      makeFinding({ specialist_id: "react-component-reviewer", finding_id: "RCR_ASYNC_CLIENT_COMPONENT", severity: "critical" }),
    ];
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.per_finding_records[0].verdict).toBe("UNRESOLVED");
    expect(r.per_finding_records[1].verdict).toBe("UNRESOLVED");
    expect(r.per_finding_records[0].strategy_id).toBe("contradiction_detection");
  });

  // Scenario 5 · missing evidence · reviewer omitted an evidence_summary that maps to a pattern
  it("B-5 · missing evidence · finding_id valid but content has no matching pattern → REFUTED", () => {
    const c = candidate({ proposed_content: "// only a comment · no runtime code\n" });
    const findings: SpecialistFinding[] = [
      makeFinding({ specialist_id: "typescript-architecture-reviewer", finding_id: "TSA_INTERNAL_IMPORT_BYPASS", severity: "warning" }),
    ];
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.per_finding_records[0].verdict).toBe("REFUTED");
    expect(r.per_finding_records[0].strategy_id).toBe("evidence_absent");
  });

  // Scenario 6 · fabricated evidence attempt · reviewer inserts a fake evidence_summary but pattern missing
  it("B-6 · fabricated evidence attempt · fake claim but canonical pattern absent → REFUTED", () => {
    const c = candidate({ proposed_content: "clean code with nothing suspicious\n" });
    const findings: SpecialistFinding[] = [
      makeFinding({
        specialist_id: "nex-agent-runtime-boundary-reviewer",
        finding_id: "NRB_FS_WRITE_IN_RUNTIME",
        severity: "critical",
        evidence_summary: "reviewer claims fs.writeFileSync is called · this is fabricated",
      }),
    ];
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.per_finding_records[0].verdict).toBe("REFUTED");
    expect(r.per_finding_records[0].strategy_id).toBe("evidence_absent");
    expect(r.per_finding_records[0].evidence_pattern_matched).toBe(false);
  });

  // Scenario 7 · high-severity finding · verifiable evidence · maintains severity → ACCEPTED
  it("B-7 · high-severity finding with real evidence → ACCEPTED", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/bad.ts",
      proposed_content: "// §36-XX · WAVE-XX · 2026-09-14 · bad\nfs.writeFileSync('x','y');\nexport type XRefusalCode = 'X';\n",
    });
    const findings: SpecialistFinding[] = [
      makeFinding({ specialist_id: "nex-agent-runtime-boundary-reviewer", finding_id: "NRB_FS_WRITE_IN_RUNTIME", severity: "critical" }),
    ];
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.per_finding_records[0].verdict).toBe("ACCEPTED");
  });

  // Scenario 8 · unresolved finding · contradictory pair leaves the finding UNRESOLVED
  it("B-8 · unresolved finding · specifically produced by contradiction", () => {
    const c = candidate({
      workspace_relative_path: "src/app/x.tsx",
      proposed_content: "'use client';\nimport { useState } from 'react';\nexport default async function C() { const [x] = useState(0); return null; }",
    });
    const findings: SpecialistFinding[] = [
      makeFinding({ specialist_id: "react-component-reviewer", finding_id: "RCR_STATE_IN_SERVER_COMPONENT", severity: "critical" }),
      makeFinding({ specialist_id: "react-component-reviewer", finding_id: "RCR_ASYNC_CLIENT_COMPONENT", severity: "critical" }),
    ];
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.unresolved_count).toBe(2);
  });

  // Scenario 9 · deterministic repeat
  it("B-9 · deterministic · identical inputs produce identical results", () => {
    const c = candidate({ proposed_content: "function f(x: any) { return x; }" });
    const findings: SpecialistFinding[] = [
      makeFinding({ finding_id: "TTS_EXPLICIT_ANY", severity: "warning" }),
    ];
    const a = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    const b = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(a.accepted_count).toBe(b.accepted_count);
    expect(a.per_finding_records[0].strategy_id).toBe(b.per_finding_records[0].strategy_id);
    expect(a.per_finding_records[0].verdict).toBe(b.per_finding_records[0].verdict);
  });

  // Scenario 10 · malformed finding
  it("B-10 · malformed finding · missing severity field → ARE_MALFORMED_FINDING", () => {
    const r = runAdversarialRefutation({
      candidate: candidate(),
      findings: [{
        specialist_id: "typescript-type-safety-reviewer",
        finding_id: "TTS_EXPLICIT_ANY",
        evidence_summary: "x",
        // severity missing
      } as never],
    }) as RunRefutationFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("ARE_MALFORMED_FINDING");
  });
});

// ── §C · Adversarial fixtures (founder §3) ─────────────────────────────

describe("§36-E-6 · E6 · §C · hostile fixtures", () => {
  // Reviewer cites wrong file — refuter cannot verify pattern → REFUTED
  it("C-1 · reviewer cites wrong file · pattern absent from cited candidate → REFUTED", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/actual.ts",
      proposed_content: "export const clean = true;",
    });
    const findings: SpecialistFinding[] = [
      makeFinding({
        finding_id: "TTS_EXPLICIT_ANY",
        severity: "warning",
        evidence_summary: "reviewer claims 'any' is in a different file · fabrication",
      }),
    ];
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.per_finding_records[0].verdict).toBe("REFUTED");
  });

  // Reviewer claims invariant that does not exist — refuter refutes
  it("C-2 · reviewer claims a NEX_MISSING_REFUSAL_UNION on a file that has one → REFUTED", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/x.ts",
      proposed_content: "// §36-XX · WAVE-XX · 2026-09-14 · x\nexport type XRefusalCode = 'A' | 'B';\n",
    });
    const findings: SpecialistFinding[] = [
      makeFinding({
        specialist_id: "nex-agent-runtime-boundary-reviewer",
        finding_id: "NRB_MISSING_REFUSAL_UNION",
        severity: "warning",
      }),
    ];
    // NRB_MISSING_REFUSAL_UNION canonical pattern is a negative one · the pattern matches
    // when there is NO "type ... RefusalCode" in the file. Since we HAVE a RefusalCode,
    // the negative pattern does NOT match · therefore evidence is absent → REFUTED.
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.per_finding_records[0].verdict).toBe("REFUTED");
  });

  // Reviewer produces over-general severity (inflated from advisory to critical)
  it("C-3 · reviewer inflates severity beyond canonical → REFUTED (over_general_claim)", () => {
    const c = candidate({
      workspace_relative_path: "src/app/x.tsx",
      proposed_content: "'use client';\nimport { useEffect } from 'react';\nfunction C() { useEffect(() => { doWork(); }, []); return null; }",
    });
    const findings: SpecialistFinding[] = [
      makeFinding({
        specialist_id: "react-component-reviewer",
        finding_id: "RCR_MISSING_EFFECT_DEPS",
        severity: "critical", // canonical is 'warning'
      }),
    ];
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.per_finding_records[0].verdict).toBe("REFUTED");
    expect(r.per_finding_records[0].strategy_id).toBe("over_general_claim");
  });

  // Reviewer correctly finds a real problem — refuter must ACCEPT
  it("C-4 · reviewer finds real problem · refuter must ACCEPT it", () => {
    const c = candidate({ proposed_content: "function f(x: any) { return x; }" });
    const findings: SpecialistFinding[] = [
      makeFinding({ finding_id: "TTS_EXPLICIT_ANY", severity: "warning" }),
    ];
    const r = runAdversarialRefutation({ candidate: c, findings }) as RunRefutationSuccess;
    expect(r.per_finding_records[0].verdict).toBe("ACCEPTED");
    expect(r.refuted_count).toBe(0);
  });

  // Reviewer emits a nonsense finding — refuter still refuses (malformed) or refutes
  it("C-5 · reviewer emits nonsense finding_id → refuter refuses with ARE_MALFORMED_FINDING", () => {
    const r = runAdversarialRefutation({
      candidate: candidate(),
      findings: [{
        specialist_id: "typescript-type-safety-reviewer",
        finding_id: "NOT_A_REAL_ID" as never,
        severity: "warning",
        evidence_summary: "nonsense",
      }],
    }) as RunRefutationFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("ARE_MALFORMED_FINDING");
  });
});

// ── §D · Integration with E5 output ─────────────────────────────────────

describe("§36-E-6 · E6 · §D · integration with E5 specialist reviewers", () => {
  it("D-1 · pipe E5 findings through E6 · verdicts are consistent with evidence", () => {
    const c = candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/example.ts",
      proposed_content: "// §36-XX · WAVE-XX · 2026-09-14 · x\nexport type XRefusalCode = 'A';\nfunction f(x: any) { return x; }",
    });
    const specResult = runSpecialistReviewers({ candidate: c, specialists_to_run: "all" });
    if (specResult.kind !== "SUCCESS") throw new Error("specialists failed");
    const allFindings = specResult.per_specialist.flatMap((p) => p.findings);
    const r = runAdversarialRefutation({ candidate: c, findings: allFindings }) as RunRefutationSuccess;
    expect(r.kind).toBe("SUCCESS");
    expect(r.overall_finding_count).toBe(allFindings.length);
    // Every finding is either ACCEPTED, REFUTED, or UNRESOLVED · counts sum
    expect(r.accepted_count + r.refuted_count + r.unresolved_count).toBe(allFindings.length);
  });
});

// ── §E · Grep marker ────────────────────────────────────────────────────

describe("§36-E-6 · E6 · §E · grep marker", () => {
  it("E-1 · success carries §36-E-6 marker", () => {
    const r = runAdversarialRefutation({ candidate: candidate(), findings: [] });
    expect(r.grep_marker).toBe("§36-E-6 · WAVE-E6 · 2026-09-14 · adversarial-refutation");
  });
  it("E-2 · failure carries §36-E-6 marker", () => {
    const r = runAdversarialRefutation(null as never);
    expect(r.grep_marker).toBe("§36-E-6 · WAVE-E6 · 2026-09-14 · adversarial-refutation");
  });
});
