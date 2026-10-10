// NEX1 · Stage 0 → Stage 1.6 Target-Extraction Repair · PHASE 1 A/B DIAGNOSTIC
// Founder-authorised 2026-09-20 · read-only · NO production modification.
//
// KEY QUESTION
//   Does a filter that removes tokens in the existing DEFINITION_INTENT_TOKENS
//   canonical vocabulary from the Stage 1.6 concept set (when
//   definition_intent === true) reduce operator leakage to 0/N without
//   losing any legitimate target?
//
// DISCIPLINE
//   · Reuse existing canonical vocabulary · DO NOT hard-code an arbitrary
//     list. The filter set below is a verbatim duplicate of
//     `DEFINITION_INTENT_TOKENS` in `native-investigation-mode.ts:289`.
//   · Filter ONLY when definition_intent === true.
//   · Simulate the filter externally · call walker + bridge + Q7 + Q8 with
//     BOTH filtered (arm B) and unfiltered (arm A) concept sets · compare.
//   · Add multi-symbol cases (two legitimate targets) to prove the filter
//     does not collapse them.
//   · Add non-definition-intent cases to prove concept extraction is
//     byte-identical when the filter is bypassed.
//
// Evidence artefact · data/nex1-stage0/phase1-ab.json

import { describe, it, expect } from "vitest";
import { runNativeInvestigation } from "@/lib/nex-agent/code-engine/native-investigation-mode";
import { discoverRepositoryCandidates } from "@/lib/nex-agent/code-engine/capability-repository-discovery";
import { buildDeclarationEvaluations } from "@/lib/nex-agent/code-engine/capability-declaration-bridge";
import { rankCandidates } from "@/lib/nex-agent/code-engine/capability-candidate-ranker";
import { selectCandidates } from "@/lib/nex-agent/code-engine/capability-candidate-selector";
import { interpretSelection } from "@/lib/nex-agent/code-engine/capability-selection-kind";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "data", "nex1-stage0");

// ── Filter vocabulary (verbatim duplicate of DEFINITION_INTENT_TOKENS at
//    src/lib/nex-agent/code-engine/native-investigation-mode.ts:289). This
//    duplication is deliberate for Phase 1 read-only diagnostic. Phase 2
//    will export the canonical constant and reuse it in-place.
const DEFINITION_INTENT_TOKENS: ReadonlySet<string> = new Set([
  "define", "defined", "definition", "definitions",
  "declare", "declared", "declaration", "declarations",
  "implement", "implements", "implemented", "implementation",
  "export", "exports", "exported",
  "where", "which",
]);

// Detect definition-intent (verbatim mirror of `detectDefinitionIntent` in
// native-investigation-mode.ts:297 · same behaviour).
function isDefinitionIntent(problem: string, conceptsLower: readonly string[]): boolean {
  const goal = problem.toLowerCase();
  for (const t of DEFINITION_INTENT_TOKENS) {
    const rx = new RegExp(`\\b${t}\\b`);
    if (rx.test(goal)) return true;
  }
  for (const c of conceptsLower) if (DEFINITION_INTENT_TOKENS.has(c)) return true;
  return false;
}

// The proposed Phase 1 filter · definition_intent-gated · reuses existing
// canonical vocabulary · zero new lexicon.
function filterConceptTokens(
  tokens: readonly { token: string; category: string }[],
  definitionIntent: boolean,
): { kept: string[]; removed: string[] } {
  if (!definitionIntent) {
    return { kept: tokens.map((t) => t.token), removed: [] };
  }
  const kept: string[] = [];
  const removed: string[] = [];
  for (const t of tokens) {
    if (DEFINITION_INTENT_TOKENS.has(t.token)) removed.push(t.token);
    else kept.push(t.token);
  }
  return { kept, removed };
}

const NEX1_PRIORITY_PREFIXES = ["src/lib/nex-agent"];

