// NEX1 · Stage 1.6 · Capability Probe · 3+1 layer trace-based judgment
// Founder-authorised · 2026-09-20
//
// PURPOSE
//   Test the declaration-aware investigation capability that was proven by
//   Stage 1.6. Judgment is on the trace (goal → classifier → walker →
//   declaration evidence → bridge → Q7/Q8 → selection → provenance), NOT
//   on any prose response. The tests fail if the trace shows an LLM, a
//   fixture, a hard-coded answer, or a bypassed pipeline.
//
// LAYERS
//   Test 1 · Known declaration           (assessFear · Q1 proof case)
//   Test 2 · Three novel declarations    (evaluateHypothesisEvidence,
//                                          ComposedArgument, computeAbsenceCandidates)
//   Test 3 · Ambiguous declaration       (toForwardSlash · A1 proof case)
//   Test 4 · Distinguish declaration from usage/import for a novel symbol
//                                        (generateRootCauseCandidates)
//
// FOR EVERY CASE the probe records evidence that the deterministic
// mechanism was responsible:
//   · classifier decision                (INVESTIGATE / else)
//   · walker fired with definition_intent = true
//   · declaration_bridge emitted N sites  (N > 0 for legitimate cases)
//   · Q7 emitted scopes prefixed `decl@`
//   · Q8 SELECTED for legitimate scopes
//   · candidate_files contains BOTH declaration + usage rows (Test 4)
//   · Q8's selection separates declaration from usage (Test 4)
//
// Evidence artefact · data/nex1-stage1-6-bridge/capability-probe.json

import { describe, it, expect } from "vitest";
import { runNativeInvestigation } from "@/lib/nex-agent/code-engine/native-investigation-mode";
import {
  DECLARATION_SCOPE_PREFIX,
  isDeclarationScope,
  interpretSelection,
} from "@/lib/nex-agent/code-engine/capability-selection-kind";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "data", "nex1-stage1-6-bridge");

interface TraceProbe {
  case_id: string;
  problem: string;
  expected_declaration_files: string[];
  reasoning_trace_lines_of_interest: {
    classifier: string[];
    walker: string[];
    declaration_bridge: string[];
    candidate_ranking: string[];
    candidate_selection: string[];
  };
  walker_definition_intent_true: boolean;
  bridge_sites_found: number;
  bridge_evaluations_emitted: number;
  bridge_merged_into_ranking: number;
  q7_declaration_scope_count: number;
  q7_root_cause_scope_count: number;
  q8_selected_declaration_files: string[];
  q8_selected_root_cause_files: string[];
  q8_tied_scopes: number;
  candidate_files_that_reference_symbol: string[];
  candidate_files_that_are_declaration_sites: string[];
  provenance_line_evidence: { file: string; line: number }[];
  match_expected: boolean;
  is_llm_free: boolean;
  bypassed_pipeline: boolean;
}

function filterTrace(trace: readonly string[]): TraceProbe["reasoning_trace_lines_of_interest"] {
  const cls: string[] = [];
  const walker: string[] = [];
  const bridge: string[] = [];
  const rank: string[] = [];
  const sel: string[] = [];
  for (const l of trace) {
    if (l.startsWith("action_2_founder_intent_classifier") || l.startsWith("classifier"))
      cls.push(l);
    if (l.startsWith("repository_discovery") || l.startsWith("action_2_5")) walker.push(l);
    if (l.startsWith("declaration_bridge")) bridge.push(l);
    if (l.startsWith("candidate_rankings") || l.startsWith("action_14")) rank.push(l);
    if (l.startsWith("candidate_selection") || l.startsWith("action_15")) sel.push(l);
  }
  return {
    classifier: cls,
    walker,
    declaration_bridge: bridge,
    candidate_ranking: rank,
    candidate_selection: sel,
  };
}

