// src/lib/nex-agent/code-engine/capability-repo-world-model.ts
//
// NEX1 · Phase 2 · Repository World Model (Aider PageRank pattern)
// Ledger B additive · Zero LLM · Deterministic · Fresh-subprocess reproducible.
//
// PURPOSE
//   Give NEX a structural model of a repository so it can answer:
//     "Given this specification, which files matter most?"
//   without keyword-only heuristics.
//
//   The model:
//     1. Extracts defined symbols per file (functions · classes · types · exports)
//     2. Extracts references between files (imports · symbol usage)
//     3. Runs deterministic PageRank on the symbol-reference graph
//     4. Ranks candidate files by (concept-match × PageRank)
//
// AUTHORITY BOUNDARY
//   · SELECT authority only · never MODIFY / EXECUTE / VERIFY
//   · Every returned path is a real filesystem entry (statSync-verified)
//   · Uses only regex extraction (no tree-sitter · no TS compiler)
//     · Boundary: regex misses some declarations · captures reported honestly
//
// SAFETY (read-only · zero LLM · zero writes · zero execution)
//   · Bounded to approved read roots (default: src/)
//   · Bounded file count · bounded content bytes per file
//   · Skips node_modules · .next · dist · build · .git · coverage
//   · Deterministic sort · deterministic PRNG seed derived from input digest
//
// LEDGER
//   · Ledger B · structural design Claude-authored
//   · No thresholds encoded in the interface · caller supplies opts
//   · No task-specific knowledge · no fixture-specific hardcoding

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const REPO_WORLD_MODEL_VERSION = "repo-world-model.v1.2026-09-19";

// ── Public shapes ────────────────────────────────────────────────────────

export interface RepoWorldModelInput {
  readonly repo_root: string;
  readonly allowed_root_prefixes?: readonly string[];
  readonly max_files_scanned?: number;
  readonly max_content_bytes_per_file?: number;
  readonly pagerank_damping?: number;
  readonly pagerank_iterations?: number;
  readonly pagerank_convergence_epsilon?: number;
}

export interface SymbolDefinition {
  readonly name: string;
  readonly kind: "function" | "class" | "type" | "interface" | "const" | "export";
  readonly line_number: number;
}

export interface SymbolReference {
  readonly name: string;
  readonly line_number: number;
}

export interface FileNode {
  readonly repo_relative_path: string;
  readonly defined_symbols: readonly SymbolDefinition[];
  readonly referenced_symbols: readonly SymbolReference[];
  readonly imports_paths: readonly string[];
  readonly file_size_bytes: number;
}

export interface RepoWorldModel {
  readonly version: string;
  readonly input_digest: string;
  readonly compiled_at_iso: string;
  readonly files: readonly FileNode[];
  readonly symbol_to_defining_file: Readonly<Record<string, readonly string[]>>;
  readonly graph_edges: readonly {
    readonly from: string;
    readonly to: string;
    readonly weight: number;
  }[];
  readonly pagerank: Readonly<Record<string, number>>;
  readonly pagerank_converged: boolean;
  readonly pagerank_iterations_used: number;
  readonly stats: {
    readonly files_scanned: number;
    readonly files_indexed: number;
    readonly directories_walked: number;
    readonly total_symbols_defined: number;
    readonly total_references_captured: number;
    readonly bounded_by: string;
  };
  readonly reproducibility: {
    readonly prng_seed: string;
    readonly zero_llm: true;
    readonly deterministic: true;
  };
  readonly ledger: "B";
}

export interface RelevanceRankingInput {
  readonly model: RepoWorldModel;
  readonly concepts: readonly string[];
  readonly max_results?: number;
  readonly pagerank_weight?: number;
  readonly concept_match_weight?: number;
}

export interface RankedFile {
  readonly repo_relative_path: string;
  readonly relevance_score: number;
  readonly concept_match_score: number;
  readonly pagerank_score: number;
  readonly matched_concepts: readonly string[];
  readonly reasons: readonly string[];
}

// ── Constants ────────────────────────────────────────────────────────────

const DEFAULT_ALLOWED_PREFIXES = ["src"];
const DEFAULT_MAX_FILES = 800;
const HARD_MAX_FILES = 3000;
const DEFAULT_MAX_CONTENT_BYTES = 250_000;
const DEFAULT_DAMPING = 0.85;
const DEFAULT_PR_ITER = 40;
const DEFAULT_PR_EPSILON = 1e-6;

