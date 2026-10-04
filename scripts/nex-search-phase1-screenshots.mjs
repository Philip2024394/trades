// scripts/nex-search-phase1-screenshots.mjs
//
// Phase 1 acceptance evidence · browser screenshots for NEX Search.
// Hits the running dev server on :3008 at three viewports for six URLs
// and writes PNGs under /tmp/nex-search-phase1/. Non-destructive.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const OUT_DIR = resolve(process.cwd(), "tmp/nex-search-phase1");

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-393", width: 393, height: 852 },
  { name: "desktop-1280", width: 1280, height: 900 },
];

const URLS = [
  { slug: "landing",      path: "/nex-native/search?search=1" },
  { slug: "cafe-all",     path: "/nex-native/search?search=1&q=cafe" },
  { slug: "cafe-shops",   path: "/nex-native/search?search=1&q=cafe&tab=shops" },
  { slug: "companies",    path: "/nex-native/search?search=1&tab=companies" },
  { slug: "services",     path: "/nex-native/search?search=1&tab=services" },
  { slug: "places",       path: "/nex-native/search?search=1&tab=places" },
];

const BASE = "http://localhost:3008";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });
      for (const u of URLS) {
        const page = await context.newPage();
        const url = BASE + u.path;
        const startedAt = Date.now();
        try {
          const resp = await page.goto(url, {
            waitUntil: "networkidle",
            timeout: 30_000,
          });
          const status = resp?.status() ?? 0;
          // Wait briefly for any client hydration to settle.
          await page.waitForTimeout(500);
          const file = `${OUT_DIR}/${vp.name}__${u.slug}.png`;
          await page.screenshot({ path: file, fullPage: true });
          const title = await page.title();
          const bodyText = (await page.locator("body").innerText()).slice(0, 160);
          results.push({
            viewport: vp.name,
            url: u.path,
            status,
            title,
            bodyPreview: bodyText.replace(/\s+/g, " "),
            file: file.replace(process.cwd() + "/", "").replace(process.cwd() + "\\", ""),
            ms: Date.now() - startedAt,
          });
        } catch (e) {
          results.push({
            viewport: vp.name,
            url: u.path,
            error: e.message,
          });
        } finally {
          await page.close();
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error("fatal:", e.message);
  process.exit(1);
});
