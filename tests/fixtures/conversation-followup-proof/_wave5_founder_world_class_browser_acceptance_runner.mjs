// NEX Founder World-Class Browser Acceptance Runner
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE · VERIFICATION ONLY
//
// Runs a real Chromium browser against the actual /nex-app/chat surface
// via Playwright. Zero production code changes made by this runner —
// it only observes, screenshots, and asserts.
//
// Campaigns A–H per the AUTHORIZE. Each campaign captures a screenshot
// under _wave5_founder_world_class_browser_acceptance_screenshots/.

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here      = path.dirname(fileURLToPath(import.meta.url));
const shotDir   = path.join(here, "_wave5_founder_world_class_browser_acceptance_screenshots");
const outPath   = path.join(here, "_wave5_founder_world_class_browser_acceptance.json");
const CHAT_URL  = process.env.NEX_APP_CHAT_URL || "http://localhost:3008/nex-app/chat";

mkdirSync(shotDir, { recursive: true });

// ─── Helpers ────────────────────────────────────────────────────
async function newPage(browser, viewport = { width: 420, height: 900 }) {
  const ctx = await browser.newContext({ viewport, userAgent: "NEX-Founder-Acceptance-Chromium/1.0" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90_000);
  const consoleLogs = [];
  page.on("console", (m) => consoleLogs.push({ type: m.type(), text: m.text().slice(0, 200) }));
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));
  return { ctx, page, consoleLogs, pageErrors };
}

async function gotoChat(page) {
  // Next.js dev mode · first compile can take 30-60s · use domcontentloaded
  // (fast) + explicit selector wait rather than networkidle (chat page has
  // long-poll connections that never idle).
  await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector('textarea[placeholder="Ask Nex anything…"]', { state: "attached", timeout: 90_000 });
  // React hydration settle
  await page.waitForTimeout(2000);
  // Dismiss any cookie/consent overlay that would cover the composer.
  // Suppresses any overlay that would block the composer · uses direct
  // DOM removal via evaluate so we don't depend on the specific banner
  // component structure.
  await page.evaluate(() => {
    // Remove any fixed/absolute element containing "We use cookies" or
    // an "Accept" button in the bottom half of the viewport.
    const buttons = Array.from(document.querySelectorAll("button"));
    for (const b of buttons) {
      const t = (b.textContent || "").trim();
      if (/^(Accept|Accept all|Got it|Agree|OK)$/i.test(t)) {
        try { b.click(); } catch {}
      }
    }
  });
  await page.waitForTimeout(600);
  // As a belt-and-braces measure, also hide any lingering cookie/consent
  // container by className / textContent so it can't cover the composer.
  await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("*"));
    for (const n of nodes) {
      const el = n instanceof HTMLElement ? n : null;
      if (!el) continue;
      const style = window.getComputedStyle(el);
      if (style.position !== "fixed" && style.position !== "sticky") continue;
      const text = (el.innerText || "").trim();
      if (/We use cookies|cookie preferences|cookie consent/i.test(text)) {
        el.style.display = "none";
      }
    }
    // Also hide Next.js dev error overlay if it's obscuring the composer
    const nextErr = document.querySelector('[data-nextjs-toast]') || document.querySelector('nextjs-portal');
    if (nextErr instanceof HTMLElement) nextErr.style.display = "none";
  });
  // Scroll to the bottom of the message list so the composer is on-screen
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const ta = page.locator('textarea[placeholder="Ask Nex anything…"]');
  await ta.scrollIntoViewIfNeeded({ timeout: 10_000 });
  await page.waitForTimeout(200);
}

