// Memory reader — the single read path for Phase 26 V0.
//
// V0 = owner-only reads. The reader:
//   1. Enforces viewer scope matches the layer's owner column
//   2. Filters by subject / subject_like / min_sample_size / fresh_within_days
//   3. Resolves correction chains — the row a caller sees is the newest
//      un-superseded row for each (owner, subject) pair
//   4. Applies the "always return 3" limit rule unless caller overrides
//
// Never returns cross-tenant rows in V0. Cross-tenant scopes arrive
// with the trade/region rollup crons in V1.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_RESULT_LIMIT, MAX_RESULT_LIMIT } from "../util/limit";
import {
  evidenceFor,
  type MemoryLayer,
  type MemoryRow,
  type ReadMemoryInput,
  type RetrieveResult,
  type ViewerScope
} from "./types";

const TABLES: Record<MemoryLayer, string> = {
  user:    "hammerex_nex_memory_user",
  company: "hammerex_nex_memory_company",
  project: "hammerex_nex_memory_project"
};

export async function retrieveMemory(input: ReadMemoryInput): Promise<RetrieveResult> {
  const limit = clampLimit(input.limit);
  const table = TABLES[input.layer];
  const now = Date.now();

  const scopeCheck = validateViewerScope(input.layer, input.viewer);
  if (!scopeCheck.ok) {
    return {
      rows: [], resolved: 0, superseded: 0,
      evidence: evidenceFor(`memory.reader ${input.layer} · viewer mismatch`, [table])
    };
  }

  let q = supabaseAdmin.from(table).select("*").order("observed_at", { ascending: false });

  // Owner filter.
  if (input.viewer.kind === "user")     q = q.eq("owner_user_id", input.viewer.user_id);
  if (input.viewer.kind === "merchant") q = q.eq("merchant_slug", input.viewer.merchant_slug);
  if (input.viewer.kind === "project") {
    q = q.eq("merchant_slug", input.viewer.merchant_slug).eq("project_id", input.viewer.project_id);
  }

  // Subject filter.
  if (input.subject)      q = q.eq("subject", input.subject);
  if (input.subject_like) q = q.like("subject", `${input.subject_like}%`);

  // Sample-size gate.
  if (typeof input.min_sample_size === "number") q = q.gte("sample_size", input.min_sample_size);

  // Freshness gate.
  if (typeof input.fresh_within_days === "number") {
    const cutoff = new Date(now - input.fresh_within_days * 86_400_000).toISOString();
    q = q.gte("observed_at", cutoff);
  }

  // Fetch more than `limit` so correction resolution still yields the
  // requested count after supersession.
  q = q.limit(limit * 3);

  const { data, error } = await q;

  if (error) {
    return {
      rows: [], resolved: 0, superseded: 0,
      evidence: evidenceFor(`memory.reader ${input.layer} · error: ${error.message}`, [table])
    };
  }

  const rowsIn = ((data ?? []) as unknown[]).map(shapeRow(input.layer));
  const resolved = resolveCorrections(rowsIn);
  const kept     = resolved.slice(0, limit);

  return {
    rows:       kept,
    resolved:   resolved.length,
    superseded: rowsIn.length - resolved.length,
    evidence:   evidenceFor(`memory.reader ${input.layer}`, [table])
  };
}

// ─── Correction chain resolution ────────────────────────────────

/** Given a set of rows, drop any row whose id appears in another row's
 *  `correction_of`. Preserves the newest un-superseded row per subject. */
function resolveCorrections(rows: MemoryRow[]): MemoryRow[] {
  const supersededIds = new Set<string>();
  for (const r of rows) if (r.correction_of) supersededIds.add(r.correction_of);
  return rows.filter((r) => !supersededIds.has(r.id));
}

// ─── Row shaping ────────────────────────────────────────────────

function shapeRow(layer: MemoryLayer) {
  return (raw: unknown): MemoryRow => {
    const r = raw as Record<string, unknown>;
    return {
      id:              String(r.id),
      layer,
      owner_user_id:   (r.owner_user_id as string | undefined) ?? null,
      merchant_slug:   (r.merchant_slug as string | undefined) ?? null,
      project_id:      (r.project_id as string | undefined) ?? null,

      subject:         String(r.subject),
      predicate:       r.predicate as MemoryRow["predicate"],
      value_json:      r.value_json,
      unit:            (r.unit as string | null) ?? null,

      observed_at:     String(r.observed_at),
      window_start:    (r.window_start as string | null) ?? null,
      window_end:      (r.window_end as string | null) ?? null,
      sample_size:     Number(r.sample_size ?? 1),

      confidence:      r.confidence as MemoryRow["confidence"],
      is_official:     Boolean(r.is_official),
      is_verified:     Boolean(r.is_verified),

      visible_to:      r.visible_to as MemoryRow["visible_to"],

      source_engine:   String(r.source_engine),
      evidence_tables: (r.evidence_tables as string[] | null) ?? [],
      computed_at:     String(r.computed_at),
      decays_at:       (r.decays_at as string | null) ?? null,

      correction_of:   (r.correction_of as string | null) ?? null,

      created_at:      String(r.created_at)
    };
  };
}

// ─── Viewer scope validation ────────────────────────────────────

function validateViewerScope(layer: MemoryLayer, viewer: ViewerScope): { ok: true } | { ok: false; reason: string } {
  if (layer === "user"    && viewer.kind !== "user")     return { ok: false, reason: "user layer needs user viewer" };
  if (layer === "company" && viewer.kind !== "merchant") return { ok: false, reason: "company layer needs merchant viewer" };
  if (layer === "project" && viewer.kind !== "project" && viewer.kind !== "merchant") return { ok: false, reason: "project layer needs project or merchant viewer" };
  return { ok: true };
}

function clampLimit(n: number | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_RESULT_LIMIT;
  if (n <= 0) return DEFAULT_RESULT_LIMIT;
  return Math.min(Math.floor(n), MAX_RESULT_LIMIT);
}
