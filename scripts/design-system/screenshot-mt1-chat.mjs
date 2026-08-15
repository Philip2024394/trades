// Quick Playwright screenshot of the Master Template 1 chat page.

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.NEX_QA_BASE ?? "http://localhost:3008";
const URL  = `${BASE}/nex-app/design-catalogue/staircase/master-template-1/chat`;
const OUT  = join(process.cwd(), "tmp-nex-qa-screenshots", "mt1-chat");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile",  width: 390,  height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile ?? false,
    hasTouch: vp.hasTouch ?? false,
    deviceScaleFactor: vp.deviceScaleFactor ?? 1
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "load", timeout: 90_000 });
  // Suppress the persistent cookie banner from the shot.
  await page.addStyleTag({ content: `[role="dialog"][aria-label="Cookie consent"] { display: none !important; }`});
  // Wait for the auto-greeting flow to arrive (typing ~900ms + settle)
  await page.waitForTimeout(1600);
  await page.screenshot({ path: join(OUT, `empty__${vp.name}.png`), fullPage: false });
  console.log(`saved empty · ${vp.name}`);
  await ctx.close();
}
await browser.close();
