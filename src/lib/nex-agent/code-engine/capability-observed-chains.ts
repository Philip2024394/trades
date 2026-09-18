// src/lib/nex-agent/code-engine/capability-observed-chains.ts
//
// NEX1 · Observed-Chain Aggregation · deterministic · zero LLM · READ-ONLY.
//
// Fix 8 · 2026-09-16 · authorised after Test L clean boundary
// (docs/doctrine/nex1-test-l-source-explanation-2026-09-16.md).
//
// Purpose (per founder Fix 8 authorization 2026-09-16):
//   Test K proved NEX1 can READ source. Test L proved that raw
//   source_inspections[] facts sit unused — nothing groups them into
//   related observations. Fix 8 introduces the SMALLEST possible
//   structural aggregator:
//
//     OBSERVED #1 -- same_function_body --> OBSERVED #2 --> OBSERVED #3 --> ...
//
//   Nothing more.
//
// DISCIPLINE (founder-locked · verbatim):
//   > "It should be: Make NEX1 organize related observed facts into
//     deterministic evidence chains."
//   > "That is a much smaller and safer capability."
//   > "Notice what it doesn't say: Therefore the system escalates because…
//     That would be synthesis. Fix 8 should stop immediately before that."
//   > "NEX1 should prove what it knows before it speaks as though it knows it."
//
// WHAT THIS MODULE DOES:
//   · Takes SourceInspection[] as input (already OBSERVED · already provenanced)
//   · Groups facts by explicit structural relationships:
//       (1) same_function_body       — facts sharing enclosing_function within a file
//       (2) shared_identifier        — facts whose text contains the same non-trivial identifier
//   · Emits ObservedChain[] records with fact ordering by start_line
//   · Every chain names its source_file, relationship kind, participating fact
//     references (file+line+kind+text), and fact count
//   · Preserves the OBSERVED evidence_kind — no upgrade to INFERRED / HYPOTHESIS
//   · Zero interpretation · zero prose · zero "therefore/because" text
//
// WHAT THIS MODULE DOES NOT DO:
//   · No claim about what the code does or means
//   · No causal relationships (no "leads to", "causes", "results in")
//   · No behavioural narrative (no natural-language explanation)
//   · No cross-file reasoning
//   · No control-flow interpretation ("if X then Y")
//   · No LLM · no external inference · no writes · no execution
//
// TEST M is the future test that will ask whether NEX1 can turn chains
// into an explanation. Fix 8 does not attempt any of that.

import type {
  SourceInspection,
  SourceInspectionOk,
  SourceFunctionRecord,
  SourceIfBranchRecord,
  SourceReturnRecord,
  SourceStringLiteralRecord,
  SourceImportRecord,
  SourceVariableDeclarationRecord,
} from "./capability-source-inspection";

// ── Public shape ─────────────────────────────────────────────────────────

/** Discriminated ref back to a single fact inside a SourceInspection.
 *  Every ref carries verbatim provenance — file + line range + text. */
export type ObservedFactRef =
  | {
      readonly fact_kind: "function";
      readonly source_file: string;
      readonly start_line: number;
      readonly end_line: number;
      readonly text: string;
      readonly name: string | null;
      readonly enclosing_function: string | null;
    }
  | {
      readonly fact_kind: "if_condition";
      readonly source_file: string;
      readonly start_line: number;
      readonly end_line: number;
      readonly text: string;
      readonly condition_text: string;
      readonly enclosing_function: string | null;
    }
  | {
      readonly fact_kind: "return_statement";
      readonly source_file: string;
      readonly start_line: number;
      readonly end_line: number;
      readonly text: string;
      readonly return_expression_text: string;
      readonly enclosing_function: string | null;
    }
  | {
      readonly fact_kind: "string_literal";
      readonly source_file: string;
      readonly start_line: number;
      readonly end_line: number;
      readonly text: string;
      readonly value: string;
      readonly enclosing_function: string | null;
    }
  | {
      readonly fact_kind: "import_statement";
      readonly source_file: string;
      readonly start_line: number;
      readonly end_line: number;
      readonly text: string;
      readonly specifier: string;
      readonly imported_names: readonly string[];
      readonly enclosing_function: null;
    }
  | {
      readonly fact_kind: "variable_declaration";
      readonly source_file: string;
      readonly start_line: number;
      readonly end_line: number;
      readonly text: string;
      readonly name: string;
      readonly initializer_text: string;
      readonly is_exported: boolean;
      readonly enclosing_function: string | null;
    };

