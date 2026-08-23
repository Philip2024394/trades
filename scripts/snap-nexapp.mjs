// One-shot screenshot script for /nexapp — mobile viewport, ~iPhone 14 Pro.
// Run: node scripts/snap-nexapp.mjs
import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const url = process.env.SNAP_URL || "http://localhost:3008/nexapp";
const out = process.env.SNAP_OUT || "C:\\Users\\Victus\\AppData\\Local\\Temp\\nexref\\nexapp-render.png";

await mkdir(join(out, "..").replace(/\\[^\\]+$/, ""), { recursive: true }).catch(() => {});

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  ...devices["iPhone 14 Pro"],
  reducedMotion: "no-preference",
});
// Pre-consent cookies so the CookieConsentBanner never renders.
// (Site reads `xrated_cookie_consent` from document.cookie.)
await ctx.addCookies([{
  name: "xrated_cookie_consent",
  value: "all",
  url: url,
}]);

const page = await ctx.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1500); // let particle canvas + fonts settle

// Fallback: if a cookie banner still appears, click Accept.
try {
  const acceptBtn = await page.$('button:has-text("Accept")');
  if (acceptBtn) {
    await acceptBtn.click();
    await page.waitForTimeout(400);
  }
} catch {}

await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log("wrote", out);
