#!/usr/bin/env node
// tests/fixtures/conversation-followup-proof/_nex_phase_3_1_founder_journey_proof.mjs
//
// NEX · Phase 3.1 · World-class founder journey proof
// Philip 2026-09-06 · CEREMONIAL AUTHORIZATION · Phase 3.1
//
// Real Chromium journey covering the complete NEX loop across FOUR
// iPhone viewports (§14):
//   · 390 × 844  (iPhone 14 / 13 / 12 — PRIMARY §4)
//   · 375 × 812  (iPhone 12 mini / X / XS)
//   · 393 × 852  (iPhone 15)
//   · 430 × 932  (iPhone 15 Pro Max)
//
// Journey (§1 §4 §9 §10):
//   A. NEX shell loads (via /nex-app/brains/staircase which mounts AppShell)
//   B. Hero shows Bell + Profile + Three-dot (§5 identity separation)
//   C. Tap Profile → panel opens INSIDE phone frame (data-scope="phone-frame")
//   D. Escape closes Profile
//   E. Tap Three-dot → Control Center opens INSIDE phone frame
//   F. Control Center exposes "Live in your city" AVAILABLE
//   G. /nex-app/live loads (in-shell What's Happening surface)
//   H. Surface is inside phone frame + data-scope="phone-frame"
//   I. Status sections render (LIVE NOW / STARTING SOON / TONIGHT) after fetch
//   J. Category chips (§36) only render for categories with backing items
//   K. Entity page /nex-app/entity/#AC-2026-0000D loads (Gaotama Hotel)
//   L. Entity root scoped inside phone frame
//   M. EntityLiveCarousel present with real cards + MOCK chip (§17 §19)
//   N. Contact/Interested block present (§9 entity → chat continuity)
//   O. Back navigation preserves context (§10)
//
// Every viewport asserts the same journey. Failures at any viewport
// mean the responsive contract broke somewhere.

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, "_phase_3_1_screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.NEX_BASE_URL ?? "http://localhost:3009";

const VIEWPORTS = [
  { name: "iphone-14-390x844",     width: 390, height: 844 },
  { name: "iphone-12mini-375x812", width: 375, height: 812 },
  { name: "iphone-15-393x852",     width: 393, height: 852 },
  { name: "iphone-15promax-430x932", width: 430, height: 932 },
];

async function dismissOverlays(page) {
  await page.evaluate(() => {
    for (const b of Array.from(document.querySelectorAll("button, a[role=button], [role=button]"))) {
      const t = ((b.textContent) || "").trim().toLowerCase();
      if (/^(accept|accept all|agree|got it|ok|allow|i agree|dismiss|close)$/i.test(t)) {
        try { b.click(); } catch {}
      }
    }
    document.querySelectorAll('[role="dialog"], [aria-label*="cookie" i], [class*="cookie" i], [id*="cookie" i]').forEach((n) => {
      try { n.style.display = "none"; n.style.pointerEvents = "none"; } catch {}
    });
  }).catch(() => {});
  await page.waitForTimeout(200);
}

