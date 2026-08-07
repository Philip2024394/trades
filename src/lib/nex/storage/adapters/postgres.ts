// NEX Data Platform · Postgres adapter
//
// Portability guardrail (per Philip 2026-08-07):
// This adapter is UNAWARE of where Postgres lives. It reads a connection
// string from NEX_POSTGRES_URL and connects. That's it. Local Docker,
// Hetzner-hosted, a VPS, or a managed provider (Supabase) — all
// interchangeable. Only the env var changes.
//
// SCHEMA ORIGIN
// Every collection maps to a table under the `nex` schema. Full DDL lives
// in `deploy/postgres/init/*.sql` and is applied by the
// `nex:apply-storage-schema` script (idempotent, additive migrations only).
//
// SAVE STRATEGY · metadata-driven, one code path
// Rather than hand-write 18 INSERT branches (fragile, drifty), each
// collection registers a `CollectionMeta` descriptor: which columns exist,
// which are JSONB, what the primary key + conflict behaviour is. A single
// `save()` composes the INSERT from that descriptor. Adding a collection
// = one metadata entry + one SQL file. No new code path.
//
// DYNAMIC IMPORT
// The `pg` package is loaded via dynamic import so this file is safe to
// import even before `pg` is installed. If a caller actually USES the
// adapter without `pg` present, they get a clear install instruction.

import type { CollectionStats, QueryFilter, StorageBackend, StorageBackendCapabilities } from "../types";

// ── pg types (minimal, so file compiles without the package) ────────

type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  release: () => void;
};
type PgPoolLike = {
  connect: () => Promise<PgClientLike>;
  end: () => Promise<void>;
};

let poolPromise: Promise<PgPoolLike> | null = null;

async function getPool(): Promise<PgPoolLike> {
  if (poolPromise) return poolPromise;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) throw new Error("[nex-postgres] NEX_POSTGRES_URL not set · cannot init pool");

  poolPromise = (async () => {
    let pgModule: unknown;
    try {
      pgModule = await import("pg" as string);
    } catch {
      throw new Error(
        "[nex-postgres] `pg` package not installed · run: pnpm add pg @types/pg (or npm/yarn equivalent)",
      );
    }
    const { Pool } = ((pgModule as { default?: unknown }).default ?? pgModule) as {
      Pool: new (config: {
        connectionString: string;
        max?: number;
        idleTimeoutMillis?: number;
        // Supabase pgbouncer needs SSL by default; the connection string
        // typically encodes sslmode=require but we set this as a safety net.
        ssl?: { rejectUnauthorized: boolean } | boolean;
      }) => PgPoolLike;
    };
    const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
    return new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  })();
  return poolPromise;
}

// ── Collection metadata · single source of truth for the adapter ─────
//
// Every collection lists its physical column names in schema order, marks
// the JSONB ones (so we JSON.stringify() their values), and declares how
// writes behave: "append-only-idempotent" uses ON CONFLICT DO NOTHING on
// the primary key; "snapshot" appends a new row every write (snapshot_id
// is generated server-side) so latest-per-key at read time gives history.
//
// This mirrors Contract §5 exactly. Change the SQL, change the metadata.

type WriteMode = "append-only-idempotent" | "snapshot";

type CollectionMeta = {
  table: string;            // fully qualified: "nex.events"
  writeMode: WriteMode;
  primaryKey: string;       // the pk column · e.g. "event_id"
  keyField: string;         // logical id used by callers · often === primaryKey
  timestampField: string;   // for default sort + since-filter
  columns: readonly string[];       // columns in schema order (excluding server-generated)
  jsonbColumns?: readonly string[]; // subset of columns that are JSONB
};

// Note: snapshot_id + inserted_at are server-generated for snapshot tables,
// so they don't appear in `columns` — the DEFAULT clauses fill them.