async function probe(
  case_id: string,
  problem: string,
  expected: string[],
): Promise<TraceProbe> {
  const packet = await runNativeInvestigation({
    problem_statement: problem,
    repo_root: REPO_ROOT,
    max_actions: 15,
  });
  const trace = packet.reasoning_trace ?? [];
  const traceOfInterest = filterTrace(trace);

  const walkerDefIntent = traceOfInterest.walker.some((l) => l.includes("definition_intent=true"));
  const bridgeSitesMatch = /declaration_bridge · declaration_sites=(\d+) · evaluations_emitted=(\d+)/.exec(
    traceOfInterest.declaration_bridge.join("\n"),
  );
  const bridgeMergedMatch = /declaration_bridge · merged into ranking · \+(\d+) evaluations/.exec(
    traceOfInterest.declaration_bridge.join("\n"),
  );
  const bridgeSites = bridgeSitesMatch ? Number(bridgeSitesMatch[1]) : 0;
  const bridgeEvals = bridgeSitesMatch ? Number(bridgeSitesMatch[2]) : 0;
  const bridgeMerged = bridgeMergedMatch ? Number(bridgeMergedMatch[1]) : 0;

  const rankings = packet.candidate_rankings ?? [];
  let declScopes = 0;
  let rootScopes = 0;
  for (const r of rankings) {
    if (isDeclarationScope(r.source_file)) declScopes++;
    else rootScopes++;
  }

  const selections = packet.candidate_selection ?? [];
  const declSelected: string[] = [];
  const rootSelected: string[] = [];
  let tied = 0;
  const provenanceLines: { file: string; line: number }[] = [];
  for (const s of selections) {
    const interp = interpretSelection(s);
    if (s.selection_state === "SELECTED") {
      if (interp.kind === "declaration") {
        if (!declSelected.includes(interp.real_source_file)) declSelected.push(interp.real_source_file);
        for (const p of s.provenance ?? []) {
          provenanceLines.push({ file: p.source_file, line: p.start_line });
        }
      } else {
        if (!rootSelected.includes(interp.real_source_file)) rootSelected.push(interp.real_source_file);
      }
    }
    if (s.selection_state === "TIE") tied++;
  }

  // Files that REFERENCE the symbol (walker returned them) but did NOT
  // become declaration sites — these are the usage/import files that the
  // bridge correctly filtered out.
  const candidateFilesRefs: string[] = [];
  const candidateFilesDecl: string[] = [];
  for (const c of packet.candidate_files ?? []) {
    candidateFilesRefs.push(c.path);
    // We can't reliably know is_declaration_site from candidate_files (which
    // are the merged view). Instead we use SELECTED-declaration set as
    // ground truth for "was a declaration site" here.
    if (declSelected.includes(c.path)) candidateFilesDecl.push(c.path);
  }

  const matchExpected =
    expected.length === 0 || expected.every((f) => declSelected.includes(f));

  // Anti-fabrication: no LLM in this codebase's investigation path (already
  // audited); prove it locally by asserting the trace never mentions LLM.
  const llmFree = !trace.some((l) => /llm|openai|anthropic|gpt|claude/i.test(l));

  // Bypass detection: bridge MUST fire for definition-intent investigations.
  // If the bridge is silent for a case that should have declarations, the
  // pipeline was bypassed.
  const bypassed =
    walkerDefIntent === true && expected.length > 0 && bridgeEvals === 0;

  return {
    case_id,
    problem,
    expected_declaration_files: expected,
    reasoning_trace_lines_of_interest: traceOfInterest,
    walker_definition_intent_true: walkerDefIntent,
    bridge_sites_found: bridgeSites,
    bridge_evaluations_emitted: bridgeEvals,
    bridge_merged_into_ranking: bridgeMerged,
    q7_declaration_scope_count: declScopes,
    q7_root_cause_scope_count: rootScopes,
    q8_selected_declaration_files: declSelected.sort(),
    q8_selected_root_cause_files: rootSelected.sort(),
    q8_tied_scopes: tied,
    candidate_files_that_reference_symbol: candidateFilesRefs,
    candidate_files_that_are_declaration_sites: candidateFilesDecl,
    provenance_line_evidence: provenanceLines,
    match_expected: matchExpected,
    is_llm_free: llmFree,
    bypassed_pipeline: bypassed,
  };
}

