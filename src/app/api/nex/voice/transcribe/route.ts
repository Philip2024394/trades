// src/app/api/nex/voice/transcribe/route.ts
//
// Founder Phase 12 · P12-5 · Voice STT endpoint.
// POST body: { audio_base64, mime_type?, language?, model_id?, conversation_id? }
//
// Doctrine anchors:
//   voice-doctrine · transcripts are INPUT · never establish truth.

import { NextResponse } from "next/server";
import { makeDefaultSttProvider, persistTranscript } from "@/lib/nex/live-chat-completion/voice";
import { SttRequestSchema } from "@/lib/nex/live-chat-completion/voice/contract";

const _stt = makeDefaultSttProvider();

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const parsed = SttRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", detail: parsed.error.flatten() }, { status: 400 });
  }

  const conversation_id = typeof body.conversation_id === "string" ? body.conversation_id : null;

  try {
    const result = await _stt.transcribe(parsed.data);
    persistTranscript(result, conversation_id);
    return NextResponse.json({
      ok: result.completed,
      transcript_id: result.transcript_id,
      text: result.text,
      language: result.language,
      confidence: result.confidence,
      provider: result.provider,
      model_id: result.model_id,
      request_ms: result.request_ms,
      audio_hash: result.audio_hash,
      error: result.error,
      doctrine_note: "VOICE INPUT IS TRANSCRIPT · NEVER ESTABLISHES TRUTH",
    });
  } catch (e) {
    return NextResponse.json({
      error: "stt_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
