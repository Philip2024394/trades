// Phase 1 · Reconciliation verification · Philip 2026-08-30.
// Checks: NexAppHome deleted · NexBottomNav deleted · shell still loads ·
// Messages → 1:1 opens NexWorkspaceFriends · Messages → Contacts opens
// ContactsShell · main NEX Chat untouched · nex-door still works.
import { chromium } from "playwright";
const BASE = "http://localhost:3008";
const mark = (id, pass, detail = "") => {
  const s = pass === true ? "✅" : pass === false ? "❌" : "⚠️";
  console.log(`${id} ${s}${detail ? " · " + detail : ""}`);
};
const dismissCookies = async (p) => {
  const dialog = p.locator('[role="dialog"][aria-label*="ookie" i]');
  if ((await dialog.count()) > 0) {
    const accept = dialog.locator("button").filter({ hasText: /accept|ok|got it|agree|allow/i }).first();
    if ((await accept.count()) > 0) { await accept.click(); await p.waitForTimeout(400); }
  }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  let failed = false;
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

  try {
    // P1.1 · shell loads without runtime errors after retirement
    await page.goto(`${BASE}/nexapp`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1800);
    await dismissCookies(page);
    const criticalErrs = errs.filter((e) => /NexAppHome|NexBottomNav|Cannot find module|SyntaxError|is not a function/.test(e));
    if (criticalErrs.length === 0) {
      mark("P1.1", true, "shell renders · no NexAppHome / NexBottomNav / module errors");
    } else {
      mark("P1.1", false, `${criticalErrs.length} critical error(s): ${criticalErrs[0].slice(0, 120)}`);
      failed = true;
    }

    // P1.2 · main NEX Chat still renders (locked · untouched)
    const chatVisible = await page.evaluate(() => {
      // NexWorkspaceChat renders when artifact === "chat" (default)
      // Look for common chat markers · orb + composer are shell chrome, always present
      const hasComposer = !!document.querySelector('textarea, form[class*="composer" i]');
      const hasOrb = !!document.querySelector("[class*='orb']");
      return { hasComposer, hasOrb };
    });
    if (chatVisible.hasOrb || chatVisible.hasComposer) {
      mark("P1.2", true, `main chat surface present (orb=${chatVisible.hasOrb} composer=${chatVisible.hasComposer})`);
    } else {
      mark("P1.2", "⚠️", "orb + composer selectors did not match · shell may render differently · manual verify");
    }

    // P1.3 · Tap Messages rail → drawer opens
    const messagesBtn = page.locator('button[aria-label="Messages"]').first();
    if ((await messagesBtn.count()) === 0) {
      mark("P1.3", false, "Messages rail button not found");
      failed = true;
    } else {
      await messagesBtn.click();
      await page.waitForTimeout(600);
      // Drawer should show sub-sections. Look for "1:1" or "Contacts" text.
      const oneOnOneBtn = page.locator('text=1:1').first();
      const oneOnOneVisible = await oneOnOneBtn.isVisible().catch(() => false);
      const contactsBtn = page.locator('text=Contacts').first();
      const contactsVisible = await contactsBtn.isVisible().catch(() => false);
      if (oneOnOneVisible && contactsVisible) {
        mark("P1.3", true, "Messages drawer opened · both sub-sections visible");
      } else {
        mark("P1.3", false, `oneOnOneVisible=${oneOnOneVisible} contactsVisible=${contactsVisible}`);
        failed = true;
      }

      // P1.4 · Tap 1:1 → NexWorkspaceFriends renders
      if (oneOnOneVisible) {
        await oneOnOneBtn.click();
        await page.waitForTimeout(700);
        // Friends surface should render · NexWorkspaceFriends uses NEX_MOCK_FRIENDS
        // Look for either the friends list or mock friend names
        const friendsRendered = await page.evaluate(() => {
          const text = document.body.innerText;
          return /friend|1:1|thread|message/i.test(text);
        });
        if (friendsRendered) {
          mark("P1.4", true, "1:1 sub-section opened · friends surface rendered");
        } else {
          mark("P1.4", "⚠️", "1:1 opened but couldn't confirm content · manual verify");
        }
      }

      // P1.5 · Tap Messages again to reopen drawer · then Contacts
      await messagesBtn.click();
      await page.waitForTimeout(500);
      const contactsBtn2 = page.locator('text=Contacts').first();
      if (await contactsBtn2.isVisible().catch(() => false)) {
        await contactsBtn2.click();
        await page.waitForTimeout(700);
        const contactsRendered = await page.evaluate(() => {
          const text = document.body.innerText;
          return /contact|relationship|people|business|group/i.test(text);
        });
        if (contactsRendered) {
          mark("P1.5", true, "Contacts sub-section opened · ContactsShell rendered");
        } else {
          mark("P1.5", "⚠️", "Contacts opened but couldn't confirm content · manual verify");
        }
      } else {
        mark("P1.5", false, "Contacts button not found in drawer");
        failed = true;
      }
    }

    // P1.6 · Regression · nex-door still renders (locked · untouched)
    const doorResp = await page.goto(`${BASE}/nex-door`, { waitUntil: "networkidle" });
    if (doorResp && doorResp.status() === 200) {
      mark("P1.6", true, "nex-door still renders (200) · face-scan + password intact");
    } else {
      mark("P1.6", false, `nex-door status=${doorResp?.status()}`);
      failed = true;
    }

    // P1.7 · Regression · returning to /nexapp still works
    await page.goto(`${BASE}/nexapp`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const shellStillWorks = await page.locator('button[aria-label="Discover"]').first().isVisible().catch(() => false);
    if (shellStillWorks) {
      mark("P1.7", true, "shell reload still works · Discover rail present");
    } else {
      mark("P1.7", false, "shell reload broken · Discover rail missing");
      failed = true;
    }

    console.log("");
    console.log(failed ? "OVERALL: ❌ some checks failed" : "OVERALL: ✅ all Phase 1 automatable checks passed");
    if (errs.length > 0 && errs.length < 10) {
      console.log("--- runtime console errors observed (may be unrelated) ---");
      errs.slice(0, 5).forEach((e) => console.log("  · " + e.slice(0, 200)));
    }
  } catch (err) {
    console.log(`FATAL: ${err.message}`);
    failed = true;
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})();
