// GET  /api/nex/journeys/{id}/triggers  · list triggers for a journey (all versions)
// POST /api/nex/journeys/{id}/triggers  · create a new trigger draft
import { NextResponse } from "next/server";
import { createTriggerDraft, listTriggersForJourney } from "@/lib/nex/journeys/triggers/registry";
import type { TriggerType } from "@/lib/nex/journeys/triggers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return NextResponse.json({ ok: true, triggers: await listTriggersForJourney(id) });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { trigger_key?: string; trigger_type?: TriggerType; trigger_config?: Record<string, unknown>; dedup_window_sec?: number };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.trigger_key || !body.trigger_type) return NextResponse.json({ ok: false, error: "trigger_key + trigger_type required" }, { status: 400 });
  const t = await createTriggerDraft({ journey_id: id, trigger_key: body.trigger_key, trigger_type: body.trigger_type, trigger_config: body.trigger_config, dedup_window_sec: body.dedup_window_sec });
  if (!t) return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, trigger: t });
}
