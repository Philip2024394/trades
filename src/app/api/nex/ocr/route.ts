// src/app/api/nex/ocr/route.ts
//
// Founder Phase 22 · P22-3 · Dedicated OCR endpoint.
//
// POST body: { content_base64, mime_type, filename?, conversation_id? }
//
// Doctrine anchors:
//   ocr-doctrine · OCR text is INPUT · never establishes truth
//   #5 · extracted text runs through the untrusted-content sanitiser
//
// Uses the same file-extraction infrastructure so provenance flows into
// nex.file_extraction alongside PDF and DOCX extractions.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { extractFile, persistExtraction } from "@/lib/nex/file-extraction";
import { FileExtractRequestSchema } from "@/lib/nex/file-extraction/contract";
import { sanitiseUntrustedContent } from "@/lib/nex/live-chat-completion/safety/untrusted-content-sanitiser";

const IMAGE_MIMES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/bmp", "image/tiff",
]);

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const parsed = FileExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", detail: parsed.error.flatten() }, { status: 400 });
  }
  if (!IMAGE_MIMES.has(parsed.data.mime_type)) {
    return NextResponse.json({
      error: "unsupported_mime_for_ocr",
      supported: [...IMAGE_MIMES],
    }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  const conversation_id = typeof body.conversation_id === "string" ? body.conversation_id : null;

  try {
    const raw = await extractFile(parsed.data);
    const sanit = sanitiseUntrustedContent({ text: raw.text, source_kind: "file" });
    const clean = { ...raw, text: sanit.clean_text, text_length: sanit.clean_text.length };

    persistExtraction(clean, {
      conversation_id,
      user_id: session?.user_id ?? null,
      sanitiser_neutralised: sanit.neutralised_count,
    });

    return NextResponse.json({
      ok: clean.completed,
      extraction_id: clean.extraction_id,
      provider: clean.provider,
      mime_type: clean.mime_type,
      filename: clean.filename,
      file_hash: clean.file_hash,
      bytes: clean.bytes,
      text_length: clean.text_length,
      request_ms: clean.request_ms,
      text: clean.text,
      error: clean.error,
      doctrine_note: "OCR TEXT IS INPUT · NEVER ESTABLISHES TRUTH",
      sanitiser_neutralised: sanit.neutralised_count,
      sanitiser_safe_to_cite: sanit.safe_to_cite,
    });
  } catch (e) {
    return NextResponse.json({
      error: "ocr_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
