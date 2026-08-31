// Slice B · Food Directory · verification.
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
const railVisibleCount = (p) => p.evaluate(() => {
  const primary = ["Discover", "Messages", "Activity", "Wallet", "Me"];
  const eff = (el) => {
    let a = 1, n = el;
    while (n && n instanceof Element) {
      const s = window.getComputedStyle(n);
      if (s.visibility === "hidden" || s.display === "none") return 0;
      const o = parseFloat(s.opacity || "1");
      if (!Number.isNaN(o)) a *= o;
      if (a === 0) return 0;
      n = n.parentElement;
    }
    return a;
  };
  return primary.filter((l) => {
    const el = document.querySelector(`button[aria-label="${l}"]`);
    return el ? eff(el) > 0.1 : false;
  }).length;
});
const orbRect = (p) => p.evaluate(() => {
  const el = document.querySelector("[class*='orb']");
  return el ? el.getBoundingClientRect().toJSON() : null;
});

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

    // B.1 · Discover drawer shows Businesses
    await p.locator('button[aria-label="Discover"]').first().click();
    await p.waitForTimeout(600);
    const bizRow = p.locator("text=/^Businesses$/").first();
    const bizVis = await bizRow.isVisible().catch(() => false);
    mark("B.1", bizVis, "Businesses sub-section visible in Discover drawer");
    if (!bizVis) failed = true;

    // B.2 · Tap Businesses → artifact renders inside shell
    await bizRow.click({ force: true, timeout: 5000 });
    await p.waitForTimeout(1800);
    const foodHeader = await p.locator("text=/FOOD.*YOGYAKARTA/i").first().isVisible().catch(() => false);
    mark("B.2", foodHeader, "Food · Yogyakarta header visible inside shell");
    if (!foodHeader) failed = true;

    // B.3 · Immersive mode kicked in · rail collapsed
    const railDuringBiz = await railVisibleCount(p);
    mark("B.3", railDuringBiz === 0, `rail collapsed (visible count = ${railDuringBiz} · expect 0)`);
    if (railDuringBiz !== 0) failed = true;

    // B.4 · Orb still rendered (Persistent Identity Rule) · perched top-right
    const orbDuring = await orbRect(p);
    mark("B.4", orbDuring !== null, orbDuring ? `orb rendered at (${orbDuring.x.toFixed(0)},${orbDuring.y.toFixed(0)}) · ${orbDuring.width.toFixed(0)}px wide` : "orb missing · VIOLATES identity rule");
    if (!orbDuring) failed = true;

    // B.5 · Restaurant cards rendered (5 mock restaurants · look for names)
    const names = ["Gudeg Yu Djum", "Warung Legi", "Café Bunga", "Nasi Padang Sederhana", "Ayam Geprek Jogja"];
    const foundNames = [];
    for (const n of names) {
      const el = p.locator(`text=/${n.replace(/\s+/g, ".*")}/`).first();
      if (await el.isVisible().catch(() => false)) foundNames.push(n);
    }
    mark("B.5", foundNames.length === names.length, `${foundNames.length}/${names.length} restaurant cards rendered`);
    if (foundNames.length !== names.length) failed = true;

    // B.6 · Tap View button on first card → detail view (expand-forward)
    const firstCard = p.locator("button[aria-label*='View Gudeg']").first();
    if ((await firstCard.count()) > 0) {
      await firstCard.click();
      await p.waitForTimeout(1200);
      const detailBack = await p.locator("button[aria-label*='Back to Food']").first().isVisible().catch(() => false);
      const askNex = await p.locator("button[aria-label*='Ask NEX']").first().isVisible().catch(() => false);
      const urlAfter = p.url();
      const stillInShell = urlAfter.startsWith(`${BASE}/nexapp`);
      mark("B.6", detailBack && askNex && stillInShell, `detail: back=${detailBack} askNex=${askNex} inShell=${stillInShell}`);
      if (!(detailBack && askNex && stillInShell)) failed = true;

      // B.7 · Back returns to list without ejecting
      await p.locator("button[aria-label*='Back to Food']").first().click();
      await p.waitForTimeout(800);
      const listAgain = await p.locator("text=/Discover amazing places to eat/i").first().isVisible().catch(() => false);
      mark("B.7", listAgain, "back returns to list view without navigation");
      if (!listAgain) failed = true;
    } else {
      mark("B.6", false, "no restaurant card found");
      failed = true;
    }

    // B.8 · Exit via kebab (new immersive-exit affordance) → rail restores
    // In immersive mode the rail is invisible so Discover is unreachable ·
    // user's only exit is the kebab · confirms rail restores after exit.
    await p.locator('button[aria-label="More options"]').first().click();
    await p.waitForTimeout(1200);
    const railAfterExit = await railVisibleCount(p);
    mark("B.8", railAfterExit === 5, `kebab exit restored rail to 5 buttons (got ${railAfterExit})`);
    if (railAfterExit !== 5) failed = true;

    // B.9 · No critical runtime errors
    const critical = errs.filter((e) => /Cannot find module|SyntaxError|TypeError|Uncaught|hasn't mounted/.test(e));
    mark("B.9", critical.length === 0, critical.length ? `${critical.length} err · ${critical[0].slice(0, 140)}` : "no critical runtime errors");
    if (critical.length > 0) failed = true;

    console.log("");
    console.log(failed ? "OVERALL: ❌" : "OVERALL: ✅ Slice B Food Directory works · four roles preserved");
  } catch (e) { console.log(`FATAL: ${e.message}`); failed = true; }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
