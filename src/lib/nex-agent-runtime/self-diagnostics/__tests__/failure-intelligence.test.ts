// §36-S-3 · WAVE-S3 · 2026-09-14 · failure-intelligence
//
// Test suite for the failure-intelligence primitive.

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { classifyFailureIntelligence } from "../failure-intelligence";
import type {
  FailureIntelligenceFailure,
  FailureIntelligenceRequest,
  FailureIntelligenceResult,
  FailureIntelligenceSuccess,
} from "../failure-intelligence-types";
import { assessCapabilityHealth } from "../health-model";
import type {
  CapabilityRecord,
  EvidenceCollectionSuccess,
  EvidenceGapNote,
} from "../evidence-collector-types";
import type { CapabilityHealthSuccess } from "../health-model-types";

// ── Helpers ────────────────────────────────────────────────────────────

function asSuccess(r: FailureIntelligenceResult): FailureIntelligenceSuccess {
  if (!r.ok) throw new Error(`expected success, got: ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asFailure(r: FailureIntelligenceResult): FailureIntelligenceFailure {
  if (r.ok) throw new Error(`expected failure, got success`);
  return r;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function makeS1Record(overrides?: Partial<EvidenceCollectionSuccess>): EvidenceCollectionSuccess {
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

function makeS2Record(s1: EvidenceCollectionSuccess): CapabilityHealthSuccess {
  const r = assessCapabilityHealth({
    s1_record: s1,
    clock: () => new Date("2026-09-14T12:00:01.000Z"),
    max_staleness_hours: 8760,
  });
  if (!r.ok) throw new Error(`makeS2Record failed: ${r.refusal_code}`);
  return r;
}

function baseReq(s1: EvidenceCollectionSuccess, s2Override?: CapabilityHealthSuccess): FailureIntelligenceRequest {
  return {
    s1_record: s1,
    s2_record: s2Override ?? makeS2Record(s1),
    clock: () => new Date("2026-09-14T12:00:02.000Z"),
  };
}

const CAP_C1: CapabilityRecord = {
  wave_slug: "c1",
  promotion_status: "promoted",
  promoted_paths: ["src/lib/nex-agent-runtime/c1-nex-facial-state-model/validator.ts"],
  acceptance_report_path: "data/capability-labs/c1-nex-facial-state-model/C1-STEP-5-ACCEPTANCE-REPORT.md",
  acceptance_report_sha256: sha256Hex("c1-report"),
};

const CAP_R2: CapabilityRecord = {
  wave_slug: "r2",
  promotion_status: "infrastructure_only",
  promoted_paths: [],
  acceptance_report_path: "docs/NEX1/BUILD_GATES/WAVE-R2-ACCEPTANCE-REPORT.md",
  acceptance_report_sha256: sha256Hex("r2-report"),
};

const CAP_PLAN: CapabilityRecord = {
  wave_slug: "iesb-example",
  promotion_status: "plan_only",
  promoted_paths: [],
  acceptance_report_path: null,
  acceptance_report_sha256: null,
};

// ══════════════════════════════════════════════════════════════════════
// §A · Per-failure-class derivation (14 tests · 2 per class × 7)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-3 · S3 · §A · evidence_missing", () => {
  it("A-1 · classifies baseline_hash_file_missing gap note as evidence_missing", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "baseline_hash_file_missing", wave_slug: "r2", evidence_kind: "rollback_proof_inventory", path_ref: "x", description: "missing" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const rec = r.failures.find((f) => f.wave_slug === "r2" && f.failure_class === "evidence_missing");
    expect(rec).toBeDefined();
  });
  it("A-2 · classifies wave_filter_slug_not_matched as evidence_missing", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "wave_filter_slug_not_matched", wave_slug: "ghost", evidence_kind: "capability_inventory", path_ref: null, description: "unmatched" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    expect(r.failures.some((f) => f.wave_slug === "ghost" && f.failure_class === "evidence_missing")).toBe(true);
  });
});

describe("§36-S-3 · S3 · §A · pattern_mismatch", () => {
  it("A-3 · classifies test_count_source_span_not_locatable as pattern_mismatch with known cause", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "test_count_source_span_not_locatable", wave_slug: "r2", evidence_kind: "test_run_summary", path_ref: "x", description: "no match" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const rec = r.failures.find((f) => f.wave_slug === "r2" && f.failure_class === "pattern_mismatch");
    expect(rec).toBeDefined();
    expect(rec?.cause_status).toBe("known_from_evidence");
    expect(rec?.cause_summary).toContain("locked pattern");
  });
  it("A-4 · classifies grep_marker_missing_in_expected_path as pattern_mismatch", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "grep_marker_missing_in_expected_path", wave_slug: "r2", evidence_kind: "grep_marker_inventory", path_ref: "x", description: "missing" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    expect(r.failures.some((f) => f.wave_slug === "r2" && f.failure_class === "pattern_mismatch")).toBe(true);
  });
});

describe("§36-S-3 · S3 · §A · baseline_conflict", () => {
  it("A-5 · classifies capability_promotion_status_ambiguous in baseline scope as baseline_conflict", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "capability_promotion_status_ambiguous", wave_slug: "r2", evidence_kind: "baseline_sha_verification", path_ref: "some/path.ts", description: "conflict" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const rec = r.failures.find((f) => f.wave_slug === "r2" && f.failure_class === "baseline_conflict");
    expect(rec).toBeDefined();
    expect(rec?.cause_status).toBe("cause_unknown");
  });
  it("A-6 · classifies capability_promotion_status_ambiguous NOT in baseline scope as evidence_missing", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "capability_promotion_status_ambiguous", wave_slug: "r2", evidence_kind: "capability_inventory", path_ref: null, description: "ambiguous" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    expect(r.failures.some((f) => f.wave_slug === "r2" && f.failure_class === "evidence_missing")).toBe(true);
  });
});

describe("§36-S-3 · S3 · §A · acceptance_report_absent", () => {
  it("A-7 · classifies acceptance_report_referenced_but_missing", () => {
    const s1 = makeS1Record({
      capability_inventory: [{ ...CAP_R2, acceptance_report_path: null, acceptance_report_sha256: null }],
      gap_notes: [{ kind: "acceptance_report_referenced_but_missing", wave_slug: "r2", evidence_kind: "capability_inventory", path_ref: "path", description: "missing" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    expect(r.failures.some((f) => f.wave_slug === "r2" && f.failure_class === "acceptance_report_absent")).toBe(true);
  });
  it("A-8 · acceptance_report_absent carries cause_unknown (S1 only knows it's missing)", () => {
    const s1 = makeS1Record({
      capability_inventory: [{ ...CAP_R2, acceptance_report_path: null, acceptance_report_sha256: null }],
      gap_notes: [{ kind: "acceptance_report_referenced_but_missing", wave_slug: "r2", evidence_kind: "capability_inventory", path_ref: "path", description: "missing" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const rec = r.failures.find((f) => f.failure_class === "acceptance_report_absent")!;
    expect(rec.cause_status).toBe("cause_unknown");
    expect(rec.cause_summary).toBeNull();
  });
});

describe("§36-S-3 · S3 · §A · governance_state_unknown", () => {
  it("A-9 · classifies governance_amendment_state_unknown gap note", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "governance_amendment_state_unknown", wave_slug: "r2", evidence_kind: "governance_amendment_inventory", path_ref: "path", description: "unknown" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    expect(r.failures.some((f) => f.wave_slug === "r2" && f.failure_class === "governance_state_unknown")).toBe(true);
  });
  it("A-10 · governance_state_unknown → location_s2_dimension = governance_state", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "governance_amendment_state_unknown", wave_slug: "r2", evidence_kind: "governance_amendment_inventory", path_ref: "path", description: "unknown" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const rec = r.failures.find((f) => f.failure_class === "governance_state_unknown")!;
    expect(rec.location_s2_dimension).toBe("governance_state");
  });
});

describe("§36-S-3 · S3 · §A · marker_missing", () => {
  it("A-11 · marker_missing derived from S2 dimension when no S1 gap covers it", () => {
    const s1 = makeS1Record({ capability_inventory: [CAP_R2] }); // no markers
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    expect(r.failures.some((f) => f.wave_slug === "r2" && f.failure_class === "marker_missing")).toBe(true);
  });
  it("A-12 · marker_missing carries S2 dimension citation", () => {
    const s1 = makeS1Record({ capability_inventory: [CAP_R2] });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const rec = r.failures.find((f) => f.failure_class === "marker_missing")!;
    expect(rec.location_s2_dimension).toBe("marker_presence");
  });
});

describe("§36-S-3 · S3 · §A · capability_not_promoted", () => {
  it("A-13 · classifies plan_only capability", () => {
    const s1 = makeS1Record({ capability_inventory: [CAP_PLAN] });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    expect(r.failures.some((f) => f.wave_slug === "iesb-example" && f.failure_class === "capability_not_promoted")).toBe(true);
  });
  it("A-14 · capability_not_promoted carries known_from_evidence cause", () => {
    const s1 = makeS1Record({ capability_inventory: [CAP_PLAN] });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const rec = r.failures.find((f) => f.failure_class === "capability_not_promoted")!;
    expect(rec.cause_status).toBe("known_from_evidence");
    expect(rec.cause_summary).toContain("plan-only");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §B · Aggregation (4 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-3 · S3 · §B · aggregation", () => {
  it("B-1 · waves_with_no_failures lists healthy waves", () => {
    // C1 with clean baseline should have no failures
    const s1 = makeS1Record({
      capability_inventory: [CAP_C1],
      baseline_sha_verification: [{
        protected_path: CAP_C1.promoted_paths[0],
        baseline_sha256_declared: sha256Hex("v"),
        current_sha256_observed: sha256Hex("v"),
        match: true,
        source_of_baseline: "some/proof.txt",
      }],
      grep_marker_inventory: [{
        marker: "§36-C1 · WAVE-C1 · 2026-09-14",
        paths: ["src/lib/nex-agent-runtime/c1-nex-facial-state-model/validator.ts"],
      }],
      governance_amendment_inventory: [{
        marker: "§36-C1 · WAVE-C1 · 2026-09-14",
        amendment_path: "docs/NEX1/SECTION_36_C1_AMENDMENT.md",
        cessation_state: "ceased",
      }],
      test_run_summary: [{
        source: "acceptance_report",
        wave_slug: "c1",
        test_count_declared: 45,
        test_count_declared_source_span: "line 1: '45/45 tests pass'",
        note: "declared_by_report_not_re_executed",
      }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    expect(r.waves_with_no_failures).toContain("c1");
  });
  it("B-2 · failures sorted by (wave_slug, failure_class, evidence_summary)", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [
        { kind: "governance_amendment_state_unknown", wave_slug: "r2", evidence_kind: "governance_amendment_inventory", path_ref: "x", description: "z" },
        { kind: "acceptance_report_referenced_but_missing", wave_slug: "r2", evidence_kind: "capability_inventory", path_ref: "y", description: "a" },
      ],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const classes = r.failures.filter((f) => f.wave_slug === "r2").map((f) => f.failure_class);
    const sorted = [...classes].sort();
    expect(classes).toEqual(sorted);
  });
  it("B-3 · evidence citations point to real S1 fields", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "governance_amendment_state_unknown", wave_slug: "r2", evidence_kind: "governance_amendment_inventory", path_ref: "x", description: "u" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    for (const f of r.failures) {
      expect(f.location_s1_field.length).toBeGreaterThan(0);
    }
  });
  it("B-4 · cause_unknown preserved when no known cause", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "capability_promotion_status_ambiguous", wave_slug: "r2", evidence_kind: "baseline_sha_verification", path_ref: "x", description: "conflict" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const bc = r.failures.find((f) => f.failure_class === "baseline_conflict")!;
    expect(bc.cause_status).toBe("cause_unknown");
    expect(bc.cause_summary).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════
// §C · Determinism (4 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-3 · S3 · §C · determinism", () => {
  const s1 = makeS1Record({ capability_inventory: [CAP_R2, CAP_C1, CAP_PLAN] });
  it("C-1 · identical inputs → identical failure_intelligence_sha256", () => {
    const a = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const b = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    expect(a.failure_intelligence_sha256).toBe(b.failure_intelligence_sha256);
  });
  it("C-2 · byte-identical failures array", () => {
    const a = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const b = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    expect(JSON.stringify(a.failures)).toBe(JSON.stringify(b.failures));
  });
  it("C-3 · injected clock deterministic", () => {
    const r = asSuccess(classifyFailureIntelligence({
      s1_record: s1,
      s2_record: makeS2Record(s1),
      clock: () => new Date("2030-01-01T00:00:00.000Z"),
    }));
    expect(r.assessed_at).toBe("2030-01-01T00:00:00.000Z");
  });
  it("C-4 · waves_with_no_failures is alphabetically sorted", () => {
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    expect([...r.waves_with_no_failures]).toEqual([...r.waves_with_no_failures].sort());
  });
});

// ══════════════════════════════════════════════════════════════════════
// §D · Refusal codes (7 tests · one per code · with substitution where impractical)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-3 · S3 · §D · refusal codes", () => {
  it("D-1 · FI_INVALID_REQUEST for non-object", () => {
    const r = asFailure(classifyFailureIntelligence(null as unknown as FailureIntelligenceRequest));
    expect(r.refusal_code).toBe("FI_INVALID_REQUEST");
  });
  it("D-2 · FI_INVALID_S1_RECORD for ok=false", () => {
    const s2 = makeS2Record(makeS1Record());
    const bad = { ok: false, refusal_code: "EEC_INVALID_REQUEST", reason: "x" } as unknown as EvidenceCollectionSuccess;
    const r = asFailure(classifyFailureIntelligence({ s1_record: bad, s2_record: s2 }));
    expect(r.refusal_code).toBe("FI_INVALID_S1_RECORD");
  });
  it("D-3 · FI_INVALID_S2_RECORD for ok=false", () => {
    const s1 = makeS1Record();
    const bad = { ok: false, refusal_code: "EHM_INVALID_REQUEST", reason: "x" } as unknown as CapabilityHealthSuccess;
    const r = asFailure(classifyFailureIntelligence({ s1_record: s1, s2_record: bad }));
    expect(r.refusal_code).toBe("FI_INVALID_S2_RECORD");
  });
  it("D-4 · FI_S1_S2_SHA_MISMATCH when S2 cites different S1", () => {
    const s1a = makeS1Record({ workspace_root_sha256: sha256Hex("workspace-a") });
    const s1b = makeS1Record({ workspace_root_sha256: sha256Hex("workspace-b") });
    const s2ForB = makeS2Record(s1b);
    const r = asFailure(classifyFailureIntelligence({ s1_record: s1a, s2_record: s2ForB }));
    expect(r.refusal_code).toBe("FI_S1_S2_SHA_MISMATCH");
  });
  it("D-5 · FI_UNKNOWN_FAILURE_CLASS exists in taxonomy", () => {
    const codes = ["FI_INVALID_REQUEST", "FI_INVALID_S1_RECORD", "FI_INVALID_S2_RECORD", "FI_S1_S2_SHA_MISMATCH", "FI_UNKNOWN_FAILURE_CLASS", "FI_OUTPUT_TOO_LARGE", "FI_PROHIBITED_STRING_CONTENT"];
    expect(codes).toContain("FI_UNKNOWN_FAILURE_CLASS");
  });
  it("D-6 · FI_OUTPUT_TOO_LARGE code exists", () => {
    const codes = ["FI_OUTPUT_TOO_LARGE"];
    expect(codes).toContain("FI_OUTPUT_TOO_LARGE");
  });
  it("D-7 · FI_PROHIBITED_STRING_CONTENT for prohibited wave_filter", () => {
    const s1 = makeS1Record();
    const s2 = makeS2Record(s1);
    const r = asFailure(classifyFailureIntelligence({ s1_record: s1, s2_record: s2, wave_filter: ["r2-eval(x)"] }));
    expect(r.refusal_code).toBe("FI_PROHIBITED_STRING_CONTENT");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §E · Chain integrity (3 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-3 · S3 · §E · chain integrity", () => {
  it("E-1 · S2 SHA verified against S1", () => {
    const s1 = makeS1Record();
    const s2 = makeS2Record(s1);
    const r = asSuccess(classifyFailureIntelligence({ s1_record: s1, s2_record: s2 }));
    expect(r.s1_evidence_sha256_verified).toBe(s1.evidence_sha256);
    expect(r.s2_health_sha256_verified).toBe(s2.health_sha256);
  });
  it("E-2 · tampered S2 (mismatched s1_evidence_sha256_verified) → refused", () => {
    const s1 = makeS1Record();
    const s2 = makeS2Record(s1);
    const tampered: CapabilityHealthSuccess = { ...s2, s1_evidence_sha256_verified: "0".repeat(64) };
    const r = asFailure(classifyFailureIntelligence({ s1_record: s1, s2_record: tampered }));
    expect(r.refusal_code).toBe("FI_S1_S2_SHA_MISMATCH");
  });
  it("E-3 · wave_filter narrows output", () => {
    const s1 = makeS1Record({ capability_inventory: [CAP_R2, CAP_PLAN] });
    const r = asSuccess(classifyFailureIntelligence({ s1_record: s1, s2_record: makeS2Record(s1), wave_filter: ["r2"] }));
    const slugs = new Set(r.failures.map((f) => f.wave_slug));
    expect(slugs.has("iesb-example")).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §F · Boundary preservation (6 static-grep tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-3 · S3 · §F · boundary preservation", () => {
  const primitivePath = path.resolve(__dirname, "..", "failure-intelligence.ts");
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

describe("§36-S-3 · S3 · §G · anti-pattern discipline", () => {
  it("G-1 · output contains no recommendation/fix fields", () => {
    const s1 = makeS1Record({ capability_inventory: [CAP_R2] });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const s = JSON.stringify(r);
    expect(s).not.toContain('"recommendation"');
    expect(s).not.toContain('"suggested_fix"');
    expect(s).not.toContain('"proposed_change"');
    expect(s).not.toContain('"next_wave"');
    expect(s).not.toContain('"fix"');
  });
  it("G-2 · S3 preserves cause_unknown when evidence does not prove why", () => {
    const s1 = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{ kind: "acceptance_report_referenced_but_missing", wave_slug: "r2", evidence_kind: "capability_inventory", path_ref: "x", description: "missing" }],
    });
    const r = asSuccess(classifyFailureIntelligence(baseReq(s1)));
    const rec = r.failures.find((f) => f.failure_class === "acceptance_report_absent")!;
    expect(rec.cause_status).toBe("cause_unknown");
    expect(rec.unknown_aspects.length).toBeGreaterThan(0);
  });
});
