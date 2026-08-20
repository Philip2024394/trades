// Priority-2 real-world conversation probe.
//
// Not more assertions — actual multi-turn conversations spanning the
// scenarios Philip listed 2026-08-20. Question being answered: does NEX
// now feel like ONE intelligent assistant having a natural conversation,
// or like a collection of tested responses stitched together?
//
// Read-only · uses same infer.processTurn path the /api/nex-conv/chat
// route uses · captures real Qwen prose · no state persisted beyond the
// diagnostic run.

import { createStore } from "./lib/store-factory.mjs";
import { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } from "./lib/entities.mjs";
import * as infer from "./lib/infer.mjs";
import { randomUUID } from "node:crypto";

async function boot() {
  const store = await createStore({ backend: "jsonl" });
  for (const i of STAIRCASE_INTENTS) await store.upsertIntent(i);
  for (const e of STAIRCASE_ENTITIES) await store.upsertEntity({ ...e, brain: "staircase_brain" });
  return store;
}

async function runConversation(store, name, description, turns) {
  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: `nat-${name}` });
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`SCENARIO: ${name}`);
  console.log(`(${description})`);
  console.log(`═══════════════════════════════════════════════════════════`);
  for (const text of turns) {
    const t0 = Date.now();
    const out = await infer.processTurn({
      store, state, brain: "staircase_brain", text, speaker: "customer", withProse: true,
    });
    const reply = out.prose?.text ?? `(no prose · ${out.prose?.error ?? "error"})`;
    const dt = Date.now() - t0;
    const facts = Object.entries(state.established_facts)
      .map(([k, v]) => `${k}=${v.value}[${v.provenance ?? "?"}]`)
      .join(" · ");
    console.log(`\n  [T${out.stage_timings ? state.turn_count : "?"} · intent=${out.understood_intent?.slug} · ${dt}ms]`);
    console.log(`  C: ${text}`);
    console.log(`  N: ${reply}`);
    if (facts) console.log(`  state: ${facts}`);
  }
}

async function main() {
  const store = await boot();

  // ─── 1. English natural staircase conversation ──────────────
  await runConversation(store, "01-EN-staircase-natural",
    "Real homeowner exploring a staircase spec across many turns", [
      "hi",
      "I'm renovating my hallway and I need advice on a staircase",
      "It's a Victorian terrace",
      "I want something in oak",
      "What options do I have for the balustrade?",
      "how much would that cost roughly?",
      "and installation?",
      "thanks — I'll think about it",
    ]);

  // ─── 2. Indonesian customer · same brain, different language ──
  await runConversation(store, "02-ID-staircase-indonesian",
    "Language-neutral brain test · Indonesian input · does NEX understand + reply naturally?", [
      "Halo",
      "Saya ingin membangun tangga baru untuk rumah saya",
      "Saya suka kayu jati",
      "Bagaimana dengan railing kaca?",
      "Berapa kira-kira biayanya?",
    ]);

  // ─── 3. Non-staircase query (restaurant/product) ─────────────
  await runConversation(store, "03-EN-restaurant-non-staircase",
    "Customer asks about something outside the staircase brain · NEX should not fabricate", [
      "hi",
      "I'm hungry — where's the best seafood near me?",
      "any Italian places open now?",
    ]);

  // ─── 4. Vague → specific drill-down ──────────────────────────
  await runConversation(store, "04-EN-vague-to-specific",
    "Starts vague, becomes specific over turns", [
      "I need help",
      "with my house",
      "the stairs",
      "they're old and creaky",
      "we're thinking of replacing them",
      "modern look, glass maybe",
    ]);

  // ─── 5. Changing mind mid-conversation ───────────────────────
  await runConversation(store, "05-EN-changing-mind",
    "Customer flips choices multiple times · NEX must track correctly", [
      "I'd like an oak staircase",
      "actually make it walnut",
      "wait, I liked oak better — back to oak",
      "hmm no, let's go walnut after all",
      "sorry for the flip-flopping — walnut with glass balustrade please",
    ]);

  // ─── 6. Mixed unknown + known + price ───────────────────────
  await runConversation(store, "06-EN-mixed-unknown-known-price",
    "Question NEX doesn't know · then known follow-up · then price ask", [
      "What did the 2019 revision of BS 5395 change about tapered treads?",
      "OK — what about closed vs cut string in general?",
      "how much for a straight oak staircase?",
    ]);

  // ─── 7. Voice-style short sentences ─────────────────────────
  await runConversation(store, "07-EN-voice-style",
    "Very short utterances like real speech · does NEX cope?", [
      "hi",
      "staircase",
      "oak",
      "yes",
      "glass",
      "how much",
      "hmm",
      "OK thanks",
    ]);

  // ─── 8. Recommendation → follow-up ──────────────────────────
  await runConversation(store, "08-EN-recommendation",
    "Customer wants a recommendation · then follows up", [
      "It's a small Victorian hallway. What style of staircase would you recommend?",
      "why closed string?",
      "what wood would go with that?",
    ]);

  console.log("\n\n═══════════════════════════════════════════════════════════");
  console.log("END · 8 scenarios · " + [8,5,3,6,5,3,8,3].reduce((a,b)=>a+b,0) + " turns");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch(e => { console.error(e); process.exit(1); });
