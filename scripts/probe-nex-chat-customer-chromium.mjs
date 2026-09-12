#!/usr/bin/env node
// scripts/probe-nex-chat-customer-chromium.mjs
//
// NEX Customer Chat · REAL BROWSER PROBE (Playwright Chromium)
// Founder 2026-09-09 · "Don't fix anything yet. AUDIT → PROBE → MEASURE → REPORT"
//
// This script drives a real Chromium browser through the customer-facing
// NEX Chat page (/nex-app/chat) exactly as a user would:
//
//   1. Open the chat page
//   2. Type "Find me hotels near Malioboro" · press send
//   3. Wait for the assistant reply to render in the DOM
//   4. Capture the rendered text · take a screenshot
//   5. Type follow-up "Which one has a pool?" · press send
//   6. Capture again · take a second screenshot
//   7. Report exactly what the customer SEES on screen
//
// This is a UI-level probe, not an API probe. The prior API probe already
// showed that `reply` carries real accommodation data and `voice_reply`
// falls back to "Yep — found 3." This probe answers: which of A/B/C/D
// applies from the customer's actual viewpoint?
//
// Zero fabrication. Zero fix. Zero code changes to the chat.
//
// Usage:
//   node scripts/probe-nex-chat-customer-chromium.mjs
//   node scripts/probe-nex-chat-customer-chromium.mjs --base http://localhost:3008
//   node scripts/probe-nex-chat-customer-chromium.mjs --headed   (see the browser)

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
function argVal(name, def) {
  const idx = argv.indexOf(`--${name}`);
  return idx === -1 ? def : (argv[idx + 1] ?? def);
}
function argFlag(name) { return argv.includes(`--${name}`); }

const BASE = argVal("base", "http://localhost:3008");
const HEADED = argFlag("headed");
const OUTPUT_DIR = argVal("out", "data/chromium-proof");
const CHAT_URL = `${BASE}/nex-app/chat`;

const QUERY_1 = "Find me hotels near Malioboro";
const QUERY_2 = "Which one has a pool?";

// Selectors — probed defensively; the page is a client component that
// composes its own DOM. We try multiple selector families and use the
// first that resolves.
const COMPOSER_SELECTORS = [
  "textarea",
  "input[type='text']",
  "[role='textbox']",
  "[contenteditable='true']",
];
const SEND_SELECTORS = [
  "button[aria-label*='Send' i]",
  "button[aria-label*='send' i]",
  "button:has(svg[class*='send' i])",
  "button:has-text('Send')",
];

async function findFirst(page, selectors, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const el = await page.$(sel);
      if (el) return { element: el, selector: sel };
    }
    await page.waitForTimeout(300);
  }
  return { element: null, selector: null };
}

function trimForLog(s, n = 400) {
  if (!s) return "(empty)";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "..." : t;
}

