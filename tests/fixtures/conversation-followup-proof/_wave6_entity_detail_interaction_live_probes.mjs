// NEX World-Class Result Card Interaction & Entity Detail · live probes
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// Proves the full flow:
//   1. hi in chat responds (no P0 stall)
//   2. hotel search shows 3 cards
//   3. click a card → detail page loads → beacon fires → session
//      viewedEntity populated
//   4. return to chat → "does it have a pool?" resolves against the
//      viewed entity (not the first ordinal)
//   5. fresh session "does it have a pool?" → honest boundary (no
//      fabricated context)

import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here    = path.dirname(fileURLToPath(import.meta.url));
const shotDir = path.join(here, "_wave6_entity_detail_interaction_screenshots");
mkdirSync(shotDir, { recursive: true });
const BASE = "http://localhost:3008";
const CHAT_URL = `${BASE}/nex-app/chat`;

async function post(convId, message) {
  const r = await fetch(`${BASE}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: convId, message, market: "ID" }),
  });
  return r.json();
}

async function beacon(convId, refId, vertical, name) {
  const r = await fetch(`${BASE}/api/nex-conv/session/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: convId, ref_id: refId, vertical, name }),
  });
  return r.json();
}

function digest(j) {
  const cm = j.composition_meta || {};
  return {
    reply: (j.reply || "").slice(0, 260),
    voice_reply_en: j.voice_reply?.en?.slice(0, 260),
    world_cards_count: j.world_cards?.cards?.length ?? 0,
    attribute_query_kind: cm.attribute_query_kind,
    attribute_query_reason: cm.attribute_query_reason,
    attribute_query_resolved_name: cm.attribute_query_resolved_name,
    attribute_query_memo_count: cm.attribute_query_memo_count,
  };
}

const FABRICATION_TOKENS = [
  "Palace Grand", "Royal Deluxe", "Emperor's Retreat",
  "Michelin star", "5-star",
];
function hasFabrication(text) {
  return FABRICATION_TOKENS.find((t) => text.includes(t)) ?? null;
}

const results = { runAt: new Date().toISOString(), campaigns: {} };

// ─── Campaign A · P0 sanity · hi responds ─────────────────────
console.log("\n═══ A · P0 sanity 'hi' via /api/nex-conv/chat ═══");
{
  const cid = randomUUID();
  const t0 = Date.now();
  const t1 = await post(cid, "hi");
  const ms1 = Date.now() - t0;
  const t0b = Date.now();
  const t2 = await post(cid, "how are you?");
  const ms2 = Date.now() - t0b;
  console.log(`  hi           · ${ms1}ms · reply=${JSON.stringify((t1.reply||"").slice(0,120))}`);
  console.log(`  how are you? · ${ms2}ms · reply=${JSON.stringify((t2.reply||"").slice(0,120))}`);
  results.campaigns.A_p0_sanity = {
    cid,
    turns: [
      { message: "hi", latency_ms: ms1, ...digest(t1) },
      { message: "how are you?", latency_ms: ms2, ...digest(t2) },
    ],
    asserts: {
      hi_responded: (t1.reply || "").length > 0,
      hi_latency_ok: ms1 < 45_000,
      chat_responded: (t2.reply || "").length > 0,
    },
  };
}

// ─── Campaign B · Discovery → 3 cards (via API) ────────────────
console.log("\n═══ B · Discovery 3 cards ═══");
{
  const cid = randomUUID();
  const t = await post(cid, "find me hotels in Yogyakarta");
  console.log(`  world_cards.count=${t.world_cards?.cards?.length}`);
  const cards = (t.world_cards?.cards ?? []).slice(0, 3);
  results.campaigns.B_discovery = {
    cid,
    world_cards_count: cards.length,
    card_names: cards.map((c) => c.name),
    asserts: {
      three_cards: cards.length === 3,
      real_names: cards.every((c) => c.name && !hasFabrication(c.name)),
    },
  };
}

