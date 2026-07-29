// POST /api/materials/nex/apply
// Body: NexAddStockDraft (the confirmation screen's final state)
// Returns: { ok: true, data: { memory_id, pack_id, boards_created, redirect_url } }
//
// The only NEX endpoint that mutates state. Executes the confirmed
// draft by delegating to the existing packs + boards + memory services
// via nex_apply.applyAddStockDraft. Nothing new is invented here.

import { requireAuth } from "@/lib/nex/brains/_auth";
import { applyAddStockDraft } from "@/apps/materials/_services/nex_apply";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";
import { MaterialsError } from "@/apps/materials/_schema/types";
import type { NexAddStockDraft } from "@/apps/materials/_schema/memory_types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));

    if (!body?.intent || body.intent.action !== "add_stock") {
      throw new MaterialsError("invalid_input", "Draft.intent must be an add_stock intent.", 422);
    }
    if (!body?.memory_action || !["use_existing", "create_new", "update_existing", "skip_memory"].includes(body.memory_action)) {
      throw new MaterialsError("invalid_input", "Draft.memory_action must be use_existing · create_new · update_existing · skip_memory.", 422);
    }

    const draft = body as NexAddStockDraft;
    const result = await applyAddStockDraft(user.email, user.email, draft);

    return okResponse({
      memory_id:      result.memory?.id ?? null,
      pack_id:        result.pack.id,
      boards_created: result.boards_created,
      redirect_url:   `/nex-app/materials/packs/${result.pack.id}`,
    }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
