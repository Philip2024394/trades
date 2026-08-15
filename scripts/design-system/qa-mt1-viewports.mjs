// NEX Design Catalogue · Master Template 1 · 5-viewport responsive QA.
//
// Philip 2026-08-14 · required for Golden Page approval. Captures the
// FULL assembled Master Template at each of the five required
// viewports so the composition can be judged as ONE product, not
// section-by-section.
//
// Viewports (Philip's spec):
//   1440×900   desktop large
//   1280×800   desktop standard
//   768×1024   tablet portrait
//   390×844    mobile · iPhone 13/14/15
//   375×812    mobile · iPhone X / SE (modern)

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.NEX_QA_BASE ?? "http://localhost:3008";
const URL  = `${BASE}/nex-app/design-catalogue/staircase/master-template-1`;
const OUT  = join(process.cwd(), "tmp-nex-qa-screenshots", "mt1-viewports");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1440x900",  width: 1440, height:  900 },
  { name: "desktop-1280x800",  width: 1280, height:  800 },
  { name: "tablet-768x1024",   width:  768, height: 1024 },
  { name: "mobile-390x844",    width:  390, height:  844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: "mobile-375x812",    width:  375, height:  812, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }
];

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const vp of VIEWPORTS) {
  console.log(`\n── ${vp.name} (${vp.width}×${vp.height}) ──`);
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile ?? false,
    hasTouch: vp.hasTouch ?? false,
    deviceScaleFactor: vp.deviceScaleFactor ?? 1
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  try {
    await page.goto(URL, { waitUntil: "load", timeout: 90_000 });
    // Suppress the persistent dev preview bar + cookie banner so the
    // screenshot shows the pure design.
    await page.addStyleTag({ content: `
      [data-testid="mt1-preview"] > div:first-child { display: none !important; }
      [role="dialog"][aria-label="Cookie consent"] { display: none !important; }
    `});
    await page.waitForTimeout(500); // let fonts + layout settle

    // Full-page screenshot · owner sees the whole composition at scale
    const full = join(OUT, `${vp.name}__full.png`);
    await page.screenshot({ path: full, fullPage: true });

    // Viewport-only screenshot · what the visitor sees WITHOUT scrolling
    const above = join(OUT, `${vp.name}__above-fold.png`);
    await page.screenshot({ path: above, fullPage: false });

    // Horizontal-scroll audit · any hero/section wider than viewport?
    const scroll = await page.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    }));
    const hScroll = scroll.docWidth > scroll.innerWidth;
    if (hScroll) {
      failures.push(`${vp.name} · horizontal scroll (doc=${scroll.docWidth} > viewport=${scroll.innerWidth})`);
    }

    console.log(`  full-page:      ${full}`);
    console.log(`  above-fold:     ${above}`);
    console.log(`  horiz scroll:   ${hScroll ? `FAIL (doc ${scroll.docWidth} > vp ${scroll.innerWidth})` : "OK"}`);
    console.log(`  console errors: ${consoleErrors.length === 0 ? "0" : consoleErrors.length + " · " + consoleErrors.slice(0, 2).join(" | ")}`);
    if (consoleErrors.length > 0) failures.push(`${vp.name} · ${consoleErrors.length} console error(s)`);
  } finally {
    await ctx.close();
  }
}

await browser.close();

console.log("");
console.log("=".repeat(60));
if (failures.length === 0) {
  console.log("5-viewport QA · all viewports clean · ready for review");
} else {
  console.log(`5-viewport QA · ${failures.length} failure(s):`);
  for (const f of failures) console.log("  · " + f);
  process.exit(1);
}
console.log("=".repeat(60));
