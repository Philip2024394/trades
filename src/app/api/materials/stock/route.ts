// GET /api/materials/stock
// Returns aggregate stock across all packs owned by the current user.
// This is the surface future NEX orchestration reads to answer
// "do I have enough oak?" type questions.

import { requireAuth } from "@/lib/nex/brains/_auth";
import { stockSummaryForOwner } from "@/apps/materials/_services/stock";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuth();
    const summary = await stockSummaryForOwner(user.email);
    return okResponse(summary);
  } catch (e) {
    return errorResponse(e);
  }
}
