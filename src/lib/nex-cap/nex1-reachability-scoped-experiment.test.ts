// NEX1 · Scoped Reachability-Isolation Experiment (Option B)
// Founder-authorised diagnostic · 2026-09-19
//
// Sole experimental variable: allowed_root_prefixes = ["src/lib/nex-agent"]
// All other parameters at defaults:
//   · max_files_scanned = 500 (DEFAULT_MAX_FILES_SCANNED)
//   · max_candidates = 50 (bigger than default only to observe rank distribution)
//   · max_content_bytes = default
//
// The function itself is UNMODIFIED. This test only calls it with a
// different `allowed_root_prefixes` argument.

import { describe, it, expect } from "vitest";
import { discoverRepositoryCandidates } from "@/lib/nex-agent/code-engine/capability-repository-discovery";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();

interface Case {
  id: string;
  target_token: string;         // lowercased concept as the pipeline would extract it
  target_symbol: string;        // original camelCase for reporting
  expected_file: string;
}

const CASES: readonly Case[] = [
  { id: "Q1", target_token: "assessfear", target_symbol: "assessFear",
    expected_file: "src/lib/nex-agent/code-engine/capability-fear.ts" },
  { id: "Q2", target_token: "runnativeinvestigation", target_symbol: "runNativeInvestigation",
    expected_file: "src/lib/nex-agent/code-engine/native-investigation-mode.ts" },
  { id: "Q3", target_token: "investigationconclusionentry", target_symbol: "InvestigationConclusionEntry",
    expected_file: "src/lib/nex-agent/code-engine/investigation-conclusion-store.ts" },
  { id: "Q4", target_token: "patternidof", target_symbol: "patternIdOf",
    expected_file: "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts" },
];

interface ScopedResult {
  id: string;
  target_symbol: string;
  target_token: string;
  expected_file: string;
  allowed_root_prefixes: readonly string[];
  files_scanned: number;
  files_matched: number;
  candidates_returned: number;
  target_reached: boolean;
  target_rank: number | null;
  target_score: number | null;
  target_filename_matches: number | null;
  target_content_matches: number | null;
  top1_path: string | null;
  top1_score: number | null;
  top1_is_target: boolean;
  capped_by: string;
  elapsed_ms: number;
  candidates_top10: Array<{ path: string; score: number; fn_matches: number; ct_matches: number }>;
}

describe("NEX1 · Scoped Reachability-Isolation Experiment (Option B)", () => {
  const first_pass: ScopedResult[] = [];
  const second_pass: ScopedResult[] = [];

  it(
    "runs scoped discoverRepositoryCandidates for all 4 cases · records reachability + discovery separately",
    () => {
      const outDir = path.join(REPO_ROOT, "data", "nex1-stage1-diagnostic");
      fs.mkdirSync(outDir, { recursive: true });

      const invoke = (c: Case): ScopedResult => {
        const t0 = performance.now();
        const r = discoverRepositoryCandidates({
          concepts: [c.target_token],
          repo_root: REPO_ROOT,
          allowed_root_prefixes: ["src/lib/nex-agent"],   // <── the ONLY experimental variable
          max_files_scanned: 500,
          max_candidates: 50,
        });
        const t1 = performance.now();
        const idx = r.candidates.findIndex(
          (cand) => cand.repo_relative_path.replace(/\\/g, "/") === c.expected_file,
        );
        const targetCand = idx >= 0 ? r.candidates[idx] : null;
        const top1 = r.candidates.length > 0 ? r.candidates[0] : null;
        return {
          id: c.id,
          target_symbol: c.target_symbol,
          target_token: c.target_token,
          expected_file: c.expected_file,
          allowed_root_prefixes: ["src/lib/nex-agent"],
          files_scanned: r.stats.files_scanned,
          files_matched: r.stats.files_matched,
          candidates_returned: r.candidates.length,
          target_reached: idx >= 0,
          target_rank: idx >= 0 ? idx : null,
          target_score: targetCand ? targetCand.match_score : null,
          target_filename_matches: targetCand ? targetCand.filename_matches : null,
          target_content_matches: targetCand ? targetCand.content_matches : null,
          top1_path: top1 ? top1.repo_relative_path : null,
          top1_score: top1 ? top1.match_score : null,
          top1_is_target: top1 ? top1.repo_relative_path.replace(/\\/g, "/") === c.expected_file : false,
          capped_by: r.stats.capped_by,
          elapsed_ms: Number((t1 - t0).toFixed(2)),
          candidates_top10: r.candidates.slice(0, 10).map((cand) => ({
            path: cand.repo_relative_path,
            score: cand.match_score,
            fn_matches: cand.filename_matches,
            ct_matches: cand.content_matches,
          })),
        };
      };

      // Pass 1
      for (const c of CASES) {
        const row = invoke(c);
        first_pass.push(row);
        console.log(
          `[${row.id}] target=${row.target_symbol} · files_scanned=${row.files_scanned} · target_reached=${row.target_reached} · rank=${row.target_rank} · top1=${row.top1_path} · top1_is_target=${row.top1_is_target} · elapsed=${row.elapsed_ms}ms`,
        );
      }

      // Pass 2 · repeatability
      for (const c of CASES) {
        second_pass.push(invoke(c));
      }

      // Byte-identical check (excluding elapsed_ms which is timing noise)
      for (let i = 0; i < CASES.length; i++) {
        const a = { ...first_pass[i], elapsed_ms: 0 };
        const b = { ...second_pass[i], elapsed_ms: 0 };
        const sameSignature = JSON.stringify(a) === JSON.stringify(b);
        console.log(`[${first_pass[i].id}] repeatability · byte-identical (excluding timing) = ${sameSignature}`);
        expect(sameSignature).toBe(true);
      }

      fs.writeFileSync(
        path.join(outDir, "reachability-scoped-experiment.json"),
        JSON.stringify(
          {
            experiment: "Reachability-Isolation-Scoped-Option-B",
            experimental_variable: "allowed_root_prefixes = ['src/lib/nex-agent']",
            all_other_params: "defaults · max_files_scanned=500 · max_candidates=50 (observation only)",
            first_pass,
            second_pass,
            byte_identical_across_passes: first_pass.every((r, i) => {
              const a = { ...r, elapsed_ms: 0 };
              const b = { ...second_pass[i], elapsed_ms: 0 };
              return JSON.stringify(a) === JSON.stringify(b);
            }),
          },
          null,
          2,
        ),
      );

      // Minimum sanity: 4 rows produced
      expect(first_pass.length).toBe(4);
    },
    120000,
  );
});
