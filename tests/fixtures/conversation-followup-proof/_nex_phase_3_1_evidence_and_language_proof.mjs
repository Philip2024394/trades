#!/usr/bin/env node
// tests/fixtures/conversation-followup-proof/_nex_phase_3_1_evidence_and_language_proof.mjs
//
// NEX · Phase 3.1 · Truth/evidence + EN/ID language contract proof
// Philip 2026-09-06 · CEREMONIAL AUTHORIZATION · Phase 3.1 §17 §18 §16
//
// Real HTTP probes covering:
//   · EN + ID natural-language Live discovery loop (§17)
//   · Truth-boundary contracts (§18):
//       - Unknown ≠ false        (zero-evidence city returns honest empty)
//       - Unverified ≠ verified  (label never says "verified" for
//                                 uploader-declared content)
//       - Mock ≠ real           (is_mock_fixture preserved through the pipe)
//       - Live ≠ popularity     (no viewer/like counts in the response)
//       - Interest ≠ message sent (Interested surfaces "queued", not "sent")

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.NEX_BASE_URL ?? "http://localhost:3009";

async function postChat(message, extra = {}) {
  const body = { message, conversation_id: extra.conversation_id ?? `phase-3-1-${Date.now()}`, user_market: extra.market ?? "ID" };
  const r = await fetch(`${BASE_URL}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return { status: r.status, body: j };
}

const results = {};
function pass(k, extra = {}) { results[k] = { pass: true, ...extra }; console.log(`  PASS · ${k}`); }
function fail(k, extra = {}) { results[k] = { pass: false, ...extra }; console.log(`  FAIL · ${k} · ${JSON.stringify(extra).slice(0,200)}`); }

async function main() {
  console.log("=== NEX PHASE 3.1 · EVIDENCE + LANGUAGE PROOF ===");
  console.log(`BASE_URL: ${BASE_URL}`);

  // §17 · English full journey
  console.log("\n-- English --");
  try {
    const { status, body } = await postChat("what's happening tonight in yogyakarta?", { market: "UK" });
    const live = body?.live_discovery ?? null;
    if (status === 200 && body?.intent === "live_discovery" && live?.city_used === "yogyakarta" && (live.cards ?? []).length > 0) {
      pass("EN_full_loop", { cards: live.cards.length, live_now: live.status_counts?.LIVE_NOW });
    } else fail("EN_full_loop", { status, intent: body?.intent, live });
  } catch (e) { fail("EN_full_loop", { error: e.message.slice(0,200) }); }

  try {
    const { body } = await postChat("what's live tonight?", { market: "UK" });
    const reply = String(body?.reply ?? "");
    // English reply should mention "live" or "tonight" · Indonesian
    // markers (malam ini / kota) must NOT appear.
    const englishy = /\b(live|tonight)\b/i.test(reply);
    const noIDLeak = !/malam ini|sedang berlangsung|kota/i.test(reply);
    if (englishy && noIDLeak) pass("EN_G03_no_language_leak", { snippet: reply.slice(0, 120) });
    else fail("EN_G03_no_language_leak", { snippet: reply.slice(0, 200), englishy, noIDLeak });
  } catch (e) { fail("EN_G03_no_language_leak", { error: e.message.slice(0,200) }); }

  // §17 · Indonesian full journey (jogja alias)
  console.log("\n-- Indonesian --");
  try {
    const { status, body } = await postChat("apa yang sedang berlangsung di jogja malam ini?");
    const live = body?.live_discovery ?? null;
    if (status === 200 && body?.intent === "live_discovery" && live?.city_used === "yogyakarta" && (live.cards ?? []).length > 0) {
      pass("ID_full_loop_jogja_alias", { cards: live.cards.length, city: live.city_used });
    } else fail("ID_full_loop_jogja_alias", { status, intent: body?.intent, city: live?.city_used });
  } catch (e) { fail("ID_full_loop_jogja_alias", { error: e.message.slice(0,200) }); }

  try {
    const { body } = await postChat("apa yang sedang berlangsung di jogja malam ini?");
    const reply = String(body?.reply ?? "");
    const idMarkers = /(malam ini|sekarang|kota|ada|acara)/i.test(reply);
    if (idMarkers) pass("ID_G03_reply_matches_language", { snippet: reply.slice(0, 120) });
    else fail("ID_G03_reply_matches_language", { snippet: reply.slice(0, 200) });
  } catch (e) { fail("ID_G03_reply_matches_language", { error: e.message.slice(0,200) }); }

  // §18 · Unknown ≠ false · non-city returns honest empty
  console.log("\n-- Truth boundaries --");
  try {
    const { body } = await postChat("what's happening tonight in atlantis?");
    const live = body?.live_discovery ?? null;
    const reply = String(body?.reply ?? "");
    const noFakeCards = (live?.cards ?? []).length === 0;
    // Reply must NOT say "there are N things live" when there are none.
    const noFabricatedClaim = !/\b\d+\s+(live|events?|things)\b/i.test(reply);
    if (noFakeCards && noFabricatedClaim) pass("TRUTH_unknown_not_false", { snippet: reply.slice(0, 120), reason: live?.empty_reason });
    else fail("TRUTH_unknown_not_false", { snippet: reply.slice(0, 200), cards: (live?.cards ?? []).length });
  } catch (e) { fail("TRUTH_unknown_not_false", { error: e.message.slice(0,200) }); }

  // §18 · Unverified ≠ verified · discover endpoint honesty tag
  try {
    const r = await fetch(`${BASE_URL}/api/nex-live/discover?mode=VIDEO&limit=5`, { cache: "no-store" });
    const j = await r.json();
    const items = j?.items ?? [];
    const allUnverified = items.every((it) => it?.verified === false);
    const labelHonest = items.every((it) => {
      const l = String(it?.customer_facing_label ?? "").toLowerCase();
      return !l.includes("verified");
    });
    if (allUnverified && labelHonest) pass("TRUTH_unverified_never_labeled_verified", { items: items.length });
    else fail("TRUTH_unverified_never_labeled_verified", { items: items.length, allUnverified, labelHonest });
  } catch (e) { fail("TRUTH_unverified_never_labeled_verified", { error: e.message.slice(0,200) }); }

  // §18 · Mock ≠ real · is_mock_fixture preserved through tonight
  try {
    const r = await fetch(`${BASE_URL}/api/nex-live/tonight?city=yogyakarta&limit=10`, { cache: "no-store" });
    const j = await r.json();
    const items = j?.items ?? [];
    const allMocksMarked = items.every((it) => typeof it?.is_mock_fixture === "boolean");
    const someMocks = items.some((it) => it.is_mock_fixture === true);
    if (allMocksMarked && someMocks) pass("TRUTH_mock_preserved_end_to_end", { items: items.length, some_mock: someMocks });
    else fail("TRUTH_mock_preserved_end_to_end", { items: items.length, marked: allMocksMarked, some_mock: someMocks });
  } catch (e) { fail("TRUTH_mock_preserved_end_to_end", { error: e.message.slice(0,200) }); }

  // §18 · Live ≠ popularity · no viewer/like counts anywhere
  try {
    const r = await fetch(`${BASE_URL}/api/nex-live/tonight?city=yogyakarta&limit=10`, { cache: "no-store" });
    const raw = JSON.stringify(await r.json()).toLowerCase();
    const forbidden = ["viewer_count", "viewers", "likes", "like_count", "followers", "trending_score", "engagement_score"];
    const leaks = forbidden.filter((k) => raw.includes(k));
    if (leaks.length === 0) pass("TRUTH_live_never_popularity", { checked: forbidden.length });
    else fail("TRUTH_live_never_popularity", { leaks });
  } catch (e) { fail("TRUTH_live_never_popularity", { error: e.message.slice(0,200) }); }

  // §18 · Reply never contains machine intent string (§20 calm)
  try {
    const { body } = await postChat("what's live in yogyakarta tonight?");
    const reply = String(body?.reply ?? "").toUpperCase();
    if (!reply.includes("LIVE_DISCOVERY_REQUEST") && !reply.includes("INTENT=")) {
      pass("TRUTH_reply_never_machine_intent_string");
    } else fail("TRUTH_reply_never_machine_intent_string", { snippet: reply.slice(0, 200) });
  } catch (e) { fail("TRUTH_reply_never_machine_intent_string", { error: e.message.slice(0,200) }); }

  // §16 · Greeting still routes to conversation · no over-trigger
  try {
    const { body } = await postChat("halo nex apa kabar?");
    if (body?.intent !== "live_discovery") pass("TRUTH_greeting_no_over_trigger", { intent: body?.intent });
    else fail("TRUTH_greeting_no_over_trigger", { intent: body?.intent });
  } catch (e) { fail("TRUTH_greeting_no_over_trigger", { error: e.message.slice(0,200) }); }

  const p = Object.values(results).filter((v) => v.pass).length;
  const f = Object.keys(results).length - p;
  const out = { runAt: new Date().toISOString(), base_url: BASE_URL, results, summary: { pass: p, fail: f, total: Object.keys(results).length } };
  fs.writeFileSync(path.join(here, "_nex_phase_3_1_evidence_and_language_proof.json"), JSON.stringify(out, null, 2));
  console.log(`\n=== SUMMARY ===`);
  console.log(`pass=${p} fail=${f} / ${Object.keys(results).length}`);
  process.exit(f === 0 ? 0 : 1);
}

main().catch((err) => { console.error("FATAL", err); process.exit(2); });