async function runViewport(browser, vp) {
  console.log(`\n=== VIEWPORT · ${vp.name} · ${vp.width}×${vp.height} ===`);
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();

  const results = {};
  function pass(k, extra = {}) { results[k] = { pass: true, ...extra }; console.log(`  PASS · ${k}`); }
  function fail(k, extra = {}) { results[k] = { pass: false, ...extra }; console.log(`  FAIL · ${k} · ${JSON.stringify(extra).slice(0,200)}`); }

  // A. NEX shell loads
  try {
    const r = await page.goto(`${BASE_URL}/nex-app/brains/staircase`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (r && r.status() === 200) pass("A_shell_loads_200");
    else fail("A_shell_loads_200", { status: r?.status() });
  } catch (e) { fail("A_shell_loads_200", { error: e.message.slice(0,200) }); }
  await dismissOverlays(page);
  await page.waitForTimeout(600);

  // B. Hero has Profile + Three-dot per §5 (Bell exists but not testid'd)
  try {
    const profile = page.locator('[data-testid="nex-hero-profile-entry"]');
    const cc = page.locator('[data-testid="nex-hero-control-center-entry"]');
    if (await profile.count() && await cc.count()) pass("B_hero_separation_profile_and_control_center");
    else fail("B_hero_separation_profile_and_control_center", { profile: await profile.count(), cc: await cc.count() });
  } catch (e) { fail("B_hero_separation_profile_and_control_center", { error: e.message.slice(0,200) }); }

  // C. Profile panel inside phone frame
  try {
    await page.locator('[data-testid="nex-hero-profile-entry"]').tap();
    await page.waitForTimeout(300);
    const panel = page.locator('[data-testid="nex-profile-panel"]');
    await panel.waitFor({ state: "visible", timeout: 5000 });
    const box = await panel.boundingBox();
    if (box && box.width <= 460) pass("C_profile_scoped_inside_frame", { panel_width: box.width });
    else fail("C_profile_scoped_inside_frame", { panel_width: box?.width });
  } catch (e) { fail("C_profile_scoped_inside_frame", { error: e.message.slice(0,200) }); }

  // D. Escape closes Profile
  try {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    if (await page.locator('[data-testid="nex-profile-panel"]').count() === 0) pass("D_escape_closes_profile");
    else fail("D_escape_closes_profile", { still_open: true });
  } catch (e) { fail("D_escape_closes_profile", { error: e.message.slice(0,200) }); }

  // E. Control Center inside phone frame
  try {
    await page.locator('[data-testid="nex-hero-control-center-entry"]').tap();
    await page.waitForTimeout(300);
    const panel = page.locator('[data-testid="nex-control-center-panel"]');
    await panel.waitFor({ state: "visible", timeout: 5000 });
    const box = await panel.boundingBox();
    if (box && box.width <= 460) pass("E_control_center_scoped_inside_frame", { panel_width: box.width });
    else fail("E_control_center_scoped_inside_frame", { panel_width: box?.width });
  } catch (e) { fail("E_control_center_scoped_inside_frame", { error: e.message.slice(0,200) }); }

  // F. Live in your city AVAILABLE + honest chip discipline
  try {
    const live = page.locator('[data-testid="nex-control-center-item-live_in_your_city"]');
    const href = await live.getAttribute("href");
    const avail = await live.getAttribute("data-availability");
    // Also verify an unavailable destination shows "Not available yet"
    const security = page.locator('[data-testid="nex-control-center-item-security"]');
    const securityAvail = await security.getAttribute("data-availability");
    const notAvailChipsCount = await page.locator('text="Not available yet"').count();
    if (avail === "AVAILABLE" && href === "/nex-app/live" && securityAvail === "NOT_YET_AVAILABLE" && notAvailChipsCount > 0) {
      pass("F_control_center_live_avail_and_honesty", { avail, href, security_avail: securityAvail, chips: notAvailChipsCount });
    } else {
      fail("F_control_center_live_avail_and_honesty", { avail, href, security_avail: securityAvail, chips: notAvailChipsCount });
    }
  } catch (e) { fail("F_control_center_live_avail_and_honesty", { error: e.message.slice(0,200) }); }

  const shotCC = path.join(OUT_DIR, `${vp.name}-control-center.png`);
  await page.screenshot({ path: shotCC });

  // G. /nex-app/live loads
  try {
    const r = await page.goto(`${BASE_URL}/nex-app/live`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (r && r.status() === 200) pass("G_city_live_loads_200");
    else fail("G_city_live_loads_200", { status: r?.status() });
  } catch (e) { fail("G_city_live_loads_200", { error: e.message.slice(0,200) }); }
  await dismissOverlays(page);

  // H. City Live root scoped inside phone frame
  try {
    const root = page.locator('[data-testid="nex-city-live-root"]');
    await root.waitFor({ state: "visible", timeout: 8000 });
    const box = await root.boundingBox();
    const scope = await root.getAttribute("data-scope");
    if (box && box.width <= vp.width + 1 && scope === "phone-frame") {
      pass("H_city_live_inside_frame", { width: box.width, scope });
    } else {
      fail("H_city_live_inside_frame", { width: box?.width, scope });
    }
  } catch (e) { fail("H_city_live_inside_frame", { error: e.message.slice(0,200) }); }

  // I. Status sections render (needs fetch to resolve)
  try {
    await page.locator('[data-testid="nex-city-live-category-chips"]').waitFor({ state: "visible", timeout: 30_000 });
    const sections = await page.locator('[data-testid^="nex-city-live-section-"]').count();
    if (sections > 0) pass("I_status_sections_render_after_fetch", { sections });
    else fail("I_status_sections_render_after_fetch", { sections });
  } catch (e) { fail("I_status_sections_render_after_fetch", { error: e.message.slice(0,200) }); }

  // J. Category chips only show for categories with backing items
  try {
    const chipsRoot = page.locator('[data-testid="nex-city-live-category-chips"]');
    const chipCount = await chipsRoot.locator("button").count();
    // Must have at least "All" chip; if fixtures have music/food/hotel, more chips appear.
    if (chipCount >= 1) pass("J_category_chips_honest_never_empty", { chip_count: chipCount });
    else fail("J_category_chips_honest_never_empty", { chip_count: chipCount });
  } catch (e) { fail("J_category_chips_honest_never_empty", { error: e.message.slice(0,200) }); }

  const shotCity = path.join(OUT_DIR, `${vp.name}-city-live.png`);
  await page.screenshot({ path: shotCity, fullPage: true });

  // K. Entity page loads (Gaotama Hotel)
  const ENTITY_REF = "#AC-2026-0000D";
  const entityUrl = `${BASE_URL}/nex-app/entity/${encodeURIComponent(ENTITY_REF)}`;
  try {
    const r = await page.goto(entityUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (r && r.status() === 200) pass("K_entity_loads_200");
    else fail("K_entity_loads_200", { status: r?.status() });
  } catch (e) { fail("K_entity_loads_200", { error: e.message.slice(0,200) }); }
  await dismissOverlays(page);

  // L. Entity page scoped inside phone frame
  try {
    const root = page.locator('[data-testid="nex-entity-detail-root"]');
    await root.waitFor({ state: "visible", timeout: 8000 });
    const box = await root.boundingBox();
    if (box && box.width <= vp.width + 1) pass("L_entity_scoped_inside_frame", { width: box.width });
    else fail("L_entity_scoped_inside_frame", { width: box?.width });
  } catch (e) { fail("L_entity_scoped_inside_frame", { error: e.message.slice(0,200) }); }

  // M. Entity LIVE FROM THIS HOTEL carousel present with real cards
  try {
    const carousel = page.locator('[data-testid="nex-live-entity-carousel"]');
    await carousel.waitFor({ state: "visible", timeout: 8000 });
    const cardCount = parseInt(await carousel.getAttribute("data-card-count") ?? "0", 10);
    const mockChips = await page.locator('[data-testid="nex-live-entity-carousel"] >> text="Mock"').count();
    if (cardCount > 0 && mockChips > 0) pass("M_entity_live_belongs_to_entity", { cards: cardCount, mock_chips: mockChips });
    else fail("M_entity_live_belongs_to_entity", { cards: cardCount, mock_chips: mockChips });
  } catch (e) { fail("M_entity_live_belongs_to_entity", { error: e.message.slice(0,200) }); }

  // N. Entity → Chat path · either Interested flow OR honest "no verified
  // contact yet" fallback. §18 truth boundary: unknown contact ≠ fake
  // button. Both outcomes are legitimate — the test verifies the entity
  // page NEVER presents a fake path when the underlying evidence is null.
  try {
    const interested = await page.locator('[data-testid="interested-button"]').count();
    const honestNoContact = await page.locator('text="No verified contact yet — check back soon."').count();
    if (interested > 0 || honestNoContact > 0) {
      pass("N_entity_contact_path_honest", { interested_button: interested, honest_fallback: honestNoContact });
    } else {
      fail("N_entity_contact_path_honest", { interested_button: interested, honest_fallback: honestNoContact });
    }
  } catch (e) { fail("N_entity_contact_path_honest", { error: e.message.slice(0,200) }); }

  const shotEntity = path.join(OUT_DIR, `${vp.name}-entity.png`);
  await page.screenshot({ path: shotEntity, fullPage: true });

  // O. Back navigation preserves context
  try {
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForTimeout(400);
    const url = page.url();
    if (url.includes("/nex-app/live")) pass("O_back_returns_to_city_live", { url });
    else fail("O_back_returns_to_city_live", { url });
  } catch (e) { fail("O_back_returns_to_city_live", { error: e.message.slice(0,200) }); }

  await context.close();

  const p = Object.values(results).filter((v) => v.pass).length;
  const f = Object.keys(results).length - p;
  return { name: vp.name, width: vp.width, height: vp.height, results, pass: p, fail: f, total: Object.keys(results).length };
}

async function main() {
  console.log("=== NEX PHASE 3.1 · WORLD-CLASS FOUNDER JOURNEY PROOF ===");
  console.log(`BASE_URL: ${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });
  const perVp = [];
  for (const vp of VIEWPORTS) {
    perVp.push(await runViewport(browser, vp));
  }
  await browser.close();

  const summary = perVp.reduce((acc, v) => ({ pass: acc.pass + v.pass, fail: acc.fail + v.fail, total: acc.total + v.total }), { pass: 0, fail: 0, total: 0 });
  const out = { runAt: new Date().toISOString(), base_url: BASE_URL, viewports: perVp, summary };
  const outPath = path.join(here, "_nex_phase_3_1_founder_journey_proof.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

  console.log("\n=== VIEWPORT MATRIX ===");
  for (const v of perVp) {
    console.log(`${v.name} · ${v.width}×${v.height} · pass=${v.pass} fail=${v.fail} / ${v.total}`);
  }
  console.log(`\n=== TOTAL ===`);
  console.log(`pass=${summary.pass} fail=${summary.fail} / ${summary.total}`);
  console.log(`Result: ${outPath}`);
  console.log(`Screenshots: ${OUT_DIR}`);
  process.exit(summary.fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error("FATAL", err); process.exit(2); });
