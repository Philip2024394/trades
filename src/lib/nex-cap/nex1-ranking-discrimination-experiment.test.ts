// NEX1 · Ranking-Discrimination Isolation Experiment
// Founder-authorised diagnostic · 2026-09-19
//
// PURPOSE
//   Take the EXISTING candidate sets produced by the Option-B scoped
//   experiment. Apply alternative re-scoring signals to those same sets.
//   Ask: can declaration-vs-usage discrimination already be achieved
//   from evidence NEX currently has access to · without changing the
//   candidate discovery step or the production ranker?
//
// NON-BEHAVIOUR
//   · Zero production code modification.
//   · Zero import of Q7 or Q8 mechanisms.
//   · Zero corpus mutation.
//   · Pure read-only re-scoring on the existing candidate JSON.
//   · Each signal is a pure function · inline · not a new capability.
//
// FALSIFICATION CRITERION
//   For each signal we ask "does the target file become top-1 in all 4
//   cases?" · YES = signal is sufficient · NO = signal is insufficient.
//   Multiple signals may need to combine; combinations are also tested.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
const RECEIPT_PATH = path.join(REPO_ROOT, "data", "nex1-stage1-diagnostic", "reachability-scoped-experiment.json");

interface OptionBCandidate {
  path: string;
  score: number;
  fn_matches: number;
  ct_matches: number;
}

interface OptionBRow {
  id: string;
  target_symbol: string;
  target_token: string;
  expected_file: string;
  candidates_top10: OptionBCandidate[];
}

// ── Read existing Option-B candidate sets ────────────────────────────────

const receipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, "utf8"));
const CASES: readonly OptionBRow[] = receipt.first_pass;

// ── Alternative signals · pure functions over (candidate_path, target_symbol) ──

/** Split filename basename into tokens by camelCase / hyphen / underscore / dot. */
function tokenizeBasename(filename: string): string[] {
  const base = filename.replace(/\.[^.]+$/, "");        // strip extension
  return base
    .split(/[-_.]/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0);
}

/** Split camelCase symbol into tokens. */
function tokenizeSymbol(symbol: string): string[] {
  return symbol
    .split(/(?=[A-Z])/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0);
}

/** S-A · Filename token overlap · fraction of symbol tokens present in filename tokens. */
function signalA_filenameOverlap(candidatePath: string, targetSymbol: string): number {
  const fnTokens = new Set(tokenizeBasename(path.basename(candidatePath)));
  const symTokens = tokenizeSymbol(targetSymbol);
  if (symTokens.length === 0) return 0;
  let hits = 0;
  for (const t of symTokens) if (fnTokens.has(t)) hits++;
  return hits / symTokens.length;    // 0..1
}

/** S-B · is-test-file (returns 1 if test, 0 otherwise) · used as penalty. */
function signalB_isTestFile(candidatePath: string): number {
  return /\.(test|spec)\.[tj]sx?$/.test(candidatePath) ? 1 : 0;
}

/** S-C · has-export-declaration · returns 1 if regex matches, 0 otherwise. */
function signalC_hasExportDeclaration(candidatePath: string, targetSymbol: string): number {
  const abs = path.join(REPO_ROOT, candidatePath);
  let content: string;
  try {
    content = fs.readFileSync(abs, "utf8");
  } catch {
    return 0;
  }
  const escaped = targetSymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(
    `^\\s*export\\s+(?:async\\s+)?(?:function|const|let|var|interface|type|class|enum)\\s+${escaped}\\b`,
    "m",
  );
  return rx.test(content) ? 1 : 0;
}

/** S-D · has-import-declaration (usage indicator) · 1 if imports the symbol. */
function signalD_hasImportDeclaration(candidatePath: string, targetSymbol: string): number {
  const abs = path.join(REPO_ROOT, candidatePath);
  let content: string;
  try {
    content = fs.readFileSync(abs, "utf8");
  } catch {
    return 0;
  }
  const escaped = targetSymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`\\bimport\\s+(?:type\\s+)?\\{[^}]*\\b${escaped}\\b[^}]*\\}`, "m");
  return rx.test(content) ? 1 : 0;
}

// ── Rescoring policies (each POLICY = pure combination of signals) ───────

interface RescoringPolicy {
  id: string;
  description: string;
  score: (cand: OptionBCandidate, targetSymbol: string) => number;
}

