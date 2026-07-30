// POST /api/nex/converse/stream
//
// Streaming variant of /api/nex/converse. Returns NDJSON — one JSON
// object per line — instead of a single JSON payload. The widget
// consumes this and types text as it arrives.
//
// Line schema:
//   {"type":"presence_hint","text":"..."}                  (Ship A · FIRST · sub-10ms · Philip 2026-07-30)
//   {"type":"meta","conversation_id":"..."}                (once, early)
//   {"type":"text","delta":"..."}
//   {"type":"thinking","delta":"..."}
//   {"type":"tool_start","name":"..."}
//   {"type":"tool_end","name":"...","ok":true,"ui":{...}?}
//   {"type":"done","message_id":"...","cost_pence":n,"model_used":"..."}
//   {"type":"error","error":"..."}
//
// The presence_hint event is emitted BEFORE meta so the widget can render
// "NEX is with you" acknowledgement in <200ms · long before the composer's
// first text token arrives. Follows Living Intelligence Architecture v1.0's
// winning metric: "How long after asking does a person feel NEX is with them?"

import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildNexContext } from "@/lib/nex/context";
import { buildSystemPrompt } from "@/lib/nex/personality";
import { getUserMemory, memoryToText, refreshUserMemory, shouldRefresh, conversationIdsForUser } from "@/lib/nex/memory";
import { retrieveRelevantMemories, livingMemoryToText } from "@/lib/nex/living-memory/retrieval";
import { generatePresenceHint } from "@/lib/nex/living-memory/presence-hint";
import type { MemoryUserSurface } from "@/lib/nex/living-memory/types";
import { tryReflex } from "@/lib/nex/reflex/reflex-brain";
import { routeToBrain, brainHintForPrompt } from "@/lib/nex/router/brain-router";
import { toolsForSurface } from "@/lib/nex/tools/registry";
import { runAgenticStream } from "@/lib/nex/runtimeStream";
import type { AnthropicMessage, AnthropicContentBlock } from "@/lib/llm/anthropic";
import {
  resolveUserKey, checkDailyCap, isMerchantUncapped, bumpUsage, loadHistory,
  validateImage, isNextResponse, MAX_MESSAGE_LEN
} from "@/lib/nex/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL_HAIKU = "claude-haiku-4-5-20251001";
const MODEL_OPUS  = "claude-opus-4-7";
const HARD_HINTS  = [
  "should i", "why did", "analyse", "analyze", "compare",
  "strategy", "recommend", "explain why", "break down",
  "how am i doing", "growth", "trend"
];
const PRICING: Record<string, { input: number; output: number; cache_read: number }> = {
  [MODEL_HAIKU]: { input: 1.00,  output: 5.00,  cache_read: 0.10 },
  [MODEL_OPUS]:  { input: 15.00, output: 75.00, cache_read: 1.50 }
};
const GBP_PER_USD = 0.79;

function pickModel(question: string): string {
  const q = question.toLowerCase();
  if (HARD_HINTS.some((h) => q.includes(h))) return MODEL_OPUS;
  if (question.length > 260) return MODEL_OPUS;
  return MODEL_HAIKU;
}

