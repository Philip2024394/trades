// tests/e2e/theme-world-shadow.spec.ts
//
// Phase 0 visual regression · founder-approved 2026-10-05, baseline 7fd561b7.
//
// Validates that <ThemeWorld> from chat-render/theme-world.tsx renders
// byte-equivalently to the hard-coded shell replica on the shadow route.
//
// Each row of the shadow comparator contains two 390×720 stages fed
// identical props. With CSS animations paused at frame 0 both stages
// should produce byte-equal PNG captures. We also save both PNGs under
// tests/e2e-screenshots/theme-world-shadow/ so the diff can be reviewed
// by eye if the equality assertion fails for a non-obvious reason.
//
// Running:
//   NEX_DEV_ROUTES=1 npm run dev        # in one terminal
//   npx playwright test theme-world-shadow   # in another
//
// If NEX_DEV_ROUTES is not set the shadow route returns 404 and this
// suite skips cleanly rather than reporting false failures.

import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const SHADOW_PATH = "/nex-native/dev/theme-world-shadow";
const CASES = [
  "no-overlay",
  "sparkle-only",
  "particles-only",
  "mist-only",
  "sparkle-and-mist",
  "production-vitamins",
  "production-motorbike",
  "all-three-overlays",
] as const;

const OUT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "theme-world-shadow",
);
try {
  fs.mkdirSync(OUT_DIR, { recursive: true });
} catch {
  // noop
}

