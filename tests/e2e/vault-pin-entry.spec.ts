// tests/e2e/vault-pin-entry.spec.ts
//
// NEX Vault · 6-digit PIN entry · UI-only browser evidence.
// Drives /nex-native/vault at iPhone-13 and iPhone-14-Pro viewports.
//
// Scope: UI foundation only. No cryptography wired up. The mock boundary
// returns "incorrect" by default, or "unavailable" when ?mock=unavailable.
//
// Requires:
//   · Dev server running on NEX_E2E_BASE_URL (default http://localhost:3008)
//   · NEX_E2E_SKIP_WEBSERVER=1 if the dev server is externally managed

import { test, expect, type Page } from "@playwright/test";

const PATH = "/nex-native/vault";

async function fillPin(page: Page, digits: string) {
  const input = page.locator("[data-nex-vault-pin-input]");
  await input.focus();
  await input.pressSequentially(digits, { delay: 15 });
}

async function filledCellCount(page: Page): Promise<number> {
  return await page
    .locator('[data-vault-cell-filled="true"]')
    .count();
}

test.describe("NEX Vault PIN entry · fresh render", () => {
  test("renders the single-line prompt with no technical clutter", async ({ page }) => {
    await page.goto(PATH);

    await expect(page.locator("[data-nex-vault-headline]")).toHaveText(
      "Enter your 6-digit Vault PIN",
    );
    await expect(page.locator("[data-nex-vault-brand]")).toHaveText("NEX Vault");

    const body = await page.locator("body").innerText();
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
        body.toLowerCase(),
        `fresh unlock surface must not surface the word "${word}"`,
      ).not.toContain(word.toLowerCase());
    }
  });

  test("renders exactly 6 empty cells", async ({ page }) => {
    await page.goto(PATH);
    const cells = page.locator("[data-vault-cell]");
    await expect(cells).toHaveCount(6);
    expect(await filledCellCount(page)).toBe(0);
  });

  test("input has numeric inputmode and autocomplete off", async ({ page }) => {
    await page.goto(PATH);
    const input = page.locator("[data-nex-vault-pin-input]");
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await expect(input).toHaveAttribute("autocomplete", "off");
    await expect(input).toHaveAttribute("type", "tel");
  });
});

test.describe("NEX Vault PIN entry · six-digit entry works", () => {
  test("typing five digits fills five cells and does not auto-submit", async ({ page }) => {
    await page.goto(PATH);
    await fillPin(page, "12345");
    expect(await filledCellCount(page)).toBe(5);
    await expect(page.locator("[data-nex-vault-pin-input]")).toHaveAttribute(
      "data-nex-vault-pin-state",
      "entering",
    );
  });

  test("typing six digits transitions through submitting state", async ({ page }) => {
    await page.goto(PATH);
    await fillPin(page, "123456");
    await expect(page.locator("[data-nex-vault-pin-input]")).toHaveAttribute(
      "data-nex-vault-pin-state",
      /submitting|incorrect/,
      { timeout: 3000 },
    );
  });

  test("non-digits are stripped by the reducer on partial input", async ({ page }) => {
    await page.goto(PATH);
    const input = page.locator("[data-nex-vault-pin-input]");
    await input.focus();
    await input.pressSequentially("1a2b3", { delay: 15 });
    expect(await filledCellCount(page)).toBe(3);
    await expect(input).toHaveAttribute(
      "data-nex-vault-pin-state",
      "entering",
    );
  });

  test("more than six digits truncate and auto-submit", async ({ page }) => {
    await page.goto(PATH);
    const input = page.locator("[data-nex-vault-pin-input]");
    await input.focus();
    await input.pressSequentially("1234567890", { delay: 15 });
    await expect(input).toHaveAttribute(
      "data-nex-vault-pin-state",
      /submitting|incorrect/,
      { timeout: 5000 },
    );
  });
});

test.describe("NEX Vault PIN entry · incomplete PIN cannot submit", () => {
  test("5 digits stays in entering state with no feedback", async ({ page }) => {
    await page.goto(PATH);
    await fillPin(page, "12345");
    expect(await filledCellCount(page)).toBe(5);

    await page.waitForTimeout(1500);

    await expect(page.locator("[data-nex-vault-pin-input]")).toHaveAttribute(
      "data-nex-vault-pin-state",
      "entering",
    );
    const feedback = page.locator("[data-nex-vault-pin-feedback]");
    const attr = await feedback.getAttribute("data-nex-vault-pin-feedback");
    expect(attr === "" || attr === null).toBe(true);
  });

  test("pressing Enter with partial PIN does nothing", async ({ page }) => {
    await page.goto(PATH);
    await fillPin(page, "123");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    await expect(page.locator("[data-nex-vault-pin-input]")).toHaveAttribute(
      "data-nex-vault-pin-state",
      "entering",
    );
    const feedback = page.locator("[data-nex-vault-pin-feedback]");
    const attr = await feedback.getAttribute("data-nex-vault-pin-feedback");
    expect(attr === "" || attr === null).toBe(true);
  });
});

