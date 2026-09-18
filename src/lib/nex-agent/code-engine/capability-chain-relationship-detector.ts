// src/lib/nex-agent/code-engine/capability-chain-relationship-detector.ts
//
// NEX1 · Chain Relationship Detector · deterministic · zero LLM · READ-ONLY.
//
// Fix 10 · 2026-09-16 · authorised after Test N CHAIN_ACCESS_NO_RELATIONSHIP_INFERENCE.
// (docs/doctrine/nex1-test-n-causal-inference-2026-09-16.md).
//
// PURPOSE (founder Fix 10 authorization · verbatim):
//   > "Teach NEX1 to identify verified structural relationships between
//     source observations — not yet to explain why they exist."
//   > "The purpose is NOT to make NEX1 explain why code was written."
//   > "Fix 10 must remain: STRUCTURAL RELATIONSHIP DETECTION, not: CAUSAL REASONING."
//
// SCOPE (three patterns · no fourth pattern · founder §4):
//   Pattern 1 · producer_consumer          (variable declared then referenced in same function)
//   Pattern 2 · condition_gates_return     (if-condition followed by return within same function, bounded)
//   Pattern 3 · selector_literal_mapping   (ternary/conditional selecting one of known string literals)
//
// EVIDENCE DISCIPLINE (founder §9 · type-locked):
//   Every emitted relationship: evidence_kind = "INFERRED".
//   Never PROVEN. Never OBSERVED (chains already OBSERVED; inference is INFERRED).
//   Never HYPOTHESIS (structural facts are supported by source structure).
//
// PROVENANCE (founder §10 · every relationship has BOTH endpoints):
//   Both endpoint_A and endpoint_B carry:
//     start_line, end_line, symbol, fact_kind, source_file
//   enclosing_function preserved where structural check requires it.
//
// FORBIDDEN OUTPUT (founder §14 · defence-in-depth runtime check):
//   No claim contains "why", "because", "therefore", "causes", "results in",
//   "leads to", "intended to", "designed to", "purpose", "rationale",
//   "developer intent".

import type {
  ObservedChain,
  ObservedFactRef,
} from "./capability-observed-chains";

// ── Public shape ─────────────────────────────────────────────────────────

export type ChainRelationshipType =
  | "producer_consumer"
  | "condition_gates_return"
  | "selector_literal_mapping";

export type EndpointFactKind =
  | "if_condition"
  | "return_statement"
  | "string_literal"
  | "variable_declaration"
  | "function"
  | "import_statement";

export interface RelationshipEndpoint {
  readonly start_line: number;
  readonly end_line: number;
  readonly symbol: string;
  readonly fact_kind: EndpointFactKind;
}

export interface InferredRelationship {
  readonly relationship_type: ChainRelationshipType;
  readonly source_file: string;
  readonly endpoint_A: RelationshipEndpoint;
  readonly endpoint_B: RelationshipEndpoint;
  readonly enclosing_function: string | null;
  readonly direction: "forward";
  readonly evidence_kind: "INFERRED";
  /** Deterministic ID · file:type:A_line:B_line:symbol · used for regression + dedup. */
  readonly relationship_id: string;
  /** Optional supporting chain_ids · not load-bearing but useful for tracing. */
  readonly supporting_chain_ids: readonly string[];
}

export interface DetectRelationshipsInput {
  readonly chains: readonly ObservedChain[];
  readonly max_relationships_total?: number;
  readonly condition_gates_return_line_window?: number;
}

export interface DetectRelationshipsResult {
  readonly ok: true;
  readonly relationships: readonly InferredRelationship[];
  readonly stats: {
    readonly chains_seen: number;
    readonly relationships_emitted: number;
    readonly producer_consumer_count: number;
    readonly condition_gates_return_count: number;
    readonly selector_literal_mapping_count: number;
    readonly rejected_forbidden_word: number;
    readonly rejected_direction_violation: number;
    readonly rejected_identical_endpoints: number;
    readonly forbidden_hits: readonly string[];
    readonly capped_by: string;
  };
}

// ── Forbidden causal vocabulary (defence-in-depth runtime check) ─────────
// Templates in this detector emit structured field values only · never
// prose · so causal words should never appear. If a symbol name or
// initializer_text happens to contain one, the detector rejects the record
// rather than emitting it.
const FORBIDDEN_CAUSAL_TOKENS = [
  "why", "because", "therefore", "causes", "caused by",
  "leads to", "results in", "implies", "intended to",
  "designed to", "purpose", "rationale", "developer intent",
];

