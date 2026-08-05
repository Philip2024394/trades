// POST /api/nex/knowledge-inbox/dump
//
// Persists one text dump (Quick Dump textarea, note, or any typed
// content) to disk. Body:
//   { source: KnowledgeSource, title?: string, content: string }
//
// Returns the created item, or the existing duplicate if the sha256
// hash matches something already in the inbox. Duplicate detection
// is per the Knowledge Source doctrine: NEX never stores the same
// content twice.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { coerceSource, saveTextItem } from "@/lib/nex/knowledge-inbox/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { source?: unknown; title?: unknown; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ ok: false, error: "empty_content" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : undefined;
  const source = coerceSource(body.source);

  try {
    const { item, deduplicated } = await saveTextItem({ source, title, content });
    return NextResponse.json({ ok: true, item, deduplicated });
  } catch (err) {
    console.error("[knowledge-inbox.dump] save failed:", err);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }
}
