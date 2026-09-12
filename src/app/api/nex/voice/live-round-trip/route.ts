// src/app/api/nex/voice/live-round-trip/route.ts
//
// Founder Phase 21 · P21-3 · Voice → text → chat → text → audio single-shot.
//
// Saves the client 3 round trips per turn.
//
// Body: { audio_base64, mime_type?, conversation_id?, voice? }
// Returns: {
//   transcript,           // STT text
//   reply_text,           // NEX assistant reply
//   reply_audio_data_url, // TTS · playable in <audio>
//   provenance,           // voice/file provenance from chat-with-tools
//   personalized,
//   evidence_refs,
//   conversation_id,
// }
//
// Doctrine anchors:
//   voice-doctrine · both input transcript and output synthesis never
//   establish truth · both are wrapped in explicit banners along the way
//   · Fabrication Gate v2 still authoritative on every reply claim.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { makeDefaultSttProvider, makeDefaultTtsProvider, persistTranscript, persistSynthesis } from "@/lib/nex/live-chat-completion/voice";
import { sanitiseUntrustedContent } from "@/lib/nex/live-chat-completion/safety/untrusted-content-sanitiser";

const _stt = makeDefaultSttProvider();
const _tts = makeDefaultTtsProvider();

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const audio_base64 = typeof body.audio_base64 === "string" ? body.audio_base64 : "";
  if (!audio_base64) {
    return NextResponse.json({ error: "missing_audio_base64" }, { status: 400 });
  }
  const mime_type = typeof body.mime_type === "string" ? body.mime_type : "audio/webm";
  const conversation_id = typeof body.conversation_id === "string" ? body.conversation_id : randomUUID();
  const voice = typeof body.voice === "string" ? body.voice : "en_US-lessac-medium";
  const language = (["en", "id", "auto"].includes(body.language as string) ? body.language : "auto") as "en" | "id" | "auto";

  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;

  // ─── 1. STT ─────────────────────────────────────────────────────
  const sttMime = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/webm", "audio/ogg", "audio/flac"].includes(mime_type)
    ? (mime_type as "audio/wav" | "audio/mpeg" | "audio/mp3" | "audio/webm" | "audio/ogg" | "audio/flac")
    : "audio/webm";
  const sttResult = await _stt.transcribe({
    audio_base64,
    mime_type: sttMime,
    language,
    conversation_id,
    budget_ms: 30_000,
  });
  persistTranscript(sttResult, conversation_id);
  const transcript = sttResult.completed ? sttResult.text : "";

  if (!transcript.trim()) {
    return NextResponse.json({
      ok: false,
      error: "empty_transcript",
      transcript: sttResult.text,
      transcript_error: sttResult.error,
      conversation_id,
      doctrine_note: "VOICE INPUT IS TRANSCRIPT · empty transcript · nothing spoken to the chat pipeline.",
    });
  }

  // ─── 2. Chat-with-tools (forward the transcript as the message) ─
  const host = req.headers.get("host") ?? "localhost:3008";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const forwardHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (token) forwardHeaders.cookie = `nex_session=${token}`;
  let chatJson: Record<string, unknown> = {};
  try {
    const inner = await fetch(`${proto}://${host}/api/nex-conv/chat-with-tools`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify({
        message: transcript,
        conversation_id,
        voice_audio_base64: audio_base64,
        voice_mime: sttMime,
      }),
    });
    chatJson = (await inner.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: "upstream_chat_error",
      transcript,
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      conversation_id,
    }, { status: 502 });
  }

  const reply_text = String(chatJson.reply ?? "");

  // ─── 3. TTS ─────────────────────────────────────────────────────
  // Sanitise reply through Doctrine #5 before it reaches the TTS provider
  // (same discipline as /api/nex/voice/synthesize).
  const sanit = sanitiseUntrustedContent({ text: reply_text, source_kind: "tool" });
  if (!sanit.safe_to_cite) {
    return NextResponse.json({
      ok: false,
      error: "reply_rejected_by_doctrine_5",
      transcript,
      reply_text: sanit.clean_text,
      conversation_id,
    });
  }

  const ttsResult = await _tts.synthesize({
    text: sanit.clean_text.slice(0, 4000),
    voice,
    language: language === "auto" ? "en" : (language as "en" | "id"),
    conversation_id,
    budget_ms: 30_000,
  });
  persistSynthesis(ttsResult, conversation_id);

  const reply_audio_data_url = ttsResult.completed
    ? `data:${ttsResult.mime_type};base64,${ttsResult.content_base64}`
    : null;

  return NextResponse.json({
    ok: ttsResult.completed,
    conversation_id,
    transcript,
    reply_text,
    reply_audio_data_url,
    synth_id: ttsResult.synth_id,
    transcript_id: sttResult.transcript_id,
    provenance: chatJson.provenance ?? [],
    personalized: chatJson.personalized ?? false,
    evidence_refs: chatJson.evidence_refs ?? [],
    trust_score: chatJson.trust_score ?? null,
    stt_provider: sttResult.provider,
    tts_provider: ttsResult.provider,
    doctrine_note: "VOICE INPUT IS TRANSCRIPT · VOICE OUTPUT IS SYNTHESIS · NEITHER ESTABLISHES TRUTH · Fabrication Gate v2 still authoritative on every reply claim.",
    sanitiser_neutralised: sanit.neutralised_count,
  });
}
