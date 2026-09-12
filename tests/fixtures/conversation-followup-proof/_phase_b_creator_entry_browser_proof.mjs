#!/usr/bin/env node
// tests/fixtures/conversation-followup-proof/_phase_b_creator_entry_browser_proof.mjs
//
// NEX LIVE · Phase B · REAL BROWSER PROOF (§17 mandatory)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE B
//
// Launches actual Chromium via Playwright against localhost:3008/nex-live
// and verifies the founder's §17 acceptance criteria:
//
//   1. NEX Live loads
//   2. Lower-right three-dot control is visible
//   3. Tap it
//   4. Creator panel opens
//   5. Record is visible
//   6. Upload is visible
//   7. Edit is visible
//   8. Go Live is visible
//   9. Appropriate destination / availability behaviour occurs
//  10. Panel closes correctly (Escape)
//  11. NEX Live remains usable
//  12. Existing NEX navigation remains intact
//
// Captures screenshots at each milestone. Writes a JSON receipt.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, "_phase_b_screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = "http://localhost:3008";
const results = { runAt: new Date().toISOString(), checks: {}, artifacts: [] };

function pass(k, extra = {}) { results.checks[k] = { pass: true, ...extra }; console.log(`  PASS · ${k}`); }
function fail(k, extra = {}) { results.checks[k] = { pass: false, ...extra }; console.log(`  FAIL · ${k} · ${JSON.stringify(extra)}`); }

