// NEX1 · Stage 0 · Target-Symbol Extraction Diagnostic (read-only)
// Founder-authorised 2026-09-20 · NO FIX. Judgment is on the diagnostic
// table, not on any prose response.
//
// KEY QUESTION
//   Can NEX deterministically separate the requested symbol from linguistic
//   operators (defined, define, definition, declare, declared, declaration,
//   implement, implements, implementation, export, exports, exported, where,
//   which, class, function, interface) without losing legitimate target
//   tokens?
//
// METHOD
//   For each diagnostic case, run runNativeInvestigation (real classifier
//   path) and record:
//     · concepts[] extracted, with category and occurrences
//     · the intended target symbol (ground-truth annotation)
//     · the linguistic operators present in the query (per DEFINITION_INTENT
//       vocabulary)
//     · which of those operators leaked into concepts[]
//     · verdict per case: SEPARATES | LEAKS | LOSES_TARGET | AMBIGUOUS
//
// Evidence artefact · data/nex1-stage0/target-extraction-diagnostic.json
//
// ZERO production modification.

import { describe, it, expect } from "vitest";
import { runNativeInvestigation } from "@/lib/nex-agent/code-engine/native-investigation-mode";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "data", "nex1-stage0");

// The 17 linguistic operators that appear in declaration-question grammar.
// Union of the founder's DEFINITION_INTENT_TOKENS (from
// native-investigation-mode.ts:289) + a few directly-related coding keywords
// that carry no target-symbol identity (`class`, `function`, `interface`,
// `type`, `enum`, `const`, `let`, `var`) — those are pure structure words.
const OPERATOR_WORDS = new Set<string>([
  // DEFINITION_INTENT_TOKENS
  "define", "defined", "definition", "definitions",
  "declare", "declared", "declaration", "declarations",
  "implement", "implements", "implemented", "implementation",
  "export", "exports", "exported",
  "where", "which",
  // Pure structural keywords (never a target symbol on their own)
  "class", "function", "interface", "type", "enum",
  "const", "let", "var",
  // Common interrogative helpers that describe *how* not *what*
  "how", "what", "file", "files", "location", "site", "sites",
  "symbol", "symbols",
  "the", "is", "of", "for",
]);

interface Case {
  id: string;
  problem: string;
  intended_target: string;
  intended_target_lower: string;
}

const CASES: Case[] = [
  { id: "D1",  problem: "Where is assessFear defined?",                       intended_target: "assessFear",                intended_target_lower: "assessfear" },
  { id: "D2",  problem: "Where is evaluateHypothesisEvidence defined?",       intended_target: "evaluateHypothesisEvidence", intended_target_lower: "evaluatehypothesisevidence" },
  { id: "D3",  problem: "Where is ComposedArgument defined?",                 intended_target: "ComposedArgument",           intended_target_lower: "composedargument" },
  { id: "D4",  problem: "Where is computeAbsenceCandidates defined?",         intended_target: "computeAbsenceCandidates",   intended_target_lower: "computeabsencecandidates" },
  { id: "D5",  problem: "Where is FooBar defined?",                            intended_target: "FooBar",                     intended_target_lower: "foobar" }, // negative control · symbol does not exist
  { id: "D6",  problem: "How is assessFear implemented?",                     intended_target: "assessFear",                intended_target_lower: "assessfear" },
  { id: "D7",  problem: "Which class defines patternIdOf?",                    intended_target: "patternIdOf",                intended_target_lower: "patternidof" },
  { id: "D8",  problem: "Where is the export of runNativeInvestigation?",     intended_target: "runNativeInvestigation",     intended_target_lower: "runnativeinvestigation" },
  { id: "D9",  problem: "Where is the function assessFear?",                   intended_target: "assessFear",                intended_target_lower: "assessfear" },
  { id: "D10", problem: "Find the declaration of toForwardSlash",              intended_target: "toForwardSlash",             intended_target_lower: "toforwardslash" },
  { id: "D11", problem: "Where is toForwardSlash defined?",                    intended_target: "toForwardSlash",             intended_target_lower: "toforwardslash" }, // ambiguity case
  { id: "D12", problem: "What file exports the interface ComposedArgument?",   intended_target: "ComposedArgument",           intended_target_lower: "composedargument" },
  { id: "D13", problem: "Where is the implementation of generateRootCauseCandidates?", intended_target: "generateRootCauseCandidates", intended_target_lower: "generaterootcausecandidates" },
  { id: "D14", problem: "Which interface declares HypothesisEvidenceEvaluation?", intended_target: "HypothesisEvidenceEvaluation", intended_target_lower: "hypothesisevidenceevaluation" },
];

interface DiagRow {
  case_id: string;
  problem: string;
  intended_target: string;
  concepts_extracted: { token: string; category: string; occurrences: number }[];
  target_present: boolean;
  operators_in_query: string[];
  operators_leaked_into_concepts: string[];
  non_operator_non_target_concepts: string[];
  verdict:
    | "SEPARATES"                 // only target present · no operator leaks
    | "LEAKS_OPERATORS"           // target present + operator leaks
    | "LOSES_TARGET"              // target NOT in concepts
    | "LOSES_TARGET_AND_LEAKS"    // target NOT in concepts AND operator leaks
    | "NEGATIVE_CONTROL_OK"       // target absent from repo · expected no concepts drop
    | "NEGATIVE_CONTROL_LEAKS";   // target absent · but operators still leak
}

