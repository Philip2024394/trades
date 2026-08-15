// Quick Playwright screenshot of the Master Template 1 preview at
// desktop + mobile so Philip can compare against the reference before
// reviewing in-browser.

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.NEX_QA_BASE ?? "http://localhost:3008";
const URL  = `${BASE}/nex-app/design-catalogue/staircase/master-template-1`;
const OUT  = join(process.cwd(), "tmp-nex-qa-screenshots", "mt1");
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
  await page.waitForTimeout(600); // let fonts settle
  // Scroll top-to-bottom so IntersectionObserver-based Reveal wrappers
  // trigger before the fullPage screenshot captures below-fold sections.
  await page.evaluate(async () => {
    const step = 400;
    const max = document.documentElement.scrollHeight;
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
  // 1 · combined page (hero + trust · shows the overlap)
  await page.screenshot({ path: join(OUT, `combined__${vp.name}.png`), fullPage: true });
  // 2 · hero alone
  const hero = await page.$('[data-section-id="ST-H01"]');
  if (hero) await hero.screenshot({ path: join(OUT, `ST-H01__${vp.name}.png`) });
  // 3 · trust alone
  const trust = await page.$('[data-section-id="ST-T01"]');
  if (trust) await trust.screenshot({ path: join(OUT, `ST-T01__${vp.name}.png`) });
  // 4 · collections alone
  const coll = await page.$('[data-section-id="ST-C01"]');
  if (coll) await coll.screenshot({ path: join(OUT, `ST-C01__${vp.name}.png`) });
  // 5 · craftsmanship + enquiry alone
  const craft = await page.$('[data-section-id="ST-A01"]');
  if (craft) await craft.screenshot({ path: join(OUT, `ST-A01__${vp.name}.png`) });
  console.log(`saved ${vp.name} · combined + hero + trust`);
  await ctx.close();
}
await browser.close();
