// Live Conversational Proof · Chief-Engineer PROOF slice (Philip 2026-09-05)
//
// Runs REAL HTTP POSTs against /api/nex-conv/chat on the running dev
// server (:3008). Captures: reply · intent · retrieved knowledge · world
// cards · composition_meta · confidence · reflection · voice_reply ·
// entity state · reference resolution.
//
// SAFETY:
//   · Uses the live chat endpoint · no code changes · no data changes.
//   · Fresh conversation_id per track to prove isolation.
//   · Additional negative + isolation tests included.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = "http://localhost:3008/api/nex-conv/chat";

const tracks = [
  {
    domain: "food",
    position: "restaurant_food + indonesia_knowledge",
    conversation_id: randomUUID(),
    turns: [
      "Tell me about Indonesian food.",
      "What about tuna?",
      "Could I export it?",
      "What about Japan?",
    ],
  },
  {
    domain: "hotels",
    position: "hotel_accommodation",
    conversation_id: randomUUID(),
    turns: [
      "Find me somewhere to stay near Malioboro.",
      "Which one would you choose?",
      "What do you know about the first one?",
    ],
  },
  {
    domain: "gym",
    position: "gym_fitness",
    conversation_id: randomUUID(),
    turns: [
      "Find me a gym.",
      "Which one would you choose?",
      "Tell me more about the first one.",
    ],
  },
  {
    domain: "travel",
    position: "travel_transport + indonesia_knowledge",
    conversation_id: randomUUID(),
    turns: [
      "I'm flying from Jakarta.",
      "Which airports could I use?",
      "What about Yogyakarta?",
    ],
  },
  {
    domain: "indonesia_knowledge_history",
    position: "indonesia_knowledge",
    conversation_id: randomUUID(),
    turns: [
      "Tell me about Yogyakarta.",
      "What are the main sacred sites there?",
    ],
  },
  {
    domain: "NEGATIVE_boundary",
    position: "N/A · should return honest boundary",
    conversation_id: randomUUID(),
    turns: [
      "What is the current export price of yellowfin tuna to Japan?",
    ],
  },
  {
    domain: "ISOLATION_fresh_conversation",
    position: "N/A · should NOT resolve to any prior hotel",
    conversation_id: randomUUID(),
    turns: [
      "Tell me about the first hotel.",
    ],
  },
];

async function postTurn(convId, message) {
  const t0 = Date.now();
  try {
    const r = await fetch(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: convId, message, market: "ID" }),
    });
    const text = await r.text();
    let j = null;
    try { j = JSON.parse(text); } catch {}
    return { ok: r.ok, status: r.status, ms: Date.now() - t0, body: j, rawLen: text.length };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: String(e?.message ?? e) };
  }
}

function summariseTurn(resp) {
  if (!resp.body) return { error: resp.error ?? `status=${resp.status}` };
  const b = resp.body;
  const cardHits = b.card?.payload?.hits?.map((h) => ({
    id: h.id,
    topic: h.topic,
    region: h.region,
    source: h.source ?? "seed.curated",
    last_verified: h.last_verified,
    stability: h.stability,
    confidence: h.confidence,
  })) ?? [];
  const worldCards = b.world_cards?.cards?.map((c) => ({
    id: c.id ?? c.public_listing_ref,
    name: c.name ?? c.title,
    category: c.category,
    city: c.city,
    district: c.district,
    address: c.address,
    phone: c.phone,
    website: c.website,
    provenance_source: c.provenance?.sourceKey,
    provenance_readAt: c.provenance?.readAt,
  })) ?? [];
  return {
    conversation_id: b.conversation_id,
    intent: b.intent,
    intent_reason: b.intent_reason,
    reply_len: b.reply?.length ?? 0,
    reply_preview: b.reply?.slice(0, 300) ?? null,
    voice_reply_intent: b.voice_reply?.intent,
    voice_reply_preview: b.voice_reply?.en?.slice(0, 200) ?? null,
    served_by: b.served_by,
    turn_count: b.state_summary?.turn_count,
    current_topic: b.state_summary?.current_topic,
    card_kind: b.card?.kind ?? null,
    card_hits_count: cardHits.length,
    card_hits_sample: cardHits.slice(0, 5),
    world_cards_count: worldCards.length,
    world_cards_total_available: b.world_cards?.totalAvailable ?? null,
    world_cards_headline: b.world_cards?.headline ?? null,
    world_cards_sample: worldCards.slice(0, 5),
    confidence: b.confidence?.overall,
    reflection_pass: b.reflection?.overallPass,
    reflection_pass_ratio: b.meta_cognition?.howSure?.reflectionPassRatio,
    fabrication_risk: b.meta_cognition?.amIWrong?.fabricationRisk,
    composition_ran: b.composition_meta?.ran,
    composition_accepted: b.composition_meta?.accepted,
    composition_model: b.composition_meta?.model,
    composition_reason: b.composition_meta?.reason,
    composition_widened_for_info_query: b.composition_meta?.widened_for_information_query,
    composition_knowledge_count: b.composition_meta?.knowledge_count,
    composition_composed_entity_count: b.composition_meta?.composed_entity_count,
    entities_total: b.entities?.total ?? 0,
    entities_byKind: b.entities?.byKind ?? {},
    current_reference: b.current_reference,
    latency_ms: resp.ms,
    metrics: b.metrics ?? null,
  };
}

async function main() {
  const results = [];
  for (const track of tracks) {
    console.log(`\n═══ ${track.domain.toUpperCase()} (conv=${track.conversation_id.slice(0, 8)}) ═══`);
    const trackTurns = [];
    for (let i = 0; i < track.turns.length; i++) {
      const q = track.turns[i];
      console.log(`\n  T${i + 1} → ${JSON.stringify(q)}`);
      const resp = await postTurn(track.conversation_id, q);
      const s = summariseTurn(resp);
      trackTurns.push({ turn: i + 1, question: q, ...s });
      console.log(`    intent=${s.intent}  card=${s.card_kind}(${s.card_hits_count})  world=${s.world_cards_count}/${s.world_cards_total_available}  comp=${s.composition_accepted ? "✓" : s.composition_ran ? "✗" : "-"}  refl=${s.reflection_pass_ratio}  ms=${s.latency_ms}`);
      if (s.reply_preview) console.log(`    reply: ${s.reply_preview.slice(0, 200)}...`);
      if (s.card_hits_sample.length > 0) {
        console.log(`    card hits:`);
        for (const h of s.card_hits_sample) console.log(`      · ${h.topic}  region=${h.region}  verified=${h.last_verified}`);
      }
      if (s.world_cards_sample.length > 0) {
        console.log(`    world cards:`);
        for (const c of s.world_cards_sample) console.log(`      · ${c.name}  (${c.category})  ${c.city}${c.district ? "/" + c.district : ""}  src=${c.provenance_source}`);
      }
      if (s.current_reference?.resolved) console.log(`    resolved: ${JSON.stringify(s.current_reference)}`);
    }
    results.push({ domain: track.domain, position: track.position, conversation_id: track.conversation_id, turns: trackTurns });
  }

  const outPath = path.join(here, "_live_conversation_proof.json");
  writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2) + "\n", "utf8");
  console.log(`\n→ ${outPath}\n`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
