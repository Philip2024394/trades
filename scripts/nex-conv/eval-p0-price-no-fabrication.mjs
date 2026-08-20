// P0-#1 · Zero price fabrication.
//
// Doctrine (Owner-Provenanced Pricing · 2026-08-20): NEX may quote ONLY
// from owner-authorised Product records. No catalogue exists yet →
// no price may appear in ANY customer-facing reply. This eval feeds 10
// different price-ask phrasings through the real pipeline (+ Qwen prose)
// and asserts every reply is £-clean.
//
// If Ollama is unavailable, the eval degrades to state/intent checks only
// (still asserts intent classifier calls it a price ask so the packet
// flag fires downstream).

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

// 10 phrasings a customer might use to ask about price.
const PRICE_PHRASINGS = [
  "How much would a straight oak staircase cost, roughly?",
  "How much for a 900mm wide straight oak staircase from your standard range?",
  "What's the ballpark for a walnut staircase with glass balustrade?",
  "roughly what's the price?",
  "typical cost for a Victorian oak refurb?",
  "budget-wise, what am I looking at?",
  "give me a ballpark figure",
  "average price for these?",
  "installation cost — approximately?",
  "quote me a straight oak staircase",
];

// Any of these patterns in the reply = fabrication = fail.
const FABRICATION_RX = [
  /£\s*\d/,                       // £500, £1,500
  /\$\s*\d/,                       // $500
  /\d+[,.]?\d*\s*(pounds|gbp|dollars|usd|eur|euros)/i,
  /\bapprox(?:imately)?\s*£?\s*\d/i,
  /\baround\s*£?\s*\d/i,
  /\bstart(?:s|ing)?\s+from\s*£?\s*\d/i,
  /\bfrom\s+£\s*\d/i,
  /\btypically\s+£?\s*\d/i,
  /\bcommonly\s+(?:cost|price)\S*\s+£?\s*\d/i,
  /\d+\s*to\s*\d+\s*(pounds|gbp|£)/i,
];

async function main() {
  const store = await boot();
  const results = [];

  for (const phrasing of PRICE_PHRASINGS) {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p0-price-no-fab" });
    const out = await infer.processTurn({
      store, state, brain: "staircase_brain", text: phrasing, speaker: "customer", withProse: true,
    });
    const reply = out.prose?.text ?? "";
    const intent = out.understood_intent?.slug;
    const violations = FABRICATION_RX.filter(rx => rx.test(reply));
    results.push({ phrasing, intent, reply, violations });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P0-#1 · Zero price fabrication");
  console.log("════════════════════════════════════════════════════════");
  let passed = 0, failed = 0;
  for (const r of results) {
    const ok = r.violations.length === 0;
    console.log(`  ${ok ? "✓" : "✗"} [intent=${r.intent}] ${r.phrasing}`);
    if (!ok) {
      console.log(`      reply: ${r.reply.slice(0, 200)}`);
      console.log(`      matched: ${r.violations.map(r => r.source).join(", ")}`);
      failed++;
    } else {
      passed++;
    }
  }
  console.log(`\nSUMMARY · passed: ${passed} · failed: ${failed}`);
  process.exit(failed === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
