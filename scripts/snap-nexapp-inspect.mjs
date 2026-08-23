// Inspection variant: dumps computed bounding rects of key elements
// so we can debug layout without staring at pixels.
import { chromium, devices } from "playwright";

const url = "http://localhost:3008/nexapp";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices["iPhone 14 Pro"] });
await ctx.addCookies([{ name: "xrated_cookie_consent", value: "all", url }]);
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const q = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom };
  };
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    logo: q('svg[aria-label="NEX"]'),
    greeting: q('h1, [data-nex-greeting]'),
    frame: (() => {
      const all = document.querySelectorAll("div");
      for (const d of all) {
        const s = getComputedStyle(d);
        if (s.borderRadius === "24px" && s.borderStyle === "solid") {
          const r = d.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom };
        }
      }
      return null;
    })(),
    canvas: q("canvas"),
    nav: q("nav"),
    shortcuts: Array.from(document.querySelectorAll('button[aria-label^="NEX category"]')).map(b => {
      const r = b.getBoundingClientRect();
      return { label: b.getAttribute("aria-label"), x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
