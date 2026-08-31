// config-walker · turns a JSON walker-config into a KnowledgeWalker.
//
// This is the mechanism that makes "adding a walker = writing a
// config, not writing code". Configs live in
//   data/indonesia/walker-configs/{taxonomy_id}.json
// and reference source files in
//   data/indonesia/sources/{sourceDir}/*.json
//
// The pipeline (pipeline.ts) is unchanged — it consumes any
// KnowledgeWalker produced by this adapter and applies the same
// validation, dedupe, Q&A generation, and provenance.
//
// A config looks like:
// {
//   "taxonomyId": "walker.culture.festivals_ceremonies",
//   "sourceDir": "festivals_ceremonies",
//   "defaultStability": "seasonal",
//   "refreshCadenceDays": 30,
//   "description": "Indonesian festival + ceremony calendar."
// }
//
// The source files under data/indonesia/sources/{sourceDir}/ are
// standard RawFactChunk arrays (same shape as
// data/indonesia/sources/curated/*.json).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { KnowledgeWalker, RawFactChunk, KnowledgeDomain } from "./types";
import type { KnowledgeStability } from "../knowledge";
import { findWalkerSpec } from "./taxonomy";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "../../../../..");
const CONFIG_DIR = path.resolve(REPO_ROOT, "data/indonesia/walker-configs");
const SOURCES_ROOT = path.resolve(REPO_ROOT, "data/indonesia/sources");

export type WalkerConfig = {
  /** Must reference a taxonomy entry — enforced at construction. */
  taxonomyId: string;
  /** Sub-directory under data/indonesia/sources/ · e.g. "festivals_ceremonies". */
  sourceDir: string;
  defaultStability: KnowledgeStability;
  refreshCadenceDays: number;
  description: string;
  /** Optional override · defaults to the taxonomy branch → KnowledgeDomain map. */
  domain?: KnowledgeDomain;
};

const VALID_DOMAINS: KnowledgeDomain[] = ["places", "landmark", "food", "culture", "practical", "safety", "experience"];

/** Load every walker-config JSON file and produce a list of
 *  KnowledgeWalker instances the pipeline can run. Silently skips
 *  configs that reference an unknown taxonomy ID (the taxonomy
 *  Guardian suite catches those separately). */
export function loadConfigWalkers(dir: string = CONFIG_DIR): KnowledgeWalker[] {
  if (!existsSync(dir)) return [];
  const walkers: KnowledgeWalker[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const raw = readSafeJson(path.join(dir, file));
    if (!isValidConfig(raw)) continue;
    const spec = findWalkerSpec(raw.taxonomyId);
    if (!spec) continue; // taxonomy check enforces registration
    walkers.push(createWalkerFromConfig(raw, spec.branch));
  }
  return walkers;
}

/** Same but for a specific config file · used by tests + CLI. */
export function loadSingleConfigWalker(configPath: string): KnowledgeWalker | null {
  const raw = readSafeJson(configPath);
  if (!isValidConfig(raw)) return null;
  const spec = findWalkerSpec(raw.taxonomyId);
  if (!spec) return null;
  return createWalkerFromConfig(raw, spec.branch);
}

// ─── Internals ────────────────────────────────────────────────────

function createWalkerFromConfig(config: WalkerConfig, branch: string): KnowledgeWalker {
  const sourceSubdir = path.join(SOURCES_ROOT, config.sourceDir);
  const domain: KnowledgeDomain = config.domain ?? branchToDomain(branch);

  return {
    id: config.taxonomyId,
    domain,
    defaultStability: config.defaultStability,
    description: config.description,
    refreshCadenceDays: config.refreshCadenceDays,
    async acquire(): Promise<RawFactChunk[]> {
      if (!existsSync(sourceSubdir)) return [];
      const out: RawFactChunk[] = [];
      for (const f of readdirSync(sourceSubdir)) {
        if (!f.endsWith(".json")) continue;
        const raw = readSafeJson(path.join(sourceSubdir, f));
        if (!Array.isArray(raw)) continue;
        for (const entry of raw) if (isValidRawEntry(entry)) out.push(entry as RawFactChunk);
      }
      return out;
    },
  };
}

function branchToDomain(branch: string): KnowledgeDomain {
  switch (branch) {
    case "destinations": return "landmark";
    case "culture":      return "culture";
    case "spiritual":    return "culture";  // spiritual maps to culture domain; taxonomy carries the finer distinction
    case "adat":         return "culture";
    case "food":         return "food";
    case "travel":       return "practical";
    case "safety":       return "safety";
    case "resident":     return "practical";
    default:             return "practical";
  }
}

function readSafeJson(file: string): unknown {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch { return null; }
}

function isValidConfig(x: unknown): x is WalkerConfig {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.taxonomyId === "string" &&
    typeof o.sourceDir === "string" &&
    typeof o.defaultStability === "string" &&
    typeof o.refreshCadenceDays === "number" &&
    typeof o.description === "string"
  );
}

function isValidRawEntry(x: unknown): x is RawFactChunk {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.externalId === "string" &&
    typeof o.domain === "string" &&
    VALID_DOMAINS.includes(o.domain as KnowledgeDomain) &&
    typeof o.topic === "string" &&
    typeof o.region === "string" &&
    typeof o.content === "string" &&
    Array.isArray(o.keywords) &&
    typeof o.observedAt === "string" &&
    typeof o.source === "string"
  );
}
