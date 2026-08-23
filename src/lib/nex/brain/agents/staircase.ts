// NEX BRAIN · staircase agent runner.
//
// Orchestrates the full multi-turn design conversation for a
// staircase customer:
//   1. Build system prompt (persona + design context + tool guidance)
//   2. Call NexBrainProvider.chat() with the four staircase tools
//   3. When tool_call_ready events arrive, execute via handler,
//      collect mutations, feed tool_result back to the LLM
//   4. Loop until stopReason=end_turn
//   5. Stream text_delta events + design mutations out to the caller
//
// This is Phase 1 of the NEX Full Experience Plan (2026-08-20):
//   "NEX can hold a multi-turn design conversation and maintain the
//    customer's staircase-design state across turns. No voice yet.
//    No image generation yet."
//
// Acceptance test (Philip 2026-08-20):
//   "I want a modern straight-flight staircase in oak."
//     → LLM calls updateStaircaseDesign with materialFamily=timber,
//       geometry=straight, wood=oak
//   "Make it open riser."
//     → LLM keeps previous state, calls updateStaircaseDesign with
//       riser=open
//   "Add glass."
//     → LLM infers balustrade, calls updateStaircaseDesign with
//       balustrade="glass_framed"
//   "Actually, change the oak to walnut."
//     → LLM keeps everything else, calls updateStaircaseDesign with
//       wood=walnut

import type { NexBrainProvider, NexMessage, NexUsage } from "../provider";
import { loadDesignPersonaBlock } from "../persona-loader";
import {
  STAIRCASE_AGENT_TOOLS,
} from "@/lib/nex/tools/schemas";
import {
  STAIRCASE_TOOL_HANDLERS,
  type DesignMutation,
  type ToolHandlerContext,
} from "@/lib/nex/tools/handlers/staircase-design";
import type { StaircaseDesignState } from "@/lib/nex/staircase/design-state";

// ─── System prompt · the persona + design-context injection ───────
// The persona base lives in data/nex-voice-profile.md (loaded by
// Session 3 · for now we inline a short version). The full persona
// file adds ~100 design-conversation examples that Session 3 lands.

const STAIRCASE_AGENT_PERSONA = `You are NEX. Your job is to help a homeowner design their staircase in natural conversation.

VOICE (Northern UK tradesperson):
- Friendly, direct, no jargon, no corporate speak.
- British English throughout ("colour", "specialist", "kerb").
- Contractions are natural ("you'll", "it's", "we'll"). Don't over-use.
- Never say "I'm an AI language model" or "As an AI assistant" or "I'd be happy to help".
- Never open with "Absolutely!", "Certainly!", "Great question!" or similar assistant-clichés.
- Call the person "mate" only when it fits naturally · never forced.
- Confirmations are short and matter-of-fact: "Done — set the riser to open." not "I've successfully updated the riser to open for you!"
- When the customer contradicts a previous choice, acknowledge briefly and move on: "Walnut it is then."

CORE BEHAVIOUR:

1. UNDERSTAND design instructions vs questions vs chat.
   - Design instruction ("make it oak", "add glass", "change the handrail to walnut") → call updateStaircaseDesign.
   - Question ("what's the difference between open and closed riser?") → answer, do NOT update state.
   - Ambiguous ("make it wider") → ask a clarifying question OR apply a sensible default and explain the assumption.
   - Chat ("hi", "you there?") → respond briefly, do not update state.

2. READ the current state at the start of every turn using readStaircaseDesign. The customer's "it" and "the handrail" and "add glass" only make sense in context.

3. USE CANONICAL SLUGS ONLY when calling updateStaircaseDesign. Never invent a slug. If the customer says "oak" you write "oak", not "european_oak" and not "Oak". The tool description lists the enums — obey them.

4. NEVER call updateStaircaseDesign for browsing or questions. The doctrine is "chat writes ONLY when the customer issues a direct design instruction". Reading during questions is fine; writing during questions is a violation.

5. NEVER invent a price. If asked "how much" call requestQuote — it will (once shipped) hand off to a specialist. Until then it returns a stub message · tell the customer honestly that the quote is prepared from the specification and a specialist confirms it.

6. NEVER fabricate an image URL. If asked "show me" call generateInspiration — it will (once shipped) generate an inspirational render. Until then it returns a stub · tell the customer honestly that visual generation is arriving soon.

7. When a design update lands, respond with a short natural confirmation that reflects the CURRENT complete state, not just the one field you changed. Example:
     User: "Add glass."
     After tool call, respond: "Done — glass balustrade added. Still an oak straight-flight with open risers."

8. If the customer's message is entirely a design instruction with no question, keep your response short (one or two sentences). If they asked a question too, answer it clearly.

9. Handle the "not sure" path gracefully. If the customer says "I don't know" or "you pick", offer 2-3 sensible options with a one-line reason for each. Do NOT force a decision. Never make the customer feel they need to know a technical term.

10. Never break character. Never explain your inner workings. Never say "I called the updateStaircaseDesign tool with wood=walnut." Just confirm the change in plain English.`;

