// NEX Storage · JSONL adapter (reference implementation)
//
// Implements the StorageBackend interface using per-collection JSONL files
// under `data/nex-storage/{collection}.jsonl`. This is the CANONICAL
// implementation — every future adapter (Postgres, SQLite, S3) must match
// this behaviour exactly, or the abstraction has failed.
//
// SEMANTICS
// · Append-only writes
// · latestPerKey() = last snapshot per keyField value wins
// · query() returns raw rows (no collapse)
// · Filesystem paths are deterministic and never referenced outside this file
//
// The old per-service paths (data/nex-events/, data/nex-jobs/, etc.) will
// be migrated onto this new layout during Week 1 pilot. Until then this
// adapter uses its own path prefix and is only wired up where we explicitly
// choose to route through it.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { CollectionStats, QueryFilter, StorageBackend, StorageBackendCapabilities } from "../types";

const ROOT = path.join(process.cwd(), "data", "nex-storage");

// ── Legacy path map ──────────────────────────────────────────────
// Services that predate the storage abstraction still write to their old
// per-service paths. We route reads/writes through those paths so no data
// moves during the Week 1 pilot — the migration to `data/nex-storage/` will
// happen alongside the Postgres cutover (Week 3+) with dual-write + parity.
//
// Add an entry here as each service is migrated through the abstraction.
// Empty map = every new collection defaults to `data/nex-storage/{name}.jsonl`.
const LEGACY_PATHS: Record<string, string> = {
  events: path.join(process.cwd(), "data", "nex-events", "events.jsonl"),
};

function fileFor(collection: string): string {
  return LEGACY_PATHS[collection] ?? path.join(ROOT, `${collection}.jsonl`);
}

function dirFor(collection: string): string {
  return path.dirname(fileFor(collection));
}

async function ensureDir(collection: string): Promise<void> {
  await fs.mkdir(dirFor(collection), { recursive: true });
}

async function readAll<T>(collection: string): Promise<T[]> {
  const file = fileFor(collection);
  let raw: string;
  try { raw = await fs.readFile(file, "utf8"); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: T[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try { out.push(JSON.parse(line) as T); } catch { /* skip malformed line · tolerant read */ }
  }
  return out;
}

function applyWhere<T>(records: T[], where: Record<string, unknown> | undefined): T[] {
  if (!where || Object.keys(where).length === 0) return records;
  return records.filter((r) => {
    for (const [k, v] of Object.entries(where)) {
      if ((r as Record<string, unknown>)[k] !== v) return false;
    }
    return true;
  });
}

function applySince<T>(records: T[], since: string | undefined): T[] {
  if (!since) return records;
  return records.filter((r) => {
    const rec = r as Record<string, unknown>;
    // Try common timestamp field names in order
    const t = (rec.updated_at ?? rec.created_at ?? rec.occurred_at ?? rec.timestamp ?? rec.at ?? rec.decided_at ?? rec.ingested_at) as string | undefined;
    return typeof t === "string" ? t >= since : true;   // if no timestamp field, don't filter it out
  });
}

function applySort<T>(records: T[], order_by: string | undefined, order_dir: "asc" | "desc" = "desc"): T[] {
  if (!order_by) {
    // Default sort by whatever timestamp exists
    return records.sort((a, b) => {
      const ra = a as Record<string, unknown>;
      const rb = b as Record<string, unknown>;
      const ta = (ra.updated_at ?? ra.created_at ?? ra.occurred_at ?? ra.timestamp ?? ra.at ?? "") as string;
      const tb = (rb.updated_at ?? rb.created_at ?? rb.occurred_at ?? rb.timestamp ?? rb.at ?? "") as string;
      return order_dir === "asc" ? ta.localeCompare(tb) : tb.localeCompare(ta);
    });
  }
  return records.sort((a, b) => {
    const av = String((a as Record<string, unknown>)[order_by] ?? "");
    const bv = String((b as Record<string, unknown>)[order_by] ?? "");
    return order_dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });
}

export class JsonlStorage implements StorageBackend {
  readonly name = "jsonl";

  // Contract §14 · declared capabilities (honest defaults for a
  // line-oriented file backend · every operation is O(N) scan).
  readonly capabilities: StorageBackendCapabilities = {
    efficientLatestPerKey: false,   // Map collapse in memory
    atomicMultiWrite: false,        // no cross-file transactions
    jsonPathQueries: false,         // emulated via JS filter on top-level fields only
    fullTextSearch: false,
    vectorSearch: false,
  };

  async save<T>(collection: string, record: T): Promise<void> {
    await ensureDir(collection);
    await fs.appendFile(fileFor(collection), JSON.stringify(record) + "\n", "utf8");
  }

  async load<T>(collection: string, id: string): Promise<T | null> {
    // For append-only stores we return the LATEST snapshot matching any
    // field commonly used as primary key.
    const records = await readAll<T>(collection);
    const idFields = ["id", `${collection.replace(/s$/, "")}_id`, "record_id", "event_id", "chunk_id", "run_id", "attempt_id", "job_id", "contact_id", "rule_id", "review_id", "memory_id", "edge_id", "document_id"];
    let match: T | null = null;
    for (const r of records) {
      const rec = r as Record<string, unknown>;
      for (const f of idFields) {
        if (rec[f] === id) { match = r; break; }
      }
    }
    return match;
  }

  async latestPerKey<T>(collection: string, keyField: string, filter?: QueryFilter): Promise<T[]> {
    let records = await readAll<T>(collection);
    records = applyWhere(records, filter?.where);
    records = applySince(records, filter?.since);
    const latest = new Map<string, T>();
    for (const r of records) {
      const key = String((r as Record<string, unknown>)[keyField]);
      latest.set(key, r);   // last write wins because we iterate in file order
    }
    const out = [...latest.values()];
    const sorted = applySort(out, filter?.order_by, filter?.order_dir ?? "desc");
    const limit = Math.min(filter?.limit ?? 100, 10000);
    return sorted.slice(0, limit);
  }

  async query<T>(collection: string, filter?: QueryFilter): Promise<T[]> {
    let records = await readAll<T>(collection);
    records = applyWhere(records, filter?.where);
    records = applySince(records, filter?.since);
    records = applySort(records, filter?.order_by, filter?.order_dir ?? "desc");
    const limit = Math.min(filter?.limit ?? 100, 10000);
    return records.slice(0, limit);
  }

  async count(collection: string, filter?: QueryFilter): Promise<number> {
    let records = await readAll<Record<string, unknown>>(collection);
    records = applyWhere(records, filter?.where);
    records = applySince(records, filter?.since);
    return records.length;
  }

  async stats(collection: string): Promise<CollectionStats> {
    const file = fileFor(collection);
    let size_bytes = 0;
    let latest_write_at: string | null = null;
    try {
      const s = await fs.stat(file);
      size_bytes = s.size;
      latest_write_at = s.mtime.toISOString();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    const total_records = await this.count(collection);
    return { total_records, latest_write_at, size_bytes };
  }
}