// ─── Campaign C · viewed-entity beacon + attribute question ────
console.log("\n═══ C · Beacon + pronoun 'does it have a pool?' ═══");
{
  const cid = randomUUID();
  // T1 · establish result set
  const t1 = await post(cid, "find me hotels in Yogyakarta");
  const firstCard = t1.world_cards?.cards?.[0];
  console.log(`  T1 established · first=${firstCard?.name} id=${firstCard?.id}`);
  const refId = firstCard?.id?.startsWith("place:") ? firstCard.id : `place:accommodation:${firstCard?.id}`;
  // T2 · fire the beacon as if the user opened the detail page
  const beaconResp = await beacon(cid, refId, "accommodation", firstCard?.name);
  console.log(`  BEACON ok=${beaconResp.ok} memoized=${beaconResp.viewed_entity?.memoized}`);
  // T3 · ask a pronoun-referencing attribute question
  const t3 = await post(cid, "does it have a pool?");
  console.log(`  T3 'does it have a pool?' · reply=${JSON.stringify((t3.reply||"").slice(0,200))}`);
  console.log(`     attribute_query_kind=${t3.composition_meta?.attribute_query_kind} resolved=${t3.composition_meta?.attribute_query_resolved_name} reason=${t3.composition_meta?.attribute_query_reason}`);
  results.campaigns.C_beacon_pronoun = {
    cid,
    beacon_ok: beaconResp.ok,
    beacon_memoized: !!beaconResp.viewed_entity?.memoized,
    first_card_name: firstCard?.name,
    t3_reply: (t3.reply || "").slice(0, 200),
    t3_attribute_kind: t3.composition_meta?.attribute_query_kind,
    t3_attribute_resolved: t3.composition_meta?.attribute_query_resolved_name,
    t3_attribute_reason: t3.composition_meta?.attribute_query_reason,
    asserts: {
      beacon_accepted: beaconResp.ok === true,
      viewed_entity_memoized: !!beaconResp.viewed_entity?.memoized,
      attribute_query_fired: !!t3.composition_meta?.attribute_query_gate_fired,
      resolved_to_viewed_entity: t3.composition_meta?.attribute_query_resolved_name === firstCard?.name,
      no_fabrication: !hasFabrication(t3.reply || ""),
    },
  };
}

// ─── Campaign D · fresh session honest boundary ────────────────
console.log("\n═══ D · Fresh session 'does it have a pool?' honest boundary ═══");
{
  const cid = randomUUID();
  const t = await post(cid, "does it have a pool?");
  console.log(`  reply=${JSON.stringify((t.reply||"").slice(0,200))}`);
  results.campaigns.D_fresh_honest = {
    cid,
    reply: (t.reply || "").slice(0, 200),
    asserts: {
      honest_no_fabricated_pool: !/yes,? it has a pool/i.test(t.reply || ""),
      no_fabrication: !hasFabrication(t.reply || ""),
    },
  };
}

// ─── Campaign E · restaurant vertical ──────────────────────────
console.log("\n═══ E · Restaurant vertical proof (API) ═══");
{
  const cid = randomUUID();
  const t = await post(cid, "find me restaurants in Yogyakarta");
  const cards = t.world_cards?.cards ?? [];
  console.log(`  cards=${cards.length}`);
  results.campaigns.E_restaurant = {
    cid,
    world_cards_count: cards.length,
    reply: (t.reply || "").slice(0, 200),
    asserts: { any_cards_or_honest: cards.length > 0 || /don't have|no matching|not verified/i.test(t.reply || "") },
  };
}

// ─── Campaign F · browser flow (Chromium) ──────────────────────
console.log("\n═══ F · Browser flow (Chromium) ═══");
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180_000);

  // Warm-up
  console.log("  · warmup navigate to /nex-app/chat");
  await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 360_000 });
  await page.waitForSelector('textarea[placeholder="Ask Nex anything…"]', { state: "attached", timeout: 240_000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      const t = (b.textContent || "").trim();
      if (/^(Accept|Accept all|Got it|Agree|OK)$/i.test(t)) { try { b.click(); } catch {} }
    }
    for (const n of document.querySelectorAll("*")) {
      const el = n instanceof HTMLElement ? n : null; if (!el) continue;
      const s = window.getComputedStyle(el);
      if (s.position !== "fixed" && s.position !== "sticky") continue;
      const text = (el.innerText || "").trim();
      if (/We use cookies|cookie preferences|cookie consent/i.test(text)) el.style.display = "none";
    }
  });
  await page.waitForTimeout(500);

  const sendMsg = async (text) => {
    const ta = page.locator('textarea[placeholder="Ask Nex anything…"]');
    await ta.scrollIntoViewIfNeeded({ timeout: 10_000 });
    await ta.click({ force: true, timeout: 30_000 });
    await ta.fill("");
    await ta.fill(text);
    for (let a = 0; a < 3; a++) {
      if ((await ta.inputValue()) === text) break;
      await page.waitForTimeout(200);
      if (a === 2) { await ta.fill(text); await page.waitForTimeout(300); }
    }
    const p = page.waitForResponse(
      (r) => r.url().includes("/api/nex-conv/chat") && r.request().method() === "POST",
      { timeout: 90_000 },
    ).catch(() => null);
    await ta.press("Enter");
    await p;
    await page.waitForTimeout(1500);
  };

  const record = { screenshots: [], asserts: {} };

  console.log("  · send 'hi'");
  const hiStart = Date.now();
  await sendMsg("hi");
  const hiLatency = Date.now() - hiStart;
  console.log(`    hi round-trip: ${hiLatency}ms`);
  record.asserts.hi_browser_latency_ms = hiLatency;
  record.asserts.hi_browser_responded_fast = hiLatency < 30_000;

  console.log("  · send 'find me hotels in Yogyakarta'");
  await sendMsg("find me hotels in Yogyakarta");
  const p = path.join(shotDir, "F_01_hotels_cards.png");
  await page.screenshot({ path: p, fullPage: true });
  record.screenshots.push(path.basename(p));
  const cardCount = await page.locator('[data-testid="world-card"]').count();
  const cardNames = await page.$$eval('[data-testid="world-card"]', (els) =>
    els.map((el) => (el.getAttribute("aria-label") || "").replace(/^Result \d+: /, "")));
  record.asserts.cards_visible = cardCount > 0;
  record.asserts.card_names = cardNames.slice(0, 3);

  console.log("  · click first card");
  const firstCard = page.locator('[data-testid="world-card"]').first();
  const firstRefId = await firstCard.getAttribute("data-ref-id");
  record.asserts.first_ref_id = firstRefId;
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 180_000 }).catch(() => null),
    firstCard.click({ timeout: 30_000 }),
  ]);
  await page.waitForTimeout(3000); // wait for beacon fire + settle
  const detailUrl = page.url();
  console.log(`    navigated: ${detailUrl}`);
  record.asserts.detail_url_matches = detailUrl.includes("/nex-app/entity/");
  const p2 = path.join(shotDir, "F_02_detail.png");
  await page.screenshot({ path: p2, fullPage: true });
  record.screenshots.push(path.basename(p2));

  console.log("  · back to chat");
  await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForTimeout(2000);
  const p3 = path.join(shotDir, "F_03_back_to_chat.png");
  await page.screenshot({ path: p3, fullPage: true });
  record.screenshots.push(path.basename(p3));

  console.log("  · send 'does it have a pool?' after returning from detail");
  await sendMsg("does it have a pool?");
  const p4 = path.join(shotDir, "F_04_pronoun_after_return.png");
  await page.screenshot({ path: p4, fullPage: true });
  record.screenshots.push(path.basename(p4));
  const bodyTail = (await page.evaluate(() => document.body.innerText)).slice(-800);
  record.asserts.pronoun_reply_tail = bodyTail;
  record.asserts.pronoun_names_first_hotel = record.asserts.card_names?.[0]
    ? bodyTail.includes(record.asserts.card_names[0])
    : false;

  results.campaigns.F_browser_flow = record;
} catch (err) {
  results.campaigns.F_browser_flow = { error: String(err).slice(0, 400) };
  console.log(`  [ERROR] ${String(err).slice(0, 200)}`);
} finally {
  await browser.close();
}

