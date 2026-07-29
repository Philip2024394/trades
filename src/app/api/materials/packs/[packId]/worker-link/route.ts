// POST /api/materials/packs/[packId]/worker-link
// Body: { label?: string, expires_at?: ISO, max_uses?: number }
//
// Mint a new worker link for this pack. Returns the token exactly once —
// the token is never exposed by list APIs. Owner must store the URL
// somewhere accessible to the worker (WhatsApp, printed QR, etc.).

import { requireAuth } from "@/lib/nex/brains/_auth";
import { createWorkerLink } from "@/apps/materials/_services/worker_links";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ packId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireAuth();
    const { packId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const link = await createWorkerLink(user.email, user.email, {
      pack_id:    packId,
      label:      body.label ?? null,
      expires_at: body.expires_at ?? null,
      max_uses:   body.max_uses ?? null,
    });
    return okResponse(link, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
