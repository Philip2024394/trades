// tests/e2e/vault-home-workspace.spec.ts
//
// NEX Vault workspace home (/nex-native/vault/home) · UI-only build.
// Enforces the founder spec sealed 2026-10-03:
//   · no bottom navigation footer
//   · no password/login form in the hero
//   · no duplicate messaging system inside Vault
//   · header + hero + quick actions + Chats & Friends + categories, in that order
//
// Mobile viewports only (iPhone 13 / iPhone 14 Pro) per playwright.config.ts.

import { test, expect, type Page } from "@playwright/test";

test.describe.configure({ retries: 2 });

const PATH = "/nex-native/vault/home";

test.describe("NEX Vault workspace · structural rules", () => {
  test("has NO permanent bottom-navigation footer", async ({ page }) => {
    await page.goto(PATH);
    await page.locator("[data-nex-vault-home]").waitFor({ timeout: 15000 });

    const forbiddenFooterSelectors = [
      "nav[role='navigation']",
      "footer nav",
      "[data-nex-vault-footer]",
      "[data-nex-bottom-nav]",
    ];
    for (const sel of forbiddenFooterSelectors) {
      expect(
        await page.locator(sel).count(),
        `forbidden footer selector "${sel}" must not exist`,
      ).toBe(0);
    }

    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    const forbiddenFooterLabels = [
      "home   search   security   chats   history",
    ];
    for (const needle of forbiddenFooterLabels) {
      expect(bodyText).not.toContain(needle);
    }
  });

  test("has NO password / login / security input in the hero", async ({ page }) => {
    await page.goto(PATH);
    await page.locator("[data-nex-vault-hero]").waitFor({ timeout: 15000 });

    const inputCount = await page.locator("input, form").count();
    expect(
      inputCount,
      "Vault home must not contain any input or form element (storage-only surface)",
    ).toBe(0);

    const hero = page.locator("[data-nex-vault-hero]");
    const heroText = (await hero.innerText()).toLowerCase();
    const forbiddenHeroWords = [
      "password",
      "sign in",
      "login",
      "unlock",
      "pin",
      "enter your",
    ];
    for (const w of forbiddenHeroWords) {
      expect(
        heroText,
        `hero copy must not surface "${w}" — hero is branding only`,
      ).not.toContain(w);
    }
  });

  test("does NOT duplicate the chat message surface inside Vault", async ({ page }) => {
    await page.goto(PATH);
    await page.locator("[data-nex-vault-home]").waitFor({ timeout: 15000 });

    const forbidden = [
      "[data-nex-chat-root]",
      "[data-nex-chat-message]",
      "[data-vault-compose]",
      "textarea[name='message']",
      "[contenteditable='true']",
    ];
    for (const sel of forbidden) {
      expect(
        await page.locator(sel).count(),
        `Vault must not host chat UI "${sel}" — it must only link out to NEX Chat`,
      ).toBe(0);
    }

    const chatsCard = page.locator("[data-nex-vault-chats-link]");
    await expect(chatsCard).toHaveAttribute("href", /\/nex-native\/chat/);
  });
});