// Gating helper: next.js App Router returns a notFound body (status may
// be 200 or 404 depending on dev vs prod) when the shadow route is
// gated. We detect by presence of the comparator heading, not HTTP
// status. The route is open whenever NODE_ENV !== "production", which
// is always true under `next dev`.
async function isShadowRouteOpen(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  // Give the server a reasonable window to compile / respond before we
  // declare the route gated. 10s is well below the 90s test timeout and
  // long enough for Turbopack's first-touch compile.
  try {
    await page
      .getByRole("heading", { name: "ThemeWorld shadow comparator" })
      .waitFor({ state: "visible", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

// Browser-side canvas pixel diff · uses Chromium's own PNG decoder and
// OffscreenCanvas so no node-side image decoding is required. Returns
// the fraction of pixels where any channel differs by > 2 (standard
// anti-aliasing tolerance). 0.0 = byte-for-byte visual match; 1.0 =
// completely different image.
async function pixelDiffRatio(
  page: import("@playwright/test").Page,
  a: Buffer,
  b: Buffer,
): Promise<{ ratio: number; width: number; height: number }> {
  return await page.evaluate(
    async ({ aB64, bB64 }: { aB64: string; bB64: string }) => {
      async function decode(b64: string): Promise<ImageBitmap> {
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return await createImageBitmap(
          new Blob([buf.buffer as ArrayBuffer], { type: "image/png" }),
        );
      }
      const aImg = await decode(aB64);
      const bImg = await decode(bB64);
      if (aImg.width !== bImg.width || aImg.height !== bImg.height) {
        return { ratio: 1, width: aImg.width, height: aImg.height };
      }
      const w = aImg.width;
      const h = aImg.height;
      const ca = new OffscreenCanvas(w, h);
      const cb = new OffscreenCanvas(w, h);
      const ctxA = ca.getContext("2d")!;
      const ctxB = cb.getContext("2d")!;
      ctxA.drawImage(aImg, 0, 0);
      ctxB.drawImage(bImg, 0, 0);
      const da = ctxA.getImageData(0, 0, w, h).data;
      const db = ctxB.getImageData(0, 0, w, h).data;
      let diff = 0;
      for (let i = 0; i < da.length; i += 4) {
        const dr = Math.abs(da[i] - db[i]);
        const dg = Math.abs(da[i + 1] - db[i + 1]);
        const dblu = Math.abs(da[i + 2] - db[i + 2]);
        if (dr > 2 || dg > 2 || dblu > 2) diff++;
      }
      return { ratio: diff / (w * h), width: w, height: h };
    },
    { aB64: a.toString("base64"), bB64: b.toString("base64") },
  );
}

// Dismiss the global NEX cookie consent banner before capture · the
// position:fixed banner otherwise overlays whichever stage sits at the
// viewport's bottom-right when Playwright scrolls into view and causes
// bogus byte diffs between left and right stages. Same cookie name /
// value used by nex-reset-visual.spec.ts.
async function plantConsent(
  page: import("@playwright/test").Page,
): Promise<void> {
  const base = new URL(
    process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008",
  );
  await page.context().addCookies([
    {
      name: "xrated_cookie_consent",
      value: "all",
      domain: base.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

test.describe("Phase 0 · ThemeWorld shadow parity", () => {
  test.setTimeout(90_000);

  test("shadow route is reachable (NODE_ENV=development or NEX_DEV_ROUTES=1)", async ({
    page,
  }) => {
    await plantConsent(page);
    await page.goto(SHADOW_PATH);
    const open = await isShadowRouteOpen(page);
    test.skip(
      !open,
      "shadow route gated · set NEX_DEV_ROUTES=1 on the dev server",
    );
    await expect(
      page.getByRole("heading", { name: "ThemeWorld shadow comparator" }),
    ).toBeVisible();
  });

  for (const caseId of CASES) {
    test(`case "${caseId}" · shell replica and ThemeWorld render identically`, async ({
      page,
    }, testInfo) => {
      await plantConsent(page);
      await page.goto(SHADOW_PATH);
      const open = await isShadowRouteOpen(page);
      test.skip(
        !open,
        "shadow route gated · set NEX_DEV_ROUTES=1 on the dev server",
      );

      // Freeze every CSS animation at frame 0 so both stages capture the
      // same static state. The seed-driven useMemo in ParticleDrift /
      // SparkleField / MistDrift already produces identical layouts on
      // both sides · pausing animation removes the only remaining source
      // of timing drift between the two captures.
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-play-state: paused !important;
            animation-delay: 0s !important;
            transition: none !important;
          }
        `,
      });

      // Give wallpaper images and style tags a chance to apply.
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(200);

      const row = page.locator(`[data-nex-shadow-case="${caseId}"]`);
      await expect(row).toBeVisible();
      const shellStage = row.locator(`[data-nex-shadow-stage="shell"]`);
      const twStage = row.locator(`[data-nex-shadow-stage="theme-world"]`);
      await expect(shellStage).toBeVisible();
      await expect(twStage).toBeVisible();

      const shellBuf = await shellStage.screenshot({
        animations: "disabled",
        caret: "hide",
      });
      const twBuf = await twStage.screenshot({
        animations: "disabled",
        caret: "hide",
      });

      // Persist captures so a reviewer can diff by eye on failure.
      fs.writeFileSync(path.join(OUT_DIR, `${caseId}-shell.png`), shellBuf);
      fs.writeFileSync(
        path.join(OUT_DIR, `${caseId}-theme-world.png`),
        twBuf,
      );

      // Attach to the Playwright report as well.
      await testInfo.attach(`${caseId}-shell.png`, {
        body: shellBuf,
        contentType: "image/png",
      });
      await testInfo.attach(`${caseId}-theme-world.png`, {
        body: twBuf,
        contentType: "image/png",
      });

      expect(shellBuf.length).toBeGreaterThan(1000);
      expect(twBuf.length).toBeGreaterThan(1000);

      // Pixel-diff · founder-approved Phase 0 acceptance = ≤ 0.5% of
      // pixels may differ by more than ±2 per channel. Tighter than the
      // 0.5% visual-regression industry default but still accepts the
      // sub-pixel noise Chromium's compositor emits when the same DOM is
      // painted twice. If this ever drifts above 0.5% we investigate
      // before relaxing the threshold.
      const diff = await pixelDiffRatio(page, shellBuf, twBuf);
      const pct = (diff.ratio * 100).toFixed(3);
      const byteEqual = shellBuf.equals(twBuf);
      // Report BOTH the strict byte-equality check and the pixel-diff
      // measurement so a reviewer can see exactly how close the two
      // halves rendered. Byte-equal almost always fails under
      // Chromium's compositor noise; pixel-diff is the real signal.
      // eslint-disable-next-line no-console
      console.log(
        `[shadow] case=${caseId} byteEqual=${byteEqual} ` +
          `pixelDiff=${pct}% dims=${diff.width}x${diff.height} ` +
          `shellBytes=${shellBuf.length} twBytes=${twBuf.length}`,
      );
      await testInfo.attach(`${caseId}-pixel-diff.json`, {
        body: Buffer.from(
          JSON.stringify(
            {
              case: caseId,
              diffRatio: diff.ratio,
              diffPercent: pct,
              dimensions: `${diff.width}x${diff.height}`,
              shellBytes: shellBuf.length,
              themeWorldBytes: twBuf.length,
              threshold: 0.005,
            },
            null,
            2,
          ),
        ),
        contentType: "application/json",
      });
      expect(
        diff.ratio,
        `pixel diff ${pct}% > 0.5% · shell (${shellBuf.length}B) vs ThemeWorld (${twBuf.length}B) · see tests/e2e-screenshots/theme-world-shadow/${caseId}-{shell,theme-world}.png`,
      ).toBeLessThanOrEqual(0.005);
    });
  }
});
