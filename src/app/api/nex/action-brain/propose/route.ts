// src/app/api/nex/action-brain/propose/route.ts
// Founder Path A/B · ECO-2 · Action Brain propose endpoint.
// Every proposal traverses the 7-stage authorize pipeline (Doctrine #2).

import { NextResponse } from "next/server";
import { makeActionBrain } from "@/lib/nex/action-brain";

const brain = makeActionBrain();
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty */ }
  const action_id = typeof body.action_id === "string" ? body.action_id : "";
  const args = (body.args && typeof body.args === "object") ? body.args as Record<string, unknown> : {};
  if (!action_id) {
    return NextResponse.json({ error: "action_id_required" }, { status: 400 });
  }
  try {
    const record = await brain.propose({
      action_id,
      args,
      rationale: typeof body.rationale === "string" ? body.rationale : undefined,
      conversation_id: typeof body.conversation_id === "string" ? body.conversation_id : null,
      entity_ref: typeof body.entity_ref === "string" ? body.entity_ref : null,
      language: body.language === "id" ? "id" : "en",
      user_id: typeof body.user_id === "string" ? body.user_id : null,
    });
    return NextResponse.json({ record });
  } catch (e) {
    return NextResponse.json({
      error: "propose_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
