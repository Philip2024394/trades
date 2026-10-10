// NEX1 · S0-DERIVE · Derived Operator-vs-Target Discrimination · READ-ONLY DIAGNOSTIC
// Founder-authorised 2026-09-20. NO production modification.
//
// EXPERIMENT QUESTION
//   Can NEX deterministically distinguish linguistic/operator words from the
//   requested technical/code target using three derived signals — WITHOUT
//   the manually curated DEFINITION_INTENT_TOKENS list?
//
// SIGNALS UNDER TEST (all derived from evidence NEX already has)
//   S1 · Token morphology  (mixed-case | separator)
//   S2 · Repository symbol evidence (declaration_count · exported · method ·
//        private · content_occurrence_count · derived declaration/content ratio)
//   S3 · Interrogative / grammatical position relative to INTERROGATIVE_MARKERS
//
// CONTROL: current production DEFINITION_INTENT_TOKENS filter.
//
// HARD-STOP CONDITIONS
//   · If diagnostic requires production modification to recover any signal → STOP + report
//   · If derived mechanism removes a legitimate target the control preserves → STOP
//   · If all successful target classifications depend on morphology alone
//     (and no lowercase legitimate identifier is correctly TARGET) → do NOT
//     claim generalisation; report residual honestly
//
// ZERO WRITES to production. Only reads walker + classifier via existing
// entry points. Simulates the proposed derived mechanism EXTERNALLY.

import { describe, it, expect } from "vitest";
import { runNativeInvestigation } from "@/lib/nex-agent/code-engine/native-investigation-mode";
import { discoverRepositoryCandidates } from "@/lib/nex-agent/code-engine/capability-repository-discovery";
import { INTERROGATIVE_MARKERS } from "@/lib/nex-agent/code-engine/capability-a-founder-intent/vocabulary";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "data", "nex1-s0-derive");

// Verbatim mirror of DEFINITION_INTENT_TOKENS from native-investigation-mode.ts:289
// (control condition only · no production modification).
const CONTROL_DEFINITION_INTENT_TOKENS: ReadonlySet<string> = new Set([
  "define", "defined", "definition", "definitions",
  "declare", "declared", "declaration", "declarations",
  "implement", "implements", "implemented", "implementation",
  "export", "exports", "exported",
  "where", "which",
]);

// ── S1 morphology ────────────────────────────────────────────────────────

function hasInternalUppercase(t: string): boolean {
  if (t.length < 2) return false;
  // Any uppercase letter that is not the first character.
  for (let i = 1; i < t.length; i++) {
    if (/[A-Z]/.test(t[i])) return true;
  }
  return false;
}
function hasSeparator(t: string): boolean {
  return /[_\-$]/.test(t);
}
function hasMixedCase(t: string): boolean {
  return /[a-z]/.test(t) && /[A-Z]/.test(t);
}
function morphologySignal(t: string): boolean {
  return hasMixedCase(t) || hasSeparator(t);
}

// ── S3 interrogative position ─────────────────────────────────────────────

