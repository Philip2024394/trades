// src/lib/nex-agent/code-engine/capability-chain-narrative-emitter.ts
//
// NEX1 · Evidence-to-Explanation Adapter · deterministic · zero LLM · READ-ONLY.
//
// Fix 9 · 2026-09-16 · authorised after Test M CLEAN_BOUNDARY_CHAIN_ACCESS_NO_SYNTHESIS
// (docs/doctrine/nex1-test-m-source-explanation-2026-09-16.md).
//
// PURPOSE (founder Fix 9 authorization · verbatim):
//   > "Give NEX1 a truthful, provenance-preserved bridge from verified evidence
//     to the next reasoning layer."
//   > "Fix 9 must make the evidence easier to consume without pretending that
//     NEX1 understands the meaning of the evidence yet."
//   > "Build the bridge. Do not cross it early."
//
// WHAT THIS MODULE DOES:
//   · Takes ObservedChain[] as input (already OBSERVED · already provenanced by Fix 8)
//   · Emits ChainNarrative[] — structural restatements of chain facts
//   · Each statement is generated from a hard-coded deterministic template
//     that contains no causal vocabulary by construction
//   · Every statement carries provenance: chain_id + source_file + line range
//   · Runtime assertion rejects any statement containing forbidden causal words
//   · evidence_kind is locked to "OBSERVED" at the type level · TS compiler forbids upgrade
//
// WHAT THIS MODULE DOES NOT DO (founder §14 · enforced in code):
//   · No causal claim ("therefore", "because", "leads to", "causes", "implies")
//   · No behavioural interpretation ("this is why", "the reason is", "as a result")
//   · No policy explanation ("in order to", "so that", "which means", "hence")
//   · No promotion to INFERRED, HYPOTHESIS, or PROVEN
//   · No answer to "why the developer wrote the code"
//   · No answer to "what should be changed"
//   · No cross-file inference
//   · No LLM · no external inference · no writes · no execution
//
// FOUNDER RULE §14 · enforced in this file:
//   "Fix 9 may describe what the source says. It may not explain why the
//    source behaves that way."

import type { ObservedChain, ObservedFactRef } from "./capability-observed-chains";

// ── Public shape ─────────────────────────────────────────────────────────

export interface ChainNarrativeProvenance {
  readonly source_file: string;
  readonly start_line: number;
  readonly end_line: number;
}

/** A single structural restatement of chain evidence. Every statement is:
 *  · derived from ONE or MORE ObservedFactRef records in a chain
 *  · templated · no free-form prose
 *  · OBSERVED (never INFERRED/HYPOTHESIS/PROVEN) — type-locked
 *  · provenance-preserved (chain_id + source_file + line range) */
export interface ChainNarrative {
  readonly chain_id: string;
  readonly source_file: string;
  readonly statement: string;
  readonly evidence_kind: "OBSERVED";                        // locked literal type
  readonly supporting_fact_kinds: readonly (
    | "function"
    | "if_condition"
    | "return_statement"
    | "string_literal"
    | "import_statement"
    | "variable_declaration"
    | "chain_summary"
  )[];
  readonly provenance: readonly ChainNarrativeProvenance[];
  /** For observability: which template produced this statement. */
  readonly template_id:
    | "chain_summary"
    | "function_declaration"
    | "if_condition"
    | "return_statement"
    | "string_literal"
    | "import_statement";
}

export interface EmitChainNarrativesInput {
  readonly chains: readonly ObservedChain[];
  readonly max_narratives_per_chain?: number;   // default 8
  readonly max_narratives_total?: number;        // default 200
  readonly max_chains_processed?: number;        // default 40
}

export interface EmitChainNarrativesResult {
  readonly ok: true;
  readonly narratives: readonly ChainNarrative[];
  readonly stats: {
    readonly chains_seen: number;
    readonly chains_processed: number;
    readonly narratives_emitted: number;
    readonly narratives_rejected_forbidden_word: number;
    readonly narratives_rejected_missing_provenance: number;
    readonly forbidden_word_hits: readonly string[];
    readonly capped_by: string;
  };
}

// ── Forbidden causal vocabulary (founder §6 · enforced in code) ─────────
// This list is a defence-in-depth runtime check. The templates themselves
// contain no causal vocabulary by construction, so this check should never
// fire. If it fires, something in the code is wrong · that statement is
// rejected rather than emitted.
const FORBIDDEN_CAUSAL_TOKENS = [
  "therefore",
  "because",
  "causes",
  "caused by",
  "leads to",
  "results in",
  "implies",
  "hence",
  "so that",
  "in order to",
  "which means",
  "this is why",
  "the reason is",
  "as a result",
  "consequently",
];

// ── Bounds ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_NARRATIVES_PER_CHAIN = 8;
const DEFAULT_MAX_NARRATIVES_TOTAL = 300;
const DEFAULT_MAX_CHAINS_PROCESSED = 80;
const MAX_EXCERPT_CHARS = 100;