// ─── Agent runner ─────────────────────────────────────────────────

export type StaircaseAgentInput = {
  /** Conversation history (customer + assistant turns so far). The
   *  final message MUST be a user message that the agent will respond
   *  to on this call. */
  messages: NexMessage[];
  /** Customer's current staircase design. Handlers close over this
   *  for reads · mutations flow back via emitted events (client
   *  applies to its own state store). */
  currentDesign: StaircaseDesignState;
  /** Optional message ID for provenance tagging on any writes. */
  sourceMessageId?: string;
  /** LLM provider (from resolveNexBrain()). */
  provider: NexBrainProvider;
  /** Override the default persona · used for tests. Production should
   *  omit and let the agent load the canonical persona from
   *  data/nex-voice-profile.md (Session 3). */
  personaOverride?: string;
  /** Max iterations of the tool-use loop. Safety cap · under normal
   *  design conversations this stays ≤ 2. */
  maxIterations?: number;
};

export type StaircaseAgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "tool_call_start"; toolName: string; toolId: string }
  | { type: "tool_call_completed"; toolName: string; toolId: string }
  | { type: "design_mutation"; mutation: DesignMutation }
  | {
      type: "done";
      finalMessage: NexMessage;
      allMutations: readonly DesignMutation[];
      totalUsage: NexUsage;
    }
  | { type: "error"; error: string; retriable: boolean };

/** Run one turn of the staircase agent. Yields NEX-canonical events
 *  as the model streams + executes tools. Never throws · errors
 *  emit as `{ type: "error" }` events and terminate the generator.
 *
 *  Typical caller pattern (server-side · API route):
 *
 *  ```ts
 *  const { provider } = resolveNexBrain();
 *  const mutations: DesignMutation[] = [];
 *  for await (const evt of runStaircaseAgent({ messages, currentDesign, provider })) {
 *    switch (evt.type) {
 *      case "text_delta": writeChunk(evt.text); break;
 *      case "design_mutation": mutations.push(evt.mutation); break;
 *      case "done": writeFooter({ finalMessage: evt.finalMessage, mutations, usage: evt.totalUsage }); break;
 *      case "error": writeError(evt.error); break;
 *    }
 *  }
 *  ```
 */
