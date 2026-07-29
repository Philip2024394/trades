// POST /api/worker/[token]/measurements
// Body: { board_id, length_mm, width_end_a_mm, width_centre_mm, width_end_b_mm,
//         thickness_end_a_mm, thickness_centre_mm, thickness_end_b_mm,
//         moisture_content_pct?, photo_url?, notes? }
//
// Token-authenticated. Verifies board belongs to the token's pack before
// recording. Every measurement carries measured_by_kind='worker_link'
// + measured_by_ref=<link.id> for audit trail.

import { validateAndTouchWorkerToken } from "@/apps/materials/_services/worker_links";
import { recordMeasurement } from "@/apps/materials/_services/measurements";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MaterialsError } from "@/apps/materials/_schema/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");
    const ua = req.headers.get("user-agent");
    const { link, pack } = await validateAndTouchWorkerToken(token, { ip, user_agent: ua });

    const body = await req.json().catch(() => ({}));

    if (!body.board_id || typeof body.board_id !== "string") {
      throw new MaterialsError("invalid_input", "board_id required", 422);
    }

    // Verify board is inside this token's pack — critical scoping check
    const boardRes = await supabaseAdmin
      .from("nex_materials_hardwood_boards")
      .select("id, pack_id, deleted_at")
      .eq("id", body.board_id)
      .maybeSingle();
    if (boardRes.error) throw new MaterialsError("internal", boardRes.error.message, 500);
    if (!boardRes.data) throw new MaterialsError("not_found", "board not found", 404);
    if (boardRes.data.deleted_at) throw new MaterialsError("board_deleted", "board deleted", 404);
    if (boardRes.data.pack_id !== pack.id) {
      throw new MaterialsError("forbidden", "board does not belong to this pack", 403);
    }

    const measurement = await recordMeasurement("hardwood", {
      board_id:              body.board_id,
      length_mm:             Number(body.length_mm),
      width_end_a_mm:        Number(body.width_end_a_mm),
      width_centre_mm:       Number(body.width_centre_mm),
      width_end_b_mm:        Number(body.width_end_b_mm),
      thickness_end_a_mm:    Number(body.thickness_end_a_mm),
      thickness_centre_mm:   Number(body.thickness_centre_mm),
      thickness_end_b_mm:    Number(body.thickness_end_b_mm),
      moisture_content_pct:  body.moisture_content_pct != null ? Number(body.moisture_content_pct) : null,
      photo_url:             body.photo_url ?? null,
      notes:                 body.notes ?? null,
      measured_by_kind:      "worker_link",
      measured_by_ref:       link.id,
    });

    return okResponse({
      measurement_version: measurement.measurement_version,
      board_id:            measurement.board_id,
      measured_at:         measurement.measured_at,
    }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
