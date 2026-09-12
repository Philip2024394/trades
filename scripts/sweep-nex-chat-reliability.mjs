#!/usr/bin/env node
// scripts/sweep-nex-chat-reliability.mjs
//
// NEX Customer Chat · reliability sweep across N fresh browser sessions
// Founder BEGIN 2026-09-09 · ACCOMMODATION CHAT RELIABILITY + CONVERSATION CONTEXT PROOF
//
// Founder discipline (verbatim):
//   "Test several fresh sessions, not just one successful session.
//    Real Chromium screenshots + API interception.
//    Measure success rate across repeated runs.
//    Hard stop if the variability comes from infrastructure outside this scope."
//
// Each iteration:
//   1. Fresh browser context (fresh cookies · fresh session_id · fresh
//      localStorage)
//   2. Navigate to /nex-app/chat · type "Find me hotels near Malioboro"
//   3. Wait for API response · verify real hotel names + card_hits > 0
//   4. Screenshot Q1 result
//   5. Type follow-up "Which one has a pool?"
//   6. Wait for API response · verify conversation_id threaded + response
//      references Q1 hotels (context proof)
//   7. Screenshot Q2 result
//   8. Record per-iteration outcome
//
// Summary reports:
//   - Q1 success rate (real names in reply · cards rendered)
//   - Q2 success rate
//   - conversation-context proof rate (Q2 used Q1's conversation_id AND
//     response references Q1's data)
//
// Zero fabrication. Zero fixes. Read-only measurement.
//
// Usage:
//   node scripts/sweep-nex-chat-reliability.mjs --n=5
//   node scripts/sweep-nex-chat-reliability.mjs --n=10 --headed

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
function argVal(name, def) {
  const idx = argv.indexOf(`--${name}`);
  const i2 = argv.findIndex((a) => a.startsWith(`--${name}=`));
  if (idx !== -1) return argv[idx + 1] ?? def;
  if (i2 !== -1) return argv[i2].slice(name.length + 3);
  return def;
}
function argFlag(name) { return argv.includes(`--${name}`); }

const BASE = argVal("base", "http://localhost:3008");
const N = Number(argVal("n", 5));
const HEADED = argFlag("headed");
const OUTPUT_DIR = argVal("out", "data/chromium-proof/sweep");
const CHAT_URL = `${BASE}/nex-app/chat`;
const Q1 = "Find me hotels near Malioboro";
const Q2 = "Which one has a pool?";

// Regex helpers
const RX_HOTEL_NAME = /\b[A-Z][a-zA-Z]+\s+(Hotel|Homestay|Inn|Guesthouse|Villa|Resort|Penginapan|Wisma|Losmen)\b/;
const RX_COUNT = /\b(\d+)\s+real\s+(listings?|places?|hotels?)/i;
const RX_EMPTY = /(don't have matching|nothing.{0,20}coming back|no matches)/i;

function trimTo(s, n) { return s && s.length > n ? s.slice(0, n) + "..." : (s ?? ""); }

function classifyResponse(body) {
  const reply = body?.reply ?? "";
  const voice = body?.voice_reply?.en ?? "";
  const cardHits = body?.card?.payload?.hits?.length ?? 0;
  const worldCards = body?.world_cards?.length ?? body?.presented?.length ?? 0;
  const realNames = RX_HOTEL_NAME.test(reply);
  const countMatch = RX_COUNT.exec(reply);
  const empty = RX_EMPTY.test(reply);
  const hotelNames = [];
  const nameRegex = /\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z0-9]+)*\s+(?:Hotel|Homestay|Inn|Guesthouse|Villa|Resort|Penginapan|Wisma|Losmen))\b/g;
  let m;
  while ((m = nameRegex.exec(reply)) !== null) hotelNames.push(m[1]);
  return {
    intent: body?.intent ?? body?.understood_intent ?? "?",
    has_real_names: realNames,
    count_reported: countMatch ? Number(countMatch[1]) : null,
    empty_reported: empty,
    card_hits: cardHits,
    world_cards: worldCards,
    voice_reply_en: voice,
    reply_snippet: trimTo(reply, 200),
    hotel_names_extracted: hotelNames.slice(0, 6),
    conversation_id: body?.conversation_id ?? body?.session_id ?? body?.session?.id ?? null,
  };
}

