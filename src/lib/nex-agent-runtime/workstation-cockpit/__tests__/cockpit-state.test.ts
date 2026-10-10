// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit
// NEX bounded infrastructure · cockpit-state tests · 2026-09-14

import { describe, expect, it } from "vitest";
import { deriveCockpitState } from "../cockpit-state";
import type { DeriveCockpitStateRequest, DeriveCockpitStateSuccess } from "../cockpit-state-types";
import type { SpecialistFinding } from "../../specialist-reviewers/specialist-reviewer-types";
import type { FindingRefutationRecord } from "../../adversarial-refutation/refutation-engine-types";

// ── Fixture builders ────────────────────────────────────────────────────

function base(overrides: Partial<DeriveCockpitStateRequest> = {}): DeriveCockpitStateRequest {
  return {
    trace: null,
    lifecycle_state: null,
    specialist_findings: null,
    refutation_records: null,
    git_changes: null,
    preview_target_url: "/",
    preview_nonce: 0,
    preview_last_updated_at: null,
    ...overrides,
  };
}

function finding(finding_id: SpecialistFinding["finding_id"], severity: SpecialistFinding["severity"]): SpecialistFinding {
  return {
    specialist_id: "typescript-type-safety-reviewer",
    finding_id,
    severity,
    evidence_summary: "test-fixture",
  };
}

function refutation(verdict: "ACCEPTED" | "REFUTED" | "UNRESOLVED"): FindingRefutationRecord {
  return {
    source_finding: finding("TTS_EXPLICIT_ANY", "warning"),
    verdict,
    strategy_id: verdict === "REFUTED" ? "evidence_absent" : "verifiability",
    refutation_reason: `test verdict ${verdict}`,
    refutation_epistemic_status: "OBSERVATION",
    evidence_pattern_examined: null,
    evidence_pattern_matched: verdict === "ACCEPTED",
  };
}

function asSuccess(r: ReturnType<typeof deriveCockpitState>): DeriveCockpitStateSuccess {
  if (r.kind !== "SUCCESS") throw new Error(`unexpected refusal ${r.refusal_code}`);
  return r;
}

// ── §A · Refusal codes ─────────────────────────────────────────────────

describe("§36-W-2 · W2 · §A · refusal codes", () => {
  it("A-1 · null request → WCS_INVALID_REQUEST", () => {
    const r = deriveCockpitState(null as never);
    expect(r.kind).toBe("FAILURE");
    if (r.kind === "FAILURE") expect(r.refusal_code).toBe("WCS_INVALID_REQUEST");
  });
  it("A-2 · missing preview_target_url → WCS_INVALID_REQUEST", () => {
    const r = deriveCockpitState({ ...base(), preview_target_url: undefined as never });
    expect(r.kind).toBe("FAILURE");
  });
  it("A-3 · missing preview_nonce → WCS_INVALID_REQUEST", () => {
    const r = deriveCockpitState({ ...base(), preview_nonce: undefined as never });
    expect(r.kind).toBe("FAILURE");
  });
});

// ── §B · IDLE derivation ────────────────────────────────────────────────

describe("§36-W-2 · W2 · §B · IDLE default", () => {
  it("B-1 · empty request → IDLE", () => {
    const r = asSuccess(deriveCockpitState(base()));
    expect(r.view.engineering_activity).toBe("IDLE");
    expect(r.view.lifecycle_state).toBeNull();
    expect(r.view.error_diagnosis).toBeNull();
    expect(r.view.file_change_ledger.length).toBe(0);
  });
});

// ── §C · Lifecycle-driven activity ─────────────────────────────────────

