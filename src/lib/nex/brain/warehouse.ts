// NEX Brain Warehouse · Phase 10.5 · observability aggregator.
//
// Composes a "warehouse" view — six production stages a work item can be
// in — over the state that already lives in worker_jobs + knowledge_records.
//
//   1 · incoming              · knowledge-context waiting (freshly dispatched)
//   2 · context_processing    · voice/learning-context waiting or in-flight
//                                (deterministic work in progress)
//   3 · waiting_for_ai        · knowledge-extractor waiting jobs
//                                (only needsLlm workers land here)
//   4 · being_written         · extractor + image-analyst in-flight
//   5 · quality_check         · quality-checker waiting or in-flight
//   6 · stored                · knowledge_records status='AUTHORITATIVE'
//
// This module is READ-ONLY. Zero writes, zero new tables, no second
// source of truth. Every count is derived from an existing row; the
// "barrels" are a visual metaphor the UI applies over this snapshot.
//
// Zero LLM calls, zero external dependencies beyond the storage layer
// this module already needs to survey.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WorkerType } from "./types";

export type WarehouseStageKey =
  | "incoming"
  | "context_processing"
  | "waiting_for_ai"
  | "being_written"
  | "quality_check"
  | "stored";

export interface WarehouseItemSummary {
  worker_type: WorkerType;
  status:      string;
  count:       number;
  oldest_at:   string | null;
  oldest_age_ms: number | null;
}

export interface WarehouseStage {
  key:      WarehouseStageKey;
  label:    string;
  glyph:    string;
  count:    number;
  oldest_at: string | null;
  oldest_age_ms: number | null;
  items:    WarehouseItemSummary[];   // drill-down · sub-breakdown by (worker_type, status)
  reason?:  string;                    // human-readable · e.g. "AI providers degraded"
}

export interface WarehouseSnapshot {
  stages:          WarehouseStage[];
  computed_at:     string;
  vault_records: {
    authoritative: number;
    under_review:  number;
    draft:         number;
  };
  source: "supabase" | "unavailable";
  note?:  string;
}

interface WorkerJobRow {
  worker_type: string;
  status:      string;
  created_at:  string;
}

interface KnowledgeRecordRow { status: string }

// ── Stage definitions · every stage names its (worker_type, status)
//    tuples so the composition is auditable in one place. ───────────
const STAGE_DEFINITIONS: Record<Exclude<WarehouseStageKey, "stored">, {
  label: string;
  glyph: string;
  match: Array<{ worker_type: WorkerType; statuses: string[] }>;
}> = {
  incoming: {
    label: "New material",
    glyph: "📦",
    match: [{ worker_type: "knowledge-context", statuses: ["waiting"] }],
  },
  context_processing: {
    label: "Context processing",
    glyph: "🔧",
    match: [
      { worker_type: "knowledge-context", statuses: ["in-flight", "assigned"] },
      { worker_type: "voice-context",     statuses: ["waiting", "in-flight", "assigned"] },
      { worker_type: "learning-context",  statuses: ["waiting", "in-flight", "assigned"] },
    ],
  },
  waiting_for_ai: {
    label: "Waiting for AI",
    glyph: "🧠",
    match: [
      { worker_type: "knowledge-extractor", statuses: ["waiting"] },
      { worker_type: "image-analyst",       statuses: ["waiting"] },
    ],
  },
  being_written: {
    label: "Being written",
    glyph: "✍️",
    match: [
      { worker_type: "knowledge-extractor", statuses: ["in-flight", "assigned"] },
      { worker_type: "image-analyst",       statuses: ["in-flight", "assigned"] },
    ],
  },
  quality_check: {
    label: "Quality check",
    glyph: "🔍",
    match: [{ worker_type: "quality-checker", statuses: ["waiting", "in-flight", "assigned"] }],
  },
};

// Which worker types actually call an LLM. Kept here so the warehouse
// module can enforce the invariant "only needsLlm workers land in
// waiting_for_ai / being_written" without importing UI types.
export const LLM_WORKER_TYPES: readonly WorkerType[] = ["knowledge-extractor", "image-analyst", "quality-checker"];

// ── Public entry ─────────────────────────────────────────────────