function tokenisePreserveCase(query: string): { text: string; start: number; end: number }[] {
  const tokens: { text: string; start: number; end: number }[] = [];
  const re = /[A-Za-z][A-Za-z0-9_\-$]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

/** S3 classifier for a single query · returns per-token positional signal. */
function positionalSignals(query: string): Record<string, "interrogative_marker" | "target_slot" | "tail_predicate" | "grammatical_glue" | "unknown"> {
  const toks = tokenisePreserveCase(query);
  const smallWords = new Set(["is", "are", "was", "were", "be", "the", "of", "for", "and", "or", "to", "a", "an", "in", "on", "at", "by", "with", "this", "that", "these", "those"]);
  const out: Record<string, ReturnType<typeof positionalSignals>[string]> = {};
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const lower = t.text.toLowerCase();
    if (INTERROGATIVE_MARKERS.has(lower)) {
      out[t.text] = "interrogative_marker";
      continue;
    }
    if (smallWords.has(lower)) {
      out[t.text] = "grammatical_glue";
      continue;
    }
    // Is this token the FIRST content-bearing word after an interrogative marker?
    let prevIdx = i - 1;
    while (prevIdx >= 0) {
      const p = toks[prevIdx].text.toLowerCase();
      if (INTERROGATIVE_MARKERS.has(p)) {
        out[t.text] = "target_slot";
        break;
      }
      if (smallWords.has(p)) { prevIdx--; continue; }
      break;
    }
    if (out[t.text]) continue;
    // Is it the LAST content-bearing token (question tail after "? "/". ")?
    let nextIdx = i + 1;
    let atTail = true;
    while (nextIdx < toks.length) {
      const n = toks[nextIdx].text.toLowerCase();
      if (INTERROGATIVE_MARKERS.has(n)) { atTail = false; break; }
      if (!smallWords.has(n)) { atTail = false; break; }
      nextIdx++;
    }
    if (atTail && i > 0) {
      // and preceded by a target slot or small-word chain
      out[t.text] = "tail_predicate";
      continue;
    }
    out[t.text] = "unknown";
  }
  return out;
}

// ── S2 repository symbol evidence ────────────────────────────────────────

interface RepoEvidence {
  declaration_count: number;
  exported_declaration_count: number;
  private_declaration_count: number;
  class_method_declaration_count: number;
  content_occurrence_count: number;
  declaration_sites: string[];
  ratio_decl_over_content: number;
}

function repoEvidenceFor(token: string): RepoEvidence {
  // Uses the walker in read-only mode with no production alteration.
  // definition_intent=false so scoring stays neutral; we only care about
  // the per-candidate counts.
  const disc = discoverRepositoryCandidates({
    concepts: [token],
    repo_root: REPO_ROOT,
    allowed_root_prefixes: ["src", "docs/doctrine"],
    max_files_scanned: 2000, // HARD_MAX to get honest counts
    max_candidates: 50,
    definition_intent: false,
  });
  let decl = 0, expDecl = 0, privDecl = 0, methDecl = 0, content = 0;
  const sites: string[] = [];
  for (const c of disc.candidates) {
    decl += (c.declaration_matches + c.private_declaration_matches + c.method_declaration_matches);
    expDecl += c.declaration_matches;
    privDecl += c.private_declaration_matches;
    methDecl += c.method_declaration_matches;
    content += c.content_matches;
    if (c.is_declaration_site) sites.push(c.repo_relative_path);
  }
  return {
    declaration_count: decl,
    exported_declaration_count: expDecl,
    private_declaration_count: privDecl,
    class_method_declaration_count: methDecl,
    content_occurrence_count: content,
    declaration_sites: sites,
    ratio_decl_over_content: content > 0 ? decl / content : (decl > 0 ? 1 : 0),
  };
}

// ── Derived classification rule ──────────────────────────────────────────

type Role = "TARGET" | "OPERATOR" | "AMBIGUOUS" | "UNRESOLVED";

interface DerivedDecision {
  role: Role;
  evidence: string[];
  confidence: "high" | "medium" | "low";
}

