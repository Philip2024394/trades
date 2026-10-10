// NEX1 · Q7 Re-Ranking Isolation · read-only diagnostic
// Founder-authorised 2026-09-19 · zero production modification.
//
// Captures every stage T0→T6 for Q1-Q4 by invoking runNativeInvestigation
// and reading the packet fields the pipeline already emits · no source
// modification · no instrumentation of production code.

import { describe, it, expect } from "vitest";
import { runNativeInvestigation } from "@/lib/nex-agent/code-engine/native-investigation-mode";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "data", "nex1-stage1-diagnostic");

const CASES = [
  { id: "Q1", problem: "investigate where the assessFear function is defined",
    expected: "src/lib/nex-agent/code-engine/capability-fear.ts" },
  { id: "Q2", problem: "investigate where the runNativeInvestigation function is defined",
    expected: "src/lib/nex-agent/code-engine/native-investigation-mode.ts" },
  { id: "Q3", problem: "investigate where the InvestigationConclusionEntry interface is defined",
    expected: "src/lib/nex-agent/code-engine/investigation-conclusion-store.ts" },
  { id: "Q4", problem: "investigate where the patternIdOf function is defined",
    expected: "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts" },
  // Ambiguity cases · toForwardSlash has 3 legitimate declarations
  { id: "A1", problem: "investigate where the toForwardSlash function is defined",
    expected: "src/lib/nex-agent/code-engine/capability-verification-case-generator.ts" },
  // recordEvidence has exported function + class method in different files
  { id: "A2", problem: "investigate where the recordEvidence function is defined",
    expected: "src/lib/nex-agent/adversarial-corpus.ts" },
];

interface StageSnapshot {
  case_id: string;
  expected_file: string;
  // T0 · reachability · counts only
  candidate_files_count: number;
  candidate_files_top5: Array<{
    path: string; score: number; matched_concept_tags: string[];
  }>;
  target_in_candidate_files: boolean;
  target_candidate_files_rank: number | null;

  // T1/T2 · what enters Q7 · Fix 13 evaluations grouped by source_file
  hypothesis_evaluations_count: number;
  hypothesis_evaluations_source_files: string[];

  // T3/T4 · Q7 output · candidate_rankings
  candidate_rankings_count: number;
  candidate_rankings_by_source_file: Record<
    string,
    Array<{
      candidate_id: string;
      rank_position: number | null;
      ranking_state: string;
      supporting_count: number;
      contradicting_count: number;
      insufficient_count: number;
      unresolved_count: number;
    }>
  >;
  target_source_file_rankings: Array<{
    candidate_id: string;
    rank_position: number | null;
    tuple_signature: string;
  }>;
  target_rank1_bucket_size: number | null;   // > 1 means Q7 emits TIE for target scope

  // T5/T6 · Q8 output · candidate_selection · full detail
  candidate_selection_count: number;
  selections_summary: Array<{
    source_file: string;
    selection_state: string;
    selected_candidate: string | null;
    candidates_considered: number;
    decision_reason: string;
  }>;
  target_selection: {
    source_file: string;
    selection_state: string;
    selected_candidate: string | null;
    decision_reason: string;
  } | null;
}

