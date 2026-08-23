// scripts/session4b-live-nex-test.mjs
//
// SESSION 4b · Live NEX conversation diagnostic.
//
// Purpose (Philip 2026-08-20):
//   Where Session 4a measured whether Qwen 2.5 3B can drive
//   STRUCTURED tool-use design mutations, Session 4b measures how
//   NEX actually FEELS in a realistic multi-turn conversation
//   through the EXISTING /api/nex-conv/chat pipeline. No new
//   architecture. No Summit Brain wire-up. Same code path the
//   route handler uses, invoked directly to skip the dev-server
//   boot cost.
//
// Pipeline exercised (unmodified):
//   1. JsonlStore (backend='jsonl') → data/nex-conv/mvp/
//   2. STAIRCASE_INTENTS + STAIRCASE_ENTITIES seed (idempotent)
//   3. infer.processTurn({ withProse: true }) — entity + intent
//      extraction, hybrid retrieval, state update, prose via local
//      Qwen 3B (respond-local.mjs)
//   4. State persists between turns · same conversation_id
//
// USAGE
//   # Ensure Ollama is running with qwen2.5:3b pulled.
//   npx tsx scripts/session4b-live-nex-test.mjs
//
//   # Override the prose model:
//   NEX_RESPONSE_MODEL=qwen2.5:7b-instruct-q3_K_M \
//     npx tsx scripts/session4b-live-nex-test.mjs
//
// EXIT CODES
//   0 · conversation completed
//   1 · runner exception (pipeline failure, Ollama down, etc.)
//
// GUARDRAILS
//   · Zero code changes to any pipeline file. This runner is
//     a pure external harness — same functions the API route
//     already calls in production.
//   · Uses the JsonlStore fallback so no Postgres is needed.
//     State + turns are appended to data/nex-conv/mvp/ (isolated
//     to a fresh conversation_id per run · doesn't pollute prior data).

import { createStore } from "./nex-conv/lib/store-factory.mjs";
import { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } from "./nex-conv/lib/entities.mjs";
import * as infer from "./nex-conv/lib/infer.mjs";
import { randomUUID } from "node:crypto";

// ─── Realistic multi-turn conversation ────────────────────────────
// Not the 6 controlled diagnostic scenarios · this is what a real
// homeowner might actually type across a session. Tests behaviour
// under: opening context, question mid-flow, direct choice,
// exploration, cost question, mind-changing overwrite, adjacent
// feature request. Mirrors the Session 4a scenarios in intent so
// we can compare the two paths side-by-side.

const CONVERSATION = [
  "Hi, I'm looking to replace the staircase in my hallway.",
  "It's an old wooden one — I want something more modern.",
  "What materials do you offer?",
  "Let's go with oak.",
  "Can you show me open riser options?",
  "How much will it cost?",
  "Actually, change the oak to walnut.",
  "Add glass balustrades to the design.",
];

