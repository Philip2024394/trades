// NEX1 · Semantic Diagnostic Experiment · 2026-09-19
// Read-only w.r.t. every production capability file.
//
// PURPOSE
//   7 questions with independently-verified correct answers. For each,
//   run NEX's full pipeline in BOTH interrogative and imperative form.
//   Capture every intermediate packet field so we can see WHERE the
//   semantic link broke:
//     · vocabulary (classifier declines) ·
//     · candidate discovery (truth not in candidate_files) ·
//     · semantic matching (truth not linked to concepts) ·
//     · ranking (truth in candidates but not top) ·
//     · evidence evaluation (truth top but Q8 rejects) ·
//     · other
//
// No fix here. Diagnosis only.

import { describe, it, expect } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { runNativeInvestigation } from "@/lib/nex-agent/code-engine/native-investigation-mode";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "data", "nex1-semantic-diagnostic");

interface GroundTruth {
  id: string;
  interrogative: string;
  imperative: string;
  truth_file: string;
  truth_line?: number;
  target_symbol: string;
  question_kind: "location" | "behaviour" | "identity";
}

const QUESTIONS: readonly GroundTruth[] = [
  {
    id: "Q1",
    interrogative: "Where is assessFear defined?",
    imperative: "investigate where the assessFear function is defined",
    truth_file: "src/lib/nex-agent/code-engine/capability-fear.ts",
    truth_line: 121,
    target_symbol: "assessFear",
    question_kind: "location",
  },
  {
    id: "Q2",
    interrogative: "Where is runNativeInvestigation defined?",
    imperative: "investigate where the runNativeInvestigation function is defined",
    truth_file: "src/lib/nex-agent/code-engine/native-investigation-mode.ts",
    truth_line: 319,
    target_symbol: "runNativeInvestigation",
    question_kind: "location",
  },
  {
    id: "Q3",
    interrogative: "Where is InvestigationConclusionEntry defined?",
    imperative: "investigate where the InvestigationConclusionEntry interface is defined",
    truth_file: "src/lib/nex-agent/code-engine/investigation-conclusion-store.ts",
    truth_line: 38,
    target_symbol: "InvestigationConclusionEntry",
    question_kind: "identity",
  },
  {
    id: "Q4",
    interrogative: "Where is patternIdOf defined?",
    imperative: "investigate where the patternIdOf function is defined",
    truth_file: "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts",
    truth_line: 123,
    target_symbol: "patternIdOf",
    question_kind: "location",
  },
  {
    id: "Q5",
    interrogative: "What does appendInvestigationConclusions write?",
    imperative:
      "investigate what the appendInvestigationConclusions function writes",
    truth_file: "src/lib/nex-agent/code-engine/investigation-conclusion-store.ts",
    truth_line: 147,
    target_symbol: "appendInvestigationConclusions",
    question_kind: "behaviour",
  },
  {
    id: "Q6",
    interrogative: "Which file contains the Q8 selection policy?",
    imperative: "investigate which file implements the Q8 candidate-selector policy",
    truth_file: "src/lib/nex-agent/code-engine/capability-candidate-selector.ts",
    target_symbol: "capability-candidate-selector",
    question_kind: "identity",
  },
  {
    id: "Q7",
    interrogative: "Which file implements the abstraction mechanism?",
    imperative:
      "investigate which file implements the experience-abstraction capability",
    truth_file: "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts",
    target_symbol: "capability-experience-abstraction",
    question_kind: "identity",
  },
];

interface TraceRow {
  question_id: string;
  form: "interrogative" | "imperative";
  question: string;
  truth_file: string;
  target_symbol: string;
  investigation_id: string;
  trigger_kind: string;
  verb_family: string;
  search_terms: readonly string[];
  concepts: readonly string[];
  candidate_files_count: number;
  candidate_files_top10: Array<{ path: string; score: number; tags: readonly string[] }>;
  truth_file_in_candidates: boolean;
  truth_file_rank: number | null;
  truth_file_score: number | null;
  hypotheses_count: number;
  hypotheses_first: string | null;
  candidate_rankings_count: number;
  candidate_rankings_top3: Array<{ candidate_id?: string; source_file?: string; rank_position?: number; overall_status?: string }>;
  candidate_selection_count: number;
  selection_state_first: string | null;
  selected_file: string | null;
  q7_selected_matches_truth: boolean;
  q8_selected_matches_truth: boolean;
  first_broken_stage:
    | "classifier_declined"
    | "no_candidates"
    | "truth_not_in_candidates"
    | "truth_low_rank"
    | "wrong_top_ranked"
    | "correct_top_ranked_but_not_selected"
    | "correct_selection"
    | "other";
  broken_stage_reason: string;
}