describe("NEX1 · Q7 Re-Ranking Isolation · trace T0-T6 for Q1-Q4", () => {
  const snapshots: StageSnapshot[] = [];

  it(
    "capture pipeline stages · runNativeInvestigation × 4 cases",
    async () => {
      fs.mkdirSync(OUT_DIR, { recursive: true });

      for (const c of CASES) {
        const packet = await runNativeInvestigation({
          problem_statement: c.problem,
          repo_root: REPO_ROOT,
          max_actions: 8,
        });

        // T0 · candidate_files
        const cfPosix = packet.candidate_files.map((f) => ({
          path: f.path.replace(/\\/g, "/"),
          score: f.score,
          matched_concept_tags: [...f.matched_concept_tags],
        }));
        const targetIdx = cfPosix.findIndex((f) => f.path === c.expected);

        // T1/T2 · hypothesis_evaluations (Fix 13 output · Q7 input)
        const anyPkt = packet as unknown as Record<string, unknown>;
        const evals: any[] = Array.isArray(anyPkt.hypothesis_evaluations)
          ? (anyPkt.hypothesis_evaluations as any[]) : [];
        const evalSourceFiles = Array.from(
          new Set(evals.map((e) => (typeof e === "object" && e && "source_file" in e ? (e.source_file as string) : "?"))),
        ).sort();

        // T3/T4 · candidate_rankings (Q7 output · grouped by source_file)
        const rankings: any[] = Array.isArray(anyPkt.candidate_rankings)
          ? (anyPkt.candidate_rankings as any[]) : [];
        const bySourceFile: Record<string, any[]> = {};
        for (const r of rankings) {
          const sf = r.source_file as string;
          if (!bySourceFile[sf]) bySourceFile[sf] = [];
          bySourceFile[sf].push(r);
        }
        for (const sf of Object.keys(bySourceFile)) {
          bySourceFile[sf].sort((a, b) => (a.rank_position ?? 999) - (b.rank_position ?? 999));
        }
        const targetSf = c.expected;
        const targetSfRankings = (bySourceFile[targetSf] ?? []).map((r) => ({
          candidate_id: r.candidate_id as string,
          rank_position: r.rank_position as number | null,
          tuple_signature: `[${r.contradicting_count}, ${r.unresolved_count}, ${r.insufficient_count}, -${r.supporting_count}]`,
        }));
        const rank1Bucket = (bySourceFile[targetSf] ?? []).filter((r) => r.rank_position === 1);
        const targetRank1BucketSize = rank1Bucket.length;

        // T5/T6 · candidate_selection (Q8 output · full detail)
        const selections = packet.candidate_selection ?? [];
        const targetSel = selections.find((s) => s.source_file.replace(/\\/g, "/") === c.expected) ?? null;

        const snap: StageSnapshot = {
          case_id: c.id,
          expected_file: c.expected,
          candidate_files_count: cfPosix.length,
          candidate_files_top5: cfPosix.slice(0, 5),
          target_in_candidate_files: targetIdx >= 0,
          target_candidate_files_rank: targetIdx >= 0 ? targetIdx : null,

          hypothesis_evaluations_count: evals.length,
          hypothesis_evaluations_source_files: evalSourceFiles,

          candidate_rankings_count: rankings.length,
          candidate_rankings_by_source_file: Object.fromEntries(
            Object.entries(bySourceFile).map(([sf, arr]) => [
              sf,
              arr.map((r) => ({
                candidate_id: r.candidate_id as string,
                rank_position: r.rank_position as number | null,
                ranking_state: r.ranking_state as string,
                supporting_count: r.supporting_count as number,
                contradicting_count: r.contradicting_count as number,
                insufficient_count: r.insufficient_count as number,
                unresolved_count: r.unresolved_count as number,
              })),
            ]),
          ),
          target_source_file_rankings: targetSfRankings,
          target_rank1_bucket_size: targetRank1BucketSize > 0 ? targetRank1BucketSize : null,

          candidate_selection_count: selections.length,
          selections_summary: selections.map((s) => ({
            source_file: s.source_file.replace(/\\/g, "/"),
            selection_state: s.selection_state,
            selected_candidate: s.selected_candidate,
            candidates_considered: s.candidates_considered.length,
            decision_reason: s.decision_reason,
          })),
          target_selection: targetSel
            ? {
                source_file: targetSel.source_file.replace(/\\/g, "/"),
                selection_state: targetSel.selection_state,
                selected_candidate: targetSel.selected_candidate,
                decision_reason: targetSel.decision_reason,
              }
            : null,
        };

        snapshots.push(snap);

        console.log(
          `[${c.id}] T0 candidate_files=${cfPosix.length} · target_in_cf=${targetIdx >= 0} · target_rank_in_cf=${targetIdx} · ` +
          `T4 candidate_rankings=${rankings.length} · target_sf_rankings=${targetSfRankings.length} · rank1_bucket=${targetRank1BucketSize} · ` +
          `T6 selections=${selections.length} · target_sel_state=${targetSel?.selection_state ?? "n/a"}`,
        );
      }

      fs.writeFileSync(
        path.join(OUT_DIR, "q7-isolation-trace.json"),
        JSON.stringify({ snapshots }, null, 2),
      );

      // Determinism check · rerun once
      const rerun: any[] = [];
      for (const c of CASES) {
        const packet = await runNativeInvestigation({
          problem_statement: c.problem,
          repo_root: REPO_ROOT,
          max_actions: 8,
        });
        rerun.push({
          case_id: c.id,
          candidate_rankings_count: (packet as any).candidate_rankings?.length ?? 0,
          selection_states: packet.candidate_selection.map((s) => s.selection_state).sort(),
        });
      }
      const firstPass = snapshots.map((s) => ({
        case_id: s.case_id,
        candidate_rankings_count: s.candidate_rankings_count,
        selection_states: s.selections_summary.map((x) => x.selection_state).sort(),
      }));
      const sig1 = createHash("sha256").update(JSON.stringify(firstPass)).digest("hex").slice(0, 16);
      const sig2 = createHash("sha256").update(JSON.stringify(rerun)).digest("hex").slice(0, 16);
      console.log(`\n[DETERMINISM] pass1 signature=${sig1} · pass2 signature=${sig2} · match=${sig1 === sig2}`);

      expect(snapshots.length).toBe(CASES.length);
    },
    600000,
  );
});