// Compute a warehouse snapshot. Returns `source: "unavailable"` when
// the NEX Supabase credentials aren't configured — the UI still gets
// a well-formed object with zero counts + an honest note.
export async function computeWarehouseView(): Promise<WarehouseSnapshot> {
  const client = openSupabase();
  if (!client) {
    return zeroSnapshot("NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY not configured");
  }

  const now = Date.now();
  const [jobsRes, recordsRes] = await Promise.all([
    client
      .from("worker_jobs")
      .select("worker_type,status,created_at")
      .in("status", ["waiting", "in-flight", "assigned"])
      .limit(10000),
    client
      .from("knowledge_records")
      .select("status")
      .in("status", ["AUTHORITATIVE", "UNDER_REVIEW", "DRAFT"])
      .limit(50000),
  ]);

  if (jobsRes.error) {
    return zeroSnapshot(`worker_jobs fetch failed: ${jobsRes.error.message}`);
  }
  const jobs = (jobsRes.data ?? []) as WorkerJobRow[];

  const stages: WarehouseStage[] = (Object.keys(STAGE_DEFINITIONS) as Array<Exclude<WarehouseStageKey, "stored">>).map((key) => {
    const def   = STAGE_DEFINITIONS[key];
    const items: WarehouseItemSummary[] = [];
    let total = 0;
    let oldestMs: number | null = null;

    for (const m of def.match) {
      const matching = jobs.filter((j) => j.worker_type === m.worker_type && m.statuses.includes(j.status));
      if (matching.length === 0) continue;
      const oldestForBucket = matching.reduce<Date | null>((acc, j) => {
        const d = new Date(j.created_at);
        if (!acc || d < acc) return d;
        return acc;
      }, null);
      const oldestIso = oldestForBucket?.toISOString() ?? null;
      const ageMs     = oldestForBucket ? now - oldestForBucket.getTime() : null;
      items.push({
        worker_type:   m.worker_type,
        status:        m.statuses.length === 1 ? m.statuses[0] : "any-active",
        count:         matching.length,
        oldest_at:     oldestIso,
        oldest_age_ms: ageMs,
      });
      total += matching.length;
      if (ageMs !== null && (oldestMs === null || ageMs > oldestMs)) oldestMs = ageMs;
    }

    return {
      key,
      label: def.label,
      glyph: def.glyph,
      count: total,
      oldest_at:     oldestMs !== null ? new Date(now - oldestMs).toISOString() : null,
      oldest_age_ms: oldestMs,
      items,
    };
  });

  // Stored stage · knowledge_records vault
  const records = (recordsRes.data ?? []) as KnowledgeRecordRow[];
  const auth  = records.filter((r) => r.status === "AUTHORITATIVE").length;
  const ur    = records.filter((r) => r.status === "UNDER_REVIEW").length;
  const draft = records.filter((r) => r.status === "DRAFT").length;

  stages.push({
    key: "stored",
    label: "Stored in Brain",
    glyph: "🧠",
    count: auth,
    oldest_at: null,
    oldest_age_ms: null,
    items: [
      { worker_type: "knowledge-extractor" as WorkerType, status: "AUTHORITATIVE", count: auth,  oldest_at: null, oldest_age_ms: null },
    ],
  });

  return {
    stages,
    computed_at: new Date(now).toISOString(),
    vault_records: { authoritative: auth, under_review: ur, draft },
    source: "supabase",
  };
}

// ── Internals ────────────────────────────────────────────────────

