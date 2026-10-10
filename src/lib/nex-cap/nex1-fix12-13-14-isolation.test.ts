// NEX1 · Fix 12/13/14 Isolation Diagnostic · 2026-09-19
// Founder-authorised read-only diagnostic · zero production modification.
//
// PURPOSE
//   For each known-answer case, determine the FIRST pipeline stage at
//   which the target file (or its representative candidate) disappears
//   from downstream evidence. The pipeline emits the intermediate
//   results as packet fields · we read them without instrumenting any
//   production code.
//
// STAGES INSPECTED (in order):
//   T-Walker · candidate_files
//   T-8      · observed_chains         (Fix 8)
//   T-9      · chain_narratives        (Fix 9)
//   T-10     · chain_relationships     (Fix 10)
//   T-11     · composed_arguments      (Fix 11)
//   T-12     · root_cause_candidates   (Fix 12)
//   T-13     · hypothesis_evaluations  (Fix 13)
//   T-14     · candidate_comparisons   (Fix 14)
//   T-Q7     · candidate_rankings
//   T-Q8     · candidate_selection

import { describe, it, expect } from "vitest";
import { runNativeInvestigation } from "@/lib/nex-agent/code-engine/native-investigation-mode";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "data", "nex1-stage1-diagnostic");

const CASES = [
  { id: "Q1", problem: "investigate where the assessFear function is defined",
    expected: "src/lib/nex-agent/code-engine/capability-fear.ts" },
  { id: "Q2", problem: "investigate where the runNativeInvestigation function is defined",
    expected: "src/lib/nex-agent/code-engine/native-investigation-mode.ts" },
  { id: "A1a", problem: "investigate where the toForwardSlash function is defined",
    expected: "src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts" },
  { id: "A2a", problem: "investigate where the recordEvidence function is defined",
    expected: "src/lib/nex-agent/adversarial-corpus.ts" },
  { id: "A2b", problem: "investigate where the recordEvidence function is defined",
    expected: "src/lib/nex-agent/code-engine/nex1-decision-trail.ts" },
];

function normPath(p: string): string {
  return (p ?? "").replace(/\\/g, "/");
}

/** Return an array of file paths that appear in an arbitrary packet field. */
function extractFilesFromField(field: unknown): string[] {
  if (!Array.isArray(field)) return [];
  const files: string[] = [];
  for (const item of field) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const candidates: string[] = [];
    // Common shapes across Fix 8-14
    for (const key of ["source_file", "file", "path", "repo_relative_path"]) {
      const v = rec[key];
      if (typeof v === "string") candidates.push(v);
    }
    // Nested endpoints
    for (const key of ["candidate_endpoint", "symptom_endpoint", "endpoint_a", "endpoint_b"]) {
      const nested = rec[key];
      if (nested && typeof nested === "object") {
        const sf = (nested as Record<string, unknown>).source_file;
        if (typeof sf === "string") candidates.push(sf);
      }
    }
    // Endpoint chains
    const chain = rec.endpoint_chain;
    if (Array.isArray(chain)) {
      for (const ep of chain) {
        if (ep && typeof ep === "object") {
          const sf = (ep as Record<string, unknown>).source_file;
          if (typeof sf === "string") candidates.push(sf);
        }
      }
    }
    // Candidate IDs of shape `src/foo.ts::candidate::...`
    for (const key of ["candidate_id", "candidate_a_id", "candidate_b_id"]) {
      const v = rec[key];
      if (typeof v === "string") {
        const idx = v.indexOf("::");
        if (idx > 0) candidates.push(v.slice(0, idx));
      }
    }
    for (const c of candidates) files.push(normPath(c));
  }
  return files;
}

interface StageObservation {
  stage: string;
  total_items: number;
  target_appearances: number;
  distinct_files: number;
}

interface CaseTrace {
  case_id: string;
  expected_file: string;
  investigation_id: string;
  stages: StageObservation[];
  first_drop_stage: string | null;
  first_drop_stage_previous_had_target: boolean;
}

const STAGES_TO_INSPECT: readonly {
  key: string;
  label: string;
}[] = [
  { key: "candidate_files", label: "T-Walker" },
  { key: "observed_chains", label: "T-8 · Fix 8" },
  { key: "chain_narratives", label: "T-9 · Fix 9" },
  { key: "inferred_relationships", label: "T-10 · Fix 10" },
  { key: "composed_arguments", label: "T-11 · Fix 11" },
  { key: "root_cause_candidates", label: "T-12 · Fix 12" },
  { key: "hypothesis_evaluations", label: "T-13 · Fix 13" },
  { key: "candidate_comparisons", label: "T-14 · Fix 14" },
  { key: "candidate_rankings", label: "T-Q7" },
  { key: "candidate_selection", label: "T-Q8" },
];

describe("NEX1 · Fix 12/13/14 Isolation · locate first-drop stage per target", () => {
  it(
    "trace each case's target through Walker → Fix 8-14 → Q7 → Q8",
    async () => {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const traces: CaseTrace[] = [];

      for (const c of CASES) {
        const packet = await runNativeInvestigation({
          problem_statement: c.problem,
          repo_root: REPO_ROOT,
          max_actions: 8,
        });
        const anyPkt = packet as unknown as Record<string, unknown>;
        const expectedNorm = normPath(c.expected);
        const stages: StageObservation[] = [];
        let firstDrop: string | null = null;
        let prevHadTarget = false;
        for (const s of STAGES_TO_INSPECT) {
          const field = anyPkt[s.key];
          const files = extractFilesFromField(field);
          const total = Array.isArray(field) ? field.length : 0;
          const targetCount = files.filter((f) => f === expectedNorm).length;
          const distinctFiles = new Set(files).size;
          stages.push({
            stage: s.label,
            total_items: total,
            target_appearances: targetCount,
            distinct_files: distinctFiles,
          });
          if (firstDrop === null) {
            if (targetCount === 0 && prevHadTarget) {
              firstDrop = s.label;
            }
            prevHadTarget = targetCount > 0;
          }
        }
        traces.push({
          case_id: c.id,
          expected_file: c.expected,
          investigation_id: packet.investigation_id,
          stages,
          first_drop_stage: firstDrop,
          first_drop_stage_previous_had_target: firstDrop !== null,
        });

        console.log(
          `[${c.id}] ${c.expected}\n` +
          stages.map((s) => `  ${s.stage.padEnd(18)} · total=${s.total_items.toString().padStart(4)} · target=${s.target_appearances}`).join("\n") +
          `\n  first_drop_stage: ${firstDrop ?? "target never appears in any stage"}\n`,
        );
      }

      fs.writeFileSync(
        path.join(OUT_DIR, "fix-12-13-14-isolation-trace.json"),
        JSON.stringify({ traces }, null, 2),
      );
      expect(traces.length).toBe(CASES.length);
    },
    600000,
  );
});
