#!/usr/bin/env node
// tests/fixtures/conversation-followup-proof/_nex_home_slice1_proof.mjs
//
// NEX Frameless Recovery · Slice 1 · Real Chromium proof
// Philip 2026-09-07
//
// Verifies the new /nex-app frameless home recovers three legacy
// capabilities into a frameless architecture:
//   · NexComposer  (bottom text input + send)
//   · NexKeypad    (opens on composer focus · typing works)
//   · NexKebabQuickPanel (lower-right 3-dot · Live/Chat/Social tiles)
//
// Also verifies:
//   · No phone chassis / .nex-console-viewport was resurrected
//   · Ephemeral submission echo appears (proves composer→keypad→submit)
//   · Section drawer is suppressed
//   · Existing Glass Gate + Discover surfaces still load

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, "_home_slice1_screenshots");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.NEX_BASE_URL ?? "http://localhost:3008";
const results = [];

function record(label, ok, detail) {
  results.push({ label, ok, detail: detail ?? "" });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${detail ? " · " + detail : ""}`);
}

async function reachable() {
  try {
    const resp = await fetch(BASE_URL + "/nex-app", { method: "GET" });
    return resp.status >= 200 && resp.status < 500;
  } catch { return false; }
}

async function shoot(page, name) {
  try { await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false }); } catch {}
}

async function dismissOverlays(page) {
  await page.evaluate(() => {
    const patterns = [/^(accept|accept all|agree|got it|ok|allow|i agree|dismiss|close|reject|reject all)$/i];
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    for (const d of dialogs) {
      const buttons = Array.from(d.querySelectorAll("button, a[role=button], [role=button]"));
      for (const b of buttons) {
        const t = ((b.textContent) || "").trim();
        if (patterns.some((rx) => rx.test(t))) { try { b.click(); } catch {} }
      }
    }
  }).catch(() => {});
  await page.waitForTimeout(200);
}

async function main() {
  if (!(await reachable())) {
    console.log(`Dev server not reachable at ${BASE_URL}. Start: npm run dev (port 3008).`);
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });

  // --------------------------------------------------------------
  // PRIMARY · 390 x 844 iPhone 14
  // --------------------------------------------------------------
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const page = await ctx.newPage();

    const resp = await page.goto(BASE_URL + "/nex-app", { waitUntil: "domcontentloaded", timeout: 45_000 });
    record("A1 · /nex-app responds", (resp?.status() ?? 0) < 500, `status=${resp?.status()}`);

    await page.waitForSelector('[data-testid="nex-home-viewport"]', { timeout: 20_000 }).catch(() => {});
    const viewportEl = await page.$('[data-testid="nex-home-viewport"]');
    record("A2 · frameless home viewport mounts", !!viewportEl);

    // Anti-frame invariant · Philip's hard rule
    const noFrame = await page.evaluate(() => {
      return !document.querySelector(".nex-console-viewport") &&
             !document.querySelector('[data-testid="nex-hud-frame"]');
    });
    record("F1 · NO phone frame resurrected (.nex-console-viewport absent)", noFrame);

    const wordmarkText = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="nex-home-wordmark"]');
      return el ? (el.textContent || "").replace(/\s+/g, "") : "";
    });
    record("A3 · wordmark shows NEX", wordmarkText === "NEX", `text="${wordmarkText}"`);

    const emptyState = await page.$('[data-testid="nex-home-empty-state"]');
    record("A4 · empty state shows 'Ask NEX anything'", !!emptyState);

    // Composer must be visible + interactive
    const composerVisible = await page.$('[data-testid="nex-home-console"]');
    record("C1 · console (composer host) visible", !!composerVisible);

    const composerInput = await page.$('textarea[aria-label="Message NEX"]');
    record("C2 · composer textarea present", !!composerInput);

    // Focus composer → keypad opens
    await composerInput?.focus();
    await page.waitForSelector('[role="group"][aria-label="NEX keypad"]', { timeout: 5_000 }).catch(() => {});
    const keypadVisible = await page.$('[role="group"][aria-label="NEX keypad"]');
    record("K1 · keypad opens on composer focus", !!keypadVisible);

    const keypadZone = await page.evaluate(() => {
      const z = document.querySelector('[data-testid="nex-home-keypad-zone"]');
      return z ? z.getBoundingClientRect().height > 100 : false;
    });
    record("K2 · keypad zone has meaningful height", keypadZone);

    // Tap keypad keys to type "hi" · JS-dispatch click bypasses
    // Playwright's built-in focus/actionability model which was
    // stealing focus from the composer between clicks and losing
    // the first keypress.
    const tapKey = async (label) => {
      await page.evaluate((lbl) => {
        const btn = document.querySelector(
          `[role="group"][aria-label="NEX keypad"] button[aria-label="${lbl}"]`
        );
        if (btn) {
          const evt = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
          btn.dispatchEvent(evt);
          btn.click();
        }
      }, label);
      await page.waitForTimeout(30);
    };
    await tapKey("h");
    await tapKey("i");
    await page.waitForTimeout(120);

    const typed = await page.$eval('textarea[aria-label="Message NEX"]', (el) => el.value).catch(() => "");
    record("K3 · keypad keys append characters to composer", typed === "hi", `value="${typed}"`);

    // Enter → submit → ephemeral echo (JS-dispatch as above)
    await tapKey("Enter");
    await page.waitForSelector('[data-testid="nex-home-submission"]', { timeout: 5_000 }).catch(() => {});
    const submissions = await page.$$eval('[data-testid="nex-home-submission"]', (els) => els.map((e) => e.textContent));
    record("K4 · Enter submits · echo appears", submissions.length === 1 && submissions[0] === "hi", `count=${submissions.length}`);

    const composerAfterSubmit = await page.$eval('textarea[aria-label="Message NEX"]', (el) => el.value).catch(() => "?");
    record("K5 · composer text clears after submit", composerAfterSubmit === "", `value="${composerAfterSubmit}"`);

    await shoot(page, "01-home-post-submit");

    // Kebab button visible + opens quick panel
    const kebabBtn = await page.$('[data-testid="nex-home-kebab-button"]');
    record("B1 · lower-right kebab (3-dot) button visible", !!kebabBtn);

    await dismissOverlays(page);
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="nex-home-kebab-button"]');
      if (el) el.click();
    });
    await page.waitForSelector('[role="dialog"][aria-label*="Live or chat"]', { timeout: 5_000 }).catch(() => {});
    const panelVisible = await page.$('[role="dialog"][aria-label*="Live or chat"]');
    record("B2 · kebab opens · quick panel visible (Live/Chat/Social)", !!panelVisible);

    const liveBtn = await page.$('[aria-label="Open Live"]');
    const chatBtn = await page.$('[aria-label="Open friends chat screen"]');
    const socialBtn = await page.$('[aria-label="Open social discover screen"]');
    record("B3 · panel shows Live + Chat + Social tiles", !!(liveBtn && chatBtn && socialBtn));

    await shoot(page, "02-home-kebab-open");

    // Section drawer suppressed on /nex-app
    const drawer = await page.$('[aria-label="Open sections menu"]');
    record("N1 · NexSectionsNav drawer hidden on /nex-app", !drawer);

    // No horizontal scroll
    const noHscroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    record("V1 · no horizontal scroll at 390x844", noHscroll);

    // Viewport occupancy
    const vp = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="nex-home-viewport"]');
      return el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
    });
    record("V2 · home viewport fills 390x844", vp && vp.w >= 380 && vp.h >= 800, vp ? `${vp.w}x${vp.h}` : "no root");

    await ctx.close();
  }

  // --------------------------------------------------------------
  // Regression · Glass Gate + Discover still work
  // --------------------------------------------------------------
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const resp1 = await page.goto(BASE_URL + "/nex-app/enter", { waitUntil: "domcontentloaded", timeout: 45_000 });
    record("R1 · Glass Gate /nex-app/enter still loads", (resp1?.status() ?? 0) < 500, `status=${resp1?.status()}`);
    await page.waitForSelector('[data-testid="nex-gate"]', { timeout: 15_000 }).catch(() => {});
    const gate = await page.$('[data-testid="nex-gate"]');
    record("R2 · Glass Gate root still mounts", !!gate);
    const resp2 = await page.goto(BASE_URL + "/nex-app/discover", { waitUntil: "domcontentloaded", timeout: 45_000 });
    record("R3 · Discover /nex-app/discover still loads", (resp2?.status() ?? 0) < 500, `status=${resp2?.status()}`);
    await page.waitForSelector('[data-testid="nex-social-discovery-selector"]', { timeout: 15_000 }).catch(() => {});
    const selector = await page.$('[data-testid="nex-social-discovery-selector"]');
    record("R4 · Discover selector still mounts (Phase Social intact)", !!selector);
    await ctx.close();
  } catch (err) {
    record("R · regression context", false, `error: ${err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100)}`);
  }

  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log("---");
  console.log(`RESULTS · ${passed} pass · ${failed} fail · ${results.length} total`);

  fs.writeFileSync(
    path.join(here, "_nex_home_slice1_proof.json"),
    JSON.stringify({ base_url: BASE_URL, results, passed, failed, total: results.length }, null, 2),
    "utf8",
  );

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("proof failed:", err instanceof Error ? err.message : String(err));
  process.exit(3);
});