describe("§36-W-2 · W2 · §C · lifecycle-driven activity", () => {
  it("C-1 · lifecycle CREATED → UNDERSTANDING", () => {
    const r = asSuccess(deriveCockpitState(base({ lifecycle_state: "CREATED" })));
    expect(r.view.engineering_activity).toBe("UNDERSTANDING");
  });
  it("C-2 · lifecycle EXECUTING → BUILDING", () => {
    const r = asSuccess(deriveCockpitState(base({ lifecycle_state: "EXECUTING" })));
    expect(r.view.engineering_activity).toBe("BUILDING");
  });
  it("C-3 · lifecycle TESTING → TESTING", () => {
    const r = asSuccess(deriveCockpitState(base({ lifecycle_state: "TESTING" })));
    expect(r.view.engineering_activity).toBe("TESTING");
  });
  it("C-4 · lifecycle RECOVERING → DIAGNOSING", () => {
    const r = asSuccess(deriveCockpitState(base({ lifecycle_state: "RECOVERING" })));
    expect(r.view.engineering_activity).toBe("DIAGNOSING");
  });
  it("C-5 · lifecycle COMPLETED → COMPLETED", () => {
    const r = asSuccess(deriveCockpitState(base({ lifecycle_state: "COMPLETED" })));
    expect(r.view.engineering_activity).toBe("COMPLETED");
  });
  it("C-6 · lifecycle FAILED → FAILED", () => {
    const r = asSuccess(deriveCockpitState(base({ lifecycle_state: "FAILED" })));
    expect(r.view.engineering_activity).toBe("FAILED");
  });
  it("C-7 · lifecycle REFUSED → REFUSED", () => {
    const r = asSuccess(deriveCockpitState(base({ lifecycle_state: "REFUSED" })));
    expect(r.view.engineering_activity).toBe("REFUSED");
  });
  it("C-8 · lifecycle CANCELLED → CANCELLED", () => {
    const r = asSuccess(deriveCockpitState(base({ lifecycle_state: "CANCELLED" })));
    expect(r.view.engineering_activity).toBe("CANCELLED");
  });
});

// ── §D · Trace-stage-driven activity ───────────────────────────────────

describe("§36-W-2 · W2 · §D · trace-stage-driven activity", () => {
  it("D-1 · UNDERSTANDING stage → UNDERSTANDING activity", () => {
    const r = asSuccess(deriveCockpitState(base({
      trace: { trace_id: "t-1", current_stage_id: "UNDERSTANDING", stages: [] },
    })));
    expect(r.view.engineering_activity).toBe("UNDERSTANDING");
  });
  it("D-2 · EXECUTION stage → BUILDING activity", () => {
    const r = asSuccess(deriveCockpitState(base({
      trace: { trace_id: "t-1", current_stage_id: "EXECUTION", stages: [] },
    })));
    expect(r.view.engineering_activity).toBe("BUILDING");
  });
  it("D-3 · SPECIALIST_EVIDENCE stage → REVIEWING activity", () => {
    const r = asSuccess(deriveCockpitState(base({
      trace: { trace_id: "t-1", current_stage_id: "SPECIALIST_EVIDENCE", stages: [] },
    })));
    expect(r.view.engineering_activity).toBe("REVIEWING");
  });
  it("D-4 · unknown stage → IDLE", () => {
    const r = asSuccess(deriveCockpitState(base({
      trace: { trace_id: "t-1", current_stage_id: "UNKNOWN_STAGE", stages: [] },
    })));
    expect(r.view.engineering_activity).toBe("IDLE");
  });
});

// ── §E · Error precedence (findings + refutation) ──────────────────────

