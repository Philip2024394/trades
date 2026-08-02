// Merchant-aware Nex Chat endpoint · Philip 2026-08-02.
//
// Replaces the temporary /api/nex/staircase-chat wiring the Trade Centre
// merchant profile sheet was using. This route is DEDICATED to
// customer-to-merchant enquiries — Nex acts as an intake agent that
// pre-qualifies the customer before the enquiry lands with the trade.
//
// v1 behaviour (this cycle):
//   - Accepts { message, merchant_id, merchant_name?, conversation_id?, intent? }
//   - Returns an intake-agent reply keyed on `intent` when supplied (quote /
//     survey / question / order / advice) so the quick-action chips get a
//     tailored next-question. Free-text messages get a neutral acknowledgement.
//   - No LLM synthesis · no fabricated merchant data · no availability claims.
//     Real merchant reasoning (profile · availability · services · pricing ·
//     previous conversations) is a later cycle — this route is the seam.
//   - Fire-and-forget log to console for now; DB persistence is a follow-up.
//
// Why isolate this from the staircase brain: a plumber's customer asking
// "when can you come out?" should never be routed to a staircase Q&A layer.
// A merchant-chat route lets Nex reason about the merchant's context in a
// later cycle without touching this UI code.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prefilled-chip intents. Each chip on the profile sheet maps to one of
// these so v1 Nex can respond in a way that clearly starts qualifying the
// customer. Any string outside this set is treated as free text.
const KNOWN_INTENTS = new Set([
  "quote", "survey", "question", "order", "advice",
]);

type MerchantChatBody = {
  message?: string;
  merchant_id?: string;
  merchant_name?: string;
  conversation_id?: string;
  intent?: string;
};

/**
 * Compose Nex's next-question given the customer's opening intent.
 * These are AUTHORED reply templates — no LLM synthesis. Rule A safe.
 * A later cycle will replace these with real merchant-aware reasoning
 * (checking availability · service catalogue · location match · prior jobs).
 */
function composeIntakeReply(
  intent: string | undefined,
  merchantName: string,
): string {
  const shortName = merchantName.split(" ")[0] || merchantName;
  switch (intent) {
    case "quote":
      return `Great — I'll gather what ${shortName} needs to quote accurately. What's the project, and where is it based? A rough budget or timescale is also helpful if you have one.`;
    case "survey":
      return `Perfect — a site survey is the right first step. What's the property address (or nearest postcode), and are there any dates that suit you? I'll put the request together for ${shortName}.`;
    case "question":
      return `Happy to help. What would you like to ask ${shortName}? I'll pass your question along and, where I can, share what's already on their profile.`;
    case "order":
      return `Got it — you'd like to discuss an existing order with ${shortName}. Do you have an order number or reference? If not, roughly when was it placed and what was it for?`;
    case "advice":
      return `Sure — I'll help you get advice from ${shortName}. Describe the situation and what you're weighing up, and I'll prepare a clear enquiry for them.`;
    default:
      return `Thanks — I'll prepare your enquiry for ${shortName}. To help them respond quickly, could you share the project type, your location, and any dates that matter to you?`;
  }
}

export async function POST(req: Request) {
  let body: MerchantChatBody;
  try {
    body = (await req.json()) as MerchantChatBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const merchantId = typeof body.merchant_id === "string" ? body.merchant_id.trim() : "";
  const merchantName =
    typeof body.merchant_name === "string" && body.merchant_name.trim().length > 0
      ? body.merchant_name.trim()
      : "the trade";
  const intent = typeof body.intent === "string" && KNOWN_INTENTS.has(body.intent)
    ? body.intent
    : undefined;
  const conversationId =
    typeof body.conversation_id === "string" && body.conversation_id.length > 0
      ? body.conversation_id
      : randomUUID();

  if (!message || !merchantId) {
    return NextResponse.json(
      { ok: false, error: "message and merchant_id required" },
      { status: 400 },
    );
  }

  // Console-log the enquiry so it's visible during v1 testing. Real DB
  // persistence goes into a nex_merchant_enquiries table in the next cycle.
  console.log(
    JSON.stringify({
      module: "nex.merchant-chat",
      conversation_id: conversationId,
      merchant_id: merchantId,
      merchant_name: merchantName,
      intent,
      message: message.slice(0, 500),
      at: new Date().toISOString(),
    }),
  );

  const answer = composeIntakeReply(intent, merchantName);

  return NextResponse.json({
    ok: true,
    answer,
    conversation_id: conversationId,
    served_by: "nex-merchant-chat-v1",
    intent: intent ?? null,
    // Placeholder for follow-ups: signals we could later pass to the tradesperson.
    // For v1 we just tag the intent · a later cycle populates project_type ·
    // location · timescale · budget · attachments etc.
    structured_signals: {
      intent: intent ?? "freetext",
    },
  });
}
