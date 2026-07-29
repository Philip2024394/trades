// Materials Memory service · CRUD + fuzzy-match resolver
//
// Materials Memory is the company's knowledge of the products it works
// with. Distinct concern from Stock (transactional). Every read/write
// scopes by owner_id — a Materials Memory item is per-company, never
// shared globally.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { audit } from "./_audit";
import { MaterialsError } from "../_schema/types";
import type {
  MemoryCategory,
  MemoryDefaultUnit,
  MemoryMatch,
  MemoryRow,
} from "../_schema/memory_types";

export type CreateMemoryInput = {
  name: string;
  category: MemoryCategory;
  species_id?: string | null;
  default_length_mm?: number | null;
  default_width_mm?: number | null;
  default_thickness_mm?: number | null;
  default_unit?: MemoryDefaultUnit;
  typical_grade?: string | null;
  preferred_supplier_id?: string | null;
  typical_price_per_unit?: number | null;
  price_currency?: string;
  notes?: string | null;
  synonyms?: string[];
};

export type UpdateMemoryInput = Partial<CreateMemoryInput>;

// ── CRUD ─────────────────────────────────────────────────────────

export async function listMemory(ownerId: string): Promise<MemoryRow[]> {
  const { data, error } = await supabaseAdmin
    .from("nex_materials_memory")
    .select("*")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("usage_count", { ascending: false })
    .order("name",       { ascending: true });
  if (error) throw new MaterialsError("internal", error.message, 500);
  return (data ?? []) as MemoryRow[];
}

export async function getMemory(ownerId: string, id: string): Promise<MemoryRow> {
  const { data, error } = await supabaseAdmin
    .from("nex_materials_memory")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new MaterialsError("internal", error.message, 500);
  if (!data)  throw new MaterialsError("not_found", "memory item not found", 404);
  return data as MemoryRow;
}

export async function createMemory(
  ownerId: string,
  actorEmail: string,
  input: CreateMemoryInput,
): Promise<MemoryRow> {
  if (!input.name?.trim()) throw new MaterialsError("invalid_input", "name required", 422);
  if (!input.category)     throw new MaterialsError("invalid_input", "category required", 422);

  const insertPayload = {
    owner_id:                ownerId,
    name:                    input.name.trim(),
    category:                input.category,
    species_id:              input.species_id ?? null,
    default_length_mm:       input.default_length_mm ?? null,
    default_width_mm:        input.default_width_mm ?? null,
    default_thickness_mm:    input.default_thickness_mm ?? null,
    default_unit:            input.default_unit ?? "board",
    typical_grade:           input.typical_grade ?? null,
    preferred_supplier_id:   input.preferred_supplier_id ?? null,
    typical_price_per_unit:  input.typical_price_per_unit ?? null,
    price_currency:          input.price_currency ?? "GBP",
    notes:                   input.notes ?? null,
    synonyms:                (input.synonyms ?? []).map(s => s.trim()).filter(Boolean),
    created_by:              actorEmail,
  };

  const { data, error } = await supabaseAdmin
    .from("nex_materials_memory")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new MaterialsError("conflict", `Memory item '${input.name}' already exists`, 409);
    }
    throw new MaterialsError("internal", error.message, 500);
  }

  const row = data as MemoryRow;
  await audit({
    entity_type: "supplier",           // reuse existing enum · closest to a "reference entity"
    entity_id:   row.id,
    event_type:  "memory_created",
    actor_kind:  "user",
    actor_ref:   actorEmail,
    after_json:  row,
    metadata:    { source: "materials_memory" },
  });
  return row;
}

