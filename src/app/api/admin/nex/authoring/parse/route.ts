// POST /api/admin/nex/authoring/parse
// Takes raw pasted content · returns structured sections + auto-check flags.

import { NextResponse } from "next/server";
import { parseContent } from "@/lib/nex/authoring/parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth removed 2026-08-01 · Philip authoring page is open access on local dev.
export async function POST(req: Request) {
  let body: { topic?: unknown; raw?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const raw = typeof body.raw === "string" ? body.raw : "";
  if (!topic || raw.length < 40) {
    return NextResponse.json({ ok: false, error: "topic and raw content required (content ≥ 40 chars)" }, { status: 400 });
  }
  const result = parseContent(topic, raw);
  return NextResponse.json({ ok: true, ...result });
}
