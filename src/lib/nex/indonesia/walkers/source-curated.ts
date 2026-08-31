// source-curated · Walker #1.
//
// Reads hand-curated fact files from data/indonesia/sources/curated/
// and yields them as RawFactChunks. This is the reference walker —
// it proves the acquisition pipeline works end-to-end with a real
// source. Later walkers (HTTP-based, embassy pages, tourism-ministry
// feeds) implement the same KnowledgeWalker interface and drop into
// the same pipeline.
//
// The source files are versioned JSON; each entry is already very
// close to a RawFactChunk. This walker's job is just to load and
// validate — the pipeline handles enrichment.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { KnowledgeWalker, RawFactChunk, KnowledgeDomain } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const CURATED_DIR = path.resolve(here, "../../../../../data/indonesia/sources/curated");

export type SourceCuratedOptions = {
  /** Override curated directory · used in tests. */
  dir?: string;
};

export function createCuratedSourceWalker(opts: SourceCuratedOptions = {}): KnowledgeWalker {
  const dir = opts.dir ?? CURATED_DIR;

  return {
    id: "curated:seed",
    domain: "practical", // heterogeneous · pipeline uses per-chunk domain
    defaultStability: "stable",
    description: "Hand-curated Indonesia knowledge (JSON files in data/indonesia/sources/curated/).",
    refreshCadenceDays: 180, // seed data verified twice a year
    async acquire(): Promise<RawFactChunk[]> {
      const files = safeList(dir).filter((f) => f.endsWith(".json"));
      const out: RawFactChunk[] = [];
      for (const f of files) {
        const raw = safeReadJson(path.join(dir, f));
        if (!Array.isArray(raw)) continue;
        for (const entry of raw) {
          if (!isValidRawEntry(entry)) continue;
          out.push(entry as RawFactChunk);
        }
      }
      return out;
    },
  };
}

function safeList(dir: string): string[] {
  try { return readdirSync(dir); }
  catch { return []; }
}

function safeReadJson(file: string): unknown {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch { return null; }
}

const VALID_DOMAINS: KnowledgeDomain[] = ["places", "landmark", "food", "culture", "practical", "safety", "experience"];

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