export type ChainRelationship = "same_function_body" | "shared_identifier";

export interface ObservedChain {
  /** Deterministic id — file:relationship:group_key. */
  readonly chain_id: string;
  readonly source_file: string;
  readonly relationship: ChainRelationship;
  /** For same_function_body: the enclosing function name (or "<file_scope>").
   *  For shared_identifier: the identifier token that links the facts. */
  readonly group_key: string;
  /** Facts ordered by start_line ascending. */
  readonly facts: readonly ObservedFactRef[];
  readonly fact_count: number;
  /** Evidence kind is fixed OBSERVED — chains never emit INFERRED / HYPOTHESIS / PROVEN. */
  readonly evidence_kind: "OBSERVED";
}

// ── Bounds ──────────────────────────────────────────────────────────────

const MAX_CHAINS_PER_FILE = 40;
const MAX_FACTS_PER_CHAIN = 60;
const MIN_FACTS_PER_CHAIN = 2;
const MAX_TOTAL_CHAINS = 200;
const MIN_IDENTIFIER_LENGTH = 5;   // avoid trivial tokens like "if", "of", "in"

// Reserved words / trivial identifiers that must NOT anchor a shared_identifier chain
const TRIVIAL_TOKENS = new Set([
  "true", "false", "null", "undefined", "void", "this", "super",
  "const", "let", "var", "return", "throw", "if", "else", "while",
  "for", "of", "in", "do", "switch", "case", "break", "continue",
  "function", "class", "extends", "implements", "interface", "type",
  "export", "import", "from", "as", "new", "delete", "typeof",
  "readonly", "public", "private", "protected", "static", "async",
  "await", "yield", "then", "catch", "finally", "try",
  "kind", "true", "false", "null", "object", "string", "number", "boolean",
]);

// ── Entry point ──────────────────────────────────────────────────────────

export interface BuildObservedChainsInput {
  readonly inspections: readonly SourceInspection[];
  readonly max_total_chains?: number;
  readonly min_facts_per_chain?: number;
}

export interface BuildObservedChainsResult {
  readonly ok: true;
  readonly chains: readonly ObservedChain[];
  readonly stats: {
    readonly inspections_seen: number;
    readonly inspections_ok: number;
    readonly total_facts_considered: number;
    readonly chains_returned: number;
    readonly same_function_body_chains: number;
    readonly shared_identifier_chains: number;
    readonly capped_by: string;
  };
}

