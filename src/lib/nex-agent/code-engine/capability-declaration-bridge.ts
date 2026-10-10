// src/lib/nex-agent/code-engine/capability-declaration-bridge.ts
//
// NEX1 · Stage 1.6 · Declaration Bridge · Ledger B additive · zero LLM · READ-ONLY.
//
// 2026-09-19 · founder-authorised after Stage 1.6 diagnostic proved:
//   · Fix 11 (chain-relationship-composer) drops declaration-lookup targets
//     because it requires an exact endpoint chain (producer_consumer →
//     condition_gates_return). Declaration files rarely satisfy that shape.
//   · Q7's input contract (HypothesisEvaluation[] + HypothesisEvidenceEvaluation[])
//     accepts a declaration-flavoured evaluation without any modification
//     to Q7 or Q8.
//
// PURPOSE (§1 of the Stage 1.6 mandate)
//   Produce Q7-compatible HypothesisEvaluation records for walker-discovered
//   declaration sites so that declaration-lookup investigations reach the
//   existing Q7 → Q8 boundary. This is an ADDITIVE parallel pathway. It
//   NEVER weakens Fix 11's exact-endpoint-chain contract, NEVER modifies Q7
//   or Q8 policy, and NEVER fabricates causal / root-cause claims.
//
// FORMULA (F1 · site-only · from `data/nex1-stage1-6-bridge/formula-experiment.json`)
//   Given a walker DiscoveryCandidate c with c.is_declaration_site = true
//   and the concept token `symbol`, emit exactly one evaluation:
//     candidate_id  = `decl@${c.repo_relative_path}::candidate::${line}:${line}:${symbol}`
//     evidence_id   = `${candidate_id}::${relationship_id}`
//     relationship_id = `declaration_relationship::${c.repo_relative_path}::${symbol}`
//     composition_id  = `declaration_composition::${c.repo_relative_path}::${symbol}`
//     status        = STRUCTURALLY_SUPPORTING           (declaration evidence · never causal)
//     rule_fired    = R-DECL-EXPORT | R-DECL-PRIVATE | R-DECL-METHOD
//     evidence_kind = INFERRED                          (never PROVEN · never OBSERVED)
//     provenance    = [{ source_file, start_line: line, end_line: line }]
//     overall_status = STRUCTURALLY_SUPPORTED
//     confidence    = 0.35                              (bounded · informational)
//
//   SCOPE NAMESPACING (`decl@` prefix)
//     Q7 scopes evaluations by `candidate_id.split("::")[0]`. The `decl@`
//     prefix on the source_file portion ensures declaration bridge evaluations
//     live in a DISTINCT scope from the root-cause pipeline's evaluations
//     for the same file. Without this, root-cause hypotheses (with 5-15
//     supporting_count) would tuple-outrank the declaration bridge (with
//     supporting_count=1) in the shared scope, and Q8 would emit TIE / no
//     selection. Namespacing keeps the two evidence classes non-interfering.
//     The REAL file path is preserved verbatim in provenance.source_file,
//     so downstream consumers see the correct location.
//
// AMBIGUITY POLICY (§8 · A1 toForwardSlash · A2 recordEvidence)
//   Multiple legitimate declarations of the same symbol → multiple candidates
//   emitted, one per source_file. Q7 groups by scope=source_file so every
//   legitimate declaration reaches Q8 as its own scope · Q8 emits SELECTED
//   per legitimate scope. This preserves honest multi-declaration ambiguity
//   without forced tie-breaking and without fabricating a unique winner.
//
// NEGATIVE CONTROLS (§9)
//   Non-declaration files (usage / importer / test-only) have
//   is_declaration_site = false in the walker output. The bridge emits ZERO
//   evaluations for them. They therefore never reach Q7 through this
//   pathway. The root-cause pathway (Fix 8-14) remains free to consider
//   them independently.
//
// DISCIPLINE INVARIANTS
//   · Zero LLM · zero randomness · zero timestamp · zero external model
//   · Bounded per-file re-read for declaration line lookup (max 200 KB)
//   · Deterministic sort of emissions by (source_file, symbol)
//   · No causal vocabulary in any templated string
//   · No modification of Q7 · Q8 · Fix 8-14 files (verified by hash)
//
// AUTHORITY BOUNDARY
//   · SELECT authority only · never MODIFY / EXECUTE / AUTHORIZE / VERIFY

import { readFileSync } from "node:fs";
import path from "node:path";
import type { DiscoveryCandidate } from "./capability-repository-discovery";
import type {
  HypothesisEvaluation,
  HypothesisEvidenceEvaluation,
} from "./capability-hypothesis-evidence-evaluator";

// ── Contract constants (public API · documented in doctrine) ─────────────

/** The single, canonical prefix that marks a Q7/Q8 scope key as
 *  declaration-derived (rather than root-cause-derived). It appears as the
 *  leading segment of:
 *    · candidate_id                              (`decl@<path>::candidate::...`)
 *    · CandidateRanking.source_file              (Q7 output)
 *    · CandidateSelection.source_file            (Q8 output · persisted)
 *    · rankings_reference.source_file            (Q8 → Q7 reference)
 *  Downstream consumers MUST treat `decl@<path>` as a SCOPED CANDIDATE
 *  IDENTIFIER · NOT a filesystem path. The real path lives verbatim in the
 *  `provenance[i].source_file` field of the same record.
 *
 *  Contract locked in:
 *    · docs/doctrine/nex1-decl-source-file-contract-2026-09-20.md
 *    · capability-selection-kind.ts (canonical accessors)
 */