// ─── Runner ───────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("SESSION 4b · Live NEX conversation diagnostic");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("pipeline  : /api/nex-conv/chat internals (unmodified)");
  console.log("store     : JsonlStore · data/nex-conv/mvp/");
  console.log(`brain     : staircase_brain`);
  console.log(`prose     : Ollama · qwen2.5:3b (default) or NEX_RESPONSE_MODEL`);
  console.log(`turns     : ${CONVERSATION.length}`);
  console.log("");

  const t0 = Date.now();

  console.log("[boot] initialising JsonlStore ...");
  const store = await createStore({ backend: "jsonl" });
  console.log(`[boot] store ready in ${Date.now() - t0}ms`);
  console.log(`[boot] loaded knowledge_items: ${store.mem.knowledge_items.size} · entities: ${store.mem.entities.size} · edges: ${store.mem.edges.size} · intents: ${store.mem.intents.size}`);

  // Idempotent seed (matches the route handler's boot logic).
  for (const intent of STAIRCASE_INTENTS) await store.upsertIntent(intent);
  for (const ent of STAIRCASE_ENTITIES) await store.upsertEntity({ ...ent, brain: "staircase_brain" });

  const conversationId = randomUUID();
  console.log(`[boot] conversation_id: ${conversationId}`);
  console.log("");

  const state = infer.newState({
    conversation_id: conversationId,
    brain: "staircase_brain",
    business_id: "session4b-test",
  });

  // Track established_facts across turns so we can show the DELTA
  // per turn (what the pipeline learned this turn vs before).
  let priorFacts = { ...(state.established_facts ?? {}) };
  let runnerError = null;

  for (let i = 0; i < CONVERSATION.length; i++) {
    const message = CONVERSATION[i];
    const turnNum = i + 1;
    console.log("─────────────────────────────────────────────────────────");
    console.log(`Turn ${turnNum}/${CONVERSATION.length} · CUSTOMER`);
    console.log(`  "${message}"`);
    console.log("");

    const turnStart = Date.now();
    let out;
    try {
      out = await infer.processTurn({
        store,
        state,
        brain: "staircase_brain",
        text: message,
        speaker: "customer",
        withProse: true,
      });
    } catch (e) {
      runnerError = e instanceof Error ? e.message : String(e);
      console.log(`  ✗ processTurn threw: ${runnerError}`);
      break;
    }
    const turnMs = Date.now() - turnStart;

    // Persist state (matches route handler behaviour · needed so the
    // next iteration reads the updated state from `state` reference).
    try { await store.upsertState(state); } catch { /* non-fatal */ }

    const currentFacts = { ...(state.established_facts ?? {}) };
    const factDelta = diffFacts(priorFacts, currentFacts);
    priorFacts = currentFacts;

    const proseErr = out.prose?.error;
    console.log(`Turn ${turnNum}/${CONVERSATION.length} · NEX (${turnMs}ms · prose ${out.stage_timings?.prose_ms ?? "?"}ms · model ${out.prose?.model ?? "?"})`);
    if (proseErr) {
      console.log(`  ✗ prose error: ${String(proseErr).slice(0, 300)}`);
    } else {
      const text = String(out.prose?.text ?? "(no prose)");
      console.log(`  "${text.length > 500 ? text.slice(0, 500) + " ..." : text}"`);
    }
    console.log("");
    console.log(`  understood_intent    : ${out.understood_intent?.slug ?? "(none)"}`);
    console.log(`  understood_entities  : ${
      (out.understood_entities ?? []).length === 0
        ? "(none)"
        : (out.understood_entities ?? []).map((e) => e.slug ?? e).join(", ")
    }`);
    console.log(`  retrieved_top_k      : ${(out.retrieved_top_k ?? []).length}`);
    console.log(`  established_facts    : ${JSON.stringify(currentFacts)}`);
    if (factDelta.added.length + factDelta.changed.length + factDelta.removed.length > 0) {
      console.log(`  ↳ delta this turn    : added=${JSON.stringify(factDelta.added)} · changed=${JSON.stringify(factDelta.changed)} · removed=${JSON.stringify(factDelta.removed)}`);
    } else {
      console.log(`  ↳ delta this turn    : (no change to established_facts)`);
    }
    console.log(`  current_topic        : ${state?.current_topic ?? "(none)"}`);
    console.log(`  stage                : ${state?.stage ?? "(unknown)"}`);
    console.log(`  entities_in_focus    : ${JSON.stringify((state?.entities_in_focus ?? []).slice(0, 6))}`);
    console.log(`  constraints          : ${JSON.stringify(state?.constraints ?? [])}`);
    console.log(`  handoff_recommended  : ${state?.handoff_recommended === true}`);
    console.log(`  corrections_logged   : ${(state?.corrections_log ?? []).length}`);
    console.log(`  thin_packet_strikes  : ${state?.thin_packet_strikes ?? 0}`);
    console.log("");
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("FINAL STATE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`turn_count           : ${state?.turn_count ?? 0}`);
  console.log(`established_facts    : ${JSON.stringify(state?.established_facts ?? {}, null, 2)}`);
  console.log(`entities_in_focus    : ${JSON.stringify(state?.entities_in_focus ?? [])}`);
  console.log(`constraints          : ${JSON.stringify(state?.constraints ?? [])}`);
  console.log(`corrections_log      : ${(state?.corrections_log ?? []).length} entries`);
  console.log(`thin_packet_strikes  : ${state?.thin_packet_strikes ?? 0}`);
  console.log(`handoff_recommended  : ${state?.handoff_recommended === true}`);
  console.log("");
  console.log(`total elapsed        : ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (runnerError) {
    console.log(`\nRUNNER ERROR: ${runnerError}`);
    process.exit(1);
  }
  process.exit(0);
}

// ─── Utilities ────────────────────────────────────────────────────

function diffFacts(before, after) {
  const added = [];
  const changed = [];
  const removed = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    const bStr = JSON.stringify(b);
    const aStr = JSON.stringify(a);
    if (bStr === aStr) continue;
    if (b === undefined) added.push({ [k]: a });
    else if (a === undefined) removed.push({ [k]: b });
    else changed.push({ [k]: { from: b, to: a } });
  }
  return { added, changed, removed };
}

main().catch((e) => {
  console.error("UNHANDLED:", e instanceof Error ? e.stack ?? e.message : String(e));
  process.exit(1);
});
