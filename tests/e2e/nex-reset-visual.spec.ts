// tests/e2e/nex-reset-visual.spec.ts
//
// Founder HARD RESET · 2026-09-25.
// Forensic screenshots ONLY: Landing Page and Create Account at
// 375×812 · 390×844 · desktop. Also samples a computed background
// color at the bottom edge to prove/disprove the gray-overlay claim.
// Nothing else. No feature work.

import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const OUT = path.join(process.cwd(), "tests", "e2e-screenshots", "reset");
try { fs.mkdirSync(OUT, { recursive: true }); } catch { /* noop */ }
const shot = (n: string) => path.join(OUT, n);

async function plantConsent(page: import("@playwright/test").Page): Promise<void> {
  const base = new URL(process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008");
  await page.context().addCookies([{
    name: "xrated_cookie_consent",
    value: "all",
    domain: base.hostname,
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  }]);
}

async function sampleColor(page: import("@playwright/test").Page, y: number): Promise<string> {
  // Ask the page to inspect the element at x=viewportCenter, y=y and
  // return its computed background-color chain.
  return await page.evaluate((yy) => {
    const el = document.elementFromPoint(window.innerWidth / 2, yy) as HTMLElement | null;
    if (!el) return "no-element";
    let cur: HTMLElement | null = el;
    const parts: string[] = [];
    while (cur) {
      const cs = getComputedStyle(cur);
      parts.push(`${cur.tagName}${cur.className ? "." + cur.className.toString().split(" ").slice(0,3).join(".") : ""}=${cs.backgroundColor}`);
      cur = cur.parentElement;
      if (parts.length > 6) break;
    }
    return parts.join(" → ");
  }, y);
}

test.describe("NEX HARD RESET · forensic Landing + Create Account", () => {
  test.setTimeout(120_000);

  for (const [projectName, w, h] of [
    ["iPhone-13-375", 375, 812],
    ["iPhone-14-Pro-393", 390, 844],
    ["desktop", 1280, 800],
  ] as const) {
    test(`${w}×${h} · landing + create-account`, async ({ browser }) => {
      const running = test.info().project.name;
      const wants = projectName;
      test.skip(running !== wants, `runs only under ${wants}`);
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await plantConsent(page);

      // 1 · /nex-native (Landing Page target)
      const landingResp = await page.goto("/nex-native", { waitUntil: "networkidle" });
      await page.screenshot({ path: shot(`landing-${w}x${h}.png`), fullPage: true });
      const landingFinalUrl = page.url();
      const landingBottomColor = await sampleColor(page, h - 20);
      const landingMidColor = await sampleColor(page, Math.floor(h / 2));

      // 2 · /nex-native/conversations (Create Account gate)
      await page.goto("/nex-native/conversations", { waitUntil: "networkidle" });
      await page.screenshot({ path: shot(`create-account-${w}x${h}.png`), fullPage: true });
      const caBottomColor = await sampleColor(page, h - 20);
      const caMidColor = await sampleColor(page, Math.floor(h / 2));

      // Expand the details/summary control so the actual sign-up fields
      // are visible in the screenshot (Founder complaint: "make me hunt for it").
      const summary = page.locator("summary", { hasText: /Create one/i });
      if (await summary.count() > 0) {
        await summary.click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: shot(`create-account-expanded-${w}x${h}.png`), fullPage: true });
      }

      // Report in test log
      console.log(JSON.stringify({
        viewport: `${w}x${h}`,
        landing_status: landingResp?.status(),
        landing_final_url: landingFinalUrl,
        landing_bottom_dom: landingBottomColor,
        landing_mid_dom: landingMidColor,
        create_account_bottom_dom: caBottomColor,
        create_account_mid_dom: caMidColor,
      }, null, 2));

      expect(landingFinalUrl).toContain("/nex-native/conversations");
      await ctx.close();
    });
  }
});