const SKIPPED_DIRS = new Set([
  "node_modules", ".next", "dist", "build", ".git", "coverage",
  ".turbo", ".cache", "out", "artifacts", ".vercel",
]);

const INDEXABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

// ── Regex extraction (honest boundary: not full parser) ──────────────────

const RE_FN = /^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm;
const RE_CLASS = /^\s*export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm;
const RE_INTERFACE = /^\s*export\s+interface\s+([A-Za-z_$][\w$]*)/gm;
const RE_TYPE = /^\s*export\s+type\s+([A-Za-z_$][\w$]*)/gm;
const RE_CONST = /^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
const RE_IMPORT = /^\s*import\s+(?:[^"'\n]+?\s+from\s+)?["']([^"'\n]+)["']/gm;
const RE_NAMED_IMPORT = /^\s*import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["'][^"'\n]+["']/gm;

// ── Core scan ────────────────────────────────────────────────────────────

export function compileRepoWorldModel(input: RepoWorldModelInput): RepoWorldModel {
  const repo_root = path.resolve(input.repo_root);
  if (!existsSync(repo_root)) {
    throw new Error(`repo_root does not exist: ${repo_root}`);
  }

  const allowed = input.allowed_root_prefixes ?? DEFAULT_ALLOWED_PREFIXES;
  const max_files = Math.min(input.max_files_scanned ?? DEFAULT_MAX_FILES, HARD_MAX_FILES);
  const max_bytes = input.max_content_bytes_per_file ?? DEFAULT_MAX_CONTENT_BYTES;
  const damping = input.pagerank_damping ?? DEFAULT_DAMPING;
  const iterations = input.pagerank_iterations ?? DEFAULT_PR_ITER;
  const epsilon = input.pagerank_convergence_epsilon ?? DEFAULT_PR_EPSILON;

  const input_digest = createHash("sha256")
    .update(JSON.stringify({
      repo_root, allowed, max_files, max_bytes, damping, iterations, epsilon,
      version: REPO_WORLD_MODEL_VERSION,
    }))
    .digest("hex")
    .slice(0, 16);

  // Walk filesystem deterministically
  const collected: string[] = [];
  let directories_walked = 0;
  let bounded_by = "under_cap";

  function walk(abs_dir: string): void {
    if (collected.length >= max_files) {
      bounded_by = "max_files_cap";
      return;
    }
    directories_walked += 1;
    let entries: string[];
    try {
      entries = readdirSync(abs_dir).sort();
    } catch {
      return;
    }
    for (const entry of entries) {
      if (collected.length >= max_files) return;
      if (SKIPPED_DIRS.has(entry)) continue;
      const abs = path.join(abs_dir, entry);
      let stat;
      try { stat = statSync(abs); } catch { continue; }
      if (stat.isDirectory()) {
        walk(abs);
      } else if (stat.isFile()) {
        const ext = path.extname(entry);
        if (!INDEXABLE_EXTENSIONS.has(ext)) continue;
        collected.push(abs);
      }
    }
  }

  for (const prefix of allowed) {
    const root = path.join(repo_root, prefix);
    if (existsSync(root)) walk(root);
  }

  // Extract per-file symbols + refs
  const files: FileNode[] = [];
  const symbol_to_defining_file: Record<string, string[]> = {};
  let total_symbols_defined = 0;
  let total_references_captured = 0;

  for (const abs of collected) {
    const rel = path.relative(repo_root, abs).replace(/\\/g, "/");
    let content: string;
    try {
      const buf = readFileSync(abs);
      content = buf.slice(0, max_bytes).toString("utf8");
    } catch {
      continue;
    }
    const file_size_bytes = content.length;

    const defined: SymbolDefinition[] = [];
    for (const [re, kind] of [
      [RE_FN, "function"], [RE_CLASS, "class"], [RE_INTERFACE, "interface"],
      [RE_TYPE, "type"], [RE_CONST, "const"],
    ] as const) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const line_number = content.slice(0, m.index).split("\n").length;
        defined.push({ name: m[1], kind, line_number });
      }
    }
    total_symbols_defined += defined.length;
    for (const d of defined) {
      if (!symbol_to_defining_file[d.name]) symbol_to_defining_file[d.name] = [];
      symbol_to_defining_file[d.name].push(rel);
    }

    // Named imports = references
    const referenced: SymbolReference[] = [];
    const imports_paths: string[] = [];
    RE_IMPORT.lastIndex = 0;
    let im: RegExpExecArray | null;
    while ((im = RE_IMPORT.exec(content)) !== null) {
      imports_paths.push(im[1]);
    }
    RE_NAMED_IMPORT.lastIndex = 0;
    let nm: RegExpExecArray | null;
    while ((nm = RE_NAMED_IMPORT.exec(content)) !== null) {
      const line_number = content.slice(0, nm.index).split("\n").length;
      const names = nm[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim())
        .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s));
      for (const name of names) {
        referenced.push({ name, line_number });
      }
    }
    total_references_captured += referenced.length;

    files.push({
      repo_relative_path: rel,
      defined_symbols: defined.sort((a, b) => a.name.localeCompare(b.name)),
      referenced_symbols: referenced.sort((a, b) => a.name.localeCompare(b.name)),
      imports_paths: [...new Set(imports_paths)].sort(),
      file_size_bytes,
    });
  }

  files.sort((a, b) => a.repo_relative_path.localeCompare(b.repo_relative_path));

  // Build graph edges: file A references file B when A imports a symbol B defines.
  // Edge weight = count of distinct referenced symbols A → B.
  const edge_key_to_weight = new Map<string, { from: string; to: string; weight: number }>();
  for (const fnode of files) {
    const ref_counts = new Map<string, number>();
    for (const ref of fnode.referenced_symbols) {
      const defs = symbol_to_defining_file[ref.name];
      if (!defs || defs.length === 0) continue;
      // Attribute to first alphabetically to keep deterministic when symbol
      // is defined in multiple files (rare but possible)
      const target = defs[0];
      if (target === fnode.repo_relative_path) continue;  // no self-edges
      ref_counts.set(target, (ref_counts.get(target) ?? 0) + 1);
    }
    for (const [to, weight] of ref_counts) {
      const key = `${fnode.repo_relative_path}=>${to}`;
      edge_key_to_weight.set(key, { from: fnode.repo_relative_path, to, weight });
    }
  }
  const graph_edges = [...edge_key_to_weight.values()]
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  // Deterministic PageRank
  const { scores, converged, iterations_used } = computePageRank(
    files.map((f) => f.repo_relative_path),
    graph_edges,
    damping,
    iterations,
    epsilon,
  );

  return {
    version: REPO_WORLD_MODEL_VERSION,
    input_digest,
    compiled_at_iso: new Date().toISOString(),
    files,
    symbol_to_defining_file: Object.fromEntries(
      Object.entries(symbol_to_defining_file).map(([k, v]) => [k, [...v].sort()]),
    ),
    graph_edges,
    pagerank: scores,
    pagerank_converged: converged,
    pagerank_iterations_used: iterations_used,
    stats: {
      files_scanned: collected.length,
      files_indexed: files.length,
      directories_walked,
      total_symbols_defined,
      total_references_captured,
      bounded_by,
    },
    reproducibility: {
      prng_seed: createHash("sha256").update(input_digest + "|pagerank").digest("hex").slice(0, 16),
      zero_llm: true,
      deterministic: true,
    },
    ledger: "B",
  };
}