// ── Utilities ────────────────────────────────────────────────────────────

function containsForbiddenCausal(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of FORBIDDEN_CAUSAL_TOKENS) {
    if (lower.includes(t)) return t;
  }
  return null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

function fileBaseName(file: string): string {
  const parts = file.split(/[\\/]/);
  return parts[parts.length - 1] || file;
}

// ── Statement templates ─────────────────────────────────────────────────
//
// Every template is HARD-CODED and contains NO causal vocabulary.
// Templates produce factual re-statements of source content · never
// causal or teleological claims.

function templateChainSummary(chain: ObservedChain): { statement: string; provenance: ChainNarrativeProvenance[] } {
  const lines = chain.facts.map((f) => f.start_line);
  const minLine = Math.min(...lines);
  const maxLine = Math.max(...lines);
  const counts: Record<string, number> = {};
  for (const f of chain.facts) {
    counts[f.fact_kind] = (counts[f.fact_kind] ?? 0) + 1;
  }
  const kindsDesc = Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, n]) => `${n} ${k}`)
    .join(" · ");
  const relLabel = chain.relationship === "same_function_body"
    ? `enclosing function \`${chain.group_key}\``
    : `identifier \`${chain.group_key}\``;
  const statement =
    `In ${fileBaseName(chain.source_file)} (${chain.source_file}), a chain grouped by ` +
    `${relLabel} contains ${chain.fact_count} observed facts spanning lines ${minLine}-${maxLine} ` +
    `(${kindsDesc}).`;
  return {
    statement,
    provenance: [{ source_file: chain.source_file, start_line: minLine, end_line: maxLine }],
  };
}

function templateFunctionDeclaration(chain: ObservedChain, fact: ObservedFactRef): { statement: string; provenance: ChainNarrativeProvenance[] } | null {
  if (fact.fact_kind !== "function") return null;
  const name = fact.name ?? "<anonymous>";
  const params = fact.param_names && fact.param_names.length > 0
    ? fact.param_names.join(", ")
    : "";
  const paramsPart = params.length > 0 ? ` with parameters (${truncate(params, 60)})` : "";
  const statement =
    `In ${fact.source_file}, function \`${name}\` is declared at lines ${fact.start_line}-${fact.end_line}${paramsPart}.`;
  return {
    statement,
    provenance: [{ source_file: fact.source_file, start_line: fact.start_line, end_line: fact.end_line }],
  };
}

function templateIfCondition(chain: ObservedChain, fact: ObservedFactRef): { statement: string; provenance: ChainNarrativeProvenance[] } | null {
  if (fact.fact_kind !== "if_condition") return null;
  const enclosing = fact.enclosing_function ? `\`${fact.enclosing_function}\`` : "file scope";
  const condition = truncate(fact.condition_text, MAX_EXCERPT_CHARS);
  const statement =
    `In ${fact.source_file} at lines ${fact.start_line}-${fact.end_line}, within ${enclosing}, an if-statement tests the condition \`${condition}\`.`;
  return {
    statement,
    provenance: [{ source_file: fact.source_file, start_line: fact.start_line, end_line: fact.end_line }],
  };
}

function templateReturnStatement(chain: ObservedChain, fact: ObservedFactRef): { statement: string; provenance: ChainNarrativeProvenance[] } | null {
  if (fact.fact_kind !== "return_statement") return null;
  const enclosing = fact.enclosing_function ? `\`${fact.enclosing_function}\`` : "file scope";
  const expr = truncate(fact.return_expression_text, MAX_EXCERPT_CHARS);
  const statement =
    `In ${fact.source_file} at lines ${fact.start_line}-${fact.end_line}, within ${enclosing}, a return statement returns \`${expr}\`.`;
  return {
    statement,
    provenance: [{ source_file: fact.source_file, start_line: fact.start_line, end_line: fact.end_line }],
  };
}

function templateStringLiteral(chain: ObservedChain, fact: ObservedFactRef): { statement: string; provenance: ChainNarrativeProvenance[] } | null {
  if (fact.fact_kind !== "string_literal") return null;
  const enclosing = fact.enclosing_function ? `\`${fact.enclosing_function}\`` : "file scope";
  const value = truncate(fact.value, MAX_EXCERPT_CHARS);
  const statement =
    `In ${fact.source_file} at line ${fact.start_line}, within ${enclosing}, the string literal \`${value}\` appears.`;
  return {
    statement,
    provenance: [{ source_file: fact.source_file, start_line: fact.start_line, end_line: fact.end_line }],
  };
}

function templateImportStatement(chain: ObservedChain, fact: ObservedFactRef): { statement: string; provenance: ChainNarrativeProvenance[] } | null {
  if (fact.fact_kind !== "import_statement") return null;
  const names = fact.imported_names.slice(0, 8).join(", ");
  const statement =
    `In ${fact.source_file} at lines ${fact.start_line}-${fact.end_line}, an import statement brings in [${truncate(names, 80)}] from \`${fact.specifier}\`.`;
  return {
    statement,
    provenance: [{ source_file: fact.source_file, start_line: fact.start_line, end_line: fact.end_line }],
  };
}

