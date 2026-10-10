// tests/e2e/nex-create-account-proof.spec.ts
//
// Founder reported "page won't open" · this spec proves the exact URL
// is reachable in a real browser and captures a screenshot they can
// compare to what they're seeing.

import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const OUT = path.join(process.cwd(), "tests", "e2e-screenshots", "reset");
try { fs.mkdirSync(OUT, { recursive: true }); } catch { /* noop */ }

const VIEWPORTS: Array<{ label: string; width: number; height: number }> = [
  { label: "375", width: 375, height: 812 },
  { label: "390", width: 390, height: 844 },
  { label: "desktop-1280", width: 1280, height: 800 },
];

for (const vp of VIEWPORTS) {
  test(`Create Account URL is live · ${vp.width}×${vp.height}`, async ({ browser }) => {
    test.skip(test.info().project.name !== "iPhone-13-375", "iPhone-13-375 only");
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies([{
      name: "xrated_cookie_consent",
      value: "all",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    }]);
    const p = await ctx.newPage();
    const resp = await p.goto("/nex-native/create-account", { waitUntil: "networkidle" });
    expect(resp?.status()).toBe(200);
    await expect(p.locator("[data-nex-create-account-form]")).toBeVisible();
    await expect(p.locator("input[name='full_name']")).toBeVisible();
    await expect(p.locator("input[name='email']")).toBeVisible();
    await expect(p.locator("input[name='password']")).toBeVisible();
    await expect(p.locator("button[type='submit']")).toContainText(/Create account|Creating/i);
    await expect(p.locator("a[href='/nex-native/create-account/face']")).toBeVisible();
    await expect(p.getByRole("link", { name: /Sign in/i })).toBeVisible();
    await p.screenshot({ path: path.join(OUT, `create-account-live-${vp.label}.png`), fullPage: true });
    await ctx.close();
  });
}
