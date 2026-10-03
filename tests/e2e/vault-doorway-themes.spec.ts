// tests/e2e/vault-doorway-themes.spec.ts
//
// NEX Vault · one-doorway-per-theme rule (vault-research.md §10.0.1).
// Each theme has its own Vault doorway page. The simplicity principle
// (§10.0 · "Enter your 6-digit Vault PIN", no technical clutter) and
// the PIN-leakage protections must hold for EVERY theme's doorway.
//
// This parametrised suite drives all four doorway routes and asserts
// the invariants are theme-independent.

import { test, expect, type Page } from "@playwright/test";

// Dev-mode Next.js + Turbopack can first-compile slowly on long test
// runs. Retry twice before failing to absorb that jitter without
// masking real correctness bugs (each test passes in isolation).
test.describe.configure({ retries: 2 });

interface ThemeCase {
  slug: string;
  path: string;
  brandLabel: string;
}

const THEMES: ThemeCase[] = [
  { slug: "nex", path: "/nex-native/vault", brandLabel: "NEX Vault" },
  { slug: "joker", path: "/nex-native/vault/joker", brandLabel: "Joker Vault" },
  {
    slug: "haunted-hotel",
    path: "/nex-native/vault/haunted-hotel",
    brandLabel: "Haunted Hotel Vault",
  },
  {
    slug: "pink-dream",
    path: "/nex-native/vault/pink-dream",
    brandLabel: "Pink Dream Vault",
  },
];

async function fillPin(page: Page, digits: string) {
  const input = page.locator("[data-nex-vault-pin-input]");
  await input.focus();
  await input.pressSequentially(digits, { delay: 15 });
}

// Pre-warm each route so dev-mode Turbopack first-compile does not
// collide with the 15-second feedback timeout on the first visit.
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const t of THEMES) {
    await page.goto(t.path);
    await page.locator("[data-nex-vault-headline]").waitFor({
      timeout: 30000,
    });
  }
  await ctx.close();
});

for (const t of THEMES) {
  test.describe(`NEX Vault doorway · ${t.slug}`, () => {
    test("renders with its own theme slug tagged", async ({ page }) => {
      await page.goto(t.path);
      await expect(page.locator("[data-nex-vault-root]")).toHaveAttribute(
        "data-nex-vault-theme",
        t.slug,
      );
    });

    test("renders exactly the single-line prompt", async ({ page }) => {
      await page.goto(t.path);
      await expect(page.locator("[data-nex-vault-headline]")).toHaveText(
        "Enter your 6-digit Vault PIN",
      );
      await expect(page.locator("[data-nex-vault-brand]")).toHaveText(
        t.brandLabel,
      );
    });

    test("no technical clutter leaks into the doorway, regardless of theme", async ({ page }) => {
      await page.goto(t.path);
      const body = (await page.locator("body").innerText()).toLowerCase();
      const forbidden = [
        "VMK",
        "KEK",
        "HSM",
        "Argon2id",
        "Argon2",
        "encryption",
        "cryptographic",
        "key hierarchy",
        "recovery phrase",
        "device enrolment",
        "device management",
        "audit log",
        "export",
        "diagnostic",
        "security level",
      ];
      for (const word of forbidden) {
        expect(
          body,
          `[${t.slug}] theme doorway must not surface "${word}"`,
        ).not.toContain(word.toLowerCase());
      }
    });

    test("renders exactly 6 empty cells", async ({ page }) => {
      await page.goto(t.path);
      await expect(page.locator("[data-vault-cell]")).toHaveCount(6);
      expect(
        await page.locator('[data-vault-cell-filled="true"]').count(),
      ).toBe(0);
    });

    test("PIN mechanics work identically across themes · auto-submit → incorrect", async ({ page }) => {
      await page.goto(t.path);
      await fillPin(page, "123456");

      const feedback = page.locator("[data-nex-vault-pin-feedback]");
      await expect(feedback).toHaveAttribute(
        "data-nex-vault-pin-feedback",
        "orange",
        { timeout: 15000 },
      );
      await expect(feedback).toHaveText("Incorrect PIN");
      expect(
        await page.locator('[data-vault-cell-filled="true"]').count(),
      ).toBe(0);
    });

    test("unavailable mock surfaces identically across themes", async ({ page }) => {
      await page.goto(`${t.path}?mock=unavailable`);
      await fillPin(page, "123456");

      const feedback = page.locator("[data-nex-vault-pin-feedback]");
      await expect(feedback).toHaveAttribute(
        "data-nex-vault-pin-feedback",
        "mute",
        { timeout: 15000 },
      );
      await expect(feedback).toHaveText("Vault temporarily unavailable");
      await expect(page.locator("[data-nex-vault-pin-input]")).toBeDisabled();
    });

    test("PIN never leaks via URL, storage, cookies, or network", async ({
      page,
      context,
    }) => {
      const PIN = "739204";
      const leaks: Array<{ url: string; body: string | null }> = [];
      page.on("request", (req) => {
        const url = req.url();
        const body = req.postData();
        if (url.includes(PIN) || (body && body.includes(PIN))) {
          leaks.push({ url, body });
        }
      });

      await page.goto(t.path);
      await fillPin(page, PIN);
      await expect(page.locator("[data-nex-vault-pin-feedback]")).toHaveAttribute(
        "data-nex-vault-pin-feedback",
        /orange|mute/,
        { timeout: 15000 },
      );

      expect(page.url()).not.toContain(PIN);
      expect(await page.title()).not.toContain(PIN);

      const storageHit = await page.evaluate((pin) => {
        const l = Object.entries(localStorage).map(([k, v]) => `${k}=${v}`);
        const s = Object.entries(sessionStorage).map(([k, v]) => `${k}=${v}`);
        return [...l, ...s].some((e) => e.includes(pin));
      }, PIN);
      expect(storageHit).toBe(false);

      const docCookie = await page.evaluate(() => document.cookie);
      expect(docCookie).not.toContain(PIN);
      const cookies = await context.cookies();
      for (const c of cookies) {
        expect(c.value).not.toContain(PIN);
      }

      expect(
        leaks,
        `[${t.slug}] theme must not leak PIN. Found: ${JSON.stringify(leaks)}`,
      ).toEqual([]);
    });
  });
}