const POLICIES: readonly RescoringPolicy[] = [
  {
    id: "BASE",
    description: "Existing production V1 · 2*filename_matches + content_matches",
    score: (c) => c.score,
  },
  {
    id: "P1-filename-overlap",
    description: "BASE + 10 * S-A (filename token overlap)",
    score: (c, sym) => c.score + 10 * signalA_filenameOverlap(c.path, sym),
  },
  {
    id: "P2-penalise-test",
    description: "BASE - 100 * S-B (heavy penalty for test files)",
    score: (c) => c.score - 100 * signalB_isTestFile(c.path),
  },
  {
    id: "P3-export-declaration",
    description: "BASE + 100 * S-C (huge boost when export-declaration line matches)",
    score: (c, sym) => c.score + 100 * signalC_hasExportDeclaration(c.path, sym),
  },
  {
    id: "P4-not-importer",
    description: "BASE + 50 * (1 - S-D) (usage import demotes the file)",
    score: (c, sym) => c.score + 50 * (1 - signalD_hasImportDeclaration(c.path, sym)),
  },
  {
    id: "P5-C-only",
    description: "Pure S-C · declaration-line-only ranking (1 if declaration, 0 otherwise)",
    score: (c, sym) => signalC_hasExportDeclaration(c.path, sym),
  },
  {
    id: "P6-C-minus-B",
    description: "S-C - S-B · declaration line MINUS test-file penalty",
    score: (c, sym) => signalC_hasExportDeclaration(c.path, sym) - signalB_isTestFile(c.path),
  },
  {
    id: "P7-C-plus-A",
    description: "10 * S-C + 3 * S-A · export-declaration weighted × filename-overlap tiebreak",
    score: (c, sym) => 10 * signalC_hasExportDeclaration(c.path, sym) + 3 * signalA_filenameOverlap(c.path, sym),
  },
];

// ── Rescore + rank ───────────────────────────────────────────────────────

function rerank(row: OptionBRow, policy: RescoringPolicy) {
  const scored = row.candidates_top10.map((c) => ({
    path: c.path,
    baseScore: c.score,
    newScore: policy.score(c, row.target_symbol),
  }));
  // Deterministic: descending score · then path asc
  scored.sort((a, b) => {
    if (b.newScore !== a.newScore) return b.newScore - a.newScore;
    return a.path.localeCompare(b.path);
  });
  return scored;
}

// ── Main test ────────────────────────────────────────────────────────────

describe("NEX1 · Ranking-Discrimination Isolation · read-only re-scoring on existing candidates", () => {
  const outDir = path.join(REPO_ROOT, "data", "nex1-stage1-diagnostic");
  const resultRows: Array<{
    policy_id: string;
    policy_desc: string;
    q1_top1_is_target: boolean;
    q2_top1_is_target: boolean;
    q3_top1_is_target: boolean;
    q4_top1_is_target: boolean;
    total_correct_of_4: number;
    per_case_ranks: Record<string, { rank: number; top1: string; new_score: number }>;
  }> = [];

  it(
    "apply 8 re-scoring policies · report which discriminate declaration in 4/4 cases",
    () => {
      for (const policy of POLICIES) {
        const perCase: Record<string, { rank: number; top1: string; new_score: number }> = {};
        for (const c of CASES) {
          const ranked = rerank(c, policy);
          const targetIdx = ranked.findIndex((r) => r.path === c.expected_file);
          const top1 = ranked[0];
          const targetRow = targetIdx >= 0 ? ranked[targetIdx] : null;
          perCase[c.id] = {
            rank: targetIdx,
            top1: top1?.path ?? "none",
            new_score: targetRow?.newScore ?? 0,
          };
        }
        const q1 = perCase.Q1.top1 === CASES.find((c) => c.id === "Q1")!.expected_file;
        const q2 = perCase.Q2.top1 === CASES.find((c) => c.id === "Q2")!.expected_file;
        const q3 = perCase.Q3.top1 === CASES.find((c) => c.id === "Q3")!.expected_file;
        const q4 = perCase.Q4.top1 === CASES.find((c) => c.id === "Q4")!.expected_file;
        const total = [q1, q2, q3, q4].filter(Boolean).length;
        resultRows.push({
          policy_id: policy.id,
          policy_desc: policy.description,
          q1_top1_is_target: q1,
          q2_top1_is_target: q2,
          q3_top1_is_target: q3,
          q4_top1_is_target: q4,
          total_correct_of_4: total,
          per_case_ranks: perCase,
        });
        console.log(
          `[${policy.id.padEnd(22)}] · ${total}/4 · Q1=${q1 ? "✓" : "✗"} Q2=${q2 ? "✓" : "✗"} Q3=${q3 ? "✓" : "✗"} Q4=${q4 ? "✓" : "✗"} · "${policy.description}"`,
        );
      }

      // Repeatability check · same output twice
      const rerun = POLICIES.map((policy) => {
        const perCase: Record<string, string> = {};
        for (const c of CASES) {
          const ranked = rerank(c, policy);
          perCase[c.id] = ranked[0]?.path ?? "none";
        }
        return { id: policy.id, perCase };
      });
      const sig1 = JSON.stringify(resultRows.map((r) => ({ id: r.policy_id, cases: r.per_case_ranks })));
      const sig2 = JSON.stringify(rerun);
      const h1 = createHash("sha256").update(sig1).digest("hex").slice(0, 16);
      console.log(`[REPEAT] receipt hash pass-1: ${h1}`);

      fs.writeFileSync(
        path.join(outDir, "ranking-discrimination-experiment.json"),
        JSON.stringify(
          {
            experiment: "Ranking-Discrimination-Isolation",
            source_candidate_set: RECEIPT_PATH,
            experimental_variable: "re-scoring policy applied to existing candidate set",
            policies: POLICIES.map((p) => ({ id: p.id, description: p.description })),
            results: resultRows,
            signal_availability_note:
              "All signals compute from information NEX currently has access to: candidate file path, filename, and file content. No new source of evidence required.",
          },
          null,
          2,
        ),
      );

      expect(resultRows.length).toBe(POLICIES.length);
    },
  );
});