// ── Deterministic PageRank ───────────────────────────────────────────────

export function computePageRank(
  nodes: readonly string[],
  edges: readonly { from: string; to: string; weight: number }[],
  damping: number,
  max_iterations: number,
  epsilon: number,
): { scores: Record<string, number>; converged: boolean; iterations_used: number } {
  const n = nodes.length;
  if (n === 0) return { scores: {}, converged: true, iterations_used: 0 };

  // Build outgoing weight sums
  const out_weight: Record<string, number> = Object.fromEntries(nodes.map((k) => [k, 0]));
  const incoming: Record<string, { from: string; weight: number }[]> =
    Object.fromEntries(nodes.map((k) => [k, [] as { from: string; weight: number }[]]));
  for (const e of edges) {
    if (!(e.from in out_weight) || !(e.to in incoming)) continue;
    out_weight[e.from] += e.weight;
    incoming[e.to].push({ from: e.from, weight: e.weight });
  }

  let scores: Record<string, number> = Object.fromEntries(nodes.map((k) => [k, 1 / n]));
  let converged = false;
  let iterations_used = 0;

  for (let iter = 0; iter < max_iterations; iter++) {
    iterations_used = iter + 1;
    const next: Record<string, number> = Object.fromEntries(nodes.map((k) => [k, (1 - damping) / n]));

    // Distribute dangling mass (nodes with no outgoing edges) uniformly
    let dangling_mass = 0;
    for (const k of nodes) {
      if (out_weight[k] === 0) dangling_mass += scores[k];
    }
    const dangling_add = (damping * dangling_mass) / n;
    for (const k of nodes) next[k] += dangling_add;

    for (const k of nodes) {
      let contribution = 0;
      for (const { from, weight } of incoming[k]) {
        const share = weight / out_weight[from];
        contribution += scores[from] * share;
      }
      next[k] += damping * contribution;
    }

    // Convergence check
    let delta = 0;
    for (const k of nodes) delta += Math.abs(next[k] - scores[k]);
    scores = next;
    if (delta < epsilon) {
      converged = true;
      break;
    }
  }

  // Normalise (defensive · sum should be ~1 already)
  let sum = 0;
  for (const k of nodes) sum += scores[k];
  if (sum > 0) for (const k of nodes) scores[k] = scores[k] / sum;

  return { scores, converged, iterations_used };
}

