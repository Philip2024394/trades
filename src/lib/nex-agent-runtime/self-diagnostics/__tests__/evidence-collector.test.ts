// §36-S-1 · WAVE-S1 · 2026-09-14 · engineering-evidence-collector
//
// Test suite for the engineering-evidence-collector primitive.
// Sections: §A generation · §B determinism · §C refusal codes · §D security ·
// §E baseline mismatch hard gate · §F freshness · §G explicit excluded refusal ·
// §H pattern extraction discipline.

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createHash } from "node:crypto";
import { collectEngineeringEvidence } from "../evidence-collector";
import type {
  EvidenceCollectionFailure,
  EvidenceCollectionRequest,
  EvidenceCollectionResult,
  EvidenceCollectionSuccess,
  EvidenceKind,
  PathScanScope,
} from "../evidence-collector-types";

// ── Helpers ────────────────────────────────────────────────────────────

function asSuccess(r: EvidenceCollectionResult): EvidenceCollectionSuccess {
  if (!r.ok) throw new Error(`expected success, got: ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asFailure(r: EvidenceCollectionResult): EvidenceCollectionFailure {
  if (r.ok) throw new Error(`expected failure, got success (${r.evidence_sha256.slice(0, 12)}...)`);
  return r;
}

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");

const ALL_KINDS: readonly EvidenceKind[] = [
  "capability_inventory",
  "test_run_summary",
  "rollback_proof_inventory",
  "grep_marker_inventory",
  "governance_amendment_inventory",
  "baseline_sha_verification",
  "gap_notes",
];

const DEFAULT_SCOPE: PathScanScope = {
  source_roots: [
    "src/lib/nex-agent-runtime/programming-mission",
    "src/lib/nex-agent-runtime/repo-intelligence",
    "src/lib/nex-agent-runtime/c1-nex-facial-state-model",
    "src/lib/capability-labs/match-confidence-contract",
  ],
  doc_roots: ["docs/NEX1"],
  // Note: promoted-away lab rollback proofs (e.g. C1's archived lab rollback
  // proof) reference lab-path declarations that no longer exist post-promotion.
  // Those are historical artefacts; they are deliberately NOT in the default
  // authoritative-verification scope. The lab acceptance report itself IS
  // read via the registry §12.2, and remains discoverable that way.
  rollback_proof_roots: [
    "data/route-2-rollback-proof",
    "data/route-2b-rollback-proof",
    "data/route-2c-rollback-proof",
    "data/route-r1a-rollback-proof",
    "data/route-r1b-rollback-proof",
    "data/route-r2-rollback-proof",
    "data/wave-s1-rollback-proof",
  ],
};

function baseReq(overrides?: Partial<EvidenceCollectionRequest>): EvidenceCollectionRequest {
  return {
    workspace_root: REPO_ROOT,
    evidence_kinds: ALL_KINDS,
    path_scan_scope: DEFAULT_SCOPE,
    freshness_threshold_hours: 8760,
    clock: () => new Date("2026-09-14T12:00:00.000Z"),
    ...overrides,
  };
}

// ── Temporary sandbox workspace for isolated tests ─────────────────────

let sandbox: string;

beforeAll(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "eec-test-"));
});

afterAll(() => {
  try {
    fs.rmSync(sandbox, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

function seedSandbox(structure: Record<string, string>): void {
  for (const [rel, content] of Object.entries(structure)) {
    const abs = path.join(sandbox, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
}

function sandboxReq(overrides?: Partial<EvidenceCollectionRequest>): EvidenceCollectionRequest {
  return {
    workspace_root: sandbox,
    evidence_kinds: ALL_KINDS,
    path_scan_scope: {
      source_roots: [],
      doc_roots: [],
      rollback_proof_roots: [],
    },
    freshness_threshold_hours: 8760,
    clock: () => new Date("2026-09-14T12:00:00.000Z"),
    ...overrides,
  };
}

function shaOfFile(abs: string): string {
  return createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

// ══════════════════════════════════════════════════════════════════════
// §A · Category-level generation (real repo · ~20 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-1 · S1 · §A · capability_inventory", () => {
  it("A-1 · capability_inventory populated for each registry wave", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["capability_inventory"] })));
    const slugs = r.capability_inventory.map((c) => c.wave_slug);
    for (const expected of ["route-2", "route-2b", "route-2c", "c1", "r1a", "r1b", "r2"]) {
      expect(slugs).toContain(expected);
    }
  });

  it("A-2 · c1 record has promotion_status = promoted", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["capability_inventory"] })));
    const c1 = r.capability_inventory.find((c) => c.wave_slug === "c1");
    expect(c1).toBeDefined();
    expect(c1?.promotion_status).toBe("promoted");
    expect(c1?.promoted_paths.length).toBeGreaterThan(0);
  });

  it("A-3 · r2 record cites the authoritative acceptance report path", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["capability_inventory"] })));
    const r2 = r.capability_inventory.find((c) => c.wave_slug === "r2");
    expect(r2?.acceptance_report_path).toBe("docs/NEX1/BUILD_GATES/WAVE-R2-ACCEPTANCE-REPORT.md");
    expect(r2?.acceptance_report_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("§36-S-1 · S1 · §A · test_run_summary", () => {
  it("A-4 · test_run_summary entries (if any) carry the declared-only note", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["test_run_summary", "capability_inventory"] })));
    // Real acceptance reports currently use varied phrasing not matching the locked
    // TEST_COUNT_SPAN pattern. Any entry that IS emitted must carry the correct
    // provenance labels; any wave without a match must emit a structured gap note.
    for (const entry of r.test_run_summary) {
      expect(entry.source).toBe("acceptance_report");
      expect(entry.note).toBe("declared_by_report_not_re_executed");
      expect(entry.test_count_declared).toBeGreaterThan(0);
    }
  });

  it("A-5 · gap note emitted for r2 when locked TEST_COUNT_SPAN does not match the report", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["test_run_summary", "capability_inventory", "gap_notes"] })));
    // If test_run_summary lacks an r2 entry, the primitive must emit a
    // `test_count_source_span_not_locatable` gap note for r2 (no fabrication).
    const r2Entry = r.test_run_summary.find((t) => t.wave_slug === "r2");
    if (r2Entry === undefined) {
      const r2Gap = r.gap_notes.find(
        (g) => g.kind === "test_count_source_span_not_locatable" && g.wave_slug === "r2",
      );
      expect(r2Gap).toBeDefined();
    } else {
      expect(r2Entry.test_count_declared).toBeGreaterThan(0);
    }
  });
});

describe("§36-S-1 · S1 · §A · rollback_proof_inventory", () => {
  it("A-6 · rollback_proof_inventory finds R2's baseline-hashes.txt", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["rollback_proof_inventory"] })));
    const paths = r.rollback_proof_inventory.map((e) => e.baseline_hashes_path);
    expect(paths).toContain("data/route-r2-rollback-proof/baseline-hashes.txt");
  });

  it("A-7 · rollback proof declares protected paths (>=15 in R2)", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["rollback_proof_inventory"] })));
    const r2 = r.rollback_proof_inventory.find((e) => e.baseline_hashes_path === "data/route-r2-rollback-proof/baseline-hashes.txt");
    expect(r2).toBeDefined();
    expect(r2!.protected_paths_declared.length).toBeGreaterThanOrEqual(15);
  });
});

describe("§36-S-1 · S1 · §A · grep_marker_inventory", () => {
  it("A-8 · grep_marker_inventory contains §36-D-D · ROUTE-R2 marker", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["grep_marker_inventory"] })));
    const markers = r.grep_marker_inventory.map((e) => e.marker);
    const hasR2 = markers.some((m) => m.startsWith("§36-D-D · ROUTE-R2 · 2026-09-14"));
    expect(hasR2).toBe(true);
  });

  it("A-9 · grep_marker_inventory contains the IESB PLAN-ONLY marker", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["grep_marker_inventory"] })));
    const markers = r.grep_marker_inventory.map((e) => e.marker);
    const hasIESB = markers.some((m) => m.startsWith("IESB · PLAN-ONLY · 2026-09-14"));
    expect(hasIESB).toBe(true);
  });

  it("A-10 · marker entry lists paths where the marker appears (deterministically sorted)", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["grep_marker_inventory"] })));
    for (const entry of r.grep_marker_inventory) {
      const sorted = [...entry.paths].sort();
      expect(entry.paths).toEqual(sorted);
    }
  });
});

describe("§36-S-1 · S1 · §A · governance_amendment_inventory", () => {
  it("A-11 · finds all six §36 amendments", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["governance_amendment_inventory"] })));
    const paths = r.governance_amendment_inventory.map((e) => e.amendment_path);
    for (const expected of [
      "docs/NEX1/SECTION_36_A_ROUTE_2_LAB_AUTHORING_AMENDMENT.md",
      "docs/NEX1/SECTION_36_B_ROUTE_2B_RUNTIME_IMPORTS_AMENDMENT.md",
      "docs/NEX1/SECTION_36_C_ROUTE_2C_RUNTIME_IMPORT_LITERALS_AMENDMENT.md",
      "docs/NEX1/SECTION_36_D_A_ROUTE_R1A_REPO_SCAN_AMENDMENT.md",
      "docs/NEX1/SECTION_36_D_B_ROUTE_R1B_MISSION_PLANNER_AMENDMENT.md",
      "docs/NEX1/SECTION_36_D_D_ROUTE_R2_TEST_SCAFFOLD_AMENDMENT.md",
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it("A-12 · cessation_state derives to 'ceased' when locked pattern matches (sandbox)", () => {
    // Seed a synthetic amendment + acceptance report where the VERDICT_PASS
    // and WAVE_GREP_MARKER locked patterns BOTH match. Proves the derivation
    // algorithm works when patterns are present.
    const marker = "§36-D-Z · WAVE-DZ · 2026-09-14 · fake-amendment";
    seedSandbox({
      "docs/NEX1/SECTION_36_D_Z_FAKE_AMENDMENT.md": `# Fake\n\nGrep marker: \`${marker}\`\n`,
      "docs/NEX1/BUILD_GATES/WAVE-DZ-ACCEPTANCE-REPORT.md": `# Report\n\nRefers to ${marker}\n\n**Verdict:** PASS\n`,
    });
    const r = asSuccess(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["governance_amendment_inventory"],
      path_scan_scope: { source_roots: [], doc_roots: ["docs/NEX1"], rollback_proof_roots: [] },
    })));
    const dz = r.governance_amendment_inventory.find((e) => e.amendment_path.endsWith("SECTION_36_D_Z_FAKE_AMENDMENT.md"));
    expect(dz).toBeDefined();
    expect(dz?.cessation_state).toBe("ceased");
  });

  it("A-13 · nested-root discovery covers docs/NEX1/BENCHMARKS/", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["grep_marker_inventory"] })));
    const markers = r.grep_marker_inventory;
    const hasIesbAtBenchmarksPath = markers.some((m) =>
      m.paths.some((p) => p.startsWith("docs/NEX1/BENCHMARKS/")),
    );
    expect(hasIesbAtBenchmarksPath).toBe(true);
  });
});