describe("§36-W-2 · W2 · §E · error precedence overrides lifecycle", () => {
  it("E-1 · unresolved refutation record → ERROR_FOUND (overrides lifecycle EXECUTING)", () => {
    const r = asSuccess(deriveCockpitState(base({
      lifecycle_state: "EXECUTING",
      refutation_records: [refutation("UNRESOLVED")],
    })));
    expect(r.view.engineering_activity).toBe("ERROR_FOUND");
    expect(r.view.error_diagnosis).not.toBeNull();
    expect(r.view.error_diagnosis?.error_kind).toBe("refutation_unresolved");
  });
  it("E-2 · critical specialist finding → ERROR_FOUND (overrides lifecycle)", () => {
    const r = asSuccess(deriveCockpitState(base({
      lifecycle_state: "EXECUTING",
      specialist_findings: [finding("NRB_FS_WRITE_IN_RUNTIME", "critical")],
    })));
    expect(r.view.engineering_activity).toBe("ERROR_FOUND");
    expect(r.view.error_diagnosis).not.toBeNull();
    expect(r.view.error_diagnosis?.error_kind).toBe("review_finding");
  });
  it("E-3 · only refuted (not unresolved) → DIAGNOSING", () => {
    const r = asSuccess(deriveCockpitState(base({
      lifecycle_state: "EXECUTING",
      refutation_records: [refutation("REFUTED")],
    })));
    expect(r.view.engineering_activity).toBe("DIAGNOSING");
  });
  it("E-4 · all accepted refutations · no critical findings → lifecycle wins", () => {
    const r = asSuccess(deriveCockpitState(base({
      lifecycle_state: "EXECUTING",
      refutation_records: [refutation("ACCEPTED"), refutation("ACCEPTED")],
      specialist_findings: [finding("TTS_EXPLICIT_ANY", "warning")],
    })));
    expect(r.view.engineering_activity).toBe("BUILDING");
    expect(r.view.error_diagnosis).toBeNull();
  });
  it("E-5 · lifecycle FAILED · no findings → error_diagnosis.orchestrator_error", () => {
    const r = asSuccess(deriveCockpitState(base({ lifecycle_state: "FAILED" })));
    expect(r.view.engineering_activity).toBe("FAILED");
    expect(r.view.error_diagnosis).not.toBeNull();
    expect(r.view.error_diagnosis?.error_kind).toBe("orchestrator_error");
  });
});

// ── §F-a · Ledger prefix filter (§36-W-2-a bug/UX fix) ────────────────

describe("§36-W-2-a · ledger include-prefix filter", () => {
  it("FA-1 · null prefixes → all changes included (previous behaviour)", () => {
    const r = asSuccess(deriveCockpitState(base({
      git_changes: [
        { status: "M", path: "src/lib/foo.ts" },
        { status: "M", path: "data/nex-storage/noise.jsonl" },
      ],
      ledger_include_prefixes: null,
    })));
    expect(r.view.file_change_ledger.length).toBe(2);
  });
  it("FA-2 · empty array prefixes → all changes included (equivalent to null)", () => {
    const r = asSuccess(deriveCockpitState(base({
      git_changes: [
        { status: "M", path: "src/lib/foo.ts" },
        { status: "M", path: "data/nex-storage/noise.jsonl" },
      ],
      ledger_include_prefixes: [],
    })));
    expect(r.view.file_change_ledger.length).toBe(2);
  });
  it("FA-3 · ['src/'] filters out data/** noise, keeps src/** entries", () => {
    const r = asSuccess(deriveCockpitState(base({
      git_changes: [
        { status: "M", path: "src/lib/foo.ts" },
        { status: "M", path: "src/app/page.tsx" },
        { status: "??", path: "data/nex-storage/a.jsonl" },
        { status: "??", path: "data/nex-storage/b.jsonl" },
        { status: "??", path: "data/knowledge-acquisition/c.jsonl" },
      ],
      ledger_include_prefixes: ["src/"],
    })));
    expect(r.view.file_change_ledger.length).toBe(2);
    expect(r.view.file_change_ledger.map((e) => e.path)).toEqual([
      "src/app/page.tsx",
      "src/lib/foo.ts",
    ]);
  });
  it("FA-4 · multi-prefix filter accepts entries under any prefix", () => {
    const r = asSuccess(deriveCockpitState(base({
      git_changes: [
        { status: "M", path: "src/lib/foo.ts" },
        { status: "M", path: "docs/NEX1/note.md" },
        { status: "??", path: "data/nex-storage/x.jsonl" },
      ],
      ledger_include_prefixes: ["src/", "docs/NEX1/"],
    })));
    expect(r.view.file_change_ledger.length).toBe(2);
  });
  it("FA-5 · derivation SHA differs when prefix filter changes", () => {
    const changes = [
      { status: "M", path: "src/lib/foo.ts" },
      { status: "??", path: "data/nex-storage/x.jsonl" },
    ];
    const a = asSuccess(deriveCockpitState(base({ git_changes: changes, ledger_include_prefixes: null })));
    const b = asSuccess(deriveCockpitState(base({ git_changes: changes, ledger_include_prefixes: ["src/"] })));
    expect(a.view.derivation_sha256).not.toBe(b.view.derivation_sha256);
  });
});

