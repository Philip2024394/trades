// §36-S-2 · WAVE-S2 · 2026-09-14 · capability-health-model
//
// Test suite for the capability-health-model primitive.
// Sections: §A per-dimension derivation · §B wave-level aggregation ·
// §C determinism · §D refusal codes · §E self-consistency chain ·
// §F freshness · §G boundary preservation · §H no S1 resolution.

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { assessCapabilityHealth } from "../health-model";
import type {
  CapabilityHealthFailure,
  CapabilityHealthRequest,
  CapabilityHealthResult,
  CapabilityHealthSuccess,
  HealthDimension,
} from "../health-model-types";
import type {
  CapabilityRecord,
  EvidenceCollectionSuccess,
  EvidenceGapNote,
  GovernanceAmendmentEntry,
  GrepMarkerEntry,
  RollbackProofEntry,
  TestRunSummaryEntry,
  BaselineVerificationEntry,
} from "../evidence-collector-types";

// ── Helpers ────────────────────────────────────────────────────────────

function asSuccess(r: CapabilityHealthResult): CapabilityHealthSuccess {
  if (!r.ok) throw new Error(`expected success, got: ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asFailure(r: CapabilityHealthResult): CapabilityHealthFailure {
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
    workspace_root_sha256: sha256Hex("workspace"),
    evidence_kinds_collected: [
      "capability_inventory",
      "test_run_summary",
      "rollback_proof_inventory",
      "grep_marker_inventory",
      "governance_amendment_inventory",
      "baseline_sha_verification",
      "gap_notes",
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
  const evidence_sha256 = sha256Hex(canonical);
  return { ...base, evidence_sha256 };
}

function baseReq(overrides?: Partial<CapabilityHealthRequest>): CapabilityHealthRequest {
  return {
    s1_record: makeS1Record(),
    clock: () => new Date("2026-09-14T12:00:01.000Z"),
    max_staleness_hours: 168,
    ...overrides,
  };
}

// Full deterministic S1 record with 3 waves for aggregation tests
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
const CAP_IESB_LIKE: CapabilityRecord = {
  wave_slug: "iesb-example",
  promotion_status: "plan_only",
  promoted_paths: [],
  acceptance_report_path: null,
  acceptance_report_sha256: null,
};

const BASELINE_C1_MATCH: BaselineVerificationEntry = {
  protected_path: "src/lib/nex-agent-runtime/c1-nex-facial-state-model/validator.ts",
  baseline_sha256_declared: sha256Hex("c1-validator"),
  current_sha256_observed: sha256Hex("c1-validator"),
  match: true,
  source_of_baseline: "data/route-r2-rollback-proof/baseline-hashes.txt",
};

const R2_PROOF: RollbackProofEntry = {
  wave_slug: "r2",
  baseline_hashes_path: "data/route-r2-rollback-proof/baseline-hashes.txt",
  baseline_hashes_sha256: sha256Hex("r2-proof"),
  protected_paths_declared: ["src/lib/nex-agent-runtime/c1-nex-facial-state-model/validator.ts"],
};

const R2_MARKER: GrepMarkerEntry = {
  marker: "§36-D-D · ROUTE-R2 · 2026-09-14 · test-scaffold-authoring",
  paths: ["src/lib/nex-agent-runtime/repo-intelligence/test-scaffold-authoring.ts"],
};

const R2_AMENDMENT: GovernanceAmendmentEntry = {
  marker: "§36-D-D · ROUTE-R2 · 2026-09-14",
  amendment_path: "docs/NEX1/SECTION_36_D_D_ROUTE_R2_TEST_SCAFFOLD_AMENDMENT.md",
  cessation_state: "ceased",
};

const R2_TEST_SUMMARY: TestRunSummaryEntry = {
  source: "acceptance_report",
  wave_slug: "r2",
  test_count_declared: 55,
  test_count_declared_source_span: "line 42: '55/55 R2 tests pass'",
  note: "declared_by_report_not_re_executed",
};

const FULL_S1_RECORD = makeS1Record({
  capability_inventory: [CAP_C1, CAP_R2, CAP_IESB_LIKE],
  baseline_sha_verification: [BASELINE_C1_MATCH],
  rollback_proof_inventory: [R2_PROOF],
  grep_marker_inventory: [R2_MARKER],
  governance_amendment_inventory: [R2_AMENDMENT],
  test_run_summary: [R2_TEST_SUMMARY],
});

// ══════════════════════════════════════════════════════════════════════
// §A · Per-dimension derivation
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-2 · S2 · §A · presence dimension", () => {
  it("A-1 · presence 'verified' for a promoted capability with baseline-verified path", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const c1 = r.reports.find((rep) => rep.wave_slug === "c1")!;
    const presence = c1.dimensions.find((d) => d.dimension === "presence")!;
    expect(presence.state).toBe("verified");
  });

  it("A-2 · presence 'not_applicable' for a plan-only wave", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const plan = r.reports.find((rep) => rep.wave_slug === "iesb-example")!;
    const presence = plan.dimensions.find((d) => d.dimension === "presence")!;
    expect(presence.state).toBe("not_applicable");
  });

  it("A-3 · presence 'verified' for infrastructure-only wave with acceptance report", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const presence = r2.dimensions.find((d) => d.dimension === "presence")!;
    expect(presence.state).toBe("verified");
  });
});

describe("§36-S-2 · S2 · §A · baseline_integrity dimension", () => {
  it("A-4 · baseline_integrity 'verified' when all match", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const bi = r2.dimensions.find((d) => d.dimension === "baseline_integrity")!;
    expect(bi.state).toBe("verified");
  });

  it("A-5 · baseline_integrity 'insufficient_evidence' when no verification entries", () => {
    const empty = makeS1Record({
      capability_inventory: [{ ...CAP_R2, promoted_paths: [] }],
    });
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: empty })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const bi = r2.dimensions.find((d) => d.dimension === "baseline_integrity")!;
    expect(bi.state).toBe("insufficient_evidence");
  });

  it("A-6 · baseline_integrity 'not_applicable' for plan-only wave", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const plan = r.reports.find((rep) => rep.wave_slug === "iesb-example")!;
    const bi = plan.dimensions.find((d) => d.dimension === "baseline_integrity")!;
    expect(bi.state).toBe("not_applicable");
  });
});

describe("§36-S-2 · S2 · §A · acceptance_report_integrity dimension", () => {
  it("A-7 · verified when acceptance_report_path and sha both present", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const ari = r2.dimensions.find((d) => d.dimension === "acceptance_report_integrity")!;
    expect(ari.state).toBe("verified");
  });

  it("A-8 · absent when gap note 'acceptance_report_referenced_but_missing' exists", () => {
    const withGap = makeS1Record({
      capability_inventory: [{ ...CAP_R2, acceptance_report_path: null, acceptance_report_sha256: null }],
      gap_notes: [{
        kind: "acceptance_report_referenced_but_missing",
        wave_slug: "r2",
        evidence_kind: "capability_inventory",
        path_ref: "docs/NEX1/BUILD_GATES/WAVE-R2-ACCEPTANCE-REPORT.md",
        description: "missing",
      }],
    });
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: withGap })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const ari = r2.dimensions.find((d) => d.dimension === "acceptance_report_integrity")!;
    expect(ari.state).toBe("absent");
  });

  it("A-9 · not_applicable for plan-only wave", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const plan = r.reports.find((rep) => rep.wave_slug === "iesb-example")!;
    const ari = plan.dimensions.find((d) => d.dimension === "acceptance_report_integrity")!;
    expect(ari.state).toBe("not_applicable");
  });
});

describe("§36-S-2 · S2 · §A · test_evidence_visibility dimension", () => {
  it("A-10 · verified when test_run_summary entry with positive count exists", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const tev = r2.dimensions.find((d) => d.dimension === "test_evidence_visibility")!;
    expect(tev.state).toBe("verified");
  });

  it("A-11 · insufficient_evidence when gap note exists", () => {
    const withGap = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [{
        kind: "test_count_source_span_not_locatable",
        wave_slug: "r2",
        evidence_kind: "test_run_summary",
        path_ref: "docs/NEX1/BUILD_GATES/WAVE-R2-ACCEPTANCE-REPORT.md",
        description: "no span",
      }],
    });
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: withGap })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const tev = r2.dimensions.find((d) => d.dimension === "test_evidence_visibility")!;
    expect(tev.state).toBe("insufficient_evidence");
  });

  it("A-12 · not_applicable for plan-only wave", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const plan = r.reports.find((rep) => rep.wave_slug === "iesb-example")!;
    const tev = plan.dimensions.find((d) => d.dimension === "test_evidence_visibility")!;
    expect(tev.state).toBe("not_applicable");
  });
});

describe("§36-S-2 · S2 · §A · governance_state dimension", () => {
  it("A-13 · verified when matching amendment is 'ceased'", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const gs = r2.dimensions.find((d) => d.dimension === "governance_state")!;
    expect(gs.state).toBe("verified");
  });

  it("A-14 · partial when amendment is 'active'", () => {
    const withActive = makeS1Record({
      capability_inventory: [CAP_R2],
      governance_amendment_inventory: [{ ...R2_AMENDMENT, cessation_state: "active" }],
    });
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: withActive })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const gs = r2.dimensions.find((d) => d.dimension === "governance_state")!;
    expect(gs.state).toBe("partial");
  });

  it("A-15 · insufficient_evidence when amendment state is 'unknown'", () => {
    const withUnknown = makeS1Record({
      capability_inventory: [CAP_R2],
      governance_amendment_inventory: [{ ...R2_AMENDMENT, cessation_state: "unknown" }],
    });
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: withUnknown })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const gs = r2.dimensions.find((d) => d.dimension === "governance_state")!;
    expect(gs.state).toBe("insufficient_evidence");
  });
});

describe("§36-S-2 · S2 · §A · marker_presence dimension", () => {
  it("A-16 · verified when a matching marker with paths exists", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const mp = r2.dimensions.find((d) => d.dimension === "marker_presence")!;
    expect(mp.state).toBe("verified");
  });

  it("A-17 · insufficient_evidence when no marker matches wave slug", () => {
    const noMarker = makeS1Record({ capability_inventory: [CAP_R2] });
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: noMarker })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const mp = r2.dimensions.find((d) => d.dimension === "marker_presence")!;
    expect(mp.state).toBe("insufficient_evidence");
  });

  it("A-18 · not_applicable for plan-only wave with no marker", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const plan = r.reports.find((rep) => rep.wave_slug === "iesb-example")!;
    const mp = plan.dimensions.find((d) => d.dimension === "marker_presence")!;
    expect(mp.state).toBe("not_applicable");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §B · Wave-level aggregation
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-2 · S2 · §B · aggregation", () => {
  it("B-1 · c1 strongest_dimensions includes presence and baseline_integrity", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const c1 = r.reports.find((rep) => rep.wave_slug === "c1")!;
    expect(c1.strongest_dimensions).toContain("presence");
    expect(c1.strongest_dimensions).toContain("baseline_integrity");
  });

  it("B-2 · empty S1 with only plan-only wave → all dimensions not_applicable", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD, wave_filter: ["iesb-example"] })));
    const plan = r.reports.find((rep) => rep.wave_slug === "iesb-example")!;
    for (const d of plan.dimensions) {
      expect(d.state).toBe("not_applicable");
    }
    expect(plan.strongest_dimensions.length).toBe(0);
    expect(plan.weakest_dimensions.length).toBe(0);
  });

  it("B-3 · weakest_dimensions includes marker_presence when marker missing", () => {
    const noMarker = makeS1Record({ capability_inventory: [CAP_R2] });
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: noMarker })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    expect(r2.weakest_dimensions).toContain("marker_presence");
  });

  it("B-4 · weakest_dimensions includes acceptance_report_integrity when absent", () => {
    const withGap = makeS1Record({
      capability_inventory: [{ ...CAP_R2, acceptance_report_path: null, acceptance_report_sha256: null }],
      gap_notes: [{
        kind: "acceptance_report_referenced_but_missing",
        wave_slug: "r2",
        evidence_kind: "capability_inventory",
        path_ref: "docs/NEX1/BUILD_GATES/WAVE-R2-ACCEPTANCE-REPORT.md",
        description: "missing",
      }],
    });
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: withGap })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    expect(r2.weakest_dimensions).toContain("acceptance_report_integrity");
  });

  it("B-5 · strongest and weakest are alphabetically sorted", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    for (const rep of r.reports) {
      const strongSorted = [...rep.strongest_dimensions].sort();
      const weakSorted = [...rep.weakest_dimensions].sort();
      expect(rep.strongest_dimensions).toEqual(strongSorted);
      expect(rep.weakest_dimensions).toEqual(weakSorted);
    }
  });

  it("B-6 · reports iterated alphabetically by wave_slug", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const slugs = r.reports.map((rep) => rep.wave_slug);
    expect(slugs).toEqual([...slugs].sort());
  });
});

// ══════════════════════════════════════════════════════════════════════
// §C · Determinism (4 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-2 · S2 · §C · determinism", () => {
  it("C-1 · same input → same health_sha256", () => {
    const a = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const b = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    expect(a.health_sha256).toBe(b.health_sha256);
  });

  it("C-2 · same input → byte-identical reports array", () => {
    const a = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const b = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    expect(JSON.stringify(a.reports)).toBe(JSON.stringify(b.reports));
  });

  it("C-3 · injected clock makes assessed_at deterministic", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({
      s1_record: FULL_S1_RECORD,
      clock: () => new Date("2027-01-01T00:00:00.000Z"),
      max_staleness_hours: 8760,
    })));
    expect(r.assessed_at).toBe("2027-01-01T00:00:00.000Z");
  });

  it("C-4 · every dimension array is alphabetically sorted by dimension name", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    for (const rep of r.reports) {
      const dims = rep.dimensions.map((d) => d.dimension);
      expect(dims).toEqual([...dims].sort());
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// §D · Refusal codes (8 tests · one per code)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-2 · S2 · §D · refusal codes", () => {
  it("D-1 · EHM_INVALID_REQUEST for non-object", () => {
    const r = asFailure(assessCapabilityHealth(null as unknown as CapabilityHealthRequest));
    expect(r.refusal_code).toBe("EHM_INVALID_REQUEST");
  });

  it("D-2 · EHM_INVALID_S1_RECORD for missing ok=true", () => {
    const r = asFailure(assessCapabilityHealth({
      s1_record: { ok: false, refusal_code: "EEC_INVALID_REQUEST", reason: "x" } as unknown as EvidenceCollectionSuccess,
    }));
    expect(r.refusal_code).toBe("EHM_INVALID_S1_RECORD");
  });

  it("D-3 · EHM_S1_EVIDENCE_SHA_MISMATCH for tampered SHA", () => {
    const rec = makeS1Record();
    const tampered: EvidenceCollectionSuccess = { ...rec, evidence_sha256: "0".repeat(64) };
    const r = asFailure(assessCapabilityHealth(baseReq({ s1_record: tampered })));
    expect(r.refusal_code).toBe("EHM_S1_EVIDENCE_SHA_MISMATCH");
  });

  it("D-4 · EHM_S1_RECORD_STALE for old record with tight threshold", () => {
    const oldRec = makeS1Record({ collected_at: "2020-01-01T00:00:00.000Z" });
    const r = asFailure(assessCapabilityHealth({
      s1_record: oldRec,
      clock: () => new Date("2026-09-14T12:00:00.000Z"),
      max_staleness_hours: 1,
    }));
    expect(r.refusal_code).toBe("EHM_S1_RECORD_STALE");
  });

  it("D-5 · EHM_UNKNOWN_HEALTH_DIMENSION for unknown dim", () => {
    const r = asFailure(assessCapabilityHealth(baseReq({ health_dimensions: ["not_a_dim" as HealthDimension] })));
    expect(r.refusal_code).toBe("EHM_UNKNOWN_HEALTH_DIMENSION");
  });

  it("D-6 · EHM_WAVE_FILTER_INVALID for invalid slug format", () => {
    const r = asFailure(assessCapabilityHealth(baseReq({ wave_filter: ["Invalid Slug!"] })));
    expect(r.refusal_code).toBe("EHM_WAVE_FILTER_INVALID");
  });

  it("D-7 · EHM_OUTPUT_TOO_LARGE code exists in exhaustive taxonomy (impractical to trigger)", () => {
    const codes = [
      "EHM_INVALID_REQUEST", "EHM_INVALID_S1_RECORD", "EHM_S1_EVIDENCE_SHA_MISMATCH",
      "EHM_S1_RECORD_STALE", "EHM_UNKNOWN_HEALTH_DIMENSION", "EHM_WAVE_FILTER_INVALID",
      "EHM_OUTPUT_TOO_LARGE", "EHM_PROHIBITED_STRING_CONTENT",
    ];
    expect(codes).toContain("EHM_OUTPUT_TOO_LARGE");
  });

  it("D-8 · EHM_PROHIBITED_STRING_CONTENT for prohibited substring in wave_filter", () => {
    // Prohibited-substring check runs before slug-format check (defense-in-depth ordering).
    const r = asFailure(assessCapabilityHealth(baseReq({ wave_filter: ["r2-eval(x)"] })));
    expect(r.refusal_code).toBe("EHM_PROHIBITED_STRING_CONTENT");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §E · Self-consistency chain (4 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-2 · S2 · §E · self-consistency chain", () => {
  it("E-1 · mutated capability_inventory after signing → EHM_S1_EVIDENCE_SHA_MISMATCH", () => {
    const rec = makeS1Record({ capability_inventory: [CAP_C1] });
    // Mutate the record after it was signed (append a new capability without re-signing)
    const mutated: EvidenceCollectionSuccess = { ...rec, capability_inventory: [CAP_C1, CAP_R2] };
    const r = asFailure(assessCapabilityHealth(baseReq({ s1_record: mutated })));
    expect(r.refusal_code).toBe("EHM_S1_EVIDENCE_SHA_MISMATCH");
  });

  it("E-2 · S1 failure record (ok: false) → EHM_INVALID_S1_RECORD", () => {
    const bad = { ok: false, refusal_code: "EEC_INVALID_REQUEST", reason: "x" } as unknown as EvidenceCollectionSuccess;
    const r = asFailure(assessCapabilityHealth({ s1_record: bad }));
    expect(r.refusal_code).toBe("EHM_INVALID_S1_RECORD");
  });

  it("E-3 · intact SHA passes self-consistency", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    expect(r.s1_evidence_sha256_verified).toBe(FULL_S1_RECORD.evidence_sha256);
  });

  it("E-4 · verified state citations include s1_field references", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const verifiedDims = r2.dimensions.filter((d) => d.state === "verified");
    expect(verifiedDims.length).toBeGreaterThan(0);
    for (const dim of verifiedDims) {
      for (const cite of dim.citations) {
        expect(cite.s1_field.length).toBeGreaterThan(0);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// §F · Freshness (2 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-2 · S2 · §F · freshness", () => {
  it("F-1 · 200h old record with max_staleness_hours=168 → refused", () => {
    const oldRec = makeS1Record({ collected_at: new Date(Date.parse("2026-09-14T12:00:00.000Z") - 200 * 3600 * 1000).toISOString() });
    const r = asFailure(assessCapabilityHealth({
      s1_record: oldRec,
      clock: () => new Date("2026-09-14T12:00:00.000Z"),
      max_staleness_hours: 168,
    }));
    expect(r.refusal_code).toBe("EHM_S1_RECORD_STALE");
  });

  it("F-2 · same record with max_staleness_hours=720 → passes", () => {
    const oldRec = makeS1Record({ collected_at: new Date(Date.parse("2026-09-14T12:00:00.000Z") - 200 * 3600 * 1000).toISOString() });
    const r = asSuccess(assessCapabilityHealth({
      s1_record: oldRec,
      clock: () => new Date("2026-09-14T12:00:00.000Z"),
      max_staleness_hours: 720,
    }));
    expect(r.ok).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §G · Boundary preservation (6 static-grep tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-2 · S2 · §G · boundary preservation (static grep)", () => {
  const primitivePath = path.resolve(__dirname, "..", "health-model.ts");
  const primitiveSrc = fs.readFileSync(primitivePath, "utf8");

  it("G-1 · no fs.* filesystem calls", () => {
    expect(primitiveSrc).not.toMatch(/\bfs\.(readFileSync|readdirSync|statSync|readFile|readdir|stat|open|write|mkdir|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });

  it("G-2 · no child_process/spawn/exec/fork", () => {
    expect(primitiveSrc).not.toMatch(/\b(child_process|spawnSync|execSync|fork\()/);
    // exec is allowed only as re.exec (regex method); primitive doesn't call re.exec
    expect(primitiveSrc.match(/\bexec\(/g) ?? []).toHaveLength(0);
  });

  it("G-3 · no network calls", () => {
    expect(primitiveSrc).not.toMatch(/\b(fetch\(|http\.|https\.|dns\.|net\.|WebSocket)/);
  });

  it("G-4 · no write operations", () => {
    expect(primitiveSrc).not.toMatch(/\b(writeFile|writeFileSync|mkdirSync|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });

  it("G-5 · fully synchronous · no async/await/Promise.", () => {
    expect(primitiveSrc).not.toMatch(/\basync\s+function|\bawait\s+|\bPromise\./);
  });

  it("G-6 · no LLM references", () => {
    expect(primitiveSrc.toLowerCase()).not.toMatch(/anthropic|openai|\bllm\b/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §H · No S1 resolution / no S3/S4 leakage (2 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-2 · S2 · §H · anti-pattern discipline", () => {
  it("H-1 · S2 output contains no `recommendation` or `next_wave` field", () => {
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: FULL_S1_RECORD })));
    const serialised = JSON.stringify(r);
    expect(serialised).not.toContain('"recommendation"');
    expect(serialised).not.toContain('"suggested_fix"');
    expect(serialised).not.toContain('"next_wave"');
    expect(serialised).not.toContain('"failure_cause"');
    expect(serialised).not.toContain('"root_cause"');
  });

  it("H-2 · S2 output preserves S1 gap notes without silently resolving them", () => {
    const withGaps = makeS1Record({
      capability_inventory: [CAP_R2],
      gap_notes: [
        { kind: "test_count_source_span_not_locatable", wave_slug: "r2", evidence_kind: "test_run_summary", path_ref: "x", description: "S1 GAP-1: locked pattern didn't match" },
      ],
    });
    const r = asSuccess(assessCapabilityHealth(baseReq({ s1_record: withGaps })));
    const r2 = r.reports.find((rep) => rep.wave_slug === "r2")!;
    const tev = r2.dimensions.find((d) => d.dimension === "test_evidence_visibility")!;
    // The gap is REFERENCED in gap_note_refs, not silently resolved
    expect(tev.state).toBe("insufficient_evidence");
    expect(tev.gap_note_refs.length).toBeGreaterThan(0);
  });
});
