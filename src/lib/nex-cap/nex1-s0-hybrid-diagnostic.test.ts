// NEX1 · S0-HYBRID · A/B diagnostic · list fast-path + derived fallback
// Founder-authorised 2026-09-20 · read-only · NO production modification.
//
// KEY QUESTION
//   Does a hybrid mechanism (DEFINITION_INTENT_TOKENS list as fast-path
//   IMMEDIATE OPERATOR, followed by derived signals for tokens NOT in the
//   list) preserve the list's aggressive canonical-operator rejection AND
//   generalise correctly to previously-unseen lowercase legitimate
//   identifiers?
//
// ARM A · CONTROL
//   For each token: if in DEFINITION_INTENT_TOKENS → OPERATOR
//                   else → TARGET (production default fallthrough)
//
// ARM B · HYBRID
//   For each token: if in DEFINITION_INTENT_TOKENS → OPERATOR (fast-path)
//                   else → apply S0-DERIVE frozen rule
//                       (S1 morphology · S2 repo evidence · S3 position)
//
// DERIVED RULE (VERBATIM COPY of S0-DERIVE · FROZEN · no tuning)
//   From `src/lib/nex-cap/nex1-s0-derive-diagnostic.test.ts:classifyDerived`.
//
// ANTI-CHEATING · 25 additional identifiers are hash-diverse selected
// (MD5-sorted, deterministic) from ALL 15,108 exported symbols in src/lib
// + src/app. The names are NOT hand-picked. See
// `data/nex1-s0-hybrid/hybrid-corpus-names.txt` for the frozen list.

import { describe, it, expect } from "vitest";
import { discoverRepositoryCandidates } from "@/lib/nex-agent/code-engine/capability-repository-discovery";
import { INTERROGATIVE_MARKERS } from "@/lib/nex-agent/code-engine/capability-a-founder-intent/vocabulary";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "data", "nex1-s0-hybrid");

// Verbatim mirror of DEFINITION_INTENT_TOKENS · same 16 tokens as production
// and same set as S0-DERIVE control condition.
const CONTROL_DEFINITION_INTENT_TOKENS: ReadonlySet<string> = new Set([
  "define", "defined", "definition", "definitions",
  "declare", "declared", "declaration", "declarations",
  "implement", "implements", "implemented", "implementation",
  "export", "exports", "exported",
  "where", "which",
]);

// ── FROZEN S0-DERIVE rule (verbatim) ─────────────────────────────────────

function hasInternalUppercase(t: string): boolean {
  if (t.length < 2) return false;
  for (let i = 1; i < t.length; i++) if (/[A-Z]/.test(t[i])) return true;
  return false;
}
function hasSeparator(t: string): boolean { return /[_\-$]/.test(t); }
function hasMixedCase(t: string): boolean { return /[a-z]/.test(t) && /[A-Z]/.test(t); }
function morphologySignal(t: string): boolean { return hasMixedCase(t) || hasSeparator(t); }

function tokenisePreserveCase(query: string) {
  const toks: { text: string; start: number; end: number }[] = [];
  const re = /[A-Za-z][A-Za-z0-9_\-$]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query)) !== null) toks.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  return toks;
}

function positionalSignals(query: string): Record<string, string> {
  const toks = tokenisePreserveCase(query);
  const smallWords = new Set(["is","are","was","were","be","the","of","for","and","or","to","a","an","in","on","at","by","with","this","that","these","those"]);
  const out: Record<string, string> = {};
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const lower = t.text.toLowerCase();
    if (INTERROGATIVE_MARKERS.has(lower)) { out[t.text] = "interrogative_marker"; continue; }
    if (smallWords.has(lower)) { out[t.text] = "grammatical_glue"; continue; }
    let prevIdx = i - 1;
    while (prevIdx >= 0) {
      const p = toks[prevIdx].text.toLowerCase();
      if (INTERROGATIVE_MARKERS.has(p)) { out[t.text] = "target_slot"; break; }
      if (smallWords.has(p)) { prevIdx--; continue; }
      break;
    }
    if (out[t.text]) continue;
    let nextIdx = i + 1; let atTail = true;
    while (nextIdx < toks.length) {
      const n = toks[nextIdx].text.toLowerCase();
      if (INTERROGATIVE_MARKERS.has(n)) { atTail = false; break; }
      if (!smallWords.has(n)) { atTail = false; break; }
      nextIdx++;
    }
    if (atTail && i > 0) { out[t.text] = "tail_predicate"; continue; }
    out[t.text] = "unknown";
  }
  return out;
}