function extractOperatorsFromQuery(problem: string): string[] {
  const out: string[] = [];
  const lower = problem.toLowerCase();
  const words = lower.match(/[a-z]+/g) ?? [];
  for (const w of words) {
    if (OPERATOR_WORDS.has(w)) out.push(w);
  }
  return out;
}

async function probe(c: Case): Promise<DiagRow> {
  const packet = await runNativeInvestigation({
    problem_statement: c.problem,
    repo_root: REPO_ROOT,
    max_actions: 4, // stop early — we only need the classifier output
  });
  const concepts = (packet.concepts ?? []).map((k: { token: string; category: string; occurrences: number }) => ({
    token: k.token,
    category: k.category,
    occurrences: k.occurrences,
  }));
  const conceptSet = new Set(concepts.map((c) => c.token));

  const operators = extractOperatorsFromQuery(c.problem);
  const operatorsSet = new Set(operators);
  const operatorsLeaked = concepts
    .map((c) => c.token)
    .filter((t) => operatorsSet.has(t));

  const nonOperatorNonTarget = concepts
    .map((c) => c.token)
    .filter((t) => t !== c.intended_target_lower && !operatorsSet.has(t));

  const targetPresent = conceptSet.has(c.intended_target_lower);
  const isNegativeControl = c.id === "D5";

  let verdict: DiagRow["verdict"];
  if (isNegativeControl) {
    verdict = operatorsLeaked.length === 0
      ? "NEGATIVE_CONTROL_OK"
      : "NEGATIVE_CONTROL_LEAKS";
  } else if (!targetPresent && operatorsLeaked.length > 0) {
    verdict = "LOSES_TARGET_AND_LEAKS";
  } else if (!targetPresent) {
    verdict = "LOSES_TARGET";
  } else if (operatorsLeaked.length > 0) {
    verdict = "LEAKS_OPERATORS";
  } else {
    verdict = "SEPARATES";
  }

  return {
    case_id: c.id,
    problem: c.problem,
    intended_target: c.intended_target,
    concepts_extracted: concepts,
    target_present: targetPresent,
    operators_in_query: operators,
    operators_leaked_into_concepts: operatorsLeaked,
    non_operator_non_target_concepts: nonOperatorNonTarget,
    verdict,
  };
}

describe("NEX1 · Stage 0 · Target-symbol extraction diagnostic (read-only)", () => {
  it(
    "runs 14 diagnostic cases + emits diagnostic table",
    async () => {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const rows: DiagRow[] = [];
      for (const c of CASES) {
        rows.push(await probe(c));
      }

      // Summarize
      const counts: Record<DiagRow["verdict"], number> = {
        SEPARATES: 0,
        LEAKS_OPERATORS: 0,
        LOSES_TARGET: 0,
        LOSES_TARGET_AND_LEAKS: 0,
        NEGATIVE_CONTROL_OK: 0,
        NEGATIVE_CONTROL_LEAKS: 0,
      };
      for (const r of rows) counts[r.verdict]++;

      const uniqueOperatorsLeaked = new Set<string>();
      for (const r of rows) for (const op of r.operators_leaked_into_concepts) uniqueOperatorsLeaked.add(op);

      const summary = {
        total_cases: rows.length,
        verdict_counts: counts,
        unique_operators_ever_leaked: [...uniqueOperatorsLeaked].sort(),
        target_present_rate: rows.filter((r) => r.target_present).length + "/" + rows.length,
        answer_to_key_question:
          counts.LEAKS_OPERATORS === 0 && counts.LOSES_TARGET_AND_LEAKS === 0
            ? "YES · classifier deterministically separates target from operators"
            : "NO · operators leak into concepts (Stage 0 target extraction is over-broad)",
      };

      fs.writeFileSync(
        path.join(OUT_DIR, "target-extraction-diagnostic.json"),
        JSON.stringify({ summary, rows }, null, 2),
      );

      // Print concise per-row summary
      for (const r of rows) {
        console.log(
          `[${r.case_id}] "${r.problem}"\n` +
          `  target=${r.intended_target} · present=${r.target_present ? "✅" : "❌"}\n` +
          `  concepts=[${r.concepts_extracted.map((c) => `${c.token}(${c.category})`).join(", ") || "(none)"}]\n` +
          `  operators_in_query=[${r.operators_in_query.join(", ") || "(none)"}]\n` +
          `  operators_leaked=[${r.operators_leaked_into_concepts.join(", ") || "(none)"}]\n` +
          `  non-operator non-target concepts=[${r.non_operator_non_target_concepts.join(", ") || "(none)"}]\n` +
          `  verdict: ${r.verdict}\n`,
        );
      }
      console.log("SUMMARY:", JSON.stringify(summary, null, 2));

      // Assertion is INFORMATIONAL only — we WANT to see whether the classifier
      // leaks operators. We do not fail the test if it does; we just record.
      expect(rows.length).toBe(CASES.length);
    },
    600000,
  );
});
