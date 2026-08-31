// POST /api/nex-conv/chat
//
// Historically this was the direct entry to the ADR-0044 conversation-
// learning pipeline (Qwen 2.5 3B via Ollama + STAIRCASE_INTENTS/ENTITIES).
// Philip 2026-08-31 · Stage 3.6 · "NEX Speaking Brain" · Option B: this
// route now sits BEHIND the canonical NEX Brain (orchestrateChatTurn).
// The Brain owns intent, market, and routing. Only when the intent
// classifies as genuine UK staircase (staircase intent + market=UK)
// does the request fall through to the Qwen/STAIRCASE pipeline.
//
// Rationale: NexAppShell's voice composer (useNexVoice) posts here.
// Before this change, accommodation/food/tourism turns in the phone
// shell landed on Qwen's staircase-design intake ("what sort of look
// are you going for — traditional, contemporary...") because the route
// bypassed the Brain entirely.
//
// The Qwen specialist remains available and unchanged for UK staircase
// conversations. It becomes a capability UNDER the Brain, not the
// default. Zero third-party AI in the response path — the Brain is
// deterministic and Ollama is validated as local by respond-local.mjs.

import { NextResponse, type NextRequest } from "next/server";
import { orchestrateChatTurn, orchestrateChatTurnLive } from "@/lib/nex/brain/orchestrate";
import { getSession } from "@/lib/nex/brain/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Cold boot on the first customer message includes: pg pool init + all conv
// tables loaded into memory (~15s at MVP scale) + Ollama model load into VRAM
// if idle (~15s). Total worst case ~35s. 120s ceiling gives comfortable margin.
// Brain-only turns are deterministic and return in <100ms after warmup.
export const maxDuration = 120;

let _bootPromise: Promise<{ store: any; ready: true }> | null = null;

async function boot() {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async () => {
    // @ts-expect-error — pipeline lives outside `src/` (scripts/nex-conv)
    const { createStore } = await import(
      /* @vite-ignore */ "../../../../../scripts/nex-conv/lib/store-factory.mjs"
    );
    // @ts-expect-error same reason
    const { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } = await import(
      /* @vite-ignore */ "../../../../../scripts/nex-conv/lib/entities.mjs"
    );

    const store = await createStore({ backend: "postgres" });

    for (const intent of STAIRCASE_INTENTS) await store.upsertIntent(intent);
    for (const ent of STAIRCASE_ENTITIES)
      await store.upsertEntity({ ...ent, brain: "staircase_brain" });

    return { store, ready: true as const };
  })();
  return _bootPromise;
}

type ChatRequest = {
  conversation_id?: string;
  message?: string;
  business_id?: string | null;
  /**
   * User's market context · Philip 2026-08-31 Stage 3.6. When absent,
   * defaults to "ID" (the phone shell serves Indonesian users). Only
   * market="UK" opens the door to the UK staircase Qwen specialist.
   */
  market?: "ID" | "UK" | "US";
  /** Stage 3.26 · Long-Term Memory user identity. Opaque client-provided
   *  string. Absent = LTM inactive. */
  user_id?: string;
  /** Stage 3.26 · Explicit consent for LTM read/write. Required for
   *  cross-session preference persistence. */
  consent?: { long_term_memory?: boolean };
};

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function serverError(msg: string, status = 500) {
  return NextResponse.json({ error: msg }, { status });
}