// ── §F-b · Preview causal-link honesty (§36-W-2-a) ────────────────────

describe("§36-W-2-a · preview causal-link honesty", () => {
  it("FB-1 · noisy ledger (>8 entries) → triggered_by_file = null (no false attribution)", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ status: "M" as const, path: `src/lib/file-${i}.ts` }));
    const r = asSuccess(deriveCockpitState(base({
      preview_nonce: 1,
      git_changes: many,
      ledger_include_prefixes: null,
    })));
    expect(r.view.preview_causal_link?.triggered_by_file).toBeNull();
    expect(r.view.preview_causal_link?.triggered_by_activity).toBeNull();
  });
  it("FB-2 · small ledger (≤8 entries) with nonce>0 → triggered_by_file is claimed", () => {
    const r = asSuccess(deriveCockpitState(base({
      preview_nonce: 1,
      git_changes: [{ status: "M", path: "src/app/page.tsx" }],
      ledger_include_prefixes: null,
    })));
    expect(r.view.preview_causal_link?.triggered_by_file).toBe("src/app/page.tsx");
  });
  it("FB-3 · filter reduces noisy ledger to attributable size → triggered_by_file claimed", () => {
    const changes = [
      { status: "M", path: "src/app/page.tsx" },
      ...Array.from({ length: 30 }, (_, i) => ({ status: "??" as const, path: `data/nex-storage/noise-${i}.jsonl` })),
    ];
    const r = asSuccess(deriveCockpitState(base({
      preview_nonce: 1,
      git_changes: changes,
      ledger_include_prefixes: ["src/"],
    })));
    // After filtering the ledger has only 1 entry (src/app/page.tsx) · attribution is honest
    expect(r.view.file_change_ledger.length).toBe(1);
    expect(r.view.preview_causal_link?.triggered_by_file).toBe("src/app/page.tsx");
  });
});

// ── §F · File-change ledger ────────────────────────────────────────────

describe("§36-W-2 · W2 · §F · file-change ledger", () => {
  it("F-1 · A status → CREATED action", () => {
    const r = asSuccess(deriveCockpitState(base({
      git_changes: [{ status: "A", path: "src/lib/foo.ts" }],
    })));
    expect(r.view.file_change_ledger.length).toBe(1);
    expect(r.view.file_change_ledger[0].action).toBe("CREATED");
  });
  it("F-2 · M status → MODIFIED action", () => {
    const r = asSuccess(deriveCockpitState(base({
      git_changes: [{ status: "M", path: "src/lib/bar.ts" }],
    })));
    expect(r.view.file_change_ledger[0].action).toBe("MODIFIED");
  });
  it("F-3 · D status → DELETED action", () => {
    const r = asSuccess(deriveCockpitState(base({
      git_changes: [{ status: "D", path: "src/lib/gone.ts" }],
    })));
    expect(r.view.file_change_ledger[0].action).toBe("DELETED");
  });
  it("F-4 · ?? status → CREATED action (untracked = new file)", () => {
    const r = asSuccess(deriveCockpitState(base({
      git_changes: [{ status: "??", path: "src/lib/new.ts" }],
    })));
    expect(r.view.file_change_ledger[0].action).toBe("CREATED");
  });
  it("F-5 · multiple entries sorted by path", () => {
    const r = asSuccess(deriveCockpitState(base({
      git_changes: [
        { status: "M", path: "src/lib/z.ts" },
        { status: "A", path: "src/lib/a.ts" },
        { status: "M", path: "src/lib/m.ts" },
      ],
    })));
    expect(r.view.file_change_ledger.map((e) => e.path)).toEqual([
      "src/lib/a.ts",
      "src/lib/m.ts",
      "src/lib/z.ts",
    ]);
  });
  it("F-6 · ledger entries carry triggered_by_activity derived from current state", () => {
    const r = asSuccess(deriveCockpitState(base({
      lifecycle_state: "EXECUTING",
      git_changes: [{ status: "A", path: "src/lib/x.ts" }],
    })));
    expect(r.view.file_change_ledger[0].triggered_by_activity).toBe("BUILDING");
  });
});

