// Universal Discovery · Campaign A targeted reprove
// Philip 2026-09-06 · isolate the full chat → card → detail → interested → outbox flow
// with a much larger dev-mode compile budget on /nex-app/chat.

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here    = path.dirname(fileURLToPath(import.meta.url));
const shotDir = path.join(here, "_universal_discovery_slice_screenshots");
mkdirSync(shotDir, { recursive: true });
const CHAT_URL = "http://localhost:3008/nex-app/chat";

async function gotoChat(page) {
  await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 360_000 });
  await page.waitForSelector('textarea[placeholder="Ask Nex anything…"]', { state: "attached", timeout: 240_000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      const t = (b.textContent || "").trim();
      if (/^(Accept|Accept all|Got it|Agree|OK)$/i.test(t)) { try { b.click(); } catch {} }
    }
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    for (const n of document.querySelectorAll("*")) {
      const el = n instanceof HTMLElement ? n : null; if (!el) continue;
      const s = window.getComputedStyle(el);
      if (s.position !== "fixed" && s.position !== "sticky") continue;
      const text = (el.innerText || "").trim();
      if (/We use cookies|cookie preferences|cookie consent/i.test(text)) el.style.display = "none";
    }
    const nextErr = document.querySelector('[data-nextjs-toast]') || document.querySelector('nextjs-portal');
    if (nextErr instanceof HTMLElement) nextErr.style.display = "none";
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.locator('textarea[placeholder="Ask Nex anything…"]').scrollIntoViewIfNeeded({ timeout: 10_000 });
  await page.waitForTimeout(300);
}

async function sendMessage(page, text) {
  const ta = page.locator('textarea[placeholder="Ask Nex anything…"]');
  await ta.scrollIntoViewIfNeeded({ timeout: 10_000 });
  await ta.click({ force: true, timeout: 30_000 });
  await ta.fill("");
  await ta.fill(text);
  for (let a = 0; a < 3; a++) {
    if ((await ta.inputValue()) === text) break;
    await page.waitForTimeout(200);
    if (a === 2) { await ta.fill(text); await page.waitForTimeout(300); }
  }
  const p1 = page.waitForResponse(
    (r) => r.url().includes("/api/nex-conv/chat") && r.request().method() === "POST",
    { timeout: 90_000 },
  ).catch(() => null);
  await ta.press("Enter");
  const resp = await p1;
  if (!resp) {
    await page.waitForTimeout(400);
    await ta.fill(text);
    const p2 = page.waitForResponse((r) => r.url().includes("/api/nex-conv/chat") && r.request().method() === "POST",
      { timeout: 60_000 }).catch(() => null);
    await ta.press("Enter");
    await p2;
  }
  await page.waitForTimeout(2500);
}