describe("NEX1 · Stage 1.6 · Capability Probe (trace-based)", () => {
  it(
    "runs 3+1 layers · Tests 1-4 · trace-based judgment · zero LLM",
    async () => {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const probes: Record<string, TraceProbe> = {};

      // Test 1 · Known declaration
      probes.T1 = await probe(
        "T1_known_declaration_assessFear",
        "Where is the assessFear function defined?",
        ["src/lib/nex-agent/code-engine/capability-fear.ts"],
      );

      // Test 2 · Three novel declarations
      probes.T2a = await probe(
        "T2a_novel_evaluateHypothesisEvidence",
        "Where is evaluateHypothesisEvidence defined?",
        ["src/lib/nex-agent/code-engine/capability-hypothesis-evidence-evaluator.ts"],
      );
      probes.T2b = await probe(
        "T2b_novel_ComposedArgument",
        "Where is the ComposedArgument interface defined?",
        ["src/lib/nex-agent/code-engine/capability-chain-relationship-composer.ts"],
      );
      probes.T2c = await probe(
        "T2c_novel_computeAbsenceCandidates",
        "Where is computeAbsenceCandidates defined?",
        ["src/lib/nex-agent/code-engine/native-investigation-absence.ts"],
      );

      // Test 3 · Ambiguous declaration
      probes.T3 = await probe(
        "T3_ambiguous_toForwardSlash",
        "Where is toForwardSlash defined?",
        [
          "src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts",
          "src/lib/nex-agent/code-engine/capability-verification-case-generator.ts",
          "src/lib/nex-agent/code-engine/capability-m-file-memory/seed-from-content.ts",
        ],
      );

      // Test 4 · Distinguish declaration from usage/import
      probes.T4 = await probe(
        "T4_declaration_vs_usage_generateRootCauseCandidates",
        "Where is the generateRootCauseCandidates function defined? " +
          "This symbol appears in multiple files but I only want the declaration site.",
        ["src/lib/nex-agent/code-engine/capability-root-cause-hypothesis-generator.ts"],
      );

      // Emit evidence JSON
      fs.writeFileSync(
        path.join(OUT_DIR, "capability-probe.json"),
        JSON.stringify(probes, null, 2),
      );

      // Print concise trace summary per case
      for (const [id, p] of Object.entries(probes)) {
        console.log(
          `\n[${id}] ${p.problem}\n` +
          `  expected_decl_files: ${p.expected_declaration_files.join(", ") || "(none)"}\n` +
          `  walker · definition_intent=${p.walker_definition_intent_true}\n` +
          `  bridge · sites=${p.bridge_sites_found} · evals=${p.bridge_evaluations_emitted} · merged=${p.bridge_merged_into_ranking}\n` +
          `  Q7 · decl_scopes=${p.q7_declaration_scope_count} · root_scopes=${p.q7_root_cause_scope_count}\n` +
          `  Q8 · decl_SELECTED=[${p.q8_selected_declaration_files.join(", ") || "(none)"}]\n` +
          `  Q8 · root_SELECTED=[${p.q8_selected_root_cause_files.join(", ") || "(none)"}]\n` +
          `  Q8 · tied_scopes=${p.q8_tied_scopes}\n` +
          `  provenance_line_evidence=[${p.provenance_line_evidence.map((e) => `${e.file}:${e.line}`).join(", ")}]\n` +
          `  match_expected: ${p.match_expected ? "✅" : "❌"} · llm_free: ${p.is_llm_free ? "✅" : "❌"} · bypassed: ${p.bypassed_pipeline ? "❌" : "✅"}`,
        );
      }

      // Trace-based assertions (NOT prose-based) —
      //
      // For every case with legitimate declarations expected:
      //   · walker MUST have fired with definition_intent=true
      //   · bridge MUST have emitted at least one evaluation
      //   · Q7 MUST have emitted at least one `decl@`-scoped scope
      //   · Q8 MUST have SELECTED every expected file (via declaration path)
      //   · no LLM keyword must appear in the trace
      //   · pipeline MUST NOT be bypassed for definition-intent cases
      //   · provenance MUST have real line numbers > 0

      const legitimateCases = [
        probes.T1, probes.T2a, probes.T2b, probes.T2c, probes.T3, probes.T4,
      ];
      for (const p of legitimateCases) {
        expect(p.walker_definition_intent_true, `[${p.case_id}] walker did not fire with definition_intent=true`).toBe(true);
        expect(p.bridge_evaluations_emitted, `[${p.case_id}] declaration bridge emitted 0 evaluations`).toBeGreaterThan(0);
        expect(p.q7_declaration_scope_count, `[${p.case_id}] Q7 emitted 0 decl@ scopes`).toBeGreaterThan(0);
        expect(p.is_llm_free, `[${p.case_id}] trace mentions LLM`).toBe(true);
        expect(p.bypassed_pipeline, `[${p.case_id}] pipeline bypassed`).toBe(false);
        for (const f of p.expected_declaration_files) {
          expect(p.q8_selected_declaration_files, `[${p.case_id}] missing SELECTED for ${f}`).toContain(f);
        }
        // Every declaration SELECTED must carry line-number provenance > 0
        for (const p2 of p.provenance_line_evidence) {
          expect(p2.line, `[${p.case_id}] provenance line ${p2.line} for ${p2.file} not > 0`).toBeGreaterThan(0);
        }
      }

      // Test 3 · ambiguity: MUST have >1 declaration site selected
      expect(probes.T3.q8_selected_declaration_files.length, "T3 ambiguity: expected multiple declarations").toBeGreaterThan(1);

      // Test 4 · distinction: MUST separate declaration from usage.
      // The declaration site MUST appear in q8_selected_declaration_files.
      // Files that only reference the symbol (importers) must NOT appear
      // among declaration-derived SELECTED.
      // Since the bridge only emits evaluations for is_declaration_site=true
      // walker candidates, if a non-declaration file shows up as SELECTED
      // via a `decl@` scope, that would violate the discipline.
      const t4Decl = probes.T4.q8_selected_declaration_files;
      expect(t4Decl, "T4: root-cause generator declaration file missing").toContain(
        "src/lib/nex-agent/code-engine/capability-root-cause-hypothesis-generator.ts",
      );
      // native-investigation-mode.ts imports generateRootCauseCandidates but
      // does NOT declare it. It must not appear as declaration-derived.
      expect(t4Decl, "T4: importer wrongly labelled as declaration").not.toContain(
        "src/lib/nex-agent/code-engine/native-investigation-mode.ts",
      );
    },
    600000,
  );
});
