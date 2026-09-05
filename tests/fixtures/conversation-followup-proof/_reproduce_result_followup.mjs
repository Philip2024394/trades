// Reproduce the P0 result-follow-up regression BEFORE the fix.
// Captures full runtime state: session current_reference, world_cards,
// composition_meta, ordinal_gate flags, reply.
//
// Also runs the 4 semantic-variant follow-ups AND the negative tests.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = "http://localhost:3008/api/nex-conv/chat";

async function post(convId, message) {
  const r = await fetch(CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: convId, message, market: "ID" }),
  });
  return await r.json();
}

function summariseTurn(j) {
  const cm = j.composition_meta || {};
  return {
    intent: j.intent,
    reply: (j.reply || "").slice(0, 300),
    voice_reply_intent: j.voice_reply?.intent,
    voice_reply_preview: (j.voice_reply?.en || "").slice(0, 300),
    current_reference: j.current_reference,
    world_cards_count: j.world_cards?.count ?? j.world_cards?.cards?.length ?? 0,
    world_cards_names: (j.world_cards?.cards || []).slice(0, 5).map((c) => c.name ?? c.title),
    composition_ran: cm.ran,
    composition_accepted: cm.accepted,
    composition_reason: cm.reason,
    composition_knowledge_count: cm.knowledge_count,
    ordinal_gate_fired: cm.ordinal_gate_fired,
    ordinal_gate_reason: cm.ordinal_gate_reason,
    hydration_reason: cm.hydration_reason,
    result_followup_fired: cm.result_followup_fired,
    result_followup_reason: cm.result_followup_reason,
  };
}

const results = { runAt: new Date().toISOString(), tracks: [] };

// PRIMARY REGRESSION · exact reported flow
{
  const cid = randomUUID();
  console.log("\n═══ PRIMARY · exact reported regression ═══");
  const t1 = await post(cid, "i am looking for hotel");
  const t2 = await post(cid, "where you find them");
  console.log("T1 →", JSON.stringify(t1.reply?.slice(0, 200)));
  console.log("T2 →", JSON.stringify(t2.reply?.slice(0, 200)));
  results.tracks.push({
    label: "PRIMARY · exact reported regression",
    conversation_id: cid,
    turns: [
      { turn: 1, question: "i am looking for hotel", ...summariseTurn(t1) },
      { turn: 2, question: "where you find them", ...summariseTurn(t2) },
    ],
  });
}

// SEMANTIC VARIANTS · §10
const variants = [
  "where did you find these?",
  "where are these from?",
  "how did you find them?",
];
for (const variant of variants) {
  const cid = randomUUID();
  console.log(`\n─── VARIANT · ${JSON.stringify(variant)} ───`);
  const t1 = await post(cid, "i am looking for hotel");
  const t2 = await post(cid, variant);
  console.log("T2 reply →", JSON.stringify(t2.reply?.slice(0, 200)));
  results.tracks.push({
    label: `VARIANT · ${variant}`,
    conversation_id: cid,
    turns: [
      { turn: 1, question: "i am looking for hotel", ...summariseTurn(t1) },
      { turn: 2, question: variant, ...summariseTurn(t2) },
    ],
  });
}

// NEGATIVE · ordinary hotel searches must remain hotel searches (§11)
const negatives = [
  "find me a hotel",
  "find me another hotel",
  "show me hotels near Malioboro",
  "find a hotel in Jakarta",
  "where is the hotel?",  // location · not provenance
];
for (const neg of negatives) {
  const cid = randomUUID();
  console.log(`\n─── NEGATIVE · ${JSON.stringify(neg)} ───`);
  const t = await post(cid, neg);
  console.log("reply →", JSON.stringify(t.reply?.slice(0, 200)));
  results.tracks.push({
    label: `NEGATIVE · ${neg}`,
    conversation_id: cid,
    turns: [{ turn: 1, question: neg, ...summariseTurn(t) }],
  });
}

// ENTITY-CONTEXT PRESERVATION · §12
{
  const cid = randomUUID();
  console.log("\n─── CONTEXT · provenance follow-up does not destroy ordinal anchor ───");
  const t1 = await post(cid, "i am looking for hotel");
  const t2 = await post(cid, "where did you find them?");
  const t3 = await post(cid, "tell me more about the first one");
  console.log("T1 →", JSON.stringify(t1.reply?.slice(0, 100)));
  console.log("T2 →", JSON.stringify(t2.reply?.slice(0, 100)));
  console.log("T3 →", JSON.stringify(t3.reply?.slice(0, 200)));
  console.log("T3 current_reference:", JSON.stringify(t3.current_reference));
  results.tracks.push({
    label: "CONTEXT · anchor survives follow-up",
    conversation_id: cid,
    turns: [
      { turn: 1, question: "i am looking for hotel", ...summariseTurn(t1) },
      { turn: 2, question: "where did you find them?", ...summariseTurn(t2) },
      { turn: 3, question: "tell me more about the first one", ...summariseTurn(t3) },
    ],
  });
}

// FRESH-CONVERSATION · §13 · must NOT invent a previous result
{
  const cid = randomUUID();
  console.log("\n─── FRESH-CONV · 'where did you find them?' with no prior list ───");
  const t = await post(cid, "where did you find them?");
  console.log("reply →", JSON.stringify(t.reply?.slice(0, 200)));
  results.tracks.push({
    label: "FRESH-CONV · no anchor",
    conversation_id: cid,
    turns: [{ turn: 1, question: "where did you find them?", ...summariseTurn(t) }],
  });
}

// PRIOR REGRESSION · P0.4 fresh 'the first hotel' must still boundary
{
  const cid = randomUUID();
  console.log("\n─── P0.4 PRESERVED · 'the first hotel' fresh conv ───");
  const t = await post(cid, "Tell me about the first hotel.");
  console.log("reply →", JSON.stringify(t.reply?.slice(0, 200)));
  console.log("ordinal_gate_fired:", t.composition_meta?.ordinal_gate_fired);
  results.tracks.push({
    label: "P0.4 PRESERVED · fresh 'the first hotel'",
    conversation_id: cid,
    turns: [{ turn: 1, question: "Tell me about the first hotel.", ...summariseTurn(t) }],
  });
}

writeFileSync(path.join(here, "_reproduce_result_followup.json"), JSON.stringify(results, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_reproduce_result_followup.json")}`);
