// src/lib/nex/conversations/chat-wiring.ts
//
// Founder Phase 17 · P17-1/P17-2 · Bolt-on wiring for chat pipeline.
//
// Kept as pure helpers so the main /api/nex-conv/chat route can call them
// at the edges without a rewrite:
//
//   1. augmentInputWithAttachments — pre-processes voice/file attachments
//      before the message reaches the pipeline · returns effective_message
//      + provenance descriptors + doctrine banner.
//
//   2. persistChatTurn — fire-and-forget appendMessage() for the user turn
//      AND the assistant reply · uses the shared KF pool.
//
// Neither helper throws. Any DB or extractor error degrades to a no-op
// so the main chat pipeline never stalls on wiring failures.

import { appendMessage, createConversation, getConversation } from "@/lib/nex/conversations";
import { extractFile } from "@/lib/nex/file-extraction";
import { makeDefaultSttProvider } from "@/lib/nex/live-chat-completion/voice";
import { sanitiseUntrustedContent } from "@/lib/nex/live-chat-completion/safety/untrusted-content-sanitiser";

// ═══════════════════════════════════════════════════════════════════
// P17-2 · Attachment pre-processing
// ═══════════════════════════════════════════════════════════════════

export interface ChatAttachments {
  voice_audio_base64?: string;                    // will run through STT
  voice_mime?: string;
  file_content_base64?: string;                   // will run through file extractor
  file_mime?: string;
  file_name?: string;
}

export interface AugmentedInput {
  effective_message: string;                      // what the pipeline should treat as the user turn
  provenance: Array<{
    kind: "voice" | "file";
    ref_id: string;                               // transcript_id or extraction_id
    provider: string;
    doctrine_note: string;
    text_length: number;
    completed: boolean;
    error?: string;
  }>;
  sanitiser_neutralised: number;
}

const _stt = makeDefaultSttProvider();

/**
 * Pre-processes voice and file attachments into a single effective message.
 * The extracted text is doctrine-banner-prefixed AND sanitised (Doctrine #5)
 * before being spliced into the message — so downstream Truth Engine still
 * treats it as untrusted input, never as evidence.
 */
export async function augmentInputWithAttachments(
  originalMessage: string,
  attachments: ChatAttachments,
  conversation_id: string | null,
): Promise<AugmentedInput> {
  const provenance: AugmentedInput["provenance"] = [];
  const chunks: string[] = [];
  let totalNeutralised = 0;

  // ── Voice ──
  if (attachments.voice_audio_base64) {
    try {
      const stt = await _stt.transcribe({
        audio_base64: attachments.voice_audio_base64,
        mime_type: (attachments.voice_mime as "audio/wav" | "audio/mpeg" | "audio/webm" | "audio/ogg" | "audio/flac" | "audio/mp3") ?? "audio/wav",
        language: "auto",
        budget_ms: 30_000,
      });
      const sanit = sanitiseUntrustedContent({ text: stt.text, source_kind: "tool" });
      totalNeutralised += sanit.neutralised_count;
      if (stt.completed && sanit.clean_text.trim().length > 0) {
        chunks.push(`[voice input · transcript · never establishes truth]\n${sanit.clean_text}`);
      }
      provenance.push({
        kind: "voice",
        ref_id: stt.transcript_id,
        provider: stt.provider,
        doctrine_note: "VOICE INPUT IS TRANSCRIPT · NEVER ESTABLISHES TRUTH",
        text_length: sanit.clean_text.length,
        completed: stt.completed,
        error: stt.error,
      });
    } catch (e) {
      provenance.push({
        kind: "voice", ref_id: "stt:error", provider: "unknown",
        doctrine_note: "VOICE INPUT IS TRANSCRIPT · NEVER ESTABLISHES TRUTH",
        text_length: 0, completed: false,
        error: e instanceof Error ? e.message.slice(0, 120) : "voice_wiring_error",
      });
    }
  }

  // ── File ──
  if (attachments.file_content_base64 && attachments.file_mime) {
    try {
      const ex = await extractFile({
        content_base64: attachments.file_content_base64,
        mime_type: attachments.file_mime,
        filename: attachments.file_name,
        conversation_id: conversation_id ?? undefined,
        budget_ms: 30_000,
      });
      const sanit = sanitiseUntrustedContent({ text: ex.text, source_kind: "file" });
      totalNeutralised += sanit.neutralised_count;
      if (ex.completed && sanit.clean_text.trim().length > 0) {
        // Cap in-message file text to 40KB so we don't blow past prompt budgets.
        const clipped = sanit.clean_text.length > 40_000 ? sanit.clean_text.slice(0, 40_000) + "\n[…truncated…]" : sanit.clean_text;
        chunks.push(`[file input · ${attachments.file_name ?? ex.mime_type} · extracted text · never establishes truth]\n${clipped}`);
      }
      provenance.push({
        kind: "file",
        ref_id: ex.extraction_id,
        provider: ex.provider,
        doctrine_note: "EXTRACTED TEXT IS INPUT · NEVER ESTABLISHES TRUTH",
        text_length: sanit.clean_text.length,
        completed: ex.completed,
        error: ex.error,
      });
    } catch (e) {
      provenance.push({
        kind: "file", ref_id: "ext:error", provider: "unknown",
        doctrine_note: "EXTRACTED TEXT IS INPUT · NEVER ESTABLISHES TRUTH",
        text_length: 0, completed: false,
        error: e instanceof Error ? e.message.slice(0, 120) : "file_wiring_error",
      });
    }
  }

  const effective_message = chunks.length > 0
    ? `${chunks.join("\n\n")}\n\n[user message]\n${originalMessage}`
    : originalMessage;

  return { effective_message, provenance, sanitiser_neutralised: totalNeutralised };
}

// ═══════════════════════════════════════════════════════════════════
// P17-1 · Auto-persist chat turn
// ═══════════════════════════════════════════════════════════════════

export async function persistChatTurn(args: {
  conversation_id: string;
  user_id: string | null;
  user_text: string;
  assistant_text: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const existing = await getConversation(args.conversation_id);
    if (!existing) {
      await createConversation({
        conversation_id: args.conversation_id,
        user_id: args.user_id,
      });
    }
    await appendMessage({
      conversation_id: args.conversation_id,
      role: "user",
      content: args.user_text.slice(0, 100_000),
    });
    await appendMessage({
      conversation_id: args.conversation_id,
      role: "assistant",
      content: args.assistant_text.slice(0, 100_000),
      meta: args.meta,
    });
  } catch { /* wiring is best-effort · never blocks the response */ }
}
