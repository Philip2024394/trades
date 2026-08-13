// Measurements service · append-only versioned measurements per board
//
// Rules:
//   · Every measurement gets a monotonically-increasing measurement_version
//     within its board (v1 · v2 · v3 …)
//   · New measurement flips is_current=true on the new row and is_current=false
//     on every previous row for the same board
//   · The board's current_measurement_id + updated_at are refreshed
//   · Board status auto-flips to 'measured' if it was 'awaiting_measurement'
//   · Never delete measurements — historical record is the whole point

import "server-only";
// ROUTING FIX (Philip 2026-08-13 · Supabase-project audit): nex_materials_*
// tables live in the NEX project (ijvqdv...). Previously imported the trades
// supabaseAdmin (msdonk... project) with an empty shell of the same table.
import { supabaseNexAdmin as supabaseAdmin } from "@/lib/supabaseNexAdmin";
import { audit } from "./_audit";
import { getProvider } from "../_providers";
import type { NewMeasurementInput } from "../_providers";
import {
  MaterialsError,
  type BoardMeasurementRow,
  type MaterialCategory,
} from "../_schema/types";

export async function recordMeasurement(
  category: MaterialCategory,
  input: NewMeasurementInput,
): Promise<BoardMeasurementRow> {
  const provider = getProvider(category);
  provider.validateMeasurement(input);

  // Look up current highest version for this board
  const versionRes = await supabaseAdmin
    .from("nex_materials_hardwood_board_measurements")
    .select("measurement_version")
    .eq("board_id", input.board_id)
    .order("measurement_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionRes.error) throw new MaterialsError("internal", versionRes.error.message, 500);
  const nextVersion = (versionRes.data?.measurement_version ?? 0) + 1;

  // Verify board exists + not deleted
  const boardRes = await supabaseAdmin
    .from("nex_materials_hardwood_boards")
    .select("id, status, deleted_at")
    .eq("id", input.board_id)
    .maybeSingle();
  if (boardRes.error) throw new MaterialsError("internal", boardRes.error.message, 500);
  if (!boardRes.data || boardRes.data.deleted_at) {
    throw new MaterialsError("not_found", "board not found", 404);
  }

  // Insert new measurement
  const insertRes = await supabaseAdmin
    .from("nex_materials_hardwood_board_measurements")
    .insert({
      board_id:              input.board_id,
      measurement_version:   nextVersion,
      is_current:            true,
      length_mm:             input.length_mm,
      width_end_a_mm:        input.width_end_a_mm,
      width_centre_mm:       input.width_centre_mm,
      width_end_b_mm:        input.width_end_b_mm,
      thickness_end_a_mm:    input.thickness_end_a_mm,
      thickness_centre_mm:   input.thickness_centre_mm,
      thickness_end_b_mm:    input.thickness_end_b_mm,
      moisture_content_pct:  input.moisture_content_pct ?? null,
      photo_url:             input.photo_url ?? null,
      notes:                 input.notes ?? null,
      measured_by_kind:      input.measured_by_kind,
      measured_by_ref:       input.measured_by_ref,
    })
    .select("*")
    .single();
  if (insertRes.error) throw new MaterialsError("internal", insertRes.error.message, 500);
  const measurement = insertRes.data as BoardMeasurementRow;

  // Flip is_current=false on all previous versions
  if (nextVersion > 1) {
    const clearRes = await supabaseAdmin
      .from("nex_materials_hardwood_board_measurements")
      .update({ is_current: false })
      .eq("board_id", input.board_id)
      .neq("id", measurement.id);
    if (clearRes.error) {
      console.error("[materials.measurements] failed to clear previous is_current flags", clearRes.error);
    }
  }

  // Update board's current_measurement_id + auto-flip status
  const patch: Record<string, unknown> = { current_measurement_id: measurement.id };
  if (boardRes.data.status === "awaiting_measurement") {
    patch.status = "measured";
  }
  const boardUpdate = await supabaseAdmin
    .from("nex_materials_hardwood_boards")
    .update(patch)
    .eq("id", input.board_id);
  if (boardUpdate.error) throw new MaterialsError("internal", boardUpdate.error.message, 500);

  await audit({
    entity_type: "measurement",
    entity_id:   measurement.id,
    event_type:  "recorded",
    actor_kind:  input.measured_by_kind,
    actor_ref:   input.measured_by_ref,
    after_json:  measurement,
    metadata:    { board_id: input.board_id, version: nextVersion },
  });

  return measurement;
}

export async function listMeasurementsForBoard(boardId: string): Promise<BoardMeasurementRow[]> {
  const { data, error } = await supabaseAdmin
    .from("nex_materials_hardwood_board_measurements")
    .select("*")
    .eq("board_id", boardId)
    .order("measurement_version", { ascending: false });
  if (error) throw new MaterialsError("internal", error.message, 500);
  return (data ?? []) as BoardMeasurementRow[];
}