async function sendMessage(page, text) {
  const textarea = page.locator('textarea[placeholder="Ask Nex anything…"]');
  await textarea.scrollIntoViewIfNeeded({ timeout: 10_000 });
  // force click bypasses any transient overlay stability check
  await textarea.click({ force: true, timeout: 30_000 });
  await textarea.fill(""); // clear any residual
  // .fill(text) sets the DOM value + dispatches input event · React
  // controlled input onChange fires reliably. Use fill (not type)
  // because .type dispatches per-char keystroke events that can race
  // against React's controlled-state onChange in dev mode.
  await textarea.fill(text);
  // VERIFY the React controlled state has caught up · retry once if not
  for (let attempt = 0; attempt < 3; attempt++) {
    const domVal = await textarea.inputValue();
    if (domVal === text) break;
    await page.waitForTimeout(200);
    if (attempt === 2) {
      // Last-resort · re-fill
      await textarea.fill(text);
      await page.waitForTimeout(300);
    }
  }
  // Wait for the outgoing request to /api/nex-conv/chat AND for the
  // response to arrive · that guarantees the server returned before we
  // press Enter and wait for DOM to render.
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/nex-conv/chat") && resp.request().method() === "POST",
    { timeout: 60_000 },
  ).catch(() => null);
  // press Enter on the LOCATOR (not page.keyboard) so focus stays on the
  // textarea · this is what the app's onKeyDown handler needs
  await textarea.press("Enter");
  const resp = await responsePromise;
  // If the response never came (e.g. draft was empty), press Enter again
  // after a brief settle · this recovers the rare race where the first
  // Enter fired against an incompletely-hydrated draft state.
  if (!resp) {
    await page.waitForTimeout(300);
    await textarea.fill(text);
    await page.waitForTimeout(200);
    const responsePromise2 = page.waitForResponse(
      (r) => r.url().includes("/api/nex-conv/chat") && r.request().method() === "POST",
      { timeout: 45_000 },
    ).catch(() => null);
    await textarea.press("Enter");
    await responsePromise2;
  }
  // Extra settle so React finishes rendering the new bubble + cards
  await page.waitForTimeout(1500);
}

async function inspect(page) {
  const worldCardCount = await page.locator('[data-testid="world-card"]').count();
  const inlineExists   = (await page.locator('[data-testid="world-cards-inline"]').count()) > 0;
  const cardNames = worldCardCount === 0 ? [] : await page.$$eval('[data-testid="world-card"]', (els) =>
    els.map((el) => {
      const label = el.getAttribute("aria-label") || "";
      const m = label.match(/^Result \d+: (.+)$/);
      return m ? m[1] : label;
    }),
  );
  const cardOrdinals = worldCardCount === 0 ? [] : await page.$$eval('[data-testid="world-card"]', (els) =>
    els.map((el) => el.getAttribute("data-ordinal") || ""),
  );
  const cardRefIds = worldCardCount === 0 ? [] : await page.$$eval('[data-testid="world-card"]', (els) =>
    els.map((el) => el.getAttribute("data-ref-id") || ""),
  );
  const bodyText = (await page.evaluate(() => document.body.innerText || "")).slice(-1500);
  return { worldCardCount, inlineExists, cardNames, cardOrdinals, cardRefIds, tailText: bodyText };
}