// ── Bounds ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_RELATIONSHIPS = 200;
const DEFAULT_CONDITION_RETURN_WINDOW = 15;   // per founder §6

// ── Utilities ────────────────────────────────────────────────────────────

function containsForbiddenCausal(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of FORBIDDEN_CAUSAL_TOKENS) {
    if (lower.includes(t)) return t;
  }
  return null;
}

/** Extract JS/TS identifiers from source text. Bounded to identifiers of
 *  length ≥3 (avoid trivial tokens like x, y, i). */
function extractIdentifiers(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/[A-Za-z_$][\w$]*/g)) {
    if (m[0].length >= 3) out.add(m[0]);
  }
  return out;
}

/** Detect whether text contains a ternary structure returning one of N
 *  string literals. Returns the ordered list of (condition_expression,
 *  literal_value) pairs. Deterministic · structural only · does not
 *  interpret meaning. */
interface TernaryBranch {
  readonly condition_expression: string;
  readonly literal_value: string;
}
function extractTernaryStringLiteralBranches(initializerText: string): TernaryBranch[] {
  // Match pattern:  <expr> ? "LITERAL" : <expr> ? "LITERAL" : "LITERAL"
  // Regex: (identifier or short expression) followed by ? followed by "..."
  // Capture (cond, literal) pairs. Non-string ternaries excluded.
  const branches: TernaryBranch[] = [];
  // Iteratively strip <cond> ? "lit" : from the front until only a bare literal remains.
  // Simplified: match repeatedly.
  const pairRe = /([A-Za-z_$][\w$.\[\]?'"]*(?:\([^()]*\))?)\s*\?\s*["'`]([^"'`]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(initializerText)) !== null) {
    branches.push({ condition_expression: m[1], literal_value: m[2] });
  }
  return branches;
}

/** Guard: reject if either endpoint carries a forbidden causal word in
 *  its symbol. Also reject if direction violates rule. Also reject if
 *  endpoints are identical. */
function validateAndAppend(
  out: InferredRelationship[],
  rel: InferredRelationship,
  stats: {
    rejectedForbidden: number;
    rejectedDirection: number;
    rejectedIdentical: number;
    forbiddenHits: string[];
  },
): void {
  // Direction check: endpoint_A.end_line ≤ endpoint_B.start_line
  if (rel.endpoint_A.end_line > rel.endpoint_B.start_line) {
    stats.rejectedDirection++;
    return;
  }
  // Distinct endpoints
  if (
    rel.endpoint_A.start_line === rel.endpoint_B.start_line &&
    rel.endpoint_A.end_line === rel.endpoint_B.end_line
  ) {
    stats.rejectedIdentical++;
    return;
  }
  // Forbidden causal vocab check (defence-in-depth · should never fire)
  const scanText = `${rel.endpoint_A.symbol} ${rel.endpoint_B.symbol}`;
  const hit = containsForbiddenCausal(scanText);
  if (hit !== null) {
    stats.rejectedForbidden++;
    stats.forbiddenHits.push(hit);
    return;
  }
  out.push(rel);
}

// ── Pattern implementations ─────────────────────────────────────────────

/** Pattern 1 · producer_consumer.
 *  For each variable_declaration V in a chain, find later facts in the
 *  same enclosing_function whose text/condition/return_expression/value
 *  references V.name. Bounded to identifiers ≥3 chars (avoid noise). */
