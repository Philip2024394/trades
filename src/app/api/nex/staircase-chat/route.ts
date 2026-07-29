// POST /api/nex/staircase-chat
//
// Public admin-testing endpoint for chatting with Nex Staircases.
// Feature-flagged behind NEX_BRAIN_RUNTIME_ENABLED. No auth for now —
// admin (Philip) uses this to test the Brain end-to-end before proper
// merchant/homeowner packaging is designed.
//
// Body: {
//   message:            string,
//   history?:           [{role, content}...],
//   expertise_override? "trade" | "homeowner" | "unknown",
//   conversation_id?:   string,   // client-provided; server-generated if missing
//   intent?:            string,   // client-classified ChatIntent from classifyIntent.ts
//   recent_ids?:        string[], // Golden Reply IDs shown in recent turns (recency exclusion)
// }
// Returns: {
//   ok, answer, citations, wood_cards, visual_intent, comparison,
//   expertise, status, brain_versions,
//   conversation_id,   // echoed / minted
//   stage,             // server-classified conversation stage
//   retrieved_ids      // Golden Reply IDs shown to the LLM this turn
// }

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { composeStaircaseAnswer } from "@/lib/nex/brains/_composer";
import { classifyStage } from "@/lib/nex/golden/stage";
import {
  retrieveGoldenReplies,
  serialiseGoldenExamples,
  intentToFamily,
} from "@/lib/nex/golden/retrieve";
import { logNexChatReply } from "@/lib/nex/golden/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.NEX_BRAIN_RUNTIME_ENABLED !== "1") {
    return NextResponse.json(
      { ok: false, error: "brain_runtime_disabled" },
      { status: 503 }
    );
  }

  let body: {
    message?:            unknown;
    history?:            unknown;
    expertise_override?: unknown;
    conversation_id?:    unknown;
    intent?:             unknown;
    recent_ids?:         unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.message !== "string" || body.message.trim() === "") {
    return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });
  }

  const rawOverride = typeof body.expertise_override === "string" ? body.expertise_override : "";
  const expertiseOverride =
    rawOverride === "trade" || rawOverride === "homeowner" || rawOverride === "unknown"
      ? rawOverride
      : undefined;

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (Array.isArray(body.history)) {
    for (const raw of body.history) {
      if (
        raw &&
        typeof raw === "object" &&
        (raw as { role?: unknown }).role !== undefined &&
        typeof (raw as { content?: unknown }).content === "string"
      ) {
        const r = (raw as { role: string }).role;
        if (r === "user" || r === "assistant") {
          history.push({ role: r, content: (raw as { content: string }).content });
        }
      }
    }
  }

  // ─── Golden Reply pipeline ─────────────────────────────────────
  const message = body.message.trim();
  const conversationId =
    typeof body.conversation_id === "string" && body.conversation_id.length > 0
      ? body.conversation_id
      : randomUUID();
  const clientIntent =
    typeof body.intent === "string" && body.intent.length > 0 ? body.intent : "general";
  const intentFamily = intentToFamily(clientIntent);
  const stage = classifyStage(message);
  const recentIds: string[] = Array.isArray(body.recent_ids)
    ? body.recent_ids.filter((x): x is string => typeof x === "string").slice(0, 12)
    : [];

  // Retrieval never throws — returns empty result if embeddings are
  // missing, the API key is not set, or the top match falls below
  // the cosine threshold. In every "no result" case the composer
  // degrades to base voice (better than mimicking irrelevant few-shots).
  const retrieval = await retrieveGoldenReplies({
    intent_family: intentFamily,
    stage,
    userMessage:   message,
    recentIds,
    limit:         3,
  });
  const goldenExamplesBlock = serialiseGoldenExamples(retrieval.replies);
  const retrievedIds = retrieval.replies.map((r) => r.id);

  try {
    const result = await composeStaircaseAnswer({
      brain_slug:          "staircase",
      question:            message,
      history:             history.length > 0 ? history : undefined,
      expertiseOverride:   expertiseOverride,
      stage,
      goldenExamplesBlock: goldenExamplesBlock || undefined,
    });

    // Fire-and-log telemetry AFTER the response is built so the user
    // never waits on the DB write. Awaited so the request stays open
    // until it's flushed (Node fetch), but the try/catch in
    // logNexChatReply guarantees silent failure.
    await logNexChatReply({
      conversation_id:     conversationId,
      brain_slug:          "staircase",
      intent:              clientIntent,
      intent_matched:      clientIntent !== "general",
      intent_family:       intentFamily,
      stage,
      retrieved_ids:       retrievedIds,
      user_message_length: message.length,
      response_length:     (result.answer ?? "").length,
      had_greeting:        false, // client sets this via body extension later
      top_cosine:          retrieval.top_cosine,
      retrieval_gated:     retrieval.gated,
    });

    return NextResponse.json({
      ok:              true,
      answer:          result.answer,
      citations:       result.citations,
      wood_cards:      result.wood_cards,
      visual_intent:   result.visual_intent,
      comparison:      result.comparison,
      expertise:       result.expertise,
      status:          result.status,
      brain_versions:  result.brain_versions,
      conversation_id: conversationId,
      stage,
      retrieved_ids:   retrievedIds,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "internal_error" },
      { status: 500 }
    );
  }
}
