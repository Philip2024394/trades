// POST /api/nex/comms-social/content/generate
// Body: { tenant_id, template_id, platform, created_by, source_pick? }
// Returns: { ok, draft }
//
// Runs the full pipeline: template-fill generator → grounding validator
// → persist draft. Never publishes.
import { NextResponse } from "next/server";
import { generateAndGround } from "@/lib/nex/comms-social/content/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: { tenant_id?: string; template_id?: string; platform?: string; created_by?: string; source_pick?: Record<string, string> };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.tenant_id || !body.template_id || !body.platform || !body.created_by) {
    return NextResponse.json({ ok: false, error: "tenant_id + template_id + platform + created_by required" }, { status: 400 });
  }
  try {
    const r = await generateAndGround({
      tenant_id:   body.tenant_id,
      template_id: body.template_id,
      platform:    body.platform,
      created_by:  body.created_by,
      source_pick: body.source_pick,
    });
    return NextResponse.json({ ok: true, draft: r.draft });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