describe("NEX1 · Semantic Diagnostic · 7 questions × 2 forms · 14 investigations", () => {
  const traces: TraceRow[] = [];

  it(
    "run all 7 questions in both interrogative and imperative form",
    async () => {
      if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

      for (const q of QUESTIONS) {
        for (const form of ["interrogative", "imperative"] as const) {
          const prompt = form === "interrogative" ? q.interrogative : q.imperative;
          const packet = await runNativeInvestigation({
            problem_statement: prompt,
            repo_root: REPO_ROOT,
            max_actions: 8,
          });

          // Locate truth in candidate_files (order = descending score by ranker)
          const truthIdx = packet.candidate_files.findIndex(
            (c) => c.path.replace(/\\/g, "/") === q.truth_file,
          );
          const truthInCandidates = truthIdx >= 0;
          const truthScore = truthInCandidates ? packet.candidate_files[truthIdx].score : null;

          // Q7 top-1 for the specific source_file
          const rankings = (packet as any).candidate_rankings ?? [];
          const rankingsTop3 = rankings.slice(0, 3).map((r: any) => ({
            candidate_id: r.candidate_id,
            source_file: r.source_file,
            rank_position: r.rank_position,
            overall_status: r.overall_status,
          }));

          // Q8 selection · was any selection on truth file?
          const selections = packet.candidate_selection;
          const selectionState = selections.length > 0 ? selections[0].selection_state : null;
          const q8Selected =
            selections.find(
              (s) =>
                s.source_file.replace(/\\/g, "/") === q.truth_file &&
                s.selection_state === "SELECTED",
            ) ?? null;
          const q8SelectedFile = q8Selected ? q8Selected.source_file : null;

          // Diagnose first broken stage · deterministic
          let broken: TraceRow["first_broken_stage"] = "other";
          let reason = "";
          if (packet.investigation_trigger_kind !== "PRIMARY_INVESTIGATE") {
            broken = "classifier_declined";
            reason = `trigger_kind=${packet.investigation_trigger_kind} · classifier did not recognise as INVESTIGATE`;
          } else if (packet.candidate_files.length === 0) {
            broken = "no_candidates";
            reason = "candidate_files empty · seed / walker / matcher produced nothing";
          } else if (!truthInCandidates) {
            broken = "truth_not_in_candidates";
            reason = `truth ${q.truth_file} not in ${packet.candidate_files.length} candidates · TOP=${packet.candidate_files[0].path}`;
          } else if (truthIdx > 0) {
            broken = "truth_low_rank";
            reason = `truth found at candidate_files index ${truthIdx} · score=${truthScore} · TOP score=${packet.candidate_files[0].score}`;
          } else if (
            selections.length === 0 ||
            (selections[0].source_file.replace(/\\/g, "/") !== q.truth_file)
          ) {
            broken = "correct_top_ranked_but_not_selected";
            reason = `truth is candidate #0 but Q8 selection targeted ${selections.length > 0 ? selections[0].source_file : "nothing"}`;
          } else if (selections[0].selection_state !== "SELECTED") {
            broken = "correct_top_ranked_but_not_selected";
            reason = `Q8 state is ${selections[0].selection_state} · not SELECTED · selected_candidate=${selections[0].selected_candidate}`;
          } else {
            broken = "correct_selection";
            reason = `SELECTED · ${selections[0].selected_candidate}`;
          }

          const row: TraceRow = {
            question_id: q.id,
            form,
            question: prompt,
            truth_file: q.truth_file,
            target_symbol: q.target_symbol,
            investigation_id: packet.investigation_id,
            trigger_kind: packet.investigation_trigger_kind,
            verb_family: packet.primary_verb_family,
            search_terms: packet.search_terms.slice(0, 20),
            concepts: packet.concepts.slice(0, 20),
            candidate_files_count: packet.candidate_files.length,
            candidate_files_top10: packet.candidate_files.slice(0, 10).map((c) => ({
              path: c.path,
              score: c.score,
              tags: c.matched_concept_tags,
            })),
            truth_file_in_candidates: truthInCandidates,
            truth_file_rank: truthInCandidates ? truthIdx : null,
            truth_file_score: truthScore,
            hypotheses_count: packet.hypotheses.length,
            hypotheses_first: packet.hypotheses[0]?.slice(0, 200) ?? null,
            candidate_rankings_count: rankings.length,
            candidate_rankings_top3: rankingsTop3,
            candidate_selection_count: selections.length,
            selection_state_first: selectionState,
            selected_file:
              selections.length > 0
                ? selections
                    .filter((s) => s.selection_state === "SELECTED")
                    .map((s) => s.source_file)
                    .join(" ; ") || null
                : null,
            q7_selected_matches_truth: truthIdx === 0,
            q8_selected_matches_truth: q8Selected !== null,
            first_broken_stage: broken,
            broken_stage_reason: reason,
          };
          traces.push(row);
          console.log(
            `[${q.id}/${form}] trigger=${packet.investigation_trigger_kind} · candidates=${packet.candidate_files.length} · truth_rank=${truthIdx} · Q8=${selectionState ?? "none"} · verdict=${broken}`,
          );
        }
      }

      writeFileSync(
        path.join(OUT_DIR, "traces.json"),
        JSON.stringify(traces, null, 2),
      );
      console.log(`[SEMANTIC-DX] wrote ${traces.length} trace rows`);

      expect(traces.length).toBe(QUESTIONS.length * 2);
    },
    600000,
  );
});
