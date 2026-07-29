// GET  /api/materials/memory       · list Memory items for current owner
// POST /api/materials/memory       · create a new Memory item

import { requireAuth } from "@/lib/nex/brains/_auth";
import { createMemory, listMemory } from "@/apps/materials/_services/memory";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuth();
    const items = await listMemory(user.email);
    return okResponse(items);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const row = await createMemory(user.email, user.email, body);
    return okResponse(row, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
