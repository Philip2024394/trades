// GET /api/worker/[token]/validate
// Public token-authenticated endpoint. Worker portal calls this on load
// to confirm the token is still valid + fetch the pack + board list
// they need to measure.

import { validateAndTouchWorkerToken } from "@/apps/materials/_services/worker_links";
import { getPack } from "@/apps/materials/_services/packs";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";
// ROUTING FIX (Philip 2026-08-13 · Supabase-project audit): nex_materials_*
// tables live in the NEX project (ijvqdv...). Previously imported the trades
// supabaseAdmin (msdonk... project) which held an empty shell of the same
// table — reads silently returned 0 rows. Now points at the correct client.
import { supabaseNexAdmin as supabaseAdmin } from "@/lib/supabaseNexAdmin";
import { MaterialsError } from "@/apps/materials/_schema/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");
    const ua = req.headers.get("user-agent");
    const { link, pack } = await validateAndTouchWorkerToken(token, { ip, user_agent: ua });

    // Worker gets a scoped view — we fetch pack via the pack's owner
    // to bypass the owner_id filter on getPack(). We reuse getPack for
    // consistency but need to pass the pack's real owner_id.
    const packOwnerRes = await supabaseAdmin
      .from("nex_materials_hardwood_packs")
      .select("owner_id")
      .eq("id", pack.id)
      .maybeSingle();
    if (packOwnerRes.error || !packOwnerRes.data) {
      throw new MaterialsError("internal", "pack owner lookup failed", 500);
    }
    const packDetail = await getPack(packOwnerRes.data.owner_id, pack.id);

    // Never expose the token back to the worker
    const linkPublic = {
      id:            link.id,
      label:         link.label,
      pack_id:       link.pack_id,
      expires_at:    link.expires_at,
      max_uses:      link.max_uses,
      current_uses:  link.current_uses,
    };

    // Trim boards down to fields the worker needs (no cost / no supplier info)
    const workerView = {
      link: linkPublic,
      pack: {
        id:             packDetail.id,
        pack_ref:       packDetail.pack_ref,
        grade:          packDetail.grade,
        status:         packDetail.status,
        species: {
          id:           packDetail.species.id,
          display_name: packDetail.species.display_name,
        },
        board_count_expected: packDetail.board_count_expected,
      },
      boards: packDetail.boards.map(b => ({
        id:                b.id,
        board_ref:         b.board_ref,
        position_in_pack:  b.position_in_pack,
        status:            b.status,
        current_measurement: b.current_measurement
          ? {
              measurement_version: b.current_measurement.measurement_version,
              length_mm:           b.current_measurement.length_mm,
              width_centre_mm:     b.current_measurement.width_centre_mm,
              thickness_centre_mm: b.current_measurement.thickness_centre_mm,
              measured_at:         b.current_measurement.measured_at,
            }
          : null,
      })),
    };
    return okResponse(workerView);
  } catch (e) {
    return errorResponse(e);
  }
}
