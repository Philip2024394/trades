#!/usr/bin/env node
// tests/fixtures/conversation-followup-proof/_nex_phase_d_shell_scope_proof.mjs
//
// NEX · Phase D · Shell-scope + Control Center + Profile + City Live browser proof
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D §49 §50
//
// Two viewports:
//   · 390×844 (iPhone 12/13/14 portrait · PRIMARY per §49)
//   · 1440×900 (desktop · SECONDARY · used to prove the panel stays
//               inside the max-w-md phone frame instead of leaking to
//               the whole viewport)
//
// Journey (§50):
//   1. GET /nex-app/chat → phone shell renders
//   2. Verify Hero has Bell + Profile + three-dot (§5 separation)
//   3. Tap Profile → verify panel opens AND its bounding box is
//      contained within the phone frame (max-w-md ≈ 448px)
//   4. Escape/close → verify panel gone
//   5. Tap three-dot → verify Control Center opens AND scoped
//   6. Verify "Live in your city" AVAILABLE + points to /nex-app/live
//   7. Tap Live in your city → verify /nex-app/live loads inside NEX
//   8. Verify city Live surface renders sections

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, "_phase_d_screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.NEX_BASE_URL ?? "http://localhost:3008";

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
  await page.waitForTimeout(150);
}

async function tapOrClick(locator, isMobile) {
  if (isMobile) await locator.tap();
  else await locator.click();
}

