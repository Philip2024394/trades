// Slice 3 (Network) + Slice 4 (Studio) verification · Philip 2026-08-30.
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

    // Open MORE
    const kebab = p.locator('button[aria-label="More options"]');
    await kebab.first().click();
    await p.waitForTimeout(500);

    // ── Slice 3 · Network shell-native
    const networkBtn = p.locator('button[aria-label="Network"]').first();
    await networkBtn.click();
    await p.waitForTimeout(800);
    const url1 = p.url();
    if (/[?&]cap=network/.test(url1) && !/\/network$/.test(url1)) {
      mark("S3.1", true, `Network entered as capability · url=${url1.replace(BASE, "")}`);
    } else {
      mark("S3.1", false, `expected /nexapp?cap=network · got ${url1.replace(BASE, "")}`);
      failed = true;
    }

    // Count round buttons for the 7 Network items
    const expected7 = ["People", "Businesses", "Marketplace", "Community", "Referrals", "Affiliates", "Network activity"];
    const found = [];
    for (const label of expected7) {
      // Try aria-label match (label · status pattern)
      const btn = p.locator(`button[aria-label^="${label} ·"]`);
      const c = await btn.count();
      if (c > 0) found.push(label);
    }
    if (found.length === expected7.length) {
      mark("S3.2", true, `all 7 Network round buttons rendered`);
    } else {
      mark("S3.2", false, `missing: ${expected7.filter((l) => !found.includes(l)).join(" · ")}`);
      failed = true;
    }

    // ── Slice 3 · /network SSR redirect
    await p.goto(`${BASE}/network`, { waitUntil: "load", timeout: 30000 });
    await p.waitForTimeout(1200);
    const redirUrl = p.url();
    if (/[?&]cap=network/.test(redirUrl)) {
      mark("S3.3", true, `/network → ${redirUrl.replace(BASE, "")}`);
    } else {
      mark("S3.3", false, `/network landed at ${redirUrl.replace(BASE, "")}`);
      failed = true;
    }

    // ── Slice 4 · Studio hybrid
    await p.goto(`${BASE}/nexapp`, { waitUntil: "load" });
    await p.waitForTimeout(1500);
    await kebab.first().click();
    await p.waitForTimeout(500);
    const studioBtn = p.locator('button[aria-label="Studio"]').first();
    await studioBtn.click();
    await p.waitForTimeout(800);
    const studioUrl = p.url();
    if (/[?&]cap=studio/.test(studioUrl) && !studioUrl.endsWith("/studio")) {
      mark("S4.1", true, `Studio entered as capability · url=${studioUrl.replace(BASE, "")}`);
    } else {
      mark("S4.1", false, `expected /nexapp?cap=studio · got ${studioUrl.replace(BASE, "")}`);
      failed = true;
    }

    // Studio round buttons (6 destinations)
    const expectedStudio = ["App Store", "App Builder", "Templates", "Media", "Publish", "My Apps"];
    const foundStudio = [];
    for (const label of expectedStudio) {
      const btn = p.locator(`button[aria-label^="${label} ·"]`);
      const c = await btn.count();
      if (c > 0) foundStudio.push(label);
    }
    if (foundStudio.length === expectedStudio.length) {
      mark("S4.2", true, `all ${expectedStudio.length} Studio round buttons rendered`);
    } else {
      mark("S4.2", false, `missing: ${expectedStudio.filter((l) => !foundStudio.includes(l)).join(" · ")}`);
      failed = true;
    }

    // Confirm NO sign-in prompt on Studio capability surface
    const signinText = await p.evaluate(() => /sign\s*in|magic\s*link/i.test(document.body.innerText));
    if (!signinText) {
      mark("S4.3", true, "no sign-in / magic-link prompt on Studio capability surface");
    } else {
      mark("S4.3", false, "sign-in text detected on Studio capability surface");
      failed = true;
    }

    // Confirm /studio itself is still reachable (untouched)
    const studioResp = await p.goto(`${BASE}/studio`, { waitUntil: "load", timeout: 30000 });
    if (studioResp && studioResp.status() === 200) {
      mark("S4.4", true, `/studio route preserved (200) · recoverable for advanced authoring`);
    } else {
      mark("S4.4", "⚠️", `/studio returned ${studioResp?.status()}`);
    }

    // Regression · Main NEX Chat untouched
    await p.goto(`${BASE}/nexapp`, { waitUntil: "load" });
    await p.waitForTimeout(1500);
    const orbHere = await p.locator("[class*='orb']").first().isVisible().catch(() => false);
    mark("S3-4.R", orbHere, orbHere ? "main NEX Chat orb intact" : "orb missing after slice");
    if (!orbHere) failed = true;

    // Regression · Tools still shell-native
    await kebab.first().click();
    await p.waitForTimeout(400);
    const toolsBtn = p.locator('button[aria-label="Tools"]').first();
    await toolsBtn.click();
    await p.waitForTimeout(700);
    const toolsUrl = p.url();
    mark("S3-4.R2", /[?&]cap=tools/.test(toolsUrl), `Tools still enters as capability (${toolsUrl.replace(BASE, "")})`);

    // Runtime errors
    const criticalErrs = errs.filter((e) => /Cannot find module|SyntaxError|is not a function|is not defined|TypeError|Uncaught/.test(e));
    mark("S3-4.E", criticalErrs.length === 0, criticalErrs.length ? `${criticalErrs.length} err · ${criticalErrs[0].slice(0, 140)}` : "no critical runtime errors");
    if (criticalErrs.length > 0) failed = true;

    console.log("");
    console.log(failed ? "OVERALL: ❌ some checks failed" : "OVERALL: ✅ all automatable checks passed");
  } catch (e) { console.log(`FATAL: ${e.message}`); failed = true; }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
