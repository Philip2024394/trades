#!/usr/bin/env node
// scripts/audit-deterministic-conversation-composer.mjs
//
// Founder BEGIN 2026-09-09 · DETERMINISTIC-CONVERSATION-COMPOSER-AUDIT
//
// Diagnostic only. Zero fixes. Zero L4 changes. Zero new model. Zero DB changes.
// Zero fake intelligence.
//
// Runs 8 Founder-specified two-turn sequences against the real customer chat
// route /api/nex-conv/chat. For each turn captures:
//
//   intent → context → retrieval → result → composer → visible customer answer
//
// Classifies each visible answer:
//   🟢 GREEN  · correct deterministic answer (matches user's question · uses real data)
//   🟡 YELLOW · honest unknown (says "I don't have..." rather than fabricating)
//   🔴 RED    · generic / stale (e.g. "Yep — found N" without conversational content)
//   🔵 BLUE   · genuinely requires reasoning/LLM (open-ended · comparative · subjective)
//
// The classification is heuristic-driven from the actual response text +
// _debug_timings signals. Founder inspects the JSON for the final truth.

const BASE = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "http://localhost:3008";
const CHAT_URL = `${BASE}/api/nex-conv/chat`;

// The 8 Founder-specified sequences · exact wording preserved
const SEQUENCES = [
  { label: "S1_hotel_where",              q1: "have you hotel",                    q2: "where" },
  { label: "S2_hotel_malioboro_price",    q1: "hotel Malioboro",                   q2: "how much" },
  { label: "S3_apartment_jogja_price",    q1: "apartment tonight jogja",           q2: "how much" },
  { label: "S4_find_hotels_pool",         q1: "find hotels",                       q2: "which ones have pool" },
  { label: "S5_find_hotels_cheapest",     q1: "find hotels",                       q2: "show me the cheapest" },
  { label: "S6_find_hotels_first_detail", q1: "find hotels",                       q2: "tell me about the first one" },
  { label: "S7_find_hotels_where",        q1: "find hotels",                       q2: "where are they" },
  { label: "S8_find_hotels_guesthouses",  q1: "find hotels",                       q2: "what about guesthouses" },
];

async function ask(message, conversationId) {
  const t0 = Date.now();
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: conversationId ?? null, market: "ID" }),
  });
  const body = await res.json();
  const wallMs = Date.now() - t0;
  return { body, wallMs };
}

