// KPE Stage 6 · Duplicate Detection
//
// Two-tier check:
//   · Exact: content_hash match against prior documents
//   · Near:  5-gram Jaccard similarity ≥ 0.85 against prior documents
//
// No AI. Both tiers deterministic. Reference implementation reads all prior
// documents from the KPE store on each check — fine at MVP volume, will
// need LSH bucketing in Phase 2 (Postgres pgvector or dedicated MinHash lib).

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  DuplicateInput, DuplicateOutput, DuplicateRecord,
  PipelineStage, DocumentRecord,
} from "../types";

const DOCS_FILE = path.join(process.cwd(), "data", "nex-kpe", "documents.jsonl");

async function readPriorDocuments(): Promise<DocumentRecord[]> {
  try {
    const raw = await fs.readFile(DOCS_FILE, "utf8");
    const latest = new Map<string, DocumentRecord>();
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try { const d = JSON.parse(line) as DocumentRecord; latest.set(d.document_id, d); }
      catch { /* skip malformed */ }
    }
    return [...latest.values()];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

function shingles(s: string, k = 5): Set<string> {
  const tokens = s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out = new Set<string>();
  for (let i = 0; i <= tokens.length - k; i++) {
    out.add(tokens.slice(i, i + k).join(" "));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Read chunks store to reconstruct content for near-dup comparison. */
async function readPriorContentByDocId(): Promise<Map<string, string>> {
  const chunksFile = path.join(process.cwd(), "data", "nex-kpe", "chunks.jsonl");
  const map = new Map<string, string[]>();
  try {
    const raw = await fs.readFile(chunksFile, "utf8");
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try {
        const c = JSON.parse(line) as { document_id: string; content: string };
        const list = map.get(c.document_id) ?? [];
        list.push(c.content);
        map.set(c.document_id, list);
      } catch { /* skip */ }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  const merged = new Map<string, string>();
  for (const [id, chunks] of map) merged.set(id, chunks.join("\n"));
  return merged;
}

export const DuplicateStage: PipelineStage<DuplicateInput, DuplicateOutput> = {
  name: "duplicate",
  version: "1.0.0",
  async run(input: DuplicateInput): Promise<DuplicateOutput> {
    const priors = await readPriorDocuments();
    const now = new Date().toISOString();

    // Tier 1 · exact hash match
    const exact = priors.find((d) => d.content_hash === input.document.content_hash
      && d.document_id !== input.document.document_id);
    if (exact) {
      return {
        document_level: {
          chunk_id: input.document.document_id,          // doc-level dup uses doc id
          matched_chunk_id: exact.document_id,
          similarity: 1,
          match_type: "exact",
          detected_at: now,
        },
        is_duplicate: true,
      };
    }

    // Tier 2 · near-dup via shingle Jaccard against reconstructed prior content
    const priorContent = await readPriorContentByDocId();
    const thisShingles = shingles(input.normalised_content);
    let best: { doc: DocumentRecord; sim: number } | null = null;
    for (const prior of priors) {
      const priorText = priorContent.get(prior.document_id);
      if (!priorText) continue;
      const sim = jaccard(thisShingles, shingles(priorText));
      if (!best || sim > best.sim) best = { doc: prior, sim };
    }

    if (best && best.sim >= 0.85) {
      return {
        document_level: {
          chunk_id: input.document.document_id,
          matched_chunk_id: best.doc.document_id,
          similarity: Math.round(best.sim * 1000) / 1000,
          match_type: "near",
          detected_at: now,
        },
        is_duplicate: true,
      };
    }
    return { document_level: null, is_duplicate: false };
  },
};
