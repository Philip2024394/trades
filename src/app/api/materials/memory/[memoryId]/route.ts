// GET   /api/materials/memory/[memoryId]  · fetch one Memory item
// PATCH /api/materials/memory/[memoryId]  · update fields

import { requireAuth } from "@/lib/nex/brains/_auth";
import { getMemory, updateMemory } from "@/apps/materials/_services/memory";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ memoryId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireAuth();
    const { memoryId } = await ctx.params;
    const row = await getMemory(user.email, memoryId);
    return okResponse(row);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireAuth();
    const { memoryId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const row = await updateMemory(user.email, user.email, memoryId, body);
    return okResponse(row);
  } catch (e) {
    return errorResponse(e);
  }
}