function classifyDerived(
  tokenOriginal: string,
  tokenLower: string,
  morph: boolean,
  repo: RepoEvidence,
  positional: string,
): DerivedDecision {
  const ev: string[] = [];

  // 1. Grammatical-glue and interrogative markers are OPERATORS.
  if (positional === "interrogative_marker") {
    return { role: "OPERATOR", evidence: [`positional=interrogative_marker`], confidence: "high" };
  }
  if (positional === "grammatical_glue") {
    return { role: "OPERATOR", evidence: [`positional=grammatical_glue`], confidence: "high" };
  }

  // 2. Morphology alone: mixed-case or separator ⇒ strong TARGET signal.
  if (morph) {
    ev.push(`morphology=mixed_case_or_separator`);
    if (repo.declaration_count > 0) ev.push(`repo_declaration_count=${repo.declaration_count}`);
    return { role: "TARGET", evidence: ev, confidence: "high" };
  }

  // 3. All-lowercase token · need S2 + S3 to decide.
  ev.push(`morphology=lowercase_monocase`);

  // 3a. Repository ratio + declaration count.
  //     · High ratio (declared ≫ used as English/comment/string) ⇒ TARGET-lean.
  //     · Low ratio (used everywhere, rarely declared) ⇒ OPERATOR-lean.
  //     · Middle ⇒ AMBIGUOUS unless S3 disambiguates.
  const HIGH = 0.15;   // declaration count is ≥15% of raw occurrences · strong identifier signal
  const LOW  = 0.02;   // declaration count is <2% of raw occurrences · strong English-word signal
  const ratio = repo.ratio_decl_over_content;
  ev.push(`repo_ratio=${ratio.toFixed(4)} · decl=${repo.declaration_count} · content=${repo.content_occurrence_count}`);

  const s3IsTarget = positional === "target_slot";
  const s3IsPredicate = positional === "tail_predicate";
  if (s3IsTarget) ev.push(`positional=target_slot`);
  if (s3IsPredicate) ev.push(`positional=tail_predicate`);

  // 3b. Combine.
  if (repo.declaration_count === 0 && repo.content_occurrence_count === 0) {
    // Symbol does not exist anywhere · nonexistent target · classifier
    // itself will honestly refuse if used for lookup.
    // But: this could equally be a nonsense operator word. Distinguish by S3.
    if (s3IsTarget) return { role: "TARGET", evidence: [...ev, "repo_absent · s3=target_slot"], confidence: "medium" };
    if (s3IsPredicate) return { role: "OPERATOR", evidence: [...ev, "repo_absent · s3=tail_predicate"], confidence: "medium" };
    return { role: "UNRESOLVED", evidence: [...ev, "repo_absent · s3=unknown"], confidence: "low" };
  }

  if (ratio >= HIGH) {
    // Overwhelmingly a declared identifier.
    return { role: "TARGET", evidence: [...ev, `ratio>=${HIGH}`], confidence: s3IsTarget ? "high" : "medium" };
  }
  if (ratio < LOW && !s3IsTarget) {
    // Overwhelmingly a used-not-declared word (common English).
    return { role: "OPERATOR", evidence: [...ev, `ratio<${LOW} · not_target_slot`], confidence: s3IsPredicate ? "high" : "medium" };
  }

  // Mid-range or conflicting signals.
  if (s3IsTarget && repo.declaration_count > 0) {
    return { role: "TARGET", evidence: [...ev, "s3=target_slot · repo_declared"], confidence: "medium" };
  }
  if (s3IsPredicate) {
    return { role: "OPERATOR", evidence: [...ev, "s3=tail_predicate"], confidence: "medium" };
  }
  return { role: "AMBIGUOUS", evidence: ev, confidence: "low" };
}

// ── Corpus ───────────────────────────────────────────────────────────────

interface Case {
  id: string;
  query: string;
  intended_target: string | null; // null when not-a-definition-intent
  category:
    | "definition_intent"
    | "multi_symbol"
    | "non_definition_intent"
    | "negative_control"
    | "lowercase_identifier"
    | "operator_collision"
    | "ambiguous_target";
  expected_target_role?: "TARGET" | "AMBIGUOUS";
}

