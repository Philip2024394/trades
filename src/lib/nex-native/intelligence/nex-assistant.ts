// src/lib/nex-native/intelligence/nex-assistant.ts
//
// Wave 6 · NEX-native Intelligence Boundary Adapter (server-only).
// Stage 6C · in-process NEX-owned generation engine.
// =================================================================
//
// NEX Chat  ─▶  NEX Intelligence primitives  ─▶  in-process generation
//                (personality · reflex · runtime)         (open weights
//                                                          in NEX Node process)
//
// Founder Stage 6C constraints honoured:
//   §2  NO hosted AI provider · NO Ollama daemon
//   §4  reuses existing NEX Intelligence primitives (NEX_IDENTITY,
//       NEX_RULES, tryReflex, runProviderStream) · does not recreate them
//   §5  every reply is real generation from real open weights · never
//       fabricated · never canned
//   §6  every persisted message goes through conversationService on
//       ijvqdvsvwtwxzcqmoqit · never hammerex_mate_*
//   §7  no reconnect to Anthropic / silent-fallback resolver / legacy path
//   §15 does not claim NEX built the model · base weights are
//       identified as open-weight foundations

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import * as accountService from "../account-service";
import type { NexAccountRow, NexUuid } from "../types";
import { inProcessDefaultModelId } from "./in-process-provider";
import { nexIntelligenceAnswer } from "./nex-intelligence-gateway";

const NEX_ASSISTANT_DISPLAY_NAME = "NEX Assistant";

export interface GenerateNexReplyResult {
  message_id: NexUuid | null;
  provider: "reflex" | "in-process" | null;
  model_used: string | null;
  path: "reflex" | "orchestration" | "gap";
  skipped_reason: string | null;
  duration_ms: number;
  reply_preview: string | null;
}

// ---------------------------------------------------------------------------
// System account
// ---------------------------------------------------------------------------

export async function ensureNexAssistantAccount(): Promise<NexAccountRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("*")
    .eq("display_name", NEX_ASSISTANT_DISPLAY_NAME)
    .is("supabase_user_id", null)
    .maybeSingle();
  if (error) throw new Error(`ensureNexAssistantAccount: ${error.message}`);
  if (data) return data as NexAccountRow;
  return await accountService.createAccount({
    display_name: NEX_ASSISTANT_DISPLAY_NAME,
    supabase_user_id: null,
  });
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function generateNexReply(conversationId: NexUuid): Promise<GenerateNexReplyResult> {
  // Bridge 91 · This function is now a thin adapter over the NEX
  // Intelligence Gateway. All context loading, reflex, retrieval,
  // evidence assembly, generation, and validation live inside the
  // gateway. The gateway is the single server-side boundary between
  // NEX Chat and NEX Intelligence (per Bridge 91 architectural
  // decision).
  //
  // The gateway's response is normalized back to the legacy
  // GenerateNexReplyResult shape so existing callers (worker + API
  // route at /api/nex-native/chat/nex-reply) don't need to change.
  const gwResp = await nexIntelligenceAnswer({ conversationId });
  const provider: GenerateNexReplyResult["provider"] =
    gwResp.path === "reflex"
      ? "reflex"
      : gwResp.path === "grounded"
        ? "in-process"
        : null;
  const path: GenerateNexReplyResult["path"] =
    gwResp.path === "reflex"
      ? "reflex"
      : gwResp.path === "grounded"
        ? "orchestration"
        : "gap";
  return {
    message_id: gwResp.message_id,
    provider,
    model_used: gwResp.model_used,
    path,
    skipped_reason: gwResp.gap_reason,
    duration_ms: gwResp.duration_ms,
    reply_preview: gwResp.reply_preview,
  };
}

// Re-export the default model id for reporting / diagnostics.
export { inProcessDefaultModelId };
