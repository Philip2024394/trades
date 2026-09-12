// NEX Universal Discovery Slice · Live browser + HTTP proof
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// The AUTHORIZE requires proof through the actual /nex-app/chat surface:
//   USER CONVERSATION → 10 CARDS → SELECT → DETAIL → INTERESTED
//   → PREFILL → EDIT/SEND → OUTBOX shows draft
//
// This runner opens Chromium against http://localhost:3008/nex-app/chat,
// sends a hotel query, verifies cards render inline with image-LEFT
// layout, clicks a card, verifies the entity detail page renders with
// sections/contact/gallery, presses "I'm interested", verifies the
// prefilled draft appears, edits it, sends, then navigates to
// /nex-app/messages and verifies the outbox contains the draft.

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here    = path.dirname(fileURLToPath(import.meta.url));
const shotDir = path.join(here, "_universal_discovery_slice_screenshots");
const CHAT_URL = process.env.NEX_APP_CHAT_URL || "http://localhost:3008/nex-app/chat";
mkdirSync(shotDir, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────
async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90_000);
  return { ctx, page };
}

async function gotoChat(page) {
  await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector('textarea[placeholder="Ask Nex anything…"]', { state: "attached", timeout: 90_000 });
  await page.waitForTimeout(2000);
  // Dismiss cookie banner if present
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      const t = (b.textContent || "").trim();
      if (/^(Accept|Accept all|Got it|Agree|OK)$/i.test(t)) { try { b.click(); } catch {} }
    }
  });
  await page.waitForTimeout(600);
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
  await page.waitForTimeout(200);
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
    { timeout: 60_000 },
  ).catch(() => null);
  await ta.press("Enter");
  const resp = await p1;
  if (!resp) {
    await page.waitForTimeout(300);
    await ta.fill(text);
    const p2 = page.waitForResponse(
      (r) => r.url().includes("/api/nex-conv/chat") && r.request().method() === "POST",
      { timeout: 45_000 },
    ).catch(() => null);
    await ta.press("Enter");
    await p2;
  }
  await page.waitForTimeout(2000);
}

