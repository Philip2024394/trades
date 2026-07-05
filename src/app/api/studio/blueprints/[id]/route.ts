// Single blueprint fetch.
//
//   GET /api/studio/blueprints/[id] → { ok, blueprint }
//
// Returns the full manifest for browser preview + install confirm.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { blueprintRegistry } from "@/lib/studio/blueprints";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const { id } = await ctx.params;
  const manifest = blueprintRegistry.get(id);
  if (!manifest) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, blueprint: manifest });
}
