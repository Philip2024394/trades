// Targeted re-run of Campaign B only · Playwright · verification-only
// Philip 2026-09-06 · reprove after strengthening sendMessage race safety

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here    = path.dirname(fileURLToPath(import.meta.url));
const shotDir = path.join(here, "_wave5_founder_world_class_browser_acceptance_screenshots");
const CHAT_URL = process.env.NEX_APP_CHAT_URL || "http://localhost:3008/nex-app/chat";

mkdirSync(shotDir, { recursive: true });

async function gotoChat(page) {
  await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector('textarea[placeholder="Ask Nex anything…"]', { state: "attached", timeout: 90_000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      const t = (b.textContent || "").trim();
      if (/^(Accept|Accept all|Got it|Agree|OK)$/i.test(t)) { try { b.click(); } catch {} }
    }
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    for (const n of document.querySelectorAll("*")) {
      const el = n instanceof HTMLElement ? n : null; if (!el) continue;
      const s = window.getComputedStyle(el);
      if (s.position !== "fixed" && s.position !== "sticky") continue;
      const text = (el.innerText || "").trim();
      if (/We use cookies|cookie preferences|cookie consent/i.test(text)) el.style.display = "none";
    }
    const nextErr = document.querySelector('[data-nextjs-toast]') || document.querySelector('nextjs-portal');
    if (nextErr instanceof HTMLElement) nextErr.style.display = "none";
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.locator('textarea[placeholder="Ask Nex anything…"]').scrollIntoViewIfNeeded({ timeout: 10_000 });
  await page.waitForTimeout(200);
}

async function sendMessage(page, text) {
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
  const p1 = page.waitForResponse(
    (r) => r.url().includes("/api/nex-conv/chat") && r.request().method() === "POST",
    { timeout: 60_000 },
  ).catch(() => null);
  await ta.press("Enter");
  let resp = await p1;
  if (!resp) {
    await page.waitForTimeout(300);
    await ta.fill(text);
    await page.waitForTimeout(200);
    const p2 = page.waitForResponse(
      (r) => r.url().includes("/api/nex-conv/chat") && r.request().method() === "POST",
      { timeout: 45_000 },
    ).catch(() => null);
    await ta.press("Enter");
    resp = await p2;
  }
  await page.waitForTimeout(1500);
}

async function inspect(page) {
  const worldCardCount = await page.locator('[data-testid="world-card"]').count();
  const cardNames = worldCardCount === 0 ? [] : await page.$$eval('[data-testid="world-card"]', (els) =>
    els.map((el) => {
      const l = el.getAttribute("aria-label") || "";
      const m = l.match(/^Result \d+: (.+)$/);
      return m ? m[1] : l;
    }));
  const bodyText = (await page.evaluate(() => document.body.innerText || "")).slice(-1500);
  return { worldCardCount, cardNames, tailText: bodyText };
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(90_000);

console.log("═══ B_card_continuation REPROVE ═══");
await gotoChat(page);
console.log(" · chat ready");

const turns = [
  { msg: "need a hotel tonight" },
  { msg: "can i see details" },
  { msg: "tell me about the first one" },
  { msg: "tell me about the second one" },
  { msg: "one more" },
  { msg: "tell me about the last one" },
];

const record = { runAt: new Date().toISOString(), turns: [] };
for (const [i, t] of turns.entries()) {
  console.log(` → T${i+1} "${t.msg}"`);
  await sendMessage(page, t.msg);
  const s = await inspect(page);
  record.turns.push({ turn: i+1, message: t.msg, ...s });
  await page.screenshot({ path: path.join(shotDir, `B_reprove_T${String(i+1).padStart(2,"0")}.png`), fullPage: true });
  console.log(`    cards=${s.worldCardCount} names=[${s.cardNames.slice(0,3).join(", ")}]`);
  console.log(`    tail: ${JSON.stringify(s.tailText.slice(-260))}`);
}

writeFileSync(path.join(here, "_wave5_founder_campaign_b_reprove.json"), JSON.stringify(record, null, 2));
await browser.close();
console.log("\ndone");