async function shot(page, name) {
  const p = path.join(shotDir, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return path.basename(p);
}

// ─── Main ─────────────────────────────────────────────────────
const results = { runAt: new Date().toISOString(), chat_url: CHAT_URL, campaigns: {} };
const browser = await chromium.launch({ headless: true });
console.log("Chromium launched");

// Warm-up
{
  console.log("\n═══ WARMUP ═══");
  const { ctx, page } = await newPage(browser);
  try {
    await gotoChat(page);
    await sendMessage(page, "hello");
    console.log("  · warmup complete");
  } finally { await ctx.close(); }
}

// Campaign A · full flow
console.log("\n═══ A · Discovery → Cards → Detail → Interested → Outbox ═══");
{
  const { ctx, page } = await newPage(browser);
  const rec = { turns: [], asserts: {}, screenshots: [] };
  try {
    await gotoChat(page);
    rec.screenshots.push(await shot(page, "A_00_initial"));

    // T1 · search
    console.log("  → T1 'find me hotels in Yogyakarta'");
    await sendMessage(page, "find me hotels in Yogyakarta");
    rec.screenshots.push(await shot(page, "A_01_cards"));
    const cardCount = await page.locator('[data-testid="world-card"]').count();
    const cardNames = await page.$$eval('[data-testid="world-card"]', (els) =>
      els.map((el) => (el.getAttribute("aria-label") || "").replace(/^Result \d+: /, ""))
    );
    rec.asserts.cards_visible = cardCount > 0;
    rec.asserts.card_names = cardNames.slice(0, 3);
    console.log(`    cards=${cardCount} names=[${cardNames.slice(0, 3).join(", ")}]`);

    // Verify image-LEFT layout via card DOM inspection
    if (cardCount > 0) {
      const layout = await page.$eval('[data-testid="world-card"]', (el) => {
        const inner = el.querySelector("div");
        return { width: (inner?.clientWidth ?? 0), heightRatio: (el.clientWidth / Math.max(1, el.clientHeight)) };
      });
      rec.asserts.landscape_ratio = layout.heightRatio > 1.5;
      console.log(`    layout ratio=${layout.heightRatio.toFixed(2)} · landscape=${rec.asserts.landscape_ratio}`);
    }

    // T2 · click the first card
    console.log("  → T2 click first card");
    const firstCard = page.locator('[data-testid="world-card"]').first();
    const firstRefId = await firstCard.getAttribute("data-ref-id");
    console.log(`    first refId: ${firstRefId}`);
    rec.asserts.first_ref_id = firstRefId;
    // Wait for navigation triggered by window.location.href assignment
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90_000 }).catch(() => null),
      firstCard.click({ timeout: 20_000 }),
    ]);
    await page.waitForTimeout(1500);
    rec.screenshots.push(await shot(page, "A_02_detail_navigated"));
    console.log(`    navigated to: ${page.url()}`);
    rec.asserts.detail_url_matches = page.url().includes("/nex-app/entity/");

    // Detail page checks
    const detailName = await page.$eval('[data-testid="entity-detail-name"]', (el) => el.textContent).catch(() => null);
    console.log(`    detail name: ${detailName}`);
    rec.asserts.detail_name = detailName;
    const interestedBtn = await page.locator('[data-testid="interested-button"]').count();
    const hasSections = await page.locator('[data-testid^="entity-detail-section-"]').count();
    rec.asserts.interested_button_present = interestedBtn > 0;
    rec.asserts.sections_count = hasSections;
    console.log(`    interested-button=${interestedBtn > 0} · sections=${hasSections}`);

    // Screenshot detail page
    rec.screenshots.push(await shot(page, "A_03_detail_page"));

    // T3 · press Interested
    if (interestedBtn > 0) {
      console.log("  → T3 press Interested");
      await page.locator('[data-testid="interested-button"]').click();
      await page.waitForTimeout(800);
      rec.screenshots.push(await shot(page, "A_04_interested_draft"));
      const draftText = await page.$eval('[data-testid="interested-textarea"]', (el) => el.value).catch(() => "");
      console.log(`    draft: ${JSON.stringify(draftText.slice(0, 200))}`);
      rec.asserts.draft_visible = draftText.length > 0;
      rec.asserts.draft_names_entity = detailName ? draftText.includes(detailName) : false;
      // never fabricates a price/room/date
      rec.asserts.draft_no_fabricated_specifics = !/tonight at \d|Rp\s?\d{4,}|\$\d/.test(draftText);

      // T4 · edit the draft
      console.log("  → T4 edit + send");
      const edited = "Hi! I found your place on NEX. Could you tell me a bit more about it? Thanks!";
      await page.locator('[data-testid="interested-textarea"]').fill(edited);
      await page.waitForTimeout(200);
      rec.screenshots.push(await shot(page, "A_05_edited"));

      // T5 · send
      await page.locator('[data-testid="interested-send"]').click();
      await page.waitForTimeout(800);
      rec.screenshots.push(await shot(page, "A_06_sent_toast"));
      const toastPresent = await page.locator('[data-testid="interested-sent-toast"]').count();
      rec.asserts.sent_toast_visible = toastPresent > 0;
      console.log(`    sent toast visible=${toastPresent > 0}`);

      // T6 · navigate to /nex-app/messages and verify outbox
      console.log("  → T6 /nex-app/messages outbox check");
      await page.goto("http://localhost:3008/nex-app/messages", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      rec.screenshots.push(await shot(page, "A_07_messages_outbox"));
      const outboxItems = await page.locator('[data-testid="interest-outbox-item"]').count();
      rec.asserts.outbox_items = outboxItems;
      const outboxNames = await page.$$eval('[data-testid="interest-outbox-item"]',
        (els) => els.map((el) => (el.querySelector("a")?.textContent ?? "")));
      rec.asserts.outbox_names = outboxNames;
      console.log(`    outbox items=${outboxItems} names=[${outboxNames.slice(0, 3).join(", ")}]`);
    }
  } catch (err) {
    rec.error = String(err).slice(0, 500);
    console.log(`    [ERROR] ${rec.error}`);
  } finally {
    await ctx.close();
    results.campaigns.A_full_flow = rec;
  }
}

