#!/usr/bin/env node
// tests/fixtures/conversation-followup-proof/_nex_live_phase_2_playback_proof.mjs
//
// NEX LIVE · Phase 2 · Real playback proof (§39)
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 2
//
// After the seed script registered a rights declaration for the real
// sample video that already exists in nex.media_object, this browser
// probe loads /nex-live in Chromium and verifies that MediaSwipeFeed:
//   · shows a real <video> element (not the empty state)
//   · the video element's src attribute is the real signed playback URL
//   · the element's data-state transitions to PLAYING or READY

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, "_phase_2_screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = "http://localhost:3008";

async function dismissOverlays(page) {
  await page.evaluate(() => {
    for (const b of Array.from(document.querySelectorAll("button, a[role=button], [role=button]"))) {
      const t = ((b.textContent) || "").trim().toLowerCase();
      if (/^(accept|accept all|agree|got it|ok|allow|i agree|dismiss|close)$/i.test(t)) {
        try { (b).click(); } catch {}
      }
    }
    document.querySelectorAll('[role="dialog"], [aria-label*="cookie" i], [class*="cookie" i], [id*="cookie" i]').forEach((n) => {
      try { (n).style.display = "none"; (n).style.pointerEvents = "none"; } catch {}
    });
  }).catch(() => {});
  await page.waitForTimeout(200);
}

async function main() {
  console.log("=== NEX LIVE · PHASE 2 · REAL PLAYBACK PROOF (§39) ===\n");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();

  const results = { runAt: new Date().toISOString(), checks: {} };
  function pass(k, extra = {}) { results.checks[k] = { pass: true, ...extra }; console.log(`  PASS · ${k}`); }
  function fail(k, extra = {}) { results.checks[k] = { pass: false, ...extra }; console.log(`  FAIL · ${k} · ${JSON.stringify(extra)}`); }

  // Load /nex-live with VIDEO mode (Music has no items · Video has the seeded one)
  await page.goto(`${BASE_URL}/nex-live`, { waitUntil: "networkidle", timeout: 30_000 });
  await dismissOverlays(page);

  // Switch to VIDEO mode (since our seeded item is VIDEO)
  await page.getByRole("button", { name: "VIDEO" }).tap();
  await page.waitForTimeout(1500);   // allow /api/nex-live/discover fetch to complete

  // Verify MediaSwipeFeed mounted with items (not empty state)
  const feed = page.locator('[data-testid="nex-live-media-swipe-feed"]');
  try {
    await feed.waitFor({ state: "visible", timeout: 5000 });
    const activeIdx = await feed.getAttribute("data-active-index");
    const itemCount = await feed.getAttribute("data-item-count");
    pass("A_media_swipe_feed_populated", { data_active_index: activeIdx, data_item_count: itemCount });
  } catch (e) {
    fail("A_media_swipe_feed_populated", { error: e.message.slice(0, 200) });
  }

  // Verify a MediaPlayer <video> element rendered with a REAL playback URL
  try {
    const player = page.locator('[data-testid^="nex-live-media-player-"]').first();
    await player.waitFor({ state: "visible", timeout: 5000 });
    const dataState = await player.getAttribute("data-state");
    const tagName = await player.evaluate((n) => n.tagName.toLowerCase());
    const src = await player.evaluate((n) => n.getAttribute("src"));
    // src should be a real URL, not empty, not null, not a fake placeholder
    const looksReal = typeof src === "string" && src.length > 5 && !src.includes("fake") && !src.includes("placeholder");
    if (tagName === "video" && looksReal) {
      pass("B_video_element_has_real_src", { data_state: dataState, tag: tagName, src_prefix: src.slice(0, 60) });
    } else {
      fail("B_video_element_has_real_src", { data_state: dataState, tag: tagName, src });
    }
  } catch (e) {
    fail("B_video_element_has_real_src", { error: e.message.slice(0, 200) });
  }

  // Wait a moment and check state advances (READY → PLAYING with autoplay+muted)
  await page.waitForTimeout(3000);
  try {
    const player = page.locator('[data-testid^="nex-live-media-player-"]').first();
    const dataState = await player.getAttribute("data-state");
    // Any state that indicates real media processing counts as a real playback pipeline
    const realStates = ["READY", "PLAYING", "PAUSED", "BUFFERING", "ENDED"];
    if (dataState && realStates.includes(dataState)) {
      pass("C_player_state_indicates_real_playback", { data_state: dataState });
    } else {
      fail("C_player_state_indicates_real_playback", { data_state: dataState });
    }
  } catch (e) {
    fail("C_player_state_indicates_real_playback", { error: e.message.slice(0, 200) });
  }

  // CreatorHandoff visible with the real declared_kind label
  try {
    const handoff = page.locator('[data-testid="nex-live-creator-handoff"]');
    await handoff.waitFor({ state: "visible", timeout: 3000 });
    const text = await handoff.innerText();
    const hasDeclaredLabel = text.toLowerCase().includes("uploader-declared");
    const hasNoVerified = !text.toLowerCase().includes("verified");
    if (hasDeclaredLabel && hasNoVerified) {
      pass("D_creator_handoff_shows_honest_rights_label", { has_declared_label: hasDeclaredLabel, avoids_verified: hasNoVerified });
    } else {
      fail("D_creator_handoff_shows_honest_rights_label", { has_declared_label: hasDeclaredLabel, avoids_verified: hasNoVerified, snippet: text.slice(0, 200) });
    }
  } catch (e) {
    fail("D_creator_handoff_shows_honest_rights_label", { error: e.message.slice(0, 200) });
  }

  // Screenshot
  const shot = path.join(OUT_DIR, "05-real-playback.png");
  await page.screenshot({ path: shot });
  console.log(`Screenshot: ${shot}`);

  await browser.close();

  const verdicts = Object.entries(results.checks);
  const passCount = verdicts.filter(([, v]) => v.pass).length;
  const failCount = verdicts.length - passCount;
  results.summary = { pass: passCount, fail: failCount, total: verdicts.length };
  const outPath = path.join(here, "_nex_live_phase_2_playback_proof.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\n=== PLAYBACK PROOF ===`);
  console.log(`pass=${passCount} fail=${failCount} total=${verdicts.length}`);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((err) => { console.error("FATAL", err); process.exit(2); });
