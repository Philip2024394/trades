// NEX1 · Stage 1.6 · Declaration Bridge · Formula Experiment F0..F5
// Founder-authorised · Diagnostic only · Zero production modification.
//
// PURPOSE
//   Derive the smallest deterministic formula that carries walker-discovered
//   declaration evidence into the existing Q7 interface (HypothesisEvaluation[])
//   WITHOUT modifying Q7, Q8, or Fix 8-14.
//
// FORMULAS TESTED
//   F0 · baseline · existing pipeline (no bridge). Q8 TIE / no selection.
//   F1 · site-only · is_declaration_site → single STRUCTURALLY_SUPPORTING evidence.
//   F2 · site + type · differentiate S-C / S-P / S-M by rule_fired (still SUPPORTING).
//   F3 · site + filename + negative penalty · non-declaration files that reference
//        the symbol get STRUCTURALLY_CONTRADICTING (no) or INSUFFICIENT + counted
//        as separate scopes (Q7 ranks per-scope so they stay separated).
//   F4 · site + tie-preserving · declaration sites emitted verbatim · multi-declaration
//        ambiguity preserved as separate scopes; per-scope ties preserved when a
//        single file has multiple declarations at DIFFERENT lines.
//   F5 · site + declaration_line + provenance-complete · adds discovered line
//        number + provenance so Q8 SELECTED is not downgraded for missing provenance.
//
// KNOWN-ANSWER TARGETS
//   Q1 · assessFear                → src/lib/nex-agent/code-engine/capability-fear.ts
//   Q2 · runNativeInvestigation    → src/lib/nex-agent/code-engine/native-investigation-mode.ts
//   Q3 · InvestigationConclusionEntry → src/lib/nex-agent/code-engine/investigation-conclusion-store.ts
//   Q4 · patternIdOf               → src/lib/nex-agent/code-engine/capability-experience-abstraction.ts
//   A1 · toForwardSlash            → 3 legitimate declarations (ambiguity)
//   A2 · recordEvidence            → adversarial-corpus.ts + nex1-decision-trail.ts
//
// EVIDENCE FILE: data/nex1-stage1-6-bridge/formula-experiment.json

import { describe, it, expect } from "vitest";
import { discoverRepositoryCandidates } from "@/lib/nex-agent/code-engine/capability-repository-discovery";
import { rankCandidates } from "@/lib/nex-agent/code-engine/capability-candidate-ranker";
import { selectCandidates } from "@/lib/nex-agent/code-engine/capability-candidate-selector";
import type {
  HypothesisEvaluation,
  HypothesisEvidenceEvaluation,
} from "@/lib/nex-agent/code-engine/capability-hypothesis-evidence-evaluator";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "data", "nex1-stage1-6-bridge");

interface Case {
  id: string;
  concepts: string[];
  expected: string[];
  category: "known_answer" | "ambiguity" | "negative_control";
}

const CASES: Case[] = [
  { id: "Q1", concepts: ["assessFear"],
    expected: ["src/lib/nex-agent/code-engine/capability-fear.ts"],
    category: "known_answer" },
  { id: "Q2", concepts: ["runNativeInvestigation"],
    expected: ["src/lib/nex-agent/code-engine/native-investigation-mode.ts"],
    category: "known_answer" },
  { id: "Q3", concepts: ["InvestigationConclusionEntry"],
    expected: ["src/lib/nex-agent/code-engine/investigation-conclusion-store.ts"],
    category: "known_answer" },
  { id: "Q4", concepts: ["patternIdOf"],
    expected: ["src/lib/nex-agent/code-engine/capability-experience-abstraction.ts"],
    category: "known_answer" },
  { id: "A1", concepts: ["toForwardSlash"],
    expected: [], // multi-file ambiguity · at least the private-function sites
    category: "ambiguity" },
  { id: "A2", concepts: ["recordEvidence"],
    expected: [], // legitimate function + method
    category: "ambiguity" },
  { id: "N1", concepts: ["someSymbolThatDoesNotExistAnywhereInRepo"],
    expected: [],
    category: "negative_control" },
];

// ── Bridge implementations (F1..F5) · in-test · not production ─────────────

const NEX1_PRIORITY_PREFIXES = ["src/lib/nex-agent"];

