// Discover → LIVE → Feed → LIVE → People → LIVE → Chat → LIVE swap cycle
// Philip 2026-08-30 · captures any React warning/error that fires during
// rapid artifact swaps inside the NEX shell.
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

// Capture EVERYTHING · React warnings show up as console.error or console.warn
const errs = [];
const warns = [];
p.on("pageerror", (e) => errs.push({ type: "pageerror", text: String(e) }));
p.on("console", (m) => {
  const t = m.type();
  const txt = m.text();
  if (t === "error") errs.push({ type: "console.error", text: txt });
  else if (t === "warn" || t === "warning") warns.push({ type: "console.warn", text: txt });
});

// Reset shell then open Discover drawer then tap sub-section by exact text.
// Reset ensures no prior artifact content (Feed posts · People profiles ·
// LIVE video chrome) intercepts pointer events on the drawer row.
const swapVia = async (label) => {
  await p.goto(`${BASE}/nexapp`, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  await p.locator('button[aria-label="Discover"]').first().click();
  await p.waitForTimeout(600);
  const row = p.locator(`text=/^${label}$/`).first();
  await row.click({ timeout: 8000 });
  await p.waitForTimeout(1200);
};

try {
  await p.goto(`${BASE}/nexapp`, { waitUntil: "load", timeout: 45000 });
  await p.waitForTimeout(2500);
  await dismissCookies(p);
  console.log("--- baseline (default chat) ---");
  const baselineErrs = errs.length;
  const baselineWarns = warns.length;
  console.log(`errors before test: ${baselineErrs} · warnings before test: ${baselineWarns}`);

  await swapVia("LIVE");   console.log("step 1 → LIVE");
  await swapVia("Feed");   console.log("step 2 → Feed");
  await swapVia("LIVE");   console.log("step 3 → LIVE");
  await swapVia("People"); console.log("step 4 → People");
  await swapVia("LIVE");   console.log("step 5 → LIVE");
  // Step 6 · to Chat = reset to /nexapp default artifact
  await p.goto(`${BASE}/nexapp`, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  console.log("step 6 → Chat (default)");
  await swapVia("LIVE");   console.log("step 7 → LIVE");

  await p.waitForTimeout(1500);

  // ── PASS 2 · in-shell rapid swap · no reset · force-click drawer rows.
  // This is the TRUE persistent-shell scenario where lifecycle bugs surface.
  console.log("");
  console.log("--- PASS 2 · in-shell rapid swap · no reset ---");
  const errsBeforePass2 = errs.length;
  const warnsBeforePass2 = warns.length;

  const rapidTap = async (label) => {
    await p.locator('button[aria-label="Discover"]').first().click();
    await p.waitForTimeout(400);
    const row = p.locator(`text=/^${label}$/`).first();
    // force:true bypasses actionability · needed because active artifact
    // content (Feed cards · People profiles) may sit over drawer rows.
    await row.click({ force: true, timeout: 5000 });
    await p.waitForTimeout(700);
  };
  const seq = ["LIVE", "Feed", "LIVE", "People", "LIVE", "Feed", "LIVE"];
  for (let i = 0; i < seq.length; i++) {
    try {
      await rapidTap(seq[i]);
      console.log(`  pass2 step ${i + 1} → ${seq[i]}`);
    } catch (e) {
      console.log(`  pass2 step ${i + 1} → ${seq[i]} · click FAILED (${(e.message).slice(0, 80)})`);
    }
  }
  await p.waitForTimeout(1500);

  const pass2Errs = errs.slice(errsBeforePass2);
  const pass2Warns = warns.slice(warnsBeforePass2);
  const pass2RelevantErrs = pass2Errs.filter((e) =>
    /React|setState|state update|unmount|hasn't mounted|effect|Cannot read|TypeError/i.test(e.text)
    && !/Vercel|Speed Insights|Analytics/i.test(e.text)
  );
  const pass2RelevantWarns = pass2Warns.filter((w) =>
    /React|setState|state update|unmount|hasn't mounted|effect/i.test(w.text)
    && !/Vercel|Speed Insights|Analytics/i.test(w.text)
  );
  console.log(`  pass2 · new errors: ${pass2Errs.length} · relevant: ${pass2RelevantErrs.length}`);
  console.log(`  pass2 · new warnings: ${pass2Warns.length} · relevant: ${pass2RelevantWarns.length}`);
  pass2RelevantErrs.slice(0, 3).forEach((e) => console.log(`    ERR: ${e.text.slice(0, 200)}`));
  pass2RelevantWarns.slice(0, 3).forEach((w) => console.log(`    WARN: ${w.text.slice(0, 200)}`));
  if (pass2RelevantErrs.length === 0 && pass2RelevantWarns.length === 0) {
    console.log("  ✅ PASS 2 CLEAN · true in-shell swap produced no React lifecycle warnings");
  } else {
    console.log("  ❌ PASS 2 · lifecycle warnings during in-shell swap");
  }

  const newErrs = errs.slice(baselineErrs);
  const newWarns = warns.slice(baselineWarns);

  console.log("");
  console.log(`--- results ---`);
  console.log(`new errors during swap cycle: ${newErrs.length}`);
  console.log(`new warnings during swap cycle: ${newWarns.length}`);

  // Filter out unrelated Vercel/HMR noise
  const relevantErrs = newErrs.filter((e) =>
    /React|setState|state update|unmount|hasn't mounted|effect|Cannot read|TypeError/i.test(e.text)
    && !/Vercel|Speed Insights|Analytics/i.test(e.text)
  );
  const relevantWarns = newWarns.filter((w) =>
    /React|setState|state update|unmount|hasn't mounted|effect/i.test(w.text)
    && !/Vercel|Speed Insights|Analytics/i.test(w.text)
  );

  if (relevantErrs.length === 0 && relevantWarns.length === 0) {
    console.log("✅ CLEAN · no React lifecycle warnings/errors during full swap cycle");
  } else {
    console.log(`❌ ${relevantErrs.length} relevant error(s) · ${relevantWarns.length} relevant warning(s)`);
    relevantErrs.slice(0, 5).forEach((e) => console.log(`  ERR [${e.type}]: ${e.text.slice(0, 220)}`));
    relevantWarns.slice(0, 5).forEach((w) => console.log(`  WARN [${w.type}]: ${w.text.slice(0, 220)}`));
  }
} catch (e) {
  console.log(`FATAL: ${e.message}`);
}
await browser.close();
