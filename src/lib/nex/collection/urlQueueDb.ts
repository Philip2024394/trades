// nex_collection_url_queue · nex_collection_fetch_errors — Supabase CRUD.
//
// Path C · Semi-autonomous URL queue collector (Philip 2026-08-13).
// Service-role client · callers must guard with isAdminAuthed() or a
// cron-secret token at the API layer.

import "server-only";
import { randomUUID } from "node:crypto";
import { promises as dns } from "node:dns";
import { supabaseNexAdmin as supabaseAdmin } from "@/lib/supabaseNexAdmin";

/**
 * Resolve a hostname via DNS — used as a preflight before enqueueing a
 * CANDIDATE URL so we never waste a worker fetch on a domain that doesn't
 * exist (Philip 2026-08-13 · URL Provenance rule).
 *
 * Returns:
 *   { ok: true }               — hostname resolves (has at least one A/AAAA/CNAME record)
 *   { ok: false, code, msg }   — NXDOMAIN, EAI_AGAIN, timeout, etc.
 *
 * Uses a 4-second timeout so a slow resolver doesn't stall the paste flow.
 * Cached briefly to avoid re-resolving the same host in a single paste batch.
 */
const DNS_TIMEOUT_MS = 4_000;
const dnsCache = new Map<string, { ok: boolean; code?: string; msg?: string; at: number }>();
const DNS_CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute freshness

async function resolveHostSafe(host: string): Promise<{ ok: true } | { ok: false; code: string; msg: string }> {
  const now = Date.now();
  const cached = dnsCache.get(host);
  if (cached && now - cached.at < DNS_CACHE_TTL_MS) {
    return cached.ok ? { ok: true } : { ok: false, code: cached.code ?? "unknown", msg: cached.msg ?? "cached" };
  }
  try {
    // Race dns.lookup against a manual timeout — the built-in lookup can hang
    // on some misconfigured resolvers.
    const looked = await Promise.race([
      dns.lookup(host, { all: false }),
      new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("dns_timeout"), { code: "ETIMEDOUT" })), DNS_TIMEOUT_MS)),
    ]);
    if (looked) {
      dnsCache.set(host, { ok: true, at: now });
      return { ok: true };
    }
    dnsCache.set(host, { ok: false, code: "no_address", msg: "no address returned", at: now });
    return { ok: false, code: "no_address", msg: "no address returned" };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const code = e.code ?? "dns_error";
    const msg  = e.message ?? String(err);
    dnsCache.set(host, { ok: false, code, msg, at: now });
    return { ok: false, code, msg };
  }
}

/** Serialise a Supabase / Postgrest / plain Error so console.error shows the
 *  actual fields. `console.error(err)` on a PostgrestError often prints `{}`
 *  because its enumerable properties are shadowed by prototype getters — this
 *  helper walks the known fields explicitly. */
function fmtSupabaseError(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== "object") return { raw: String(err) };
  const e = err as Record<string, unknown>;
  return {
    message: e.message ?? null,
    code:    e.code ?? null,
    details: e.details ?? null,
    hint:    e.hint ?? null,
    name:    e.name ?? null,
  };
}

export type QueueStatus =
  | "queued"
  | "processing"
  | "completed"
  | "duplicate"
  | "needs_review"
  | "failed"
  | "retry_scheduled"
  /** Discovery bookmarks — directory/search-source URLs the operator will
   *  browse to find candidate URLs. The worker NEVER fetches these. */
  | "discovery_bookmark";

/** Two-track worker input model (Philip 2026-08-13):
 *   candidate — actual company website · worker fetches + classifies + saves
 *   discovery — directory / search source · bookmark only · never scraped */
export type UrlKind = "candidate" | "discovery";

/** Domains we treat as DISCOVERY sources by default. Unlabelled URLs pointing
 *  at these hosts are routed to the discovery bookmark pile instead of the
 *  fetch queue. Every entry here is a directory/search site — NEX never scrapes
 *  them, the operator browses them by hand to find candidate URLs. */
const KNOWN_DISCOVERY_DOMAINS: readonly string[] = [
  "checkatrade.com",
  "homerun.co.uk",
  "yell.com",
  "bark.com",
  "mybuilder.com",
  "ratedpeople.com",
  "houzz.co.uk",
  "houzz.com",
  "google.com",
  "google.co.uk",
  "trustatrader.com",
  "yelp.com",
  "yelp.co.uk",
];

