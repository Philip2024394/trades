// POST /api/admin/nex/authoring/publish
// Persists parsed content to disk as .md + .meta.json.
// Sections auto-publish as "unreviewed" · Nex indexes them on next request.

import { NextResponse } from "next/server";
import { parseContent } from "@/lib/nex/authoring/parser";
import { publishParsed } from "@/lib/nex/authoring/writer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TOPIC_TYPES = new Set(["customer_facing", "business", "apprentice", "internal_notes"]);

// Auth removed 2026-08-01 · Philip authoring page is open access on local dev.
export async function POST(req: Request) {
  let body: { topic?: unknown; raw?: unknown; topic_type?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const raw = typeof body.raw === "string" ? body.raw : "";
  const topicType = typeof body.topic_type === "string" && VALID_TOPIC_TYPES.has(body.topic_type)
    ? (body.topic_type as "customer_facing" | "business" | "apprentice" | "internal_notes")
    : "customer_facing";
  if (!topic || raw.length < 40) {
    return NextResponse.json({ ok: false, error: "topic and raw content required" }, { status: 400 });
  }
  const parsed = parseContent(topic, raw, topicType);
  const write = publishParsed(parsed.file_title, parsed.file_slug, parsed.sections, topicType);
  return NextResponse.json({
    ok: true,
    file_slug: parsed.file_slug,
    file_title: parsed.file_title,
    topic_type: topicType,
    summary: parsed.summary,
    md_path: write.md_path,
    meta_path: write.meta_path,
    written_sections: write.written_sections,
    blocked_sections: write.blocked_sections,
  });
}
