// scripts/nex-phase3a-owner-preview-verify.mjs
//
// Phase 3A Adoption-Ready UX · final owner-preview browser
// verification with an authenticated owner session.
//
// Uses the gated dev-admin one-click sign-in (NEX_ALLOW_DEV_ADMIN=1
// in .env.local · dev-admin@nex-native.local). The dev-admin account
// has nex_handle = nex-10375 and no profile row · which exercises
// the exact "owner · not discoverable · looking at own page" code
// path we need to verify.
//
// Checks per viewport (3 viewports · 375 / 393 / 1280):
//   A · Owner, no preview, on own non-discoverable profile ·
//       OwnerPreviewBanner visible · VisitorPreviewBanner absent
//   B · Owner + ?preview=public on own non-discoverable profile ·
//       VisitorPreviewBanner visible · OwnerPreviewBanner absent
//   C · Anonymous + ?preview=public on same URL ·
//       Next.js notFound() chrome rendered · NO content leak
//
// After the capture pass, confirms Dev Admin's profile row DID NOT
// get created and no DB mutation happened as a side-effect of
// previewing.

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
const OUT = path.resolve(process.cwd(), "tmp/nex-phase3a-owner");
const OWNER_HANDLE = "nex-10375";
const OWNER_ACCOUNT_ID = "b77db750-d96e-4d37-a7f5-df315f677d98";

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-393", width: 393, height: 852 },
  { name: "desktop-1280", width: 1280, height: 900 },
];

fs.mkdirSync(OUT, { recursive: true });

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();

async function devAdminSnapshot() {
  const q = await pg.query(
    `SELECT COUNT(*)::int AS n FROM nex_account_profile WHERE account_id = $1`,
    [OWNER_ACCOUNT_ID],
  );
  return q.rows[0].n;
}

const results = [];
function record(check, expected, actual, pass) {
  results.push({ check, expected, actual, pass });
  console.log(`  ${pass ? "✓" : "✗"} ${check}`);
  console.log(`      expected: ${expected}`);
  console.log(`      actual:   ${actual}`);
}

async function signInAsDevAdmin(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/nex-native/sign-in`, { waitUntil: "networkidle", timeout: 30000 });
  // The one-click dev-admin button is a form submit · data-nex-sign-in-dev-admin
  const btn = await page.locator("[data-nex-sign-in-dev-admin]");
  await btn.click();
  // After submit we redirect to /nex-native/home · wait for it.
  await page.waitForURL(/\/nex-native\/home/, { timeout: 15000 });
  await page.close();
}

async function fetchAnonBody(url) {
  const r = await fetch(url, { redirect: "manual" });
  return { status: r.status, body: await r.text() };
}
function isNotFound(body) {
  if (body.includes("This page could not be found")) return true;
  const n = (body.match(/>404</g) || []).length + (body.match(/\b404\b/g) || []).length;
  return n >= 3;
}

const beforeProfiles = await devAdminSnapshot();
console.log(`  dev-admin profile rows BEFORE run: ${beforeProfiles}`);

const browser = await chromium.launch({ headless: true });
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });

    // Sign in once per context so the auth cookie is scoped to this
    // viewport's browser instance.
    await signInAsDevAdmin(ctx);

    // A · Owner on own non-discoverable profile · no preview param
    {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/nex-native/u/${OWNER_HANDLE}`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(400);
      const file = `${OUT}/${vp.name}__A-owner-no-preview.png`;
      await page.screenshot({ path: file, fullPage: true });
      const text = await page.locator("body").innerText();
      const hasOwnerBanner = text.includes("PREVIEW ·") && text.includes("not discoverable");
      const hasVisitorBanner = text.includes("VISITOR PREVIEW");
      record(
        `${vp.name} · A · owner no-preview · OwnerPreviewBanner visible · no VisitorPreviewBanner`,
        "owner banner YES · visitor banner NO",
        `owner=${hasOwnerBanner} visitor=${hasVisitorBanner}`,
        hasOwnerBanner && !hasVisitorBanner,
      );
      await page.close();
    }

    // B · Owner on own non-discoverable profile · ?preview=public
    {
      const page = await ctx.newPage();
      await page.goto(
        `${BASE}/nex-native/u/${OWNER_HANDLE}?preview=public`,
        { waitUntil: "networkidle", timeout: 30000 },
      );
      await page.waitForTimeout(400);
      const file = `${OUT}/${vp.name}__B-owner-preview-public.png`;
      await page.screenshot({ path: file, fullPage: true });
      const text = await page.locator("body").innerText();
      const hasOwnerBanner = text.includes("PREVIEW ·") && text.includes("not discoverable");
      const hasVisitorBanner = text.includes("VISITOR PREVIEW");
      record(
        `${vp.name} · B · owner + ?preview=public · VisitorPreviewBanner visible · no OwnerPreviewBanner`,
        "visitor banner YES · owner banner NO",
        `owner=${hasOwnerBanner} visitor=${hasVisitorBanner}`,
        hasVisitorBanner && !hasOwnerBanner,
      );
      await page.close();
    }

    await ctx.close();
  }
} finally {
  await browser.close();
}

// C · Anonymous + ?preview=public MUST still be blocked
const { body: anonBody } = await fetchAnonBody(
  `${BASE}/nex-native/u/${OWNER_HANDLE}?preview=public`,
);
const anonBlocked = isNotFound(anonBody);
const anonLeak = anonBody.includes("Dev Admin") || anonBody.includes(OWNER_HANDLE.replace(/-/g, "")) || anonBody.includes("VISITOR PREVIEW");
record(
  `C · anon + ?preview=public on ${OWNER_HANDLE} · still blocked · no leak`,
  "notFound chrome + no owner content leak",
  `notFound=${anonBlocked} leak=${anonLeak}`,
  anonBlocked && !anonLeak,
);

// D · No DB mutation side-effect of previewing
const afterProfiles = await devAdminSnapshot();
record(
  `D · no profile side-effect · dev-admin profile row count unchanged`,
  `rows = ${beforeProfiles}`,
  `rows = ${afterProfiles}`,
  beforeProfiles === afterProfiles,
);

await pg.end();

const pass = results.filter((r) => r.pass).length;
const fail = results.filter((r) => !r.pass).length;
console.log(`\n  ${pass} passed · ${fail} failed · ${results.length} total`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
if (fail > 0) process.exit(1);
console.log("\n✓ Owner-preview browser verification complete.");