export async function* runStaircaseAgent(
  input: StaircaseAgentInput,
): AsyncGenerator<StaircaseAgentEvent> {
  // Compose the full persona:
  //   1. Inline base persona (STAIRCASE_AGENT_PERSONA above) · always on
  //   2. + few-shot examples from data/nex-voice-profile.md · Session 3
  //   personaOverride short-circuits both (test-only override)
  const persona = input.personaOverride
    ?? STAIRCASE_AGENT_PERSONA + loadDesignPersonaBlock();
  const maxIterations = input.maxIterations ?? 4;

  // Working message history · grows as tools execute + LLM responds.
  const conversation: NexMessage[] = [...input.messages];

  // Collected mutations across all iterations of this turn.
  const mutations: DesignMutation[] = [];

  // Total usage across all iterations of this turn.
  const totalUsage: NexUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
  };

  // Handler context · updated as mutations accumulate so subsequent
  // reads within the same turn reflect prior writes.
  const handlerCtx: ToolHandlerContext = {
    currentDesign: { ...input.currentDesign },
    mutations,
  };

  let iteration = 0;
  let lastFinalMessage: NexMessage | null = null;

  while (iteration < maxIterations) {
    iteration++;

    // Track pending tool calls we need to execute before the next
    // provider call. Keyed by toolId, contains name + input.
    const pendingToolCalls: Array<{ toolId: string; toolName: string; input: Record<string, unknown> }> = [];
    let stopReason = "end_turn";
    let finalMessage: NexMessage | null = null;
    let providerErrored = false;

    for await (const event of input.provider.chat({
      systemPrompt: persona,
      messages: conversation,
      tools: [...STAIRCASE_AGENT_TOOLS],
      toolChoice: "auto",
      maxTokens: 1024,
    })) {
      switch (event.type) {
        case "text_delta":
          yield { type: "text_delta", text: event.text };
          break;
        case "thinking_delta":
          yield { type: "thinking_delta", text: event.text };
          break;
        case "tool_call_start":
          yield { type: "tool_call_start", toolName: event.toolName, toolId: event.toolId };
          break;
        case "tool_call_ready":
          pendingToolCalls.push({ toolId: event.toolId, toolName: event.toolName, input: event.input });
          break;
        case "done":
          stopReason = event.stopReason;
          finalMessage = event.finalMessage;
          totalUsage.inputTokens += event.usage.inputTokens;
          totalUsage.outputTokens += event.usage.outputTokens;
          totalUsage.cachedInputTokens += event.usage.cachedInputTokens;
          totalUsage.cacheWriteTokens += event.usage.cacheWriteTokens;
          break;
        case "error":
          yield { type: "error", error: event.error, retriable: event.retriable };
          providerErrored = true;
          break;
      }
      if (providerErrored) return;
    }

    if (!finalMessage) {
      yield { type: "error", error: "provider_emitted_no_done_event", retriable: false };
      return;
    }

    lastFinalMessage = finalMessage;

    // If the model didn't ask for tools, we're done.
    if (stopReason !== "tool_use" || pendingToolCalls.length === 0) {
      break;
    }

    // Append the assistant's message (with tool_use blocks) to the
    // conversation so the next call has the context.
    conversation.push(finalMessage);

    // Execute each pending tool call and build tool_result blocks
    // for the response message.
    const mutationCountBefore = mutations.length;
    const toolResultBlocks: NexMessage["content"] = [];

    for (const call of pendingToolCalls) {
      const handler = STAIRCASE_TOOL_HANDLERS[call.toolName];
      let result: string;
      if (!handler) {
        result = JSON.stringify({
          status: "error",
          error: "unknown_tool",
          tool: call.toolName,
        });
      } else {
        // Add sourceMessageId to updateStaircaseDesign calls if the
        // model didn't include one — provenance is not optional.
        const argsWithProvenance =
          call.toolName === "updateStaircaseDesign" && input.sourceMessageId
            ? { ...call.input, sourceMessageId: input.sourceMessageId }
            : call.input;
        try {
          result = await handler(argsWithProvenance, handlerCtx);
        } catch (err) {
          result = JSON.stringify({
            status: "error",
            error: "handler_threw",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
      (toolResultBlocks as Array<{ type: "tool_result"; toolId: string; result: string; isError?: boolean }>).push({
        type: "tool_result",
        toolId: call.toolId,
        result,
      });
      yield { type: "tool_call_completed", toolName: call.toolName, toolId: call.toolId };
    }

    // Emit any new mutations to the caller (client applies them to
    // its state store · these are the "design_updated" signals for
    // the UI to re-render).
    for (let i = mutationCountBefore; i < mutations.length; i++) {
      yield { type: "design_mutation", mutation: mutations[i]! };
    }

    // Update the handler context's local view of the design so
    // subsequent readStaircaseDesign calls within this same turn see
    // the mutations we just applied.
    handlerCtx.currentDesign = applyMutationsInPlace(handlerCtx.currentDesign, mutations.slice(mutationCountBefore));

    // Append the tool result message (role: "tool") and loop back
    // to give the LLM the results.
    conversation.push({ role: "tool", content: toolResultBlocks });
  }

  // Loop exited · emit done with the collected mutations + usage.
  if (!lastFinalMessage) {
    yield { type: "error", error: "no_final_message_after_loop", retriable: false };
    return;
  }
  yield {
    type: "done",
    finalMessage: lastFinalMessage,
    allMutations: mutations,
    totalUsage,
  };
}

// ─── Utilities ─────────────────────────────────────────────────────

function applyMutationsInPlace(
  base: StaircaseDesignState,
  mutations: readonly DesignMutation[],
): StaircaseDesignState {
  const next: StaircaseDesignState = { ...base };
  for (const m of mutations) {
    if (m.value === null) {
      delete next[m.field];
    } else {
      (next as Record<string, unknown>)[m.field] = m.value;
    }
  }
  return next;
}

// Re-export the persona for tests + Session 3 to extend.
export { STAIRCASE_AGENT_PERSONA };