export const DECLARATION_SCOPE_PREFIX = "decl@";

// ── Public shape ─────────────────────────────────────────────────────────

export interface BuildDeclarationEvaluationsInput {
  readonly candidates: readonly DiscoveryCandidate[];
  readonly concept_tokens: readonly string[];
  readonly repo_root: string;
  /** Bounded per-file content read for declaration-line discovery. */
  readonly max_content_bytes_per_file?: number;
}

export interface BuildDeclarationEvaluationsResult {
  readonly ok: true;
  readonly evaluations: readonly HypothesisEvaluation[];
  readonly evidence_records: readonly HypothesisEvidenceEvaluation[];
  readonly stats: {
    readonly candidates_seen: number;
    readonly declaration_sites_found: number;
    readonly declaration_lines_resolved: number;
    readonly evaluations_emitted: number;
    readonly files_read: number;
    readonly zero_llm: true;
    readonly evidence_kind: "INFERRED";
  };
}

// ── Internal ─────────────────────────────────────────────────────────────

type DeclarationType = "exported" | "private" | "method";

interface DeclarationSite {
  readonly source_file: string;
  readonly symbol: string;
  readonly line_number: number;
  readonly declaration_type: DeclarationType;
}

const DEFAULT_MAX_CONTENT_BYTES = 200_000;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Find the FIRST declaration line for `symbol` in `content`. Deterministic.
 *  Precedence: exported → private-top-level → class method (only when file
 *  has an exported class). Mirrors the walker's declaration-signal regexes. */
function findFirstDeclarationLine(
  content: string,
  symbol: string,
): { line_number: number; declaration_type: DeclarationType } | null {
  if (symbol.length === 0) return null;
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
    if (exp.test(lines[i])) return { line_number: i + 1, declaration_type: "exported" };
  }
  for (let i = 0; i < lines.length; i++) {
    if (priv.test(lines[i])) return { line_number: i + 1, declaration_type: "private" };
  }
  if (hasExportClass) {
    for (let i = 0; i < lines.length; i++) {
      if (meth.test(lines[i])) return { line_number: i + 1, declaration_type: "method" };
    }
  }
  return null;
}

function ruleFor(t: DeclarationType): "R-DECL-EXPORT" | "R-DECL-PRIVATE" | "R-DECL-METHOD" {
  if (t === "exported") return "R-DECL-EXPORT";
  if (t === "private") return "R-DECL-PRIVATE";
  return "R-DECL-METHOD";
}

// ── Entry point ──────────────────────────────────────────────────────────

export function buildDeclarationEvaluations(
  input: BuildDeclarationEvaluationsInput,
): BuildDeclarationEvaluationsResult {
  const maxBytes = input.max_content_bytes_per_file ?? DEFAULT_MAX_CONTENT_BYTES;
  const conceptsClean: string[] = [];
  const seen = new Set<string>();
  for (const c of input.concept_tokens) {
    const t = c.trim();
    if (t.length === 0) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    conceptsClean.push(t);
  }

  const sites: DeclarationSite[] = [];
  let filesRead = 0;

  for (const cand of input.candidates) {
    if (!cand.is_declaration_site) continue;
    const abs = path.join(input.repo_root, cand.repo_relative_path);
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
      if (content.length > maxBytes) content = content.slice(0, maxBytes);
      filesRead++;
    } catch {
      continue;
    }
    for (const symbol of conceptsClean) {
      const found = findFirstDeclarationLine(content, symbol);
      if (found) {
        sites.push({
          source_file: cand.repo_relative_path,
          symbol,
          line_number: found.line_number,
          declaration_type: found.declaration_type,
        });
      }
    }
  }

  sites.sort((a, b) => {
    const s = a.source_file.localeCompare(b.source_file);
    if (s !== 0) return s;
    return a.symbol.localeCompare(b.symbol);
  });

  const evaluations: HypothesisEvaluation[] = [];
  const evidence_records: HypothesisEvidenceEvaluation[] = [];

  for (const s of sites) {
    // Namespace the scope with `decl@` prefix so Q7 groups declaration
    // evidence separately from root-cause evaluations for the same file.
    const candidate_id = `decl@${s.source_file}::candidate::${s.line_number}:${s.line_number}:${s.symbol}`;
    const relationship_id = `declaration_relationship::${s.source_file}::${s.symbol}`;
    const composition_id = `declaration_composition::${s.source_file}::${s.symbol}`;
    const evidence_id = `${candidate_id}::${relationship_id}`;
    const provenance = [{
      source_file: s.source_file,
      start_line: s.line_number,
      end_line: s.line_number,
    }];
    const ev: HypothesisEvidenceEvaluation = {
      candidate_id,
      evidence_id,
      relationship_id,
      composition_id,
      status: "STRUCTURALLY_SUPPORTING",
      rule_fired: ruleFor(s.declaration_type),
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

  return {
    ok: true,
    evaluations,
    evidence_records,
    stats: {
      candidates_seen: input.candidates.length,
      declaration_sites_found: sites.length,
      declaration_lines_resolved: sites.length,
      evaluations_emitted: evaluations.length,
      files_read: filesRead,
      zero_llm: true,
      evidence_kind: "INFERRED",
    },
  };
}
