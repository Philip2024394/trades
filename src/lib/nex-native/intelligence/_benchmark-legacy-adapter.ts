// src/lib/nex-native/intelligence/_benchmark-legacy-adapter.ts
//
// ⚠ TEMPORARY · BENCHMARK-ONLY · DO NOT SHIP TO PRODUCTION ⚠
// -----------------------------------------------------------
// Bridge 93 · This file exists SOLELY so the 50-question OLD-vs-NEW
// benchmark can compare the pre-Bridge 91 reply path against the
// current NEX Intelligence Gateway on the same model / same fixture /
// same conversation.
//
// The pre-Bridge 91 path was:
//   · Load conversation + business + product
//   · tryReflex(last)
//   · Fall back to raw runProviderStream with:
//       systemPrompt = NEX_IDENTITY + NEX_RULES + surfaceGuidance
//                      (business name + optional product name/price only)
//       tools = []
//   · No knowledge retrieval, no evidence context, no validator,
//     no correction retry
//
// This adapter reproduces THAT exact behaviour so the benchmark can
// measure the effect of retrieval + evidence + validation in isolation.
//
// Guarantees:
//   · Same in-process Qwen 0.5B model (Constitutional Gate untouched)
//   · Same conversation loader / participant checks
//   · Does NOT persist replies · benchmark returns them for scoring
//     (unlike the real reply path, which INSERTs into nex_message ·
//     that would pollute fixtures and skew ordering across two runs)
//   · Marked `_benchmark-legacy-adapter` so the file name signals it
//     is not production surface
//
// After the benchmark reports are accepted, this file may be deleted.

import "server-only";
import type { AnthropicMessage } from "@/lib/llm/anthropic";
import type { NexToolContext } from "@/lib/nex/tools/types";
import { NEX_IDENTITY, NEX_RULES } from "@/lib/nex/personality";
import { tryReflex } from "@/lib/nex/reflex/reflex-brain";
import { runProviderStream } from "@/lib/nex/runtimeProviderStream";
import * as businessService from "../business-service";
import * as productService from "../product-service";
import * as conversationService from "../conversation-service";
import type { NexUuid } from "../types";
import {
  createInProcessBrainProvider,
  probeInProcessRuntime,
} from "./in-process-provider";
import { ensureNexAssistantAccount } from "./nex-assistant";

export interface BenchmarkLegacyResult {
  path: "reflex" | "orchestration" | "gap";
  text: string | null;
  gap_reason: string | null;
  model_used: string | null;
  duration_ms: number;
}

/**
 * Run the OLD reply path for ONE conversation and return the raw
 * generation without persisting. Benchmark-only.
 */
export async function runLegacyReplyForBenchmark(
  conversationId: NexUuid,
): Promise<BenchmarkLegacyResult> {
  const start = Date.now();
  const gap = (reason: string): BenchmarkLegacyResult => ({
    path: "gap",
    text: null,
    gap_reason: reason,
    model_used: null,
    duration_ms: Date.now() - start,
  });

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

  // OLD reflex path
  const reflex = tryReflex(lastMsg.body);
  if (reflex) {
    return {
      path: "reflex",
      text: reflex.text,
      gap_reason: null,
      model_used: null,
      duration_ms: Date.now() - start,
    };
  }

  // OLD model path · raw runProviderStream · no retrieval · no validator
  const probe = await probeInProcessRuntime();
  if (!probe.available) return gap(`in_process_runtime_unavailable · ${probe.error ?? "unknown"}`);

  const surfaceGuidance = [
    `You are helping a customer who has messaged the business "${business.display_name}" via NEX Chat.`,
    ...(product
      ? [
          `The conversation is scoped to the product "${product.name}"${
            product ? ` priced at ${product.currency} ${(product.price_pence / 100).toFixed(2)}` : ""
          }.`,
        ]
      : []),
    "",
    "You speak AS NEX Assistant · you are NOT the business owner.",
    "The business owner may reply later personally · say so when appropriate.",
    "",
    "You have no tools in this conversation · no ability to check stock, place orders,",
    "or contact the business owner directly. When the customer asks for something outside",
    "what you can honestly answer, acknowledge and say the business owner will follow up.",
  ].join("\n");
  const systemPrompt = [NEX_IDENTITY, "", NEX_RULES, "", surfaceGuidance].join("\n");
  const anthropicMessages: AnthropicMessage[] = messages.map((m) => ({
    role: m.sender_account_id === nexAssistant.id ? "assistant" : "user",
    content: [{ type: "text" as const, text: m.body }],
  }));
  const stubCtx: NexToolContext = {
    surface: "visitor",
    userKey: `nex-native:${nexAssistant.id}`,
    slug: business.slug,
  };

  const provider = createInProcessBrainProvider();
  let fullText = "";
  try {
    for await (const evt of runProviderStream({
      provider,
      systemPrompt,
      messages: anthropicMessages,
      tools: [],
      ctx: stubCtx,
      maxTokens: 400,
      temperature: 0.35,
    })) {
      if (evt.type === "text") fullText += evt.delta;
      else if (evt.type === "done") break;
    }
  } catch (e) {
    return gap(`orchestration_exception · ${(e as Error).message.slice(0, 160)}`);
  }

  fullText = fullText.trim();
  if (!fullText) return gap("empty_reply");
  return {
    path: "orchestration",
    text: fullText,
    gap_reason: null,
    model_used: probe.modelId,
    duration_ms: Date.now() - start,
  };
}
