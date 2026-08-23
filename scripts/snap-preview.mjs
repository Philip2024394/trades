// Screenshot the /nexapp/preview harness at a real desktop resolution.
import { chromium } from "playwright";

const url = "http://localhost:3008/nexapp/preview";
const out = "C:\\Users\\Victus\\AppData\\Local\\Temp\\nexref\\preview-render.png";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await ctx.addCookies([{ name: "xrated_cookie_consent", value: "all", url }]);
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
// give the iframe time to fully paint (particles + fonts)
await page.waitForTimeout(2200);
await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log("wrote", out);