async function ensureOutputDir() {
  const abs = path.isAbsolute(OUTPUT_DIR) ? OUTPUT_DIR : path.resolve(process.cwd(), OUTPUT_DIR);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

async function main() {
  const outDir = await ensureOutputDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const record = {
    run_id: `chromium-proof-${timestamp}`,
    started_at: new Date().toISOString(),
    base_url: BASE,
    chat_url: CHAT_URL,
    query_1: QUERY_1,
    query_2: QUERY_2,
    events: [],
    turns: [],
    api_intercepts: [],
    verdict: "PENDING",
  };

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`NEX Customer Chat · Chromium PROBE`);
  console.log(`chat URL : ${CHAT_URL}`);
  console.log(`headed   : ${HEADED}`);
  console.log(`output   : ${outDir}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  // Pre-accept cookie consent so the dialog never appears (avoids the Accept
  // button navigation side-effect that dropped us onto a 404 last run).
  const originHost = new URL(BASE).hostname;
  await context.addCookies([{
    name: "xrated_cookie_consent",
    value: "accepted",
    domain: originHost,
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  }]);
  const page = await context.newPage();

  // Capture REQUEST bodies too · so we can see EXACTLY what the client posts
  const requestBodies = new Map(); // url+timestamp → body
  page.on("request", (req) => {
    if (!req.url().includes("/api/nex-conv/chat")) return;
    if (req.method() !== "POST") return;
    try {
      const body = req.postData();
      const key = req.url() + "|" + Date.now();
      requestBodies.set(key, body);
      record.api_intercepts.push({
        phase: "request",
        url: req.url(),
        method: "POST",
        request_body_snippet: body?.slice(0, 600) ?? null,
        request_body_length: body?.length ?? 0,
        request_headers_relevant: {
          cookie_present: !!req.headers()["cookie"],
          content_type: req.headers()["content-type"] ?? null,
        },
        at: new Date().toISOString(),
      });
    } catch {}
  });

  // Intercept /api/nex-conv/chat responses so we can compare API body vs
  // what the DOM actually renders. Zero fabrication · we log real data.
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("/api/nex-conv/chat")) return;
    try {
      const body = await res.json().catch(() => null);
      if (!body) return;
      record.api_intercepts.push({
        phase: "response",
        url,
        status: res.status(),
        reply: body.reply ?? null,
        voice_reply: body.voice_reply ?? null,
        intent: body.intent ?? body.understood_intent ?? null,
        served_by: body.served_by ?? null,
        card_hits_count: body.card?.payload?.hits?.length ?? 0,
        presented_count: body.presented?.length ?? 0,
        world_cards_count: body.world_cards?.length ?? body.presented?.length ?? 0,
        at: new Date().toISOString(),
      });
    } catch {}
  });

  console.log(`[step] navigating to ${CHAT_URL}`);
  try {
    await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
  } catch (e) {
    console.log(`[fatal] navigation failed: ${e.message}`);
    record.verdict = "NAVIGATION_FAILED";
    record.events.push({ kind: "nav_failed", error: e.message, at: new Date().toISOString() });
    await savePageState(page, outDir, `${timestamp}-nav-failed`);
    fs.writeFileSync(path.join(outDir, `${timestamp}-record.json`), JSON.stringify(record, null, 2));
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(2000);
  const shot0 = path.join(outDir, `${timestamp}-01-open.png`);
  await page.screenshot({ path: shot0, fullPage: true });
  record.events.push({ kind: "opened", screenshot: shot0, at: new Date().toISOString() });
  console.log(`[step] page opened · screenshot: ${shot0}`);

  // Cookie consent bypassed via pre-injected cookie (see context.addCookies above)
  await page.waitForTimeout(800);
  const shot0b = path.join(outDir, `${timestamp}-01b-post-cookie.png`);
  await page.screenshot({ path: shot0b, fullPage: true });
  console.log(`[step] post-cookie screenshot: ${shot0b}`);

  // Wait for the chat surface to settle · greeting "Hi, I'm Nex" is a good signal
  try {
    await page.waitForFunction(() => /Hi, I'm Nex|Ask me|How can I help|What are you/i.test(document.body?.innerText ?? ""), { timeout: 15000 });
    console.log(`[step] chat surface greeting detected`);
  } catch {
    console.log(`[warn] greeting not detected within 15s · continuing`);
  }
  // Dump DOM structure hint so we can debug composer detection
  const htmlHead = await page.evaluate(() => {
    const all = document.body.querySelectorAll("textarea, input, [contenteditable='true'], [role='textbox']");
    return Array.from(all).slice(0, 8).map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") ?? null,
      placeholder: el.getAttribute("placeholder") ?? null,
      ariaLabel: el.getAttribute("aria-label") ?? null,
      contentEditable: el.getAttribute("contenteditable") ?? null,
      hidden: el.hasAttribute("hidden") || (el).offsetParent === null,
      classes: el.className?.toString?.().slice(0, 80) ?? null,
    }));
  }).catch(() => []);
  console.log(`[debug] editable candidates in DOM:`, JSON.stringify(htmlHead, null, 2));

  // Locate composer
  console.log(`[step] locating composer input...`);
  const composer = await findFirst(page, COMPOSER_SELECTORS, 20_000);
  if (!composer.element) {
    console.log(`[fatal] no composer input found · tried: ${COMPOSER_SELECTORS.join(", ")}`);
    record.verdict = "NO_COMPOSER_FOUND";
    await savePageState(page, outDir, `${timestamp}-no-composer`);
    fs.writeFileSync(path.join(outDir, `${timestamp}-record.json`), JSON.stringify(record, null, 2));
    await browser.close();
    process.exit(3);
  }
  console.log(`[step] composer found via selector: ${composer.selector}`);
  record.events.push({ kind: "composer_found", selector: composer.selector });

  // Send first query · wait for /api/nex-conv/chat response before capture
  const q1ApiPromise = page.waitForResponse((r) => r.url().includes("/api/nex-conv/chat") && r.status() === 200, { timeout: 30000 }).catch(() => null);
  await sendQuery(page, composer.element, QUERY_1, outDir, timestamp, "02-q1", record);
  await q1ApiPromise;
  await sleep(2500); // extra time for React to render the response
  const domAfterQ1 = await capturePageText(page);
  const q1Snap = path.join(outDir, `${timestamp}-03-q1-after.png`);
  await page.screenshot({ path: q1Snap, fullPage: true });
  record.turns.push({ query: QUERY_1, dom_text: trimForLog(domAfterQ1, 4000), screenshot: q1Snap });
  console.log(`[q1 result] screenshot: ${q1Snap}`);
  console.log(`[q1 DOM sample] ${trimForLog(domAfterQ1, 600)}`);

  // Re-find composer (may have changed) + send follow-up
  const composer2 = await findFirst(page, COMPOSER_SELECTORS, 10_000);
  if (!composer2.element) {
    console.log(`[warn] composer not found for follow-up · skipping`);
    record.events.push({ kind: "composer_lost_before_q2" });
  } else {
    // Q2 needs longer timeout · Q1 already compiled the route so Q2 should be
    // faster BUT the conversation-context lookup might add time. Also the
    // filter must match Q2 (not the Q1 response which fires again on refresh).
    let q2ResponseCount = 0;
    const q2ApiPromise = page.waitForResponse((r) => {
      if (!r.url().includes("/api/nex-conv/chat") || r.status() !== 200) return false;
      q2ResponseCount++;
      return q2ResponseCount === 1; // first response after Q2 send
    }, { timeout: 60000 }).catch(() => null);
    await sendQuery(page, composer2.element, QUERY_2, outDir, timestamp, "04-q2", record);
    const q2res = await q2ApiPromise;
    if (q2res) {
      console.log(`[q2] API response captured after send`);
    } else {
      console.log(`[q2] API response TIMEOUT (60s) · Q2 request may not have completed`);
    }
    await sleep(3000);
    const domAfterQ2 = await capturePageText(page);
    const q2Snap = path.join(outDir, `${timestamp}-05-q2-after.png`);
    await page.screenshot({ path: q2Snap, fullPage: true });
    record.turns.push({ query: QUERY_2, dom_text: trimForLog(domAfterQ2, 4000), screenshot: q2Snap });
    console.log(`[q2 result] screenshot: ${q2Snap}`);
    console.log(`[q2 DOM sample] ${trimForLog(domAfterQ2, 600)}`);
  }

  // VERDICT logic
  const intercepts = record.api_intercepts;
  const q1Intercept = intercepts.find((i) => (i.reply ?? "").length > 20) ?? intercepts[0];
  const anyIntercept = intercepts.length > 0;
  const apiReplyHasRealNames = intercepts.some((i) => /\b[A-Z][a-zA-Z]+\s+(Hotel|Homestay|Inn|Guesthouse|Villa|Resort|Penginapan|Wisma|Losmen)\b/.test(i.reply ?? ""));
  const apiVoiceReplyIsGeneric = intercepts.some((i) => /^(Yep|Sip)[\s—-]+(found|ada|ketemu)\s+\d+/i.test(i.voice_reply?.en ?? "") || /^(Yep|Sip)[\s—-]+(found|ada|ketemu)\s+\d+/i.test(i.voice_reply?.id ?? ""));
  const allTurnDomText = record.turns.map((t) => t.dom_text).join("\n\n");
  const domHasRealHotelNames = /\b[A-Z][a-zA-Z]+\s+(Hotel|Homestay|Inn|Guesthouse|Villa|Resort|Penginapan|Wisma|Losmen)\b/.test(allTurnDomText);
  const domHasYepFoundGeneric = /Yep\s*[—-]?\s*found\s+\d+/i.test(allTurnDomText) || /Sip\s*[—-]?\s*ketemu\s+\d+/i.test(allTurnDomText);

  let verdict = "UNKNOWN";
  let verdictExplanation = "";
  if (!anyIntercept) {
    verdict = "B_NO_DATA_REACHES_CHAT";
    verdictExplanation = "Chromium sent messages but no /api/nex-conv/chat response was intercepted · chat may be misrouted or offline.";
  } else if (!apiReplyHasRealNames) {
    verdict = "B_NO_DATA_REACHES_CHAT";
    verdictExplanation = "API responded but no real accommodation names in reply. Chat orchestrator not receiving accommodation data.";
  } else if (apiReplyHasRealNames && domHasRealHotelNames) {
    verdict = "A_CHAT_ALREADY_RECEIVES_DATA";
    verdictExplanation = "API reply has real hotel names AND real hotel names visible in customer DOM. Data flows end-to-end.";
  } else if (apiReplyHasRealNames && !domHasRealHotelNames && domHasYepFoundGeneric) {
    verdict = "C_STALE_VOICE_REPLY_HIDES_REAL_DATA";
    verdictExplanation = "API reply has real hotel names but customer DOM shows only 'Yep — found N' voice_reply · real names not surfaced to customer.";
  } else if (apiReplyHasRealNames && !domHasRealHotelNames && !domHasYepFoundGeneric) {
    verdict = "D_DATA_ARRIVES_BUT_NOT_RENDERED";
    verdictExplanation = "API reply has real hotel names but customer DOM shows neither the names nor a recognizable Yep-found template · rendering pipeline may be broken.";
  }
  record.verdict = verdict;
  record.verdict_explanation = verdictExplanation;
  record.finished_at = new Date().toISOString();

  const recordPath = path.join(outDir, `${timestamp}-record.json`);
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`API INTERCEPTS (${intercepts.length} total)`);
  for (const [i, ic] of intercepts.entries()) {
    console.log(`  ${i + 1}. status=${ic.status} intent=${ic.intent} served_by=${ic.served_by}`);
    console.log(`     reply       : ${trimForLog(ic.reply, 220)}`);
    console.log(`     voice_reply : en="${ic.voice_reply?.en ?? "?"}" id="${ic.voice_reply?.id ?? "?"}"`);
    console.log(`     cards       : ${ic.world_cards_count} · card_hits=${ic.card_hits_count}`);
  }
  console.log(``);
  console.log(`DOM AFTER Q1 (customer viewport)`);
  console.log(`  ${trimForLog(record.turns[0]?.dom_text ?? "", 500)}`);
  if (record.turns[1]) {
    console.log(``);
    console.log(`DOM AFTER Q2 (customer viewport · follow-up "Which one has a pool?")`);
    console.log(`  ${trimForLog(record.turns[1].dom_text ?? "", 500)}`);
  }
  console.log(``);
  console.log(`VERDICT: ${verdict}`);
  console.log(`         ${verdictExplanation}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`record: ${recordPath}`);

  await browser.close();
}

