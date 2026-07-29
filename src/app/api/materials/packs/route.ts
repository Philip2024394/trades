// GET  /api/materials/packs         · list packs for current owner
// POST /api/materials/packs         · create a new pack
//
// Application Module (Layer 2) · session-authenticated · owner-scoped.

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/nex/brains/_auth";
import { createPack, listPacks } from "@/apps/materials/_services/packs";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuth();
    const packs = await listPacks(user.email);
    return okResponse(packs);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const pack = await createPack(user.email, user.email, body);
    return okResponse(pack, 201);
  } catch (e) {
    if ((e as { status?: number }).status === 401) {
      return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
    }
    return errorResponse(e);
  }
}
