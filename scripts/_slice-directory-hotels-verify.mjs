// Directory Surface step 3 · Hotels vertical verification.
// Proves the shared NexDirectorySurface primitive works with a data-only
// registration (hotelsVertical) exactly as it does with Food (foodVertical).
// If this passes AND Slice B + Slice C2 still pass, the abstraction holds
// and B-wide (Marketplace/Mobility/Rentals/etc.) can proceed as descriptor
// registrations only.
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

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  let failed = false;
  const errs = [];
  const backendBodies = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.route("**/api/**", async (route) => {
    const req = route.request();
    const url = req.url();
    if (/nex.*(chat|conv|converse|voice)/i.test(url) && req.method() === "POST") {
      try { backendBodies.push({ url, body: req.postData() || "" }); } catch { /* noop */ }
    }
    await route.continue();
  });

  try {
    await p.goto(`${BASE}/nexapp`, { waitUntil: "load", timeout: 45000 });
    await p.waitForTimeout(2500);
    await dismissCookies(p);

    // H.1 · Discover drawer shows Hotels sub-section (new · after Businesses)
    await p.locator('button[aria-label="Discover"]').first().click();
    await p.waitForTimeout(600);
    const hotelsRow = p.locator("text=/^Hotels$/").first();
    const hotelsVis = await hotelsRow.isVisible().catch(() => false);
    mark("H.1", hotelsVis, "Hotels sub-section visible in Discover drawer");
    if (!hotelsVis) failed = true;

    // H.2 · Tap Hotels → NexDirectorySurface renders with hotelsVertical
    await hotelsRow.click({ force: true, timeout: 5000 });
    await p.waitForTimeout(1800);
    const hotelsHeader = await p.locator("text=/HOTELS.*YOGYAKARTA/i").first().isVisible().catch(() => false);
    const hotelsPrompt = await p.locator("text=/Where would you like to stay/i").first().isVisible().catch(() => false);
    mark("H.2", hotelsHeader && hotelsPrompt, `header=${hotelsHeader} prompt=${hotelsPrompt} · same layout language as Food`);
    if (!(hotelsHeader && hotelsPrompt)) failed = true;

    // H.3 · Immersive mode kicked in · rail collapsed (same as Food)
    const railDuring = await railVisibleCount(p);
    mark("H.3", railDuring === 0, `rail collapsed (visible count = ${railDuring})`);
    if (railDuring !== 0) failed = true;

    // H.4 · 5 hotel cards rendered
    const names = ["Meliá Purosani", "Greenhost Boutique", "Greenhouse Hostel Malioboro", "The Phoenix Hotel", "Jambuluwuk Malioboro"];
    const found = [];
    for (const n of names) {
      const el = p.locator(`text=/${n.replace(/\s+/g, ".*").replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === "." || m === "*") ? m : "\\" + m)}/`).first();
      if (await el.isVisible().catch(() => false)) found.push(n);
    }
    mark("H.4", found.length === names.length, `${found.length}/${names.length} hotel cards rendered`);
    if (found.length !== names.length) failed = true;

    // H.5 · Card-level Ask NEX button uses shared aria-label pattern
    const cardAsk = p.locator("button[aria-label='Ask NEX about Meliá Purosani']").first();
    const cardAskVis = await cardAsk.isVisible().catch(() => false);
    mark("H.5", cardAskVis, `card-level Ask NEX button uses shared aria pattern (visible=${cardAskVis})`);
    if (!cardAskVis) failed = true;

    // H.6 · Tap View → detail view via shared DirectoryDetail
    await p.locator("button[aria-label='View Meliá Purosani']").first().click();
    await p.waitForTimeout(1000);
    const detailBack = await p.locator("button[aria-label='Back to Hotels listings']").first().isVisible().catch(() => false);
    const detailAskNex = await p.locator("button[aria-label='Ask NEX about Meliá Purosani']").first().isVisible().catch(() => false);
    // Detail action row · Book/Directions/WhatsApp specific to Hotels vertical
    const bookDisabled = await p.locator("button[aria-label='Book · coming soon']").first().isVisible().catch(() => false);
    mark("H.6", detailBack && detailAskNex && bookDisabled, `detail: back=${detailBack} askNex=${detailAskNex} vertical-specific 'Book' action=${bookDisabled}`);
    if (!(detailBack && detailAskNex && bookDisabled)) failed = true;

    // H.7 · Ask NEX attaches context + exits immersive to chat (shared flow)
    await p.locator("button[aria-label='Ask NEX about Meliá Purosani']").first().click();
    await p.waitForTimeout(1500);
    const pillTalking = await p.locator("text=/Talking about/i").first().isVisible().catch(() => false);
    const pillName = await p.locator("text=/Meliá Purosani/").first().isVisible().catch(() => false);
    const railAfter = await railVisibleCount(p);
    mark("H.7", pillTalking && pillName && railAfter === 5, `pill=${pillTalking} name=${pillName} rail restored=${railAfter}`);
    if (!(pillTalking && pillName && railAfter === 5)) failed = true;

    // H.8 · Type + submit · backend receives [BUSINESS CONTEXT] with hotel name
    const composer = p.locator('textarea, input[type="text"]').first();
    if (await composer.isVisible().catch(() => false)) {
      await composer.click();
      await composer.fill("Is this a good pick for two nights?");
      await composer.press("Enter");
      await p.waitForTimeout(2500);
      const contextInBackend = backendBodies.some((b) => /\[BUSINESS CONTEXT\]/.test(b.body) && /Meliá Purosani/.test(b.body));
      mark("H.8", contextInBackend, `${backendBodies.length} backend POST(s) · context prefix + hotel name in body=${contextInBackend}`);
      if (!contextInBackend) failed = true;
    } else {
      mark("H.8", false, "composer not visible");
      failed = true;
    }

    // H.9 · Regression · Food still lands on FOOD header from separate sub-section
    await p.goto(`${BASE}/nexapp`, { waitUntil: "load" });
    await p.waitForTimeout(1500);
    await p.locator('button[aria-label="Discover"]').first().click();
    await p.waitForTimeout(500);
    await p.locator("text=/^Businesses$/").first().click({ force: true, timeout: 5000 });
    await p.waitForTimeout(1500);
    const foodHeader = await p.locator("text=/FOOD.*YOGYAKARTA/i").first().isVisible().catch(() => false);
    mark("H.9", foodHeader, `Food vertical still renders correctly (no cross-vertical bleed): header=${foodHeader}`);
    if (!foodHeader) failed = true;

    // H.E · No critical runtime errors
    const critical = errs.filter((e) => /Cannot find module|SyntaxError|TypeError|Uncaught|hasn't mounted/.test(e));
    mark("H.E", critical.length === 0, critical.length ? `${critical.length} err · ${critical[0].slice(0, 140)}` : "no critical runtime errors");
    if (critical.length > 0) failed = true;

    console.log("");
    console.log(failed ? "OVERALL: ❌" : "OVERALL: ✅ Hotels vertical · abstraction proven · NexDirectorySurface is reusable · B-wide unblocked");
  } catch (e) { console.log(`FATAL: ${e.message}`); failed = true; }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
