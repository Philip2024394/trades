#!/usr/bin/env node
// tests/fixtures/conversation-followup-proof/_nex_phase_d_live_discovery_proof.mjs
//
// NEX · Phase D · Natural-language LIVE_DISCOVERY_REQUEST browser+HTTP proof
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D §17-§24
//
// Real HTTP journey (not a synthetic classifier test):
//   · POST /api/nex-conv/chat with EN, ID, category-scoped, and
//     zero-evidence probes
//   · Verify:
//       - intent === "live_discovery"
//       - reply is conversational, NOT "LIVE_DISCOVERY_REQUEST detected"
//       - live_discovery observability payload is present (cards + counts)
//       - zero-evidence city returns honest empty summary (never a fake card)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, "_phase_d_screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.NEX_BASE_URL ?? "http://localhost:3008";

async function postChat(message, extra = {}) {
  const body = { message, conversation_id: extra.conversation_id ?? `phase-d-live-${Date.now()}`, user_market: extra.market ?? "ID" };
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
function fail(k, extra = {}) { results[k] = { pass: false, ...extra }; console.log(`  FAIL · ${k} · ${JSON.stringify(extra).slice(0,300)}`); }

async function main() {
  console.log("=== NEX PHASE D · NATURAL-LANGUAGE LIVE DISCOVERY PROOF ===");
  console.log(`BASE_URL: ${BASE_URL}`);

  // Probe 1 · English "what's happening tonight in yogyakarta?"
  try {
    const { status, body } = await postChat("what's happening tonight in yogyakarta?");
    const intent = body?.intent ?? body?.understood_intent ?? null;
    const live = body?.live_discovery ?? null;
    if (status === 200 && intent === "live_discovery" && live) {
      pass("A_english_tonight_routes_to_live_discovery", {
        intent, city: live.city_used, cards: (live.cards ?? []).length, empty_reason: live.empty_reason,
      });
    } else {
      fail("A_english_tonight_routes_to_live_discovery", { status, intent, has_live: !!live });
    }
  } catch (e) { fail("A_english_tonight_routes_to_live_discovery", { error: e.message.slice(0,200) }); }

  // Probe 2 · Indonesian "apa yang sedang berlangsung di jogja malam ini?"
  try {
    const { status, body } = await postChat("apa yang sedang berlangsung di jogja malam ini?");
    const intent = body?.intent ?? body?.understood_intent ?? null;
    const live = body?.live_discovery ?? null;
    if (status === 200 && intent === "live_discovery" && live && live.city_used === "yogyakarta") {
      pass("B_indonesian_routes_and_resolves_jogja_alias", { intent, city: live.city_used, cards: (live.cards ?? []).length });
    } else {
      fail("B_indonesian_routes_and_resolves_jogja_alias", { status, intent, city: live?.city_used });
    }
  } catch (e) { fail("B_indonesian_routes_and_resolves_jogja_alias", { error: e.message.slice(0,200) }); }

  // Probe 3 · Category-scoped "any music live tonight in yogyakarta?"
  try {
    const { status, body } = await postChat("any music live tonight in yogyakarta?");
    const intent = body?.intent ?? body?.understood_intent ?? null;
    const live = body?.live_discovery ?? null;
    if (status === 200 && intent === "live_discovery" && live && live.category_used === "music") {
      pass("C_category_scoped_music_only", { intent, category: live.category_used, cards: (live.cards ?? []).length });
    } else {
      fail("C_category_scoped_music_only", { status, intent, category: live?.category_used });
    }
  } catch (e) { fail("C_category_scoped_music_only", { error: e.message.slice(0,200) }); }

  // Probe 4 · Zero-evidence city "what's happening tonight in mars-central?"
  //   Handler must return an honest empty summary · never fabricate cards.
  try {
    const { status, body } = await postChat("what's happening tonight in mars-central?");
    const intent = body?.intent ?? body?.understood_intent ?? null;
    const live = body?.live_discovery ?? null;
    const reply = body?.reply ?? "";
    if (status === 200 && intent === "live_discovery" && live) {
      const emptyCards = (live.cards ?? []).length === 0;
      const noFakeIntentString = !reply.includes("LIVE_DISCOVERY_REQUEST");
      // Non-city text — the detector doesn't recognise mars-central as
      // a city, so explicit_city is null and handler suppresses honestly.
      if (emptyCards && noFakeIntentString) {
        pass("D_zero_evidence_no_fabrication", { intent, cards: 0, empty_reason: live.empty_reason });
      } else {
        fail("D_zero_evidence_no_fabrication", { cards: (live.cards ?? []).length, has_intent_string: !noFakeIntentString });
      }
    } else {
      fail("D_zero_evidence_no_fabrication", { status, intent });
    }
  } catch (e) { fail("D_zero_evidence_no_fabrication", { error: e.message.slice(0,200) }); }

  // Probe 5 · Non-live turn still classifies to something else (no over-triggering)
  try {
    const { status, body } = await postChat("hello nex how are you?");
    const intent = body?.intent ?? body?.understood_intent ?? null;
    if (status === 200 && intent !== "live_discovery") {
      pass("E_greeting_does_not_over_trigger_live_discovery", { intent });
    } else {
      fail("E_greeting_does_not_over_trigger_live_discovery", { status, intent });
    }
  } catch (e) { fail("E_greeting_does_not_over_trigger_live_discovery", { error: e.message.slice(0,200) }); }

  // Probe 6 · Reply is calm conversation, never "LIVE_DISCOVERY_REQUEST"
  try {
    const { body } = await postChat("what's live in yogyakarta right now?");
    const reply = String(body?.reply ?? "");
    const calm = !reply.includes("LIVE_DISCOVERY_REQUEST") && !reply.includes("intent") && reply.length > 0 && reply.length < 500;
    if (calm) pass("F_reply_is_calm_conversational", { snippet: reply.slice(0, 120) });
    else fail("F_reply_is_calm_conversational", { snippet: reply.slice(0, 300) });
  } catch (e) { fail("F_reply_is_calm_conversational", { error: e.message.slice(0,200) }); }

  // Probe 7 · Live suggestions attached · playback URLs point to /nex-live
  try {
    const { body } = await postChat("what's live in yogyakarta tonight?");
    const live = body?.live_discovery ?? null;
    const suggestions = body?.suggestions ?? [];
    const hasLiveHref = suggestions.some((s) => typeof s?.href === "string" && s.href.startsWith("/nex-live"));
    if (live && suggestions.length > 0 && hasLiveHref) {
      pass("G_suggestions_route_to_nex_live", { suggestions: suggestions.length, sample_href: suggestions[0]?.href });
    } else {
      fail("G_suggestions_route_to_nex_live", { suggestions: suggestions.length, has_live_href: hasLiveHref });
    }
  } catch (e) { fail("G_suggestions_route_to_nex_live", { error: e.message.slice(0,200) }); }

  const pass_count = Object.values(results).filter((v) => v.pass).length;
  const fail_count = Object.keys(results).length - pass_count;
  const overall = {
    runAt: new Date().toISOString(),
    base_url: BASE_URL,
    results,
    summary: { pass: pass_count, fail: fail_count, total: Object.keys(results).length },
  };
  const outPath = path.join(here, "_nex_phase_d_live_discovery_proof.json");
  fs.writeFileSync(outPath, JSON.stringify(overall, null, 2), "utf8");
  console.log(`\n=== SUMMARY ===`);
  console.log(`pass=${pass_count} fail=${fail_count} / ${Object.keys(results).length}`);
  console.log(`Result: ${outPath}`);
  process.exit(fail_count === 0 ? 0 : 1);
}

main().catch((err) => { console.error("FATAL", err); process.exit(2); });
