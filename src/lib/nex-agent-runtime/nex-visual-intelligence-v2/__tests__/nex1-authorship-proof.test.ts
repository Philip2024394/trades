// §36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2 · authorship-proof
// NEX bounded infrastructure · authorship-proof harness · 2026-09-15
//
// Persists the NEX1-emitted Visual Difference Report bytes to real repo
// paths on first run. Verifies byte-identity on every subsequent run.
// Divergence between persisted content and primitive re-emission fails
// the suite. Hand-editing the emitted capability files is a governance
// violation caught here.

import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import { authorTypedDataContract } from "../../programming-mission/typed-data-contract-authoring";
import {
  V2_STYLE,
  V2_RANGES_TARGET_PATH,
  V2_REPORT_TARGET_PATH,
  buildV2RangesSpec,
  buildV2ReportSpec,
} from "../visual-difference-report-spec";

const REPO_ROOT = process.cwd();

const PERSISTED_RANGES_PATH = path.resolve(
  REPO_ROOT,
  "src/lib/nex-agent-runtime/nex-visual-intelligence-v2/visual-difference-report-ranges.ts",
);
const PERSISTED_REPORT_PATH = path.resolve(
  REPO_ROOT,
  "src/lib/nex-agent-runtime/nex-visual-intelligence-v2/visual-difference-report.ts",
);

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function emitRanges(): { content: string; sha: string } {
  const r = authorTypedDataContract({
    spec: buildV2RangesSpec(),
    style: V2_STYLE,
    target_path: V2_RANGES_TARGET_PATH,
  });
  if (!r.ok) throw new Error(`ranges authoring failed: ${r.refusal_code} · ${r.reason}`);
  return { content: r.content, sha: sha256Hex(r.content) };
}

function emitReport(): { content: string; sha: string } {
  const r = authorTypedDataContract({
    spec: buildV2ReportSpec(),
    style: V2_STYLE,
    target_path: V2_REPORT_TARGET_PATH,
  });
  if (!r.ok) throw new Error(`report authoring failed: ${r.refusal_code} · ${r.reason}`);
  return { content: r.content, sha: sha256Hex(r.content) };
}

beforeAll(() => {
  const dir = path.dirname(PERSISTED_RANGES_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const ranges = emitRanges();
  if (!existsSync(PERSISTED_RANGES_PATH)) {
    writeFileSync(PERSISTED_RANGES_PATH, ranges.content, "utf8");
  }
  const report = emitReport();
  if (!existsSync(PERSISTED_REPORT_PATH)) {
    writeFileSync(PERSISTED_REPORT_PATH, report.content, "utf8");
  }
});

describe("§36-V2 · V2 · nex1-authorship-proof · persistence + byte-identity", () => {
  it("A-1 · both capability files persist at expected paths", () => {
    expect(existsSync(PERSISTED_RANGES_PATH)).toBe(true);
    expect(existsSync(PERSISTED_REPORT_PATH)).toBe(true);
  });

  it("A-2 · ranges file is byte-identical to primitive re-emission", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    const emitted = emitRanges();
    expect(sha256Hex(persisted)).toBe(emitted.sha);
  });

  it("A-3 · report file is byte-identical to primitive re-emission", () => {
    const persisted = readFileSync(PERSISTED_REPORT_PATH, "utf8");
    const emitted = emitReport();
    expect(sha256Hex(persisted)).toBe(emitted.sha);
  });
});

describe("§36-V2 · V2 · authorship provenance headers", () => {
  it("B-1 · ranges file declares NEX1 authorship via typed_data_contract", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain("Coded by NEX1 via typed_data_contract");
    expect(persisted).toContain("§36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2");
  });

  it("B-2 · report file declares NEX1 authorship via typed_data_contract", () => {
    const persisted = readFileSync(PERSISTED_REPORT_PATH, "utf8");
    expect(persisted).toContain("Coded by NEX1 via typed_data_contract");
    expect(persisted).toContain("§36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2");
  });

  it("B-3 · spec module declares itself as MAI bounded infrastructure", () => {
    const spec = readFileSync(
      path.resolve(REPO_ROOT, "src/lib/nex-agent-runtime/nex-visual-intelligence-v2/visual-difference-report-spec.ts"),
      "utf8",
    );
    expect(spec).toContain("NEX bounded infrastructure");
    expect(spec).toContain("§36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2 · spec");
  });
});

