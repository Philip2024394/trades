// NEX1 · Stage 1.6 · End-to-End Proof · full runNativeInvestigation pipeline
// Verifies the declaration bridge is wired correctly · Q1..Q4 return SELECTED
// via the REAL orchestrator (not the isolated Q7/Q8 harness) · and confirms
// the root-cause pipeline still forms Fix 11 compositions for Q2 (proving
// zero perturbation to the existing pipeline · §11 parallel-path invariant).

import { describe, it, expect } from "vitest";
import { runNativeInvestigation } from "@/lib/nex-agent/code-engine/native-investigation-mode";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "data", "nex1-stage1-6-bridge");

interface Case {
  id: string;
  problem: string;
  expected_files: string[];
}

const CASES: Case[] = [
  { id: "Q1", problem: "investigate where the assessFear function is defined",
    expected_files: ["src/lib/nex-agent/code-engine/capability-fear.ts"] },
  { id: "Q2", problem: "investigate where the runNativeInvestigation function is defined",
    expected_files: ["src/lib/nex-agent/code-engine/native-investigation-mode.ts"] },
  { id: "Q3", problem: "investigate where the InvestigationConclusionEntry interface is defined",
    expected_files: ["src/lib/nex-agent/code-engine/investigation-conclusion-store.ts"] },
  { id: "Q4", problem: "investigate where the patternIdOf function is defined",
    expected_files: [
      "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts",
      "src/lib/nex-agent/code-engine/capability-outcome-experience.ts",
    ] },
];

describe("NEX1 · Stage 1.6 · End-to-End Proof · declaration bridge via real pipeline", () => {
  it(
    "Q1..Q4 · declaration lookup reaches Q8 SELECTED via runNativeInvestigation",
    async () => {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const results: Record<string, {
        case_id: string;
        expected_files: string[];
        selected_files: string[];
        selection_states: Record<string, number>;
        rank_scope_states: Record<string, number>;
        composed_arguments_count: number;
        candidate_rankings_count: number;
        candidate_selection_count: number;
        matches_expected: boolean;
      }> = {};

      for (const c of CASES) {
        const packet = await runNativeInvestigation({
          problem_statement: c.problem,
          repo_root: REPO_ROOT,
          max_actions: 15,
        });

        const selectedFiles: string[] = [];
        const stateCounts: Record<string, number> = {};
        for (const s of packet.candidate_selection ?? []) {
          stateCounts[s.selection_state] = (stateCounts[s.selection_state] ?? 0) + 1;
          if (s.selection_state === "SELECTED" && s.selected_candidate) {
            let file = s.selected_candidate.split("::")[0];
            if (file.startsWith("decl@")) file = file.slice("decl@".length);
            if (!selectedFiles.includes(file)) selectedFiles.push(file);
          }
        }

        const rankStateCounts: Record<string, number> = {};
        for (const r of packet.candidate_rankings ?? []) {
          rankStateCounts[r.scope_state] = (rankStateCounts[r.scope_state] ?? 0) + 1;
        }

        const matchesExpected = c.expected_files.every((f) => selectedFiles.includes(f));

        results[c.id] = {
          case_id: c.id,
          expected_files: c.expected_files,
          selected_files: selectedFiles.sort(),
          selection_states: stateCounts,
          rank_scope_states: rankStateCounts,
          composed_arguments_count: (packet.composed_arguments ?? []).length,
          candidate_rankings_count: (packet.candidate_rankings ?? []).length,
          candidate_selection_count: (packet.candidate_selection ?? []).length,
          matches_expected: matchesExpected,
        };

        console.log(
          `\n[${c.id}] ${c.problem}\n` +
          `  expected: ${c.expected_files.join(", ")}\n` +
          `  SELECTED: ${selectedFiles.join(", ") || "(none)"}\n` +
          `  selection_states: ${JSON.stringify(stateCounts)}\n` +
          `  composed_arguments (Fix 11): ${(packet.composed_arguments ?? []).length}\n` +
          `  MATCH: ${matchesExpected ? "✅" : "❌"}`,
        );
      }

      fs.writeFileSync(
        path.join(OUT_DIR, "end-to-end-proof.json"),
        JSON.stringify(results, null, 2),
      );

      // Every case must place its expected file(s) in the SELECTED set
      for (const c of CASES) {
        for (const f of c.expected_files) {
          expect(results[c.id].selected_files).toContain(f);
        }
      }

      // Q2 must still form Fix 11 compositions - proves root-cause pipeline
      // was NOT weakened by the declaration bridge (§11 parallel-path).
      expect(results.Q2.composed_arguments_count).toBeGreaterThan(0);
    },
    600000,
  );

  it(
    "Determinism · two runs of Q1 produce byte-identical selection output",
    async () => {
      const run1 = await runNativeInvestigation({
        problem_statement: "investigate where the assessFear function is defined",
        repo_root: REPO_ROOT,
        max_actions: 15,
      });
      const run2 = await runNativeInvestigation({
        problem_statement: "investigate where the assessFear function is defined",
        repo_root: REPO_ROOT,
        max_actions: 15,
      });
      // Strip per-invocation ids (investigation_id + trace_id are pre-existing
      // pipeline nonces) then compare remaining structural fields.
      function normalize(selections: readonly Record<string, unknown>[]): string {
        return JSON.stringify(
          selections.map((s) => ({
            ...s,
            investigation_id: "<stripped>",
            trace_id: "<stripped>",
          })),
        );
      }
      expect(normalize(run1.candidate_selection ?? [])).toBe(
        normalize(run2.candidate_selection ?? []),
      );
      const r1 = JSON.stringify(run1.candidate_rankings);
      const r2 = JSON.stringify(run2.candidate_rankings);
      expect(r1).toBe(r2);
    },
    600000,
  );
});