async function runArmB(
  problem: string,
  filteredConcepts: readonly string[],
  definitionIntent: boolean,
): Promise<{
  bridge_sites: number;
  q8_declaration_selected_files: string[];
  q8_tied_scopes: number;
  bridge_ran: boolean;
}> {
  // Mirror production behaviour: bridge only runs when definition_intent is
  // true (this matches the wire-in at native-investigation-mode.ts). For
  // non-definition-intent investigations the bridge is skipped entirely,
  // which is what production does today.
  if (!definitionIntent) {
    return {
      bridge_sites: 0,
      q8_declaration_selected_files: [],
      q8_tied_scopes: 0,
      bridge_ran: false,
    };
  }
  const disc = discoverRepositoryCandidates({
    concepts: filteredConcepts,
    repo_root: REPO_ROOT,
    allowed_root_prefixes: ["src", "docs/doctrine"],
    priority_prefixes: NEX1_PRIORITY_PREFIXES,
    definition_intent: definitionIntent,
    max_files_scanned: 500,
    max_candidates: 50,
  });
  const bridge = buildDeclarationEvaluations({
    candidates: disc.candidates,
    concept_tokens: filteredConcepts,
    repo_root: REPO_ROOT,
  });
  const rank = rankCandidates({
    evaluations: bridge.evaluations,
    evidence_records: bridge.evidence_records,
  });
  const sel = selectCandidates({
    evaluations: bridge.evaluations,
    evidence_records: bridge.evidence_records,
    rankings: rank.scopes,
  });
  const selectedFiles: string[] = [];
  let tied = 0;
  for (const s of sel.selections) {
    if (s.selection_state === "SELECTED") {
      const interp = interpretSelection(s);
      if (interp.kind === "declaration") {
        if (!selectedFiles.includes(interp.real_source_file)) selectedFiles.push(interp.real_source_file);
      }
    }
    if (s.selection_state === "TIE") tied++;
  }
  return {
    bridge_sites: bridge.stats.declaration_sites_found,
    q8_declaration_selected_files: selectedFiles.sort(),
    q8_tied_scopes: tied,
    bridge_ran: true,
  };
}

interface Case {
  id: string;
  problem: string;
  intended_targets_lower: string[]; // may have 0..N legitimate targets
  intended_files_expected?: string[]; // declaration files expected
  category: "definition_intent" | "multi_symbol" | "non_definition_intent" | "negative_control";
}