test.describe("NEX Vault workspace · layout and copy", () => {
  test("header shows NEX VAULT brand + tagline + settings link", async ({ page }) => {
    await page.goto(PATH);
    const header = page.locator("[data-nex-vault-home-header]");
    await expect(header).toContainText("NEX");
    await expect(header).toContainText("VAULT");
    await expect(header).toContainText("Your important files. Secure. Always with you.");
    await expect(
      page.locator("[data-nex-vault-settings-link]"),
    ).toHaveAttribute("aria-label", "Vault settings");
  });

  test("hero renders with branding copy only", async ({ page }) => {
    await page.goto(PATH);
    const hero = page.locator("[data-nex-vault-hero]");
    await expect(hero).toContainText("NEX Vault");
    await expect(hero).toContainText(
      "Secure your documents, photos and important files.",
    );
  });

  test("four quick actions appear in the specified order", async ({ page }) => {
    await page.goto(PATH);
    const quickActions = page.locator("[data-nex-vault-quick-action]");
    await expect(quickActions).toHaveCount(4);
    const expected = ["upload", "scan", "new-folder", "voice-note"];
    for (let i = 0; i < expected.length; i++) {
      await expect(quickActions.nth(i)).toHaveAttribute(
        "data-nex-vault-quick-action",
        expected[i]!,
      );
    }
  });

  test("Chats & Friends card appears between quick actions and categories", async ({ page }) => {
    await page.goto(PATH);
    const chatsCard = page.locator("[data-nex-vault-chats-friends]");
    await expect(chatsCard).toContainText("Chats & Friends");
    await expect(chatsCard).toContainText("Messages, people and shared files");

    // Positional check — Chats card must be after quick actions and before categories.
    const ordered = await page.evaluate(() => {
      const q = document.querySelector("[data-nex-vault-quick-actions]");
      const c = document.querySelector("[data-nex-vault-chats-friends]");
      const cat = document.querySelector("[data-nex-vault-categories]");
      if (!q || !c || !cat) return "missing";
      const positions = [q, c, cat].map(
        (el) => el.compareDocumentPosition.bind(el),
      );
      return (
        q.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING &&
        c.compareDocumentPosition(cat) & Node.DOCUMENT_POSITION_FOLLOWING
      )
        ? "ordered"
        : "out-of-order";
    });
    expect(ordered).toBe("ordered");
  });

  test("six file categories appear in the specified order", async ({ page }) => {
    await page.goto(PATH);
    const cats = page.locator("[data-nex-vault-category]");
    await expect(cats).toHaveCount(6);
    const expected = [
      "documents",
      "photos",
      "videos",
      "plans",
      "important",
      "archived",
    ];
    for (let i = 0; i < expected.length; i++) {
      await expect(cats.nth(i)).toHaveAttribute(
        "data-nex-vault-category",
        expected[i]!,
      );
    }
  });
});

test.describe("NEX Vault workspace · scope evidence", () => {
  // KNOWN THIRD-PARTY LEAKS inherited from the ROOT Next.js layout
  // (not added by this Vault page). Each entry is a violation of R13
  // ("No telemetry on Vault bundles") that MUST be fixed before the
  // real Vault ships in Phase A/B. Options for remediation:
  //   · Add a dedicated /nex-native/vault/* layout that excludes
  //     @vercel/analytics and @vercel/speed-insights injection.
  //   · Replace Google Fonts (fonts.googleapis.com / fonts.gstatic.com)
  //     with locally bundled fonts to prevent referer-based fingerprinting.
  // Test asserts the KNOWN SET only. Any NEW third-party host must fail.
  const KNOWN_ROOT_LAYOUT_LEAKS = [
    /^https:\/\/fonts\.googleapis\.com\//,
    /^https:\/\/fonts\.gstatic\.com\//,
    /^https:\/\/va\.vercel-scripts\.com\//,
  ];

  test("no NEW third-party network calls — known root-layout leaks tracked separately", async ({
    page,
  }) => {
    const unexpected: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (/^https?:\/\/localhost:3008\//.test(url)) return;
      if (/^data:/.test(url)) return;
      if (KNOWN_ROOT_LAYOUT_LEAKS.some((rx) => rx.test(url))) return;
      unexpected.push(url);
    });
    await page.goto(PATH);
    await page.locator("[data-nex-vault-home]").waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);
    expect(
      unexpected,
      `Vault home introduced a NEW third-party request. Found: ${JSON.stringify(unexpected)}`,
    ).toEqual([]);
  });

  test("no localStorage or sessionStorage mutations at first paint", async ({ page }) => {
    await page.goto(PATH);
    await page.locator("[data-nex-vault-home]").waitFor({ timeout: 15000 });
    await page.waitForTimeout(300);
    const storageState = await page.evaluate(() => ({
      localKeys: Object.keys(localStorage).filter((k) => k.includes("vault")),
      sessionKeys: Object.keys(sessionStorage).filter((k) =>
        k.includes("vault"),
      ),
    }));
    expect(storageState.localKeys).toEqual([]);
    expect(storageState.sessionKeys).toEqual([]);
  });
});