interface RepoEvidence {
  declaration_count: number;
  content_occurrence_count: number;
  ratio_decl_over_content: number;
}
function repoEvidenceFor(token: string): RepoEvidence {
  const disc = discoverRepositoryCandidates({
    concepts: [token], repo_root: REPO_ROOT,
    allowed_root_prefixes: ["src", "docs/doctrine"],
    max_files_scanned: 2000, max_candidates: 50, definition_intent: false,
  });
  let decl = 0, content = 0;
  for (const c of disc.candidates) {
    decl += (c.declaration_matches + c.private_declaration_matches + c.method_declaration_matches);
    content += c.content_matches;
  }
  return {
    declaration_count: decl,
    content_occurrence_count: content,
    ratio_decl_over_content: content > 0 ? decl / content : (decl > 0 ? 1 : 0),
  };
}

type Role = "TARGET" | "OPERATOR" | "AMBIGUOUS" | "UNRESOLVED";
function classifyDerived(morph: boolean, repo: RepoEvidence, positional: string): Role {
  if (positional === "interrogative_marker") return "OPERATOR";
  if (positional === "grammatical_glue") return "OPERATOR";
  if (morph) return "TARGET";
  const HIGH = 0.15, LOW = 0.02;
  const ratio = repo.ratio_decl_over_content;
  const s3IsTarget = positional === "target_slot";
  const s3IsPredicate = positional === "tail_predicate";
  if (repo.declaration_count === 0 && repo.content_occurrence_count === 0) {
    if (s3IsTarget) return "TARGET";
    if (s3IsPredicate) return "OPERATOR";
    return "UNRESOLVED";
  }
  if (ratio >= HIGH) return "TARGET";
  if (ratio < LOW && !s3IsTarget) return "OPERATOR";
  if (s3IsTarget && repo.declaration_count > 0) return "TARGET";
  if (s3IsPredicate) return "OPERATOR";
  return "AMBIGUOUS";
}

// ── ARMS A + B classifiers ───────────────────────────────────────────────

function classifyArmA(tokenLower: string): Role {
  // Current production behaviour · token is either OPERATOR (in list) or
  // TARGET (fallthrough — the filter removes it; if not removed it reaches
  // the bridge as a candidate target).
  return CONTROL_DEFINITION_INTENT_TOKENS.has(tokenLower) ? "OPERATOR" : "TARGET";
}
function classifyArmB(
  tokenOriginal: string,
  tokenLower: string,
  positional: string,
  repo: RepoEvidence,
): Role {
  // Fast-path · known operator token → immediate OPERATOR (preserves list's
  // aggressive rejection · unchanged from Arm A on canonical vocab).
  if (CONTROL_DEFINITION_INTENT_TOKENS.has(tokenLower)) return "OPERATOR";
  // Fallback · apply S0-DERIVE frozen rule.
  return classifyDerived(morphologySignal(tokenOriginal), repo, positional);
}

// ── Corpus ───────────────────────────────────────────────────────────────

interface Case {
  id: string;
  query: string;
  intended_target: string | null;
  category:
    | "definition_intent" | "multi_symbol" | "non_definition_intent"
    | "negative_control" | "lowercase_identifier" | "operator_collision"
    | "ambiguous_target" | "sentence_initial_capitalisation"
    | "unknown_technical_identifier" | "blind_discovered_identifier";
  expected_target_role?: "TARGET" | "AMBIGUOUS";
}