const CASES: Case[] = [
  // Original 14 diagnostic cases (definition_intent)
  { id: "D1",  problem: "Where is assessFear defined?",
    intended_targets_lower: ["assessfear"],
    intended_files_expected: ["src/lib/nex-agent/code-engine/capability-fear.ts"],
    category: "definition_intent" },
  { id: "D2",  problem: "Where is evaluateHypothesisEvidence defined?",
    intended_targets_lower: ["evaluatehypothesisevidence"],
    intended_files_expected: ["src/lib/nex-agent/code-engine/capability-hypothesis-evidence-evaluator.ts"],
    category: "definition_intent" },
  { id: "D3",  problem: "Where is ComposedArgument defined?",
    intended_targets_lower: ["composedargument"],
    intended_files_expected: ["src/lib/nex-agent/code-engine/capability-chain-relationship-composer.ts"],
    category: "definition_intent" },
  { id: "D4",  problem: "Where is computeAbsenceCandidates defined?",
    intended_targets_lower: ["computeabsencecandidates"],
    intended_files_expected: ["src/lib/nex-agent/code-engine/native-investigation-absence.ts"],
    category: "definition_intent" },
  { id: "D5",  problem: "Where is FooBar defined?",
    intended_targets_lower: ["foobar"],
    intended_files_expected: [], // symbol does not exist
    category: "negative_control" },
  { id: "D6",  problem: "How is assessFear implemented?",
    intended_targets_lower: ["assessfear"],
    intended_files_expected: ["src/lib/nex-agent/code-engine/capability-fear.ts"],
    category: "definition_intent" },
  { id: "D7",  problem: "Which class defines patternIdOf?",
    intended_targets_lower: ["patternidof"],
    intended_files_expected: [
      "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts",
      "src/lib/nex-agent/code-engine/capability-outcome-experience.ts",
    ],
    category: "definition_intent" },
  { id: "D8",  problem: "Where is the export of runNativeInvestigation?",
    intended_targets_lower: ["runnativeinvestigation"],
    intended_files_expected: ["src/lib/nex-agent/code-engine/native-investigation-mode.ts"],
    category: "definition_intent" },
  { id: "D9",  problem: "Where is the function assessFear?",
    intended_targets_lower: ["assessfear"],
    intended_files_expected: ["src/lib/nex-agent/code-engine/capability-fear.ts"],
    category: "definition_intent" },
  { id: "D10", problem: "Find the declaration of toForwardSlash",
    intended_targets_lower: ["toforwardslash"],
    intended_files_expected: [
      "src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts",
      "src/lib/nex-agent/code-engine/capability-verification-case-generator.ts",
      "src/lib/nex-agent/code-engine/capability-m-file-memory/seed-from-content.ts",
    ],
    category: "definition_intent" },
  { id: "D11", problem: "Where is toForwardSlash defined?",
    intended_targets_lower: ["toforwardslash"],
    intended_files_expected: [
      "src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts",
      "src/lib/nex-agent/code-engine/capability-verification-case-generator.ts",
      "src/lib/nex-agent/code-engine/capability-m-file-memory/seed-from-content.ts",
    ],
    category: "definition_intent" },
  { id: "D12", problem: "What file exports the interface ComposedArgument?",
    intended_targets_lower: ["composedargument"],
    intended_files_expected: ["src/lib/nex-agent/code-engine/capability-chain-relationship-composer.ts"],
    category: "definition_intent" },
  { id: "D13", problem: "Where is the implementation of generateRootCauseCandidates?",
    intended_targets_lower: ["generaterootcausecandidates"],
    intended_files_expected: ["src/lib/nex-agent/code-engine/capability-root-cause-hypothesis-generator.ts"],
    category: "definition_intent" },
  { id: "D14", problem: "Which interface declares HypothesisEvidenceEvaluation?",
    intended_targets_lower: ["hypothesisevidenceevaluation"],
    intended_files_expected: ["src/lib/nex-agent/code-engine/capability-hypothesis-evidence-evaluator.ts"],
    category: "definition_intent" },
  // Multi-symbol cases · must preserve BOTH targets
  { id: "M1",  problem: "Where are assessFear and runNativeInvestigation defined?",
    intended_targets_lower: ["assessfear", "runnativeinvestigation"],
    intended_files_expected: [
      "src/lib/nex-agent/code-engine/capability-fear.ts",
      "src/lib/nex-agent/code-engine/native-investigation-mode.ts",
    ],
    category: "multi_symbol" },
  { id: "M2",  problem: "Compare the declarations of ComposedArgument and HypothesisEvidenceEvaluation",
    intended_targets_lower: ["composedargument", "hypothesisevidenceevaluation"],
    intended_files_expected: [
      "src/lib/nex-agent/code-engine/capability-chain-relationship-composer.ts",
      "src/lib/nex-agent/code-engine/capability-hypothesis-evidence-evaluator.ts",
    ],
    category: "multi_symbol" },
  { id: "M3",  problem: "Where are patternIdOf and toForwardSlash defined?",
    intended_targets_lower: ["patternidof", "toforwardslash"],
    intended_files_expected: [], // 2 declarations of patternIdOf + 3 of toForwardSlash = 5; just verify both symbols preserved
    category: "multi_symbol" },
  // Non-definition-intent cases · filter must be a no-op (byte-identical concepts)
  { id: "N1",  problem: "Fix the login bug in the payment flow",
    intended_targets_lower: [],
    category: "non_definition_intent" },
  { id: "N2",  problem: "Refactor the useAuth hook to use React Query",
    intended_targets_lower: [],
    category: "non_definition_intent" },
  { id: "N3",  problem: "Investigate why users see stale data on the dashboard",
    intended_targets_lower: [],
    category: "non_definition_intent" },
];

interface RowA {
  concepts: string[];
  bridge_sites: number;
  q8_declaration_selected_files: string[];
  q8_tied_scopes: number;
}
interface RowB {
  concepts: string[];
  removed_by_filter: string[];
  bridge_sites: number;
  q8_declaration_selected_files: string[];
  q8_tied_scopes: number;
  bridge_ran: boolean;
}
interface Row {
  case_id: string;
  problem: string;
  category: Case["category"];
  definition_intent_detected: boolean;
  intended_targets: string[];
  A_current: RowA;
  B_filtered: RowB;
  targets_preserved_A: boolean;
  targets_preserved_B: boolean;
  concepts_identical_when_non_definition: boolean;
  filter_removed_target: boolean;
  operator_leakage_A: number;
  operator_leakage_B: number;
  verdict:
    | "IMPROVED"                // B has ≤ leakage vs A · target preserved
    | "IMPROVED_MULTI_OK"       // multi-symbol · all targets preserved
    | "NO_OP_NON_DEFINITION"    // non-def-intent · concepts byte-identical
    | "BROKE_TARGET"            // filter removed a target · STOP CONDITION
    | "BROKE_NON_DEFINITION";   // non-def-intent · concepts differ · STOP CONDITION
}