// GET /api/nex-conv/chat · idempotent warmup for the Qwen store.
// Kept for legacy clients that pre-warm on mount. Brain turns don't
// need this (deterministic, no boot cost).
export async function GET() {
  const t0 = Date.now();
  try {
    const { store } = await boot();
    return NextResponse.json({
      status: "ready",
      warmup_ms: Date.now() - t0,
      store_counts: store.counts?.() ?? null,
    });
  } catch (e: unknown) {
    return serverError(
      "warmup failed · " + String((e as Error)?.message ?? e).slice(0, 200),
      503
    );
  }
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return badRequest("body must be valid JSON");
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return badRequest("message is required and non-empty");
  if (message.length > 2000)
    return badRequest("message exceeds 2000 chars");

  const conversation_id =
    typeof body.conversation_id === "string" && /^[0-9a-f-]{8,}$/i.test(body.conversation_id)
      ? body.conversation_id
      : crypto.randomUUID();

  const userMarket: "ID" | "UK" | "US" =
    body.market === "UK" || body.market === "US" || body.market === "ID"
      ? body.market
      : "ID";

  // ─── Canonical Brain FIRST (Philip 2026-08-31 · Option B) ───────
  //
  // The Brain owns intent classification, market gating, safety mode,
  // theme routing, and the Indonesian knowledge world. The Qwen
  // staircase specialist only sees turns the Brain explicitly hands
  // off (intent="staircase" AND userMarket="UK").
  const brainT0 = Date.now();
  // Stage 3.26 · Long-Term Memory · pass userId + consent through.
  const userId = typeof body.user_id === "string" && body.user_id.length > 0 ? body.user_id : undefined;
  const consentLongTermMemory = body.consent?.long_term_memory === true;
  // Stage 3.34 · Phase 27e · Live World access for the production
  // conversation route. `useLiveWorld:true` routes accommodation +
  // future verticals through the World-adapter path so the composer's
  // spoken text + the 3-card set + the expanded-list surface all
  // derive from the SAME live directory retrieval. When the intent
  // does not map to a wired vertical (or the adapter is unreachable),
  // the wrapper falls back to the sync path with a caveat · never
  // fabricates. Existing regressions untouched because the sync path
  // still runs inside the wrapper — the wrapper only ADDS live-World
  // enrichment · it does not replace the sync composer.
  const composed = await orchestrateChatTurnLive(message, {
    userMarket,
    conversationId: conversation_id,
    userId,
    consentLongTermMemory,
    useLiveWorld: true,
  });
  const brainMs = Date.now() - brainT0;

  const isUkStaircase =
    userMarket === "UK" && composed.intent === "staircase";

  if (!isUkStaircase) {
    return NextResponse.json({
      conversation_id,
      reply: composed.reply,
      understood_intent: composed.intent ?? null,
      understood_entities: [],
      retrieved_top_k_count: 0,
      served_by: "nex-brain-orchestrator",
      intent: composed.intent ?? null,
      intent_reason: composed.intent_reason ?? null,
      suggestions: composed.suggestions,
      card: composed.card ?? null,
      state_summary: {
        turn_count: 1,
        current_topic: composed.intent ?? null,
        established_facts: {},
        entities_in_focus: [],
        constraints: [],
        stage: "brain",
        corrections_logged: 0,
        current_emotion: "neutral",
        handoff_recommended: false,
        thin_packet_strikes: 0,
        condensed_history_present: false,
        conversation_language: "en",
      },
      // Stage 3.9 · Brain capability audit + goal state exposed on
      // every turn so HQ, tests, and future observability tooling can
      // see what the Brain actually did.
      brain_capabilities: composed.capabilities ?? [],
      goal: composed.goal ?? null,
      // Stage 3.10 · Reflection self-check report · constitutional.
      reflection: composed.reflection ?? null,
      // Stage 3.11 · Confidence per-reply audit · constitutional.
      confidence: composed.confidence ?? null,
      // Stage 3.12 · Meta-Cognition umbrella · constitutional.
      meta_cognition: composed.meta_cognition ?? null,
      // Stage 3.14 · Entity Intelligence · session entity roll-up
      // (mirror of meta_cognition.whatIKnow.entitiesSeen for direct access).
      entities: composed.meta_cognition?.whatIKnow?.entitiesSeen ?? null,
      // Stage 3.15 · Reference Resolution · resolved reference for this turn.
      current_reference: (() => {
        const sess = conversation_id ? getSession(conversation_id) : null;
        return sess?.currentReference ?? null;
      })(),
      // Stage 3.16 · Comparison · structured side-by-side (when user asked to compare).
      comparison: composed.comparison ?? null,
      // Stage 3.17 · Recommendation · evidence-based ranking (when user asked to recommend).
      recommendation: composed.recommendation ?? null,
      // Stage 3.18 · Tool Selection · which tool the Brain chose for this turn.
      tool_decision: composed.tool_decision ?? null,
      // Stage 3.20 · Governance · permission audit for this turn.
      governance: composed.governance ?? null,
      // Stage 3.21 · Action · proposal + execution (link generation v1).
      action_proposal: composed.action_proposal ?? null,
      action_execution: composed.action_execution ?? null,
      // Stage 3.22 · Verification · CONSTITUTIONAL fifth · did the action match intent?
      verification: composed.verification ?? null,
      // Stage 3.23 · Prediction · anticipated next likely user action.
      prediction: composed.prediction ?? null,
      // Stage 3.24 · Initiative · did NEX volunteer a proactive suggestion this turn?
      initiative: composed.initiative ?? null,
      // Stage 3.25 · Adaptation · pattern signals from Learning ledger this conversation.
      adaptation: composed.adaptation ?? null,
      // Stage 3.26 · Long-Term Memory · cross-session preferences (when userId + consent).
      long_term_memory: composed.long_term_memory ?? null,
      // Stage 3.27 · Personalization · returning-user signal.
      personalization: composed.personalization ?? null,
      // Stage 3.28 · Attention · cross-turn priority ranking.
      attention: composed.attention ?? null,
      // Stage 3.29 · Planning · multi-step plan for accommodation flow.
      planning: composed.planning ?? null,
      // Stage 3.30 · Personality · post-processed reply audit.
      personality_profile: composed.personality_profile ?? null,
      // Stage 3.34 · Live World access · cards + expanded surface + latency.
      // world_cards populate the 3-landscape-card presentation from
      // real directory rows (nex.accommodation_business etc). world_expanded_page
      // fires when the user asked "show me more" and we have real
      // records for the current goal. Both derive from the SAME live
      // World retrieval that fed the composer's spoken reply.
      world_cards: composed.world_cards ?? null,
      world_expanded_page: composed.world_expanded_page ?? null,
      world_latency_ms: composed.world_latency_ms ?? null,
      metrics: {
        total_ms: brainMs,
        brain_ms: brainMs,
        world_ms: composed.world_latency_ms ?? null,
        specialist_used: null,
      },
    });
  }

  // ─── UK staircase fallthrough: existing Qwen pipeline ───────────
  let store: any;
  try {
    ({ store } = await boot());
  } catch (e: unknown) {
    return serverError(
      "conversation store failed to initialise · " + String((e as Error)?.message ?? e).slice(0, 200)
    );
  }

  // @ts-expect-error — pipeline outside src/
  const infer = await import(/* @vite-ignore */ "../../../../../scripts/nex-conv/lib/infer.mjs");

  const stored = store.getState(conversation_id);
  const state = stored ?? infer.newState({ conversation_id, brain: "staircase_brain", business_id: body.business_id ?? null });

  let out: any;
  try {
    out = await infer.processTurn({
      store,
      state,
      brain: "staircase_brain",
      text: message,
      speaker: "customer",
      withProse: true,
    });
  } catch (e: unknown) {
    return serverError(
      "conversation engine failed · " + String((e as Error)?.message ?? e).slice(0, 300)
    );
  }

  try {
    await store.upsertState(state);
  } catch {
    // non-fatal
  }

  try {
    const customerTurn = await store.writeTurn({
      conversation_id,
      turn_index: Math.max(0, state.turn_count - 2),
      speaker: "customer",
      text: message,
      detected_intent: out.understood_intent?.slug ?? null,
      detected_entities: out.understood_entities ?? [],
      used_item_ids: (out.retrieved_top_k ?? []).map((k: any) => k.id),
      walked_edge_ids: [],
      latency_ms: out.total_ms ?? null,
    });
    await store.writeTurn({
      conversation_id,
      turn_index: state.turn_count - 1,
      speaker: "nex",
      text: out.prose?.text ?? "(no prose)",
      detected_intent: null,
      detected_entities: [],
      used_item_ids: (out.retrieved_top_k ?? []).map((k: any) => k.id),
      walked_edge_ids: [],
      latency_ms: out.stage_timings?.prose_ms ?? null,
    });
    void customerTurn;
  } catch {
    // non-fatal
  }

  const proseErr = out.prose?.error;
  if (proseErr) {
    return NextResponse.json({
      conversation_id,
      reply: null,
      error: "response layer error · " + String(proseErr).slice(0, 300),
      state_summary: shapeStateSummary(state),
      served_by: "uk-staircase-qwen",
    }, { status: 502 });
  }

  return NextResponse.json({
    conversation_id,
    reply: out.prose?.text ?? "(no prose returned)",
    understood_intent: out.understood_intent?.slug ?? null,
    understood_entities: out.understood_entities ?? [],
    retrieved_top_k_count: (out.retrieved_top_k ?? []).length,
    served_by: "uk-staircase-qwen",
    intent: composed.intent ?? "staircase",
    intent_reason: composed.intent_reason ?? null,
    suggestions: composed.suggestions,
    state_summary: shapeStateSummary(state),
    metrics: {
      total_ms: (out.total_ms ?? 0) + brainMs,
      brain_ms: brainMs,
      specialist_ms: out.total_ms ?? null,
      prose_ms: out.stage_timings?.prose_ms ?? null,
      prose_tokens_prompt: out.prose?.tokens_prompt ?? null,
      prose_tokens_completion: out.prose?.tokens_completion ?? null,
      prose_model: out.prose?.model ?? null,
      prose_provider: out.prose?.provider ?? null,
      specialist_used: "uk-staircase-qwen",
    },
  });
}

function shapeStateSummary(state: any) {
  return {
    turn_count: state?.turn_count ?? 0,
    current_topic: state?.current_topic ?? null,
    established_facts: state?.established_facts ?? {},
    entities_in_focus: (state?.entities_in_focus ?? []).slice(0, 10),
    constraints: state?.constraints ?? [],
    stage: state?.stage ?? "discover",
    corrections_logged: (state?.corrections_log ?? []).length,
    current_emotion: state?.current_emotion ?? "neutral",
    handoff_recommended: state?.handoff_recommended === true,
    thin_packet_strikes: state?.thin_packet_strikes ?? 0,
    condensed_history_present: !!state?.condensed_history,
    conversation_language: state?.conversation_language ?? "en",
  };
}
