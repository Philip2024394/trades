// scripts/nex-phase3a-polish-screenshots.mjs
//
// Adoption-ready UX acceptance screenshots.
// Flips one legacy profile to discoverable briefly, captures the
// new UX surfaces at 3 viewports, flips back.

import fs from "node:fs";
import path from "node:path";
import pkg from "pg";
import { chromium } from "playwright";
const { Client } = pkg;

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const BASE = "http://localhost:3008";
const OUT = path.resolve(process.cwd(), "tmp/nex-phase3a-polish");
const HANDLE = "nex-27418";

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-393", width: 393, height: 852 },
  { name: "desktop-1280", width: 1280, height: 900 },
];

const URLS = [
  // Anon landing on Settings profile · redirects to sign-in · auth gate intact
  { slug: "settings-profile", path: "/nex-native/settings/profile?tab=personal" },
  // Public profile · opted in · anonymous view · normal visitor render
  { slug: "public-profile", path: `/nex-native/u/${HANDLE}` },
  // Public profile with ?preview=public · anonymous view · identical to above
  // (preview flag only takes effect when the viewer IS the owner · verified
  // in the preview-boundary test).
  { slug: "public-profile-preview", path: `/nex-native/u/${HANDLE}?preview=public` },
];

fs.mkdirSync(OUT, { recursive: true });

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();

async function flip(value) {
  await pg.query(
    `UPDATE nex_account_profile p SET is_discoverable = $2
       FROM nex_account a WHERE a.id = p.account_id AND a.nex_handle = $1`,
    [HANDLE, value],
  );
}

const browser = await chromium.launch({ headless: true });
try {
  // Flip to discoverable for the capture window
  await flip(true);

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    for (const u of URLS) {
      const page = await ctx.newPage();
      await page.goto(BASE + u.path, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(400);
      const file = `${OUT}/${vp.name}__${u.slug}.png`;
      await page.screenshot({ path: file, fullPage: true });
      const txt = (await page.locator("body").innerText()).slice(0, 160).replace(/\s+/g, " ");
      console.log(`  ✓ ${vp.name} · ${u.slug} · ${txt}`);
      await page.close();
    }
    await ctx.close();
  }
} finally {
  await flip(false);
  await pg.end();
  await browser.close();
  console.log(`\n  → ${HANDLE} is_discoverable restored to false.`);
}
console.log(`\n✓ 9 screenshots written to ${OUT}`);