const CASES: Case[] = [
  // 14-case original S0 corpus
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
  // Multi-symbol
  { id: "M1",  query: "Where are assessFear and runNativeInvestigation defined?",
    intended_target: "assessFear",  category: "multi_symbol" },
  { id: "M3",  query: "Where are patternIdOf and toForwardSlash defined?",
    intended_target: "patternIdOf", category: "multi_symbol" },
  // Non-definition (must be untouched)
  { id: "N1",  query: "Fix the login bug in the payment flow",               intended_target: null, category: "non_definition_intent" },
  { id: "N2",  query: "Refactor the useAuth hook to use React Query",        intended_target: null, category: "non_definition_intent" },
  { id: "N3",  query: "Investigate why users see stale data on the dashboard", intended_target: null, category: "non_definition_intent" },
  // Lowercase legitimate identifier tests (CRITICAL · must succeed for generalisation)
  { id: "L1",  query: "Where is save defined?",                              intended_target: "save",  category: "lowercase_identifier", expected_target_role: "TARGET" },
  { id: "L2",  query: "Where is query defined?",                             intended_target: "query", category: "lowercase_identifier", expected_target_role: "AMBIGUOUS" /* 4 legitimate declarations */ },
  { id: "L3",  query: "Where is check defined?",                             intended_target: "check", category: "lowercase_identifier", expected_target_role: "TARGET" },
  { id: "L4",  query: "Where is apply defined?",                             intended_target: "apply", category: "lowercase_identifier", expected_target_role: "TARGET" },
  { id: "L5",  query: "Where is list defined?",                              intended_target: "list",  category: "lowercase_identifier", expected_target_role: "TARGET" },
  // Operator collision
  { id: "O1",  query: "Where is defined defined?",                           intended_target: "defined", category: "operator_collision" },
];

// ── Per-token record ─────────────────────────────────────────────────────

interface TokenRecord {
  query: string;
  token_original: string;
  token_normalized: string;
  s1: { internal_uppercase: boolean; separator: boolean; morphology_signal: boolean };
  s2: RepoEvidence;
  s3: { positional_signal: string };
  control: { in_DEFINITION_INTENT_TOKENS: boolean };
  derived: DerivedDecision;
}

interface CaseRecord {
  case_id: string;
  category: Case["category"];
  query: string;
  intended_target: string | null;
  expected_target_role?: Case["expected_target_role"];
  tokens: TokenRecord[];
  target_role_derived: Role | "TARGET_NOT_IN_QUERY";
  target_role_control: "target_kept_by_control" | "target_removed_by_control" | "target_not_in_query";
}

async function probeCase(c: Case): Promise<CaseRecord> {
  const toks = tokenisePreserveCase(c.query);
  const positionalMap = positionalSignals(c.query);
  const perToken: TokenRecord[] = [];
  const seen = new Set<string>();
  for (const t of toks) {
    if (seen.has(t.text.toLowerCase())) continue;
    seen.add(t.text.toLowerCase());
    if (t.text.length < 3) continue; // classifier drops <3 chars
    if (/^\d+$/.test(t.text)) continue;
    const tokenLower = t.text.toLowerCase();
    const s1 = {
      internal_uppercase: hasInternalUppercase(t.text),
      separator: hasSeparator(t.text),
      morphology_signal: morphologySignal(t.text),
    };
    const s2 = repoEvidenceFor(tokenLower);
    const s3 = { positional_signal: positionalMap[t.text] ?? "unknown" };
    const controlIn = CONTROL_DEFINITION_INTENT_TOKENS.has(tokenLower);
    const derived = classifyDerived(t.text, tokenLower, s1.morphology_signal, s2, s3.positional_signal);
    perToken.push({
      query: c.query,
      token_original: t.text,
      token_normalized: tokenLower,
      s1,
      s2,
      s3,
      control: { in_DEFINITION_INTENT_TOKENS: controlIn },
      derived,
    });
  }

  // Target role (derived) for the intended target
  let targetRole: Role | "TARGET_NOT_IN_QUERY" = "TARGET_NOT_IN_QUERY";
  if (c.intended_target) {
    const rec = perToken.find((r) => r.token_normalized === c.intended_target.toLowerCase());
    if (rec) targetRole = rec.derived.role;
  }
  // Target treatment by control
  let controlTargetTreatment: CaseRecord["target_role_control"] = "target_not_in_query";
  if (c.intended_target) {
    const rec = perToken.find((r) => r.token_normalized === c.intended_target.toLowerCase());
    if (rec) {
      controlTargetTreatment = rec.control.in_DEFINITION_INTENT_TOKENS
        ? "target_removed_by_control"
        : "target_kept_by_control";
    }
  }

  return {
    case_id: c.id,
    category: c.category,
    query: c.query,
    intended_target: c.intended_target,
    expected_target_role: c.expected_target_role,
    tokens: perToken,
    target_role_derived: targetRole,
    target_role_control: controlTargetTreatment,
  };
}

