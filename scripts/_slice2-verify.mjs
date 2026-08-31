import { chromium } from "playwright";
const BASE = "http://localhost:3008";
const mark = (id, pass, detail = "") => {
  const s = pass === true ? "✅" : pass === false ? "❌" : "⚠️";
  console.log(`${id} ${s}${detail ? " · " + detail : ""}`);
};
const dismissCookies = async (p) => {
  const d = p.locator('[role="dialog"][aria-label*="ookie" i]');
  if ((await d.count()) > 0) {
    const a = d.locator("button").filter({ hasText: /accept|ok|got it|agree/i }).first();
    if ((await a.count()) > 0) { await a.click(); await p.waitForTimeout(400); }
  }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  let failed = false;
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

  try {
    await p.goto(`${BASE}/nexapp`, { waitUntil: "load", timeout: 45000 });
    await p.waitForTimeout(2500);
    await dismissCookies(p);
    await p.locator('button[aria-label="More options"]').first().click();
    await p.waitForTimeout(500);
    const creatorBtn = p.locator('button[aria-label="Creator"]').first();
    await creatorBtn.click();
    await p.waitForTimeout(1000);
    const url = p.url();
    mark("S2.1", /[?&]cap=creator/.test(url) && !url.endsWith("/creator"), `url=${url.replace(BASE, "")}`);
    if (!/[?&]cap=creator/.test(url)) failed = true;

    const expected = ["AI Writer", "Image Editor", "Video Creator", "Social", "Content Gen", "Marketing", "SEO"];
    const found = [];
    for (const label of expected) {
      const btn = p.locator(`button[aria-label^="${label} ·"]`);
      if ((await btn.count()) > 0) found.push(label);
    }
    mark("S2.2", found.length === expected.length, found.length === expected.length ? `all ${expected.length} Creator round buttons rendered` : `missing: ${expected.filter(l=>!found.includes(l)).join(" · ")}`);
    if (found.length !== expected.length) failed = true;

    // SSR redirect
    await p.goto(`${BASE}/creator`, { waitUntil: "load", timeout: 30000 });
    await p.waitForTimeout(1200);
    const redirUrl = p.url();
    mark("S2.3", /[?&]cap=creator/.test(redirUrl), `/creator → ${redirUrl.replace(BASE, "")}`);
    if (!/[?&]cap=creator/.test(redirUrl)) failed = true;

    // Regression: main chat orb intact
    await p.goto(`${BASE}/nexapp`, { waitUntil: "load" });
    await p.waitForTimeout(1500);
    const orb = await p.locator("[class*='orb']").first().isVisible().catch(() => false);
    mark("S2.R", orb, orb ? "main NEX Chat orb intact" : "orb missing");
    if (!orb) failed = true;

    // Regression: Network still shell-native
    await p.locator('button[aria-label="More options"]').first().click();
    await p.waitForTimeout(400);
    await p.locator('button[aria-label="Network"]').first().click();
    await p.waitForTimeout(800);
    const netUrl = p.url();
    mark("S2.R2", /[?&]cap=network/.test(netUrl), `Network still enters as capability (${netUrl.replace(BASE, "")})`);

    // Runtime errors
    const critical = errs.filter((e) => /Cannot find module|SyntaxError|TypeError|Uncaught/.test(e));
    mark("S2.E", critical.length === 0, critical.length ? `${critical.length} err · ${critical[0].slice(0, 140)}` : "no critical runtime errors");
    if (critical.length > 0) failed = true;

    console.log("");
    console.log(failed ? "OVERALL: ❌" : "OVERALL: ✅ all Slice 2 checks passed");
  } catch (e) { console.log(`FATAL: ${e.message}`); failed = true; }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