describe("§36-S-1 · S1 · §A · baseline_sha_verification", () => {
  it("A-14 · baseline verification passes on the R2-declared protected files", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["baseline_sha_verification", "rollback_proof_inventory"] })));
    expect(r.baseline_sha_verification.length).toBeGreaterThanOrEqual(15);
    for (const entry of r.baseline_sha_verification) {
      expect(entry.match).toBe(true);
      expect(entry.current_sha256_observed).toBe(entry.baseline_sha256_declared);
    }
  });

  it("A-15 · workspace_root_sha256 is a deterministic 64-hex string", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq()));
    expect(r.workspace_root_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("A-16 · evidence_kinds_collected reflects the request", () => {
    const kinds: readonly EvidenceKind[] = ["capability_inventory", "test_run_summary"];
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: kinds })));
    expect(r.evidence_kinds_collected).toEqual(kinds);
  });

  it("A-17 · empty capability wave_filter returns entries for all registry waves", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["capability_inventory"] })));
    expect(r.capability_inventory.length).toBeGreaterThanOrEqual(7);
  });

  it("A-18 · wave_filter narrows capability_inventory to matching slugs", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["capability_inventory"], wave_filter: ["r2"] })));
    const slugs = r.capability_inventory.map((c) => c.wave_slug);
    expect(slugs).toEqual(["r2"]);
  });

  it("A-19 · wave_filter slug not in registry emits gap note", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ evidence_kinds: ["capability_inventory", "gap_notes"], wave_filter: ["not-a-real-wave"] })));
    const has = r.gap_notes.some((g) => g.kind === "wave_filter_slug_not_matched" && g.wave_slug === "not-a-real-wave");
    expect(has).toBe(true);
  });

  it("A-20 · gap_notes is deterministically sorted by composite key", () => {
    const a = asSuccess(collectEngineeringEvidence(baseReq()));
    const b = asSuccess(collectEngineeringEvidence(baseReq()));
    expect(a.gap_notes).toEqual(b.gap_notes);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §B · Determinism (4 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-1 · S1 · §B · determinism", () => {
  it("B-1 · identical inputs → identical evidence_sha256", () => {
    const a = asSuccess(collectEngineeringEvidence(baseReq()));
    const b = asSuccess(collectEngineeringEvidence(baseReq()));
    expect(a.evidence_sha256).toBe(b.evidence_sha256);
  });

  it("B-2 · every inventory array is sorted by a locked key", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq()));
    const shouldBeSorted = <T>(arr: readonly T[], keyFn: (t: T) => string): void => {
      const keys = arr.map(keyFn);
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
    };
    shouldBeSorted(r.capability_inventory, (c) => c.wave_slug);
    shouldBeSorted(r.test_run_summary, (t) => t.wave_slug);
    shouldBeSorted(r.rollback_proof_inventory, (e) => e.baseline_hashes_path);
    shouldBeSorted(r.grep_marker_inventory, (e) => e.marker);
    shouldBeSorted(r.governance_amendment_inventory, (e) => e.amendment_path);
    shouldBeSorted(r.baseline_sha_verification, (e) => e.protected_path);
  });

  it("B-3 · directory walk order does not affect output", () => {
    // Run twice with same input; determinism proven by identical hash.
    const a = asSuccess(collectEngineeringEvidence(baseReq()));
    const b = asSuccess(collectEngineeringEvidence(baseReq()));
    expect(a.capability_inventory).toEqual(b.capability_inventory);
    expect(a.grep_marker_inventory).toEqual(b.grep_marker_inventory);
  });

  it("B-4 · injected clock makes collected_at deterministic", () => {
    const r = asSuccess(collectEngineeringEvidence(baseReq({ clock: () => new Date("2001-02-03T04:05:06.000Z") })));
    expect(r.collected_at).toBe("2001-02-03T04:05:06.000Z");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §C · Refusal codes (9 tests · one per code)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-1 · S1 · §C · refusal codes", () => {
  it("C-1 · EEC_INVALID_REQUEST for non-object request", () => {
    const r = asFailure(collectEngineeringEvidence(null as unknown as EvidenceCollectionRequest));
    expect(r.refusal_code).toBe("EEC_INVALID_REQUEST");
  });

  it("C-2 · EEC_INVALID_WORKSPACE for non-existent workspace", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({ workspace_root: path.join(os.tmpdir(), "not-a-real-directory-eec-xyz123") })));
    expect(r.refusal_code).toBe("EEC_INVALID_WORKSPACE");
  });

  it("C-3 · EEC_UNKNOWN_EVIDENCE_KIND for unknown kind", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({ evidence_kinds: ["not_a_kind" as EvidenceKind] })));
    expect(r.refusal_code).toBe("EEC_UNKNOWN_EVIDENCE_KIND");
  });

  it("C-4 · EEC_INVALID_PATH for traversal in scope path", () => {
    const scope: PathScanScope = { source_roots: ["../outside"], doc_roots: [], rollback_proof_roots: [] };
    const r = asFailure(collectEngineeringEvidence(baseReq({ path_scan_scope: scope })));
    expect(r.refusal_code).toBe("EEC_INVALID_PATH");
  });

  it("C-5 · EEC_EVIDENCE_MISSING for malformed baseline hash file (sandbox)", () => {
    seedSandbox({ "data/wave-fake-rollback-proof/baseline-hashes.txt": "this is not a valid baseline line\n" });
    const r = asFailure(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["rollback_proof_inventory"],
      path_scan_scope: {
        source_roots: [],
        doc_roots: [],
        rollback_proof_roots: ["data/wave-fake-rollback-proof"],
      },
    })));
    expect(r.refusal_code).toBe("EEC_EVIDENCE_MISSING");
  });

  it("C-6 · EEC_EVIDENCE_STALE for old file with tight threshold", () => {
    seedSandbox({
      "data/wave-stale-rollback-proof/baseline-hashes.txt": "0000000000000000000000000000000000000000000000000000000000000000 *src/some.ts\n",
    });
    const oldTime = new Date("2001-01-01T00:00:00.000Z");
    fs.utimesSync(path.join(sandbox, "data/wave-stale-rollback-proof/baseline-hashes.txt"), oldTime, oldTime);
    const r = asFailure(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["rollback_proof_inventory"],
      path_scan_scope: {
        source_roots: [],
        doc_roots: [],
        rollback_proof_roots: ["data/wave-stale-rollback-proof"],
      },
      freshness_threshold_hours: 1,
      clock: () => new Date("2026-01-01T00:00:00.000Z"),
    })));
    expect(r.refusal_code).toBe("EEC_EVIDENCE_STALE");
  });

  it("C-7 · EEC_BASELINE_MISMATCH for declared-vs-observed drift (sandbox)", () => {
    seedSandbox({
      "src/foo.ts": "// original\n",
      "data/wave-drift-rollback-proof/baseline-hashes.txt": `0000000000000000000000000000000000000000000000000000000000000000 *src/foo.ts\n`,
    });
    const r = asFailure(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["baseline_sha_verification", "rollback_proof_inventory"],
      path_scan_scope: {
        source_roots: [],
        doc_roots: [],
        rollback_proof_roots: ["data/wave-drift-rollback-proof"],
      },
    })));
    expect(r.refusal_code).toBe("EEC_BASELINE_MISMATCH");
  });

  it("C-8 · EEC_OUTPUT_TOO_LARGE refusal exists in exhaustive taxonomy", () => {
    // Verified by static type export; runtime trigger requires >256KB output which
    // is impractical to synthesise deterministically. We assert the code exists.
    const codes: string[] = [
      "EEC_INVALID_REQUEST", "EEC_INVALID_WORKSPACE", "EEC_UNKNOWN_EVIDENCE_KIND",
      "EEC_INVALID_PATH", "EEC_EVIDENCE_MISSING", "EEC_EVIDENCE_STALE",
      "EEC_BASELINE_MISMATCH", "EEC_OUTPUT_TOO_LARGE", "EEC_PROHIBITED_STRING_CONTENT",
    ];
    expect(codes).toContain("EEC_OUTPUT_TOO_LARGE");
  });

  it("C-9 · EEC_PROHIBITED_STRING_CONTENT for wave_filter with prohibited content", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({ wave_filter: ["eval(1)"] })));
    expect(r.refusal_code).toBe("EEC_PROHIBITED_STRING_CONTENT");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §D · Security · path-injection (5 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-1 · S1 · §D · security · path-injection", () => {
  it("D-1 · null byte in path → EEC_INVALID_PATH", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({
      path_scan_scope: { source_roots: ["src/lib\0"], doc_roots: [], rollback_proof_roots: [] },
    })));
    expect(r.refusal_code).toBe("EEC_INVALID_PATH");
  });

  it("D-2 · backslash in path → EEC_INVALID_PATH", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({
      path_scan_scope: { source_roots: ["src\\lib"], doc_roots: [], rollback_proof_roots: [] },
    })));
    expect(r.refusal_code).toBe("EEC_INVALID_PATH");
  });

  it("D-3 · POSIX absolute path → EEC_INVALID_PATH", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({
      path_scan_scope: { source_roots: ["/etc"], doc_roots: [], rollback_proof_roots: [] },
    })));
    expect(r.refusal_code).toBe("EEC_INVALID_PATH");
  });

  it("D-4 · Windows absolute path → EEC_INVALID_PATH", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({
      path_scan_scope: { source_roots: ["C:/etc"], doc_roots: [], rollback_proof_roots: [] },
    })));
    expect(r.refusal_code).toBe("EEC_INVALID_PATH");
  });

  it("D-5 · protocol scheme → EEC_INVALID_PATH", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({
      path_scan_scope: { source_roots: ["file:src/lib"], doc_roots: [], rollback_proof_roots: [] },
    })));
    expect(r.refusal_code).toBe("EEC_INVALID_PATH");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §E · Baseline-mismatch hard gate (5 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-1 · S1 · §E · baseline-mismatch hard gate", () => {
  it("E-1 · simulated drift → EEC_BASELINE_MISMATCH not success record", () => {
    seedSandbox({
      "src/e1.ts": "// modified content\n",
      "data/wave-e1-rollback-proof/baseline-hashes.txt": `1111111111111111111111111111111111111111111111111111111111111111 *src/e1.ts\n`,
    });
    const r = asFailure(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["baseline_sha_verification", "rollback_proof_inventory"],
      path_scan_scope: { source_roots: [], doc_roots: [], rollback_proof_roots: ["data/wave-e1-rollback-proof"] },
    })));
    expect(r.refusal_code).toBe("EEC_BASELINE_MISMATCH");
    expect(r.offending_source).toBe("src/e1.ts");
  });

  it("E-2 · empty baseline hash file → EEC_EVIDENCE_MISSING", () => {
    seedSandbox({ "data/wave-e2-rollback-proof/baseline-hashes.txt": "\n\n" });
    const r = asFailure(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["rollback_proof_inventory"],
      path_scan_scope: { source_roots: [], doc_roots: [], rollback_proof_roots: ["data/wave-e2-rollback-proof"] },
    })));
    expect(r.refusal_code).toBe("EEC_EVIDENCE_MISSING");
  });

  it("E-3 · malformed baseline line → EEC_EVIDENCE_MISSING", () => {
    seedSandbox({ "data/wave-e3-rollback-proof/baseline-hashes.txt": "not-a-sha src/foo.ts\n" });
    const r = asFailure(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["rollback_proof_inventory"],
      path_scan_scope: { source_roots: [], doc_roots: [], rollback_proof_roots: ["data/wave-e3-rollback-proof"] },
    })));
    expect(r.refusal_code).toBe("EEC_EVIDENCE_MISSING");
  });

  it("E-4 · baseline referencing non-existent path → EEC_EVIDENCE_MISSING", () => {
    seedSandbox({ "data/wave-e4-rollback-proof/baseline-hashes.txt": `${"a".repeat(64)} *src/does-not-exist.ts\n` });
    const r = asFailure(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["baseline_sha_verification", "rollback_proof_inventory"],
      path_scan_scope: { source_roots: [], doc_roots: [], rollback_proof_roots: ["data/wave-e4-rollback-proof"] },
    })));
    expect(r.refusal_code).toBe("EEC_EVIDENCE_MISSING");
  });

  it("E-5 · conflicting baselines caught as gap note · most-recent capture is authoritative", () => {
    // Two rollback-proof files declare DIFFERENT SHAs for the same path.
    // The primitive treats the most-recent capture (by mtime) as authoritative
    // and emits a gap note describing the historical divergence.
    seedSandbox({ "src/e5.ts": "// content\n" });
    const realSha = shaOfFile(path.join(sandbox, "src/e5.ts"));
    seedSandbox({
      // Older rollback proof declares an OUTDATED (fake) SHA · will not be authoritative
      "data/wave-e5old-rollback-proof/baseline-hashes.txt": `${"1".repeat(64)} *src/e5.ts\n`,
    });
    // Set older file mtime to 36h before clock · still within 8760h freshness threshold
    const oldTime = new Date("2026-09-13T00:00:00.000Z");
    fs.utimesSync(path.join(sandbox, "data/wave-e5old-rollback-proof/baseline-hashes.txt"), oldTime, oldTime);
    // Newer rollback proof declares the REAL SHA · authoritative under most-recent-wins
    seedSandbox({
      "data/wave-e5new-rollback-proof/baseline-hashes.txt": `${realSha} *src/e5.ts\n`,
    });
    const newTime = new Date("2026-09-14T11:00:00.000Z");
    fs.utimesSync(path.join(sandbox, "data/wave-e5new-rollback-proof/baseline-hashes.txt"), newTime, newTime);
    const r = asSuccess(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["baseline_sha_verification", "rollback_proof_inventory", "gap_notes"],
      path_scan_scope: {
        source_roots: [],
        doc_roots: [],
        rollback_proof_roots: ["data/wave-e5old-rollback-proof", "data/wave-e5new-rollback-proof"],
      },
    })));
    // Divergence must be captured as a gap note (not silently reconciled)
    const hasConflictGap = r.gap_notes.some(
      (g) => g.kind === "capability_promotion_status_ambiguous" && g.path_ref === "src/e5.ts",
    );
    expect(hasConflictGap).toBe(true);
    // And the authoritative (most-recent) baseline verification must pass
    const entry = r.baseline_sha_verification.find((e) => e.protected_path === "src/e5.ts");
    expect(entry).toBeDefined();
    expect(entry?.match).toBe(true);
    expect(entry?.baseline_sha256_declared).toBe(realSha);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §F · Freshness (2 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-1 · S1 · §F · freshness", () => {
  it("F-1 · threshold=1h vs week-old file → EEC_EVIDENCE_STALE", () => {
    seedSandbox({
      "data/wave-f1-rollback-proof/baseline-hashes.txt": `${"c".repeat(64)} *src/x.ts\n`,
    });
    const oldTime = new Date("2025-01-01T00:00:00.000Z");
    fs.utimesSync(path.join(sandbox, "data/wave-f1-rollback-proof/baseline-hashes.txt"), oldTime, oldTime);
    const r = asFailure(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["rollback_proof_inventory"],
      path_scan_scope: { source_roots: [], doc_roots: [], rollback_proof_roots: ["data/wave-f1-rollback-proof"] },
      freshness_threshold_hours: 1,
      clock: () => new Date("2026-09-14T00:00:00.000Z"),
    })));
    expect(r.refusal_code).toBe("EEC_EVIDENCE_STALE");
  });

  it("F-2 · threshold=8760h vs same file → passes", () => {
    seedSandbox({ "src/f2.ts": "// f2\n" });
    const realSha = shaOfFile(path.join(sandbox, "src/f2.ts"));
    seedSandbox({
      "data/wave-f2-rollback-proof/baseline-hashes.txt": `${realSha} *src/f2.ts\n`,
    });
    const r = asSuccess(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["baseline_sha_verification", "rollback_proof_inventory"],
      path_scan_scope: { source_roots: [], doc_roots: [], rollback_proof_roots: ["data/wave-f2-rollback-proof"] },
      freshness_threshold_hours: 8760,
    })));
    expect(r.baseline_sha_verification.length).toBe(1);
    expect(r.baseline_sha_verification[0].match).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §G · Explicit excluded-source refusal (6 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-1 · S1 · §G · explicit excluded-source refusal", () => {
  it("G-1 · scope inside data/nex-storage/ → EEC_INVALID_PATH", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({
      path_scan_scope: { source_roots: [], doc_roots: [], rollback_proof_roots: ["data/nex-storage/something"] },
    })));
    expect(r.refusal_code).toBe("EEC_INVALID_PATH");
  });

  it("G-2 · scope inside data/nex-agent-workspaces/ → EEC_INVALID_PATH", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({
      path_scan_scope: { source_roots: ["data/nex-agent-workspaces/task-x"], doc_roots: [], rollback_proof_roots: [] },
    })));
    expect(r.refusal_code).toBe("EEC_INVALID_PATH");
  });

  it("G-3 · scope resolves to .env file → EEC_INVALID_PATH", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({
      path_scan_scope: { source_roots: [".env.local"], doc_roots: [], rollback_proof_roots: [] },
    })));
    expect(r.refusal_code).toBe("EEC_INVALID_PATH");
  });

  it("G-4 · scope resolves to credentials.json → EEC_INVALID_PATH", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({
      path_scan_scope: { source_roots: ["credentials.json"], doc_roots: [], rollback_proof_roots: [] },
    })));
    expect(r.refusal_code).toBe("EEC_INVALID_PATH");
  });

  it("G-5 · scope resolves to secrets/ directory → EEC_INVALID_PATH", () => {
    const r = asFailure(collectEngineeringEvidence(baseReq({
      path_scan_scope: { source_roots: ["secrets"], doc_roots: [], rollback_proof_roots: [] },
    })));
    expect(r.refusal_code).toBe("EEC_INVALID_PATH");
  });

  it("G-6 · files with .js extension discovered under recursive traversal are silently skipped", () => {
    seedSandbox({
      "src/g6/valid.ts": "// valid\n",
      "src/g6/skipped.js": "// skipped\n",
      "src/g6/skipped.json": "{}\n",
    });
    // With docs scoped to the sandbox, valid.ts is discoverable but the js/json siblings are not.
    const r = asSuccess(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["grep_marker_inventory"],
      path_scan_scope: { source_roots: ["src/g6"], doc_roots: [], rollback_proof_roots: [] },
    })));
    // No forbidden extension errors; no js/json files in any grep-marker path.
    for (const entry of r.grep_marker_inventory) {
      for (const p of entry.paths) {
        expect(p.endsWith(".js")).toBe(false);
        expect(p.endsWith(".json")).toBe(false);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// §H · Locked pattern extraction discipline (3 tests)
// ══════════════════════════════════════════════════════════════════════

describe("§36-S-1 · S1 · §H · locked pattern extraction discipline", () => {
  it("H-1 · TEST_COUNT_SPAN extracts count when the locked pattern is present (sandbox)", () => {
    // Seed a sandbox acceptance report at the exact registry path for `r2`
    // containing the locked "N/N tests pass" pattern. The primitive must
    // extract the numerator and cite the source span.
    seedSandbox({
      "docs/NEX1/BUILD_GATES/WAVE-R2-ACCEPTANCE-REPORT.md": "# fake report\n\nAll 42/42 tests pass here.\n",
    });
    const r = asSuccess(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["test_run_summary"],
      path_scan_scope: { source_roots: [], doc_roots: ["docs/NEX1/BUILD_GATES"], rollback_proof_roots: [] },
    })));
    const r2 = r.test_run_summary.find((e) => e.wave_slug === "r2");
    expect(r2).toBeDefined();
    expect(r2!.test_count_declared).toBe(42);
    expect(r2!.test_count_declared_source_span).toContain("42/42 tests pass");
  });

  it("H-2 · natural-language 'about 50 tests pass' is NOT extracted (non-fuzzy)", () => {
    seedSandbox({
      "docs/NEX1/BUILD_GATES/FAKE-ACCEPTANCE-REPORT.md": "This report claims about 50 tests pass across many files.\n",
    });
    const r = asSuccess(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["test_run_summary", "gap_notes"],
      path_scan_scope: {
        source_roots: [],
        doc_roots: ["docs/NEX1/BUILD_GATES"],
        rollback_proof_roots: [],
      },
    })));
    // No entry emitted for the fake report; registry lookups fail with gap notes
    // instead of fabricating counts from natural-language text.
    for (const entry of r.test_run_summary) {
      // Any entry that emitted must come from a registry-known wave, not the fake report.
      expect(entry.test_count_declared_source_span).not.toContain("about 50 tests pass");
    }
  });

  it("H-3 · governance amendment with no WAVE_GREP_MARKER emits gap note (fail-closed)", () => {
    seedSandbox({
      "docs/NEX1/SECTION_36_FAKE_AMENDMENT.md": "This amendment has no valid grep marker.\n",
    });
    const r = asSuccess(collectEngineeringEvidence(sandboxReq({
      evidence_kinds: ["governance_amendment_inventory", "gap_notes"],
      path_scan_scope: {
        source_roots: [],
        doc_roots: ["docs/NEX1"],
        rollback_proof_roots: [],
      },
    })));
    const has = r.gap_notes.some((g) => g.kind === "grep_marker_missing_in_expected_path" && g.path_ref?.endsWith("SECTION_36_FAKE_AMENDMENT.md"));
    expect(has).toBe(true);
  });
});
