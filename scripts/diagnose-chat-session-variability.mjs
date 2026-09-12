#!/usr/bin/env node
// scripts/diagnose-chat-session-variability.mjs
//
// Diagnose the session-state variability observed in prior Chromium probes:
//   run 1 → "521 real listings" (success)
//   run 2 → "I don't have matching real listings yet" (empty)
//   run 3 → "521 real listings" (success)
//
// Method:
//   Fire N direct HTTP POST requests to /api/nex-conv/chat with:
//     - identical query
//     - identical shape
//     - DIFFERENT session_id per call (mimics fresh sessions)
//   Then repeat with the SAME session_id (mimics one long session).
//   Compare success rates. If direct-API is deterministic, the variability
//   is in the Chromium probe. If direct-API is variable, the chat brain
//   has session-dependent behavior that must be diagnosed.
//
// Zero fixes. Zero fabrication. Read-only diagnostic.

const BASE = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "http://localhost:3008";
const N = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 10);
const QUERY = "Find me hotels near Malioboro";
const CHAT_URL = `${BASE}/api/nex-conv/chat`;

async function ask(sessionId, message) {
  const t0 = Date.now();
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  const body = await res.json();
  return { latency_ms: Date.now() - t0, status: res.status, body };
}

function classify(body) {
  const reply = body.reply ?? "";
  const voice = body.voice_reply?.en ?? "";
  const cardHits = body.card?.payload?.hits?.length ?? 0;
  const worldCards = body.world_cards?.length ?? body.presented?.length ?? 0;
  const hasRealNames = /\b[A-Z][a-zA-Z]+\s+(Hotel|Homestay|Inn|Guesthouse|Villa|Resort|Penginapan|Wisma|Losmen)\b/.test(reply);
  const hasCount = /\b(\d+)\s+real\s+(listings?|places?|hotels?)/i.exec(reply);
  const emptyPattern = /(don't have matching|nothing.{0,20}coming back|no matches)/i.test(reply);
  return {
    intent: body.intent ?? body.understood_intent ?? "?",
    real_names: hasRealNames,
    count_reported: hasCount ? Number(hasCount[1]) : null,
    empty_reported: emptyPattern,
    card_hits: cardHits,
    world_cards: worldCards,
    voice_reply_en: voice,
    reply_snippet: reply.slice(0, 100),
  };
}

async function main() {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Chat session-state variability diagnosis`);
  console.log(`endpoint: ${CHAT_URL}`);
  console.log(`query   : "${QUERY}"`);
  console.log(`N       : ${N}`);
  console.log(`started : ${new Date().toISOString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Phase A · N calls with UNIQUE session_id each (fresh sessions)
  console.log(`\n[Phase A] ${N} fresh sessions (unique session_id per call)\n`);
  const freshResults = [];
  for (let i = 0; i < N; i++) {
    const sid = `diag-fresh-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const r = await ask(sid, QUERY);
      const c = classify(r.body);
      freshResults.push({ i, sid, latency: r.latency_ms, ...c });
      const badge = c.real_names ? "✓ REAL" : c.empty_reported ? "✗ EMPTY" : "? OTHER";
      console.log(`  ${String(i + 1).padStart(2)}. ${badge}  latency=${r.latency_ms}ms  count=${c.count_reported ?? "-"}  cards=${c.world_cards}  intent=${c.intent}  reply="${c.reply_snippet}..."`);
    } catch (e) {
      freshResults.push({ i, sid, error: e.message });
      console.log(`  ${String(i + 1).padStart(2)}. ✗ ERROR ${e.message}`);
    }
  }

  // Phase B · N calls REUSING the SAME session_id (single conversation)
  console.log(`\n[Phase B] ${N} calls reusing a SINGLE session_id (one long conversation)\n`);
  const sharedSid = `diag-shared-${Date.now()}`;
  const sharedResults = [];
  for (let i = 0; i < N; i++) {
    try {
      const r = await ask(sharedSid, QUERY);
      const c = classify(r.body);
      sharedResults.push({ i, sid: sharedSid, latency: r.latency_ms, ...c });
      const badge = c.real_names ? "✓ REAL" : c.empty_reported ? "✗ EMPTY" : "? OTHER";
      console.log(`  ${String(i + 1).padStart(2)}. ${badge}  latency=${r.latency_ms}ms  count=${c.count_reported ?? "-"}  cards=${c.world_cards}  reply="${c.reply_snippet}..."`);
    } catch (e) {
      sharedResults.push({ i, error: e.message });
      console.log(`  ${String(i + 1).padStart(2)}. ✗ ERROR ${e.message}`);
    }
  }

  // Summary
  const okFresh = freshResults.filter((r) => r.real_names).length;
  const emptyFresh = freshResults.filter((r) => r.empty_reported).length;
  const okShared = sharedResults.filter((r) => r.real_names).length;
  const emptyShared = sharedResults.filter((r) => r.empty_reported).length;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`SUMMARY`);
  console.log(`  Fresh sessions (n=${N})  · real=${okFresh} · empty=${emptyFresh} · success rate=${((okFresh / N) * 100).toFixed(1)}%`);
  console.log(`  Shared session (n=${N})  · real=${okShared} · empty=${emptyShared} · success rate=${((okShared / N) * 100).toFixed(1)}%`);
  console.log(``);
  if (okFresh === N && okShared === N) {
    console.log(`  VERDICT: API is DETERMINISTIC · variability is NOT at chat-brain level`);
  } else if (okFresh === 0 && okShared === 0) {
    console.log(`  VERDICT: API always returns empty · chat brain has a data-flow break`);
  } else {
    console.log(`  VERDICT: API is VARIABLE · chat brain has session/timing-dependent behavior`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`finished ${new Date().toISOString()}`);
}

main().catch((e) => {
  console.error(`diag FAILED: ${e.stack ?? e.message ?? e}`);
  process.exit(1);
});
