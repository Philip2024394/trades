// §36-RRD-AB · REAL-REPO-DEMO-A-PLUS-B · 2026-09-15 · real-repo-audit
// NEX bounded infrastructure · real-repo audit harness · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// One-shot audit that reads a curated set of real NEX repository files,
// constructs SkillCandidates, invokes Wave A + Wave B dispatchers, and
// emits structured findings to a JSON artifact. Test passes if the audit
// completes without throwing. Actual findings are the deliverable, not the
// pass/fail count.

import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import { runWaveALanguageFrameworkReviewers } from "../wave-a-language-framework/wave-a-language-framework";
import { runWaveBCrossCuttingReviewers } from "../wave-b-cross-cutting/wave-b-cross-cutting";
import type { SkillCandidate } from "../skills/skill-schema-types";

const REPO_ROOT = process.cwd();

// Curated real NEX files representing common surfaces.
const CURATED_FILES: readonly string[] = Object.freeze([
  "src/app/api/nex/hq/agents/route.ts",
  "src/app/nex-driver-directory-demo/page.tsx",
  "src/lib/nex/db.ts",
  "db/migrations/001_nex_brain_schema.sql",
  "src/lib/nex-agent-runtime/wave-a-language-framework/wave-a-language-framework.ts",
  "src/lib/nex-agent-runtime/skills/skill-schema.ts",
]);

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function loadCandidate(rel: string): SkillCandidate {
  const abs = path.resolve(REPO_ROOT, rel);
  const raw = readFileSync(abs, "utf8");
  return {
    workspace_relative_path: rel.replace(/\\/g, "/"),
    change_kind: "file_content",
    current_sha256_hex: sha256Hex(raw),
    proposed_content: raw,
    proposed_content_sha256_hex: sha256Hex(raw),
    declared_symbols: [],
    imported_symbols: [],
    imported_from_specifiers: [],
    authorised: true,
    test_count_declared: null,
  };
}

describe("§36-RRD-AB · Real-Repo A+B Audit · 2026-09-15", () => {
  it("R-1 · audit completes across all curated files", () => {
    const perFile: Array<Record<string, unknown>> = [];
    let totalWaveA = 0;
    let totalWaveB = 0;
    let totalCritical = 0;
    let totalWarning = 0;
    let totalAdvisory = 0;

    for (const rel of CURATED_FILES) {
      if (!existsSync(path.resolve(REPO_ROOT, rel))) {
        perFile.push({ file: rel, error: "not_found" });
        continue;
      }
      const cand = loadCandidate(rel);
      const a = runWaveALanguageFrameworkReviewers({ candidate: cand, specialists_to_run: "all" });
      const b = runWaveBCrossCuttingReviewers({ candidate: cand, specialists_to_run: "all" });
      if (a.kind !== "SUCCESS" || b.kind !== "SUCCESS") {
        perFile.push({ file: rel, error: "dispatcher_failure" });
        continue;
      }
      totalWaveA += a.total_findings;
      totalWaveB += b.total_findings;
      totalCritical += a.critical_count + b.critical_count;
      totalWarning += a.warning_count + b.warning_count;
      totalAdvisory += a.advisory_count + b.advisory_count;

      const findings_A = a.per_specialist.flatMap((p) =>
        p.findings.map((f) => ({
          dispatcher: "wave-a",
          specialist_id: f.specialist_id,
          finding_id: f.finding_id,
          severity: f.severity,
          evidence_summary: f.evidence_summary,
        })),
      );
      const findings_B = b.per_specialist.flatMap((p) =>
        p.findings.map((f) => ({
          dispatcher: "wave-b",
          specialist_id: f.specialist_id,
          finding_id: f.finding_id,
          severity: f.severity,
          evidence_summary: f.evidence_summary,
        })),
      );

      perFile.push({
        file: rel,
        candidate_sha256: cand.proposed_content_sha256_hex,
        wave_a: {
          overall_verdict: a.overall_verdict,
          total_findings: a.total_findings,
        },
        wave_b: {
          overall_verdict: b.overall_verdict,
          total_findings: b.total_findings,
        },
        findings: [...findings_A, ...findings_B],
      });
    }

    const artifact = {
      audit_id: "§36-RRD-AB · REAL-REPO-DEMO-A-PLUS-B · 2026-09-15",
      generated_at: new Date().toISOString(),
      curated_files_count: CURATED_FILES.length,
      files_audited: perFile.length,
      total_findings_wave_a: totalWaveA,
      total_findings_wave_b: totalWaveB,
      total_critical: totalCritical,
      total_warning: totalWarning,
      total_advisory: totalAdvisory,
      per_file: perFile,
    };

    const outDir = path.resolve(REPO_ROOT, "data/real-repo-audit-a-plus-b-2026-09-15");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "findings.json");
    writeFileSync(outPath, JSON.stringify(artifact, null, 2), "utf8");

    expect(perFile.length).toBe(CURATED_FILES.length);
  });
});
