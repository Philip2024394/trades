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
// Runtime Core v1 bridge · feature-flagged via NEX_STAIRCASE_RUNTIME_ENABLED
// When flag is off (default), bridge is inert · zero behavior change.
import { tryStaircaseRuntimeBridge } from "@/lib/nex/staircase-bridge";
// Staircase Advisor v0 · feature-flagged via NEX_STAIRCASE_ADVISOR_ENABLED
// When flag is off (default), advisor is inert · zero behavior change.
// When ON: advisor runs BEFORE the runtime bridge · takes priority on
// decision-request messages · falls through to bridge otherwise.
import { tryStaircaseAdvisor } from "@/lib/nex/staircase-advisor";

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
    message?:                unknown;
    history?:                unknown;
    expertise_override?:     unknown;
    conversation_id?:        unknown;
    intent?:                 unknown;
    recent_ids?:             unknown;
    // Philip 2026-08-02 · Staircase Library floating-Nex context bridge.
    focused_design_context?: unknown;
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
  // Philip 2026-08-02 · Staircase Library floating-Nex context bridge.
  // When the caller (Staircase Library) supplies focused_design_context,
  // prepend a small inline hint to the message so the composer + advisor
  // understand which staircase the customer is currently viewing. Keeps
  // the raw message clean for topic memory · injects context transparently.
  const rawMessage = body.message.trim();
  let message = rawMessage;
  let focusedDesignId: string | null = null;
  if (typeof body.focused_design_context === "string" && body.focused_design_context.trim().length > 0) {
    const ctx = body.focused_design_context.trim().slice(0, 400);
    message = `[Currently viewing in Staircase Library: ${ctx}]\n\n${rawMessage}`;
    const m = ctx.match(/design_id=([A-Z0-9-]+)/i);
    if (m) focusedDesignId = m[1];
  }

  // Philip 2026-08-02 · Staircase Library · 4-layer authored Q&A.
  // Priority: IMAGE → COMPONENT → FAMILY → UNIVERSAL. First match wins ·
  // authored answer returned VERBATIM (Rule A · no LLM synthesis · Philip's
  // words only). Empty answer slots are skipped inside the matcher.
  //
  // GATE (Philip 2026-08-02): supplier intent + country signals bypass
  // the layered Q&A · they belong to the Advisor / Supplier Workflow.
  // If the customer is asking for a supplier connection ("can someone
  // build this"), that IS a workflow trigger · we skip Q&A and let the
  // Advisor handle it. Same for country announcements ("I'm in Ireland").
  //
  // Philip 2026-08-02 · WORKFLOW-IN-FLIGHT GATE: once a supplier enquiry
  // is being collected for this conversation, EVERY subsequent customer
  // message is a workflow answer, not a knowledge question. Even if the
  // answer ("oak and glass balustrade") contains a term that matches a
  // Universal-QA definition, the workflow owns the turn. Prevents the
  // "balustrade" definition from intercepting a materials answer.
  {
    const [{ matchLayeredQa }, { isSupplierIntent }, { detectCountry }, { peekEnquiry }] = await Promise.all([
      import("@/lib/nex/images/design-qa"),
      import("@/lib/nex/business-brain/supplier-intent"),
      import("@/lib/nex/staircase-advisor/regional-terminology"),
      import("@/lib/nex/business-brain/enquiry-state"),
    ]);
    const convForGate = typeof body.conversation_id === "string" && body.conversation_id.length > 0
      ? body.conversation_id
      : null;
    const inFlightEnquiry = convForGate ? peekEnquiry(convForGate) : null;
    const enquiryInFlight = inFlightEnquiry !== null
      && (inFlightEnquiry.step === "collecting" || inFlightEnquiry.step === "explaining");
    const skipQa = enquiryInFlight || isSupplierIntent(rawMessage) || detectCountry(rawMessage) !== null;
    const qaHit = skipQa ? null : matchLayeredQa(focusedDesignId ?? "", rawMessage);
    if (qaHit) {
      const conversationIdForQa =
        typeof body.conversation_id === "string" && body.conversation_id.length > 0
          ? body.conversation_id
          : randomUUID();
      const layerLabel = qaHit.layer === "image"     ? "design-qa"
                       : qaHit.layer === "component" ? "component-qa"
                       : qaHit.layer === "materials" ? "materials-qa"
                       : qaHit.layer === "family"    ? "family-qa"
                       :                                "universal-qa";
      return NextResponse.json({
        ok:              true,
        answer:          qaHit.entry.a,
        citations: [{
          module:  layerLabel,
          ref_id:  qaHit.layer_ref ?? focusedDesignId ?? "universal",
          snippet: qaHit.entry.q,
          source:  `${layerLabel}-authored`,
        }],
        wood_cards:      [],
        visual_intent:   "neutral",
        comparison:      false,
        expertise:       { level: "unknown", confidence: 0.3, signals: [], score: 0 },
        status:          `answered_by_${layerLabel.replace("-", "_")}`,
        brain_versions:  { "images:design-qa": "2.0-layered" },
        conversation_id: conversationIdForQa,
        stage:           "library_qa",
        retrieved_ids:   [`${layerLabel}:${qaHit.layer_ref ?? focusedDesignId ?? "universal"}`],
        match_score:     qaHit.score,
        layer:           qaHit.layer,
        layer_ref:       qaHit.layer_ref,
      });
    }
  }

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

  // ── Staircase Advisor v0 · pre-bridge intercept (feature-flagged) ──
  // Flag OFF (default): advisor inactive · zero behavior change.
  // Flag ON: advisor runs FIRST. Trigger patterns match decision-request
  // messages ("help me choose", "I don't know what staircase", etc.).
  // If not triggered, returns null and control passes to the runtime bridge.
  // Advisor uses only Philip-authored evidence (Section 8 contract) and
  // known-limitation branches (Replacement · Extension) return a polite
  // handoff message rather than a fabricated recommendation.
  if (process.env.NEX_STAIRCASE_ADVISOR_ENABLED === "1") {
    const advised = await tryStaircaseAdvisor({
      message,
      conversationId,
      stage,
    });
    if (advised !== null) {
      await logNexChatReply({
        conversation_id:       conversationId,
        brain_slug:            "staircase",
        intent:                clientIntent,
        intent_matched:        clientIntent !== "general",
        intent_family:         intentFamily,
        stage,
        retrieved_ids:         [],
        user_message_length:   message.length,
        response_length:       (advised.answer ?? "").length,
        had_greeting:          false,
        top_cosine:            0,
        retrieval_gated:       false,
        served_by:             "staircase-advisor-v0",
        runtime_core_strategy: `advisor-${advised.advisor.action}`,
      });
      return NextResponse.json(advised);
    }
  }

  // ── Runtime Core v1 bridge · pre-composer intercept (feature-flagged) ──
  // Flag OFF (default): bridge inactive · zero behavior change.
  // Flag ON: bridge tries Runtime Core v1 first. If Runtime Core has a
  // high-confidence customer-facing answer, that answer is returned and
  // composeStaircaseAnswer is skipped. If Runtime Core returns null
  // (unknown / low confidence), falls through to existing composer flow.
  if (process.env.NEX_STAIRCASE_RUNTIME_ENABLED === "1") {
    const bridged = await tryStaircaseRuntimeBridge({
      message,
      conversationId,
      stage,
    });
    if (bridged !== null) {
      // Log telemetry with served_by marker so we can distinguish
      // bridge-served vs composer-served answers in the audit trail.
      await logNexChatReply({
        conversation_id:     conversationId,
        brain_slug:          "staircase",
        intent:              clientIntent,
        intent_matched:      clientIntent !== "general",
        intent_family:       intentFamily,
        stage,
        retrieved_ids:       [],
        user_message_length: message.length,
        response_length:     (bridged.answer ?? "").length,
        had_greeting:        false,
        top_cosine:          0,
        retrieval_gated:     false,
        served_by:           "runtime-core-v1",
        runtime_core_strategy: bridged.runtime_core.strategy,
      });
      return NextResponse.json(bridged);
    }
    // bridge returned null → fall through to existing composer flow
  }

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
    // Composer served the reply · Advisor + Runtime Core both missed · this is
    // a GAP. Capture the message text so admin can see what to author next.
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
      had_greeting:        false,
      top_cosine:          retrieval.top_cosine,
      retrieval_gated:     retrieval.gated,
      user_message:        message,
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
      presentation:    result.presentation,
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