async function sendQuery(page, composerEl, text, outDir, timestamp, label, record) {
  console.log(`[step] typing: "${text}"`);
  // Target the "Ask Nex anything…" textarea specifically (there are OTHER inputs
  // on the page: DM composer, search-conversation input, task-title input · we
  // MUST target the Nex chat composer to reach /api/nex-conv/chat).
  let target = composerEl;
  try {
    const askNex = await page.$("textarea[placeholder*='Ask Nex' i]");
    if (askNex) target = askNex;
  } catch {}
  try {
    await target.click({ force: true });
    await target.fill("");
    await target.type(text, { delay: 20 });
  } catch (e) {
    console.log(`[warn] fill/type failed: ${e.message} · falling back to keyboard`);
    await page.keyboard.type(text);
  }
  const shotBefore = path.join(outDir, `${timestamp}-${label}-typed.png`);
  await page.screenshot({ path: shotBefore, fullPage: true });
  record.events.push({ kind: "typed", label, text, screenshot: shotBefore });

  // Try clicking Send button, else press Enter (target the textarea specifically)
  const sendBtn = await findFirst(page, SEND_SELECTORS, 2000);
  if (sendBtn.element) {
    try { await sendBtn.element.click({ force: true }); } catch { await target.press("Enter"); }
    record.events.push({ kind: "sent", label, via: "button" });
  } else {
    await target.press("Enter");
    record.events.push({ kind: "sent", label, via: "enter" });
  }
  await page.waitForTimeout(500);
}

async function capturePageText(page) {
  try {
    return await page.evaluate(() => document.body?.innerText ?? "");
  } catch {
    return "";
  }
}

async function savePageState(page, outDir, label) {
  try {
    const shot = path.join(outDir, `${label}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`[state] screenshot saved: ${shot}`);
    const html = await page.content();
    fs.writeFileSync(path.join(outDir, `${label}.html`), html);
  } catch {}
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

main().catch((e) => {
  console.error(`probe FAILED: ${e.stack ?? e.message ?? e}`);
  process.exit(1);
});
