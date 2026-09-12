#!/usr/bin/env node
// Founder BEGIN B smoke test — verify NEX_DETERMINISTIC_REPLY=1 promotion.
// Runs a small query matrix against a live dev server on :3008 and prints
// reply + voice_reply.en + composition_meta + deterministic_reply_promotion
// for each turn. Non-destructive · read-only side · same conversation_id
// across the matrix so the hot-tier warms after turn 1.

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const CID = randomUUID();

const MATRIX = [
  "need hotel for tomorrow",
  "have you hotel",
  "hotel di jogja",
  "how many rooms does Hotel Melia Purosani have?",
  "do you have wifi at Grand Aston Yogyakarta?",
];

async function turn(message) {
  const t0 = Date.now();
  const res = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: CID,
      market: "ID",
      useLiveWorld: true,
    }),
  });
  const ms = Date.now() - t0;
  const body = await res.json();
  const dbg = body?._debug_timings ?? {};
  const promotion = dbg.deterministic_reply_promotion ?? null;
  const shadow = dbg.deterministic_shadow ?? null;
  return {
    message,
    wall_ms: ms,
    status: res.status,
    reply: body?.reply,
    voice_en: body?.voice_reply?.en,
    voice_intent: body?.voice_reply?.intent,
    voice_reason: body?.voice_reply?.chosen_reason,
    composition_meta: {
      ran: body?.composition_meta?.ran,
      accepted: body?.composition_meta?.accepted,
      model: body?.composition_meta?.model,
      reason: body?.composition_meta?.reason,
      latency_ms: body?.composition_meta?.latency_ms,
    },
    promotion,
    shadow_composed: shadow?.composed ?? null,
    shadow_skipped: shadow?.skipped_reason ?? null,
    shadow_ms: shadow?.ms ?? null,
    world_cards_n: Array.isArray(body?.world_cards?.cards) ? body.world_cards.cards.length : null,
  };
}

console.log(`# NEX deterministic reply promotion — smoke matrix`);
console.log(`# host=${HOST} · conversation_id=${CID}`);
console.log("");

for (const m of MATRIX) {
  try {
    const r = await turn(m);
    console.log(`── ${JSON.stringify(m)}`);
    console.log(`   wall_ms:          ${r.wall_ms}`);
    console.log(`   reply:            ${JSON.stringify(r.reply)}`);
    console.log(`   voice_en:         ${JSON.stringify(r.voice_en)}`);
    console.log(`   voice_intent:     ${r.voice_intent}`);
    console.log(`   voice_reason:     ${r.voice_reason}`);
    console.log(`   composition_meta: ${JSON.stringify(r.composition_meta)}`);
    console.log(`   promotion:        ${JSON.stringify(r.promotion)}`);
    console.log(`   shadow_ms:        ${r.shadow_ms}`);
    console.log(`   shadow_skipped:   ${r.shadow_skipped ?? "-"}`);
    console.log(`   shadow_composed:  ${JSON.stringify(r.shadow_composed)}`);
    console.log(`   world_cards_n:    ${r.world_cards_n}`);
    console.log("");
  } catch (e) {
    console.log(`── ${JSON.stringify(m)} · ERROR ${e?.message ?? e}`);
  }
}
