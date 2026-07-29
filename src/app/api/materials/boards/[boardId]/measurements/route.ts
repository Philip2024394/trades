// POST /api/materials/boards/[boardId]/measurements
// Body: { length_mm, width_end_a_mm, width_centre_mm, width_end_b_mm,
//         thickness_end_a_mm, thickness_centre_mm, thickness_end_b_mm,
//         moisture_content_pct?, photo_url?, notes? }
//
// Admin surface — for a user recording a measurement themselves.
// Workers use POST /api/worker/[token]/measurements instead.

import { requireAuth } from "@/lib/nex/brains/_auth";
import { recordMeasurement } from "@/apps/materials/_services/measurements";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ boardId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireAuth();
    const { boardId } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const measurement = await recordMeasurement("hardwood", {
      board_id: boardId,
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
      measured_by_kind:      "user",
      measured_by_ref:       user.email,
    });

    return okResponse(measurement, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
