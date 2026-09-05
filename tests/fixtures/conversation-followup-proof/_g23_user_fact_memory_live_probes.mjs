// G23 · User-Fact Memory & Persistence · live HTTP probes.
// Philip 2026-09-06 · AUTHORIZE G23 · §31 sequence + §27 matrix + §28 adversarial.

import { randomUUID } from "node:crypto";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = "http://localhost:3008/api/nex-conv/chat";

async function post(convId, message, market = "ID") {
  try {
    const r = await fetch(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: convId, message, market }),
    });
    return await r.json();
  } catch (err) {
    return { error: String(err) };
  }
}

function digest(j) {
  const cm = j.composition_meta || {};
  return {
    reply: (j.reply || "").slice(0, 300),
    intent: j.intent,
    world_cards_count: j.world_cards?.count ?? j.world_cards?.cards?.length ?? 0,
    conv_function_detected: cm.conv_function_detected,
    conv_function_gate_fired: cm.conv_function_gate_fired,
    memory_candidates_count: cm.memory_candidates_count,
    memory_written_count: cm.memory_written_count,
    memory_superseded_count: cm.memory_superseded_count,
    memory_gate_fired: cm.memory_gate_fired,
    memory_gate_reason: cm.memory_gate_reason,
    memory_retrieved_count: cm.memory_retrieved_count,
    knowledge_count: cm.knowledge_count,
    scope_gate_fired: cm.scope_gate_fired,
    result_followup_fired: cm.result_followup_fired,
    ordinal_gate_fired: cm.ordinal_gate_fired,
  };
}

const results = { runAt: new Date().toISOString(), tests: [] };

async function test(label, description, turns) {
  console.log(`\n═══ ${label} ═══`);
  console.log(`  ${description}`);
  const cid = randomUUID();
  const record = { label, description, conversation_id: cid, turns: [] };
  for (const [i, t] of turns.entries()) {
    const j = await post(cid, t.msg, t.market || "ID");
    const d = digest(j);
    record.turns.push({ turn: i + 1, message: t.msg, ...d });
    console.log(`  T${i + 1} "${t.msg}"`);
    console.log(`     reply: ${JSON.stringify(d.reply?.slice(0, 220))}`);
    console.log(`     cf=${d.conv_function_detected} mem_cand=${d.memory_candidates_count} mem_wrote=${d.memory_written_count} mem_gate=${d.memory_gate_fired}`);
  }
  results.tests.push(record);
}

// ═════════════ §31 REQUIRED LIVE SEQUENCE ═════════════

await test("§31 · REQUIRED · run restaurant → hotels → what do you remember",
  "T3 must retrieve the restaurant business fact from T1",
  [
    { msg: "I run a restaurant" },
    { msg: "Tell me about hotels near Malioboro" },
    { msg: "What do you remember about my business?" },
  ]);

await test("§31 · CORRECTION · Actually, I don't run a restaurant anymore",
  "Cross-turn negation retracts the prior fact",
  [
    { msg: "I run a restaurant" },
    { msg: "Actually, I don't run a restaurant anymore" },
    { msg: "What do you know about my business now?" },
  ]);

// ═════════════ §27 TEST MATRIX ═════════════

await test("§27 · explicit fact · I run a restaurant",
  "T1 candidate detected · T2 recall via memory-question gate",
  [
    { msg: "I run a restaurant" },
    { msg: "What do you know about my business?" },
  ]);

await test("§27 · preference · I prefer Indonesian",
  "language preference recorded and recallable",
  [
    { msg: "I prefer Indonesian" },
    { msg: "What do you remember about my preferences?" },
  ]);

await test("§27 · allergy · I have an allergy to shellfish",
  "constraint recorded",
  [
    { msg: "I have an allergy to shellfish" },
    { msg: "What did I tell you about my allergy?" },
  ]);

await test("§27 · residence · correction",
  "'I live in Yogyakarta' then 'Actually, I live in Jakarta now' — supersession",
  [
    { msg: "I live in Yogyakarta" },
    { msg: "Actually, I live in Jakarta now" },
    { msg: "What do you know about my location?" },
  ]);