function openSupabase(): SupabaseClient | null {
  const url = process.env.NEX_SUPABASE_URL
    || process.env.NEXT_PUBLIC_NEX_SUPABASE_URL
    || process.env.SUPABASE_URL;
  const key = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function zeroSnapshot(note: string): WarehouseSnapshot {
  const stages: WarehouseStage[] = (Object.keys(STAGE_DEFINITIONS) as Array<Exclude<WarehouseStageKey, "stored">>).map((key) => ({
    key,
    label: STAGE_DEFINITIONS[key].label,
    glyph: STAGE_DEFINITIONS[key].glyph,
    count: 0,
    oldest_at: null,
    oldest_age_ms: null,
    items: [],
  }));
  stages.push({ key: "stored", label: "Stored in Brain", glyph: "🧠", count: 0, oldest_at: null, oldest_age_ms: null, items: [] });
  return {
    stages,
    computed_at: new Date().toISOString(),
    vault_records: { authoritative: 0, under_review: 0, draft: 0 },
    source: "unavailable",
    note,
  };
}

// ── Truthful progress helper · used by the UI to render real progress
//    bars per active job. Returns null when we lack the information to
//    compute an honest percentage; the caller must NOT invent one. ───

export interface JobProgressHint {
  percent: number | null;         // null · caller must not render a bar
  stage_label: string;            // always non-empty · e.g. "Extracting knowledge"
  is_deterministic: boolean;      // true iff this worker type never needs an LLM
}

// Deterministic mapping · state → percent. Every value is anchored to a
// real transition observable in worker_jobs. No animation, no time-based
// interpolation, no random walk.
const WORKER_PROGRESS_TABLE: Record<WorkerType, { waiting: JobProgressHint; "in-flight": JobProgressHint; assigned: JobProgressHint }> = {
  "knowledge-context":   {
    waiting:    { percent:  5, stage_label: "Received · queued for context",  is_deterministic: true  },
    assigned:   { percent: 15, stage_label: "Reading source · building context", is_deterministic: true },
    "in-flight":{ percent: 15, stage_label: "Reading source · building context", is_deterministic: true },
  },
  "voice-context":       {
    waiting:    { percent: 20, stage_label: "Awaiting voice + brand pass",    is_deterministic: true  },
    assigned:   { percent: 25, stage_label: "Applying voice + brand guide",   is_deterministic: true  },
    "in-flight":{ percent: 25, stage_label: "Applying voice + brand guide",   is_deterministic: true  },
  },
  "learning-context":    {
    waiting:    { percent: 30, stage_label: "Awaiting learning bundle",       is_deterministic: true  },
    assigned:   { percent: 35, stage_label: "Loading past feedback",          is_deterministic: true  },
    "in-flight":{ percent: 35, stage_label: "Loading past feedback",          is_deterministic: true  },
  },
  "knowledge-extractor": {
    waiting:    { percent: 40, stage_label: "Awaiting AI capacity",           is_deterministic: false },
    assigned:   { percent: 55, stage_label: "Extracting knowledge",           is_deterministic: false },
    "in-flight":{ percent: 55, stage_label: "Extracting knowledge",           is_deterministic: false },
  },
  "image-analyst":       {
    waiting:    { percent: 40, stage_label: "Awaiting vision capacity",       is_deterministic: false },
    assigned:   { percent: 55, stage_label: "Analysing image",                is_deterministic: false },
    "in-flight":{ percent: 55, stage_label: "Analysing image",                is_deterministic: false },
  },
  "quality-checker":     {
    waiting:    { percent: 75, stage_label: "Awaiting quality check",         is_deterministic: false },
    assigned:   { percent: 85, stage_label: "Quality checking against Constitution", is_deterministic: false },
    "in-flight":{ percent: 85, stage_label: "Quality checking against Constitution", is_deterministic: false },
  },
  "memory-guardian":     {
    waiting:    { percent: null, stage_label: "Idle · runs on schedule",      is_deterministic: true  },
    assigned:   { percent: null, stage_label: "Sweeping memory",              is_deterministic: true  },
    "in-flight":{ percent: null, stage_label: "Sweeping memory",              is_deterministic: true  },
  },
};

export function computeJobProgress(worker_type: WorkerType, status: string): JobProgressHint {
  const table = WORKER_PROGRESS_TABLE[worker_type];
  if (!table) return { percent: null, stage_label: "Unknown worker", is_deterministic: false };
  if (status === "completed") return { percent: 100, stage_label: "Complete",         is_deterministic: !LLM_WORKER_TYPES.includes(worker_type) };
  if (status === "failed")    return { percent: null, stage_label: "Failed",          is_deterministic: !LLM_WORKER_TYPES.includes(worker_type) };
  const hint = (table as Record<string, JobProgressHint | undefined>)[status];
  if (hint) return hint;
  return { percent: null, stage_label: status, is_deterministic: !LLM_WORKER_TYPES.includes(worker_type) };
}
