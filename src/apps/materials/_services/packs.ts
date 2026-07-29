// Packs service · CRUD for hardwood packs
//
// Owner-scoped: every read/write filters by owner_id so a NEX user
// only ever sees packs they own. This service does not perform
// identity checks — that's the caller's responsibility (route handler
// after requireAuth()) — but every method accepts an ownerId so the
// filter is impossible to forget.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { audit } from "./_audit";
import {
  MaterialsError,
  type BoardDefectRow,
  type BoardMeasurementRow,
  type BoardWithCurrentMeasurement,
  type HardwoodPackRow,
  type PackStatus,
  type PackWithBoards,
  type SpeciesRow,
  type SupplierRow,
  type WorkerLinkRow,
} from "../_schema/types";

export type CreatePackInput = {
  pack_ref: string;
  species_id: string;
  supplier_id?: string | null;
  grade?: string | null;
  board_count_expected?: number | null;
  purchase_date?: string | null;
  purchase_reference?: string | null;
  cost_at_purchase?: number | null;
  cost_currency?: string;
  notes?: string | null;
};

export type UpdatePackInput = Partial<CreatePackInput> & {
  status?: PackStatus;
};

export async function listPacks(ownerId: string): Promise<HardwoodPackRow[]> {
  const { data, error } = await supabaseAdmin
    .from("nex_materials_hardwood_packs")
    .select("*")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new MaterialsError("internal", error.message, 500);
  return (data ?? []) as HardwoodPackRow[];
}

