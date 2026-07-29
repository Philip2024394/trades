// POST /api/materials/packs/[packId]/boards
// Body: { count: 60 }  OR  { refs: ["1","2","3"] }
//
// Bulk-create boards inside a pack. Owner-scoped.

import { requireAuth } from "@/lib/nex/brains/_auth";
import { createBoards } from "@/apps/materials/_services/boards";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ packId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireAuth();
    const { packId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const rows = await createBoards(user.email, user.email, packId, body);
    return okResponse(rows, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