test.describe("NEX Vault PIN entry · invalid / mock rejection renders correctly", () => {
  test("incorrect PIN mock surfaces 'Incorrect PIN' and clears input", async ({ page }) => {
    await page.goto(PATH);
    await fillPin(page, "123456");

    const feedback = page.locator("[data-nex-vault-pin-feedback]");
    await expect(feedback).toHaveAttribute(
      "data-nex-vault-pin-feedback",
      "orange",
      { timeout: 8000 },
    );
    await expect(feedback).toHaveText("Incorrect PIN");

    expect(await filledCellCount(page)).toBe(0);
  });

  test("unavailable mock surfaces 'Vault temporarily unavailable' and disables input", async ({
    page,
  }) => {
    await page.goto(`${PATH}?mock=unavailable`);
    await fillPin(page, "123456");

    const feedback = page.locator("[data-nex-vault-pin-feedback]");
    await expect(feedback).toHaveAttribute(
      "data-nex-vault-pin-feedback",
      "mute",
      { timeout: 8000 },
    );
    await expect(feedback).toHaveText("Vault temporarily unavailable");

    const input = page.locator("[data-nex-vault-pin-input]");
    await expect(input).toBeDisabled();
  });

  test("rejection messages do not reveal why the system rejected the attempt", async ({
    page,
  }) => {
    await page.goto(PATH);
    await fillPin(page, "123456");

    const feedback = page.locator("[data-nex-vault-pin-feedback]");
    await expect(feedback).toHaveText("Incorrect PIN", { timeout: 8000 });
    const text = await feedback.innerText();

    const diagnosticWords = [
      "HSM",
      "VMK",
      "KEK",
      "key",
      "cryptographic",
      "argon",
      "database",
      "server",
      "error 500",
      "error 401",
      "exception",
      "stack",
    ];
    for (const word of diagnosticWords) {
      expect(
        text.toLowerCase(),
        `rejection message must not leak diagnostic '${word}'`,
      ).not.toContain(word.toLowerCase());
    }
  });
});

test.describe("NEX Vault PIN entry · PIN never enters URL, title, or storage", () => {
  async function waitForRejection(page: Page) {
    await expect(page.locator("[data-nex-vault-pin-feedback]")).toHaveAttribute(
      "data-nex-vault-pin-feedback",
      /orange|mute/,
      { timeout: 8000 },
    );
  }

  test("after submit, URL does not contain the PIN", async ({ page }) => {
    await page.goto(PATH);
    await fillPin(page, "246813");
    await waitForRejection(page);

    expect(page.url()).not.toContain("246813");
    expect(await page.title()).not.toContain("246813");
  });

  test("localStorage and sessionStorage do not contain the PIN", async ({ page }) => {
    await page.goto(PATH);
    await fillPin(page, "357914");
    await waitForRejection(page);

    const storageHasPin = await page.evaluate((pin) => {
      const local = Object.entries(localStorage).map(([k, v]) => `${k}=${v}`);
      const session = Object.entries(sessionStorage).map(([k, v]) => `${k}=${v}`);
      return [...local, ...session].some((entry) => entry.includes(pin));
    }, "357914");

    expect(storageHasPin).toBe(false);
  });

  test("document cookie does not contain the PIN", async ({ page, context }) => {
    await page.goto(PATH);
    await fillPin(page, "468024");
    await waitForRejection(page);

    const docCookie = await page.evaluate(() => document.cookie);
    expect(docCookie).not.toContain("468024");

    const cookies = await context.cookies();
    for (const cookie of cookies) {
      expect(cookie.value, `cookie ${cookie.name} must not carry the PIN`).not.toContain("468024");
    }
  });
});

test.describe("NEX Vault PIN entry · no network traffic contains the PIN", () => {
  test("no outgoing request body or URL contains the PIN digits", async ({ page }) => {
    const PIN = "571935";
    const leaks: Array<{ url: string; body: string | null }> = [];

    page.on("request", (req) => {
      const url = req.url();
      if (url.includes(PIN)) {
        leaks.push({ url, body: req.postData() });
      } else {
        const body = req.postData();
        if (body && body.includes(PIN)) {
          leaks.push({ url, body });
        }
      }
    });

    await page.goto(PATH);
    await fillPin(page, PIN);
    await expect(page.locator("[data-nex-vault-pin-feedback]")).toHaveAttribute(
      "data-nex-vault-pin-feedback",
      /orange|mute/,
      { timeout: 8000 },
    );

    expect(
      leaks,
      `No request should contain the PIN. Found: ${JSON.stringify(leaks)}`,
    ).toEqual([]);
  });
});
