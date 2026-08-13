// KPE · Filesystem persistence
//
// Append-only JSONL for MVP. Every write is safe (fire-and-forget wrapper
// available). Postgres migration is a straight lift-and-shift when volume
// justifies (per the Chief Systems Architect storage plan on file).

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  DocumentRecord, ChunkRecord, MetadataRecord, DuplicateRecord,
  DecisionRecord, EdgeRecord, ProcessingRun,
} from "../types";

const ROOT = path.join(process.cwd(), "data", "nex-kpe");
const FILES = {
  documents:  path.join(ROOT, "documents.jsonl"),
  chunks:     path.join(ROOT, "chunks.jsonl"),
  metadata:   path.join(ROOT, "metadata.jsonl"),
  duplicates: path.join(ROOT, "duplicates.jsonl"),
  decisions:  path.join(ROOT, "decisions.jsonl"),
  edges:      path.join(ROOT, "edges.jsonl"),
  runs:       path.join(ROOT, "processing_runs.jsonl"),
};

async function ensureDir(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
}

async function appendLine(file: string, obj: unknown): Promise<void> {
  await ensureDir();
  await fs.appendFile(file, JSON.stringify(obj) + "\n", "utf8");
}

export const store = {
  async saveDocument(d: DocumentRecord): Promise<void>            { return appendLine(FILES.documents, d); },
  async saveChunks(chunks: ChunkRecord[]): Promise<void>          { for (const c of chunks) await appendLine(FILES.chunks, c); },
  async saveMetadata(m: MetadataRecord): Promise<void>            { return appendLine(FILES.metadata, m); },
  async saveDuplicates(dupes: DuplicateRecord[]): Promise<void>   { for (const d of dupes) await appendLine(FILES.duplicates, d); },
  async saveDecisions(ds: DecisionRecord[]): Promise<void>        { for (const d of ds) await appendLine(FILES.decisions, d); },
  async saveEdges(edges: EdgeRecord[]): Promise<void>             { for (const e of edges) await appendLine(FILES.edges, e); },
  async saveRun(run: ProcessingRun): Promise<void>                { return appendLine(FILES.runs, run); },

  async readRuns(limit = 50): Promise<ProcessingRun[]> {
    let raw: string;
    try { raw = await fs.readFile(FILES.runs, "utf8"); }
    catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return []; throw err; }
    const latest = new Map<string, ProcessingRun>();
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try { const r = JSON.parse(line) as ProcessingRun; latest.set(r.run_id, r); }
      catch { /* skip */ }
    }
    return [...latest.values()]
      .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
      .slice(0, limit);
  },
};