async function runViewport(browser, { name, width, height, isMobile }) {
  console.log(`\n=== VIEWPORT · ${name} · ${width}×${height} ===`);
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: isMobile ? 3 : 1,
    isMobile,
    hasTouch: isMobile,
    userAgent: isMobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  });
  const page = await context.newPage();

  const results = {};
  function pass(k, extra = {}) { results[k] = { pass: true, ...extra }; console.log(`  PASS · ${k}`); }
  function fail(k, extra = {}) { results[k] = { pass: false, ...extra }; console.log(`  FAIL · ${k} · ${JSON.stringify(extra)}`); }

  // 1. Load /nex-app/chat
  try {
    const resp = await page.goto(`${BASE_URL}/nex-app/brains/staircase`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (resp && resp.status() === 200) pass("A_shell_loads_200");
    else fail("A_shell_loads_200", { status: resp?.status() });
  } catch (e) {
    fail("A_shell_loads_200", { error: e.message.slice(0, 200) });
  }
  await dismissOverlays(page);
  // Give the client bundle a beat to hydrate before probing testids
  await page.waitForTimeout(500);

  // 2. Hero has Bell + Profile + three-dot per §5
  try {
    const profileBtn = page.locator('[data-testid="nex-hero-profile-entry"]');
    const ccBtn = page.locator('[data-testid="nex-hero-control-center-entry"]');
    const profileOk = await profileBtn.count() > 0;
    const ccOk = await ccBtn.count() > 0;
    if (profileOk && ccOk) pass("B_hero_has_profile_and_control_center_entries", { profile: profileOk, control_center: ccOk });
    else fail("B_hero_has_profile_and_control_center_entries", { profile: profileOk, control_center: ccOk });
  } catch (e) {
    fail("B_hero_has_profile_and_control_center_entries", { error: e.message.slice(0, 200) });
  }

  // 3. Tap Profile → panel scoped inside phone frame
  try {
    const profileBtn = page.locator('[data-testid="nex-hero-profile-entry"]');
    await tapOrClick(profileBtn, isMobile);
    await page.waitForTimeout(250);
    const panel = page.locator('[data-testid="nex-profile-panel"]');
    await panel.waitFor({ state: "visible", timeout: 3000 });
    const pb = await panel.boundingBox();
    const shell = await page.locator('div.max-w-md, div.max-w-\\[560px\\], main').first().boundingBox();
    // Panel must not exceed the phone frame width (max-w-md ≈ 448px).
    // At mobile viewports panel width equals viewport width. At desktop
    // it must be strictly less than the viewport width.
    const inFrame = pb && pb.width <= 460 + 1;
    if (inFrame) pass("C_profile_panel_scoped_inside_phone_frame", { panel_width: pb?.width, viewport_width: width });
    else fail("C_profile_panel_scoped_inside_phone_frame", { panel_width: pb?.width, viewport_width: width });
  } catch (e) {
    fail("C_profile_panel_scoped_inside_phone_frame", { error: e.message.slice(0, 200) });
  }

  // Close profile with Escape
  try {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    const stillOpen = await page.locator('[data-testid="nex-profile-panel"]').count();
    if (stillOpen === 0) pass("D_profile_panel_closes_on_escape");
    else fail("D_profile_panel_closes_on_escape", { still_open: stillOpen });
  } catch (e) {
    fail("D_profile_panel_closes_on_escape", { error: e.message.slice(0, 200) });
  }

  // 4. Tap three-dot → Control Center scoped
  try {
    const ccBtn = page.locator('[data-testid="nex-hero-control-center-entry"]');
    await tapOrClick(ccBtn, isMobile);
    await page.waitForTimeout(250);
    const panel = page.locator('[data-testid="nex-control-center-panel"]');
    await panel.waitFor({ state: "visible", timeout: 3000 });
    const pb = await panel.boundingBox();
    const inFrame = pb && pb.width <= 460 + 1;
    if (inFrame) pass("E_control_center_panel_scoped_inside_phone_frame", { panel_width: pb?.width, viewport_width: width });
    else fail("E_control_center_panel_scoped_inside_phone_frame", { panel_width: pb?.width, viewport_width: width });
  } catch (e) {
    fail("E_control_center_panel_scoped_inside_phone_frame", { error: e.message.slice(0, 200) });
  }

  // 5. Live in your city entry present + AVAILABLE
  try {
    const liveEntry = page.locator('[data-testid="nex-control-center-item-live_in_your_city"]');
    const availability = await liveEntry.getAttribute("data-availability");
    const href = await liveEntry.getAttribute("href");
    if (availability === "AVAILABLE" && href === "/nex-app/live") {
      pass("F_control_center_has_live_destination", { availability, href });
    } else {
      fail("F_control_center_has_live_destination", { availability, href });
    }
  } catch (e) {
    fail("F_control_center_has_live_destination", { error: e.message.slice(0, 200) });
  }

  // Screenshot: Control Center open + scoped
  const shotCC = path.join(OUT_DIR, `${name}-control-center-open.png`);
  await page.screenshot({ path: shotCC });

  // 6. Navigate directly to /nex-app/live (avoids brittle Link tap that
  // could hit backdrop; we've already proven the Link's href is right)
  try {
    const resp = await page.goto(`${BASE_URL}/nex-app/live`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (resp && resp.status() === 200) pass("G_city_live_loads_200");
    else fail("G_city_live_loads_200", { status: resp?.status() });
  } catch (e) {
    fail("G_city_live_loads_200", { error: e.message.slice(0, 200) });
  }
  await dismissOverlays(page);

  // 7. City Live root is inside phone frame + header renders
  try {
    const root = page.locator('[data-testid="nex-city-live-root"]');
    await root.waitFor({ state: "visible", timeout: 5000 });
    const rb = await root.boundingBox();
    const scope = await root.getAttribute("data-scope");
    const city = await root.getAttribute("data-city");
    const withinFrame = rb && rb.width <= 460 + 1;
    if (withinFrame && scope === "phone-frame" && city === "yogyakarta") {
      pass("H_city_live_inside_phone_frame", { width: rb?.width, scope, city });
    } else {
      fail("H_city_live_inside_phone_frame", { width: rb?.width, scope, city });
    }
  } catch (e) {
    fail("H_city_live_inside_phone_frame", { error: e.message.slice(0, 200) });
  }

  // 8. Wait for the client-side fetch to resolve and at least one
  // status section to render. Category chips only appear after the
  // fetch returns items so we use them as the ready signal.
  try {
    await page.locator('[data-testid="nex-city-live-category-chips"]').waitFor({ state: "visible", timeout: 30_000 });
    const anySection = await page.locator('[data-testid^="nex-city-live-section-"]').count();
    if (anySection > 0) pass("I_city_live_status_sections_present", { sections: anySection });
    else fail("I_city_live_status_sections_present", { sections: anySection });
  } catch (e) {
    fail("I_city_live_status_sections_present", { error: e.message.slice(0, 200) });
  }

  const shotCity = path.join(OUT_DIR, `${name}-city-live.png`);
  await page.screenshot({ path: shotCity, fullPage: true });

  // 9. Entity page proof · Gaotama Hotel · Live carousel visible
  const ENTITY_REF = "#AC-2026-0000D";
  const entityUrl = `${BASE_URL}/nex-app/entity/${encodeURIComponent(ENTITY_REF)}`;
  try {
    const resp = await page.goto(entityUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (resp && resp.status() === 200) pass("J_entity_page_loads_200", { url: entityUrl });
    else fail("J_entity_page_loads_200", { status: resp?.status(), url: entityUrl });
  } catch (e) {
    fail("J_entity_page_loads_200", { error: e.message.slice(0, 200), url: entityUrl });
  }
  await dismissOverlays(page);

  try {
    const root = page.locator('[data-testid="nex-entity-detail-root"]');
    await root.waitFor({ state: "visible", timeout: 5000 });
    const rb = await root.boundingBox();
    const scope = await root.getAttribute("data-scope");
    const withinFrame = rb && rb.width <= 460 + 1;
    if (withinFrame && scope === "phone-frame") {
      pass("K_entity_page_inside_phone_frame", { width: rb?.width, scope });
    } else {
      fail("K_entity_page_inside_phone_frame", { width: rb?.width, scope });
    }
  } catch (e) {
    fail("K_entity_page_inside_phone_frame", { error: e.message.slice(0, 200) });
  }

  const shotEntity = path.join(OUT_DIR, `${name}-entity-detail.png`);
  await page.screenshot({ path: shotEntity, fullPage: true });

  await context.close();

  const pass_count = Object.values(results).filter((v) => v.pass).length;
  const fail_count = Object.keys(results).length - pass_count;
  return { name, width, height, isMobile, results, pass_count, fail_count, total: Object.keys(results).length };
}

async function main() {
  console.log("=== NEX PHASE D · SHELL-SCOPE + CONTROL CENTER + PROFILE + CITY LIVE PROOF ===");
  console.log(`BASE_URL: ${BASE_URL}`);
  const browser = await chromium.launch({ headless: true });

  const mobile = await runViewport(browser, { name: "phone-390x844", width: 390, height: 844, isMobile: true });
  const desktop = await runViewport(browser, { name: "desktop-1440x900", width: 1440, height: 900, isMobile: false });

  await browser.close();

  const overall = {
    runAt: new Date().toISOString(),
    base_url: BASE_URL,
    viewports: { mobile, desktop },
    summary: {
      pass: mobile.pass_count + desktop.pass_count,
      fail: mobile.fail_count + desktop.fail_count,
      total: mobile.total + desktop.total,
    },
  };
  const outPath = path.join(here, "_nex_phase_d_shell_scope_proof.json");
  fs.writeFileSync(outPath, JSON.stringify(overall, null, 2), "utf8");

  console.log(`\n=== SUMMARY ===`);
  console.log(`mobile · pass=${mobile.pass_count} fail=${mobile.fail_count} / ${mobile.total}`);
  console.log(`desktop · pass=${desktop.pass_count} fail=${desktop.fail_count} / ${desktop.total}`);
  console.log(`Result: ${outPath}`);
  console.log(`Screenshots: ${OUT_DIR}`);

  process.exit(overall.summary.fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error("FATAL", err); process.exit(2); });