const CORE_CASES: Case[] = [
  // Existing 25 S0-DERIVE cases
  { id: "D1",  query: "Where is assessFear defined?",                       intended_target: "assessFear",                category: "definition_intent" },
  { id: "D2",  query: "Where is evaluateHypothesisEvidence defined?",       intended_target: "evaluateHypothesisEvidence", category: "definition_intent" },
  { id: "D3",  query: "Where is ComposedArgument defined?",                 intended_target: "ComposedArgument",           category: "definition_intent" },
  { id: "D4",  query: "Where is computeAbsenceCandidates defined?",         intended_target: "computeAbsenceCandidates",   category: "definition_intent" },
  { id: "D5",  query: "Where is FooBar defined?",                            intended_target: "FooBar",                     category: "negative_control" },
  { id: "D6",  query: "How is assessFear implemented?",                     intended_target: "assessFear",                category: "definition_intent" },
  { id: "D7",  query: "Which class defines patternIdOf?",                    intended_target: "patternIdOf",                category: "definition_intent" },
  { id: "D8",  query: "Where is the export of runNativeInvestigation?",     intended_target: "runNativeInvestigation",     category: "definition_intent" },
  { id: "D9",  query: "Where is the function assessFear?",                   intended_target: "assessFear",                category: "definition_intent" },
  { id: "D10", query: "Find the declaration of toForwardSlash",              intended_target: "toForwardSlash",             category: "definition_intent" },
  { id: "D11", query: "Where is toForwardSlash defined?",                    intended_target: "toForwardSlash",             category: "ambiguous_target" },
  { id: "D12", query: "What file exports the interface ComposedArgument?",   intended_target: "ComposedArgument",           category: "definition_intent" },
  { id: "D13", query: "Where is the implementation of generateRootCauseCandidates?", intended_target: "generateRootCauseCandidates", category: "definition_intent" },
  { id: "D14", query: "Which interface declares HypothesisEvidenceEvaluation?", intended_target: "HypothesisEvidenceEvaluation", category: "definition_intent" },
  { id: "M1",  query: "Where are assessFear and runNativeInvestigation defined?", intended_target: "assessFear",  category: "multi_symbol" },
  { id: "M3",  query: "Where are patternIdOf and toForwardSlash defined?", intended_target: "patternIdOf", category: "multi_symbol" },
  { id: "N1",  query: "Fix the login bug in the payment flow",               intended_target: null, category: "non_definition_intent" },
  { id: "N2",  query: "Refactor the useAuth hook to use React Query",        intended_target: null, category: "non_definition_intent" },
  { id: "N3",  query: "Investigate why users see stale data on the dashboard", intended_target: null, category: "non_definition_intent" },
  { id: "L1",  query: "Where is save defined?",     intended_target: "save",  category: "lowercase_identifier", expected_target_role: "TARGET" },
  { id: "L2",  query: "Where is query defined?",    intended_target: "query", category: "lowercase_identifier", expected_target_role: "TARGET" },
  { id: "L3",  query: "Where is check defined?",    intended_target: "check", category: "lowercase_identifier", expected_target_role: "TARGET" },
  { id: "L4",  query: "Where is apply defined?",    intended_target: "apply", category: "lowercase_identifier", expected_target_role: "TARGET" },
  { id: "L5",  query: "Where is list defined?",     intended_target: "list",  category: "lowercase_identifier", expected_target_role: "TARGET" },
  { id: "O1",  query: "Where is defined defined?",  intended_target: "defined", category: "operator_collision" },
];

// Blind hash-diverse identifiers from data/nex1-s0-hybrid/hybrid-corpus-names.txt
const BLIND_NAMES = readBlindNames();
function readBlindNames(): string[] {
  const p = path.join(REPO_ROOT, "data", "nex1-s0-hybrid", "hybrid-corpus-names.txt");
  return fs.readFileSync(p, "utf8").split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
}
const BLIND_CASES: Case[] = BLIND_NAMES.map((name, i) => ({
  id: `H${(i + 1).toString().padStart(2, "0")}`,
  query: `Where is ${name} defined?`,
  intended_target: name,
  category: "blind_discovered_identifier",
}));