describe("§36-V2 · V2 · real vocabulary content", () => {
  it("C-1 · ranges file contains both numeric ranges", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain("V2_MAX_PROPERTY_DIFFS");
    expect(persisted).toContain("V2_MAX_REQUESTED_CHANGES");
  });

  it("C-2 · ranges file contains all 4 literal-union vocabularies", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain("V2_PropertyKind");
    expect(persisted).toContain("V2_PropertyVerdict");
    expect(persisted).toContain("V2_RequestedChangeKind");
    expect(persisted).toContain("V2_OverallDifferenceVerdict");
  });

  it("C-3 · PropertyVerdict has the 6 locked verdicts", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain('"preserved"');
    expect(persisted).toContain('"changed_as_requested"');
    expect(persisted).toContain('"changed_unexpectedly"');
    expect(persisted).toContain('"violated_lock"');
    expect(persisted).toContain('"unable_to_verify"');
    expect(persisted).toContain('"not_applicable"');
  });

  it("C-4 · RequestedChangeKind has the 7 locked kinds", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain('"material_swap"');
    expect(persisted).toContain('"camera_change"');
    expect(persisted).toContain('"environment_change"');
    expect(persisted).toContain('"colour_adjust"');
    expect(persisted).toContain('"composition_reframe"');
    expect(persisted).toContain('"motion_activate"');
    expect(persisted).toContain('"none"');
  });

  it("C-5 · OverallVerdict has the 4 locked states", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain('"all_locked_preserved"');
    expect(persisted).toContain('"some_locked_violated"');
    expect(persisted).toContain('"some_uncertain"');
    expect(persisted).toContain('"all_uncertain"');
  });

  it("C-6 · refusal reason vocabulary complete (8 members)", () => {
    const persisted = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    expect(persisted).toContain("V2_DifferenceReportRefusalReason");
    expect(persisted).toContain('"V2_INVALID_REFERENCE_CONTRACT"');
    expect(persisted).toContain('"V2_INVALID_CANDIDATE_CONTRACT"');
    expect(persisted).toContain('"V2_CONTRACT_ID_MISMATCH"');
    expect(persisted).toContain('"V2_INVALID_REQUESTED_CHANGE"');
    expect(persisted).toContain('"V2_MAX_PROPERTY_DIFFS_EXCEEDED"');
    expect(persisted).toContain('"V2_MAX_REQUESTED_CHANGES_EXCEEDED"');
    expect(persisted).toContain('"V2_INVALID_STRING_CONTENT"');
    expect(persisted).toContain('"V2_INTERNAL"');
  });

  it("C-7 · report file declares all 3 interfaces", () => {
    const persisted = readFileSync(PERSISTED_REPORT_PATH, "utf8");
    expect(persisted).toContain("interface V2RequestedChange");
    expect(persisted).toContain("interface V2PropertyDiff");
    expect(persisted).toContain("interface VisualDifferenceReport");
  });

  it("C-8 · report file imports categorical types via type-only imports", () => {
    const persisted = readFileSync(PERSISTED_REPORT_PATH, "utf8");
    expect(persisted).toContain("import type");
    expect(persisted).toContain("./visual-difference-report-ranges");
  });

  it("C-9 · VisualDifferenceReport wires all counters + overall_verdict + generated_at", () => {
    const persisted = readFileSync(PERSISTED_REPORT_PATH, "utf8");
    expect(persisted).toContain("preserved_count");
    expect(persisted).toContain("changed_as_requested_count");
    expect(persisted).toContain("changed_unexpectedly_count");
    expect(persisted).toContain("violated_lock_count");
    expect(persisted).toContain("unable_to_verify_count");
    expect(persisted).toContain("overall_verdict");
    expect(persisted).toContain("generated_at");
  });
});

describe("§36-V2 · V2 · determinism", () => {
  it("D-1 · ranges re-emission produces byte-identical content", () => {
    const a = emitRanges();
    const b = emitRanges();
    expect(a.sha).toBe(b.sha);
    expect(a.content).toBe(b.content);
  });

  it("D-2 · report re-emission produces byte-identical content", () => {
    const a = emitReport();
    const b = emitReport();
    expect(a.sha).toBe(b.sha);
    expect(a.content).toBe(b.content);
  });
});

describe("§36-V2 · V2 · anti-injection sanity", () => {
  it("E-1 · emitted files contain zero prohibited execution patterns", () => {
    const r = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    const p = readFileSync(PERSISTED_REPORT_PATH, "utf8");
    for (const bad of ["eval(", "new Function", "child_process", "<script", "process.exit(", "require("]) {
      expect(r).not.toContain(bad);
      expect(p).not.toContain(bad);
    }
  });

  it("E-2 · emitted files contain zero provider names", () => {
    const r = readFileSync(PERSISTED_RANGES_PATH, "utf8");
    const p = readFileSync(PERSISTED_REPORT_PATH, "utf8");
    for (const prov of ["anthropic", "claude", "openai", "gpt-", "gemini", "midjourney", "dall-e", "stability", "flux."]) {
      expect(r.toLowerCase()).not.toContain(prov);
      expect(p.toLowerCase()).not.toContain(prov);
    }
  });
});