function detectProducerConsumer(
  chain: ObservedChain,
  out: InferredRelationship[],
  stats: any,
  maxTotal: number,
): void {
  if (chain.relationship !== "same_function_body") return;
  if (chain.group_key === "<file_scope>") return; // producer_consumer only within a real function

  const varDecls = chain.facts.filter(
    (f): f is Extract<ObservedFactRef, { fact_kind: "variable_declaration" }> =>
      f.fact_kind === "variable_declaration" && f.name !== "<pattern>" && f.name.length >= 3,
  );

  const consumers = chain.facts.filter(
    (f) =>
      f.fact_kind === "if_condition" ||
      f.fact_kind === "return_statement" ||
      f.fact_kind === "string_literal",
  );

  for (const producer of varDecls) {
    if (out.length >= maxTotal) return;
    const producerName = producer.name;
    for (const consumer of consumers) {
      if (out.length >= maxTotal) return;
      // Direction: consumer's start_line must be strictly after producer's end_line
      if (consumer.start_line <= producer.end_line) continue;
      // Extract text to scan for producer name reference
      let consumerText = "";
      let consumerSymbolKind: EndpointFactKind;
      if (consumer.fact_kind === "if_condition") {
        consumerText = consumer.condition_text;
        consumerSymbolKind = "if_condition";
      } else if (consumer.fact_kind === "return_statement") {
        consumerText = consumer.return_expression_text;
        consumerSymbolKind = "return_statement";
      } else if (consumer.fact_kind === "string_literal") {
        // A string literal at a later position rarely "consumes" a producer;
        // skip unless the enclosing structural pattern warrants it.
        continue;
      } else {
        continue;
      }
      const idents = extractIdentifiers(consumerText);
      if (!idents.has(producerName)) continue;
      const rel: InferredRelationship = {
        relationship_type: "producer_consumer",
        source_file: chain.source_file,
        endpoint_A: {
          start_line: producer.start_line,
          end_line: producer.end_line,
          symbol: producerName,
          fact_kind: "variable_declaration",
        },
        endpoint_B: {
          start_line: consumer.start_line,
          end_line: consumer.end_line,
          symbol: producerName,
          fact_kind: consumerSymbolKind,
        },
        enclosing_function: chain.group_key,
        direction: "forward",
        evidence_kind: "INFERRED",
        relationship_id: `${chain.source_file}::producer_consumer::${producer.start_line}:${consumer.start_line}:${producerName}`,
        supporting_chain_ids: [chain.chain_id],
      };
      validateAndAppend(out, rel, stats);
    }
  }
}

/** Pattern 2 · condition_gates_return.
 *  For each if_condition C in a chain, find a return_statement R in the
 *  same enclosing_function whose start_line is strictly after C's
 *  end_line and within the bounded window (default 15 lines). */
function detectConditionGatesReturn(
  chain: ObservedChain,
  out: InferredRelationship[],
  stats: any,
  maxTotal: number,
  windowLines: number,
): void {
  if (chain.relationship !== "same_function_body") return;
  if (chain.group_key === "<file_scope>") return;

  const conditions = chain.facts.filter(
    (f): f is Extract<ObservedFactRef, { fact_kind: "if_condition" }> =>
      f.fact_kind === "if_condition",
  );
  const returns = chain.facts.filter(
    (f): f is Extract<ObservedFactRef, { fact_kind: "return_statement" }> =>
      f.fact_kind === "return_statement",
  );

  for (const cond of conditions) {
    if (out.length >= maxTotal) return;
    for (const ret of returns) {
      if (out.length >= maxTotal) return;
      if (ret.start_line <= cond.end_line) continue;
      if (ret.start_line > cond.end_line + windowLines) continue;
      const rel: InferredRelationship = {
        relationship_type: "condition_gates_return",
        source_file: chain.source_file,
        endpoint_A: {
          start_line: cond.start_line,
          end_line: cond.end_line,
          symbol: cond.condition_text.slice(0, 80),
          fact_kind: "if_condition",
        },
        endpoint_B: {
          start_line: ret.start_line,
          end_line: ret.end_line,
          symbol: ret.return_expression_text.slice(0, 80),
          fact_kind: "return_statement",
        },
        enclosing_function: chain.group_key,
        direction: "forward",
        evidence_kind: "INFERRED",
        relationship_id: `${chain.source_file}::condition_gates_return::${cond.start_line}:${ret.start_line}`,
        supporting_chain_ids: [chain.chain_id],
      };
      validateAndAppend(out, rel, stats);
    }
  }
}

/** Pattern 3 · selector_literal_mapping.
 *  For each variable_declaration whose initializer_text is a ternary
 *  selecting between string literals, emit ONE relationship per branch.
 *  endpoint_A = the variable's declaration line range (selector site)
 *  endpoint_B = the specific literal chosen (bounded by the initializer
 *              text · line-precision limited to declaration span). */