export async function getPack(ownerId: string, packId: string): Promise<PackWithBoards> {
  const { data: pack, error: packErr } = await supabaseAdmin
    .from("nex_materials_hardwood_packs")
    .select("*")
    .eq("id", packId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (packErr) throw new MaterialsError("internal", packErr.message, 500);
  if (!pack)   throw new MaterialsError("not_found", "pack not found", 404);

  // Fetch pack-scoped rows in two parallel waves so the board-scoped
  // lookups can use board_ids from the first wave.
  const [speciesRes, supplierRes, boardsRes, linksRes] = await Promise.all([
    supabaseAdmin.from("nex_materials_species").select("*").eq("id", pack.species_id).maybeSingle(),
    pack.supplier_id
      ? supabaseAdmin.from("nex_materials_suppliers").select("*").eq("id", pack.supplier_id).maybeSingle()
      : Promise.resolve({ data: null, error: null as null }),
    supabaseAdmin
      .from("nex_materials_hardwood_boards")
      .select("*")
      .eq("pack_id", packId)
      .is("deleted_at", null)
      .order("position_in_pack"),
    supabaseAdmin
      .from("nex_materials_worker_links")
      .select("*")
      .eq("pack_id", packId)
      .order("created_at", { ascending: false }),
  ]);

  if (speciesRes.error)      throw new MaterialsError("internal", speciesRes.error.message, 500);
  if (supplierRes.error)     throw new MaterialsError("internal", supplierRes.error.message, 500);
  if (boardsRes.error)       throw new MaterialsError("internal", boardsRes.error.message, 500);
  if (linksRes.error)        throw new MaterialsError("internal", linksRes.error.message, 500);
  if (!speciesRes.data)      throw new MaterialsError("internal", "species missing for pack", 500);

  const boardIds = (boardsRes.data ?? []).map(b => b.id);
  const [measurementsRes, defectsRes] = boardIds.length > 0
    ? await Promise.all([
        supabaseAdmin
          .from("nex_materials_hardwood_board_measurements")
          .select("*")
          .eq("is_current", true)
          .in("board_id", boardIds),
        supabaseAdmin
          .from("nex_materials_hardwood_board_defects")
          .select("*")
          .in("board_id", boardIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }] as const;

  if (measurementsRes.error) throw new MaterialsError("internal", measurementsRes.error.message, 500);
  if (defectsRes.error)      throw new MaterialsError("internal", defectsRes.error.message, 500);

  const measurementRows = (measurementsRes.data ?? []) as BoardMeasurementRow[];
  const defectRows      = (defectsRes.data ?? []) as BoardDefectRow[];

  const measurementsByBoard = new Map<string, BoardMeasurementRow>();
  for (const m of measurementRows) measurementsByBoard.set(m.board_id, m);

  const defectsByBoard = new Map<string, BoardDefectRow[]>();
  for (const d of defectRows) {
    const arr = defectsByBoard.get(d.board_id);
    if (arr) arr.push(d); else defectsByBoard.set(d.board_id, [d]);
  }

  const boards: BoardWithCurrentMeasurement[] = (boardsRes.data ?? []).map(b => ({
    ...b,
    current_measurement: measurementsByBoard.get(b.id) ?? null,
    defects: defectsByBoard.get(b.id) ?? [],
  }));

  return {
    ...pack,
    species: speciesRes.data as SpeciesRow,
    supplier: (supplierRes.data ?? null) as SupplierRow | null,
    boards,
    worker_links: (linksRes.data ?? []) as WorkerLinkRow[],
  } as PackWithBoards;
}

export async function createPack(ownerId: string, actorEmail: string, input: CreatePackInput): Promise<HardwoodPackRow> {
  if (!input.pack_ref?.trim()) throw new MaterialsError("invalid_input", "pack_ref required", 422);
  if (!input.species_id)       throw new MaterialsError("invalid_input", "species_id required", 422);

  const { data, error } = await supabaseAdmin
    .from("nex_materials_hardwood_packs")
    .insert({
      pack_ref:              input.pack_ref.trim(),
      species_id:            input.species_id,
      supplier_id:           input.supplier_id ?? null,
      grade:                 input.grade ?? null,
      board_count_expected:  input.board_count_expected ?? null,
      purchase_date:         input.purchase_date ?? null,
      purchase_reference:    input.purchase_reference ?? null,
      cost_at_purchase:      input.cost_at_purchase ?? null,
      cost_currency:         input.cost_currency ?? "GBP",
      notes:                 input.notes ?? null,
      status:                "pending",
      owner_id:              ownerId,
      created_by:            actorEmail,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new MaterialsError("conflict", `pack_ref '${input.pack_ref}' already exists`, 409);
    }
    throw new MaterialsError("internal", error.message, 500);
  }

  const row = data as HardwoodPackRow;
  await audit({
    entity_type: "pack",
    entity_id:   row.id,
    event_type:  "created",
    actor_kind:  "user",
    actor_ref:   actorEmail,
    after_json:  row,
  });
  return row;
}

export async function updatePack(
  ownerId: string,
  actorEmail: string,
  packId: string,
  input: UpdatePackInput,
): Promise<HardwoodPackRow> {
  const before = await supabaseAdmin
    .from("nex_materials_hardwood_packs")
    .select("*")
    .eq("id", packId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (before.error) throw new MaterialsError("internal", before.error.message, 500);
  if (!before.data) throw new MaterialsError("not_found", "pack not found", 404);

  const patch: Record<string, unknown> = {};
  if (input.pack_ref !== undefined)             patch.pack_ref = input.pack_ref;
  if (input.species_id !== undefined)           patch.species_id = input.species_id;
  if (input.supplier_id !== undefined)          patch.supplier_id = input.supplier_id;
  if (input.grade !== undefined)                patch.grade = input.grade;
  if (input.board_count_expected !== undefined) patch.board_count_expected = input.board_count_expected;
  if (input.purchase_date !== undefined)        patch.purchase_date = input.purchase_date;
  if (input.purchase_reference !== undefined)   patch.purchase_reference = input.purchase_reference;
  if (input.cost_at_purchase !== undefined)     patch.cost_at_purchase = input.cost_at_purchase;
  if (input.cost_currency !== undefined)        patch.cost_currency = input.cost_currency;
  if (input.notes !== undefined)                patch.notes = input.notes;
  if (input.status !== undefined)               patch.status = input.status;

  const { data, error } = await supabaseAdmin
    .from("nex_materials_hardwood_packs")
    .update(patch)
    .eq("id", packId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) throw new MaterialsError("internal", error.message, 500);

  await audit({
    entity_type: "pack",
    entity_id:   packId,
    event_type:  "updated",
    actor_kind:  "user",
    actor_ref:   actorEmail,
    before_json: before.data,
    after_json:  data,
    metadata:    { changed_fields: Object.keys(patch) },
  });

  return data as HardwoodPackRow;
}

export async function softDeletePack(
  ownerId: string,
  actorEmail: string,
  packId: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("nex_materials_hardwood_packs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", packId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw new MaterialsError("internal", error.message, 500);
  if (!data) throw new MaterialsError("not_found", "pack not found", 404);

  await audit({
    entity_type: "pack",
    entity_id:   packId,
    event_type:  "deleted",
    actor_kind:  "user",
    actor_ref:   actorEmail,
    before_json: data,
  });
}
