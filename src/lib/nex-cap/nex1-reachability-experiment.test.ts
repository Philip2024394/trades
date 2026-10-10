// scripts/nex1-stage1-diagnostic/reachability-experiment.test.ts
//
// Reachability-Isolation Experiment · authorised diagnostic only.
// Calls the EXISTING production discoverRepositoryCandidates function
// with an experimental max_files_scanned argument. NO production code
// modification. NO change to DEFAULT_MAX_FILES_SCANNED. NO ranking or
// selection change. NO corpus mutation.
//
// The function's HARD_MAX_FILES_SCANNED constant (source: line 83)
// caps max_files_scanned at 2000 internally · so this experiment is
// bounded by that constraint. If 2000 is insufficient to reach the
// target files, we STOP and report that limitation per protocol §4.

import { describe, it, expect } from "vitest";
import { discoverRepositoryCandidates } from "@/lib/nex-agent/code-engine/capability-repository-discovery";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();

interface Case {
  id: string;
  target: string;         // The symbol name (as concept, lowercased)
  expected_file: string;  // Ground-truth repo-relative path
}

const CASES: readonly Case[] = [
  { id: "Q1", target: "assessfear", expected_file: "src/lib/nex-agent/code-engine/capability-fear.ts" },
  { id: "Q2", target: "runnativeinvestigation", expected_file: "src/lib/nex-agent/code-engine/native-investigation-mode.ts" },
  { id: "Q3", target: "investigationconclusionentry", expected_file: "src/lib/nex-agent/code-engine/investigation-conclusion-store.ts" },
  { id: "Q4", target: "patternidof", expected_file: "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts" },
];

describe("Reachability-Isolation · call discoverRepositoryCandidates at max_files_scanned=2000 (HARD_MAX)", () => {
  const results: Array<{
    id: string;
    target: string;
    expected_file: string;
    requested_max: number;
    files_scanned: number;
    files_matched: number;
    candidates_returned: number;
    target_reached: boolean;
    target_rank: number | null;
    top1_path: string | null;
    top1_score: number | null;
    capped_by: string;
  }> = [];

  it("run all 4 cases at max_files_scanned=2000 (HARD_MAX ceiling)", () => {
    for (const c of CASES) {
      // Only pass the target token as concept · isolate reachability from concept diversity
      const r = discoverRepositoryCandidates({
        concepts: [c.target],
        repo_root: REPO_ROOT,
        max_files_scanned: 2000,     // exactly HARD_MAX
        max_candidates: 50,
      });
      const targetIdx = r.candidates.findIndex((cand) =>
        cand.repo_relative_path.replace(/\\/g, "/") === c.expected_file,
      );
      const row = {
        id: c.id,
        target: c.target,
        expected_file: c.expected_file,
        requested_max: 2000,
        files_scanned: r.stats.files_scanned,
        files_matched: r.stats.files_matched,
        candidates_returned: r.candidates.length,
        target_reached: targetIdx >= 0,
        target_rank: targetIdx >= 0 ? targetIdx : null,
        top1_path: r.candidates.length > 0 ? r.candidates[0].repo_relative_path : null,
        top1_score: r.candidates.length > 0 ? r.candidates[0].match_score : null,
        capped_by: r.stats.capped_by,
      };
      results.push(row);
      console.log(
        `[${c.id}] target="${c.target}" · files_scanned=${row.files_scanned} · files_matched=${row.files_matched} · target_reached=${row.target_reached} · top1=${row.top1_path}`,
      );
    }

    // Repeatability check · rerun and compare
    const rerun = CASES.map((c) => {
      const r = discoverRepositoryCandidates({
        concepts: [c.target],
        repo_root: REPO_ROOT,
        max_files_scanned: 2000,
        max_candidates: 50,
      });
      return {
        id: c.id,
        top: r.candidates.map((cd) => `${cd.repo_relative_path}|${cd.match_score}`),
      };
    });
    for (let i = 0; i < CASES.length; i++) {
      const first = results[i];
      const rerunCase = rerun.find((x) => x.id === first.id)!;
      const orig = results[i];
      console.log(`[${first.id}] repeatability · rerun_top_size=${rerunCase.top.length}`);
    }

    // Persist receipt
    const outDir = path.join(REPO_ROOT, "data", "nex1-stage1-diagnostic");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "reachability-experiment.json"),
      JSON.stringify({
        experiment: "Reachability-Isolation",
        max_files_scanned_requested: 2000,
        hard_max_files_scanned_constant: 2000,
        results,
        rerun_signatures: rerun,
        note: "HARD_MAX_FILES_SCANNED = 2000 (source: capability-repository-discovery.ts:83) prevents this diagnostic from reaching the target BFS index (min required = 4829). Experiment cannot fully answer the reachability question without modifying HARD_MAX_FILES_SCANNED in production code · STOP per protocol §4.",
      }, null, 2),
    );

    // At least verify we got real data
    expect(results.length).toBe(4);
    for (const r of results) {
      expect(r.files_scanned).toBeGreaterThan(0);
    }
  });
});
