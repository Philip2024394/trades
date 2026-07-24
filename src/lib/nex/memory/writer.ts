// Memory writer — the single write path for Phase 26 V0.
//
// Every write:
//   1. Validates the visibility scope is V0-safe (owner-only family)
//   2. Fills in defaults (observed_at, sample_size, confidence, decays_at)
//   3. Inserts into the layer-specific table
//   4. Returns the persisted row's id
//
// Never mutates prior rows — corrections use `appendCorrection()` in
// correction.ts.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  V0_VISIBILITIES,
  defaultDecayFor,
  type MemoryLayer,
  type MemoryVisibility,
  type WriteMemoryInput
} from "./types";

const TABLES: Record<MemoryLayer, string> = {
  user:    "hammerex_nex_memory_user",
  company: "hammerex_nex_memory_company",
  project: "hammerex_nex_memory_project"
};

const DEFAULT_VISIBILITY: Record<MemoryLayer, MemoryVisibility> = {
  user:    "owner_only",
  company: "owner_only",
  project: "project_participants"
};

export type WriteMemoryResult =
  | { ok: true;  id: string }
  | { ok: false; reason: string };

export async function writeMemory(input: WriteMemoryInput): Promise<WriteMemoryResult> {
  const nowIso = new Date().toISOString();

  // Visibility gate — V0 only accepts owner-only family scopes.
  const requested = input.visible_to ?? DEFAULT_VISIBILITY[input.layer];
  if (!V0_VISIBILITIES.includes(requested)) {
    return { ok: false, reason: `visibility '${requested}' is not enabled in V0` };
  }

  // Layer-specific owner keys.
  const ownerCols = buildOwnerCols(input);
  if ("error" in ownerCols) return { ok: false, reason: ownerCols.error };

  const row = {
    ...ownerCols.cols,
    subject:        input.subject,
    predicate:      input.predicate,
    value_json:     input.value_json,
    unit:           input.unit ?? null,

    observed_at:    input.observed_at ?? nowIso,
    window_start:   input.window_start ?? null,
    window_end:     input.window_end ?? null,
    sample_size:    input.sample_size ?? 1,

    confidence:     input.confidence ?? "low",
    is_official:    input.is_official ?? false,
    is_verified:    input.is_verified ?? false,

    visible_to:     requested,

    source_engine:  input.source_engine,
    evidence_tables: input.evidence_tables ?? [],
    computed_at:    nowIso,
    decays_at:      input.decays_at ?? defaultDecayFor(input.subject),

    correction_of:  input.correction_of ?? null
  };

  const { data, error } = await supabaseAdmin
    .from(TABLES[input.layer])
    .insert(row)
    .select("id")
    .single();

  if (error) return { ok: false, reason: error.message };
  if (!data || !data.id) return { ok: false, reason: "insert returned no id" };
  return { ok: true, id: data.id };
}

// ─── Owner column resolution ────────────────────────────────────

type OwnerColsOk    = { cols: Record<string, string> };
type OwnerColsError = { error: string };

function buildOwnerCols(input: WriteMemoryInput): OwnerColsOk | OwnerColsError {
  switch (input.layer) {
    case "user":
      if (!input.owner_user_id) return { error: "user layer requires owner_user_id" };
      return { cols: { owner_user_id: input.owner_user_id } };
    case "company":
      if (!input.merchant_slug) return { error: "company layer requires merchant_slug" };
      return { cols: { merchant_slug: input.merchant_slug } };
    case "project":
      if (!input.merchant_slug || !input.project_id) return { error: "project layer requires merchant_slug + project_id" };
      return { cols: { merchant_slug: input.merchant_slug, project_id: input.project_id } };
  }
}
