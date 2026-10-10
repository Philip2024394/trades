// tests/e2e/nex-directory-detail-page.spec.ts
//
// NEX Directory · Phase A · Detail-page mounting proof.
//
// Scope
//   · Verifies that `GET /nex-native/directory/<canonical_id>` for a
//     real food canonical row renders the two new page-level sections
//     added by this wave:
//       · [data-nex-detail-page-related] "You may also need"
//       · [data-nex-detail-page-claim]   "Claim this listing"
//   · Verifies the claim form intro view is reachable via the
//     `<details><summary>` disclosure, keeping the server-rendered
//     page a simple scroll surface with no client-side state.
//   · Verifies the related-businesses client component mounts and
//     either fetches/renders cards OR surfaces its honest empty state
//     (the sealed component handles both paths; we assert tolerance,
//     not a specific count).
//
// Why fetched-id, not hard-coded
//   The canonical row count and UUIDs drift as ingestion runs. We
//   query the dev DB for any VERIFIED food row at test start · zero
//   fabrication, zero hard-coding.
//
// Dev-server dependency
//   Same as nex-directory.spec.ts · relies on `npm run dev` at port
//   3008 (webServer block in playwright.config.ts, reuseExistingServer:
//   true). A pre-flight probe SKIPs the suite when the server is
//   unreachable rather than hard-failing.

import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import pg from "pg";

const BASE_URL = process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008";
const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "nex-directory-detail-page",
);

function ensureScreenshotDir() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function serverReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE_URL}/nex-native/directory`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    return r.status > 0 && r.status < 500;
  } catch {
    return false;
  }
}

async function fetchAFoodCanonicalId(): Promise<string | null> {
  const conn =
    process.env.NEX_POSTGRES_URL ??
    "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
  const c = new pg.Client({ connectionString: conn });
  try {
    await c.connect();
    const r = await c.query(
      `SELECT canonical_business_id
         FROM nex.business_canonical
        WHERE entity_type = 'food'
          AND lifecycle_state = 'VERIFIED'
        ORDER BY name_canonical
        LIMIT 1`,
    );
    if (r.rows.length === 0) return null;
    return String(r.rows[0].canonical_business_id);
  } catch {
    return null;
  } finally {
    try {
      await c.end();
    } catch {
      /* swallow */
    }
  }
}

test.describe("NEX Directory · detail page · page-level mounts", () => {
  test.beforeAll(async () => {
    const alive = await serverReachable();
    test.skip(
      !alive,
      `SKIPPED · dev server not reachable at ${BASE_URL}. Run \`npm run dev\` on port 3008 (or set NEX_E2E_BASE_URL + NEX_E2E_SKIP_WEBSERVER=1).`,
    );
  });

  test("detail page renders related + claim sections for a food canonical row", async ({
    browser,
  }) => {
    ensureScreenshotDir();

    const canonicalId = await fetchAFoodCanonicalId();
    test.skip(
      canonicalId === null,
      "SKIPPED · no VERIFIED food canonical row available in nex_dev to anchor the test.",
    );

    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 820 },
    });
    try {
      const page = await ctx.newPage();
      const url = `${BASE_URL}/nex-native/directory/${canonicalId}`;
      await page.goto(url, { waitUntil: "networkidle" });

      // Page frame must render.
      await expect(page.locator("[data-nex-directory-detail-page]")).toBeVisible(
        { timeout: 30_000 },
      );
      await expect(
        page.locator(
          `[data-nex-directory-detail-canonical-id="${canonicalId}"]`,
        ),
      ).toBeVisible();

      // ─── Section 1: "You may also need" (related) ──────────────────
      // The outer wrapper must render on any food row (we always mount
      // it · the inner client component handles its own empty state).
      const related = page.locator("[data-nex-detail-page-related]");
      await expect(related).toBeVisible();
      await expect(related).toContainText("You may also need");

      // ─── Section 2: "Claim this listing" ────────────────────────────
      // Mounted on claim_available destinations (VERIFIED + unowned).
      const claim = page.locator("[data-nex-detail-page-claim]");
      await expect(claim).toBeVisible();
      await expect(claim).toContainText("Claim this listing");

      // The disclosure's summary ("Open claim form") must be reachable
      // without any JS state wiring · we are testing the native
      // <details> + <summary> pattern, not a React modal.
      const openClaim = page.locator("[data-nex-detail-page-claim-open]");
      await expect(openClaim).toBeVisible();
      await expect(openClaim).toContainText("Open claim form");

      // Clicking the summary expands <details> and reveals the sealed
      // OwnerClaimForm's intro view. We assert the form region is
      // reachable but tolerate either the full form rendering OR a
      // narrow fallback (OwnerClaimForm has honest-fallback modes for
      // entity_types it cannot adapt).
      await openClaim.click();
      const disclosure = page.locator(
        "[data-nex-detail-page-claim-disclosure]",
      );
      // After click, the <details open> contains the OwnerClaimForm
      // subtree. We prove reachability by waiting for the <details>
      // element's `open` property to flip to true (native HTML
      // boolean attribute · evaluated via element.open, not
      // toHaveAttribute which only reads string attributes).
      await expect
        .poll(
          async () =>
            disclosure.evaluate(
              (el) => (el as HTMLDetailsElement).open === true,
            ),
          { timeout: 5_000 },
        )
        .toBe(true);

      // Screenshot the full page after disclosure open.
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-detail-page-with-sections.png"),
        fullPage: true,
      });

      // Related client component mounts asynchronously. Give it a
      // short window to settle. Either state is acceptable:
      //   · at least one related card renders inside the section
      //   · the sealed empty-state microcopy renders inside the section
      // Both are honest.
      await page.waitForTimeout(1500);
      const relatedInnerText = (await related.innerText()) ?? "";
      // Expect SOMETHING beyond the heading · either the component
      // rendered a message or (eventually) cards.
      expect(relatedInnerText.length).toBeGreaterThan(
        "You may also need".length,
      );
    } finally {
      await ctx.close();
    }
  });
});