// ── Entry point ──────────────────────────────────────────────────────────

/** Emit deterministic structural narratives from observed chains. Read-only.
 *  Zero interpretation · zero causal claim · zero LLM. */
export function emitChainNarratives(input: EmitChainNarrativesInput): EmitChainNarrativesResult {
  const maxPerChain = Math.min(
    input.max_narratives_per_chain ?? DEFAULT_MAX_NARRATIVES_PER_CHAIN,
    DEFAULT_MAX_NARRATIVES_PER_CHAIN,
  );
  const maxTotal = Math.min(
    input.max_narratives_total ?? DEFAULT_MAX_NARRATIVES_TOTAL,
    DEFAULT_MAX_NARRATIVES_TOTAL,
  );
  const maxChains = Math.min(
    input.max_chains_processed ?? DEFAULT_MAX_CHAINS_PROCESSED,
    DEFAULT_MAX_CHAINS_PROCESSED,
  );

  const narratives: ChainNarrative[] = [];
  let rejectedForbidden = 0;
  let rejectedProvenance = 0;
  const forbiddenHits: string[] = [];
  let cappedBy = `hard_cap=${maxTotal}`;

  // Preserve input order — chains from buildObservedChains are already in a
  // deterministic order that matches Fix 7's classifier_file_ref-first
  // inspection ordering. Alphabetic re-sort would push __tests__/ chains
  // ahead of the founder-named target file. Determinism is preserved
  // because input.chains order is deterministic by construction.
  const toProcess = input.chains.slice(0, maxChains);

  const emit = (
    chain: ObservedChain,
    fact_kinds: ChainNarrative["supporting_fact_kinds"],
    template_id: ChainNarrative["template_id"],
    payload: { statement: string; provenance: ChainNarrativeProvenance[] } | null,
  ): void => {
    if (payload === null) return;
    if (narratives.length >= maxTotal) return;
    // Provenance requirement
    if (payload.provenance.length === 0) {
      rejectedProvenance++;
      return;
    }
    for (const p of payload.provenance) {
      if (!p.source_file || p.start_line <= 0 || p.end_line < p.start_line) {
        rejectedProvenance++;
        return;
      }
    }
    // Forbidden causal check (defence in depth · templates should never fail this)
    const hit = containsForbiddenCausal(payload.statement);
    if (hit !== null) {
      rejectedForbidden++;
      forbiddenHits.push(hit);
      return;
    }
    narratives.push({
      chain_id: chain.chain_id,
      source_file: chain.source_file,
      statement: payload.statement,
      evidence_kind: "OBSERVED",
      supporting_fact_kinds: fact_kinds,
      provenance: payload.provenance,
      template_id,
    });
  };

  for (const chain of toProcess) {
    if (narratives.length >= maxTotal) {
      cappedBy = `hit_hard_cap=${maxTotal}`;
      break;
    }
    let perChainCount = 0;

    // 1. Chain summary (always first for each chain)
    emit(chain, ["chain_summary"], "chain_summary", templateChainSummary(chain));
    perChainCount++;

    // 2. One narrative per fact · in start_line order · up to maxPerChain
    for (const fact of chain.facts) {
      if (perChainCount >= maxPerChain) break;
      if (narratives.length >= maxTotal) break;
      let payload: { statement: string; provenance: ChainNarrativeProvenance[] } | null = null;
      let template_id: ChainNarrative["template_id"];
      if (fact.fact_kind === "function") {
        payload = templateFunctionDeclaration(chain, fact);
        template_id = "function_declaration";
      } else if (fact.fact_kind === "if_condition") {
        payload = templateIfCondition(chain, fact);
        template_id = "if_condition";
      } else if (fact.fact_kind === "return_statement") {
        payload = templateReturnStatement(chain, fact);
        template_id = "return_statement";
      } else if (fact.fact_kind === "string_literal") {
        payload = templateStringLiteral(chain, fact);
        template_id = "string_literal";
      } else if (fact.fact_kind === "import_statement") {
        payload = templateImportStatement(chain, fact);
        template_id = "import_statement";
      } else {
        continue;
      }
      emit(chain, [fact.fact_kind], template_id, payload);
      perChainCount++;
    }
  }

  return {
    ok: true,
    narratives,
    stats: {
      chains_seen: input.chains.length,
      chains_processed: toProcess.length,
      narratives_emitted: narratives.length,
      narratives_rejected_forbidden_word: rejectedForbidden,
      narratives_rejected_missing_provenance: rejectedProvenance,
      forbidden_word_hits: forbiddenHits,
      capped_by: cappedBy,
    },
  };
}