// ═════════════ §28 ADVERSARIAL · non-facts ═════════════

await test("§28 · question · 'Do I run a restaurant?' must NOT create fact",
  "T1 is a question · T2 recall shows no business fact",
  [
    { msg: "Do I run a restaurant?" },
    { msg: "What do you know about my business?" },
  ]);

await test("§28 · attribution · 'People say I run a restaurant' must NOT create fact",
  "attribution rejected",
  [
    { msg: "People say I run a restaurant" },
    { msg: "What do you know about my business?" },
  ]);

await test("§28 · third-party · 'My friend runs a restaurant' must NOT create user fact",
  "friend's fact is not user's fact",
  [
    { msg: "My friend runs a restaurant" },
    { msg: "What do you know about my business?" },
  ]);

await test("§28 · intention · 'I want to run a restaurant' must NOT create durable fact",
  "aspiration rejected",
  [
    { msg: "I want to run a restaurant" },
    { msg: "What do you know about my business?" },
  ]);

await test("§28 · negation · 'I don't run a restaurant' must NOT create positive fact",
  "G12 blocks positive-fact creation",
  [
    { msg: "I don't run a restaurant" },
    { msg: "What do you know about my business?" },
  ]);

// ═════════════ PROVENANCE ═════════════

await test("provenance · 'Why do you think I run a restaurant?'",
  "reply cites the source turn text",
  [
    { msg: "I run a restaurant" },
    { msg: "Why do you think I run a restaurant?" },
  ]);

// ═════════════ INDONESIAN ═════════════

await test("Indonesian · saya tinggal di Yogyakarta",
  "residence in Indonesian",
  [
    { msg: "saya tinggal di Yogyakarta" },
    { msg: "What do you know about my location?" },
  ]);

// ═════════════ PRESERVATION ═════════════

await test("PRESERVE · G12 · 'I don't want a hotel' still gates",
  "G12 NEGATED_REQUEST intact after G23 wiring",
  [{ msg: "I don't want a hotel" }]);

await test("PRESERVE · G24 · seafood in Japan still blocked",
  "G24 scope gate intact",
  [{ msg: "tell me about seafood in Japan" }]);

await test("PRESERVE · P0.4 · fresh 'the first hotel'",
  "P0.4 ordinal-boundary intact",
  [{ msg: "Tell me about the first hotel." }]);

await test("PRESERVE · L4 · social frame reset",
  "'do you want to know where i am' still gates",
  [
    { msg: "any hotels nex" },
    { msg: "do you want to know where i am" },
  ]);

await test("PRESERVE · result-followup",
  "provenance follow-up still fires",
  [
    { msg: "find me hotels" },
    { msg: "where did you find them?" },
  ]);

writeFileSync(path.join(here, "_g23_user_fact_memory_live_probes.json"),
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_g23_user_fact_memory_live_probes.json")}`);

// ═════════════ INDEPENDENT PERSISTENCE VERIFICATION ═════════════
//
// Read the on-disk JSONL for one of the write-heavy conversations
// and confirm the fact record is present. This is the "independent
// verification" required by AUTHORIZE §29/§32.

const storePath = path.join(process.cwd(), "data", "nex-memory", "user-facts.jsonl");
console.log(`\n─── INDEPENDENT PERSISTENCE VERIFICATION ───`);
console.log(`  store: ${storePath}`);
if (existsSync(storePath)) {
  const raw = readFileSync(storePath, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim());
  const firstTest = results.tests[0];
  const cid = firstTest.conversation_id;
  const linesForConv = lines.filter((l) => l.includes(`"conversation_id":"${cid}"`));
  console.log(`  total JSONL lines: ${lines.length}`);
  console.log(`  lines for §31 conv (${cid}): ${linesForConv.length}`);
  if (linesForConv.length > 0) {
    console.log(`  first line for conv: ${linesForConv[0].slice(0, 250)}`);
  } else {
    console.log(`  NO records on disk for this conversation.`);
  }
} else {
  console.log(`  Store file does not exist at ${storePath}`);
}
console.log(`\nTotal tests: ${results.tests.length}`);
