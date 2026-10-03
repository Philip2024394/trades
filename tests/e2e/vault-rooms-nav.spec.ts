// tests/e2e/vault-rooms-nav.spec.ts
//
// Stage 2 · Vault room navigation + settings destination.
// Enforces:
//   · every category card opens its real route
//   · Chats & Friends card routes to the Vault chats room
//     (NOT to the main NEX inbox)
//   · back arrow returns to Vault home
//   · settings page has only genuinely implemented controls
//   · quick actions are disabled with honest "not-yet-available" state
//   · no fake success messages, no dead cards
//
// NO file-storage or crypto expectations here · Stage 4/5 territory.

import { test, expect, type Page } from "@playwright/test";

test.describe.configure({ retries: 2 });

const HOME = "/nex-native/vault/home";
const SETTINGS = "/nex-native/vault/settings";

interface RoomCase {
  cardSelector: string;
  expectedUrl: RegExp;
  expectedTitle: string;
  expectedSubtitle: string;
  expectedEmptyTitle: string;
}

const ROOMS: RoomCase[] = [
  {
    cardSelector: '[data-nex-vault-chats-link]',
    expectedUrl: /\/nex-native\/vault\/home\/chats$/,
    expectedTitle: "Vault · Chats & Friends",
    expectedSubtitle: "Private chats",
    expectedEmptyTitle: "No private chats yet",
  },
  {
    cardSelector: '[data-nex-vault-category="documents"]',
    expectedUrl: /\/nex-native\/vault\/home\/documents$/,
    expectedTitle: "Documents",
    expectedSubtitle: "Contracts, manuals, reports",
    expectedEmptyTitle: "No documents yet",
  },
  {
    cardSelector: '[data-nex-vault-category="photos"]',
    expectedUrl: /\/nex-native\/vault\/home\/photos$/,
    expectedTitle: "Photos",
    expectedSubtitle: "Site photos, designs, reference",
    expectedEmptyTitle: "No photos yet",
  },
  {
    cardSelector: '[data-nex-vault-category="videos"]',
    expectedUrl: /\/nex-native\/vault\/home\/videos$/,
    expectedTitle: "Videos",
    expectedSubtitle: "Site videos, training, walkthroughs",
    expectedEmptyTitle: "No videos yet",
  },
  {
    cardSelector: '[data-nex-vault-category="plans"]',
    expectedUrl: /\/nex-native\/vault\/home\/plans$/,
    expectedTitle: "Plans & Drawings",
    expectedSubtitle: "PDFs, CAD, technical drawings",
    expectedEmptyTitle: "No plans or drawings yet",
  },
  {
    cardSelector: '[data-nex-vault-category="important"]',
    expectedUrl: /\/nex-native\/vault\/home\/important$/,
    expectedTitle: "Important",
    expectedSubtitle: "Items you flag as important",
    expectedEmptyTitle: "Nothing marked important yet",
  },
  {
    cardSelector: '[data-nex-vault-category="archived"]',
    expectedUrl: /\/nex-native\/vault\/home\/archived$/,
    expectedTitle: "Archived",
    expectedSubtitle: "Older files, backups",
    expectedEmptyTitle: "Nothing archived yet",
  },
];

for (const r of ROOMS) {
  test.describe(`Vault room nav · ${r.expectedTitle}`, () => {
    test("card opens the real room route from home", async ({ page }) => {
      await page.goto(HOME);
      await page.locator(r.cardSelector).click();
      await expect(page).toHaveURL(r.expectedUrl, { timeout: 10000 });
    });

    test("room renders its shell title + subtitle", async ({ page }) => {
      await page.goto(HOME);
      await page.locator(r.cardSelector).click();
      await expect(page.locator("[data-nex-vault-room-title]")).toHaveText(
        r.expectedTitle,
      );
      await expect(page.locator("[data-nex-vault-room-subtitle]")).toHaveText(
        r.expectedSubtitle,
      );
    });

    test("room renders an empty state (no fake data)", async ({ page }) => {
      await page.goto(HOME);
      await page.locator(r.cardSelector).click();
      await expect(
        page.locator("[data-nex-vault-empty-state] h2"),
      ).toHaveText(r.expectedEmptyTitle);
    });

    test("back arrow returns to Vault home", async ({ page }) => {
      await page.goto(HOME);
      await page.locator(r.cardSelector).click();
      await expect(page).toHaveURL(r.expectedUrl);
      await page.locator("[data-nex-vault-room-back]").click();
      await expect(page).toHaveURL(/\/nex-native\/vault\/home$/, {
        timeout: 10000,
      });
    });
  });
}

