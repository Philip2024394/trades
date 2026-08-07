// GET  /api/nex/journeys           list all versions
// POST /api/nex/journeys           publish a new draft version (validates)
import { NextResponse } from "next/server";
import { listJourneys, publishDraft } from "@/lib/nex/journeys/registry";
import type { JourneyDefinition, TriggerType } from "@/lib/nex/journeys/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, journeys: await listJourneys() });
}

export async function POST(request: Request) {
  let body: { slug?: string; name?: string; description?: string; trigger_type?: TriggerType; trigger_config?: Record<string, unknown>; definition?: JourneyDefinition; created_by?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.slug || !body.name || !body.definition) return NextResponse.json({ ok: false, error: "slug + name + definition required" }, { status: 400 });
  const r = await publishDraft({
    slug: body.slug, name: body.name, description: body.description ?? null,
    trigger_type: body.trigger_type ?? "segment_join",
    trigger_config: body.trigger_config ?? {},
    definition: body.definition,
    created_by: body.created_by ?? null,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
