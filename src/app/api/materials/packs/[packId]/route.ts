// GET    /api/materials/packs/[packId]   · pack detail with boards + measurements
// PATCH  /api/materials/packs/[packId]   · update pack fields
// DELETE /api/materials/packs/[packId]   · soft-delete pack

import { requireAuth } from "@/lib/nex/brains/_auth";
import { getPack, softDeletePack, updatePack } from "@/apps/materials/_services/packs";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ packId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireAuth();
    const { packId } = await ctx.params;
    const pack = await getPack(user.email, packId);
    return okResponse(pack);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireAuth();
    const { packId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const pack = await updatePack(user.email, user.email, packId, body);
    return okResponse(pack);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const user = await requireAuth();
    const { packId } = await ctx.params;
    await softDeletePack(user.email, user.email, packId);
    return okResponse({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
