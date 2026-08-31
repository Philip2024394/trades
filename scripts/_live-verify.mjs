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
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
try {
  await p.goto(`${BASE}/nexapp`, { waitUntil: "load", timeout: 45000 });
  await p.waitForTimeout(2500);
  await dismissCookies(p);
  await p.locator('button[aria-label="Discover"]').first().click();
  await p.waitForTimeout(600);
  // Look for LIVE sub-section
  const liveBtn = p.locator('text=LIVE').first();
  const liveVisible = await liveBtn.isVisible().catch(() => false);
  console.log(liveVisible ? "✅ LIVE sub-section visible in Discover drawer" : "❌ LIVE sub-section missing");
  if (liveVisible) {
    await liveBtn.click();
    await p.waitForTimeout(1500);
    const url = p.url();
    console.log(/[?&]ws=discover-live|discover-live/.test(url) ? `✅ Landed at LIVE artifact · url=${url.replace(BASE,"")}` : `URL after LIVE tap: ${url.replace(BASE,"")}`);
    // NexLiveClient shows either a video or an empty-state link to /nex-video/create
    const contentCheck = await p.evaluate(() => {
      const t = document.body.innerText;
      return {
        hasVideoOrEmptyState: /video|live|watch|create/i.test(t),
        hasCreateLink: !!document.querySelector('a[href*="/nex-video"]'),
      };
    });
    console.log(`content: ${JSON.stringify(contentCheck)}`);
  }
  const criticalErrs = errs.filter((e) => /Cannot find module|SyntaxError|TypeError|Uncaught/.test(e));
  console.log(criticalErrs.length === 0 ? "✅ no critical runtime errors" : `❌ errs: ${criticalErrs[0].slice(0,140)}`);
} catch (e) { console.log(`FATAL: ${e.message}`); }
await browser.close();
