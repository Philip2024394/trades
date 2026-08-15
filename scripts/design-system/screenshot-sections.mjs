// NEX Design System Finalisation · per-section screenshots (Philip 2026-08-14).
//
// Hits /preview/section/{id} for every registered section and captures a
// desktop + mobile screenshot. Screenshots are the visual truth of the
// design-system inventory review — owner approves/rejects each one.
//
// Consumes data/design-system/section-inventory.json.
// Emits tmp-nex-qa-screenshots/design-inventory/{library}/{id}__{viewport}.png.
//
// Prereqs:
//   - Dev server running on http://localhost:3008 (npm run dev)
//   - Playwright + Chromium installed

import { chromium } from "playwright";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.NEX_QA_BASE ?? "http://localhost:3008";
const ROOT = process.cwd();
const INV  = JSON.parse(readFileSync(join(ROOT, "data", "design-system", "section-inventory.json"), "utf8"));
const OUT  = join(ROOT, "tmp-nex-qa-screenshots", "design-inventory");

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800, isMobile: false },
  { name: "mobile",  width: 390,  height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
];

const preflight = await fetch(BASE).catch((e) => ({ ok: false, error: e.message }));
if (!preflight || preflight.ok === false) {
  console.error(`Dev server not reachable at ${BASE}. Start with: npm run dev`);
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
let ok = 0, err = 0;
const errors = [];

for (const vp of VIEWPORTS) {
  console.log(`\n── viewport: ${vp.name} (${vp.width}×${vp.height}) ──`);
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

  for (const s of INV.inventory) {
    const libDir = join(OUT, s.library);
    if (!existsSync(libDir)) mkdirSync(libDir, { recursive: true });
    const filePath = join(libDir, `${s.id}__${vp.name}.png`);
    const url = `${BASE}/preview/section/${encodeURIComponent(s.id)}`;

    try {
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
      if (!resp || resp.status() !== 200) {
        errors.push({ id: s.id, viewport: vp.name, reason: `HTTP ${resp?.status()}` });
        console.log(`  FAIL ${s.id} · HTTP ${resp?.status()}`);
        err++;
        continue;
      }
      // Small settle time for animations to reach a stable pose.
      await page.waitForTimeout(400);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`  OK   ${s.id.padEnd(30)} → ${vp.name}`);
      ok++;
    } catch (e) {
      errors.push({ id: s.id, viewport: vp.name, reason: String(e?.message ?? e) });
      console.log(`  FAIL ${s.id} · ${e?.message ?? e}`);
      err++;
    }
  }
  await ctx.close();
}

await browser.close();

console.log("");
console.log("=".repeat(60));
console.log(`Section screenshots · ${ok} ok · ${err} failed`);
console.log("=".repeat(60));
if (err > 0) {
  console.log("Failures:");
  for (const e of errors) console.log(`  · ${e.id} [${e.viewport}] ${e.reason}`);
  process.exit(1);
}
