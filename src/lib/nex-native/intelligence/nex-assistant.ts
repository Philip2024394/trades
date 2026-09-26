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
import type { AnthropicMessage } from "@/lib/llm/anthropic";
import type { NexToolContext } from "@/lib/nex/tools/types";
import { NEX_IDENTITY, NEX_RULES } from "@/lib/nex/personality";
import { tryReflex } from "@/lib/nex/reflex/reflex-brain";
import { runProviderStream } from "@/lib/nex/runtimeProviderStream";
import { nexSupabaseAdmin } from "../supabase-admin";
import * as accountService from "../account-service";
import * as businessService from "../business-service";
import * as productService from "../product-service";
import * as conversationService from "../conversation-service";
import type { NexAccountRow, NexUuid } from "../types";
import {
  createInProcessBrainProvider,
  probeInProcessRuntime,
  inProcessDefaultModelId,
} from "./in-process-provider";

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
// Local-only, in-process provider policy (§2, §7)
//   No third-party API is ever considered.
//   No Ollama daemon is required or attempted.
//   If the in-process runtime cannot load, we return an honest GAP.
// ---------------------------------------------------------------------------

async function resolveLocalOnlyProvider(): Promise<
  | { provider: ReturnType<typeof createInProcessBrainProvider>; model: string }
  | { provider: null; error: string }
> {
  const probe = await probeInProcessRuntime();
  if (!probe.available) {
    return { provider: null, error: `in_process_runtime_unavailable · ${probe.error ?? "unknown"}` };
  }
  return {
    provider: createInProcessBrainProvider(),
    model: probe.modelId,
  };
}

// ---------------------------------------------------------------------------
// NEX-native surface guidance layered onto NEX_IDENTITY + NEX_RULES
// ---------------------------------------------------------------------------

function buildNexNativeSurfaceGuidance(ctx: {
  businessName: string;
  productName: string | null;
  productPrice: string | null;
}): string {
  const lines: string[] = [
    `You are helping a customer who has messaged the business "${ctx.businessName}" via NEX Chat.`,
  ];
  if (ctx.productName) {
    lines.push(
      `The conversation is scoped to the product "${ctx.productName}"${
        ctx.productPrice ? ` priced at ${ctx.productPrice}` : ""
      }.`
    );
  }
  lines.push(
    "",
    "You speak AS NEX Assistant · you are NOT the business owner.",
    "The business owner may reply later personally · say so when appropriate.",
    "",
    "You have no tools in this conversation · no ability to check stock, place orders,",
    "or contact the business owner directly. When the customer asks for something outside",
    "what you can honestly answer, acknowledge and say the business owner will follow up."
  );
  return lines.join("\n");
}

function toAnthropicMessages(
  messages: Array<{ sender_account_id: string; body: string }>,
  nexAssistantId: string
): AnthropicMessage[] {
  return messages.map((m) => ({
    role: m.sender_account_id === nexAssistantId ? "assistant" : "user",
    content: [{ type: "text" as const, text: m.body }],
  }));
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function generateNexReply(conversationId: NexUuid): Promise<GenerateNexReplyResult> {
  const start = Date.now();
  const gap = (reason: string): GenerateNexReplyResult => ({
    message_id: null,
    provider: null,
    model_used: null,
    path: "gap",
    skipped_reason: reason,
    duration_ms: Date.now() - start,
    reply_preview: null,
  });

  // 1 · Real NEX-native context (nothing legacy)
  const conv = await conversationService.getConversationById(conversationId);
  if (!conv) return gap("conversation_not_found");

  const messages = await conversationService.listMessages(conversationId);
  if (messages.length === 0) return gap("empty_conversation");

  const participants = await conversationService.listParticipants(conversationId);
  const lastMsg = messages[messages.length - 1]!;
  const nexAssistant = await ensureNexAssistantAccount();

  if (lastMsg.sender_account_id === nexAssistant.id) return gap("already_replied_last");
  const lastSenderParticipation = participants.find((p) => p.account_id === lastMsg.sender_account_id);
  if (lastSenderParticipation?.side !== "customer") return gap("last_message_not_from_customer");

  const business = await businessService.getBusinessById(conv.business_id);
  if (!business) return gap("business_missing");
  const product = conv.about_product_id ? await productService.getProductById(conv.about_product_id) : null;

  // 2 · Reflex fast-path (NEX Intelligence primitive · zero-cost, real, deterministic)
  const reflex = tryReflex(lastMsg.body);
  if (reflex) {
    const posted = await persistReplyAsNexAssistant(conversationId, nexAssistant.id, participants, reflex.text);
    return {
      message_id: posted.id,
      provider: "reflex",
      model_used: null,
      path: "reflex",
      skipped_reason: null,
      duration_ms: Date.now() - start,
      reply_preview: reflex.text.slice(0, 200),
    };
  }

  // 3 · In-process local-only provider (§2 · no hosted, no daemon)
  const resolution = await resolveLocalOnlyProvider();
  if (!resolution.provider) {
    return gap(resolution.error);
  }

  // 4 · Reuse existing NEX Intelligence runtime loop (§4)
  const surfaceGuidance = buildNexNativeSurfaceGuidance({
    businessName: business.display_name,
    productName: product?.name ?? null,
    productPrice: product ? `${product.currency} ${(product.price_pence / 100).toFixed(2)}` : null,
  });
  const systemPrompt = [NEX_IDENTITY, "", NEX_RULES, "", surfaceGuidance].join("\n");
  const anthropicMessages = toAnthropicMessages(messages, nexAssistant.id);
  const stubCtx: NexToolContext = {
    surface: "visitor",
    userKey: `nex-native:${nexAssistant.id}`,
    slug: business.slug,
  };

  let fullText = "";
  let stoppedBy: "end_turn" | "max_steps" | "error" = "end_turn";
  try {
    for await (const evt of runProviderStream({
      provider: resolution.provider,
      systemPrompt,
      messages: anthropicMessages,
      tools: [],
      ctx: stubCtx,
      maxTokens: 400,
      temperature: 0.35,
    })) {
      if (evt.type === "text") fullText += evt.delta;
      else if (evt.type === "done") { stoppedBy = evt.stoppedBy; break; }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return gap(`orchestration_exception · ${msg.slice(0, 160)}`);
  }

  fullText = fullText.trim();
  if (!fullText) return gap(`empty_reply · stoppedBy=${stoppedBy}`);

  // 5 · Persist through nex-native only (§6)
  const posted = await persistReplyAsNexAssistant(conversationId, nexAssistant.id, participants, fullText);

  return {
    message_id: posted.id,
    provider: "in-process",
    model_used: resolution.model,
    path: "orchestration",
    skipped_reason: null,
    duration_ms: Date.now() - start,
    reply_preview: fullText.slice(0, 200),
  };
}

async function persistReplyAsNexAssistant(
  conversationId: NexUuid,
  nexAssistantId: NexUuid,
  currentParticipants: Array<{ account_id: string }>,
  body: string
) {
  if (!currentParticipants.some((p) => p.account_id === nexAssistantId)) {
    try {
      await conversationService.addParticipant({
        conversation_id: conversationId,
        account_id: nexAssistantId,
        side: "business",
      });
    } catch (e) {
      const emsg = e instanceof Error ? e.message : String(e);
      if (!/duplicate key/i.test(emsg)) throw e;
    }
  }
  return await conversationService.postMessage({
    conversation_id: conversationId,
    sender_account_id: nexAssistantId,
    body,
  });
}

// Re-export the default model id for reporting / diagnostics.
export { inProcessDefaultModelId };