// ── Relevance ranking ────────────────────────────────────────────────────

export function rankFilesByRelevance(input: RelevanceRankingInput): readonly RankedFile[] {
  const { model, concepts } = input;
  const max_results = input.max_results ?? 15;
  const pr_weight = input.pagerank_weight ?? 0.5;
  const cm_weight = input.concept_match_weight ?? 0.5;

  const concept_set = new Set(concepts.map((c) => c.toLowerCase()));
  const ranked: RankedFile[] = [];

  for (const fnode of model.files) {
    const rel_lower = fnode.repo_relative_path.toLowerCase();
    const matched: string[] = [];
    let path_hits = 0;
    let symbol_hits = 0;
    let reference_hits = 0;

    for (const c of concept_set) {
      if (rel_lower.includes(c)) {
        matched.push(c);
        path_hits += 1;
      }
    }
    for (const sd of fnode.defined_symbols) {
      const nl = sd.name.toLowerCase();
      for (const c of concept_set) {
        if (nl.includes(c)) {
          symbol_hits += 1;
          if (!matched.includes(c)) matched.push(c);
        }
      }
    }
    for (const rr of fnode.referenced_symbols) {
      const nl = rr.name.toLowerCase();
      for (const c of concept_set) {
        if (nl.includes(c)) {
          reference_hits += 1;
        }
      }
    }

    const cm_score = path_hits * 3 + symbol_hits * 2 + reference_hits * 1;
    const pr_score = model.pagerank[fnode.repo_relative_path] ?? 0;
    if (cm_score === 0 && pr_score === 0) continue;

    // Normalise concept_match against max possible bonus (light)
    const cm_norm = cm_score / (1 + cm_score);

    const relevance = cm_weight * cm_norm + pr_weight * pr_score;

    const reasons: string[] = [];
    if (path_hits > 0) reasons.push(`path_matches=${path_hits}`);
    if (symbol_hits > 0) reasons.push(`symbol_matches=${symbol_hits}`);
    if (reference_hits > 0) reasons.push(`reference_matches=${reference_hits}`);
    if (pr_score > 0) reasons.push(`pagerank=${pr_score.toFixed(6)}`);

    ranked.push({
      repo_relative_path: fnode.repo_relative_path,
      relevance_score: relevance,
      concept_match_score: cm_score,
      pagerank_score: pr_score,
      matched_concepts: matched.sort(),
      reasons,
    });
  }

  ranked.sort((a, b) =>
    b.relevance_score - a.relevance_score ||
    b.concept_match_score - a.concept_match_score ||
    a.repo_relative_path.localeCompare(b.repo_relative_path),
  );

  return ranked.slice(0, max_results);
}
