// POST /api/nex-conv/chat
//
// The ONE integration point between the MT-1 chat UI (and any other NEX
// chat surface later) and the ADR-0044 conversation-learning pipeline.
//
// Flow:
//   1. Load or create a per-conversation state (persisted in nex.conv_states)
//   2. Call processTurn(withProse: true) — this runs entity + intent
//      extraction, hybrid retrieval, state update, then hands the packet to
//      the local Qwen 2.5 3B model via Ollama (localhost:11434)
//   3. Persist the updated state back to Postgres
//   4. Return the natural-language reply + a light state summary
//
// Zero third-party AI. Zero external network calls in the response path.
// The Ollama endpoint is validated as local by respond-local.mjs.

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Cold boot on the first customer message includes: pg pool init + all conv
// tables loaded into memory (~15s at MVP scale) + Ollama model load into VRAM
// if idle (~15s). Total worst case ~35s. 120s ceiling gives comfortable margin.
export const maxDuration = 120;

// Module-level singleton so we init the store + entity+intent seed ONCE per
// Node process (not per request). Store init loads all knowledge_items into
// memory (~15s on first call). Dev-server keeps the process alive across
// requests so this is amortised.
let _bootPromise: Promise<{ store: any; ready: true }> | null = null;

async function boot() {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async () => {
    // @ts-expect-error — pipeline lives outside `src/` (scripts/nex-conv) so
    // it's imported by absolute path via the workspace root. TS server
    // isn't configured for it; runtime resolution works.
    const { createStore } = await import(
      /* @vite-ignore */ "../../../../../scripts/nex-conv/lib/store-factory.mjs"
    );
    // @ts-expect-error same reason
    const { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } = await import(
      /* @vite-ignore */ "../../../../../scripts/nex-conv/lib/entities.mjs"
    );

    const store = await createStore({ backend: "postgres" });

    // Idempotent seed of intents + entities (safe if already present)
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
};

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function serverError(msg: string, status = 500) {
  return NextResponse.json({ error: msg }, { status });
}

// GET /api/nex-conv/chat · idempotent warmup
// The chat client hits this on mount so the customer's first real message
// doesn't pay the store-init + model-load cold cost (~15-30s).
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

  // Load or create state
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

  // Persist the mutated state back
  try {
    await store.upsertState(state);
  } catch {
    // non-fatal — the reply still returns
  }

  // Log the customer + NEX turns for observability + future review UI
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
    // non-fatal — the reply still returns
  }

  const proseErr = out.prose?.error;
  if (proseErr) {
    return NextResponse.json({
      conversation_id,
      reply: null,
      error: "response layer error · " + String(proseErr).slice(0, 300),
      state_summary: shapeStateSummary(state),
    }, { status: 502 });
  }

  return NextResponse.json({
    conversation_id,
    reply: out.prose?.text ?? "(no prose returned)",
    understood_intent: out.understood_intent?.slug ?? null,
    understood_entities: out.understood_entities ?? [],
    retrieved_top_k_count: (out.retrieved_top_k ?? []).length,
    state_summary: shapeStateSummary(state),
    metrics: {
      total_ms: out.total_ms ?? null,
      prose_ms: out.stage_timings?.prose_ms ?? null,
      prose_tokens_prompt: out.prose?.tokens_prompt ?? null,
      prose_tokens_completion: out.prose?.tokens_completion ?? null,
      prose_model: out.prose?.model ?? null,
      prose_provider: out.prose?.provider ?? null,
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
  };
}