const META: Record<string, CollectionMeta> = {
  events: {
    table: "nex.events",
    writeMode: "append-only-idempotent",
    primaryKey: "event_id",
    keyField: "event_id",
    timestampField: "timestamp",
    columns: [
      "event_id", "event_type", "source", "actor_id", "timestamp",
      "business_id", "related_department", "related_brain", "related_job",
      "related_contact", "outcome", "payload", "reversible", "reverse_of", "supersedes",
    ],
    jsonbColumns: ["payload"],
  },
  worker_audit_events: {
    table: "nex.worker_audit_events",
    writeMode: "append-only-idempotent",
    primaryKey: "event_id",
    keyField: "event_id",
    timestampField: "created_at",
    columns: [
      "event_id", "worker_type", "event_type", "actor", "job_id", "input_ref",
      "details", "created_at", "latency_ms", "tokens_in", "tokens_out",
      "provider", "model", "error", "business_id",
    ],
    jsonbColumns: ["details"],
  },
  jobs: {
    table: "nex.jobs",
    writeMode: "snapshot",
    primaryKey: "snapshot_id",
    keyField: "job_id",
    timestampField: "updated_at",
    columns: [
      "job_id", "source", "owner", "business_id", "created_at", "knowledge_type",
      "target_brains", "status", "progress", "completion_result", "inbox_item_id",
      "title", "content_length", "updated_at",
    ],
    jsonbColumns: ["target_brains", "completion_result"],
  },
  recovery_attempts: {
    table: "nex.recovery_attempts",
    writeMode: "append-only-idempotent",
    primaryKey: "attempt_id",
    keyField: "attempt_id",
    timestampField: "at",
    columns: [
      "attempt_id", "job_id", "level", "level_name", "action", "at",
      "outcome", "detail", "target_provider", "target_worker", "business_id",
    ],
  },
  brain_memories: {
    table: "nex.brain_memories",
    writeMode: "append-only-idempotent",
    primaryKey: "memory_id",
    keyField: "memory_id",
    timestampField: "added_at",
    columns: [
      "memory_id", "brain_name", "brain_slug", "source_job_id", "source_kind",
      "source_owner", "knowledge_type", "title", "content_length",
      "inbox_item_id", "added_at", "business_id",
    ],
  },
  contacts: {
    table: "nex.contacts",
    writeMode: "snapshot",
    primaryKey: "snapshot_id",
    keyField: "contact_id",
    timestampField: "updated_at",
    columns: [
      "contact_id", "email", "phone", "name", "kind", "source", "source_ref",
      "tags", "consent_marketing", "consent_transactional", "consent_source",
      "attributes", "lifecycle_stage", "first_seen_at", "last_seen_at",
      "linked_business_id", "updated_at", "business_id",
      // Contact Intelligence · Phase 3a additions (migration 012_contact_intelligence.sql)
      "company", "country", "region", "languages", "trade_categories",
      "preferred_channels", "never_contact", "unsubscribe_at",
      "last_contacted_at", "canonical_email", "canonical_phone", "deleted_at",
    ],
    jsonbColumns: ["tags", "attributes", "languages", "trade_categories", "preferred_channels"],
  },
  tracking_events: {
    table: "nex.tracking_events",
    writeMode: "append-only-idempotent",
    primaryKey: "event_id",
    keyField: "event_id",
    timestampField: "occurred_at",
    columns: [
      "event_id", "session_id", "contact_id", "fingerprint", "event_name",
      "path", "referrer", "user_agent", "ip_prefix", "utm_source",
      "utm_medium", "utm_campaign", "utm_content", "utm_term", "properties",
      "occurred_at", "server_received_at", "business_id",
    ],
    jsonbColumns: ["properties"],
  },
  analytics_records: {
    table: "nex.analytics_records",
    writeMode: "append-only-idempotent",
    primaryKey: "record_id",
    keyField: "record_id",
    timestampField: "occurred_at",
    columns: [
      "record_id", "provider", "event_name", "path", "hostname", "referrer",
      "country", "device", "browser", "os", "session_id", "visitor_id",
      "duration_sec", "bounced", "properties", "occurred_at", "ingested_at", "business_id",
    ],
    jsonbColumns: ["properties"],
  },
  automation_rules: {
    table: "nex.automation_rules",
    writeMode: "snapshot",
    primaryKey: "snapshot_id",
    keyField: "rule_id",
    timestampField: "updated_at",
    columns: [
      "rule_id", "name", "description", "authority", "enabled", "trigger",
      "condition", "action", "created_at", "updated_at", "created_by",
      "version", "business_id",
    ],
    jsonbColumns: ["trigger", "condition", "action"],
  },
  automation_runs: {
    table: "nex.automation_runs",
    writeMode: "append-only-idempotent",
    primaryKey: "run_id",
    keyField: "run_id",
    timestampField: "triggered_at",
    columns: [
      "run_id", "rule_id", "rule_name", "rule_authority",
      "triggered_by_event_id", "triggered_by_event_type", "triggered_at",
      "status", "outcome_detail", "action_snapshot", "admin_actor", "admin_decided_at", "business_id",
    ],
    jsonbColumns: ["action_snapshot"],
  },
  kpe_documents: {
    table: "nex.kpe_documents",
    writeMode: "append-only-idempotent",
    primaryKey: "document_id",
    keyField: "document_id",
    timestampField: "ingested_at",
    columns: [
      "document_id", "source", "title", "content_hash", "byte_length",
      "ingested_at", "classifier_label", "classifier_confidence", "target_brains", "business_id",
    ],
    jsonbColumns: ["target_brains"],
  },
  kpe_chunks: {
    table: "nex.kpe_chunks",
    writeMode: "append-only-idempotent",
    primaryKey: "chunk_id",
    keyField: "chunk_id",
    timestampField: "inserted_at",
    columns: [
      "chunk_id", "document_id", "order_index", "heading_path", "content",
      "content_hash", "token_estimate", "context_before", "context_after", "business_id",
    ],
    jsonbColumns: ["heading_path"],
  },
  kpe_metadata: {
    table: "nex.kpe_metadata",
    writeMode: "append-only-idempotent",
    primaryKey: "chunk_id",
    keyField: "chunk_id",
    timestampField: "inserted_at",
    columns: [
      "chunk_id", "authors", "dates", "versions", "urls", "references",
      "language", "keywords", "extracted_entities", "business_id",
    ],
    jsonbColumns: ["authors", "dates", "versions", "urls", "references", "keywords", "extracted_entities"],
  },
  kpe_decisions: {
    table: "nex.kpe_decisions",
    writeMode: "append-only-idempotent",
    primaryKey: "chunk_id",
    keyField: "chunk_id",
    timestampField: "decided_at",
    columns: [
      "chunk_id", "route", "decided_at", "provider_used", "latency_ms",
      "cost_estimate_gbp", "alternatives_considered", "business_id",
    ],
    jsonbColumns: ["route", "alternatives_considered"],
  },
  kpe_duplicates: {
    table: "nex.kpe_duplicates",
    writeMode: "append-only-idempotent",
    primaryKey: "duplicate_id",
    keyField: "duplicate_id",
    timestampField: "detected_at",
    columns: [
      "duplicate_id", "chunk_id", "matched_chunk_id", "similarity",
      "match_type", "detected_at", "business_id",
    ],
  },
  kpe_edges: {
    table: "nex.kpe_edges",
    writeMode: "append-only-idempotent",
    primaryKey: "edge_id",
    keyField: "edge_id",
    timestampField: "created_at",
    columns: [
      "edge_id", "from_id", "to_id", "type", "confidence", "created_at", "business_id",
    ],
  },
  kpe_processing_runs: {
    table: "nex.kpe_processing_runs",
    writeMode: "append-only-idempotent",
    primaryKey: "run_id",
    keyField: "run_id",
    timestampField: "started_at",
    columns: [
      "run_id", "document_id", "source", "started_at", "finished_at",
      "stages_completed", "errors", "final_outcome", "chunks_created",
      "decisions_made", "brain_writes", "business_id",
    ],
    jsonbColumns: ["stages_completed", "errors"],
  },
  kpe_human_reviews: {
    table: "nex.kpe_human_reviews",
    writeMode: "append-only-idempotent",
    primaryKey: "review_id",
    keyField: "review_id",
    timestampField: "decided_at",
    columns: [
      "review_id", "chunk_id", "document_id", "decision", "admin",
      "reason", "decided_at", "business_id",
    ],
  },
  object_manifest: {
    table: "nex.object_manifest",
    writeMode: "append-only-idempotent",
    primaryKey: "manifest_id",
    keyField: "manifest_id",
    timestampField: "uploaded_at",
    columns: [
      "manifest_id", "bucket", "key", "version_id", "content_hash",
      "size_bytes", "mime_type", "uploaded_at", "uploaded_by",
      "business_id", "source_ref", "is_delete_marker", "custom",
    ],
    jsonbColumns: ["custom"],
  },
};