// Heuristic classifier · pure function · never fabricates
function classifyTurn(userMessage, response) {
  const reply = String(response.reply ?? "");
  const voiceReply = String(response.voice_reply?.en ?? "");
  const intent = response.intent ?? response.understood_intent ?? "unknown";
  const cardHits = response.card?.payload?.hits?.length ?? 0;
  const worldCards = response.world_cards?.length ?? response.presented?.length ?? 0;
  const llmInvoked = response._debug_timings?.llm_invoked === true;
  const compositionAccepted = response._debug_timings?.composition_accepted === true;

  // Signal detection
  const hasRealPlaceNames = /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z0-9]+)+\b/.test(reply);
  const hasCount = /\b\d+\s+(real\s+)?(listings?|places?|hotels?|guesthouses?|apartments?|villas?)/i.test(reply);
  const isGenericFoundN = /^(Yep|Sip)\s*[—-]\s*(found|ada|ketemu)\s+\d+\.?/i.test(voiceReply);
  const isHonestUnknown =
    /(I don't have|Not sure|don't yet have|nothing.{0,20}coming back|no matches|I don't (know|remember))/i.test(reply)
    || /(I don't have|don't yet)/i.test(voiceReply);
  const referencesPrior = /(the current list|those hotels|the previous|the one you|the first one)/i.test(reply);
  const askedForFilter = /(pool|breakfast|parking|wifi|price|cheap|cheapest|expensive|kids|pet)/i.test(userMessage);
  const askedForLocation = /(where|location|near|around|address)/i.test(userMessage);
  const askedForPrice = /(how much|price|cost|rate|fee|charge|cheap|expensive)/i.test(userMessage);
  const askedForOrdinal = /(first|second|third|1st|2nd|3rd|last|top)/i.test(userMessage);
  const askedForCompare = /(compare|which|better|different|guesthouses?|villas?|apartments?)/i.test(userMessage);

  // 🟢 GREEN: deterministic + correct
  //   - Query for stays  → reply names real hotels + count
  //   - Location question → reply mentions specific place(s)
  //   - Price question → reply names verified price OR honest no-price
  //   - Filter question → reply lists matching or honestly reports missing data
  //
  // 🟡 YELLOW: honest unknown surfaced
  //   - "I don't have verified X" · "not sure" · but user asked a specific fact
  //
  // 🔴 RED: generic / stale
  //   - voice_reply is "Yep — found N" AND user asked a question that requires more
  //   - reply is empty · repeats the same greeting · repeats "found N" without context
  //
  // 🔵 BLUE: genuinely needs reasoning/LLM
  //   - Subjective question (best · recommend for X)
  //   - Comparative reasoning across many properties
  //   - Open-ended prose composition

  let color = "?";
  let reasoning = "";

  // Quick checks
  if (!reply.trim() && !voiceReply.trim()) {
    color = "🔴 RED";
    reasoning = "empty response · neither reply nor voice_reply produced";
  } else if (isHonestUnknown) {
    color = "🟡 YELLOW";
    reasoning = `honest 'I don't have' statement · ${voiceReply.slice(0, 60)}`;
  } else if (isGenericFoundN && !hasRealPlaceNames) {
    // Voice says found N · reply doesn't name anything · that's stale
    color = "🔴 RED";
    reasoning = `voice_reply generic "${voiceReply}" · no names in reply either`;
  } else if (isGenericFoundN && hasRealPlaceNames) {
    // Voice is generic but reply DOES name real places (customer sees cards + text)
    color = "🟡 YELLOW";
    reasoning = `voice_reply generic "${voiceReply}" · reply has real names but voice-mode-only user would see just the headline`;
  } else if (askedForLocation && referencesPrior && hasRealPlaceNames) {
    color = "🟢 GREEN";
    reasoning = "location follow-up · reply references prior list AND names real places";
  } else if (askedForPrice && isHonestUnknown) {
    color = "🟡 YELLOW";
    reasoning = "price ask · honest 'don't have price' (correct behavior)";
  } else if (askedForFilter && referencesPrior && isHonestUnknown) {
    color = "🟡 YELLOW";
    reasoning = "filter ask · honest no-data reply (correct behavior)";
  } else if (askedForOrdinal && referencesPrior) {
    color = "🟢 GREEN";
    reasoning = "ordinal reference · reply references prior list";
  } else if (hasCount && hasRealPlaceNames) {
    color = "🟢 GREEN";
    reasoning = "count + real names in reply · deterministic answer";
  } else if (llmInvoked) {
    color = "🔵 BLUE";
    reasoning = "LLM was invoked · not deterministic path";
  } else {
    color = "🔴 RED";
    reasoning = `unclassified: reply="${reply.slice(0, 80)}" · voice="${voiceReply}"`;
  }

  return {
    color,
    reasoning,
    signals: {
      intent,
      hasRealPlaceNames,
      hasCount,
      isGenericFoundN,
      isHonestUnknown,
      referencesPrior,
      askedForFilter,
      askedForLocation,
      askedForPrice,
      askedForOrdinal,
      askedForCompare,
      cardHits,
      worldCards,
      llmInvoked,
      compositionAccepted,
    },
  };
}