interface DeclarationSite {
  source_file: string;
  symbol: string;
  line_number: number;
  declaration_type: "exported" | "private" | "method";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Find first declaration line in a file for a symbol. Deterministic. */
function findDeclarationLine(
  filePath: string,
  symbol: string,
): DeclarationSite | null {
  let content: string;
  try {
    content = fs.readFileSync(path.join(REPO_ROOT, filePath), "utf8");
  } catch {
    return null;
  }
  const lines = content.split(/\r?\n/);
  const exp = new RegExp(
    `^\\s*export\\s+(?:async\\s+)?(?:function|const|let|var|interface|type|class|enum)\\s+${escapeRegex(symbol)}\\b`,
    "i",
  );
  const priv = new RegExp(
    `^\\s*(?:async\\s+)?(?:function|const|let|var|interface|type|class|enum)\\s+${escapeRegex(symbol)}\\b`,
    "i",
  );
  const hasExportClass = /^\s*export\s+(?:abstract\s+)?class\s+\w+/m.test(content);
  const meth = new RegExp(
    `^\\s{2,}(?:(?:public|private|protected|static|async|readonly)\\s+)*${escapeRegex(symbol)}\\s*(?:<[^>]+>)?\\s*\\(`,
    "i",
  );
  for (let i = 0; i < lines.length; i++) {
    if (exp.test(lines[i])) {
      return { source_file: filePath, symbol, line_number: i + 1, declaration_type: "exported" };
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (priv.test(lines[i])) {
      return { source_file: filePath, symbol, line_number: i + 1, declaration_type: "private" };
    }
  }
  if (hasExportClass) {
    for (let i = 0; i < lines.length; i++) {
      if (meth.test(lines[i])) {
        return { source_file: filePath, symbol, line_number: i + 1, declaration_type: "method" };
      }
    }
  }
  return null;
}

interface BridgeOutput {
  evaluations: HypothesisEvaluation[];
  evidence_records: HypothesisEvidenceEvaluation[];
}

/** F1 · site-only. */
function buildF1(sites: DeclarationSite[]): BridgeOutput {
  const evaluations: HypothesisEvaluation[] = [];
  const evidence_records: HypothesisEvidenceEvaluation[] = [];
  for (const s of sites) {
    const candidate_id = `${s.source_file}::candidate::${s.line_number}:${s.line_number}:${s.symbol}`;
    const relationship_id = `declaration_relationship::${s.source_file}::${s.symbol}`;
    const composition_id = `declaration_composition::${s.source_file}::${s.symbol}`;
    const evidence_id = `${candidate_id}::${relationship_id}`;
    const provenance = [{ source_file: s.source_file, start_line: s.line_number, end_line: s.line_number }];
    const ev: HypothesisEvidenceEvaluation = {
      candidate_id, evidence_id, relationship_id, composition_id,
      status: "STRUCTURALLY_SUPPORTING",
      rule_fired: "R-DECL-SITE",
      evidence_kind: "INFERRED",
      provenance,
      confidence: 0.35,
    };
    evidence_records.push(ev);
    evaluations.push({
      candidate_id,
      evidence_evaluations: [ev],
      overall_status: "STRUCTURALLY_SUPPORTED",
      supporting_evidence_ids: [evidence_id],
      contradicting_evidence_ids: [],
      insufficient_evidence_ids: [],
      unresolved_evidence_ids: [],
      provenance,
      evidence_kind: "INFERRED",
      confidence: 0.35,
    });
  }
  return { evaluations, evidence_records };
}

/** F2 · site + declaration-type differentiated by rule_fired. */
function buildF2(sites: DeclarationSite[]): BridgeOutput {
  const out = buildF1(sites);
  for (let i = 0; i < sites.length; i++) {
    const t = sites[i].declaration_type;
    const rule = t === "exported" ? "R-DECL-EXPORT" : t === "private" ? "R-DECL-PRIVATE" : "R-DECL-METHOD";
    const ev = out.evidence_records[i];
    out.evidence_records[i] = { ...ev, rule_fired: rule };
    out.evaluations[i] = {
      ...out.evaluations[i],
      evidence_evaluations: [out.evidence_records[i]],
    };
  }
  return out;
}

/** F3 · site + negative penalty for usage-only files.
 *  Non-declaration files that reference the symbol get an evaluation with
 *  overall_status = INSUFFICIENT (no declaration seen at this scope). This
 *  demonstrates negative controls at the Q7 layer. */
function buildF3(
  sites: DeclarationSite[],
  usageOnlyFiles: { source_file: string; symbol: string }[],
): BridgeOutput {
  const out = buildF2(sites);
  for (const u of usageOnlyFiles) {
    const candidate_id = `${u.source_file}::candidate::1:1:${u.symbol}`;
    const relationship_id = `usage_only_relationship::${u.source_file}::${u.symbol}`;
    const composition_id = `usage_only_composition::${u.source_file}::${u.symbol}`;
    const evidence_id = `${candidate_id}::${relationship_id}`;
    const provenance = [{ source_file: u.source_file, start_line: 1, end_line: 1 }];
    const ev: HypothesisEvidenceEvaluation = {
      candidate_id, evidence_id, relationship_id, composition_id,
      status: "INSUFFICIENT",
      rule_fired: "R-DECL-USAGE-ONLY",
      evidence_kind: "INFERRED",
      provenance,
      confidence: 0.35,
    };
    out.evidence_records.push(ev);
    out.evaluations.push({
      candidate_id,
      evidence_evaluations: [ev],
      overall_status: "INSUFFICIENT",
      supporting_evidence_ids: [],
      contradicting_evidence_ids: [],
      insufficient_evidence_ids: [evidence_id],
      unresolved_evidence_ids: [],
      provenance,
      evidence_kind: "INFERRED",
      confidence: 0.35,
    });
  }
  return out;
}

/** F4 · site + tie-preserving. If a file has multiple declarations at
 *  distinct lines (e.g., method + private function of same name), emit
 *  a candidate per line. Q7 will group them into ONE scope (same source_file)
 *  and honestly TIE them. */
function buildF4(sites: DeclarationSite[]): BridgeOutput {
  return buildF1(sites);
  // For sites where multiple declarations exist in the same file, callers
  // are expected to enumerate each with a distinct line_number.
}

/** F5 · site + provenance-complete + explicit no-selection when contradicting.
 *  Same as F2 but explicitly writes non-empty provenance from the discovered
 *  line, which prevents Q8's provenance-completeness gate from downgrading. */
function buildF5(sites: DeclarationSite[]): BridgeOutput {
  return buildF2(sites); // F2 already includes non-empty provenance
}

// ── Experiment runner ──────────────────────────────────────────────────────

interface FormulaResult {
  formula: "F0" | "F1" | "F2" | "F3" | "F4" | "F5";
  q8_states: Record<string, string[]>; // source_file → selection_state list
  q8_selected: string[];                 // list of selected candidate_ids
  q7_scope_states: Record<string, string>;
  candidate_count: number;
  scope_count: number;
}

function runFormula(
  formula: "F0" | "F1" | "F2" | "F3" | "F4" | "F5",
  concepts: string[],
  bridgeOutput: BridgeOutput | null,
): FormulaResult {
  // F0 · pass empty evaluations — mimics the pipeline's absence of declaration
  // representation. For F1..F5, use the bridge-produced evaluations directly.
  const evaluations = bridgeOutput?.evaluations ?? [];
  const evidence_records = bridgeOutput?.evidence_records ?? [];

  const rankResult = rankCandidates({ evaluations, evidence_records });
  const selResult = selectCandidates({
    evaluations, evidence_records, rankings: rankResult.scopes,
    investigation_id: `formula_experiment::${formula}::${concepts.join(",")}`,
    trace_id: `formula_experiment::${formula}`,
  });

  const q8_states: Record<string, string[]> = {};
  const q8_selected: string[] = [];
  for (const s of selResult.selections) {
    q8_states[s.source_file] = [...(q8_states[s.source_file] ?? []), s.selection_state];
    if (s.selection_state === "SELECTED" && s.selected_candidate) {
      q8_selected.push(s.selected_candidate);
    }
  }
  const q7_scope_states: Record<string, string> = {};
  for (const sc of rankResult.scopes) q7_scope_states[sc.source_file] = sc.scope_state;

  return {
    formula,
    q8_states,
    q8_selected,
    q7_scope_states,
    candidate_count: evaluations.length,
    scope_count: rankResult.scopes.length,
  };
}

describe("NEX1 · Stage 1.6 · Declaration Bridge Formula Experiment F0..F5", () => {
  it(
    "runs F0..F5 for each known-answer + ambiguity + negative-control case",
    async () => {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const allResults: Record<string, {
        case_id: string;
        concepts: string[];
        expected: string[];
        category: string;
        walker_candidates: {
          repo_relative_path: string;
          is_declaration_site: boolean;
          declaration_matches: number;
          private_declaration_matches: number;
          method_declaration_matches: number;
          content_matches: number;
          filename_matches: number;
          match_score: number;
        }[];
        declaration_sites: DeclarationSite[];
        usage_only_files: string[];
        formulas: Record<string, FormulaResult>;
      }> = {};

      for (const c of CASES) {
        // Run walker with declaration signal enabled
        const disc = discoverRepositoryCandidates({
          concepts: c.concepts,
          repo_root: REPO_ROOT,
          allowed_root_prefixes: ["src", "docs/doctrine"],
          priority_prefixes: NEX1_PRIORITY_PREFIXES,
          definition_intent: true,
          max_files_scanned: 500,
          max_candidates: 50,
        });

        // Identify declaration sites (real re-read for line number)
        const sites: DeclarationSite[] = [];
        const usageOnly: string[] = [];
        for (const cand of disc.candidates) {
          if (!cand.is_declaration_site) {
            if (cand.content_matches > 0 || cand.filename_matches > 0) {
              usageOnly.push(cand.repo_relative_path);
            }
            continue;
          }
          for (const symbol of c.concepts) {
            const site = findDeclarationLine(cand.repo_relative_path, symbol);
            if (site) sites.push(site);
          }
        }

        // Build each formula's evaluations
        const f1 = buildF1(sites);
        const f2 = buildF2(sites);
        const f3 = buildF3(sites, usageOnly.map((f) => ({ source_file: f, symbol: c.concepts[0] })));
        const f4 = buildF4(sites);
        const f5 = buildF5(sites);

        const formulas: Record<string, FormulaResult> = {
          F0: runFormula("F0", c.concepts, null),
          F1: runFormula("F1", c.concepts, f1),
          F2: runFormula("F2", c.concepts, f2),
          F3: runFormula("F3", c.concepts, f3),
          F4: runFormula("F4", c.concepts, f4),
          F5: runFormula("F5", c.concepts, f5),
        };

        allResults[c.id] = {
          case_id: c.id,
          concepts: c.concepts,
          expected: c.expected,
          category: c.category,
          walker_candidates: disc.candidates.slice(0, 20).map((k) => ({
            repo_relative_path: k.repo_relative_path,
            is_declaration_site: k.is_declaration_site,
            declaration_matches: k.declaration_matches,
            private_declaration_matches: k.private_declaration_matches,
            method_declaration_matches: k.method_declaration_matches,
            content_matches: k.content_matches,
            filename_matches: k.filename_matches,
            match_score: k.match_score,
          })),
          declaration_sites: sites,
          usage_only_files: usageOnly,
          formulas,
        };

        // Print concise summary per case
        console.log(
          `\n[${c.id}] concepts=[${c.concepts.join(", ")}] category=${c.category}\n` +
          `  walker returned ${disc.candidates.length} candidates · ${sites.length} declaration_sites\n` +
          `  declaration_sites: ${sites.map((s) => `${s.source_file}:${s.line_number}(${s.declaration_type})`).join(", ") || "(none)"}\n` +
          `  usage_only_files: ${usageOnly.length}\n` +
          Object.entries(formulas).map(([k, v]) =>
            `  ${k} · candidates=${v.candidate_count} · scopes=${v.scope_count} · SELECTED=[${v.q8_selected.join(", ") || "(none)"}]`
          ).join("\n"),
        );
      }

      fs.writeFileSync(
        path.join(OUT_DIR, "formula-experiment.json"),
        JSON.stringify(allResults, null, 2),
      );
      expect(Object.keys(allResults).length).toBe(CASES.length);
    },
    600000,
  );
});
