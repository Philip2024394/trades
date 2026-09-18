// src/lib/nex-agent/code-engine/native-investigation-actions.ts
//
// NEX1 · Native Investigation · Bounded Action Primitives (Fix 3 · §7 A/B/C/D).
//
// Purpose (per founder Master Impl WO §7):
//   Expose the existing repository inspection capability through a controlled
//   native NEX1 interface. Investigation is READ-ONLY · deterministic ·
//   bounded · traceable · reproducible.
//
// Design (Connect-Before-Build):
//   Every action here is a THIN wrapper over an existing primitive:
//     · Action A · discover_repository   ← FileMemoryStore.listFiles + IndependentObserver.walk
//     · Action B · search_by_concept_tag ← FileMemoryStore.listFiles({tag})
//     · Action C · inspect_source_metadata ← FileMemoryStore.recallFile
//     · Action D · analyse_dependencies   ← buildDependencyGraph
//
// SAFETY (§13 · founder-locked):
//   · Never invokes an LLM
//   · Never executes arbitrary code · never spawns processes for content search
//   · Never writes any file (except FileMemoryStore's own JSONL append via
//     rememberFile · which is out of scope for these read-actions)
//   · Every action bounded · timeout hints only (no forced kill · caller enforces)
//   · Every result carries provenance
//
// TRACE (§10):
//   Each action returns a structured record with `action`, `bounded_by`, `input`,
//   `output_summary`, `evidence_kind` fields. Composable into an evidence packet.

import path from "node:path";
import type { FileMemoryStore, Nex1FileMemoryEntry } from "./capability-m-file-memory";
import { IndependentObserver } from "@/lib/nex-independent-observer/observer";
import { buildDependencyGraph } from "@/lib/nex-agent-runtime/programming-mission/dependency-graph";
import type { DependencyGraph } from "@/lib/nex-agent-runtime/programming-mission/dependency-graph";
import { inspectFileSource } from "./capability-source-inspection";
import type { SourceInspection } from "./capability-source-inspection";

// ── Common action record shape ─────────────────────────────────────────

export type InvestigationActionKind =
  | "discover_repository"        // Action A · WO §7
  | "search_by_concept_tag"       // Action B · WO §7
  | "inspect_source_metadata"     // Action C · WO §7
  | "analyse_dependencies"        // Action D · WO §7
  | "inspect_source_content";     // Action E · Fix 7 · 2026-09-16 · source reader

/** Evidence taxonomy per founder authorization 2026-09-16 (Fix 7):
 *   OBSERVED   · Directly established from inspected source / repo evidence
 *   INFERRED   · Derived from observed evidence
 *   HYPOTHESIS · Proposed explanation not established by evidence
 *   UNKNOWN    · Cannot currently be established
 *   PROVEN     · Established by a deterministic verification condition
 *                (NOT merely because text was observed) · reserved for
 *                future verification actions · Fix 7 reader never emits it. */
export type EvidenceKind = "OBSERVED" | "INFERRED" | "UNKNOWN" | "HYPOTHESIS" | "PROVEN";

export interface InvestigationActionRecord<TResult> {
  readonly action: InvestigationActionKind;
  readonly action_id: string;
  readonly started_at: string;
  readonly finished_at: string;
  readonly duration_ms: number;
  readonly input: unknown;
  readonly ok: boolean;
  readonly result: TResult | null;
  readonly error: string | null;
  readonly bounded_by: string;
  readonly evidence_kind: EvidenceKind;
  readonly reasoning_trace: readonly string[];
}

