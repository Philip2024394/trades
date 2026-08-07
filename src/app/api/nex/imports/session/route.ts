// POST /api/nex/imports/session — create wizard session from uploaded file
//
// Body: { content: string, file_name?: string, format_hint?: "csv"|"tsv", admin_actor?: string }
// Returns: full session view (no raw rows) with auto-detected format,
// parsed header, auto-mapping, and initial state = "uploaded" (or "failed"
// with an error message when parsing/format detection fails).

import { NextResponse } from "next/server";
import { createSession } from "@/lib/nex/imports/runtime";
import { suggestMappingProfile } from "@/lib/nex/imports/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  let body: { content?: string; file_name?: string; format_hint?: "csv" | "tsv"; admin_actor?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  if (!body.content || typeof body.content !== "string") {
    return NextResponse.json({ ok: false, error: "content_required", detail: "Body must include { content: string }" }, { status: 400 });
  }

  const session = createSession({
    content: body.content,
    file_name: body.file_name ?? null,
    format_hint: body.format_hint,
    admin_actor: body.admin_actor ?? null,
  });

  // Best-effort mapping-profile suggestion (matched by header signature).
  const suggestion = session.header_signature
    ? await suggestMappingProfile(session.header_signature).catch(() => null)
    : null;

  return NextResponse.json({
    ok: session.state !== "failed",
    session,
    suggested_profile: suggestion,
  });
}
