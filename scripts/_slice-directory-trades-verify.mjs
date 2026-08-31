// B-wide · Trades vertical · deliberate architecture stress test.
// Trades entities are people/companies, not venues. If NexDirectorySurface
// renders them as beautifully as Food/Hotels via descriptor only, the
// abstraction is genuinely strong and Marketplace/Mobility/Rentals/Services
// can proceed as pure descriptor registrations.
//
// Additional test focus vs Hotels:
//   · Vertical-specific status labels ("Available now" / "Booked today" /
//     "Fully booked") replace food-shaped defaults — proves descriptor
//     evolution path works without a per-vertical UI file.
//   · Vertical-specific detail actions (Call / WhatsApp / Request quote)
//     replace food's Menu/Directions/WhatsApp — proves detailActions
//     descriptor path.
//   · Provider-shaped entity subtitle ("Plumber · 8 yrs") — proves the
//     subtitle field is genuinely generic.
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

    // T.1 · Discover drawer shows Trades sub-section (new · after Hotels)
    await p.locator('button[aria-label="Discover"]').first().click();
    await p.waitForTimeout(600);
    const tradesRow = p.locator("text=/^Trades$/").first();
    const tradesVis = await tradesRow.isVisible().catch(() => false);
    mark("T.1", tradesVis, "Trades sub-section visible in Discover drawer");
    if (!tradesVis) failed = true;

    // T.2 · Tap Trades → NexDirectorySurface renders with tradesVertical
    await tradesRow.click({ force: true, timeout: 5000 });
    await p.waitForTimeout(1800);
    const header = await p.locator("text=/TRADES.*YOGYAKARTA/i").first().isVisible().catch(() => false);
    const prompt = await p.locator("text=/What needs fixing today/i").first().isVisible().catch(() => false);
    mark("T.2", header && prompt, `header=${header} prompt=${prompt} · shared surface language`);
    if (!(header && prompt)) failed = true;

    // T.3 · Immersive rail collapse (shared with Food/Hotels)
    const railDuring = await railVisibleCount(p);
    mark("T.3", railDuring === 0, `rail collapsed (visible count = ${railDuring})`);
    if (railDuring !== 0) failed = true;

    // T.4 · 5 provider cards rendered · provider-shaped names + subtitles
    const names = ["Budi Santoso", "Rina Sari", "CV Karya Utama", "Andi Wirawan", "Setiawan Kaca"];
    const found = [];
    for (const n of names) {
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const el = p.locator(`text=/${escaped}/`).first();
      if (await el.isVisible().catch(() => false)) found.push(n);
    }
    mark("T.4", found.length === names.length, `${found.length}/${names.length} provider cards rendered`);
    if (found.length !== names.length) failed = true;

    // T.5 · Provider-shaped subtitle (proves subtitle field is genuinely generic)
    const bodyText = await p.evaluate(() => document.body.innerText);
    const plumber = /Plumber/.test(bodyText);
    const electrician = /Electrician/.test(bodyText);
    mark("T.5", plumber && electrician, `provider subtitles rendered: Plumber=${plumber} Electrician=${electrician}`);
    if (!(plumber && electrician)) failed = true;

    // T.6 · Trades-specific STATUS LABELS replace food-shaped defaults.
    //       Proves descriptor evolution path works without per-vertical UI.
    const availableNow = /Available now/i.test(bodyText);
    const bookedToday = /Booked today/i.test(bodyText);
    const fullyBooked = /Fully booked/i.test(bodyText);
    const openNowLeak = /Open now/i.test(bodyText); // food-shaped default MUST NOT leak into trades
    mark("T.6", availableNow && bookedToday && fullyBooked && !openNowLeak,
      `descriptor-driven status labels · Available=${availableNow} Booked=${bookedToday} Fully=${fullyBooked} · food default leak=${openNowLeak}`);
    if (!(availableNow && bookedToday && fullyBooked && !openNowLeak)) failed = true;

    // T.7 · Card-level Ask NEX uses shared aria pattern
    const cardAsk = p.locator("button[aria-label='Ask NEX about Budi Santoso']").first();
    const cardAskVis = await cardAsk.isVisible().catch(() => false);
    mark("T.7", cardAskVis, `card-level Ask NEX button visible=${cardAskVis}`);
    if (!cardAskVis) failed = true;

    // T.8 · Tap View → detail via shared DirectoryDetail · Trades-specific actions
    await p.locator("button[aria-label='View Budi Santoso']").first().click();
    await p.waitForTimeout(1000);
    const back = await p.locator("button[aria-label='Back to Trades listings']").first().isVisible().catch(() => false);
    const askNex = await p.locator("button[aria-label='Ask NEX about Budi Santoso']").first().isVisible().catch(() => false);
    const callAction = await p.locator("button[aria-label='Call · coming soon']").first().isVisible().catch(() => false);
    const quoteAction = await p.locator("button[aria-label='Request quote · coming soon']").first().isVisible().catch(() => false);
    mark("T.8", back && askNex && callAction && quoteAction,
      `detail · back=${back} askNex=${askNex} · Trades-specific: Call=${callAction} Quote=${quoteAction}`);
    if (!(back && askNex && callAction && quoteAction)) failed = true;

    // T.9 · Ask NEX attaches provider context + type/submit → backend
    await p.locator("button[aria-label='Ask NEX about Budi Santoso']").first().click();
    await p.waitForTimeout(1500);
    const pillTalking = await p.locator("text=/Talking about/i").first().isVisible().catch(() => false);
    const pillName = await p.locator("text=/Budi Santoso/").first().isVisible().catch(() => false);
    const railAfter = await railVisibleCount(p);
    mark("T.9", pillTalking && pillName && railAfter === 5, `pill=${pillTalking} name=${pillName} rail=${railAfter}`);
    if (!(pillTalking && pillName && railAfter === 5)) failed = true;

    const composer = p.locator('textarea, input[type="text"]').first();
    if (await composer.isVisible().catch(() => false)) {
      await composer.click();
      await composer.fill("Is this trade available this afternoon?");
      await composer.press("Enter");
      await p.waitForTimeout(2500);
      const contextInBackend = backendBodies.some((b) => /\[BUSINESS CONTEXT\]/.test(b.body) && /Budi Santoso/.test(b.body));
      mark("T.10", contextInBackend, `${backendBodies.length} backend POST(s) · [BUSINESS CONTEXT] with provider name=${contextInBackend}`);
      if (!contextInBackend) failed = true;
    } else {
      mark("T.10", false, "composer not visible");
      failed = true;
    }

    // T.11 · Regression · Food + Hotels still use their OWN status labels
    // (proves the statusLabels default fall-through works)
    await p.goto(`${BASE}/nexapp`, { waitUntil: "load" });
    await p.waitForTimeout(1500);
    await p.locator('button[aria-label="Discover"]').first().click();
    await p.waitForTimeout(500);
    await p.locator("text=/^Businesses$/").first().click({ force: true, timeout: 5000 });
    await p.waitForTimeout(1500);
    const foodBody = await p.evaluate(() => document.body.innerText);
    // Philip 2026-08-30 · pill uses textTransform: uppercase per world-class
    // spec so innerText returns "OPEN NOW". Case-insensitive match.
    const foodOpenNow = /Open now/i.test(foodBody);          // food SHOULD have "Open now"
    const foodAvailableLeak = /Available now/i.test(foodBody); // trades label MUST NOT leak into food
    mark("T.11", foodOpenNow && !foodAvailableLeak,
      `Food defaults: Open now=${foodOpenNow} · trades label leak=${foodAvailableLeak}`);
    if (!(foodOpenNow && !foodAvailableLeak)) failed = true;

    // T.E · No critical runtime errors
    const critical = errs.filter((e) => /Cannot find module|SyntaxError|TypeError|Uncaught|hasn't mounted/.test(e));
    mark("T.E", critical.length === 0, critical.length ? `${critical.length} err · ${critical[0].slice(0, 140)}` : "no critical runtime errors");
    if (critical.length > 0) failed = true;

    console.log("");
    console.log(failed ? "OVERALL: ❌" : "OVERALL: ✅ Trades vertical · person/company entities represented beautifully via descriptor only · statusLabels evolution works · abstraction remains strong · Marketplace/Mobility/Rentals/Services unblocked");
  } catch (e) { console.log(`FATAL: ${e.message}`); failed = true; }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