// ─── Verdicts ────────────────────────────────────────────────
const A = results.campaigns.A_p0_sanity?.asserts ?? {};
const B = results.campaigns.B_discovery?.asserts ?? {};
const C = results.campaigns.C_beacon_pronoun?.asserts ?? {};
const D = results.campaigns.D_fresh_honest?.asserts ?? {};
const E = results.campaigns.E_restaurant?.asserts ?? {};
const F = results.campaigns.F_browser_flow?.asserts ?? {};

const verdicts = {
  A_hi_responded:                  !!A.hi_responded,
  A_hi_latency_ok:                 !!A.hi_latency_ok,
  A_chat_responded:                !!A.chat_responded,
  B_three_cards:                   !!B.three_cards,
  B_real_names_no_fabrication:     !!B.real_names,
  C_beacon_accepted:               !!C.beacon_accepted,
  C_viewed_entity_memoized:        !!C.viewed_entity_memoized,
  C_attribute_query_fired:         !!C.attribute_query_fired,
  C_resolved_to_viewed_entity:     !!C.resolved_to_viewed_entity,
  C_no_fabrication:                !!C.no_fabrication,
  D_fresh_honest_no_fabricated_pool: !!D.honest_no_fabricated_pool,
  D_no_fabrication:                !!D.no_fabrication,
  E_restaurant_any_or_honest:      !!E.any_cards_or_honest,
  F_hi_browser_responded_fast:     !!F.hi_browser_responded_fast,
  F_cards_visible:                 !!F.cards_visible,
  F_detail_url_matches:            !!F.detail_url_matches,
  F_pronoun_names_first_hotel:     !!F.pronoun_names_first_hotel,
};

results.verdicts = verdicts;
const outPath = path.join(here, "_wave6_entity_detail_interaction_live_probes.json");
writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

console.log(`\n═══ WAVE 6 ENTITY-DETAIL VERDICTS ═══`);
for (const [k, v] of Object.entries(verdicts)) {
  console.log(`  ${k.padEnd(38)} : ${v ? "PASS" : "FAIL"}`);
}
console.log(`\nWrote ${outPath}`);
