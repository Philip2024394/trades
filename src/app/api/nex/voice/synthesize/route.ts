// src/app/api/nex/voice/synthesize/route.ts
//
// Founder Phase 12 · P12-5 · Voice TTS endpoint.
// POST body: { text, voice?, language?, model_id?, speed?, conversation_id? }
//
// Doctrine anchors:
//   voice-doctrine · syntheses are OUTPUT rendering · never establish truth.
//   #5 · text is passed through untrusted-content sanitiser before synthesis.

import { NextResponse } from "next/server";
import { makeDefaultTtsProvider, persistSynthesis } from "@/lib/nex/live-chat-completion/voice";
import { TtsRequestSchema } from "@/lib/nex/live-chat-completion/voice/contract";
import { sanitiseUntrustedContent } from "@/lib/nex/live-chat-completion/safety/untrusted-content-sanitiser";

const _tts = makeDefaultTtsProvider();

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const rawText = typeof body.text === "string" ? body.text : "";
  const sanit = sanitiseUntrustedContent({ text: rawText, source_kind: "tool" });
  if (!sanit.safe_to_cite) {
    return NextResponse.json({
      error: "text_rejected_by_doctrine_5",
      detections: sanit.detections,
    }, { status: 400 });
  }

  const parsed = TtsRequestSchema.safeParse({ ...body, text: sanit.clean_text });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", detail: parsed.error.flatten() }, { status: 400 });
  }

  const conversation_id = typeof body.conversation_id === "string" ? body.conversation_id : null;

  try {
    const result = await _tts.synthesize(parsed.data);
    persistSynthesis(result, conversation_id);
    return NextResponse.json({
      ok: result.completed,
      synth_id: result.synth_id,
      mime_type: result.mime_type,
      duration_s: result.duration_s,
      voice: result.voice,
      provider: result.provider,
      model_id: result.model_id,
      request_ms: result.request_ms,
      text_hash: result.text_hash,
      // Data URL for direct <audio> playback in the browser.
      data_url: result.completed ? `data:${result.mime_type};base64,${result.content_base64}` : null,
      error: result.error,
      doctrine_note: "VOICE OUTPUT IS SYNTHESIS · NEVER ESTABLISHES TRUTH",
      sanitiser_neutralised: sanit.neutralised_count,
    });
  } catch (e) {
    return NextResponse.json({
      error: "tts_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
