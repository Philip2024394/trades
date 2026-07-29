// Allocation service · reserve boards against projects
//
// Simple v1: a board can be either wholly allocated or not. Partial
// allocation (portion_mm3) is schema-supported but not exposed in the
// v1 API — added when Projects module lands.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { audit } from "./_audit";
import { updateBoardStatus } from "./boards";
import {
  MaterialsError,
  type AllocationRow,
} from "../_schema/types";

export type AllocateBoardInput = {
  board_id: string;
  project_ref: string;
  notes?: string | null;
};

export async function allocateBoard(
  actorEmail: string,
  input: AllocateBoardInput,
): Promise<AllocationRow> {
  // Check for existing active allocation
  const existing = await supabaseAdmin
    .from("nex_materials_hardwood_allocations")
    .select("id")
    .eq("board_id", input.board_id)
    .is("released_at", null)
    .maybeSingle();
  if (existing.error) throw new MaterialsError("internal", existing.error.message, 500);
  if (existing.data)  throw new MaterialsError("conflict", "board already allocated", 409);

  const { data, error } = await supabaseAdmin
    .from("nex_materials_hardwood_allocations")
    .insert({
      board_id:      input.board_id,
      project_ref:   input.project_ref,
      portion_mm3:   null,
      allocated_by:  actorEmail,
      notes:         input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw new MaterialsError("internal", error.message, 500);

  await updateBoardStatus("user", actorEmail, input.board_id, "allocated");

  const row = data as AllocationRow;
  await audit({
    entity_type: "allocation",
    entity_id:   row.id,
    event_type:  "created",
    actor_kind:  "user",
    actor_ref:   actorEmail,
    after_json:  row,
  });
  return row;
}

export async function releaseAllocation(
  actorEmail: string,
  allocationId: string,
  reason: string,
): Promise<void> {
  const existing = await supabaseAdmin
    .from("nex_materials_hardwood_allocations")
    .select("*")
    .eq("id", allocationId)
    .is("released_at", null)
    .maybeSingle();
  if (existing.error) throw new MaterialsError("internal", existing.error.message, 500);
  if (!existing.data)  throw new MaterialsError("not_found", "allocation not found or already released", 404);

  const { error } = await supabaseAdmin
    .from("nex_materials_hardwood_allocations")
    .update({
      released_at:      new Date().toISOString(),
      released_by:      actorEmail,
      released_reason:  reason,
    })
    .eq("id", allocationId);
  if (error) throw new MaterialsError("internal", error.message, 500);

  await updateBoardStatus("user", actorEmail, existing.data.board_id, "measured");

  await audit({
    entity_type: "allocation",
    entity_id:   allocationId,
    event_type:  "released",
    actor_kind:  "user",
    actor_ref:   actorEmail,
    metadata:    { reason, board_id: existing.data.board_id },
  });
}
