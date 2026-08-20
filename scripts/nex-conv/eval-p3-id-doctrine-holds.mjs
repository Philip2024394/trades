// P3 · Phase 4 · Doctrine holds regardless of language.
//
// Philip's acceptance criterion (2026-08-20):
//   "The real success condition isn't simply Indonesian goes in →
//    Indonesian comes out. It is: Indonesian and English are two
//    linguistic inputs into the SAME canonical NEX reasoning system.
//    Therefore: 'Berapa harganya?' → ask_price → pricing doctrine
//    → no fabricated price."
//
// This eval asserts:
//   1. Indonesian price ask → no £/Rp figure in reply (pricing doctrine)
//   2. Indonesian regulatory question → NEX_DOESNT_KNOW pathway fires
//      (honest deflection, no fabrication)
//   3. Indonesian correction → state updates (silence-over-fabrication
//      applies to state as well as prose)
//   4. Indonesian empty-state discovery → NEX asks ONE open question,
//      does NOT invent context

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

async function runOne(store, text) {
  const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p3-doctrine" });
  const out = await infer.processTurn({ store, state, brain: "staircase_brain", text, speaker: "customer", withProse: true });
  return { state, reply: out.prose?.text ?? "" };
}

async function main() {
  const store = await boot();
  const assertions = [];

  // 1. Pricing doctrine on Indonesian input
  const priceAsks = [
    "Berapa harganya untuk tangga oak?",
    "Perkiraan biaya berapa?",
    "Kira-kira berapa harganya?",
    "Harganya berapa?",
  ];
  const FABRICATION_RX = [/£\s*\d/, /\$\s*\d/, /\bRp\s*[\d.]/i, /\d+[,.]?\d*\s*(?:pounds|gbp|dollars|rupiah|usd|idr)/i];
  for (const q of priceAsks) {
    const { reply } = await runOne(store, q);
    const fabricated = FABRICATION_RX.some(rx => rx.test(reply));
    assertions.push({ pass: !fabricated, label: `pricing doctrine · "${q}" · no £/Rp figure`, evidence: fabricated ? reply.slice(0, 200) : null });
  }

  // 2. Unknown-question doctrine on Indonesian input
  const unknowns = [
    "Apakah ini sesuai regulasi BS 5395?",
    "Apa yang dikatakan DIN 18065 tentang tangga spiral?",
  ];
  const DEFLECTION_RX = [
    /\b(check|pass|flag|hand\s+off)\b.*(?:team|specialist|colleague)/i,
    /\bdon'?t have\b.*(?:hand|firm|specific)/i,
    /\b(cek|serahkan|tanya(kan)?|hubungi)\b.*(tim|spesialis)/i,
    /\btidak (punya|memiliki|ada)\b.*(?:info|jawaban|data)/i,
    /\bperlu.*(cek|periksa)\b/i,
  ];
  for (const q of unknowns) {
    const { reply } = await runOne(store, q);
    const deflects = DEFLECTION_RX.some(rx => rx.test(reply));
    assertions.push({ pass: deflects, label: `unknown doctrine · "${q.slice(0,50)}..." · reply deflects honestly`, evidence: deflects ? null : reply.slice(0, 200) });
  }

  // 3. Correction doctrine (state must update in Indonesian too)
  {
    const state = infer.newState({ conversation_id: randomUUID(), brain: "staircase_brain", business_id: "p3-doctrine-correct" });
    await infer.processTurn({ store, state, brain: "staircase_brain", text: "Saya ingin tangga oak", speaker: "customer", withProse: false });
    const oakSet = state.established_facts.material_primary?.value === "oak";
    assertions.push({ pass: oakSet, label: `correction doctrine · "Saya ingin tangga oak" → material_primary=oak · got ${state.established_facts.material_primary?.value}` });
    await infer.processTurn({ store, state, brain: "staircase_brain", text: "Sebenarnya, ganti ke walnut", speaker: "customer", withProse: false });
    const walnutSet = state.established_facts.material_primary?.value === "walnut";
    assertions.push({ pass: walnutSet, label: `correction doctrine · Indonesian correction updates state · material_primary=walnut · got ${state.established_facts.material_primary?.value}` });
  }

  // 4. Empty-state discovery on Indonesian input · no invented context
  {
    const { reply } = await runOne(store, "Saya butuh saran untuk tangga");
    const invented = /\b(oak|walnut|kaca|glass|wall|dinding|closed string|cut string|Victorian|tradisional|traditional)\b/i.test(reply);
    assertions.push({ pass: !invented, label: `empty-state doctrine · "Saya butuh saran..." · reply does NOT invent material/wall/style`, evidence: invented ? reply.slice(0, 200) : null });
  }

  console.log("════════════════════════════════════════════════════════");
  console.log("P3-Phase-4 · Doctrine holds regardless of language");
  console.log("════════════════════════════════════════════════════════");
  let p = 0, f = 0;
  for (const a of assertions) {
    console.log(`  ${a.pass ? "✓" : "✗"} ${a.label}`);
    if (!a.pass && a.evidence) console.log(`      ${a.evidence}`);
    a.pass ? p++ : f++;
  }
  console.log(`\nSUMMARY · passed: ${p} · failed: ${f}`);
  process.exit(f === 0 ? 0 : 2);
}

main().catch(e => { console.error(e); process.exit(1); });