// ── §G · Preview causal link ───────────────────────────────────────────

describe("§36-W-2 · W2 · §G · preview causal link", () => {
  it("G-1 · nonce=0 → triggered_by_file is null (no file has caused a refresh yet)", () => {
    const r = asSuccess(deriveCockpitState(base({
      git_changes: [{ status: "M", path: "src/app/page.tsx" }],
    })));
    expect(r.view.preview_causal_link).not.toBeNull();
    expect(r.view.preview_causal_link?.triggered_by_file).toBeNull();
  });
  it("G-2 · nonce>0 with ledger entries → triggered_by_file is the first sorted entry", () => {
    const r = asSuccess(deriveCockpitState(base({
      preview_nonce: 1,
      git_changes: [{ status: "M", path: "src/app/page.tsx" }],
    })));
    expect(r.view.preview_causal_link?.triggered_by_file).toBe("src/app/page.tsx");
  });
  it("G-3 · preview_target_url passes through", () => {
    const r = asSuccess(deriveCockpitState(base({
      preview_target_url: "/nex-mission-priority-viewer",
    })));
    expect(r.view.preview_causal_link?.preview_target_url).toBe("/nex-mission-priority-viewer");
  });
});

// ── §H · Not-connected labelling ───────────────────────────────────────

describe("§36-W-2 · W2 · §H · not-connected labelling", () => {
  it("H-1 · empty request → four surfaces marked not_connected", () => {
    const r = asSuccess(deriveCockpitState(base()));
    const surfaces = r.view.not_connected_surfaces.map((n) => n.surface);
    expect(surfaces).toContain("orchestrator_trace");
    expect(surfaces).toContain("specialist_findings");
    expect(surfaces).toContain("refutation_records");
    expect(surfaces).toContain("git_changes");
  });
  it("H-2 · trace present → orchestrator_trace not in not_connected list", () => {
    const r = asSuccess(deriveCockpitState(base({
      trace: { trace_id: "t-1", current_stage_id: "EXECUTION", stages: [] },
    })));
    const surfaces = r.view.not_connected_surfaces.map((n) => n.surface);
    expect(surfaces).not.toContain("orchestrator_trace");
  });
  it("H-3 · all four surfaces present → not_connected list is empty", () => {
    const r = asSuccess(deriveCockpitState(base({
      trace: { trace_id: "t-1", current_stage_id: "EXECUTION", stages: [] },
      specialist_findings: [],
      refutation_records: [],
      git_changes: [],
    })));
    expect(r.view.not_connected_surfaces.length).toBe(0);
  });
});

// ── §I · Determinism ────────────────────────────────────────────────────

describe("§36-W-2 · W2 · §I · determinism", () => {
  it("I-1 · identical inputs produce identical derivation_sha256", () => {
    const req = base({
      lifecycle_state: "EXECUTING",
      git_changes: [{ status: "M", path: "src/app/x.tsx" }],
    });
    const a = asSuccess(deriveCockpitState(req));
    const b = asSuccess(deriveCockpitState(req));
    expect(a.view.derivation_sha256).toBe(b.view.derivation_sha256);
  });
  it("I-2 · derivation_sha256 is a 64-hex string", () => {
    const r = asSuccess(deriveCockpitState(base()));
    expect(r.view.derivation_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("I-3 · activity change flips the derivation sha", () => {
    const a = asSuccess(deriveCockpitState(base({ lifecycle_state: "EXECUTING" })));
    const b = asSuccess(deriveCockpitState(base({ lifecycle_state: "TESTING" })));
    expect(a.view.derivation_sha256).not.toBe(b.view.derivation_sha256);
  });
});

// ── §J · Grep marker ───────────────────────────────────────────────────

describe("§36-W-2 · W2 · §J · grep marker", () => {
  it("J-1 · success carries §36-W-2 marker", () => {
    const r = asSuccess(deriveCockpitState(base()));
    expect(r.view.grep_marker).toBe("§36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit");
  });
  it("J-2 · failure carries §36-W-2 marker", () => {
    const r = deriveCockpitState(null as never);
    if (r.kind === "FAILURE") {
      expect(r.grep_marker).toBe("§36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit");
    }
  });
});