function pickThinkingBudget(model: string, question: string): number {
  if (model !== MODEL_OPUS) return 0;
  return HARD_HINTS.some((h) => question.toLowerCase().includes(h)) ? 4000 : 0;
}

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json().catch(() => null) as {
    surface?: string; conversation_id?: string; message?: string;
    canteen_slug?: string; image_base64?: string; image_media_type?: string;
  } | null;

  const surface        = String(body?.surface ?? "");
  const conversationId = body?.conversation_id ?? null;
  const message        = String(body?.message ?? "").trim().slice(0, MAX_MESSAGE_LEN);
  const canteenSlug    = body?.canteen_slug ?? null;
  const imageBase64    = body?.image_base64 ?? "";
  const imageMediaType = body?.image_media_type ?? "";

  const errorLine = (err: string) => new Response(JSON.stringify({ type: "error", error: err }) + "\n", {
    status: 400,
    headers: { "Content-Type": "application/x-ndjson" }
  });

  if (!["merchant", "homeowner", "visitor"].includes(surface)) return errorLine("invalid_surface");
  if (!message && !imageBase64) return errorLine("empty_message");
  if (surface === "visitor" && !canteenSlug) return errorLine("canteen_slug_required");

  const imgOrErr = validateImage(imageBase64, imageMediaType);
  if (isNextResponse(imgOrErr)) return imgOrErr;
  const validatedImage = imgOrErr ?? undefined;

  const user = await resolveUserKey(surface, req);
  if (!user) return errorLine("not_authenticated");

  const uncapped = surface === "merchant" ? await isMerchantUncapped(user.key) : false;
  if (!uncapped) {
    const cap = await checkDailyCap(user.key, surface);
    if (cap.over) {
      return new Response(JSON.stringify({ type: "error", error: "daily_cap_reached", cap: cap.cap }) + "\n", {
        status: 429,
        headers: { "Content-Type": "application/x-ndjson" }
      });
    }
  }

  // Get-or-create conversation
  let convId = conversationId;
  if (!convId) {
    const { data: created, error: convErr } = await supabaseAdmin
      .from("hammerex_mate_conversations")
      .insert({ surface, user_key: user.key, user_key_type: user.keyType, canteen_slug: canteenSlug })
      .select("id").single();
    if (convErr || !created) return errorLine(convErr?.message ?? "conv_create_failed");
    convId = created.id;
  }

  const history = conversationId ? await loadHistory(conversationId) : [];

  // Persist the user message first
  await supabaseAdmin.from("hammerex_mate_messages").insert({
    conversation_id: convId,
    role:            "user",
    content:         message || "(sent a photo)",
    context_snapshot: validatedImage ? { has_image: true, image_media_type: validatedImage.media_type } : null
  });

  // ────────────────────────────────────────────────────────────────
  // REFLEX BRAIN · Consciousness Layer Tier 1 (Philip 2026-07-30)
  // ────────────────────────────────────────────────────────────────
  // If the message is a pure reflex (greeting / thanks / closing with no
  // substantive question attached), short-circuit here · skip context ·
  // skip memory · skip Anthropic entirely. Sub-100ms total path.
  //
  // Only fires for text-only messages (image attachments always go deep).
  //
  // Philip's rule: "A truly intelligent system knows when thinking is needed."
  const reflex = !validatedImage ? tryReflex(message) : null;
  if (reflex) {
    // Persist the assistant reply for conversation continuity
    const { data: reflexMsg } = await supabaseAdmin
      .from("hammerex_mate_messages")
      .insert({
        conversation_id: convId,
        role:            "assistant",
        content:         reflex.text,
        model:           "reflex-brain",
        cost_pence:      0,
        context_snapshot: { reflex_category: reflex.category, reflex_intent: reflex.intent },
      })
      .select("id").single();

    // Fire-and-forget usage bump (visitors excluded from cap · reflex is free)
    if (!uncapped && surface !== "visitor") {
      void bumpUsage(user.key, 0).catch(() => undefined);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        // Same event order as the composer path · widget renders identically
        send({ type: "presence_hint", text: reflex.text }); // hint IS the answer for reflex
        send({ type: "meta", conversation_id: convId });
        send({ type: "text", delta: reflex.text });
        send({ type: "done", message_id: reflexMsg?.id ?? null, cost_pence: 0, model_used: "reflex-brain" });
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type":  "application/x-ndjson",
        "Cache-Control": "no-store"
      }
    });
  }

  const model = validatedImage ? MODEL_OPUS : pickModel(message);
  const thinkingBudget = pickThinkingBudget(model, message);
  const maxTokens = thinkingBudget > 0 ? thinkingBudget + 700 : 700;

  // Ship 2c + Ship C · parallelise living-memory retrieval alongside
  // context + Layer 1 memory. Visitors excluded (no persistent memory
  // per privacy). Errors swallowed so retrieval failure never blocks reply.
  const canUseLivingMemory = surface === "merchant" || surface === "homeowner";
  const [ctx, memory, livingMemories] = await Promise.all([
    buildNexContext(surface as "merchant" | "homeowner" | "visitor", message, {
      slug:         surface === "merchant" ? user.key : "",
      homeownerId:  surface === "homeowner" ? user.key : "",
      canteenSlug:  canteenSlug ?? ""
    } as never),
    getUserMemory(surface as "merchant" | "homeowner", user.key),
    canUseLivingMemory
      ? retrieveRelevantMemories({
          user_surface: surface as MemoryUserSurface,
          user_key: user.key,
          conversation_window: message,
        }).catch((): [] => [])
      : Promise.resolve([]),
  ]);

  // Brain routing decision · Consciousness Layer Step 1 (Philip 2026-07-30)
  // Classifies non-Reflex messages into Emotion / Expert / Wisdom.
  // Sub-10ms deterministic · no LLM call · composer reads the hint and shapes tone accordingly.
  const brainRoute = routeToBrain(message);

  const cachedSystem = buildSystemPrompt(surface as "merchant" | "homeowner" | "visitor");
  const memoryBlock       = memoryToText(memory);
  const livingMemoryBlock = livingMemoryToText(livingMemories);
  const freshSystem  = [
    `${ctx.userLabel}.`,
    "",
    memoryBlock,
    memoryBlock ? "" : null,
    livingMemoryBlock,
    livingMemoryBlock ? "" : null,
    "CONTEXT (real data on this user right now — cite these numbers when relevant):",
    JSON.stringify(ctx.systemFacts, null, 2),
    "",
    "KNOWLEDGE BASE HITS (relevant excerpts — cite the source name if you use them):",
    ctx.knowledge.length === 0
      ? "(no matching knowledge base entries)"
      : ctx.knowledge.map((h, i) => `[${i + 1}] ${h.title}${h.source_publisher ? " — source: " + h.source_publisher : ""}\n${h.ai_summary}`).join("\n\n"),
    "",
    brainHintForPrompt(brainRoute)
  ].filter((s) => s !== null).join("\n");

  const currentTurn: AnthropicMessage = validatedImage
    ? {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: validatedImage.media_type, data: validatedImage.base64 } },
          { type: "text",  text: message || "What do you see in this photo?" }
        ] as AnthropicContentBlock[]
      }
    : { role: "user", content: message };

  const messages: AnthropicMessage[] = [...history, currentTurn];
  const tools = toolsForSurface(surface as "merchant" | "homeowner" | "visitor");

  // Build the NDJSON stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      // Ship A · Instant Acknowledgement Layer (Philip 2026-07-30)
      // Emit the presence hint FIRST · deterministic template lookup · sub-10ms ·
      // no LLM call · no truth-contract risk. Widget renders this immediately so
      // the user feels NEX is present before the composer's first token arrives.
      // The winning metric: "How long after asking does a person feel NEX is with them?"
      const presenceHint = generatePresenceHint({
        user_message: message,
        has_living_memory: livingMemories.length > 0,
        is_first_turn: history.length === 0,
      });
      send({ type: "presence_hint", text: presenceHint });

      // Emit conversation_id next so the client can persist it
      send({ type: "meta", conversation_id: convId });

      let fullText  = "";
      let costPence = 0;

      try {
        for await (const evt of runAgenticStream({
          cachedSystem, system: freshSystem, messages, tools, model,
          ctx: {
            surface:     surface as "merchant" | "homeowner" | "visitor",
            userKey:     user.key,
            slug:        surface === "merchant" ? user.key : undefined,
            homeownerId: surface === "homeowner" ? user.key : undefined
          },
          maxTokens, temperature: 0.35, thinkingBudgetTokens: thinkingBudget
        })) {
          if (evt.type === "text") {
            fullText += evt.delta;
            send(evt);
          } else if (evt.type === "thinking") {
            // Intentionally not forwarded to the widget — thinking is
            // internal. Uncomment to expose in a debug UI.
            // send(evt);
          } else if (evt.type === "tool_start" || evt.type === "tool_end") {
            send(evt);
          } else if (evt.type === "done") {
            const p = PRICING[model];
            const usd = (evt.usage.inputTokens / 1_000_000) * p.input
                      + (evt.usage.outputTokens / 1_000_000) * p.output
                      + (evt.usage.cacheReadTokens / 1_000_000) * p.cache_read;
            costPence = Math.ceil(usd * GBP_PER_USD * 100);

            // Persist assistant message
            const { data: replyRow } = await supabaseAdmin.from("hammerex_mate_messages").insert({
              conversation_id:      convId,
              role:                 "assistant",
              content:              fullText || "Not sure how to answer that, mate — try rephrasing?",
              model,
              input_tokens:         evt.usage.inputTokens,
              output_tokens:        evt.usage.outputTokens,
              cache_read_tokens:    evt.usage.cacheReadTokens,
              cache_created_tokens: evt.usage.cacheCreationTokens,
              cost_pence:           costPence,
              latency_ms:           evt.latencyMs,
              context_snapshot: {
                surface,
                knowledge_hit_count:  ctx.knowledge.length,
                fact_keys:            Object.keys(ctx.systemFacts),
                tools_available:      tools.map((t) => t.name),
                stopped_by:           evt.stoppedBy,
                streamed:             true
              },
              tool_calls:           evt.toolCalls
            }).select("id").single();

            send({
              type: "done",
              message_id: replyRow?.id ?? null,
              cost_pence: costPence,
              model_used: model
            });

            // Fire-and-forget bookkeeping
            bumpUsage(user.key, costPence).catch((e) => console.error("[nex/stream] bump failed:", e));
            if (surface === "merchant" || surface === "homeowner") {
              (async () => {
                try {
                  const mem = await getUserMemory(surface as "merchant" | "homeowner", user.key);
                  const ids = await conversationIdsForUser(surface as "merchant" | "homeowner", user.key);
                  const { count } = await supabaseAdmin
                    .from("hammerex_mate_messages")
                    .select("id", { count: "exact", head: true })
                    .in("conversation_id", ids);
                  if (shouldRefresh(mem, count ?? 0)) {
                    await refreshUserMemory(surface as "merchant" | "homeowner", user.key, ids);
                  }
                } catch (e) {
                  console.error("[nex/stream] memory refresh failed:", e);
                }
              })();
            }
          }
        }
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : "stream_failed" });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type":      "application/x-ndjson",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