async function shot(page, name) {
  const p = path.join(shotDir, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return path.basename(p);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(180_000);

const rec = { runAt: new Date().toISOString(), turns: [], asserts: {}, screenshots: [] };

console.log("═══ Campaign A REPROVE ═══");
try {
  console.log("· gotoChat (up to 360s dev-compile budget)");
  await gotoChat(page);
  rec.screenshots.push(await shot(page, "A_reprove_00_ready"));

  console.log("· send 'find me hotels in Yogyakarta'");
  await sendMessage(page, "find me hotels in Yogyakarta");
  rec.screenshots.push(await shot(page, "A_reprove_01_cards"));

  const cardCount = await page.locator('[data-testid="world-card"]').count();
  const cardNames = await page.$$eval('[data-testid="world-card"]', (els) =>
    els.map((el) => (el.getAttribute("aria-label") || "").replace(/^Result \d+: /, "")));
  rec.asserts.cards_visible = cardCount > 0;
  rec.asserts.card_names = cardNames.slice(0, 3);
  console.log(`  cards=${cardCount} names=[${cardNames.slice(0, 3).join(", ")}]`);

  // Verify image-LEFT landscape · check card is wider than tall
  if (cardCount > 0) {
    const dims = await page.$eval('[data-testid="world-card"]',
      (el) => ({ width: el.clientWidth, height: el.clientHeight }));
    rec.asserts.landscape_ratio = dims.width > dims.height * 1.5;
    rec.asserts.card_dims = dims;
    console.log(`  card dims: ${dims.width}x${dims.height} · landscape=${rec.asserts.landscape_ratio}`);
  }

  // Click the first card
  console.log("· click first card");
  const firstCard = page.locator('[data-testid="world-card"]').first();
  const firstRefId = await firstCard.getAttribute("data-ref-id");
  rec.asserts.first_ref_id = firstRefId;
  console.log(`  first refId: ${firstRefId}`);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 180_000 }).catch(() => null),
    firstCard.click({ timeout: 30_000 }),
  ]);
  await page.waitForTimeout(2000);
  console.log(`  navigated to: ${page.url()}`);
  rec.asserts.detail_url_matches = page.url().includes("/nex-app/entity/");
  rec.screenshots.push(await shot(page, "A_reprove_02_detail"));

  const detailName = await page.$eval('[data-testid="entity-detail-name"]', (el) => el.textContent).catch(() => null);
  const sectionsCount = await page.locator('[data-testid^="entity-detail-section-"]').count();
  const interestedBtn = await page.locator('[data-testid="interested-button"]').count();
  rec.asserts.detail_name = detailName;
  rec.asserts.sections_count = sectionsCount;
  rec.asserts.interested_button_present = interestedBtn > 0;
  console.log(`  detail: name="${detailName}" sections=${sectionsCount} interested=${interestedBtn > 0}`);

  if (interestedBtn > 0) {
    console.log("· press Interested");
    await page.locator('[data-testid="interested-button"]').click();
    await page.waitForTimeout(800);
    rec.screenshots.push(await shot(page, "A_reprove_03_draft"));
    const draft = await page.$eval('[data-testid="interested-textarea"]', (el) => el.value).catch(() => "");
    rec.asserts.draft_visible = draft.length > 0;
    rec.asserts.draft_names_entity = detailName ? draft.includes(detailName) : false;
    rec.asserts.draft_no_fabricated_specifics = !/tonight at \d|Rp\s?\d{4,}|\$\d/.test(draft);
    console.log(`  draft: ${JSON.stringify(draft.slice(0, 200))}`);

    console.log("· edit and send");
    await page.locator('[data-testid="interested-textarea"]')
      .fill("Hi! I found your place on NEX. Could you tell me more? Thanks!");
    await page.waitForTimeout(200);
    rec.screenshots.push(await shot(page, "A_reprove_04_edited"));
    await page.locator('[data-testid="interested-send"]').click();
    await page.waitForTimeout(1000);
    rec.screenshots.push(await shot(page, "A_reprove_05_sent"));
    rec.asserts.sent_toast_visible = (await page.locator('[data-testid="interested-sent-toast"]').count()) > 0;
    console.log(`  sent toast: ${rec.asserts.sent_toast_visible}`);

    console.log("· visit /nex-app/messages");
    await page.goto("http://localhost:3008/nex-app/messages", { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForTimeout(2500);
    rec.screenshots.push(await shot(page, "A_reprove_06_outbox"));
    rec.asserts.outbox_items = await page.locator('[data-testid="interest-outbox-item"]').count();
    const outboxNames = await page.$$eval('[data-testid="interest-outbox-item"]',
      (els) => els.map((el) => (el.querySelector("a")?.textContent ?? "")));
    rec.asserts.outbox_names = outboxNames;
    console.log(`  outbox items=${rec.asserts.outbox_items} names=[${outboxNames.slice(0, 3).join(", ")}]`);
  }
} catch (err) {
  rec.error = String(err).slice(0, 500);
  console.log(`[ERROR] ${rec.error}`);
} finally {
  await browser.close();
}

const outPath = path.join(here, "_universal_discovery_campaign_a_reprove.json");
writeFileSync(outPath, JSON.stringify(rec, null, 2), "utf8");

console.log(`\n═══ CAMPAIGN A REPROVE VERDICTS ═══`);
const map = {
  cards_visible:              !!rec.asserts.cards_visible,
  landscape_layout:           !!rec.asserts.landscape_ratio,
  card_tap_navigates:         !!rec.asserts.detail_url_matches,
  detail_page_renders:        !!rec.asserts.detail_name,
  interested_button_present:  !!rec.asserts.interested_button_present,
  draft_visible:              !!rec.asserts.draft_visible,
  draft_names_entity:         !!rec.asserts.draft_names_entity,
  draft_no_fabricated_specifics: !!rec.asserts.draft_no_fabricated_specifics,
  sent_toast_visible:         !!rec.asserts.sent_toast_visible,
  outbox_has_item:            (rec.asserts.outbox_items ?? 0) > 0,
};
for (const [k, v] of Object.entries(map)) {
  console.log(`  ${k.padEnd(32)} : ${v ? "PASS" : "FAIL"}`);
}
console.log(`\nWrote ${outPath}`);
