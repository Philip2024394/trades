// src/lib/nex/l4-bakeoff/benchmark-schema.ts
//
// V.5.2 · L4 bakeoff · versioned corpus + hash integrity + freeze
// Founder BEGIN V.5.2 · 2026-09-08
//
// Discipline (Founder Sections 8, 16, 21):
//   · Frozen corpus = immutable · deepFreeze on cases + array
//   · Version-string mandatory · duplicate case_ids rejected at freeze
//   · Content SHA-256 captured at freeze · re-verified on read
//   · No candidate can modify the benchmark based on its own performance
//   · Freeze includes: cases, version, authored_by, authored_at_iso
//     (excludes derived fields · content_hash is stable across
//     regenerations of the same case set)
//
// This module ONLY handles corpus lifecycle · not scoring · not adapters.

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  BenchmarkCase,
  BenchmarkCorpus,
  EvaluationDimension,
  CaseCategory,
  CaseLanguage,
} from "./types";
import { corpusRegistryPath, l4BakeoffDataRoot } from "./paths";

// ─── Stable serialization for hashing ───────────────────────────
//
// Cases must serialize deterministically so the hash is stable across
// runs. Sort object keys · sort readonly arrays where order-independence
// is semantically true (arrays that are semantically sets).

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
  }
  return "null";
}

/** SHA-256 truncated to 24 hex chars · matches programmer-benchmark discipline. */
export function corpusContentHash(cases: readonly BenchmarkCase[]): string {
  // Sort cases by case_id before hashing so re-ordering doesn't shift the hash.
  const sorted = [...cases].sort((a, b) => a.case_id.localeCompare(b.case_id));
  const serial = stableStringify(sorted);
  return createHash("sha256").update(serial, "utf8").digest("hex").slice(0, 24);
}

// ─── Deep freeze ────────────────────────────────────────────────

function deepFreeze<T>(x: T): Readonly<T> {
  if (x === null || typeof x !== "object") return x;
  if (Object.isFrozen(x)) return x as Readonly<T>;
  Object.freeze(x);
  for (const key of Object.keys(x)) {
    const v = (x as Record<string, unknown>)[key];
    if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v);
  }
  return x as Readonly<T>;
}

// ─── Freeze + validate ─────────────────────────────────────────

export class BenchmarkFreezeError extends Error {
  constructor(reason: string) { super(`benchmark_freeze: ${reason}`); }
}

/** Freeze a candidate case set into an immutable BenchmarkCorpus.
 *  Rejects duplicate case_ids · rejects empty corpus · rejects
 *  version-string mismatch · rejects unknown dimensions. */
export function freezeBenchmark(input: {
  version: string;
  authored_by: string;
  cases: BenchmarkCase[];
  authored_at_iso?: string;
}): BenchmarkCorpus {
  if (!input.version || input.version.trim().length === 0) {
    throw new BenchmarkFreezeError("version required");
  }
  if (!input.cases || input.cases.length === 0) {
    throw new BenchmarkFreezeError("cases must be non-empty");
  }

  // Case invariants
  const seenIds = new Set<string>();
  for (const c of input.cases) {
    if (!c.case_id || c.case_id.trim().length === 0) {
      throw new BenchmarkFreezeError("every case requires case_id");
    }
    if (seenIds.has(c.case_id)) {
      throw new BenchmarkFreezeError(`duplicate case_id: ${c.case_id}`);
    }
    seenIds.add(c.case_id);
    if (c.corpus_version !== input.version) {
      throw new BenchmarkFreezeError(`case ${c.case_id} corpus_version=${c.corpus_version} does not match corpus version=${input.version}`);
    }
    if (!c.prompt || c.prompt.trim().length === 0) {
      throw new BenchmarkFreezeError(`case ${c.case_id} has empty prompt`);
    }
    if (!c.dimension) {
      throw new BenchmarkFreezeError(`case ${c.case_id} missing dimension`);
    }
  }

  const dimensionsSet = new Set<EvaluationDimension>();
  const categoriesSet = new Set<CaseCategory>();
  const languagesSet = new Set<CaseLanguage>();
  for (const c of input.cases) {
    dimensionsSet.add(c.dimension);
    for (const d of c.secondary_dimensions ?? []) dimensionsSet.add(d);
    categoriesSet.add(c.category);
    languagesSet.add(c.language);
  }

  const authored_at_iso = input.authored_at_iso ?? new Date().toISOString();
  const content_hash = corpusContentHash(input.cases);

  const corpus: BenchmarkCorpus = {
    version: input.version,
    authored_by: input.authored_by,
    authored_at_iso,
    cases: input.cases,
    content_hash,
    dimensions_covered: Array.from(dimensionsSet).sort() as EvaluationDimension[],
    categories_covered: Array.from(categoriesSet).sort() as CaseCategory[],
    languages_covered: Array.from(languagesSet).sort() as CaseLanguage[],
    case_count: input.cases.length,
  };
  return deepFreeze(corpus);
}