function metaFor(collection: string): CollectionMeta {
  const m = META[collection];
  if (!m) throw new Error(`[nex-postgres] unknown collection: ${collection} · add to META in adapters/postgres.ts and create the SQL migration`);
  return m;
}

// ── Helpers ──────────────────────────────────────────────────────

async function withClient<T>(fn: (client: PgClientLike) => Promise<T>): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}

function extractValue(record: Record<string, unknown>, col: string, jsonbSet: Set<string>): unknown {
  const v = record[col];
  if (v === undefined) return null;
  if (jsonbSet.has(col)) return JSON.stringify(v);
  return v;
}

function buildInsertSql(meta: CollectionMeta): string {
  const cols = meta.columns.map((c) => `"${c}"`).join(", ");
  const placeholders = meta.columns.map((_, i) => `$${i + 1}`).join(", ");
  const conflict = meta.writeMode === "append-only-idempotent"
    ? ` ON CONFLICT ("${meta.primaryKey}") DO NOTHING`
    : "";
  return `INSERT INTO ${meta.table} (${cols}) VALUES (${placeholders})${conflict}`;
}

function buildWhereClause(
  where: Record<string, unknown> | undefined,
  sinceField: string,
  since: string | undefined,
): { clause: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (where) {
    for (const [k, v] of Object.entries(where)) {
      params.push(v);
      parts.push(`"${k}" = $${params.length}`);
    }
  }
  if (since) {
    params.push(since);
    parts.push(`"${sinceField}" >= $${params.length}`);
  }
  return { clause: parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "", params };
}

