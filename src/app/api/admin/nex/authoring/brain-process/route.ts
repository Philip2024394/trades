// POST /api/admin/nex/authoring/brain-process
// Author Mode · single-shot pipeline · raw notes → LLM processor → Brain.
// No approval loops · returns summary bullets or ambiguities.

import { NextResponse } from "next/server";
import { processAuthorNotes } from "@/lib/nex/authoring/brain-processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth removed per Philip 2026-08-01 · local admin authoring.
export async function POST(req: Request) {
  let body: { raw?: unknown; topic?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const raw = typeof body.raw === "string" ? body.raw : "";
  const topic = typeof body.topic === "string" ? body.topic : undefined;
  if (raw.length < 40) {
    return NextResponse.json({ ok: false, error: "need at least 40 characters of notes" }, { status: 400 });
  }
  try {
    const result = await processAuthorNotes(raw, topic);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "brain processor failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
