// Boards service · create / list boards within a pack

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { audit } from "./_audit";
import {
  MaterialsError,
  type HardwoodBoardRow,
} from "../_schema/types";

export type CreateBoardsInput = {
  count?: number;                          // if provided, auto-generate refs 1..N
  refs?: string[];                         // else, explicit refs
  starting_position?: number;              // for auto refs, position start (default = last+1)
};

/** Create boards in bulk for a pack. Returns the inserted rows. */
export async function createBoards(
  ownerId: string,
  actorEmail: string,
  packId: string,
  input: CreateBoardsInput,
): Promise<HardwoodBoardRow[]> {
  // Verify pack belongs to owner
  const pack = await supabaseAdmin
    .from("nex_materials_hardwood_packs")
    .select("id, owner_id, deleted_at")
    .eq("id", packId)
    .maybeSingle();
  if (pack.error) throw new MaterialsError("internal", pack.error.message, 500);
  if (!pack.data || pack.data.owner_id !== ownerId || pack.data.deleted_at) {
    throw new MaterialsError("not_found", "pack not found", 404);
  }

  // Determine refs to create
  let refs: string[];
  let startPos: number;

  const lastPos = await supabaseAdmin
    .from("nex_materials_hardwood_boards")
    .select("position_in_pack")
    .eq("pack_id", packId)
    .is("deleted_at", null)
    .order("position_in_pack", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastPos.error) throw new MaterialsError("internal", lastPos.error.message, 500);
  startPos = input.starting_position ?? ((lastPos.data?.position_in_pack ?? 0) + 1);

  if (input.refs && input.refs.length > 0) {
    refs = input.refs.map(r => r.trim()).filter(Boolean);
  } else if (input.count && input.count > 0) {
    if (input.count > 500) throw new MaterialsError("invalid_input", "cannot create more than 500 boards per request", 422);
    refs = Array.from({ length: input.count }, (_, i) => String(startPos + i));
  } else {
    throw new MaterialsError("invalid_input", "provide either `refs` or `count`", 422);
  }

  const rows = refs.map((ref, i) => ({
    pack_id:          packId,
    board_ref:        ref,
    position_in_pack: startPos + i,
    status:           "awaiting_measurement" as const,
  }));

  const { data, error } = await supabaseAdmin
    .from("nex_materials_hardwood_boards")
    .insert(rows)
    .select("*");
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new MaterialsError("conflict", "one or more board refs already exist in this pack", 409);
    }
    throw new MaterialsError("internal", error.message, 500);
  }

  const inserted = (data ?? []) as HardwoodBoardRow[];
  for (const b of inserted) {
    await audit({
      entity_type: "board",
      entity_id:   b.id,
      event_type:  "created",
      actor_kind:  "user",
      actor_ref:   actorEmail,
      after_json:  b,
    });
  }
  return inserted;
}

export async function getBoard(boardId: string): Promise<HardwoodBoardRow> {
  const { data, error } = await supabaseAdmin
    .from("nex_materials_hardwood_boards")
    .select("*")
    .eq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new MaterialsError("internal", error.message, 500);
  if (!data)  throw new MaterialsError("not_found", "board not found", 404);
  return data as HardwoodBoardRow;
}

export async function updateBoardStatus(
  actorKind: "user" | "worker_link",
  actorRef: string,
  boardId: string,
  status: HardwoodBoardRow["status"],
): Promise<void> {
  const before = await getBoard(boardId);
  const { error } = await supabaseAdmin
    .from("nex_materials_hardwood_boards")
    .update({ status })
    .eq("id", boardId);
  if (error) throw new MaterialsError("internal", error.message, 500);

  await audit({
    entity_type: "board",
    entity_id:   boardId,
    event_type:  "status_changed",
    actor_kind:  actorKind,
    actor_ref:   actorRef,
    before_json: { status: before.status },
    after_json:  { status },
  });
}