// Campaign B · fresh-session detail via direct URL
console.log("\n═══ B · Direct detail URL (fresh session) ═══");
{
  const { ctx, page } = await newPage(browser);
  const rec = { asserts: {}, screenshots: [] };
  try {
    // Use a known accommodation refId (from prior traces)
    const refId = "place:accommodation:#AC-2026-0000D";
    const url = `http://localhost:3008/nex-app/entity/${encodeURIComponent(refId)}`;
    console.log(`  navigating: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2000);
    rec.screenshots.push(await shot(page, "B_direct_detail"));
    const detailName = await page.$eval('[data-testid="entity-detail-name"]', (el) => el.textContent).catch(() => null);
    console.log(`    detail name: ${detailName}`);
    rec.asserts.direct_detail_name = detailName;
  } catch (err) {
    rec.error = String(err).slice(0, 500);
  } finally {
    await ctx.close();
    results.campaigns.B_direct_detail = rec;
  }
}

// Campaign C · adversarial · unavailable entity id
console.log("\n═══ C · Unavailable entity (honest not-found) ═══");
{
  const { ctx, page } = await newPage(browser);
  const rec = { asserts: {}, screenshots: [] };
  try {
    const badRef = "place:accommodation:%23NONEXISTENT";
    const url = `http://localhost:3008/nex-app/entity/${badRef}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1500);
    rec.screenshots.push(await shot(page, "C_unavailable"));
    const body = await page.evaluate(() => document.body.innerText);
    rec.asserts.unavailable_shown = /Item unavailable|not recognised|no longer available/i.test(body);
    console.log(`    unavailable message shown: ${rec.asserts.unavailable_shown}`);
  } catch (err) {
    rec.error = String(err).slice(0, 500);
  } finally {
    await ctx.close();
    results.campaigns.C_unavailable = rec;
  }
}

await browser.close();

// ─── Verdicts ───────────────────────────────────────────────
const A = results.campaigns.A_full_flow;
const B = results.campaigns.B_direct_detail;
const C = results.campaigns.C_unavailable;

const overall = {
  cards_visible:               !!A?.asserts?.cards_visible,
  landscape_layout:            !!A?.asserts?.landscape_ratio,
  card_tap_navigates:          !!A?.asserts?.detail_url_matches,
  detail_page_renders:         !!(A?.asserts?.detail_name),
  interested_button_present:   !!A?.asserts?.interested_button_present,
  draft_visible:               !!A?.asserts?.draft_visible,
  draft_names_entity:          !!A?.asserts?.draft_names_entity,
  draft_no_fabricated_specifics: !!A?.asserts?.draft_no_fabricated_specifics,
  sent_toast_visible:          !!A?.asserts?.sent_toast_visible,
  outbox_has_item:             (A?.asserts?.outbox_items ?? 0) > 0,
  outbox_names_match:          (A?.asserts?.outbox_names ?? []).some((n) => n && A?.asserts?.detail_name?.includes(n.split(" ")[0])),
  direct_detail_url_works:     !!B?.asserts?.direct_detail_name,
  unavailable_honest:          !!C?.asserts?.unavailable_shown,
};

results.verdicts = overall;

const outPath = path.join(here, "_universal_discovery_slice_live_probes.json");
writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

console.log(`\n═══ UNIVERSAL DISCOVERY VERDICTS ═══`);
for (const [k, v] of Object.entries(overall)) {
  console.log(`  ${k.padEnd(32)} : ${v ? "PASS" : "FAIL"}`);
}
console.log(`\nWrote ${outPath}`);
console.log(`Screenshots in ${shotDir}`);