/** Return "discovery" if the URL's host matches a known directory source,
 *  otherwise "candidate". Used when the operator pastes an unlabelled URL. */
export function inferUrlKind(rawUrl: string): UrlKind {
  const host = extractDomain(rawUrl);
  for (const d of KNOWN_DISCOVERY_DOMAINS) {
    if (host === d || host.endsWith(`.${d}`)) return "discovery";
  }
  return "candidate";
}

/** Derived worker classification (Philip 2026-08-13 · standing worker rule).
 *  Set by the URL-queue processor after fetching + extracting a candidate URL.
 *  See docs/refacing/REFACING-MEMBER-ENTITLEMENT-SPEC.md and the Trade Card Rule. */
export type Classification =
  | "REFACING"
  | "MANUFACTURE"
  | "BOTH"
  | "INSTALLER"
  | "SUPPLIER"
  | "NOT_RELEVANT"
  | "NEEDS_REVIEW";

export type QueueItem = {
  id: string;
  collection_type: string;
  candidate_url: string;
  target_domain: string;
  submitted_by: string | null;
  submitted_at: string;
  status: QueueStatus;
  kind: UrlKind;
  attempt_count: number;
  processing_started_at: string | null;
  completed_at: string | null;
  retry_scheduled_at: string | null;
  result_listing_id: string | null;
  result_listing_slug: string | null;
  result_summary: string | null;
  extracted_company_name: string | null;
  extracted_email: string | null;
  extracted_phone: string | null;
  extracted_postcode: string | null;
  evidence_snippet: string | null;
  refacing_qualification: string | null;
  classification: Classification | null;
  /** Evidence-driven 0-100 · NEX Brain Confidence Rule (Philip 2026-08-13).
   *  ≥80 auto-passes to save/merge · <80 lands in the human review queue.
   *  Nullable while rows are queued/processing · populated on extraction. */
  confidence_score: number | null;
  notes: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Extract the bare hostname (no www, no protocol, no path) from a URL string.
 * Returns the input lowercased if URL parsing fails — never throws.
 */
export function extractDomain(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  try {
    return new URL(trimmed).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return trimmed.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

/**
 * Enqueue a URL. Idempotent — the DB has UNIQUE(candidate_url), so pasting
 * the same URL twice returns { ok:true, duplicate:true } instead of raising.
 * Multiple URLs from the same domain ARE allowed by design.
 *
 * The `kind` param controls how the URL is treated:
 *   candidate (default) — enters the fetch queue at status='queued', worker
 *                          fetches + classifies + saves via insertDirectorySeed
 *   discovery           — stored with status='discovery_bookmark', worker
 *                          NEVER fetches, admin browses to find candidate URLs
 *
 * When `kind` is not supplied, it's inferred from the host (known directory
 * domains → discovery, everything else → candidate).
 */
export async function enqueueUrl(input: {
  candidate_url: string;
  collection_type?: string;
  submitted_by?: string | null;
  notes?: string | null;
  kind?: UrlKind;
}): Promise<
  | { ok: true; id: string; duplicate: boolean; kind: UrlKind }
  | { ok: false; error: string; error_category?: "dns_error" | "invalid_url" | "db_error" | "duplicate_lookup" }
> {
  const url = input.candidate_url.trim();
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: "url_must_start_with_http", error_category: "invalid_url" };
  const domain = extractDomain(url);
  if (!domain) return { ok: false, error: "url_has_no_domain", error_category: "invalid_url" };

  const kind: UrlKind = input.kind ?? inferUrlKind(url);
  const status: QueueStatus = kind === "discovery" ? "discovery_bookmark" : "queued";

  // DNS preflight (Philip 2026-08-13 · URL Provenance rule) — CANDIDATE only.
  // Discovery bookmarks are stored regardless (the worker never fetches them,
  // so DNS failure would be irrelevant · the admin still wants the URL as a
  // reference). For candidates, an unresolvable host is rejected AT ENQUEUE
  // so we never waste a worker fetch on a domain that doesn't exist.
  //
  // A DNS failure NEVER implies the company doesn't exist — the URL might be
  // wrong, stale, or a fabricated pattern. This rejection is a collection
  // problem, not a company judgement (see status-separation rule).
  if (kind === "candidate") {
    const dnsRes = await resolveHostSafe(domain);
    if (!dnsRes.ok) {
      return {
        ok: false,
        error: `dns_${dnsRes.code}: ${dnsRes.msg}`,
        error_category: "dns_error",
      };
    }
  }

  const row = {
    id: randomUUID(),
    collection_type: input.collection_type ?? "staircase_refacing",
    candidate_url: url,
    target_domain: domain,
    submitted_by: input.submitted_by ?? "admin",
    status,
    kind,
    notes: input.notes ?? null,
  };

  const res = await supabaseAdmin
    .from("nex_collection_url_queue")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (res.error) {
    if ((res.error as { code?: string }).code === "23505") {
      // Already queued — look up its id.
      const existing = await supabaseAdmin
        .from("nex_collection_url_queue")
        .select("id")
        .eq("candidate_url", url)
        .maybeSingle();
      if (existing.data?.id) return { ok: true, id: existing.data.id as string, duplicate: true, kind };
      return { ok: false, error: "duplicate_lookup_failed" };
    }
    return { ok: false, error: res.error.message };
  }
  if (!res.data) return { ok: false, error: "insert_returned_no_row" };
  return { ok: true, id: res.data.id as string, duplicate: false, kind };
}

/**
 * Pull the next queued item and atomically mark it as "processing". Returns
 * null when the queue is drained. Uses a two-step read + conditional-update
 * pattern — safe for a single worker at a time (which is what we run).
 *
 * When we later want concurrent workers, migrate to a SELECT ... FOR UPDATE
 * SKIP LOCKED via a Postgres RPC. Not needed at current scale.
 */
export async function claimNextQueued(collectionType: string): Promise<QueueItem | null> {
  const nowIso = new Date().toISOString();
  const pick = await supabaseAdmin
    .from("nex_collection_url_queue")
    .select("*")
    .eq("status", "queued")
    .eq("collection_type", collectionType)
    .order("submitted_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pick.error) {
    console.error("[urlQueueDb.claimNextQueued.pick]", fmtSupabaseError(pick.error));
    return null;
  }
  if (!pick.data) return null;
  const item = pick.data as QueueItem;

  const upd = await supabaseAdmin
    .from("nex_collection_url_queue")
    .update({
      status: "processing",
      processing_started_at: nowIso,
      attempt_count: (item.attempt_count ?? 0) + 1,
    })
    .eq("id", item.id)
    .eq("status", "queued") // guard against a concurrent claim
    .select("*")
    .maybeSingle();
  if (upd.error || !upd.data) {
    console.error("[urlQueueDb.claimNextQueued.update]", fmtSupabaseError(upd.error));
    return null;
  }
  return upd.data as QueueItem;
}

/** Record a terminal outcome on a queue item. */
export async function completeQueueItem(id: string, patch: Partial<QueueItem>): Promise<void> {
  const nowIso = new Date().toISOString();
  const res = await supabaseAdmin
    .from("nex_collection_url_queue")
    .update({ ...patch, completed_at: nowIso })
    .eq("id", id);
  if (res.error) console.error("[urlQueueDb.completeQueueItem]", fmtSupabaseError(res.error));
}

/**
 * Reset any row that has been stuck in `status='processing'` for longer than
 * the given threshold back to `status='queued'`. Used by the queue processor
 * to auto-recover jobs an earlier worker crashed on (Vercel timeout, process
 * kill, etc.). Preserves attempt_count so retries are bounded.
 *
 * Returns the count of rows recovered · never throws.
 *
 * Philip 2026-08-13: with autonomous workers, small "stuck processing" issues
 * become big messes over time. This is the immune system that prevents that.
 */
export async function recoverStuckProcessing(opts?: {
  collectionType?: string;
  olderThanMinutes?: number;
}): Promise<{ recovered: number; error?: string }> {
  const olderThanMinutes = opts?.olderThanMinutes ?? 30;
  const cutoffIso = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();

  let q = supabaseAdmin
    .from("nex_collection_url_queue")
    .update({
      status: "queued" as QueueStatus,
      processing_started_at: null,
      // last_error keeps a breadcrumb about the recovery so the operator can
      // see it happened. attempt_count is left intact — the worker already
      // incremented it on the first claim.
      last_error: `auto_recovered: stuck in processing > ${olderThanMinutes}min at ${new Date().toISOString()}`,
    })
    .eq("status", "processing")
    .lt("processing_started_at", cutoffIso)
    .select("id");
  if (opts?.collectionType) q = q.eq("collection_type", opts.collectionType);

  const res = await q;
  if (res.error) {
    console.error("[urlQueueDb.recoverStuckProcessing]", fmtSupabaseError(res.error));
    return { recovered: 0, error: res.error.message };
  }
  const recovered = res.data?.length ?? 0;
  if (recovered > 0) {
    console.warn(`[urlQueueDb.recoverStuckProcessing] recovered ${recovered} stuck row(s) older than ${olderThanMinutes}min back to 'queued'`);
  }
  return { recovered };
}

/** Update a queue item without marking completed (e.g. mid-flight status). */
export async function updateQueueItem(id: string, patch: Partial<QueueItem>): Promise<void> {
  const res = await supabaseAdmin
    .from("nex_collection_url_queue")
    .update(patch)
    .eq("id", id);
  if (res.error) console.error("[urlQueueDb.updateQueueItem]", fmtSupabaseError(res.error));
}

/** Postgres "undefined_table" — surfaced when migrations haven't been applied. */
export const PG_UNDEFINED_TABLE = "42P01";
/** Postgres "undefined_column" — surfaced when the second migration hasn't
 *  been applied (kind / classification columns missing). */
export const PG_UNDEFINED_COLUMN = "42703";
/** PostgREST-specific · Supabase returns this + "Could not find the table
 *  '<schema>.<table>' in the schema cache" when the table doesn't exist. */
export const PGRST_TABLE_NOT_IN_SCHEMA = "PGRST205";
/** PostgREST-specific · returned when a queried column doesn't exist. */
export const PGRST_COLUMN_NOT_IN_SCHEMA = "PGRST204";

/** Detect the "table missing" state across Postgres + PostgREST + Supabase-js. */
function isTableMissingError(info: Record<string, unknown>): boolean {
  const code = (info.code as string | null) ?? "";
  const message = (info.message as string | null) ?? "";
  return (
    code === PG_UNDEFINED_TABLE ||
    code === PGRST_TABLE_NOT_IN_SCHEMA ||
    /relation .* does not exist/i.test(message) ||
    /could not find the table .* in the schema cache/i.test(message)
  );
}

/** Detect the "column missing" state. */
function isColumnMissingError(info: Record<string, unknown>): boolean {
  const code = (info.code as string | null) ?? "";
  const message = (info.message as string | null) ?? "";
  return (
    code === PG_UNDEFINED_COLUMN ||
    code === PGRST_COLUMN_NOT_IN_SCHEMA ||
    /column .* does not exist/i.test(message) ||
    /could not find the .* column .* in the schema cache/i.test(message)
  );
}

export type ListQueueResult =
  | { ok: true; items: QueueItem[] }
  | { ok: false; error: "table_missing" | "column_missing" | "other"; detail: string };

/** List queue rows for the admin dashboard (newest first). Never throws.
 *  Returns a discriminated result so the admin page can render a specific
 *  "please apply migrations" banner instead of an empty state. */
export async function listQueueSafe(opts?: { collectionType?: string; limit?: number }): Promise<ListQueueResult> {
  let q = supabaseAdmin
    .from("nex_collection_url_queue")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.collectionType) q = q.eq("collection_type", opts.collectionType);
  const res = await q;
  if (res.error) {
    const info = fmtSupabaseError(res.error);
    const message = (info.message as string | null) ?? "";
    // Known "migration not yet applied" states · surface via the discriminated
    // result and DO NOT console.error — Next 16 Turbopack surfaces server-side
    // console.error to the browser as a fake error overlay, and this state is
    // already being rendered as a helpful setup banner by the caller.
    if (isTableMissingError(info)) {
      return { ok: false, error: "table_missing", detail: message || "table nex_collection_url_queue not found" };
    }
    if (isColumnMissingError(info)) {
      return { ok: false, error: "column_missing", detail: message };
    }
    // Genuine unexpected error · log it.
    console.error("[urlQueueDb.listQueue]", info);
    return { ok: false, error: "other", detail: message || JSON.stringify(info) };
  }
  return { ok: true, items: (res.data ?? []) as QueueItem[] };
}

/** Back-compat wrapper · returns just the rows (empty on error, error is logged). */
export async function listQueue(opts?: { collectionType?: string; limit?: number }): Promise<QueueItem[]> {
  const r = await listQueueSafe(opts);
  return r.ok ? r.items : [];
}

/** Aggregate counts by status — for the header stats row. Never throws.
 *  Silently returns zeroes when the table is missing so the page can rely on
 *  listQueueSafe alone to detect and surface the migration error. */
export async function queueStats(collectionType?: string): Promise<Record<QueueStatus, number> & { total: number }> {
  let q = supabaseAdmin.from("nex_collection_url_queue").select("status");
  if (collectionType) q = q.eq("collection_type", collectionType);
  const res = await q;
  const zero = {
    queued: 0,
    processing: 0,
    completed: 0,
    duplicate: 0,
    needs_review: 0,
    failed: 0,
    retry_scheduled: 0,
    discovery_bookmark: 0,
    total: 0,
  } as Record<QueueStatus, number> & { total: number };
  if (res.error) {
    const info = fmtSupabaseError(res.error);
    // Migration-not-applied path is handled + surfaced by listQueueSafe on the
    // same page load. Return zeroes silently so we don't fire a second
    // console.error → Next 16 Turbopack browser overlay for the same known state.
    if (isTableMissingError(info) || isColumnMissingError(info)) return zero;
    console.error("[urlQueueDb.queueStats]", info);
    return zero;
  }
  for (const row of res.data ?? []) {
    const s = (row as { status: QueueStatus }).status;
    zero[s] = (zero[s] ?? 0) + 1;
    zero.total += 1;
  }
  return zero;
}

/** Per-classification counts for the admin summary.
 *  Populated from queue rows where the worker has already run extraction. */
export type ClassificationStats = Record<Classification, number> & { unclassified: number; total: number };

export async function queueClassificationStats(collectionType?: string): Promise<ClassificationStats> {
  const zero: ClassificationStats = {
    REFACING: 0,
    MANUFACTURE: 0,
    BOTH: 0,
    INSTALLER: 0,
    SUPPLIER: 0,
    NOT_RELEVANT: 0,
    NEEDS_REVIEW: 0,
    unclassified: 0,
    total: 0,
  };
  let q = supabaseAdmin.from("nex_collection_url_queue").select("classification, kind");
  if (collectionType) q = q.eq("collection_type", collectionType);
  const res = await q;
  if (res.error) {
    const info = fmtSupabaseError(res.error);
    if (isTableMissingError(info) || isColumnMissingError(info)) return zero;
    console.error("[urlQueueDb.queueClassificationStats]", info);
    return zero;
  }
  for (const row of res.data ?? []) {
    // discovery bookmarks aren't classified · exclude from the funnel
    if ((row as { kind?: string }).kind === "discovery") continue;
    const c = (row as { classification?: Classification | null }).classification;
    if (c && c in zero) zero[c] += 1;
    else zero.unclassified += 1;
    zero.total += 1;
  }
  return zero;
}

/** Pipeline funnel counts — reflects the Philip-mandated reporting format
 *  (see project_nex_brain_confidence_rule_2026_08_13.md · Reporting format).
 *  Every count is derived from the queue table; nothing is inferred. */
export type QueueFunnel = {
  submitted:        number;   // all candidate rows (excludes discovery bookmarks)
  fetched:          number;   // rows where extraction actually ran (any terminal or in-flight state past 'queued')
  passed:           number;   // status='completed' with confidence >= 80 (auto-save)
  review:           number;   // status='needs_review'
  failed:           number;   // status='failed'
  duplicates:       number;   // status='duplicate'
  merged:           number;   // duplicates where result_summary contains "merged into"
  new_companies:    number;   // completed rows with result_listing_id set (new seed inserted)
  discovery_bookmarks: number; // kind='discovery' rows (never in the funnel)
  queued_pending:   number;   // rows still awaiting fetch
  processing:       number;   // rows currently in-flight
};

export async function queueFunnel(collectionType?: string): Promise<QueueFunnel> {
  const zero: QueueFunnel = {
    submitted: 0, fetched: 0, passed: 0, review: 0, failed: 0,
    duplicates: 0, merged: 0, new_companies: 0,
    discovery_bookmarks: 0, queued_pending: 0, processing: 0,
  };
  let q = supabaseAdmin
    .from("nex_collection_url_queue")
    .select("status, kind, confidence_score, result_listing_id, result_summary");
  if (collectionType) q = q.eq("collection_type", collectionType);
  const res = await q;
  if (res.error) {
    const info = fmtSupabaseError(res.error);
    if (isTableMissingError(info) || isColumnMissingError(info)) return zero;
    console.error("[urlQueueDb.queueFunnel]", info);
    return zero;
  }
  for (const row of res.data ?? []) {
    const r = row as {
      status: string;
      kind?: string;
      confidence_score?: number | null;
      result_listing_id?: string | null;
      result_summary?: string | null;
    };
    if (r.kind === "discovery" || r.status === "discovery_bookmark") {
      zero.discovery_bookmarks += 1;
      continue;
    }
    zero.submitted += 1;
    if (r.status !== "queued") zero.fetched += 1;
    switch (r.status) {
      case "completed":
        if (r.result_listing_id) zero.new_companies += 1;
        if ((r.confidence_score ?? 0) >= 80) zero.passed += 1;
        break;
      case "needs_review":
        zero.review += 1;
        break;
      case "failed":
        zero.failed += 1;
        break;
      case "duplicate":
        zero.duplicates += 1;
        if ((r.result_summary ?? "").includes("merged into")) zero.merged += 1;
        break;
      case "queued":
        zero.queued_pending += 1;
        break;
      case "processing":
        zero.processing += 1;
        break;
    }
  }
  return zero;
}

/** Categorised failure counts — surfaces WHY the failed bucket is failing.
 *  Reads all status='failed' rows and their linked fetch-error category,
 *  then runs the shared categoriser (see failureCategorisation.ts).
 *
 *  Never modifies data. Never DNS-checks (too slow for a page load) — that
 *  refinement lives in the offline categorise-failed-url-queue.mjs script. */
export type FailureCategoryStats = {
  total: number;
  by_category: Partial<Record<import("./failureCategorisation").FailureCategory, number>>;
};

export async function queueFailureCategories(collectionType?: string): Promise<FailureCategoryStats> {
  const { categoriseFailure } = await import("./failureCategorisation");
  let q = supabaseAdmin
    .from("nex_collection_url_queue")
    .select("id, last_error")
    .eq("status", "failed");
  if (collectionType) q = q.eq("collection_type", collectionType);
  const res = await q;
  if (res.error) {
    const info = fmtSupabaseError(res.error);
    if (isTableMissingError(info) || isColumnMissingError(info)) return { total: 0, by_category: {} };
    console.error("[urlQueueDb.queueFailureCategories.queue]", info);
    return { total: 0, by_category: {} };
  }
  const rows = (res.data ?? []) as Array<{ id: string; last_error: string | null }>;

  // Enrich with linked structured category where available.
  const linked = await supabaseAdmin
    .from("nex_collection_fetch_errors")
    .select("queue_item_id, error_category, last_error")
    .in("queue_item_id", rows.map((r) => r.id));
  const byId = new Map<string, { error_category?: string | null; last_error?: string | null }>();
  for (const e of (linked.data ?? []) as Array<{ queue_item_id: string; error_category: string | null; last_error: string | null }>) {
    byId.set(e.queue_item_id, e);
  }

  const stats: FailureCategoryStats = { total: rows.length, by_category: {} };
  for (const r of rows) {
    const l = byId.get(r.id);
    const { category } = categoriseFailure({
      last_error: r.last_error ?? l?.last_error ?? "",
      linked_category: l?.error_category ?? null,
    });
    stats.by_category[category] = (stats.by_category[category] ?? 0) + 1;
  }
  return stats;
}

/** Log a fetch failure so we have a history of what refuses to load. */
export async function recordFetchError(input: {
  target_url: string;
  queue_item_id: string;
  error_category: string;
  last_error: string;
}): Promise<void> {
  const domain = extractDomain(input.target_url);
  // If we already have a row for this URL, bump its attempt_count; else insert.
  const existing = await supabaseAdmin
    .from("nex_collection_fetch_errors")
    .select("id, attempt_count")
    .eq("target_url", input.target_url)
    .maybeSingle();
  const nowIso = new Date().toISOString();
  if (existing.data?.id) {
    const attempt = (existing.data.attempt_count as number) + 1;
    await supabaseAdmin
      .from("nex_collection_fetch_errors")
      .update({
        attempt_count: attempt,
        last_error: input.last_error,
        last_failed_at: nowIso,
        error_category: input.error_category,
        dead: attempt >= 3, // 3 strikes and it's dead until an admin clears it
      })
      .eq("id", existing.data.id);
    return;
  }
  await supabaseAdmin.from("nex_collection_fetch_errors").insert({
    id: randomUUID(),
    target_url: input.target_url,
    target_domain: domain,
    queue_item_id: input.queue_item_id,
    attempt_count: 1,
    error_category: input.error_category,
    last_error: input.last_error,
    first_failed_at: nowIso,
    last_failed_at: nowIso,
  });
}