function newActionId(kind: InvestigationActionKind): string {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeRecord<T>(
  kind: InvestigationActionKind,
  input: unknown,
  started: Date,
  boundedBy: string,
  evidenceKind: InvestigationActionRecord<T>["evidence_kind"],
  reasoningTrace: string[],
  result: T | null,
  error: string | null,
): InvestigationActionRecord<T> {
  const finished = new Date();
  return {
    action: kind,
    action_id: newActionId(kind),
    started_at: started.toISOString(),
    finished_at: finished.toISOString(),
    duration_ms: finished.getTime() - started.getTime(),
    input,
    ok: error === null,
    result,
    error,
    bounded_by: boundedBy,
    evidence_kind: evidenceKind,
    reasoning_trace: reasoningTrace,
  };
}

// ── Action A · Discover repository structure ──────────────────────────

export interface ActionADiscoverInput {
  readonly store: FileMemoryStore;
  readonly limit?: number;   // default 500 · hard cap 2000
}

export interface ActionADiscoverResult {
  readonly source: "file_memory_listFiles";
  readonly total_available: number;
  readonly returned: number;
  readonly sample_paths: readonly string[];
  readonly by_language_count: Record<string, number>;
}

/** Discover repository structure via FileMemoryStore.listFiles.
 *  Bounded to seeded corpus · never walks arbitrary paths.
 *  Evidence: OBSERVED (real seeded entries · verifiable via sha256). */
export function actionA_discoverRepository(
  input: ActionADiscoverInput,
): InvestigationActionRecord<ActionADiscoverResult> {
  const started = new Date();
  const trace: string[] = [];
  const limit = Math.min(input.limit ?? 500, 2000);
  trace.push(`limit=${limit}`);
  try {
    const list = input.store.listFiles({ limit });
    const langCount: Record<string, number> = {};
    for (const e of list.entries) {
      langCount[e.language] = (langCount[e.language] ?? 0) + 1;
    }
    trace.push(`total_matching=${list.total_matching} · returned=${list.returned}`);
    const sample = list.entries.slice(0, 30).map((e: Nex1FileMemoryEntry) => e.path);
    return makeRecord<ActionADiscoverResult>(
      "discover_repository", { limit }, started,
      `FileMemoryStore.listFiles · limit=${limit}`, "OBSERVED", trace,
      {
        source: "file_memory_listFiles",
        total_available: list.total_matching,
        returned: list.returned,
        sample_paths: sample,
        by_language_count: langCount,
      },
      null,
    );
  } catch (e) {
    trace.push(`exception: ${(e as Error).message}`);
    return makeRecord<ActionADiscoverResult>(
      "discover_repository", { limit }, started,
      `FileMemoryStore.listFiles · limit=${limit}`, "UNKNOWN", trace,
      null, (e as Error).message,
    );
  }
}

// ── Action B · Search by concept tag ──────────────────────────────────

export interface ActionBSearchInput {
  readonly store: FileMemoryStore;
  readonly tag: string;
  readonly limit?: number;   // default 50 · hard cap 200
  readonly path_prefix?: string;
}

export interface ActionBSearchResult {
  readonly tag: string;
  readonly total_matching: number;
  readonly returned: number;
  readonly matches: readonly {
    readonly path: string;
    readonly sha256: string;
    readonly size_bytes: number;
    readonly language: string;
    readonly other_tags: readonly string[];
  }[];
}

/** Search File Memory by concept tag · deterministic filter · bounded.
 *  Evidence: OBSERVED (matched files have the tag set at seed time based
 *  on deterministic content scan · verifiable via sha256). */
export function actionB_searchByConceptTag(
  input: ActionBSearchInput,
): InvestigationActionRecord<ActionBSearchResult> {
  const started = new Date();
  const trace: string[] = [];
  const limit = Math.min(input.limit ?? 50, 200);
  trace.push(`tag=${input.tag} · limit=${limit}${input.path_prefix ? ` · prefix=${input.path_prefix}` : ""}`);
  try {
    const filter: { tag: string; limit: number; path_prefix?: string } = {
      tag: input.tag, limit,
    };
    if (input.path_prefix) filter.path_prefix = input.path_prefix;
    const list = input.store.listFiles(filter);
    trace.push(`total_matching=${list.total_matching} · returned=${list.returned}`);
    const matches = list.entries.map((e: Nex1FileMemoryEntry) => ({
      path: e.path,
      sha256: e.sha256,
      size_bytes: e.size_bytes,
      language: e.language,
      other_tags: e.tags.filter((t) => t !== input.tag),
    }));
    return makeRecord<ActionBSearchResult>(
      "search_by_concept_tag", input, started,
      `FileMemoryStore.listFiles({tag}) · limit=${limit}`, "OBSERVED", trace,
      { tag: input.tag, total_matching: list.total_matching, returned: list.returned, matches },
      null,
    );
  } catch (e) {
    trace.push(`exception: ${(e as Error).message}`);
    return makeRecord<ActionBSearchResult>(
      "search_by_concept_tag", input, started,
      `FileMemoryStore.listFiles({tag})`, "UNKNOWN", trace,
      null, (e as Error).message,
    );
  }
}

// ── Action C · Inspect source metadata (READ-ONLY · no content emission) ──

export interface ActionCInspectInput {
  readonly store: FileMemoryStore;
  readonly path: string;
}

export interface ActionCInspectResult {
  readonly path: string;
  readonly exists_in_memory: boolean;
  readonly sha256: string | null;
  readonly size_bytes: number | null;
  readonly language: string | null;
  readonly tags: readonly string[];
  readonly summary: string | null;
  readonly first_seen_iso: string | null;
  readonly last_seen_iso: string | null;
}

/** Inspect source-file metadata via FileMemoryStore.recallFile.
 *  RETURNS METADATA ONLY · never emits file content · sha256 allows
 *  external verification without leaking bytes.
 *  Evidence: OBSERVED (metadata) · content is UNKNOWN to investigation. */
export function actionC_inspectSourceMetadata(
  input: ActionCInspectInput,
): InvestigationActionRecord<ActionCInspectResult> {
  const started = new Date();
  const trace: string[] = [];
  trace.push(`recallFile(${input.path})`);
  try {
    const r = input.store.recallFile(input.path);
    if (r.kind === "found") {
      trace.push(`found · sha256=${r.entry.sha256.slice(0, 16)}...`);
      return makeRecord<ActionCInspectResult>(
        "inspect_source_metadata", input, started,
        "FileMemoryStore.recallFile · metadata only · no content", "OBSERVED", trace,
        {
          path: r.entry.path,
          exists_in_memory: true,
          sha256: r.entry.sha256,
          size_bytes: r.entry.size_bytes,
          language: r.entry.language,
          tags: r.entry.tags,
          summary: r.entry.summary,
          first_seen_iso: r.entry.first_seen_iso,
          last_seen_iso: r.entry.last_seen_iso,
        },
        null,
      );
    }
    trace.push(`not_remembered · kind=${r.kind}`);
    return makeRecord<ActionCInspectResult>(
      "inspect_source_metadata", input, started,
      "FileMemoryStore.recallFile", "UNKNOWN", trace,
      {
        path: input.path, exists_in_memory: false,
        sha256: null, size_bytes: null, language: null,
        tags: [], summary: null, first_seen_iso: null, last_seen_iso: null,
      },
      null,
    );
  } catch (e) {
    trace.push(`exception: ${(e as Error).message}`);
    return makeRecord<ActionCInspectResult>(
      "inspect_source_metadata", input, started,
      "FileMemoryStore.recallFile", "UNKNOWN", trace,
      null, (e as Error).message,
    );
  }
}

// ── Action D · Analyse dependencies ────────────────────────────────────

export interface ActionDAnalyseInput {
  readonly workspace_root: string;
  readonly file_paths: readonly string[];         // bounded set · caller supplies
  readonly max_files?: number;                    // default 200 · hard cap 500
}

export interface ActionDAnalyseResult {
  readonly analysed_file_count: number;
  readonly cross_file_edge_count: number;
  readonly edges_sample: readonly {
    readonly from: string;
    readonly to: string;
    readonly symbols: readonly string[];
  }[];
  readonly files_with_no_edges: readonly string[];
}

/** Deterministic import/export analysis via buildDependencyGraph.
 *  Evidence: OBSERVED (real regex-parsed import statements)
 *  · edge resolution is INFERRED (path resolution rules applied). */
export async function actionD_analyseDependencies(
  input: ActionDAnalyseInput,
): Promise<InvestigationActionRecord<ActionDAnalyseResult>> {
  const started = new Date();
  const trace: string[] = [];
  const cap = Math.min(input.max_files ?? 200, 500);
  const filesToAnalyse = input.file_paths.slice(0, cap);
  trace.push(`bounded to ${filesToAnalyse.length} files (cap=${cap})`);
  try {
    const graph: DependencyGraph = await buildDependencyGraph({
      workspace_root: input.workspace_root,
      file_paths: filesToAnalyse,
    });
    trace.push(`cross_file_edges=${graph.cross_file_edge_count}`);
    const sample = graph.edges.slice(0, 20).map((e) => ({
      from: e.from_file, to: e.to_file, symbols: [...e.imported_symbols],
    }));
    const filesWithEdges = new Set<string>();
    for (const e of graph.edges) filesWithEdges.add(e.from_file);
    const filesWithNoEdges = filesToAnalyse.filter((p) => !filesWithEdges.has(p));
    return makeRecord<ActionDAnalyseResult>(
      "analyse_dependencies", { workspace_root: input.workspace_root, file_count: filesToAnalyse.length },
      started, `buildDependencyGraph · cap=${cap}`,
      graph.cross_file_edge_count > 0 ? "OBSERVED" : "INFERRED",  // edges observed if any · else INFERRED (empty result)
      trace,
      {
        analysed_file_count: filesToAnalyse.length,
        cross_file_edge_count: graph.cross_file_edge_count,
        edges_sample: sample,
        files_with_no_edges: filesWithNoEdges.slice(0, 30),
      },
      null,
    );
  } catch (e) {
    trace.push(`exception: ${(e as Error).message}`);
    return makeRecord<ActionDAnalyseResult>(
      "analyse_dependencies", { workspace_root: input.workspace_root, file_count: filesToAnalyse.length },
      started, "buildDependencyGraph", "UNKNOWN", trace,
      null, (e as Error).message,
    );
  }
}

// ── Action E · Inspect source content (Fix 7 · 2026-09-16) ────────────
//
// The minimum bridge between "file located" and "source-derived evidence".
// Wraps `inspectFileSource` from capability-source-inspection.ts. The reader
// is bounded, deterministic, refuses on any error, and emits verbatim
// structural facts with source-file + line-range provenance.
//
// Evidence_kind rule (per founder authorization):
//   · OBSERVED · reader returned kind='ok' · at least one structural fact
//     was extracted directly from source content
//   · UNKNOWN  · reader refused, threw, or returned kind='ok' with zero
//     facts (nothing to observe — honest empty state)
// The reader NEVER emits PROVEN. PROVEN is reserved for a future
// verification action that establishes a deterministic condition.

export interface ActionEInspectSourceInput {
  readonly file_path: string;                // repo-relative
  readonly repo_root: string;
  readonly max_bytes?: number;
}

export interface ActionEInspectSourceResult {
  readonly inspection: SourceInspection;     // full typed record with provenance
}

/** Read a bounded repository file and extract structural facts with line
 *  provenance. READ-ONLY. Never writes. Never executes. Never LLMs.
 *  Refuses cleanly on any failure. Evidence_kind is OBSERVED when at
 *  least one fact was extracted from real source content; UNKNOWN
 *  otherwise. */
export function actionE_inspectSourceContent(
  input: ActionEInspectSourceInput,
): InvestigationActionRecord<ActionEInspectSourceResult> {
  const started = new Date();
  const trace: string[] = [`inspectFileSource(${input.file_path})`];
  try {
    const inspection = inspectFileSource({
      file_path: input.file_path,
      repo_root: input.repo_root,
      max_bytes: input.max_bytes,
    });
    if (inspection.kind === "refused") {
      trace.push(`refused · ${inspection.refusal} · ${inspection.reason}`);
      return makeRecord<ActionEInspectSourceResult>(
        "inspect_source_content", input, started,
        `inspectFileSource · refused: ${inspection.refusal}`,
        "UNKNOWN", trace, { inspection }, null,
      );
    }
    const totalFacts =
      inspection.functions.length +
      inspection.if_branches.length +
      inspection.returns.length +
      inspection.string_literals.length +
      inspection.imports.length;
    trace.push(
      `ok · ${inspection.bytes_read}B · fns=${inspection.functions.length} · ` +
      `ifs=${inspection.if_branches.length} · returns=${inspection.returns.length} · ` +
      `strings=${inspection.string_literals.length} · imports=${inspection.imports.length}`,
    );
    return makeRecord<ActionEInspectSourceResult>(
      "inspect_source_content", input, started,
      `inspectFileSource · ${inspection.bytes_read}B · ts.createSourceFile`,
      totalFacts > 0 ? "OBSERVED" : "UNKNOWN",
      trace, { inspection }, null,
    );
  } catch (e) {
    trace.push(`exception: ${(e as Error).message}`);
    return makeRecord<ActionEInspectSourceResult>(
      "inspect_source_content", input, started,
      "inspectFileSource", "UNKNOWN", trace, null, (e as Error).message,
    );
  }
}

// ── Optional Action · Observer walk (heavy · not part of default budget) ──

export interface ActionObserveInput {
  readonly workspace_root: string;
}

export interface ActionObserveResult {
  readonly source: "IndependentObserver.walk";
  readonly files_seen: number;
  readonly sample_paths: readonly string[];
}

/** Optional observer walk · not counted against default 3-action budget.
 *  Use only when caller explicitly requests filesystem verification.
 *  Evidence: OBSERVED (real fs walk · sha256 confirmed). */
export async function optionalAction_observerWalk(
  input: ActionObserveInput,
): Promise<InvestigationActionRecord<ActionObserveResult>> {
  const started = new Date();
  const trace: string[] = [`IndependentObserver.walk(${input.workspace_root})`];
  try {
    const observer = new IndependentObserver();
    const walked = await observer.walk(input.workspace_root);
    trace.push(`files_seen=${walked.size}`);
    const sample = Array.from(walked.keys()).slice(0, 30);
    return makeRecord<ActionObserveResult>(
      "discover_repository", input, started,
      "IndependentObserver.walk · full workspace", "OBSERVED", trace,
      { source: "IndependentObserver.walk", files_seen: walked.size, sample_paths: sample },
      null,
    );
  } catch (e) {
    trace.push(`exception: ${(e as Error).message}`);
    return makeRecord<ActionObserveResult>(
      "discover_repository", input, started,
      "IndependentObserver.walk", "UNKNOWN", trace,
      null, (e as Error).message,
    );
  }
}