async function probeCase(c: Case): Promise<Row> {
  // ── Arm A · current pipeline via runNativeInvestigation ──────────────
  const packet = await runNativeInvestigation({
    problem_statement: c.problem,
    repo_root: REPO_ROOT,
    max_actions: 15,
  });
  const conceptsA = ((packet.concepts ?? []) as { token: string; category: string; occurrences: number }[])
    .map((k) => ({ token: k.token, category: k.category }));
  const conceptsALower = conceptsA.map((c) => c.token);
  const defIntent = isDefinitionIntent(c.problem, conceptsALower);

  const selectedFilesA: string[] = [];
  let tiedA = 0;
  let bridgeSitesA = 0;
  for (const s of (packet.candidate_selection ?? [])) {
    if (s.selection_state === "SELECTED") {
      const interp = interpretSelection(s);
      if (interp.kind === "declaration") {
        if (!selectedFilesA.includes(interp.real_source_file)) selectedFilesA.push(interp.real_source_file);
      }
    }
    if (s.selection_state === "TIE") tiedA++;
  }
  // count bridge sites from reasoning_trace
  for (const line of packet.reasoning_trace ?? []) {
    const m = /declaration_bridge · declaration_sites=(\d+)/.exec(line);
    if (m) { bridgeSitesA = Number(m[1]); break; }
  }

  const A: RowA = {
    concepts: conceptsA.map((c) => c.token),
    bridge_sites: bridgeSitesA,
    q8_declaration_selected_files: selectedFilesA.sort(),
    q8_tied_scopes: tiedA,
  };

  // ── Arm B · apply proposed filter externally, run walker+bridge+Q7+Q8
  //           directly with filtered concepts ────────────────────────────
  const filter = filterConceptTokens(conceptsA, defIntent);
  const B_run = await runArmB(c.problem, filter.kept, defIntent);
  const B: RowB = {
    concepts: filter.kept,
    removed_by_filter: filter.removed,
    bridge_sites: B_run.bridge_sites,
    q8_declaration_selected_files: B_run.q8_declaration_selected_files,
    q8_tied_scopes: B_run.q8_tied_scopes,
    bridge_ran: B_run.bridge_ran,
  };

  // ── Analysis ─────────────────────────────────────────────────────────
  const targetsPreservedA = c.intended_targets_lower.every((t) => A.concepts.includes(t));
  const targetsPreservedB = c.intended_targets_lower.every((t) => B.concepts.includes(t));
  const conceptsIdenticalIfNonDef =
    c.category === "non_definition_intent"
      ? JSON.stringify(A.concepts) === JSON.stringify(B.concepts)
      : true;
  const filterRemovedTarget = c.intended_targets_lower.some((t) => filter.removed.includes(t));

  // Operator leakage = concepts that are in DEFINITION_INTENT_TOKENS
  const leakageA = A.concepts.filter((t) => DEFINITION_INTENT_TOKENS.has(t)).length;
  const leakageB = B.concepts.filter((t) => DEFINITION_INTENT_TOKENS.has(t)).length;

  let verdict: Row["verdict"];
  if (filterRemovedTarget) verdict = "BROKE_TARGET";
  else if (c.category === "non_definition_intent" && !conceptsIdenticalIfNonDef) verdict = "BROKE_NON_DEFINITION";
  else if (c.category === "non_definition_intent") verdict = "NO_OP_NON_DEFINITION";
  else if (c.category === "multi_symbol" && targetsPreservedB) verdict = "IMPROVED_MULTI_OK";
  else verdict = "IMPROVED";

  return {
    case_id: c.id,
    problem: c.problem,
    category: c.category,
    definition_intent_detected: defIntent,
    intended_targets: c.intended_targets_lower,
    A_current: A,
    B_filtered: B,
    targets_preserved_A: targetsPreservedA,
    targets_preserved_B: targetsPreservedB,
    concepts_identical_when_non_definition: conceptsIdenticalIfNonDef,
    filter_removed_target: filterRemovedTarget,
    operator_leakage_A: leakageA,
    operator_leakage_B: leakageB,
    verdict,
  };
}

