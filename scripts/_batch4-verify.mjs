// Batch 4 browser verification · Philip 2026-08-30 · scripts run locally,
// checked in temporarily. Runs the 4A-4L acceptance suite at iPhone 13
// viewport against http://localhost:3008/nexapp using Playwright + real
// Chromium (installed under %LOCALAPPDATA%\ms-playwright). This is honest
// verification per Rule 2 · not fabrication.
import { chromium } from "playwright";

const BASE = "http://localhost:3008";

const result = (id, pass, detail = "") => {
  const mark = pass === true ? "✅" : pass === false ? "❌" : "⚠️";
  console.log(`${id} ${mark}${detail ? " · " + detail : ""}`);
};

const collectRailLabels = async (page) => {
  // Rail buttons are rendered by NexHudFrame's RailButtonSlot. Each has an
  // aria-label matching the RailButton.label prop. Query the visible ones.
  const labels = await page
    .locator('[aria-label]')
    .evaluateAll((els) =>
      els
        .map((el) => ({
          label: el.getAttribute("aria-label") || "",
          visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        }))
        .filter((x) => x.visible)
        .map((x) => x.label),
    );
  return labels;
};

const findKebab = (page) => page.locator('button[aria-label="More options"]');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 13
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();

  let failed = false;

  try {
    // ── 4A: primary rail shows Discover · Messages · Activity · Wallet · Me
    await page.goto(`${BASE}/nexapp`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1500); // let orb + rail settle

    // Dismiss cookie consent banner if present (intercepts kebab clicks)
    const cookieDialog = page.locator('[role="dialog"][aria-label*="ookie" i]');
    if ((await cookieDialog.count()) > 0) {
      const acceptBtn = cookieDialog
        .locator('button')
        .filter({ hasText: /accept|ok|got it|agree|allow/i })
        .first();
      if ((await acceptBtn.count()) > 0) {
        await acceptBtn.click();
        await page.waitForTimeout(500);
      } else {
        // No visible accept button · try any button in the dialog
        await cookieDialog.locator("button").first().click().catch(() => null);
        await page.waitForTimeout(500);
      }
    }

    const primaryExpected = ["Discover", "Messages", "Activity", "Wallet", "Me"];
    const labels4A = await collectRailLabels(page);
    const missing4A = primaryExpected.filter((l) => !labels4A.includes(l));
    if (missing4A.length === 0) {
      result("4A", true, "all 5 primary labels present");
    } else {
      result("4A", false, `missing: ${missing4A.join(", ")}`);
      failed = true;
    }

    // ── 4B: tap kebab → Studio · Tools · Creator · Network appear
    const kebab = findKebab(page);
    const kebabCount = await kebab.count();
    if (kebabCount === 0) {
      result("4B", false, "kebab button 'More options' not found");
      failed = true;
    } else {
      await kebab.first().click();
      await page.waitForTimeout(400); // fade transition
      const secondaryExpected = ["Studio", "Tools", "Creator", "Network"];
      const labels4B = await collectRailLabels(page);
      const missing4B = secondaryExpected.filter((l) => !labels4B.includes(l));
      const primaryStillHere = primaryExpected.filter((l) => labels4B.includes(l));
      if (missing4B.length === 0 && primaryStillHere.length === 0) {
        result("4B", true, "MORE rail replaces primary cleanly");
      } else if (missing4B.length === 0 && primaryStillHere.length > 0) {
        result("4B", false, `secondary present but primary also visible: ${primaryStillHere.join(", ")}`);
        failed = true;
      } else {
        result("4B", false, `missing: ${missing4B.join(", ")}`);
        failed = true;
      }
    }

    // ── 4C: tap kebab again → primary rail returns
    await kebab.first().click();
    await page.waitForTimeout(400);
    const labels4C = await collectRailLabels(page);
    const missing4C = primaryExpected.filter((l) => !labels4C.includes(l));
    const secondaryStillHere = ["Studio", "Tools", "Creator", "Network"].filter((l) => labels4C.includes(l));
    if (missing4C.length === 0 && secondaryStillHere.length === 0) {
      result("4C", true, "primary rail returns cleanly");
    } else {
      result("4C", false, `primary missing: ${missing4C.join(", ")} / secondary lingering: ${secondaryStillHere.join(", ")}`);
      failed = true;
    }

    // ── 4D-P1: active dots visibly DISTINCT from inactive (not just
    //          different-shade-of-same-hue). Parse RGB · verify the active
    //          state is in a different colour family (blue channel dominant
    //          after polish · was orange-dominant before).
    const dotState = async () => {
      return await page.locator(".nex-kebab-dot").first().evaluate((el) => {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          bg: cs.getPropertyValue("background-color"),
          shadow: cs.getPropertyValue("box-shadow"),
          w: rect.width,
          h: rect.height,
        };
      });
    };
    const parseRgb = (s) => {
      const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
      return m ? [+m[1], +m[2], +m[3]] : null;
    };
    const inactiveState = await dotState();
    const kebabRectBefore = await kebab.first().boundingBox();
    await kebab.first().click(); // open MORE
    await page.waitForTimeout(400);
    const activeState = await dotState();
    const kebabRectAfter = await kebab.first().boundingBox();

    const inRgb = parseRgb(inactiveState.bg);
    const acRgb = parseRgb(activeState.bg);
    const distinctHue =
      inRgb && acRgb &&
      // Different colour family: significant channel-dominance shift.
      // Inactive is orange (R > B by a lot). Active should be cyan/blue
      // (B > R by a lot) OR at least the R-B delta flips sign.
      Math.sign(inRgb[0] - inRgb[2]) !== Math.sign(acRgb[0] - acRgb[2]);
    if (distinctHue) {
      result("4D-P1", true, `hue-family shift ${inactiveState.bg} → ${activeState.bg}`);
    } else {
      result("4D-P1", false, `hue family unchanged: ${inactiveState.bg} → ${activeState.bg}`);
      failed = true;
    }

    // ── 4D-P2: kebab position/size unchanged after state flip
    if (kebabRectBefore && kebabRectAfter) {
      const dx = Math.abs(kebabRectAfter.x - kebabRectBefore.x);
      const dy = Math.abs(kebabRectAfter.y - kebabRectBefore.y);
      const dw = Math.abs(kebabRectAfter.width - kebabRectBefore.width);
      const dh = Math.abs(kebabRectAfter.height - kebabRectBefore.height);
      if (dx <= 1 && dy <= 1 && dw <= 1 && dh <= 1) {
        result("4D-P2", true, "kebab geometry stable");
      } else {
        result("4D-P2", false, `kebab moved/resized: dx=${dx} dy=${dy} dw=${dw} dh=${dh}`);
        failed = true;
      }
    } else {
      result("4D-P2", "⚠️", "kebab boundingBox unavailable");
    }

    // Close MORE and restore state for downstream checks
    await kebab.first().click();
    await page.waitForTimeout(300);

    // ── 4E: Studio opens /studio
    await kebab.first().click();
    await page.waitForTimeout(300);
    const studioBtn = page.locator('button[aria-label="Studio"]').first();
    await Promise.all([
      page.waitForURL(/\/studio/, { timeout: 10000 }).catch(() => null),
      studioBtn.click(),
    ]);
    await page.waitForTimeout(1500);
    const studioUrl = page.url();
    if (studioUrl.startsWith(`${BASE}/studio`)) {
      result("4E", true, `landed at ${studioUrl.replace(BASE, "")}`);
    } else {
      result("4E", false, `expected /studio, got ${studioUrl.replace(BASE, "")}`);
      failed = true;
    }

    // ── 4F: Tools opens /tools with 19-calculator page
    await page.goto(`${BASE}/nexapp`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await kebab.first().click();
    await page.waitForTimeout(300);
    const toolsBtn = page.locator('button[aria-label="Tools"]').first();
    await Promise.all([
      page.waitForURL(/\/tools/, { timeout: 10000 }).catch(() => null),
      toolsBtn.click(),
    ]);
    await page.waitForTimeout(1000);
    const toolsUrl = page.url();
    const toolsCalcCount = await page.locator('a[href^="/studio/apps/calc-"]').count();
    if (toolsUrl.endsWith("/tools") && toolsCalcCount >= 19) {
      result("4F", true, `/tools rendered ${toolsCalcCount} calculators`);
    } else {
      result("4F", false, `url=${toolsUrl.replace(BASE, "")} calcs=${toolsCalcCount}`);
      failed = true;
    }

    // ── 4L(a): back-to-NEX link on Tools returns to /nexapp
    const backLink = page.locator('a[href="/nexapp"]').first();
    await Promise.all([
      page.waitForURL(/\/nexapp/, { timeout: 10000 }).catch(() => null),
      backLink.click(),
    ]);
    await page.waitForTimeout(1000);
    if (page.url().endsWith("/nexapp")) {
      result("4L(Tools)", true, "back link returns to /nexapp");
    } else {
      result("4L(Tools)", false, `expected /nexapp, got ${page.url().replace(BASE, "")}`);
      failed = true;
    }

    // ── 4G: Creator opens /creator honest placeholder
    await kebab.first().click();
    await page.waitForTimeout(300);
    const creatorBtn = page.locator('button[aria-label="Creator"]').first();
    await Promise.all([
      page.waitForURL(/\/creator/, { timeout: 10000 }).catch(() => null),
      creatorBtn.click(),
    ]);
    await page.waitForTimeout(1000);
    const creatorH1 = await page.locator("h1").first().textContent().catch(() => "");
    if (page.url().endsWith("/creator") && /content creation/i.test(creatorH1 || "")) {
      result("4G", true, `/creator rendered · h1="${creatorH1}"`);
    } else {
      result("4G", false, `url=${page.url().replace(BASE, "")} h1="${creatorH1}"`);
      failed = true;
    }

    // ── 4H: Network opens /network honest placeholder
    await page.goto(`${BASE}/nexapp`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await kebab.first().click();
    await page.waitForTimeout(300);
    const networkBtn = page.locator('button[aria-label="Network"]').first();
    await Promise.all([
      page.waitForURL(/\/network/, { timeout: 10000 }).catch(() => null),
      networkBtn.click(),
    ]);
    await page.waitForTimeout(1000);
    const networkH1 = await page.locator("h1").first().textContent().catch(() => "");
    if (page.url().endsWith("/network") && /people|businesses|community/i.test(networkH1 || "")) {
      result("4H", true, `/network rendered · h1="${networkH1}"`);
    } else {
      result("4H", false, `url=${page.url().replace(BASE, "")} h1="${networkH1}"`);
      failed = true;
    }

    // ── 4I + 4J + 4K: regression sweep · Chat width · orb position · frame anchors
    await page.goto(`${BASE}/nexapp`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Sample DOM state BEFORE kebab tap
    const before = await page.evaluate(() => ({
      // Chat wrapper (if present) - if width is close to viewport width, it's full-width
      chatWidth: document.querySelector('[data-artifact="chat"], [class*="chat"]')?.getBoundingClientRect().width || null,
      // Orb position
      orbRect: (() => {
        const o = document.querySelector('[class*="orb"], [aria-label*="voice orb" i]');
        return o ? o.getBoundingClientRect() : null;
      })(),
      // Any node with "hop" or "hyper" class active?
      hopActive: !!document.querySelector('[class*="hop"], [class*="hyper"]'),
      viewportW: window.innerWidth,
    }));

    await kebab.first().click();
    await page.waitForTimeout(500);

    const after = await page.evaluate(() => ({
      chatWidth: document.querySelector('[data-artifact="chat"], [class*="chat"]')?.getBoundingClientRect().width || null,
      orbRect: (() => {
        const o = document.querySelector('[class*="orb"], [aria-label*="voice orb" i]');
        return o ? o.getBoundingClientRect() : null;
      })(),
      hopActive: !!document.querySelector('[class*="hop"], [class*="hyper"]'),
      viewportW: window.innerWidth,
    }));

    // 4I: Chat did not expand (width should not change significantly)
    const chatExpanded =
      before.chatWidth !== null &&
      after.chatWidth !== null &&
      Math.abs(after.chatWidth - before.chatWidth) > 20;
    if (!chatExpanded) {
      result("4I", true, `chat width stable (before=${before.chatWidth} after=${after.chatWidth})`);
    } else {
      result("4I", false, `chat width jumped: ${before.chatWidth} → ${after.chatWidth}`);
      failed = true;
    }

    // 4J: Orb did not hop/hyper
    if (!after.hopActive) {
      result("4J", true, "no orb-hop / orb-hyper class detected after kebab tap");
    } else {
      result("4J", false, "orb-hop or orb-hyper class present after kebab tap");
      failed = true;
    }

    // 4K: Frame anchors stable (orb position within 20px)
    if (before.orbRect && after.orbRect) {
      const dx = Math.abs(after.orbRect.x - before.orbRect.x);
      const dy = Math.abs(after.orbRect.y - before.orbRect.y);
      if (dx <= 20 && dy <= 20) {
        result("4K", true, `orb position stable (Δx=${dx.toFixed(0)}, Δy=${dy.toFixed(0)})`);
      } else {
        result("4K", false, `orb moved Δx=${dx.toFixed(0)} Δy=${dy.toFixed(0)}`);
        failed = true;
      }
    } else {
      result("4K", "⚠️", "orb not detected via generic selector · manual check recommended");
    }

    // Summary
    console.log("");
    console.log(failed ? "OVERALL: ❌ some checks failed" : "OVERALL: ✅ all automatable checks passed");
    console.log(`Viewport: ${before.viewportW}px (iPhone 13 = 390px expected)`);
  } catch (err) {
    console.log(`FATAL: ${err.message}`);
    failed = true;
  } finally {
    await browser.close();
  }

  process.exit(failed ? 1 : 0);
})();