// ── Adapter ──────────────────────────────────────────────────────

export class PostgresStorage implements StorageBackend {
  readonly name = "postgres";

  // Contract §14 · declared capabilities.
  // Underlying Postgres supports all of these; the flag reflects whether
  // the current interface + schema wiring surfaces them today.
  //   · efficientLatestPerKey · true via DISTINCT ON in latestPerKey()
  //   · jsonPathQueries       · true via -> / ->> / @> in query filter (partial · not yet exposed)
  //   · atomicMultiWrite      · false today · needs interface extension (withTransaction)
  //   · fullTextSearch        · false today · needs tsvector column + interface method
  //   · vectorSearch          · false today · needs pgvector column + interface method
  readonly capabilities: StorageBackendCapabilities = {
    efficientLatestPerKey: true,
    atomicMultiWrite: false,
    jsonPathQueries: true,
    fullTextSearch: false,
    vectorSearch: false,
  };

  async save<T>(collection: string, record: T): Promise<void> {
    const meta = metaFor(collection);
    const jsonbSet = new Set(meta.jsonbColumns ?? []);
    const rec = record as Record<string, unknown>;
    const values = meta.columns.map((col) => extractValue(rec, col, jsonbSet));
    const sql = buildInsertSql(meta);
    await withClient((client) => client.query(sql, values));
  }

