// POST /api/nex/segments/preview — preview a filter without saving
// Body: { filter: AudienceFilter }
import { NextResponse } from "next/server";
import { previewAudience } from "@/lib/nex/segments/preview";
import type { AudienceFilter } from "@/lib/nex/segments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { filter?: AudienceFilter };
  try { body = await request.json() as { filter?: AudienceFilter }; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const filter = body.filter ?? {};
  const preview = await previewAudience(filter);
  return NextResponse.json({ ok: true, ...preview });
}
