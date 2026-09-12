// src/app/api/nex-conv/chat-with-tools/route.ts
//
// Founder Phase 17 · Integration wiring endpoint.
//
// Wraps the existing /api/nex-conv/chat pipeline WITHOUT modifying it:
//   1. Pre-process voice + file attachments → sanitised, banner-prefixed text
//   2. Forward augmented message to the existing chat endpoint
//   3. Auto-persist the turn to nex.conversation (fire-and-forget)
//   4. Return { reply, provenance, conversation_id, ... }
//
// Doctrine anchors:
//   voice/file text is banner-prefixed as "never establishes truth"
//   sanitiser runs before splice · Doctrine #5 upheld
//   provenance descriptors returned so caller can display source refs

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { resolveSession } from "@/lib/nex/identity-auth";
import {
  augmentInputWithAttachments,
  persistChatTurn,
  type ChatAttachments,
} from "@/lib/nex/conversations/chat-wiring";
import { getCustomInstructions, renderInstructionsBanner } from "@/lib/nex/personalization/instructions";
import { applyDoctrine6, doctrine6Note } from "@/lib/nex/unconfirmed-labeler";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const message = typeof body.message === "string" ? body.message : "";
  const conversation_id = typeof body.conversation_id === "string" ? body.conversation_id : randomUUID();
  const market = typeof body.market === "string" ? body.market : "ID";
  const useLiveWorld = body.useLiveWorld !== false;

  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);

  const attachments: ChatAttachments = {
    voice_audio_base64: typeof body.voice_audio_base64 === "string" ? body.voice_audio_base64 : undefined,
    voice_mime: typeof body.voice_mime === "string" ? body.voice_mime : undefined,
    file_content_base64: typeof body.file_content_base64 === "string" ? body.file_content_base64 : undefined,
    file_mime: typeof body.file_mime === "string" ? body.file_mime : undefined,
    file_name: typeof body.file_name === "string" ? body.file_name : undefined,
  };

  const hasAnyAttachment = !!(attachments.voice_audio_base64 || attachments.file_content_base64);
  if (!message && !hasAnyAttachment) {
    return NextResponse.json({ error: "empty_input" }, { status: 400 });
  }

  // Pre-process attachments.
  const augmented = await augmentInputWithAttachments(message, attachments, conversation_id);

  // Load + splice custom instructions (Phase 19) if user is authenticated.
  let instructionsBanner = "";
  let personalized = false;
  if (session?.user_id) {
    try {
      const inst = await getCustomInstructions(session.user_id);
      instructionsBanner = renderInstructionsBanner(inst);
      if (instructionsBanner) personalized = true;
    } catch { /* personalization is best-effort · never blocks chat */ }
  }
  const finalMessage = instructionsBanner
    ? `${instructionsBanner}\n\n${augmented.effective_message}`
    : augmented.effective_message;

  // Forward to existing chat pipeline.
  try {
    const host = req.headers.get("host") ?? "localhost:3008";
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const forwardHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (token) forwardHeaders.cookie = `nex_session=${token}`;
    const inner = await fetch(`${proto}://${host}/api/nex-conv/chat`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify({
        message: finalMessage,
        conversation_id,
        market,
        useLiveWorld,
        user_id: session?.user_id ?? undefined,
      }),
    });
    const j = (await inner.json().catch(() => ({}))) as Record<string, unknown>;
    const rawReply = String(j.reply ?? j.reply_text ?? "");
    const evidenceRefs = Array.isArray(j.evidence_refs) ? j.evidence_refs : [];

    // Doctrine #6 · Truth or Unconfirmed · last-mile label enforcer.
    // A reply is considered "verified-backed" when the underlying pipeline
    // returned at least one evidence_ref. If not, every substantive
    // sentence receives the language-appropriate "Unconfirmed:" prefix.
    const preferred_language = (session?.user_id
      ? (await getCustomInstructions(session.user_id))?.preferred_language ?? null
      : null) ?? "en";
    const labeled = applyDoctrine6({
      text: rawReply,
      has_verified_evidence: evidenceRefs.length > 0,
      language: preferred_language,
    });
    const reply = labeled.labeled_text;

    // Auto-persist (fire-and-forget).
    void persistChatTurn({
      conversation_id,
      user_id: session?.user_id ?? null,
      user_text: augmented.effective_message,
      assistant_text: reply,
      meta: {
        provenance: augmented.provenance,
        sanitiser_neutralised: augmented.sanitiser_neutralised,
        personalized,
        unconfirmed_claim_count: labeled.unconfirmed_claim_count,
      },
    });

    return NextResponse.json({
      reply,
      conversation_id,
      provenance: augmented.provenance,
      sanitiser_neutralised: augmented.sanitiser_neutralised,
      personalized,
      evidence_refs: evidenceRefs,
      trust_score: typeof j.trust_score === "number" ? j.trust_score : null,
      unconfirmed_claim_count: labeled.unconfirmed_claim_count,
      doctrine_note: `Attachments never establish truth · Fabrication Gate v2 authoritative. ${doctrine6Note(labeled.unconfirmed_claim_count)}`,
    });
  } catch (e) {
    return NextResponse.json({
      error: "upstream_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      provenance: augmented.provenance,
    }, { status: 502 });
  }
}