// Extra: unknown technical identifier + sentence-initial capitalisation
const EXTRA_CASES: Case[] = [
  { id: "U1", query: "Where is nonExistentSymbolXyz defined?",       intended_target: "nonExistentSymbolXyz",       category: "unknown_technical_identifier" },
  { id: "U2", query: "Where is anotherfakenamehereplaceholder defined?", intended_target: "anotherfakenamehereplaceholder", category: "unknown_technical_identifier" },
  { id: "C1", query: "Where is Payment defined?",                     intended_target: "Payment",                     category: "sentence_initial_capitalisation" },
  { id: "C2", query: "Where is Login defined?",                       intended_target: "Login",                       category: "sentence_initial_capitalisation" },
];

const CASES: Case[] = [...CORE_CASES, ...BLIND_CASES, ...EXTRA_CASES];

// ── Per-token diagnostic ─────────────────────────────────────────────────

interface TokenRow {
  case_id: string;
  query: string;
  token_original: string;
  token_normalized: string;
  category: Case["category"];
  is_intended_target: boolean;
  in_definition_intent_list: boolean;
  s1_morphology: boolean;
  s2_declaration_count: number;
  s2_content_count: number;
  s2_ratio: number;
  s3_position: string;
  arm_a: Role;
  arm_b: Role;
  agreement: boolean;
}

function probeCase(c: Case): TokenRow[] {
  const toks = tokenisePreserveCase(c.query);
  const posMap = positionalSignals(c.query);
  const seen = new Set<string>();
  const rows: TokenRow[] = [];
  for (const t of toks) {
    if (t.text.length < 3) continue;
    const lower = t.text.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    const repo = repoEvidenceFor(lower);
    const morph = morphologySignal(t.text);
    const pos = posMap[t.text] ?? "unknown";
    const a = classifyArmA(lower);
    const b = classifyArmB(t.text, lower, pos, repo);
    rows.push({
      case_id: c.id, query: c.query,
      token_original: t.text, token_normalized: lower,
      category: c.category,
      is_intended_target: c.intended_target !== null && c.intended_target.toLowerCase() === lower,
      in_definition_intent_list: CONTROL_DEFINITION_INTENT_TOKENS.has(lower),
      s1_morphology: morph,
      s2_declaration_count: repo.declaration_count,
      s2_content_count: repo.content_occurrence_count,
      s2_ratio: repo.ratio_decl_over_content,
      s3_position: pos,
      arm_a: a, arm_b: b, agreement: a === b,
    });
  }
  return rows;
}