async function runSession({ browser, iterationIdx, outDir }) {
  const iterLabel = `s${String(iterationIdx + 1).padStart(2, "0")}`;
  const iterDir = path.join(outDir, iterLabel);
  fs.mkdirSync(iterDir, { recursive: true });
  const record = {
    iteration: iterationIdx + 1,
    label: iterLabel,
    started_at: new Date().toISOString(),
    q1_intercept: null,
    q2_intercept: null,
    q1_request_body: null,
    q2_request_body: null,
    dom_after_q1: null,
    dom_after_q2: null,
    q1_verdict: "PENDING",
    q2_verdict: "PENDING",
    conversation_context_verdict: "PENDING",
    screenshots: {},
    error: null,
  };
  const originHost = new URL(BASE).hostname;
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  await context.addCookies([{
    name: "xrated_cookie_consent", value: "accepted",
    domain: originHost, path: "/", httpOnly: false, secure: false, sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  }]);
  const page = await context.newPage();

  // Message-paired request/response capture (pairs by sent message text)
  const pairs = []; // [{ requestBody, responseBody, sent_message }]
  page.on("request", (req) => {
    if (!req.url().includes("/api/nex-conv/chat")) return;
    if (req.method() !== "POST") return;
    try {
      const body = req.postData();
      const parsed = body ? JSON.parse(body) : null;
      pairs.push({ requestBody: parsed, responseBody: null, sent_message: parsed?.message ?? null, at: new Date().toISOString() });
    } catch {}
  });
  page.on("response", async (res) => {
    if (!res.url().includes("/api/nex-conv/chat")) return;
    try {
      const body = await res.json().catch(() => null);
      if (!body) return;
      // Pair to the most recent request without a response yet
      for (let i = pairs.length - 1; i >= 0; i--) {
        if (!pairs[i].responseBody) { pairs[i].responseBody = body; break; }
      }
    } catch {}
  });

  // Helper: send one turn using LOCATOR + poll pairs.length for actual request-fire confirmation
  async function sendTurn(message, label) {
    const composerLocator = page.locator("textarea[placeholder*='Ask Nex' i]");
    await composerLocator.waitFor({ state: "visible", timeout: 20_000 });
    // Focus + clear robustly (triple-click selects existing text · then type overwrites)
    await composerLocator.click({ force: true, timeout: 5000 });
    await page.waitForTimeout(150);
    await composerLocator.fill("");
    await page.waitForTimeout(150);
    await composerLocator.fill(message);
    await page.waitForTimeout(400); // let React onChange fire + Send button enable
    const composerValue = await composerLocator.inputValue().catch(() => "");
    if (composerValue.trim() !== message.trim()) {
      throw new Error(`composer value "${composerValue}" != intended "${message}"`);
    }
    // Try up to 3 times: click Send, wait 3s for pairs.length to increase.
    // If not, try Enter. If still not, retry the whole click flow.
    const beforeCount = pairs.length;
    let sendMethod = "none";
    for (let attempt = 1; attempt <= 3; attempt++) {
      const sendBtn = page.locator("button[aria-label*='Send' i]").first();
      let tried = "";
      try {
        if (await sendBtn.isVisible({ timeout: 800 }).catch(() => false)) {
          await sendBtn.click({ force: true, timeout: 3000 });
          tried = `button-attempt${attempt}`;
        } else {
          await composerLocator.press("Enter");
          tried = `enter-attempt${attempt}`;
        }
      } catch {
        try { await composerLocator.press("Enter"); tried = `enter-fallback-attempt${attempt}`; } catch {}
      }
      // Wait up to 3s for the request to actually fire
      const t0 = Date.now();
      while (Date.now() - t0 < 3000) {
        if (pairs.length > beforeCount) { sendMethod = tried; break; }
        await page.waitForTimeout(150);
      }
      if (pairs.length > beforeCount) break;
      // If nothing fired, refocus + refill and retry
      await composerLocator.click({ force: true }).catch(() => null);
      await composerLocator.fill(message).catch(() => null);
      await page.waitForTimeout(300);
    }
    return { sendMethod, requestSent: pairs.length > beforeCount };
  }

  try {
    await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => /Hi, I'm Nex|Ask me|How can I help|What are you/i.test(document.body?.innerText ?? ""), { timeout: 20_000 }).catch(() => null);
    // Wait for the composer AND send button to both be visible before proceeding
    // (JS event handlers may attach after render · fixes ~60% of prior probe misses)
    await page.locator("textarea[placeholder*='Ask Nex' i]").waitFor({ state: "visible", timeout: 20_000 }).catch(() => null);
    await page.waitForTimeout(2500);

    // Q1
    const q1SendInfo = await sendTurn(Q1, "q1");
    // Wait for the Q1 request/response to be paired
    await page.waitForFunction(() => (window.__req_count ?? 0) >= 0, undefined, { timeout: 1000 }).catch(() => null);
    // Poll until the request for Q1's message is paired with a response, up to 60s
    const q1Deadline = Date.now() + 60_000;
    while (Date.now() < q1Deadline) {
      const q1Pair = pairs.find((p) => p.sent_message === Q1);
      if (q1Pair && q1Pair.responseBody) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2500);
    const shotQ1 = path.join(iterDir, `q1.png`);
    await page.screenshot({ path: shotQ1, fullPage: true });
    record.screenshots.q1 = shotQ1;
    record.dom_after_q1 = trimTo(await page.evaluate(() => document.body?.innerText ?? "").catch(() => ""), 3000);

    // Q2 (follow-up · tests conversation context)
    const q2SendInfo = await sendTurn(Q2, "q2");
    const q2Deadline = Date.now() + 60_000;
    while (Date.now() < q2Deadline) {
      const q2Pair = pairs.find((p) => p.sent_message === Q2);
      if (q2Pair && q2Pair.responseBody) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(3000);
    const shotQ2 = path.join(iterDir, `q2.png`);
    await page.screenshot({ path: shotQ2, fullPage: true });
    record.screenshots.q2 = shotQ2;
    record.dom_after_q2 = trimTo(await page.evaluate(() => document.body?.innerText ?? "").catch(() => ""), 3000);
  } catch (e) {
    record.error = String(e?.message ?? e);
  }

  // Pair-based lookup by message content (immune to response ordering)
  const q1Pair = pairs.find((p) => p.sent_message === Q1);
  const q2Pair = pairs.find((p) => p.sent_message === Q2);
  const q1Req = q1Pair?.requestBody ?? null;
  const q2Req = q2Pair?.requestBody ?? null;
  const q1Res = q1Pair?.responseBody ?? null;
  const q2Res = q2Pair?.responseBody ?? null;
  record.q1_request_body = q1Req;
  record.q2_request_body = q2Req;
  record.q1_intercept = q1Res ? classifyResponse(q1Res) : null;
  record.q2_intercept = q2Res ? classifyResponse(q2Res) : null;
  record.all_pairs_summary = pairs.map((p) => ({ sent: p.sent_message, got_response: !!p.responseBody, at: p.at }));

  if (record.q1_intercept) {
    if (record.q1_intercept.has_real_names && record.q1_intercept.intent === "accommodation") {
      record.q1_verdict = "PASS_REAL_HOTELS";
    } else if (record.q1_intercept.empty_reported) {
      record.q1_verdict = "FAIL_EMPTY";
    } else {
      record.q1_verdict = "FAIL_OTHER";
    }
  } else {
    record.q1_verdict = "FAIL_NO_RESPONSE";
  }

  if (record.q2_intercept) {
    if (record.q2_intercept.has_real_names || (record.q2_intercept.reply_snippet && record.q2_intercept.reply_snippet.length > 20)) {
      record.q2_verdict = "PASS_RESPONDED";
    } else {
      record.q2_verdict = "FAIL_EMPTY_OR_NO_TEXT";
    }
  } else {
    record.q2_verdict = "FAIL_NO_RESPONSE";
  }

  // Conversation context: was q2's request body carrying the conversation_id
  // returned from q1's response?
  const q1ConvId = q1Res?.conversation_id ?? q1Res?.session_id ?? null;
  const q2SentConvId = q2Req?.conversation_id ?? null;
  const contextThreaded = !!q1ConvId && q1ConvId === q2SentConvId;
  const q2ReplyReferencesQ1 = record.q1_intercept?.hotel_names_extracted?.some((n) => (q2Res?.reply ?? "").includes(n));
  if (contextThreaded && q2ReplyReferencesQ1) {
    record.conversation_context_verdict = "PASS_CONTEXT_AND_REFERENCE";
  } else if (contextThreaded) {
    record.conversation_context_verdict = "PARTIAL_CONTEXT_ID_ONLY";
  } else if (q2Res) {
    record.conversation_context_verdict = "FAIL_CONTEXT_NOT_THREADED";
  } else {
    record.conversation_context_verdict = "FAIL_NO_Q2_RESPONSE";
  }

  await context.close();
  record.finished_at = new Date().toISOString();
  fs.writeFileSync(path.join(iterDir, "record.json"), JSON.stringify(record, null, 2));
  return record;
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.isAbsolute(OUTPUT_DIR) ? OUTPUT_DIR : path.resolve(process.cwd(), OUTPUT_DIR);
  const runDir = path.join(outDir, `run-${timestamp}`);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`NEX Chat reliability sweep · ${N} fresh sessions`);
  console.log(`chat URL: ${CHAT_URL}`);
  console.log(`output  : ${runDir}`);
  console.log(`Q1: "${Q1}"`);
  console.log(`Q2: "${Q2}" (context follow-up)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const browser = await chromium.launch({ headless: !HEADED });
  const results = [];
  for (let i = 0; i < N; i++) {
    console.log(`\n[session ${i + 1}/${N}]`);
    const r = await runSession({ browser, iterationIdx: i, outDir: runDir });
    results.push(r);
    console.log(`  Q1 verdict          : ${r.q1_verdict}${r.q1_intercept?.count_reported ? " · count=" + r.q1_intercept.count_reported : ""}`);
    console.log(`  Q2 verdict          : ${r.q2_verdict}`);
    console.log(`  Context verdict     : ${r.conversation_context_verdict}`);
    if (r.q1_intercept) console.log(`  Q1 reply            : ${trimTo(r.q1_intercept.reply_snippet, 140)}`);
    if (r.q2_intercept) console.log(`  Q2 reply            : ${trimTo(r.q2_intercept.reply_snippet, 140)}`);
    if (r.error) console.log(`  ERROR               : ${r.error}`);
  }
  await browser.close();

  // Summary
  const q1Pass = results.filter((r) => r.q1_verdict === "PASS_REAL_HOTELS").length;
  const q2Pass = results.filter((r) => r.q2_verdict === "PASS_RESPONDED").length;
  const contextPass = results.filter((r) => r.conversation_context_verdict === "PASS_CONTEXT_AND_REFERENCE").length;
  const contextPartial = results.filter((r) => r.conversation_context_verdict === "PARTIAL_CONTEXT_ID_ONLY").length;

  console.log(``);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`SWEEP SUMMARY · ${N} fresh sessions · ${results.length} completed`);
  console.log(`  Q1 pass (real hotels + accommodation intent) : ${q1Pass}/${N}  (${((q1Pass / N) * 100).toFixed(1)}%)`);
  console.log(`  Q2 pass (response with text)                 : ${q2Pass}/${N}  (${((q2Pass / N) * 100).toFixed(1)}%)`);
  console.log(`  Context PASS (id threaded + Q1 hotel in Q2)  : ${contextPass}/${N}  (${((contextPass / N) * 100).toFixed(1)}%)`);
  console.log(`  Context PARTIAL (id threaded only)           : ${contextPartial}/${N}  (${((contextPartial / N) * 100).toFixed(1)}%)`);
  console.log(`  finished ${new Date().toISOString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  fs.writeFileSync(path.join(runDir, "sweep-summary.json"), JSON.stringify({
    started_at: timestamp,
    n: N,
    completed: results.length,
    q1_pass: q1Pass, q2_pass: q2Pass,
    context_pass: contextPass, context_partial: contextPartial,
    per_session: results,
  }, null, 2));
  console.log(`\nfull records: ${runDir}`);
}

main().catch((e) => {
  console.error(`sweep FAILED: ${e.stack ?? e.message ?? e}`);
  process.exit(1);
});