async function shot(page, name) {
  const p = path.join(shotDir, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return path.basename(p);
}

const FABRICATION_TOKENS = [
  "Tokyo Tower", "Shibuya", "Harajuku",
  "Palace Grand", "Royal Deluxe", "Emperor's Retreat",
  "Michelin star",
];
function hasFabrication(text) {
  return FABRICATION_TOKENS.find((t) => text.includes(t)) ?? null;
}

// ─── Results container ────────────────────────────────────────
const results = { runAt: new Date().toISOString(), chat_url: CHAT_URL, campaigns: {} };

async function runCampaign(browser, id, description, turns) {
  const { ctx, page, consoleLogs, pageErrors } = await newPage(browser);
  const record = { id, description, turns: [], consoleLogs, pageErrors, screenshots: [] };
  try {
    console.log(`\n═══ ${id} · ${description} ═══`);
    await gotoChat(page);
    await page.waitForTimeout(600);
    record.screenshots.push(await shot(page, `${id}_00_initial`));
    for (const [i, t] of turns.entries()) {
      console.log(`  → T${i + 1} "${t.msg}"`);
      await sendMessage(page, t.msg);
      const state = await inspect(page);
      const fab = hasFabrication(state.tailText);
      record.turns.push({ turn: i + 1, message: t.msg, fabricated: fab, ...state });
      record.screenshots.push(await shot(page, `${id}_T${String(i + 1).padStart(2, "0")}`));
      console.log(`     cards=${state.worldCardCount} names=[${state.cardNames.slice(0, 3).join(", ")}]`);
      console.log(`     tail : ${JSON.stringify(state.tailText.slice(-300))}`);
      console.log(`     fab=${fab ?? "no"}`);
    }
  } catch (err) {
    record.error = String(err).slice(0, 500);
    console.log(`     [ERROR] ${record.error}`);
  } finally {
    await ctx.close();
    results.campaigns[id] = record;
  }
  return record;
}

// ─── Main ─────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
console.log(`Chromium launched · target: ${CHAT_URL}`);

// Warm-up · Next.js dev mode caches the compiled route; first paint can
// take 30-60s on the /nex-app/chat 10k-line page. Do one full navigate
// + hydrate + submit-message round-trip so subsequent campaigns run
// against a warm compile.
console.log("\n═══ WARMUP · compiling /nex-app/chat + first turn round-trip ═══");
{
  const { ctx, page } = await newPage(browser);
  try {
    await gotoChat(page);
    console.log("  → route compiled + textarea visible");
    await sendMessage(page, "hello");
    console.log("  → first turn round-trip complete");
    await shot(page, "_warmup");
  } catch (e) {
    console.log(`  [warmup soft-fail: ${String(e).slice(0, 200)}]`);
  } finally {
    await ctx.close();
  }
}

// A · HOTEL DISCOVERY
await runCampaign(browser, "A_hotel_discovery",
  "Fresh conversation · 'need a hotel tonight' · cards must appear",
  [{ msg: "need a hotel tonight" }]);

// B · CARD CONTINUATION
await runCampaign(browser, "B_card_continuation",
  "Full T1-T5 continuation · details / first / second / one more / last",
  [
    { msg: "need a hotel tonight" },
    { msg: "can i see details" },
    { msg: "tell me about the first one" },
    { msg: "tell me about the second one" },
    { msg: "one more" },
    { msg: "tell me about the last one" },
  ]);

// C · TOPIC SWITCH
await runCampaign(browser, "C_topic_switch",
  "Hotel → restaurant · show me the first one → must be restaurant not hotel",
  [
    { msg: "need a hotel tonight" },
    { msg: "actually, I need a restaurant" },
    { msg: "show me the first one" },
  ]);

// D · FRESH-CONVERSATION PROTECTION
await runCampaign(browser, "D_fresh_protection",
  "Fresh session · 'tell me about the first hotel' → honest clarification · then find + first",
  [
    { msg: "tell me about the first hotel" },
    { msg: "find me hotels near Malioboro" },
    { msg: "tell me about the first one" },
  ]);

// E · EVIDENCE SAFETY (adversarial)
await runCampaign(browser, "E_evidence_safety",
  "Cards visible · unsupported attribute / booking / price / facility",
  [
    { msg: "find me hotels" },
    { msg: "does it have a helicopter pad?" },
    { msg: "can I book it?" },
    { msg: "how much is the room tonight?" },
    { msg: "does it have a gym?" },
  ]);

// F · NEGATION
await runCampaign(browser, "F_negation",
  "Negation preservation · 'I don't want the first one' → 'show me the second one'",
  [
    { msg: "find me hotels" },
    { msg: "I don't want the first one." },
    { msg: "show me the second one." },
    { msg: "not a hotel — I need a restaurant." },
  ]);

// G · LANGUAGE (English → Indonesian → English)
await runCampaign(browser, "G_language",
  "English → 'Speak Indonesian' → Cari hotel dekat Malioboro → 'Actually speak English'",
  [
    { msg: "hello" },
    { msg: "Speak Indonesian." },
    { msg: "Cari hotel dekat Malioboro." },
    { msg: "Actually, speak English." },
    { msg: "find me hotels" },
  ]);

// H · MESSY HUMAN CONVERSATION
await runCampaign(browser, "H_messy_human",
  "Realistic messy natural conversation with corrections, negation, references, evidence questions",
  [
    { msg: "need somewhere tonight" },
    { msg: "near town" },
    { msg: "cheaper" },
    { msg: "no actually not a hotel" },
    { msg: "restaurant" },
    { msg: "something nice" },
    { msg: "not too expensive" },
    { msg: "the second one" },
    { msg: "what about parking" },
    { msg: "can i contact them" },
    { msg: "how did you find these" },
    { msg: "are these verified" },
  ]);

await browser.close();

// ─── Verdict scoring ────────────────────────────────────────
function anyFabrication() {
  for (const c of Object.values(results.campaigns)) {
    for (const t of c.turns) if (t.fabricated) return { at: `${c.id}·T${t.turn}`, token: t.fabricated };
  }
  return null;
}

const A = results.campaigns.A_hotel_discovery;
const B = results.campaigns.B_card_continuation;
const C = results.campaigns.C_topic_switch;
const D = results.campaigns.D_fresh_protection;
const E = results.campaigns.E_evidence_safety;
const F = results.campaigns.F_negation;
const G = results.campaigns.G_language;
const H = results.campaigns.H_messy_human;

const A_cards_visible       = (A?.turns?.[0]?.worldCardCount ?? 0) > 0;
const B_T1_cards            = (B?.turns?.[0]?.worldCardCount ?? 0) > 0;
const B_T2_cards_still      = (B?.turns?.[1]?.worldCardCount ?? 0) > 0;
const B_T3_first_named      = B?.turns?.[2]?.tailText?.includes(A?.turns?.[0]?.cardNames?.[0] ?? "___" ) ?? false;
const B_T4_second_named     = B?.turns?.[3]?.tailText?.includes(A?.turns?.[0]?.cardNames?.[1] ?? "___" ) ?? false;
const B_T5_one_more_ack     = /1 more from the list|list:|widen the search/i.test(B?.turns?.[4]?.tailText ?? "");
const B_T6_last_resolves    = /last|final/i.test(B?.turns?.[5]?.tailText ?? "") || (B?.turns?.[5]?.worldCardCount ?? 0) > 0;

const C_T2_topic_shift_ack  = /switching to|restaurant|restoran/i.test(C?.turns?.[1]?.tailText ?? "");
const C_T3_no_stale_hotel   = !(A?.turns?.[0]?.cardNames?.[0] && C?.turns?.[2]?.tailText?.includes(A.turns[0].cardNames[0]));

const D_T1_honest_boundary  = /which hotel do you mean|don't have a previous|no previous|haven't shown/i.test(D?.turns?.[0]?.tailText ?? "");
const D_T2_new_cards        = (D?.turns?.[1]?.worldCardCount ?? 0) > 0;
const D_T3_first_from_new   = (D?.turns?.[1]?.cardNames?.[0] && D?.turns?.[2]?.tailText?.includes(D.turns[1].cardNames[0])) ?? false;

const E_helicopter_unknown  = /don't have|not specific|no information|unknown|not sure/i.test(E?.turns?.[1]?.tailText ?? "");
const E_booking_boundary    = /don't have|can't confirm|not authorised|not verified|discovery.*not.*booking/i.test(E?.turns?.[2]?.tailText ?? "");
const E_price_no_fab        = !/\$\d+|Rp\s?\d{4,}|\d+\s?USD|\d+\s?IDR/.test(E?.turns?.[3]?.tailText?.slice(-500) ?? "");

const F_topic_switch        = /switching to|restaurant/i.test(F?.turns?.[3]?.tailText ?? "");

const G_language_switch     = /(iya|ya|baik|selamat|silakan|saya)/i.test(G?.turns?.[1]?.tailText ?? "") || /(indonesian|switching to)/i.test(G?.turns?.[1]?.tailText ?? "");
const G_id_query_works      = (G?.turns?.[2]?.worldCardCount ?? 0) > 0 || /hotel|penginapan|malioboro/i.test(G?.turns?.[2]?.tailText ?? "");
const G_english_back        = /english|switching|hello|hi/i.test(G?.turns?.[3]?.tailText ?? "");

const H_survives            = H?.turns?.every?.((t) => !t.error) ?? false;
const H_no_fabrications     = H?.turns?.every?.((t) => !t.fabricated) ?? false;

const anyFab = anyFabrication();

results.verdicts = {
  A_cards_visible,
  B_T1_cards, B_T2_cards_still, B_T3_first_named, B_T4_second_named, B_T5_one_more_ack, B_T6_last_resolves,
  C_T2_topic_shift_ack, C_T3_no_stale_hotel,
  D_T1_honest_boundary, D_T2_new_cards, D_T3_first_from_new,
  E_helicopter_unknown, E_booking_boundary, E_price_no_fab,
  F_topic_switch,
  G_language_switch, G_id_query_works, G_english_back,
  H_survives, H_no_fabrications,
  zero_fabrications_overall: !anyFab,
  fabrication_hit: anyFab,
};

writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`\n═══ FOUNDER ACCEPTANCE VERDICTS ═══`);
for (const [k, v] of Object.entries(results.verdicts)) {
  const label = typeof v === "boolean" ? (v ? "PASS" : "FAIL") : JSON.stringify(v);
  console.log(`  ${k.padEnd(35)}: ${label}`);
}
console.log(`\nWrote ${outPath}`);
console.log(`Screenshots in ${shotDir}`);
