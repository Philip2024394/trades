import { chromium } from "playwright";
const BASE = "http://localhost:3008";
const dismissCookies = async (p) => {
  const d = p.locator('[role="dialog"][aria-label*="ookie" i]');
  if ((await d.count()) > 0) {
    const a = d.locator("button").filter({ hasText: /accept|ok|got it|agree/i }).first();
    if ((await a.count()) > 0) { await a.click(); await p.waitForTimeout(400); }
  }
};
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
try {
  await p.goto(`${BASE}/nexapp`, { waitUntil: "load", timeout: 45000 });
  await p.waitForTimeout(2500);
  await dismissCookies(p);
  const preClick = await p.locator('[data-nex-explore-radial]').count();
  console.log(`before Discover tap: ${preClick} satellite containers`);
  await p.locator('button[aria-label="Discover"]').first().click();
  await p.waitForTimeout(1500);
  const postClick = await p.locator('[data-nex-explore-radial]').count();
  const discoveryBtn = await p.locator('button[aria-label*="Discovery"]').count();
  const videoBtn = await p.locator('button[aria-label*="Video"]').count();
  const cameraBtn = await p.locator('button[aria-label*="Camera"]').count();
  const callBtn = await p.locator('button[aria-label*="Call"]').count();
  const emojiBtn = await p.locator('button[aria-label*="Emoji"]').count();
  console.log(`after Discover tap: ${postClick} satellite containers`);
  console.log(`satellite buttons: Discovery=${discoveryBtn} Video=${videoBtn} Camera=${cameraBtn} Call=${callBtn} Emoji=${emojiBtn}`);
  const allFive = discoveryBtn >= 1 && videoBtn >= 1 && cameraBtn >= 1 && callBtn >= 1 && emojiBtn >= 1;
  console.log(allFive ? "✅ all 5 satellites present when Discover is active" : "❌ satellites missing");

  // Regression: tap Messages · satellites should DISAPPEAR
  await p.locator('button[aria-label="Messages"]').first().click();
  await p.waitForTimeout(800);
  const afterMessages = await p.locator('[data-nex-explore-radial]').count();
  console.log(afterMessages === 0 ? "✅ satellites hidden when other room active" : `❌ satellites still visible on Messages (${afterMessages} containers)`);
} catch (e) { console.log(`FATAL: ${e.message}`); }
await browser.close();