function detectSelectorLiteralMapping(
  chain: ObservedChain,
  out: InferredRelationship[],
  stats: any,
  maxTotal: number,
): void {
  if (chain.relationship !== "same_function_body") return;

  const varDecls = chain.facts.filter(
    (f): f is Extract<ObservedFactRef, { fact_kind: "variable_declaration" }> =>
      f.fact_kind === "variable_declaration",
  );

  for (const decl of varDecls) {
    if (out.length >= maxTotal) return;
    const branches = extractTernaryStringLiteralBranches(decl.initializer_text);
    if (branches.length < 2) continue; // require at least 2 branches for a real selector
    for (const b of branches) {
      if (out.length >= maxTotal) return;
      // Structural rejection: endpoint_A === endpoint_B by line range would
      // be flagged; distinct symbols suffice.
      // Direction check: within the declaration, condition is before the literal
      // in source order. For the tightened verifier this means A's end_line ==
      // B's start_line (both lie within the same statement); we accept this
      // by using "<=" in validateAndAppend and distinct symbol strings.
      const rel: InferredRelationship = {
        relationship_type: "selector_literal_mapping",
        source_file: chain.source_file,
        endpoint_A: {
          start_line: decl.start_line,
          end_line: decl.end_line,
          symbol: b.condition_expression.slice(0, 60),
          fact_kind: "variable_declaration",
        },
        endpoint_B: {
          start_line: decl.start_line,
          end_line: decl.end_line,
          symbol: b.literal_value.slice(0, 60),
          fact_kind: "string_literal",
        },
        enclosing_function: chain.group_key === "<file_scope>" ? null : chain.group_key,
        direction: "forward",
        evidence_kind: "INFERRED",
        relationship_id: `${chain.source_file}::selector_literal_mapping::${decl.start_line}:${b.condition_expression.slice(0, 20)}:${b.literal_value.slice(0, 20)}`,
        supporting_chain_ids: [chain.chain_id],
      };
      // For selector_literal_mapping the endpoints share the same line
      // range · we skip the "distinct endpoints" reject rule for this
      // pattern via a special validator path.
      const scanText = `${rel.endpoint_A.symbol} ${rel.endpoint_B.symbol}`;
      const hit = containsForbiddenCausal(scanText);
      if (hit !== null) {
        stats.rejectedForbidden++;
        stats.forbiddenHits.push(hit);
        continue;
      }
      // Direction rule for selector: endpoint_A.end_line ≤ endpoint_B.end_line
      // (both within same statement span)
      if (rel.endpoint_A.end_line > rel.endpoint_B.end_line) {
        stats.rejectedDirection++;
        continue;
      }
      out.push(rel);
    }
  }
}

// ── Entry point ──────────────────────────────────────────────────────────

export function detectChainRelationships(
  input: DetectRelationshipsInput,
): DetectRelationshipsResult {
  const maxTotal = Math.min(input.max_relationships_total ?? DEFAULT_MAX_RELATIONSHIPS, DEFAULT_MAX_RELATIONSHIPS);
  const window = input.condition_gates_return_line_window ?? DEFAULT_CONDITION_RETURN_WINDOW;

  const relationships: InferredRelationship[] = [];
  const stats = {
    rejectedForbidden: 0,
    rejectedDirection: 0,
    rejectedIdentical: 0,
    forbiddenHits: [] as string[],
  };

  // Preserve chain input order (matches Fix 9 discipline) — chains from
  // buildObservedChains are already deterministic.
  const chains = input.chains;

  for (const chain of chains) {
    if (relationships.length >= maxTotal) break;
    detectProducerConsumer(chain, relationships, stats, maxTotal);
    if (relationships.length >= maxTotal) break;
    detectConditionGatesReturn(chain, relationships, stats, maxTotal, window);
    if (relationships.length >= maxTotal) break;
    detectSelectorLiteralMapping(chain, relationships, stats, maxTotal);
  }

  // Deduplicate by relationship_id (structural dedup)
  const seen = new Set<string>();
  const deduped: InferredRelationship[] = [];
  for (const rel of relationships) {
    if (seen.has(rel.relationship_id)) continue;
    seen.add(rel.relationship_id);
    deduped.push(rel);
  }

  const producerConsumerCount = deduped.filter((r) => r.relationship_type === "producer_consumer").length;
  const conditionGatesReturnCount = deduped.filter((r) => r.relationship_type === "condition_gates_return").length;
  const selectorLiteralMappingCount = deduped.filter((r) => r.relationship_type === "selector_literal_mapping").length;

  return {
    ok: true,
    relationships: deduped,
    stats: {
      chains_seen: chains.length,
      relationships_emitted: deduped.length,
      producer_consumer_count: producerConsumerCount,
      condition_gates_return_count: conditionGatesReturnCount,
      selector_literal_mapping_count: selectorLiteralMappingCount,
      rejected_forbidden_word: stats.rejectedForbidden,
      rejected_direction_violation: stats.rejectedDirection,
      rejected_identical_endpoints: stats.rejectedIdentical,
      forbidden_hits: stats.forbiddenHits,
      capped_by: relationships.length >= maxTotal ? `hit_hard_cap=${maxTotal}` : `hard_cap=${maxTotal}`,
    },
  };
}