describe("NEX1 · S0-DERIVE · read-only derived operator/target discrimination", () => {
  it(
    "runs full corpus + emits diagnostic evidence",
    async () => {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const records: CaseRecord[] = [];
      for (const c of CASES) {
        records.push(await probeCase(c));
      }

      // ── Aggregate metrics ─────────────────────────────────────────────
      const definitionIntentCases = records.filter((r) => r.category === "definition_intent" || r.category === "ambiguous_target" || r.category === "multi_symbol" || r.category === "lowercase_identifier" || r.category === "operator_collision");

      // Target preservation: for cases with an intended_target, was it
      // classified TARGET (or AMBIGUOUS for genuinely-ambiguous cases)?
      const legitimateTargets = definitionIntentCases.filter((r) => r.intended_target !== null && r.category !== "negative_control");
      const targetsPreservedDerived = legitimateTargets.filter(
        (r) => r.target_role_derived === "TARGET" || (r.expected_target_role === "AMBIGUOUS" && r.target_role_derived === "AMBIGUOUS"),
      );

      // Operator rejection: for each token in DEFINITION_INTENT_TOKENS that
      // appeared in a definition-intent query, was it classified OPERATOR by
      // the derived mechanism?
      const controlTokensAppeared: { case_id: string; token: string; derived: Role }[] = [];
      for (const r of definitionIntentCases) {
        for (const t of r.tokens) {
          if (t.control.in_DEFINITION_INTENT_TOKENS) {
            controlTokensAppeared.push({ case_id: r.case_id, token: t.token_normalized, derived: t.derived.role });
          }
        }
      }
      const controlTokensRejectedByDerived = controlTokensAppeared.filter((x) => x.derived === "OPERATOR");

      // Lowercase-identifier accuracy
      const lowercaseCases = records.filter((r) => r.category === "lowercase_identifier");
      const lowercaseCorrect = lowercaseCases.filter(
        (r) => (r.expected_target_role === "TARGET" && r.target_role_derived === "TARGET")
            || (r.expected_target_role === "AMBIGUOUS" && r.target_role_derived === "AMBIGUOUS"),
      );

      // Non-definition stability
      const nonDefCases = records.filter((r) => r.category === "non_definition_intent");
      // In non-def cases the mechanism would not fire in production (gated
      // on definitionIntent). Here we just record what it would emit for
      // completeness; stability is defined as "no legitimate target token
      // in a non-def query is classified OPERATOR"... but non-def cases
      // have no legitimate targets by definition. So stability = the
      // mechanism would be a no-op (existing production gate). Recorded.

      const summary = {
        total_cases: records.length,
        definition_intent_cases: definitionIntentCases.length,
        legitimate_target_cases: legitimateTargets.length,
        target_preservation_derived: `${targetsPreservedDerived.length} / ${legitimateTargets.length}`,
        target_preservation_regressions_vs_control: legitimateTargets
          .filter((r) => r.target_role_control === "target_kept_by_control" && r.target_role_derived !== "TARGET" && r.target_role_derived !== "AMBIGUOUS")
          .map((r) => `${r.case_id}:${r.intended_target}`),
        control_token_rejection_by_derived: `${controlTokensRejectedByDerived.length} / ${controlTokensAppeared.length}`,
        control_tokens_not_rejected_by_derived: controlTokensAppeared
          .filter((x) => x.derived !== "OPERATOR")
          .map((x) => `${x.case_id}:${x.token}:${x.derived}`),
        lowercase_identifier_accuracy: `${lowercaseCorrect.length} / ${lowercaseCases.length}`,
        lowercase_identifier_details: lowercaseCases.map((r) => ({
          case_id: r.case_id,
          token: r.intended_target,
          expected: r.expected_target_role,
          derived: r.target_role_derived,
          correct: (r.expected_target_role === "TARGET" && r.target_role_derived === "TARGET")
                || (r.expected_target_role === "AMBIGUOUS" && r.target_role_derived === "AMBIGUOUS"),
        })),
        operator_collision_case: (() => {
          const o1 = records.find((r) => r.case_id === "O1");
          if (!o1) return "not_run";
          const targetRec = o1.tokens.find((t) => t.token_normalized === "defined");
          return {
            tokens: o1.tokens.map((t) => ({
              token: t.token_normalized,
              morph: t.s1.morphology_signal,
              ratio: t.s2.ratio_decl_over_content,
              decl: t.s2.declaration_count,
              content: t.s2.content_occurrence_count,
              pos: t.s3.positional_signal,
              control_in_list: t.control.in_DEFINITION_INTENT_TOKENS,
              derived: t.derived.role,
              evidence: t.derived.evidence,
            })),
            note: "target_token=defined is BOTH the intended target (as identifier) AND a linguistic operator. Genuine ambiguity.",
            derived_role_for_defined: targetRec?.derived.role ?? "N/A",
          };
        })(),
        non_definition_stability: {
          note: "Non-definition cases would NOT invoke the derived mechanism in production (production gate: definitionIntent === true). Below is what the derived mechanism WOULD emit if run on these tokens (informational).",
          cases: nonDefCases.map((r) => ({
            case_id: r.case_id,
            query: r.query,
            token_roles: r.tokens.map((t) => ({ token: t.token_normalized, role: t.derived.role })),
          })),
        },
      };

      // ── Emit evidence ─────────────────────────────────────────────────
      fs.writeFileSync(
        path.join(OUT_DIR, "s0-derive-diagnostic.json"),
        JSON.stringify({ summary, records }, null, 2),
      );

      // ── Console table ─────────────────────────────────────────────────
      for (const r of records) {
        console.log(`\n[${r.case_id}] (${r.category}) ${r.query}`);
        console.log(`  intended_target: ${r.intended_target ?? "(none)"} · expected_role: ${r.expected_target_role ?? "(default TARGET)"}`);
        for (const t of r.tokens) {
          console.log(
            `  ${t.token_original.padEnd(30)}  ` +
            `S1[morph=${t.s1.morphology_signal ? "Y" : "n"}]  ` +
            `S2[decl=${t.s2.declaration_count.toString().padStart(3)} content=${t.s2.content_occurrence_count.toString().padStart(5)} ratio=${t.s2.ratio_decl_over_content.toFixed(3)}]  ` +
            `S3[${t.s3.positional_signal.padEnd(22)}]  ` +
            `ctrl=${t.control.in_DEFINITION_INTENT_TOKENS ? "Y" : "n"}  ` +
            `→ ${t.derived.role} (${t.derived.confidence})`,
          );
        }
        console.log(`  TARGET-ROLE · control: ${r.target_role_control} · derived: ${r.target_role_derived}`);
      }
      console.log("\n═══ SUMMARY ═══\n" + JSON.stringify(summary, null, 2));

      // ── HARD-STOP invariants (soft-asserted so evidence still emits) ──
      // These are RECORDED, not enforced-fail, because the diagnostic must
      // deliver evidence even if the mechanism proves insufficient.
      expect(records.length).toBe(CASES.length);
    },
    900000,
  );
});