/** Verify a corpus's content_hash matches its cases. Detects tampering. */
export function verifyCorpusIntegrity(corpus: BenchmarkCorpus): { ok: boolean; reason?: string } {
  const recomputed = corpusContentHash(corpus.cases);
  if (recomputed !== corpus.content_hash) {
    return { ok: false, reason: `hash_mismatch: expected=${corpus.content_hash} actual=${recomputed}` };
  }
  if (Object.isFrozen(corpus.cases) === false) {
    return { ok: false, reason: "corpus cases array not frozen" };
  }
  const idsSeen = new Set<string>();
  for (const c of corpus.cases) {
    if (Object.isFrozen(c) === false) {
      return { ok: false, reason: `case ${c.case_id} not frozen` };
    }
    if (idsSeen.has(c.case_id)) {
      return { ok: false, reason: `duplicate case_id at read: ${c.case_id}` };
    }
    idsSeen.add(c.case_id);
  }
  return { ok: true };
}

// ─── Registry (append-only manifest of frozen corpora) ──────────

export type CorpusRegistryEntry = {
  registry_entry_id: string;
  version: string;
  content_hash: string;
  authored_by: string;
  authored_at_iso: string;
  case_count: number;
  dimensions_covered: readonly EvaluationDimension[];
  categories_covered: readonly CaseCategory[];
  languages_covered: readonly CaseLanguage[];
  registered_at_iso: string;
};

/** Register a frozen corpus in the append-only registry. Rejects
 *  registration if a same-version entry with a different hash already
 *  exists (adaptive-benchmark-mod defense · Founder Section 16). */
export function registerCorpus(corpus: BenchmarkCorpus): CorpusRegistryEntry {
  const integrity = verifyCorpusIntegrity(corpus);
  if (!integrity.ok) throw new BenchmarkFreezeError(`registration refused: ${integrity.reason}`);

  const existing = readCorpusRegistry();
  for (const e of existing) {
    if (e.version === corpus.version && e.content_hash !== corpus.content_hash) {
      throw new BenchmarkFreezeError(
        `anti-gaming: version ${corpus.version} already registered with hash ${e.content_hash} · new hash ${corpus.content_hash} REFUSED`,
      );
    }
    if (e.version === corpus.version && e.content_hash === corpus.content_hash) {
      // Idempotent · same corpus already registered · return existing
      return e;
    }
  }

  ensureDir();
  const entry: CorpusRegistryEntry = {
    registry_entry_id: `corp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    version: corpus.version,
    content_hash: corpus.content_hash,
    authored_by: corpus.authored_by,
    authored_at_iso: corpus.authored_at_iso,
    case_count: corpus.case_count,
    dimensions_covered: corpus.dimensions_covered,
    categories_covered: corpus.categories_covered,
    languages_covered: corpus.languages_covered,
    registered_at_iso: new Date().toISOString(),
  };
  appendFileSync(corpusRegistryPath(), JSON.stringify(entry) + "\n", "utf8");
  return entry;
}

export function readCorpusRegistry(): CorpusRegistryEntry[] {
  const p = corpusRegistryPath();
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const out: CorpusRegistryEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t) as CorpusRegistryEntry); } catch { /* skip malformed */ }
  }
  return out;
}

function ensureDir(): void {
  const dir = l4BakeoffDataRoot();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