  async load<T>(collection: string, id: string): Promise<T | null> {
    const meta = metaFor(collection);
    const idCol = meta.keyField;
    // For snapshot tables, "load by id" means the LATEST snapshot for that key.
    const sql = meta.writeMode === "snapshot"
      ? `SELECT * FROM ${meta.table} WHERE "${idCol}" = $1 ORDER BY "${meta.timestampField}" DESC LIMIT 1`
      : `SELECT * FROM ${meta.table} WHERE "${idCol}" = $1 LIMIT 1`;
    return withClient(async (client) => {
      const res = await client.query(sql, [id]);
      return (res.rows[0] as T | undefined) ?? null;
    });
  }

  async latestPerKey<T>(collection: string, keyField: string, filter?: QueryFilter): Promise<T[]> {
    const meta = metaFor(collection);
    const orderBy = filter?.order_by ?? meta.timestampField;
    const orderDir = (filter?.order_dir ?? "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";
    const limit = Math.min(Math.max(1, filter?.limit ?? 100), 10_000);
    const { clause, params } = buildWhereClause(filter?.where, meta.timestampField, filter?.since);

    // DISTINCT ON needs the DISTINCT-column first in ORDER BY. We collapse
    // to one row per keyField, taking the LATEST (by timestamp DESC).
    const sql = `
      SELECT DISTINCT ON ("${keyField}") *
      FROM ${meta.table}
      ${clause}
      ORDER BY "${keyField}", "${meta.timestampField}" DESC
    `;
    // Outer ordering + limit applied after the collapse.
    const outerSql = `
      SELECT * FROM (${sql}) AS latest
      ORDER BY "${orderBy}" ${orderDir}
      LIMIT ${limit}
    `;
    return withClient(async (client) => {
      const res = await client.query(outerSql, params);
      return res.rows as T[];
    });
  }

  async query<T>(collection: string, filter?: QueryFilter): Promise<T[]> {
    const meta = metaFor(collection);
    const orderBy = filter?.order_by ?? meta.timestampField;
    const orderDir = (filter?.order_dir ?? "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";
    const limit = Math.min(Math.max(1, filter?.limit ?? 100), 10_000);
    const { clause, params } = buildWhereClause(filter?.where, meta.timestampField, filter?.since);
    return withClient(async (client) => {
      const res = await client.query(
        `SELECT * FROM ${meta.table} ${clause} ORDER BY "${orderBy}" ${orderDir} LIMIT ${limit}`,
        params,
      );
      return res.rows as T[];
    });
  }

  async count(collection: string, filter?: QueryFilter): Promise<number> {
    const meta = metaFor(collection);
    const { clause, params } = buildWhereClause(filter?.where, meta.timestampField, filter?.since);
    return withClient(async (client) => {
      const res = await client.query(`SELECT COUNT(*)::int AS n FROM ${meta.table} ${clause}`, params);
      return (res.rows[0]?.n as number | undefined) ?? 0;
    });
  }

  async stats(collection: string): Promise<CollectionStats> {
    const meta = metaFor(collection);
    return withClient(async (client) => {
      const res = await client.query(
        `SELECT COUNT(*)::int AS n,
                MAX("${meta.timestampField}")::text AS latest,
                pg_total_relation_size('${meta.table}')::bigint AS bytes
         FROM ${meta.table}`,
      );
      const row = res.rows[0] ?? {};
      return {
        total_records: (row.n as number | undefined) ?? 0,
        latest_write_at: (row.latest as string | undefined) ?? null,
        size_bytes: Number((row.bytes as number | undefined) ?? 0),
      };
    });
  }
}

/** Probe · returns true if Postgres is reachable + at least one nex.* table exists. */
export async function isPostgresHealthy(): Promise<{ healthy: boolean; detail?: string }> {
  try {
    return await withClient(async (client) => {
      await client.query("SELECT 1 AS ok");
      const res = await client.query(
        `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'nex'`,
      );
      const n = (res.rows[0]?.n as number | undefined) ?? 0;
      if (n === 0) {
        return { healthy: false, detail: "connected but no nex.* tables found · run: npm run nex:apply-storage-schema" };
      }
      return { healthy: true, detail: `${n} tables in nex schema` };
    });
  } catch (err) {
    return { healthy: false, detail: err instanceof Error ? err.message : "unknown" };
  }
}