export async function updateMemory(
  ownerId: string,
  actorEmail: string,
  id: string,
  input: UpdateMemoryInput,
): Promise<MemoryRow> {
  const before = await getMemory(ownerId, id);

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined)                   patch.name = input.name.trim();
  if (input.category !== undefined)               patch.category = input.category;
  if (input.species_id !== undefined)             patch.species_id = input.species_id;
  if (input.default_length_mm !== undefined)      patch.default_length_mm = input.default_length_mm;
  if (input.default_width_mm !== undefined)       patch.default_width_mm = input.default_width_mm;
  if (input.default_thickness_mm !== undefined)   patch.default_thickness_mm = input.default_thickness_mm;
  if (input.default_unit !== undefined)           patch.default_unit = input.default_unit;
  if (input.typical_grade !== undefined)          patch.typical_grade = input.typical_grade;
  if (input.preferred_supplier_id !== undefined)  patch.preferred_supplier_id = input.preferred_supplier_id;
  if (input.typical_price_per_unit !== undefined) patch.typical_price_per_unit = input.typical_price_per_unit;
  if (input.price_currency !== undefined)         patch.price_currency = input.price_currency;
  if (input.notes !== undefined)                  patch.notes = input.notes;
  if (input.synonyms !== undefined)               patch.synonyms = input.synonyms.map(s => s.trim()).filter(Boolean);

  const { data, error } = await supabaseAdmin
    .from("nex_materials_memory")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) throw new MaterialsError("internal", error.message, 500);

  await audit({
    entity_type: "supplier",
    entity_id:   id,
    event_type:  "memory_updated",
    actor_kind:  "user",
    actor_ref:   actorEmail,
    before_json: before,
    after_json:  data,
    metadata:    { source: "materials_memory", fields: Object.keys(patch) },
  });
  return data as MemoryRow;
}

export async function touchMemoryUsage(id: string): Promise<void> {
  // Fire-and-forget increment — don't fail the workflow if this fails.
  supabaseAdmin
    .rpc("increment_memory_usage", { p_id: id })   // fallback if RPC missing:
    .then(({ error }) => {
      if (error) {
        // Fallback: read-modify-write
        supabaseAdmin
          .from("nex_materials_memory")
          .select("usage_count")
          .eq("id", id)
          .maybeSingle()
          .then(({ data }) => {
            if (!data) return;
            supabaseAdmin
              .from("nex_materials_memory")
              .update({
                usage_count:  (data.usage_count ?? 0) + 1,
                last_used_at: new Date().toISOString(),
              })
              .eq("id", id)
              .then(({ error: e }) => {
                if (e) console.error("[materials.memory] touchUsage fallback failed", e);
              });
          });
      }
    });
}

// ── Resolver ─────────────────────────────────────────────────────

/**
 * Resolve a natural-language material query against this owner's Memory.
 *
 * Strategy:
 *   1. Exact case-insensitive name match
 *   2. Case-insensitive synonym array containment
 *   3. Trigram similarity on name (threshold 0.35)
 *   4. Otherwise `none`
 */
export async function findMemoryByQuery(ownerId: string, query: string): Promise<MemoryMatch> {
  const q = query.trim();
  if (!q) return { kind: "none" };
  const lower = q.toLowerCase();

  // 1. Exact case-insensitive
  const exact = await supabaseAdmin
    .from("nex_materials_memory")
    .select("*")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .ilike("name", q)
    .maybeSingle();
  if (exact.error) throw new MaterialsError("internal", exact.error.message, 500);
  if (exact.data) return { kind: "exact", row: exact.data as MemoryRow };

  // 2. Synonym containment
  const syn = await supabaseAdmin
    .from("nex_materials_memory")
    .select("*")
    .eq("owner_id", ownerId)
    .is("deleted_at", null);
  if (syn.error) throw new MaterialsError("internal", syn.error.message, 500);
  const rows = (syn.data ?? []) as MemoryRow[];
  const synHit = rows.find(r => r.synonyms.some(s => s.toLowerCase() === lower));
  if (synHit) return { kind: "synonym", row: synHit };

  // 3. Fuzzy — Jaccard-ish token overlap since we already have all rows in memory
  //    for this owner (owner-scoped, small N). Cheaper than a trgm query round-trip.
  const queryTokens = tokenise(lower);
  let best: { row: MemoryRow; similarity: number } | null = null;
  for (const r of rows) {
    const nameTokens = tokenise(r.name.toLowerCase());
    const sim = jaccard(queryTokens, nameTokens);
    if (sim >= 0.35 && (!best || sim > best.similarity)) {
      best = { row: r, similarity: sim };
    }
  }
  if (best) return { kind: "fuzzy", ...best };

  return { kind: "none" };
}

function tokenise(s: string): Set<string> {
  return new Set(s.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length >= 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
