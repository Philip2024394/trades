#!/usr/bin/env node
// scripts/kf-probe-chat.mjs
// Hit the live chat with per-entity unknown queries and confirm knowledge_gap grows.

import { randomUUID } from "node:crypto";
async function turn(msg) {
  const r = await fetch("http://localhost:3008/api/nex-conv/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: msg,
      conversation_id: randomUUID(),
      market: "ID",
      useLiveWorld: true,
    }),
  });
  const b = await r.json();
  return { reply: b?.reply, voice_intent: b?.voice_reply?.intent, kind: b?._debug_timings?.lcc_adapter_reply?.reply_kind };
}

const queries = [
  "how many rooms does Gaotama Hotel have?",
  "does Selaras Inn Hotel Yogyakarta have wifi?",
  "what is the michelin star of Bladok Losmen",
  "does Trava House have breakfast?",
  "phone number for Bladok Losmen & Restaurant",
];

for (const q of queries) {
  const r = await turn(q);
  console.log(`Q: ${q}`);
  console.log(`   reply: ${JSON.stringify(String(r.reply ?? "").slice(0, 90))}`);
  console.log(`   voice_intent: ${r.voice_intent} · adapter.reply_kind=${r.kind}`);
}