async function main() {
  console.log("━".repeat(78));
  console.log("DETERMINISTIC-CONVERSATION-COMPOSER-AUDIT · diagnostic only");
  console.log(`endpoint: ${CHAT_URL}`);
  console.log(`sequences: ${SEQUENCES.length} × 2 turns = ${SEQUENCES.length * 2} classified turns`);
  console.log("━".repeat(78));

  // Warmup so Turbopack + connection pool are hot
  await ask("warmup hello", null);
  await ask("warmup hello", null);

  const results = [];

  for (const seq of SEQUENCES) {
    console.log(`\n▸ ${seq.label}`);
    console.log(`  Q1: "${seq.q1}"`);
    const r1 = await ask(seq.q1, null);
    const conversationId = r1.body.conversation_id;
    const cls1 = classifyTurn(seq.q1, r1.body);
    console.log(`    ${cls1.color}  wall=${r1.wallMs}ms  intent=${cls1.signals.intent}`);
    console.log(`    reply       : ${(r1.body.reply ?? "").slice(0, 140)}`);
    console.log(`    voice_reply : "${r1.body.voice_reply?.en ?? "?"}"`);
    console.log(`    world_cards : ${cls1.signals.worldCards} · card_hits: ${cls1.signals.cardHits}`);
    console.log(`    reasoning   : ${cls1.reasoning}`);

    console.log(`  Q2: "${seq.q2}"   (conversation_id=${conversationId?.slice(0, 8)}...)`);
    const r2 = await ask(seq.q2, conversationId);
    const cls2 = classifyTurn(seq.q2, r2.body);
    console.log(`    ${cls2.color}  wall=${r2.wallMs}ms  intent=${cls2.signals.intent}`);
    console.log(`    reply       : ${(r2.body.reply ?? "").slice(0, 140)}`);
    console.log(`    voice_reply : "${r2.body.voice_reply?.en ?? "?"}"`);
    console.log(`    world_cards : ${cls2.signals.worldCards} · card_hits: ${cls2.signals.cardHits}`);
    console.log(`    reasoning   : ${cls2.reasoning}`);

    results.push({
      sequence: seq.label,
      q1_text: seq.q1,
      q1_reply: r1.body.reply ?? null,
      q1_voice_reply: r1.body.voice_reply?.en ?? null,
      q1_class: cls1,
      q1_wall_ms: r1.wallMs,
      q1_debug: r1.body._debug_timings ?? null,
      q2_text: seq.q2,
      q2_reply: r2.body.reply ?? null,
      q2_voice_reply: r2.body.voice_reply?.en ?? null,
      q2_class: cls2,
      q2_wall_ms: r2.wallMs,
      q2_debug: r2.body._debug_timings ?? null,
      conversation_id: conversationId,
    });
  }

  // Summary counts
  const counts = { "🟢 GREEN": 0, "🟡 YELLOW": 0, "🔴 RED": 0, "🔵 BLUE": 0, "?": 0 };
  for (const r of results) {
    counts[r.q1_class.color] = (counts[r.q1_class.color] ?? 0) + 1;
    counts[r.q2_class.color] = (counts[r.q2_class.color] ?? 0) + 1;
  }
  const total = SEQUENCES.length * 2;

  console.log(`\n${"━".repeat(78)}`);
  console.log(`SUMMARY · ${total} classified turns`);
  for (const [k, v] of Object.entries(counts)) {
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
    console.log(`  ${k}  : ${v}/${total}  (${pct}%)`);
  }

  console.log(`\n${"━".repeat(78)}`);
  console.log("Per-turn table (compact):");
  console.log(`  ${"sequence".padEnd(30)} ${"Q1".padEnd(10)} ${"Q2".padEnd(10)}  llm_Q1  llm_Q2`);
  for (const r of results) {
    console.log(`  ${r.sequence.padEnd(30)} ${r.q1_class.color.padEnd(10)} ${r.q2_class.color.padEnd(10)}    ${r.q1_class.signals.llmInvoked ? "yes" : "no "}     ${r.q2_class.signals.llmInvoked ? "yes" : "no "}`);
  }

  // Save full JSON
  const fs = await import("node:fs");
  const path = await import("node:path");
  const outDir = "data/composer-audit";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ started_at: new Date().toISOString(), sequences: results, summary: counts }, null, 2));
  console.log(`\nfull JSON: ${outPath}`);
  console.log(`━`.repeat(78));
  console.log(`HARD STOP · diagnostic only · no fixes proposed`);
}

main().catch((e) => { console.error(`FAILED:`, e?.stack ?? e); process.exit(1); });
