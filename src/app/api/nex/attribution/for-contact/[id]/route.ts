// GET /api/nex/attribution/for-contact/{id}?model= · attribution chain for a contact
import { NextResponse } from "next/server";
import { listAttributionsForContact } from "@/lib/nex/attribution/engine";
import type { AttributionModel } from "@/lib/nex/attribution/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const model = url.searchParams.get("model") as AttributionModel | null;
  const rows = await listAttributionsForContact(id, model ?? undefined);
  return NextResponse.json({ ok: true, contact_id: id, attributions: rows });
}