describe("NEX1 · S0-HYBRID · A/B diagnostic (list fast-path + derived fallback)", () => {
  it(
    "runs full A/B corpus + emits diagnostic evidence",
    async () => {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const allRows: TokenRow[] = [];
      for (const c of CASES) allRows.push(...probeCase(c));

      // ── Metrics ────────────────────────────────────────────────────
      const canonicalOperatorRows = allRows.filter((r) => r.in_definition_intent_list);
      const canonicalOperatorArmB = canonicalOperatorRows.filter((r) => r.arm_b === "OPERATOR");

      // For every intended target: check that Arm B did not misclassify it
      // as OPERATOR (which would silently strip it).
      const targetRows = allRows.filter((r) => r.is_intended_target);
      const targetRowsArmA = targetRows.filter((r) => r.arm_a === "TARGET");
      const targetRowsArmB = targetRows.filter((r) => r.arm_b === "TARGET" || r.arm_b === "AMBIGUOUS");
      const targetRegressions = targetRows.filter(
        (r) => (r.arm_a === "TARGET") && (r.arm_b === "OPERATOR" || r.arm_b === "UNRESOLVED"),
      );

      // Blind-corpus specifically
      const blindRows = allRows.filter((r) => r.category === "blind_discovered_identifier" && r.is_intended_target);
      const blindTargetPreservedByB = blindRows.filter((r) => r.arm_b === "TARGET" || r.arm_b === "AMBIGUOUS");
      const blindTargetPreservedByA = blindRows.filter((r) => r.arm_a === "TARGET");

      // Lowercase-identifier specifically
      const lowercaseRows = allRows.filter((r) => r.category === "lowercase_identifier" && r.is_intended_target);
      const lowercaseArmA = lowercaseRows.filter((r) => r.arm_a === "TARGET");
      const lowercaseArmB = lowercaseRows.filter((r) => r.arm_b === "TARGET" || r.arm_b === "AMBIGUOUS");

      // Operator-collision specifically (O1 `defined`)
      const collisionRow = allRows.find((r) => r.case_id === "O1" && r.token_normalized === "defined");

      // Fast-path preservation: for every DEFINITION_INTENT_TOKENS token,
      // Arm A and Arm B must both say OPERATOR.
      const fastPathDivergences = canonicalOperatorRows.filter((r) => r.arm_b !== r.arm_a);

      // Improvements: cases where Arm B classified a lowercase legitimate
      // identifier as TARGET where Arm A did the same (both TARGET) but the
      // rest of the pipeline (S1.6 bridge) would have accepted false-positive
      // co-token declarations under Arm A but not under Arm B. This is a
      // qualitative note in the report.
      const summary = {
        total_cases: CASES.length,
        total_token_rows: allRows.length,
        blind_corpus_size: BLIND_NAMES.length,
        canonical_operator_appearances: canonicalOperatorRows.length,
        canonical_operator_preserved_by_B: canonicalOperatorArmB.length,
        fast_path_divergences: fastPathDivergences.map((r) => ({ case_id: r.case_id, token: r.token_normalized, a: r.arm_a, b: r.arm_b })),
        target_preservation_A: `${targetRowsArmA.length} / ${targetRows.length}`,
        target_preservation_B_target_or_ambiguous: `${targetRowsArmB.length} / ${targetRows.length}`,
        target_regressions_A_to_B: targetRegressions.map((r) => ({ case_id: r.case_id, token: r.token_normalized })),
        blind_identifier_preservation_A: `${blindTargetPreservedByA.length} / ${blindRows.length}`,
        blind_identifier_preservation_B: `${blindTargetPreservedByB.length} / ${blindRows.length}`,
        lowercase_identifier_A: `${lowercaseArmA.length} / ${lowercaseRows.length}`,
        lowercase_identifier_B: `${lowercaseArmB.length} / ${lowercaseRows.length}`,
        operator_collision_O1_defined: collisionRow ? { arm_a: collisionRow.arm_a, arm_b: collisionRow.arm_b } : "not_run",
      };

      fs.writeFileSync(
        path.join(OUT_DIR, "s0-hybrid-diagnostic.json"),
        JSON.stringify({ summary, rows: allRows }, null, 2),
      );

      // Print condensed table
      console.log("\n═══ S0-HYBRID · A vs B ═══\n");
      for (const c of CASES) {
        const rows = allRows.filter((r) => r.case_id === c.id);
        console.log(`[${c.id}] (${c.category}) ${c.query}`);
        for (const r of rows) {
          const flag = r.is_intended_target ? "★" : " ";
          const div = r.agreement ? " " : "≠";
          console.log(
            `  ${flag}${div} ${r.token_original.padEnd(35)}  ` +
            `list=${r.in_definition_intent_list ? "Y" : "n"}  ` +
            `morph=${r.s1_morphology ? "Y" : "n"}  ` +
            `ratio=${r.s2_ratio.toFixed(3).padStart(5)}  ` +
            `pos=${r.s3_position.padEnd(22)}  ` +
            `A=${r.arm_a.padEnd(10)} B=${r.arm_b}`,
          );
        }
      }
      console.log("\n═══ SUMMARY ═══\n" + JSON.stringify(summary, null, 2));

      // Trace-based assertions
      expect(summary.fast_path_divergences, "Fast-path canonical-operator rejection must never diverge between A and B").toEqual([]);
      expect(summary.target_regressions_A_to_B, "No target preserved by A may be misclassified as OPERATOR/UNRESOLVED by B").toEqual([]);
    },
    900000,
  );
});
