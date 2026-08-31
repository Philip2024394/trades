// Slice A · Immersive Mode infrastructure · Philip 2026-08-30.
// Verifies: rail collapses when LIVE is active · orb moves to compact
// position · both restore when exiting to a non-immersive surface.
import { chromium } from "playwright";
const BASE = "http://localhost:3008";
const dismissCookies = async (p) => {
  const d = p.locator('[role="dialog"][aria-label*="ookie" i]');
  if ((await d.count()) > 0) {
    const a = d.locator("button").filter({ hasText: /accept|ok|got it|agree/i }).first();
    if ((await a.count()) > 0) { await a.click(); await p.waitForTimeout(400); }
  }
};
const mark = (id, pass, detail = "") => {
  const s = pass === true ? "✅" : pass === false ? "❌" : "⚠️";
  console.log(`${id} ${s}${detail ? " · " + detail : ""}`);
};

// Grab the orb's rendered bounding rect. We can compare position across
// states to prove the orb moved (perched = top-right, default = elsewhere).
const orbRect = (p) => p.evaluate(() => {
  const el = document.querySelector("[class*='orb']");
  return el ? el.getBoundingClientRect().toJSON() : null;
});

// Walk up the DOM checking each ancestor's computed opacity · returns
// effective opacity (product). hideRail sets the WRAPPER div's opacity
// to 0 · button element itself stays visible. Native visibility check.
const railVisibleCount = (p) => p.evaluate(() => {
  const primary = ["Discover", "Messages", "Activity", "Wallet", "Me"];
  const effectiveOpacity = (el) => {
    let acc = 1;
    let n = el;
    while (n && n instanceof Element) {
      const s = window.getComputedStyle(n);
      if (s.visibility === "hidden" || s.display === "none") return 0;
      const o = parseFloat(s.opacity || "1");
      if (!Number.isNaN(o)) acc *= o;
      if (acc === 0) return 0;
      n = n.parentElement;
    }
    return acc;
  };
  return primary.filter((l) => {
    const el = document.querySelector(`button[aria-label="${l}"]`);
    if (!el) return false;
    return effectiveOpacity(el) > 0.1;
  }).length;
});

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  let failed = false;
  try {
    await p.goto(`${BASE}/nexapp`, { waitUntil: "load", timeout: 45000 });
    await p.waitForTimeout(2500);
    await dismissCookies(p);

    // Baseline · default artifact = chat · rail visible · orb default
    const railBefore = await railVisibleCount(p);
    const orbBefore = await orbRect(p);
    mark("A.1", railBefore === 5, `baseline rail count = ${railBefore} (expect 5 primary buttons visible)`);
    if (railBefore !== 5) failed = true;

    // Navigate to LIVE artifact
    await p.locator('button[aria-label="Discover"]').first().click();
    await p.waitForTimeout(600);
    await p.locator('text=/^LIVE$/').first().click({ force: true, timeout: 5000 });
    await p.waitForTimeout(1800);

    // Immersive · rail should collapse (visible count drops · likely to 0)
    const railDuringLive = await railVisibleCount(p);
    const orbDuringLive = await orbRect(p);
    mark("A.2", railDuringLive < railBefore, `LIVE active · rail visible count dropped ${railBefore}→${railDuringLive}`);
    if (railDuringLive >= railBefore) failed = true;

    // Orb should have moved (perched typically top-right → smaller y or larger x)
    if (orbBefore && orbDuringLive) {
      const moved = Math.abs(orbDuringLive.x - orbBefore.x) > 30 || Math.abs(orbDuringLive.y - orbBefore.y) > 30 || Math.abs(orbDuringLive.width - orbBefore.width) > 20;
      mark("A.3", moved, `orb rect changed: before=(${orbBefore.x.toFixed(0)},${orbBefore.y.toFixed(0)},${orbBefore.width.toFixed(0)}) after=(${orbDuringLive.x.toFixed(0)},${orbDuringLive.y.toFixed(0)},${orbDuringLive.width.toFixed(0)})`);
      if (!moved) failed = true;
    } else {
      mark("A.3", "⚠️", `orb rect unavailable · before=${!!orbBefore} after=${!!orbDuringLive}`);
    }

    // Orb still exists (Persistent Identity Rule · never disappears)
    const orbStillPresent = orbDuringLive !== null;
    mark("A.4", orbStillPresent, orbStillPresent ? "orb still rendered while LIVE (persistent identity)" : "orb disappeared · VIOLATES Persistent Identity Rule");
    if (!orbStillPresent) failed = true;

    // Exit LIVE → return to /nexapp default
    await p.goto(`${BASE}/nexapp`, { waitUntil: "load" });
    await p.waitForTimeout(2000);
    const railAfterExit = await railVisibleCount(p);
    const orbAfterExit = await orbRect(p);
    mark("A.5", railAfterExit === railBefore, `after exit · rail restored to ${railAfterExit} (expect ${railBefore})`);
    if (railAfterExit !== railBefore) failed = true;

    if (orbBefore && orbAfterExit) {
      const restored = Math.abs(orbAfterExit.x - orbBefore.x) < 30 && Math.abs(orbAfterExit.y - orbBefore.y) < 30;
      mark("A.6", restored, `orb returned to default position (${orbAfterExit.x.toFixed(0)},${orbAfterExit.y.toFixed(0)})`);
      if (!restored) failed = true;
    }

    // Regression · going to People (NOT immersive) should keep rail expanded
    await p.locator('button[aria-label="Discover"]').first().click();
    await p.waitForTimeout(600);
    await p.locator('text=/^People$/').first().click({ force: true, timeout: 5000 });
    await p.waitForTimeout(1500);
    const railDuringPeople = await railVisibleCount(p);
    mark("A.7", railDuringPeople === 5, `People (non-immersive) · rail count = ${railDuringPeople} (expect 5)`);
    if (railDuringPeople !== 5) failed = true;

    console.log("");
    console.log(failed ? "OVERALL: ❌ some checks failed" : "OVERALL: ✅ Slice A immersive mode works · rail collapses for LIVE only · orb persists");
  } catch (e) { console.log(`FATAL: ${e.message}`); failed = true; }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
