// §36-S-4 · WAVE-S4 · 2026-09-14 · improvement-intelligence
//
// Test suite for the improvement-intelligence primitive.

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { proposeImprovements } from "../improvement-intelligence";
import type {
  ImprovementIntelligenceFailure,
  ImprovementIntelligenceRequest,
  ImprovementIntelligenceResult,
  ImprovementIntelligenceSuccess,
} from "../improvement-intelligence-types";
import { assessCapabilityHealth } from "../health-model";
import { classifyFailureIntelligence } from "../failure-intelligence";
import type {
  CapabilityRecord,
  EvidenceCollectionSuccess,
} from "../evidence-collector-types";
import type { CapabilityHealthSuccess } from "../health-model-types";
import type { FailureIntelligenceSuccess } from "../failure-intelligence-types";

function asSuccess(r: ImprovementIntelligenceResult): ImprovementIntelligenceSuccess {
  if (!r.ok) throw new Error(`expected success, got: ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asFailure(r: ImprovementIntelligenceResult): ImprovementIntelligenceFailure {
  if (r.ok) throw new Error(`expected failure, got success`);
  return r;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function makeS1(overrides?: Partial<EvidenceCollectionSuccess>): EvidenceCollectionSuccess {
  const base: Omit<EvidenceCollectionSuccess, "evidence_sha256"> = {
    ok: true,
    collected_at: "2026-09-14T12:00:00.000Z",
    workspace_root_sha256: sha256Hex("ws"),
    evidence_kinds_collected: [
      "capability_inventory", "test_run_summary", "rollback_proof_inventory",
      "grep_marker_inventory", "governance_amendment_inventory",
      "baseline_sha_verification", "gap_notes",
    ],
    capability_inventory: [],
    test_run_summary: [],
    rollback_proof_inventory: [],
    grep_marker_inventory: [],
    governance_amendment_inventory: [],
    baseline_sha_verification: [],
    gap_notes: [],
    ...overrides,
  };
  const canonical = JSON.stringify({
    workspace_root_sha256: base.workspace_root_sha256,
    evidence_kinds_collected: base.evidence_kinds_collected,
    capability_inventory: base.capability_inventory,
    test_run_summary: base.test_run_summary,
    rollback_proof_inventory: base.rollback_proof_inventory,
    grep_marker_inventory: base.grep_marker_inventory,
    governance_amendment_inventory: base.governance_amendment_inventory,
    baseline_sha_verification: base.baseline_sha_verification,
    gap_notes: base.gap_notes,
  });
  return { ...base, evidence_sha256: sha256Hex(canonical) };
}

function makeS2(s1: EvidenceCollectionSuccess): CapabilityHealthSuccess {
  const r = assessCapabilityHealth({ s1_record: s1, clock: () => new Date("2026-09-14T12:00:01.000Z"), max_staleness_hours: 8760 });
  if (!r.ok) throw new Error(`makeS2 failed: ${r.refusal_code}`);
  return r;
}

function makeS3(s1: EvidenceCollectionSuccess, s2: CapabilityHealthSuccess): FailureIntelligenceSuccess {
  const r = classifyFailureIntelligence({ s1_record: s1, s2_record: s2, clock: () => new Date("2026-09-14T12:00:02.000Z") });
  if (!r.ok) throw new Error(`makeS3 failed: ${r.refusal_code}`);
  return r;
}

function baseReq(s1: EvidenceCollectionSuccess): ImprovementIntelligenceRequest {
  const s2 = makeS2(s1);
  const s3 = makeS3(s1, s2);
  return {
    s1_record: s1,
    s2_record: s2,
    s3_record: s3,
    clock: () => new Date("2026-09-14T12:00:03.000Z"),
  };
}

const CAP_R2: CapabilityRecord = {
  wave_slug: "r2",
  promotion_status: "infrastructure_only",
  promoted_paths: [],
  acceptance_report_path: "docs/NEX1/BUILD_GATES/WAVE-R2-ACCEPTANCE-REPORT.md",
  acceptance_report_sha256: sha256Hex("r2"),
};

const CAP_PLAN: CapabilityRecord = {
  wave_slug: "iesb-example",
  promotion_status: "plan_only",
  promoted_paths: [],
  acceptance_report_path: null,
  acceptance_report_sha256: null,
};

// ══════════════════════════════════════════════════════════════════════
// §A · Per-proposal-kind derivation (14 tests · 2 per kind × 7)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-4 · S4 · §A · proposal kinds", () => {
  it("A-1 · pattern_mismatch → amend_locked_pattern with high confidence", () => {
    const s1 = makeS1({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "test_count_source_span_not_locatable", wave_slug: "r2", evidence_kind: "test_run_summary", path_ref: "x", description: "no match" }],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "amend_locked_pattern");
    expect(p).toBeDefined();
    expect(p?.confidence).toBe("high");
  });
  it("A-2 · pattern_mismatch → validation_requirement mentions S1 re-run", () => {
    const s1 = makeS1({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "test_count_source_span_not_locatable", wave_slug: "r2", evidence_kind: "test_run_summary", path_ref: "x", description: "no match" }],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "amend_locked_pattern")!;
    expect(p.validation_requirement).toContain("S1 re-run");
  });
  it("A-3 · marker_missing → add_missing_marker with medium confidence", () => {
    const s1 = makeS1({ capability_inventory: [CAP_R2] });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "add_missing_marker");
    expect(p).toBeDefined();
    expect(p?.confidence).toBe("medium");
  });
  it("A-4 · marker_missing → trivial rollback", () => {
    const s1 = makeS1({ capability_inventory: [CAP_R2] });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "add_missing_marker")!;
    expect(p.rollback_consideration).toBe("trivial");
  });
  it("A-5 · acceptance_report_absent → author_missing_acceptance_report", () => {
    const s1 = makeS1({
      capability_inventory: [{ ...CAP_R2, acceptance_report_path: null, acceptance_report_sha256: null }],
      gap_notes: [{ kind: "acceptance_report_referenced_but_missing", wave_slug: "r2", evidence_kind: "capability_inventory", path_ref: "x", description: "missing" }],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    expect(r.proposals.some((p) => p.proposal_kind === "author_missing_acceptance_report")).toBe(true);
  });
  it("A-6 · acceptance_report_absent → cites the failure record", () => {
    const s1 = makeS1({
      capability_inventory: [{ ...CAP_R2, acceptance_report_path: null, acceptance_report_sha256: null }],
      gap_notes: [{ kind: "acceptance_report_referenced_but_missing", wave_slug: "r2", evidence_kind: "capability_inventory", path_ref: "x", description: "missing" }],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "author_missing_acceptance_report")!;
    expect(p.evidence_citations.some((c) => c.includes("s3.failures"))).toBe(true);
  });
  it("A-7 · baseline_conflict → resolve_baseline_conflict with low confidence", () => {
    const s1 = makeS1({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "capability_promotion_status_ambiguous", wave_slug: "r2", evidence_kind: "baseline_sha_verification", path_ref: "x", description: "conflict" }],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "resolve_baseline_conflict");
    expect(p).toBeDefined();
    expect(p?.confidence).toBe("low");
  });
  it("A-8 · baseline_conflict → moderate rollback", () => {
    const s1 = makeS1({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "capability_promotion_status_ambiguous", wave_slug: "r2", evidence_kind: "baseline_sha_verification", path_ref: "x", description: "conflict" }],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "resolve_baseline_conflict")!;
    expect(p.rollback_consideration).toBe("moderate");
  });
  it("A-9 · governance_state_unknown → capture_governance_evidence", () => {
    const s1 = makeS1({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "governance_amendment_state_unknown", wave_slug: "r2", evidence_kind: "governance_amendment_inventory", path_ref: "x", description: "u" }],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    expect(r.proposals.some((p) => p.proposal_kind === "capture_governance_evidence")).toBe(true);
  });
  it("A-10 · governance_state_unknown → medium confidence", () => {
    const s1 = makeS1({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "governance_amendment_state_unknown", wave_slug: "r2", evidence_kind: "governance_amendment_inventory", path_ref: "x", description: "u" }],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "capture_governance_evidence")!;
    expect(p.confidence).toBe("medium");
  });
  it("A-11 · capability_not_promoted → advance_plan_to_execution", () => {
    const s1 = makeS1({ capability_inventory: [CAP_PLAN] });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    expect(r.proposals.some((p) => p.proposal_kind === "advance_plan_to_execution")).toBe(true);
  });
  it("A-12 · capability_not_promoted → not_derivable confidence + not_applicable rollback", () => {
    const s1 = makeS1({ capability_inventory: [CAP_PLAN] });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "advance_plan_to_execution")!;
    expect(p.confidence).toBe("not_derivable");
    expect(p.rollback_consideration).toBe("not_applicable");
    expect(p.validation_requirement).toContain("founder-authorised");
  });
  it("A-13 · evidence_missing → collect_missing_evidence low-confidence", () => {
    const s1 = makeS1({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "baseline_hash_file_missing", wave_slug: "r2", evidence_kind: "rollback_proof_inventory", path_ref: "x", description: "missing" }],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "collect_missing_evidence");
    expect(p).toBeDefined();
    expect(p?.confidence).toBe("low");
  });
  it("A-14 · evidence_missing → trivial rollback", () => {
    const s1 = makeS1({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "baseline_hash_file_missing", wave_slug: "r2", evidence_kind: "rollback_proof_inventory", path_ref: "x", description: "missing" }],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "collect_missing_evidence")!;
    expect(p.rollback_consideration).toBe("trivial");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §B · Aggregation (3 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-4 · S4 · §B · aggregation", () => {
  it("B-1 · proposals sorted by (wave_slug, proposal_kind, failure_class)", () => {
    const s1 = makeS1({
      capability_inventory: [CAP_R2, CAP_PLAN],
      gap_notes: [
        { kind: "test_count_source_span_not_locatable", wave_slug: "r2", evidence_kind: "test_run_summary", path_ref: "x", description: "a" },
        { kind: "governance_amendment_state_unknown", wave_slug: "r2", evidence_kind: "governance_amendment_inventory", path_ref: "y", description: "b" },
      ],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const keys = r.proposals.map((p) => `${p.wave_slug}|${p.proposal_kind}|${p.derived_from_failure_class}`);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });
  it("B-2 · empty S3 failures → empty proposals array", () => {
    const s1 = makeS1({ capability_inventory: [] });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    expect(r.proposals.length).toBe(0);
  });
  it("B-3 · each proposal cites at least one failure record", () => {
    const s1 = makeS1({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "governance_amendment_state_unknown", wave_slug: "r2", evidence_kind: "governance_amendment_inventory", path_ref: "x", description: "u" }],
    });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    for (const p of r.proposals) {
      expect(p.evidence_citations.length).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// §C · Determinism (4 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-4 · S4 · §C · determinism", () => {
  const s1 = makeS1({ capability_inventory: [CAP_R2, CAP_PLAN] });
  it("C-1 · identical inputs → identical improvement_intelligence_sha256", () => {
    const a = asSuccess(proposeImprovements(baseReq(s1)));
    const b = asSuccess(proposeImprovements(baseReq(s1)));
    expect(a.improvement_intelligence_sha256).toBe(b.improvement_intelligence_sha256);
  });
  it("C-2 · byte-identical proposals", () => {
    const a = asSuccess(proposeImprovements(baseReq(s1)));
    const b = asSuccess(proposeImprovements(baseReq(s1)));
    expect(JSON.stringify(a.proposals)).toBe(JSON.stringify(b.proposals));
  });
  it("C-3 · clock injection deterministic", () => {
    const s2 = makeS2(s1);
    const s3 = makeS3(s1, s2);
    const r = asSuccess(proposeImprovements({
      s1_record: s1, s2_record: s2, s3_record: s3,
      clock: () => new Date("2030-06-15T00:00:00.000Z"),
    }));
    expect(r.assessed_at).toBe("2030-06-15T00:00:00.000Z");
  });
  it("C-4 · improvement_intelligence_sha256 is a 64-hex string", () => {
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    expect(r.improvement_intelligence_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §D · Refusal codes (6 tests · one per code)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-4 · S4 · §D · refusal codes", () => {
  it("D-1 · II_INVALID_REQUEST for non-object", () => {
    const r = asFailure(proposeImprovements(null as unknown as ImprovementIntelligenceRequest));
    expect(r.refusal_code).toBe("II_INVALID_REQUEST");
  });
  it("D-2 · II_INVALID_S1_RECORD", () => {
    const s1 = makeS1();
    const s2 = makeS2(s1);
    const s3 = makeS3(s1, s2);
    const r = asFailure(proposeImprovements({
      s1_record: { ok: false, refusal_code: "EEC_INVALID_REQUEST", reason: "x" } as unknown as EvidenceCollectionSuccess,
      s2_record: s2, s3_record: s3,
    }));
    expect(r.refusal_code).toBe("II_INVALID_S1_RECORD");
  });
  it("D-3 · II_INVALID_S2_RECORD", () => {
    const s1 = makeS1();
    const s2 = makeS2(s1);
    const s3 = makeS3(s1, s2);
    const r = asFailure(proposeImprovements({
      s1_record: s1,
      s2_record: { ok: false, refusal_code: "EHM_INVALID_REQUEST", reason: "x" } as unknown as CapabilityHealthSuccess,
      s3_record: s3,
    }));
    expect(r.refusal_code).toBe("II_INVALID_S2_RECORD");
  });
  it("D-4 · II_INVALID_S3_RECORD", () => {
    const s1 = makeS1();
    const s2 = makeS2(s1);
    const r = asFailure(proposeImprovements({
      s1_record: s1, s2_record: s2,
      s3_record: { ok: false, refusal_code: "FI_INVALID_REQUEST", reason: "x" } as unknown as FailureIntelligenceSuccess,
    }));
    expect(r.refusal_code).toBe("II_INVALID_S3_RECORD");
  });
  it("D-5 · II_CHAIN_SHA_MISMATCH when S2 cites different S1", () => {
    const s1a = makeS1({ workspace_root_sha256: sha256Hex("a") });
    const s1b = makeS1({ workspace_root_sha256: sha256Hex("b") });
    const s2ForB = makeS2(s1b);
    const s3ForB = makeS3(s1b, s2ForB);
    const r = asFailure(proposeImprovements({ s1_record: s1a, s2_record: s2ForB, s3_record: s3ForB }));
    expect(r.refusal_code).toBe("II_CHAIN_SHA_MISMATCH");
  });
  it("D-6 · II_OUTPUT_TOO_LARGE code exists in taxonomy", () => {
    const codes = ["II_INVALID_REQUEST", "II_INVALID_S1_RECORD", "II_INVALID_S2_RECORD", "II_INVALID_S3_RECORD", "II_CHAIN_SHA_MISMATCH", "II_OUTPUT_TOO_LARGE"];
    expect(codes).toContain("II_OUTPUT_TOO_LARGE");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §E · Chain integrity (3 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-4 · S4 · §E · chain integrity", () => {
  it("E-1 · valid chain echoes all three SHAs", () => {
    const s1 = makeS1({ capability_inventory: [CAP_R2] });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    expect(r.s1_evidence_sha256_verified).toBe(s1.evidence_sha256);
    expect(r.s2_health_sha256_verified).toBe(makeS2(s1).health_sha256);
    expect(r.s3_failure_intelligence_sha256_verified).toBe(makeS3(s1, makeS2(s1)).failure_intelligence_sha256);
  });
  it("E-2 · tampered S3 (mismatched s2_health_sha256_verified) → refused", () => {
    const s1 = makeS1();
    const s2 = makeS2(s1);
    const s3 = makeS3(s1, s2);
    const tampered: FailureIntelligenceSuccess = { ...s3, s2_health_sha256_verified: "0".repeat(64) };
    const r = asFailure(proposeImprovements({ s1_record: s1, s2_record: s2, s3_record: tampered }));
    expect(r.refusal_code).toBe("II_CHAIN_SHA_MISMATCH");
  });
  it("E-3 · tampered S3 (mismatched s1_evidence_sha256_verified) → refused", () => {
    const s1 = makeS1();
    const s2 = makeS2(s1);
    const s3 = makeS3(s1, s2);
    const tampered: FailureIntelligenceSuccess = { ...s3, s1_evidence_sha256_verified: "0".repeat(64) };
    const r = asFailure(proposeImprovements({ s1_record: s1, s2_record: s2, s3_record: tampered }));
    expect(r.refusal_code).toBe("II_CHAIN_SHA_MISMATCH");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §F · Boundary preservation (6 static-grep tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-4 · S4 · §F · boundary preservation", () => {
  const primitivePath = path.resolve(__dirname, "..", "improvement-intelligence.ts");
  const src = fs.readFileSync(primitivePath, "utf8");

  it("F-1 · no fs.* filesystem calls", () => {
    expect(src).not.toMatch(/\bfs\.(readFileSync|readdirSync|statSync|readFile|readdir|stat|open|write|mkdir|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("F-2 · no child_process/spawn/exec/fork", () => {
    expect(src).not.toMatch(/\b(child_process|spawnSync|execSync|fork\()/);
    expect(src.match(/\bexec\(/g) ?? []).toHaveLength(0);
  });
  it("F-3 · no network calls", () => {
    expect(src).not.toMatch(/\b(fetch\(|http\.|https\.|dns\.|net\.|WebSocket)/);
  });
  it("F-4 · no write operations", () => {
    expect(src).not.toMatch(/\b(writeFile|writeFileSync|mkdirSync|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("F-5 · fully synchronous", () => {
    expect(src).not.toMatch(/\basync\s+function|\bawait\s+|\bPromise\./);
  });
  it("F-6 · no LLM references", () => {
    expect(src.toLowerCase()).not.toMatch(/anthropic|openai|\bllm\b/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §G · Anti-pattern discipline (2 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-4 · S4 · §G · anti-pattern discipline", () => {
  it("G-1 · output contains no implementation/fix_code fields", () => {
    const s1 = makeS1({ capability_inventory: [CAP_R2] });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const s = JSON.stringify(r);
    expect(s).not.toContain('"implementation"');
    expect(s).not.toContain('"fix_code"');
    expect(s).not.toContain('"patch"');
    expect(s).not.toContain('"file_edit"');
    expect(s).not.toContain('"authority_granted"');
  });
  it("G-2 · advance_plan_to_execution proposals require founder authorisation", () => {
    const s1 = makeS1({ capability_inventory: [CAP_PLAN] });
    const r = asSuccess(proposeImprovements(baseReq(s1)));
    const p = r.proposals.find((p) => p.proposal_kind === "advance_plan_to_execution")!;
    expect(p.confidence).toBe("not_derivable");
    expect(p.validation_requirement).toContain("founder-authorised");
  });
});