/** Deterministic grouper. Emits ObservedChain[] · zero interpretation. */
export function buildObservedChains(input: BuildObservedChainsInput): BuildObservedChainsResult {
  const maxTotal = Math.min(input.max_total_chains ?? MAX_TOTAL_CHAINS, MAX_TOTAL_CHAINS);
  const minFacts = Math.max(input.min_facts_per_chain ?? MIN_FACTS_PER_CHAIN, MIN_FACTS_PER_CHAIN);

  const inspectionsOk = input.inspections.filter((i): i is SourceInspectionOk => i.kind === "ok");

  let totalFactsConsidered = 0;
  const chains: ObservedChain[] = [];
  let sameFnChains = 0;
  let sharedIdChains = 0;
  let cappedBy = `hard_cap=${maxTotal}`;

  for (const insp of inspectionsOk) {
    // ── STEP 1 · group by enclosing_function ────────────────────────
    // Collect ALL facts from this inspection, tagged with fact_kind, keeping
    // provenance intact. Group by enclosing_function; a null enclosing_function
    // becomes the file-scope bucket "<file_scope>".
    const byFn = new Map<string, ObservedFactRef[]>();

    const addToFnBucket = (key: string, ref: ObservedFactRef): void => {
      let bucket = byFn.get(key);
      if (!bucket) {
        bucket = [];
        byFn.set(key, bucket);
      }
      bucket.push(ref);
    };

    for (const f of insp.functions) {
      totalFactsConsidered++;
      const ref: ObservedFactRef = {
        fact_kind: "function",
        source_file: f.source_file,
        start_line: f.start_line,
        end_line: f.end_line,
        text: f.text,
        name: f.name,
        enclosing_function: null, // A function declaration itself is NOT inside another function for our purpose
      };
      const key = f.name ?? "<anonymous>";
      addToFnBucket(key, ref);
    }
    for (const b of insp.if_branches) {
      totalFactsConsidered++;
      const ref: ObservedFactRef = {
        fact_kind: "if_condition",
        source_file: b.source_file,
        start_line: b.start_line,
        end_line: b.end_line,
        text: b.text,
        condition_text: b.condition_text,
        enclosing_function: b.enclosing_function,
      };
      addToFnBucket(b.enclosing_function ?? "<file_scope>", ref);
    }
    for (const r of insp.returns) {
      totalFactsConsidered++;
      const ref: ObservedFactRef = {
        fact_kind: "return_statement",
        source_file: r.source_file,
        start_line: r.start_line,
        end_line: r.end_line,
        text: r.text,
        return_expression_text: r.return_expression_text,
        enclosing_function: r.enclosing_function,
      };
      addToFnBucket(r.enclosing_function ?? "<file_scope>", ref);
    }
    for (const s of insp.string_literals) {
      totalFactsConsidered++;
      const ref: ObservedFactRef = {
        fact_kind: "string_literal",
        source_file: s.source_file,
        start_line: s.start_line,
        end_line: s.end_line,
        text: s.text,
        value: s.value,
        enclosing_function: s.enclosing_function,
      };
      addToFnBucket(s.enclosing_function ?? "<file_scope>", ref);
    }
    for (const i of insp.imports) {
      totalFactsConsidered++;
      const ref: ObservedFactRef = {
        fact_kind: "import_statement",
        source_file: i.source_file,
        start_line: i.start_line,
        end_line: i.end_line,
        text: i.text,
        specifier: i.specifier,
        imported_names: i.imported_names,
        enclosing_function: null,
      };
      addToFnBucket("<file_scope>", ref);
    }
    // Fix 10 · 2026-09-16 · variable_declarations enter same_function_body
    // buckets (or <file_scope> for top-level) so the relationship detector can
    // find producer/consumer pairs and ternary selectors within their scope.
    for (const v of insp.variable_declarations ?? []) {
      totalFactsConsidered++;
      const ref: ObservedFactRef = {
        fact_kind: "variable_declaration",
        source_file: v.source_file,
        start_line: v.start_line,
        end_line: v.end_line,
        text: v.text,
        name: v.name,
        initializer_text: v.initializer_text,
        is_exported: v.is_exported,
        enclosing_function: v.enclosing_function,
      };
      addToFnBucket(v.enclosing_function ?? "<file_scope>", ref);
    }

    // Emit same_function_body chains
    let perFileChainCount = 0;
    for (const [fnName, facts] of byFn.entries()) {
      if (facts.length < minFacts) continue;
      if (perFileChainCount >= MAX_CHAINS_PER_FILE) break;
      if (chains.length >= maxTotal) {
        cappedBy = `hit_hard_cap=${maxTotal}`;
        break;
      }
      const orderedFacts = [...facts].sort((a, b) => a.start_line - b.start_line);
      const truncatedFacts = orderedFacts.slice(0, MAX_FACTS_PER_CHAIN);
      chains.push({
        chain_id: `${insp.source_file}::same_function_body::${fnName}`,
        source_file: insp.source_file,
        relationship: "same_function_body",
        group_key: fnName,
        facts: truncatedFacts,
        fact_count: truncatedFacts.length,
        evidence_kind: "OBSERVED",
      });
      sameFnChains++;
      perFileChainCount++;
    }
    if (chains.length >= maxTotal) break;

    // ── STEP 2 · shared_identifier chains ──────────────────────────
    // For each pair of facts within a file that both mention the same
    // non-trivial identifier, form a shared_identifier chain grouped by
    // that identifier. Deterministic: identifier tokens sorted lex.
    const identifierBuckets = new Map<string, ObservedFactRef[]>();
    const allFileFacts: ObservedFactRef[] = [];
    for (const bucket of byFn.values()) allFileFacts.push(...bucket);

    for (const fact of allFileFacts) {
      // Extract identifier tokens from the fact's text/condition/value
      let searchText = "";
      if (fact.fact_kind === "if_condition") searchText = fact.condition_text;
      else if (fact.fact_kind === "return_statement") searchText = fact.return_expression_text;
      else if (fact.fact_kind === "string_literal") searchText = fact.value;
      else if (fact.fact_kind === "function") searchText = fact.name ?? "";
      // Imports intentionally skipped for shared_identifier — module paths would spam
      if (fact.fact_kind === "import_statement") continue;

      // Tokenize · JS/TS identifiers: [A-Za-z_$][\w$]*
      const tokens = new Set<string>();
      for (const m of searchText.matchAll(/[A-Za-z_$][\w$]*/g)) {
        const t = m[0];
        if (t.length < MIN_IDENTIFIER_LENGTH) continue;
        if (TRIVIAL_TOKENS.has(t.toLowerCase())) continue;
        tokens.add(t);
      }
      for (const t of tokens) {
        let b = identifierBuckets.get(t);
        if (!b) {
          b = [];
          identifierBuckets.set(t, b);
        }
        b.push(fact);
      }
    }

    // Emit shared_identifier chains where the identifier links >=2 distinct facts
    const identifiersSorted = [...identifierBuckets.keys()].sort();
    for (const ident of identifiersSorted) {
      const facts = identifierBuckets.get(ident)!;
      // Dedupe by (start_line, fact_kind) — an identifier may appear in multiple fact records at the same location
      const seenKeys = new Set<string>();
      const uniqFacts: ObservedFactRef[] = [];
      for (const f of facts) {
        const k = `${f.fact_kind}:${f.start_line}`;
        if (seenKeys.has(k)) continue;
        seenKeys.add(k);
        uniqFacts.push(f);
      }
      if (uniqFacts.length < minFacts) continue;
      if (perFileChainCount >= MAX_CHAINS_PER_FILE) break;
      if (chains.length >= maxTotal) {
        cappedBy = `hit_hard_cap=${maxTotal}`;
        break;
      }
      const orderedFacts = uniqFacts.sort((a, b) => a.start_line - b.start_line);
      const truncatedFacts = orderedFacts.slice(0, MAX_FACTS_PER_CHAIN);
      chains.push({
        chain_id: `${insp.source_file}::shared_identifier::${ident}`,
        source_file: insp.source_file,
        relationship: "shared_identifier",
        group_key: ident,
        facts: truncatedFacts,
        fact_count: truncatedFacts.length,
        evidence_kind: "OBSERVED",
      });
      sharedIdChains++;
      perFileChainCount++;
    }
    if (chains.length >= maxTotal) break;
  }

  return {
    ok: true,
    chains,
    stats: {
      inspections_seen: input.inspections.length,
      inspections_ok: inspectionsOk.length,
      total_facts_considered: totalFactsConsidered,
      chains_returned: chains.length,
      same_function_body_chains: sameFnChains,
      shared_identifier_chains: sharedIdChains,
      capped_by: cappedBy,
    },
  };
}