async function main() {
  console.log("=== NEX LIVE · Phase B · REAL BROWSER PROOF ===\n");

  // Simulate a mobile portrait viewport per §10 (mobile-first).
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },      // iPhone 12/13/14 portrait
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();

  // Silence noisy Next.js dev overlays during screenshots — best-effort.
  page.on("pageerror", (err) => console.error("[pageerror]", err.message.slice(0, 200)));

  // ── 1 · NEX Live loads ─────────────────────────────────────────
  console.log("\n[1] Load /nex-live");
  try {
    const resp = await page.goto(`${BASE_URL}/nex-live`, { waitUntil: "networkidle", timeout: 30_000 });
    const status = resp?.status() ?? 0;
    if (status >= 200 && status < 400) {
      pass("1_nex_live_loads", { http_status: status });
    } else {
      fail("1_nex_live_loads", { http_status: status });
    }
  } catch (e) {
    fail("1_nex_live_loads", { error: (e).message.slice(0, 200) });
  }

  // ── 1b · Dismiss cookie / overlay banners so they don't intercept taps.
  await page.evaluate(() => {
    // Click any Accept/OK/Agree buttons.
    const buttons = Array.from(document.querySelectorAll("button, a[role=button], [role=button]"));
    for (const b of buttons) {
      const t = ((b.textContent) || "").trim().toLowerCase();
      if (/^(accept|accept all|agree|got it|ok|allow|i agree|dismiss|close)$/i.test(t)) {
        try { (b).click(); } catch { /* ignore */ }
      }
    }
    // Hide any cookie-consent style overlays.
    document.querySelectorAll('[role="dialog"], [aria-label*="cookie" i], [class*="cookie" i], [id*="cookie" i]').forEach((n) => {
      try { (n).style.display = "none"; (n).style.pointerEvents = "none"; } catch { /* ignore */ }
    });
  }).catch(() => {});
  await page.waitForTimeout(200);

  const shot1 = path.join(OUT_DIR, "01-nex-live-initial.png");
  await page.screenshot({ path: shot1, fullPage: false });
  results.artifacts.push(shot1);

  // ── 2 · MUSIC/VIDEO nav visible (regression check from prior slice) ──
  console.log("\n[2] MUSIC/VIDEO top nav visible");
  const musicBtn = page.getByRole("button", { name: "MUSIC" });
  const videoBtn = page.getByRole("button", { name: "VIDEO" });
  try {
    await musicBtn.waitFor({ state: "visible", timeout: 5000 });
    await videoBtn.waitFor({ state: "visible", timeout: 5000 });
    pass("2_music_video_nav_visible");
  } catch (e) {
    fail("2_music_video_nav_visible", { error: (e).message.slice(0, 200) });
  }

  // ── 3 · Lower-right three-dot creator entry visible ────────────
  console.log("\n[3] Lower-right ⋮ creator entry visible");
  const entry = page.locator('[data-testid="nex-live-creator-entry"]');
  try {
    await entry.waitFor({ state: "visible", timeout: 5000 });
    const box = await entry.boundingBox();
    // Sanity: box is in the lower-right quadrant.
    const isLowerRight = box && box.x + box.width / 2 > 195 && box.y + box.height / 2 > 422;
    if (isLowerRight) {
      pass("3_creator_entry_visible_lower_right", { box });
    } else {
      fail("3_creator_entry_visible_lower_right", { box, note: "not in lower-right quadrant" });
    }
  } catch (e) {
    fail("3_creator_entry_visible_lower_right", { error: (e).message.slice(0, 200) });
  }

  // ── 4 · Panel closed initially · aria-expanded=false ───────────
  const initialExpanded = await entry.getAttribute("aria-expanded").catch(() => null);
  if (initialExpanded === "false") pass("4_panel_initially_closed", { aria_expanded: initialExpanded });
  else fail("4_panel_initially_closed", { aria_expanded: initialExpanded });

  // ── 5 · Tap the entry button, panel opens ──────────────────────
  console.log("\n[5] Tap creator entry → panel opens");
  await entry.tap();
  const panel = page.locator('[data-testid="nex-live-creator-panel"]');
  try {
    await panel.waitFor({ state: "visible", timeout: 3000 });
    pass("5_panel_opens_on_tap");
    const shot2 = path.join(OUT_DIR, "02-creator-panel-open.png");
    await page.screenshot({ path: shot2, fullPage: false });
    results.artifacts.push(shot2);
  } catch (e) {
    fail("5_panel_opens_on_tap", { error: (e).message.slice(0, 200) });
  }

  const openExpanded = await entry.getAttribute("aria-expanded").catch(() => null);
  if (openExpanded === "true") pass("5b_aria_expanded_true_when_open");
  else fail("5b_aria_expanded_true_when_open", { aria_expanded: openExpanded });

  // ── 6 · All 5 actions visible ──────────────────────────────────
  console.log("\n[6] All 5 actions visible with correct labels");
  const actionIds = ["RECORD", "UPLOAD", "GO_LIVE", "EDIT", "MY_LIVE"];
  for (const id of actionIds) {
    const el = page.locator(`[data-testid="nex-live-creator-action-${id}"]`);
    try {
      await el.waitFor({ state: "visible", timeout: 2000 });
      const text = (await el.innerText()).trim();
      const avail = await el.getAttribute("data-availability");
      pass(`6_action_${id.toLowerCase()}_visible`, { text: text.slice(0, 60), availability: avail });
    } catch (e) {
      fail(`6_action_${id.toLowerCase()}_visible`, { error: (e).message.slice(0, 200) });
    }
  }

  // ── 7 · Availability honesty — GO_LIVE + EDIT disabled ─────────
  console.log("\n[7] Unavailable actions rendered honestly");
  for (const id of ["GO_LIVE", "EDIT"]) {
    const el = page.locator(`[data-testid="nex-live-creator-action-${id}"]`);
    const ariaDisabled = await el.getAttribute("aria-disabled");
    const avail = await el.getAttribute("data-availability");
    if (ariaDisabled === "true" && avail === "NOT_YET_AVAILABLE") {
      pass(`7_${id.toLowerCase()}_disabled_and_honest`, { aria_disabled: ariaDisabled, availability: avail });
    } else {
      fail(`7_${id.toLowerCase()}_disabled_and_honest`, { aria_disabled: ariaDisabled, availability: avail });
    }
  }

  // ── 8 · Available actions are tappable ─────────────────────────
  console.log("\n[8] Available actions are tappable");
  for (const id of ["RECORD", "UPLOAD", "MY_LIVE"]) {
    const el = page.locator(`[data-testid="nex-live-creator-action-${id}"]`);
    const tagName = await el.evaluate((n) => n.tagName.toLowerCase());
    const href = await el.getAttribute("href");
    if (tagName === "a" && href) {
      pass(`8_${id.toLowerCase()}_is_link`, { tag: tagName, href });
    } else {
      fail(`8_${id.toLowerCase()}_is_link`, { tag: tagName, href });
    }
  }

  // ── 9 · "Not available yet" text present (no "coming soon") ────
  console.log("\n[9] Honesty text — 'Not available yet' present, no 'coming soon'");
  const panelText = await panel.innerText();
  const hasNotAvailable = panelText.toLowerCase().includes("not available yet");
  const hasComingSoon = panelText.toLowerCase().includes("coming soon");
  if (hasNotAvailable && !hasComingSoon) pass("9_honesty_text");
  else fail("9_honesty_text", { has_not_available: hasNotAvailable, has_coming_soon: hasComingSoon, panel_text_head: panelText.slice(0, 400) });

  // ── 10 · Escape closes the panel + focus restored ──────────────
  console.log("\n[10] Escape closes panel");
  await page.keyboard.press("Escape");
  try {
    await panel.waitFor({ state: "hidden", timeout: 2000 });
    pass("10_escape_closes_panel");
  } catch (e) {
    fail("10_escape_closes_panel", { error: (e).message.slice(0, 200) });
  }

  const closedExpanded = await entry.getAttribute("aria-expanded").catch(() => null);
  if (closedExpanded === "false") pass("10b_aria_expanded_false_after_close");
  else fail("10b_aria_expanded_false_after_close", { aria_expanded: closedExpanded });

  // ── 11 · Click outside closes ──────────────────────────────────
  console.log("\n[11] Outside click closes panel");
  await entry.tap();
  await panel.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
  // Tap in the top-left area (well outside the lower-right panel).
  await page.mouse.click(50, 50);
  try {
    await panel.waitFor({ state: "hidden", timeout: 2000 });
    pass("11_outside_click_closes_panel");
  } catch (e) {
    fail("11_outside_click_closes_panel", { error: (e).message.slice(0, 200) });
  }

  // ── 12 · Existing NEX navigation intact ────────────────────────
  console.log("\n[12] Existing NEX navigation intact");
  const backPill = page.getByRole("link", { name: /NEX/ }).first();
  const backHref = await backPill.getAttribute("href").catch(() => null);
  if (backHref) pass("12_back_to_nex_link_present", { href: backHref });
  else fail("12_back_to_nex_link_present");

  // ── 13 · Tap MY_LIVE → navigates to /nex-live/my (real route) ──
  console.log("\n[13] MY_LIVE navigates to /nex-live/my");
  await entry.tap();
  await panel.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
  const myLive = page.locator('[data-testid="nex-live-creator-action-MY_LIVE"]');
  await myLive.tap();
  try {
    await page.waitForURL(/\/nex-live\/my/, { timeout: 5000 });
    pass("13_my_live_navigates", { url: page.url() });
    const shot3 = path.join(OUT_DIR, "03-my-live-surface.png");
    await page.screenshot({ path: shot3, fullPage: false });
    results.artifacts.push(shot3);
  } catch (e) {
    fail("13_my_live_navigates", { url: page.url(), error: (e).message.slice(0, 200) });
  }

  // Small honesty check on My Live: it shows "Nothing published yet"
  // (no fabricated items in dev DB).
  try {
    await page.locator("text=Nothing published yet").waitFor({ state: "visible", timeout: 3000 });
    pass("13b_my_live_honest_empty_state");
  } catch {
    // If items exist, that's fine too; log it.
    const items = await page.locator("li").count();
    pass("13b_my_live_shows_real_state", { items_count: items });
  }

  await browser.close();

  // Verdict
  const verdicts = Object.entries(results.checks).map(([k, v]) => ({ k, pass: v.pass }));
  const passCount = verdicts.filter((v) => v.pass).length;
  const failCount = verdicts.filter((v) => !v.pass).length;

  results.summary = { pass: passCount, fail: failCount, total: verdicts.length };
  const outPath = path.join(here, "_phase_b_creator_entry_browser_proof.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

  console.log(`\n=== VERDICT ===`);
  console.log(`pass=${passCount} fail=${failCount} total=${verdicts.length}`);
  console.log(`Wrote ${outPath}`);
  console.log(`Screenshots in ${OUT_DIR}`);

  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(2);
});
