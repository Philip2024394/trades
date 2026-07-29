// Telemetry for NEX chat replies. Composes with the existing
// hammerex_nex_events table via insertNexEvent — no new schema.
//
// Failure is deliberately silent. A telemetry write should never
// block or fail a user-facing chat reply.

import { insertNexEvent } from "@/lib/nex/brains/_supabase";
import type { Stage } from "./types";

export type ChatReplyEvent = {
  conversation_id:      string;
  brain_slug:           string;
  intent:               string;   // ChatIntent from classifyIntent.ts
  intent_matched:       boolean;  // false when intent === "general"
  intent_family:        string;   // coarser family used by the retriever
  stage:                Stage;
  retrieved_ids:        string[]; // golden reply IDs shown to the LLM this turn
  user_message_length:  number;
  response_length:      number;
  had_greeting:         boolean;  // classifier's mixed-intent hint
  top_cosine:           number;   // raw cosine of best candidate (before bonuses); 0 if none scored
  retrieval_gated:      boolean;  // true when threshold caused retrieved_ids=[]
};

/** Fire-and-forget. Awaited so tests can synchronise, but any error
 *  is swallowed. Callers should NOT await this on the hot path if
 *  latency matters — the API route awaits it after the response has
 *  already been serialised. */
export async function logNexChatReply(event: ChatReplyEvent): Promise<void> {
  try {
    await insertNexEvent({
      event_type:  "nex_chat_reply",
      entity_type: "nex_conversation",
      entity_id:   event.conversation_id,
      actor_id:    null,
      actor_role:  "customer",
      before_json: null,
      after_json:  null,
      metadata: {
        brain_slug:          event.brain_slug,
        intent:              event.intent,
        intent_matched:      event.intent_matched,
        intent_family:       event.intent_family,
        stage:               event.stage,
        retrieved_ids:       event.retrieved_ids,
        user_message_length: event.user_message_length,
        response_length:     event.response_length,
        had_greeting:        event.had_greeting,
        top_cosine:          event.top_cosine,
        retrieval_gated:     event.retrieval_gated,
      },
    });
  } catch {
    // Never let telemetry failure surface to the user.
  }
}