test.describe("Vault home · quick actions are honestly disabled", () => {
  const quickActions = ["upload", "scan", "new-folder", "voice-note"];

  for (const key of quickActions) {
    test(`${key} is disabled with 'not-yet-available' state`, async ({ page }) => {
      await page.goto(HOME);
      const btn = page.locator(`[data-nex-vault-quick-action="${key}"]`);
      await expect(btn).toBeDisabled();
      await expect(btn).toHaveAttribute(
        "data-nex-vault-quick-action-state",
        "not-yet-available",
      );
    });
  }
});

test.describe("Vault settings · honest controls only", () => {
  test("header renders expected title", async ({ page }) => {
    await page.goto(SETTINGS);
    await expect(page.locator("[data-nex-vault-settings-title]")).toHaveText(
      "Vault settings",
    );
  });

  test("exactly four settings rows render", async ({ page }) => {
    await page.goto(SETTINGS);
    const rows = page.locator("[data-nex-vault-settings-row]");
    await expect(rows).toHaveCount(4);
    const expected = ["door-theme", "lock-vault", "back-to-nex", "terms"];
    for (let i = 0; i < expected.length; i++) {
      await expect(rows.nth(i)).toHaveAttribute(
        "data-nex-vault-settings-row",
        expected[i]!,
      );
    }
  });

  test("no fake security / recovery / device / encryption controls appear", async ({
    page,
  }) => {
    await page.goto(SETTINGS);
    const body = (await page.locator("body").innerText()).toLowerCase();

    // These must NOT appear as if they were implemented controls on this page.
    // We allow them in the honesty footer ("will appear here when the real
    // security architecture ships") because the footer explicitly says they
    // are NOT present today.
    const settingsList = page.locator("[data-nex-vault-settings-list]");
    const settingsListText = (await settingsList.innerText()).toLowerCase();

    const forbiddenInList = [
      "encryption",
      "end-to-end",
      "recover",
      "biometric",
      "device management",
      "enrol",
      "enroll",
    ];
    for (const w of forbiddenInList) {
      expect(
        settingsListText,
        `settings list must not advertise unimplemented control "${w}"`,
      ).not.toContain(w);
    }

    // The honesty footer MUST appear, and MUST acknowledge the PIN is a prototype.
    expect(body).toContain("prototype");
    expect(body).toContain("account authentication");
  });

  test("back arrow returns to Vault home", async ({ page }) => {
    await page.goto(SETTINGS);
    await page.locator("[data-nex-vault-settings-back]").click();
    await expect(page).toHaveURL(/\/nex-native\/vault\/home$/, {
      timeout: 10000,
    });
  });

  test("every settings row has a real href (no dead links)", async ({ page }) => {
    await page.goto(SETTINGS);
    const rows = page.locator("[data-nex-vault-settings-row]");
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const href = await rows.nth(i).getAttribute("href");
      expect(href, `settings row ${i} must have a non-empty href`).toBeTruthy();
      expect(href).toMatch(/^\/nex-native\//);
    }
  });
});

test.describe("Vault home · settings icon destination", () => {
  test("settings link in the home header opens the real settings page", async ({ page }) => {
    await page.goto(HOME);
    await page.locator("[data-nex-vault-settings-link]").click();
    await expect(page).toHaveURL(/\/nex-native\/vault\/settings$/, {
      timeout: 10000,
    });
    await expect(page.locator("[data-nex-vault-settings-title]")).toHaveText(
      "Vault settings",
    );
  });
});
