// NEX Storage · abstract types
//
// The single interface every service talks through. Zero service imports a
// concrete adapter directly — everyone goes through `getStorage()` from the
// registry. This is what makes swapping JSONL → Postgres a config change,
// not a code rewrite.
//
// Full contract details in `docs/NEX_INFRASTRUCTURE_RUNTIME.md`.

export type QueryFilter = {
  /** Exact-match filters. Keys are field names in the record. */
  where?: Record<string, unknown>;
  /** ISO timestamp cutoff — only records with (order_by field OR sensible default) >= this value. */
  since?: string;
  /** Result cap. Default 100. Max 10000. */
  limit?: number;
  /** Field to sort by. Defaults to the collection's "updated_at" or "created_at". */
  order_by?: string;
  /** Sort direction. Default "desc". */
  order_dir?: "asc" | "desc";
};

export type CollectionStats = {
  total_records: number;
  latest_write_at: string | null;
  size_bytes: number;
};

/**
 * Named capabilities a record-storage adapter may or may not support.
 * Applications route by capability, never by provider name — see
 * NEX_INFRASTRUCTURE_RUNTIME.md §2 principle 9 + §14.
 */
export type StorageBackendCapability =
  | "efficientLatestPerKey"   // native DISTINCT ON vs O(N) Map collapse
  | "atomicMultiWrite"        // transactions available at adapter level
  | "jsonPathQueries"         // rich JSONB / json-path operators
  | "fullTextSearch"          // FTS index queries
  | "vectorSearch";           // embedding-similarity queries

export type StorageBackendCapabilities = Readonly<Record<StorageBackendCapability, boolean>>;

/**
 * Preference dimensions used by `selectStorage({ prefer: [...] })` to
 * rank multiple capable adapters. Additive-only · never rename or remove.
 * See NEX_INFRASTRUCTURE_RUNTIME.md §14.6 (activates when multiple adapters register).
 */
export type PreferenceName =
  | "lowLatency"
  | "lowCost"
  | "highDurability"
  | "highThroughput"
  | "strongConsistency"
  | "globalReach"
  | "lowMemory";

/** 5 = excellent · 1 = poor / not applicable. Undeclared = neutral (3). */
export type Tier = 1 | 2 | 3 | 4 | 5;

/** Optional adapter profile · required when multiple adapters register for the same interface. */
export type AdapterProfile = {
  scores: Readonly<Record<PreferenceName, Tier>>;
  notes?: string;
};

/**
 * Policy constraints used by `select*({ policy: {...} })` to enforce
 * business, legal, and compliance rules. Where `prefer` reorders,
 * `policy` EXCLUDES — a violation removes the adapter from consideration.
 * Reserved · not activated today · additive-only.
 * See NEX_INFRASTRUCTURE_RUNTIME.md §14.7.
 */
export type Policy = {
  /** Geographic region the adapter must operate in ("EU", "US-east", ...). */
  region?: string;
  /** Data must physically reside in named jurisdiction ("UK", "Australia", ...) · stricter than region. */
  dataResidency?: string;
  /** Cost cap per operation in the adapter's cost unit (GBP typical). */
  maxCostPerRequest?: number;
  /** Retention guarantee ("7 years", "90 days", "forever"). */
  retention?: string;
  /** Whether router may fall back to a non-preferred adapter · default true. */
  allowFallback?: boolean;
  /** Required compliance regimes ("GDPR", "HIPAA", "SOC2", ...). */
  compliance?: string[];
  /** Data classification the adapter must be approved to hold. */
  classification?: "public" | "internal" | "confidential" | "restricted";
};

/**
 * The one abstract interface every service uses. Six methods + one
 * capability property. Nothing else.
 *
 * If your service needs something not listed here, either:
 *   (a) compose it from these primitives on the caller side, OR
 *   (b) propose a contract change with a written rationale.
 * Never add ad-hoc methods to individual adapters — that's how abstractions
 * leak and become useless.
 */
export interface StorageBackend {
  /** Backend identifier for logs + telemetry. Never used for routing. */
  readonly name: string;

  /**
   * What this backend can do. Applications ask `capabilities.vectorSearch`
   * not `if (name === "postgres")`. See NEX_INFRASTRUCTURE_RUNTIME.md §14.
   */
  readonly capabilities: StorageBackendCapabilities;

  /** Append a record. For append-only collections this is a new snapshot. */
  save<T>(collection: string, record: T): Promise<void>;

  /** Fetch a single record by primary key. Null if not found. */
  load<T>(collection: string, id: string): Promise<T | null>;

  /**
   * For snapshot-style collections (jobs, contacts, rules), return the
   * latest snapshot per unique key. Guarantees one row per keyField value.
   * If filter is provided, applies BEFORE the latest-per-key collapse.
   */
  latestPerKey<T>(collection: string, keyField: string, filter?: QueryFilter): Promise<T[]>;

  /** Filter + sort + limit. No latest-per-key collapse — every raw row that matches. */
  query<T>(collection: string, filter?: QueryFilter): Promise<T[]>;

  /** Row count · with optional filter. Faster than query().length in real backends. */
  count(collection: string, filter?: QueryFilter): Promise<number>;

  /** Metadata for the collection — record count, last write time, on-disk size. */
  stats(collection: string): Promise<CollectionStats>;
}

// ── Known collection names · single source of truth ──────────────
// Every string here must match a contract in NEX_INFRASTRUCTURE_RUNTIME.md §5.
// Services import this so typos become type errors.

export const COLLECTIONS = {
  events:                 "events",
  worker_audit_events:    "worker_audit_events",
  jobs:                   "jobs",
  recovery_attempts:      "recovery_attempts",
  brain_memories:         "brain_memories",
  contacts:               "contacts",
  tracking_events:        "tracking_events",
  analytics_records:      "analytics_records",
  automation_rules:       "automation_rules",
  automation_runs:        "automation_runs",
  kpe_documents:          "kpe_documents",
  kpe_chunks:             "kpe_chunks",
  kpe_metadata:           "kpe_metadata",
  kpe_decisions:          "kpe_decisions",
  kpe_duplicates:         "kpe_duplicates",
  kpe_edges:              "kpe_edges",
  kpe_processing_runs:    "kpe_processing_runs",
  kpe_human_reviews:      "kpe_human_reviews",
  object_manifest:        "object_manifest",
} as const;

export type CollectionName = keyof typeof COLLECTIONS;