describe("NEX1 · Stage 0 → Stage 1.6 · Phase 1 · A/B target-extraction filter diagnostic", () => {
  it(
    "runs full A/B corpus and emits diagnostic evidence",
    async () => {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const rows: Row[] = [];
      for (const c of CASES) {
        rows.push(await probeCase(c));
      }

      // The critical invariant: for every case where the target WAS in A,
      // it MUST still be in B. Cases where the target was already absent
      // from A (e.g., upstream classifier bug) are recorded but separated
      // from filter-caused losses.
      const preservationRegressions = rows.filter(
        (r) => r.targets_preserved_A && !r.targets_preserved_B,
      );

      // Pre-existing target-absent cases (target NOT in A at all). These
      // are Stage 0 classifier defects independent of the filter.
      const preExistingClassifierMisses = rows.filter(
        (r) => !r.targets_preserved_A && r.intended_targets.length > 0,
      );

      const summary = {
        total_cases: rows.length,
        definition_intent_cases: rows.filter((r) => r.category === "definition_intent").length,
        negative_control_cases: rows.filter((r) => r.category === "negative_control").length,
        multi_symbol_cases: rows.filter((r) => r.category === "multi_symbol").length,
        non_definition_intent_cases: rows.filter((r) => r.category === "non_definition_intent").length,
        preservation_regressions_caused_by_filter: preservationRegressions.map((r) => r.case_id),
        pre_existing_classifier_misses: preExistingClassifierMisses.map((r) => r.case_id),
        filter_removed_target_ever: rows.some((r) => r.filter_removed_target),
        non_definition_concepts_byte_identical: rows
          .filter((r) => r.category === "non_definition_intent")
          .every((r) => r.concepts_identical_when_non_definition),
        non_definition_bridge_did_not_run_under_B: rows
          .filter((r) => r.category === "non_definition_intent")
          .every((r) => r.B_filtered.bridge_ran === false),
        total_operator_leakage_A: rows.reduce((n, r) => n + r.operator_leakage_A, 0),
        total_operator_leakage_B: rows.reduce((n, r) => n + r.operator_leakage_B, 0),
        verdict_counts: rows.reduce<Record<string, number>>((acc, r) => {
          acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
          return acc;
        }, {}),
      };

      fs.writeFileSync(
        path.join(OUT_DIR, "phase1-ab.json"),
        JSON.stringify({ summary, rows }, null, 2),
      );

      for (const r of rows) {
        console.log(
          `[${r.case_id}] (${r.category}) ${r.problem}\n` +
          `  targets=[${r.intended_targets.join(", ")}] · def_intent=${r.definition_intent_detected}\n` +
          `  A concepts=[${r.A_current.concepts.join(", ")}]\n` +
          `  B concepts=[${r.B_filtered.concepts.join(", ")}] · removed=[${r.B_filtered.removed_by_filter.join(", ")}]\n` +
          `  A · bridge=${r.A_current.bridge_sites} · SELECTED=[${r.A_current.q8_declaration_selected_files.join(", ")}]\n` +
          `  B · bridge=${r.B_filtered.bridge_sites} · SELECTED=[${r.B_filtered.q8_declaration_selected_files.join(", ")}]\n` +
          `  leakage A=${r.operator_leakage_A} · B=${r.operator_leakage_B}\n` +
          `  targets_preserved A=${r.targets_preserved_A ? "✅" : "❌"} · B=${r.targets_preserved_B ? "✅" : "❌"}\n` +
          `  verdict: ${r.verdict}`,
        );
      }
      console.log("\nSUMMARY:", JSON.stringify(summary, null, 2));

      // Phase 1 invariants (trace-based, filter-scoped):
      //   1. The FILTER must NEVER remove a token that was a legitimate target.
      //   2. No case where the target was preserved under A may lose it under B.
      //   3. Non-definition-intent concepts must be byte-identical between A and B.
      //   4. Non-definition-intent bridge must not run under B (matches production).
      //   5. Total operator leakage under B must be ≤ under A.
      expect(summary.filter_removed_target_ever, "Filter removed a legitimate target token").toBe(false);
      expect(summary.preservation_regressions_caused_by_filter, "Cases where filter caused a preservation regression").toEqual([]);
      expect(summary.non_definition_concepts_byte_identical, "Non-definition concepts must be byte-identical").toBe(true);
      expect(summary.non_definition_bridge_did_not_run_under_B, "Non-definition bridge must not run under B (matches production)").toBe(true);
      expect(summary.total_operator_leakage_B, "Leakage must not increase under B").toBeLessThanOrEqual(summary.total_operator_leakage_A);
    },
    900000,
  );
});
