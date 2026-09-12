#!/usr/bin/env node
// scripts/bench-nex-chat-speed-audit.mjs
//
// Founder BEGIN 2026-09-09 · NEX CHAT RESPONSE SPEED AUDIT
//
// Measures the FULL customer-perceived latency pipeline:
//   t0: Send button click
//   t1: fetch initiated (network request fires)
//   t2: response first byte (network done)
//   t3: JSON parsed (client mapper ran)
//   t4: user bubble rendered in DOM
//   t5: assistant bubble rendered in DOM
//   t6: cards rendered (if any)
//   t7: DOM stable (no more mutations for 500ms)
//
// Combined with server-side _debug_timings from /api/nex-conv/chat.
//
// Zero fixes. Zero fabrication. Measurement only.
//
// Matrix:
//   - cold (fresh browser context) vs warm (reuse context)
//   - accommodation ("Find me hotels near Malioboro")
//     vs ordinary ("hello")
//     vs food ("Any with breakfast?")
//   - repeated request in same session
//
// Usage:
//   node scripts/bench-nex-chat-speed-audit.mjs --n=3

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

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
const N = Number(argVal("n", 3));
const HEADED = argFlag("headed");
const OUTPUT_DIR = argVal("out", "data/chat-speed-audit");
const CHAT_URL = `${BASE}/nex-app/chat`;

const QUERIES = [
  { label: "ordinary_hello",       text: "hello" },
  { label: "accommodation_hotels", text: "Find me hotels near Malioboro" },
  { label: "food_breakfast",       text: "Any with breakfast?" },
  { label: "accommodation_villa",  text: "villa near beach" },
];

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}
function stats(arr) {
  if (arr.length === 0) return { n: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    n: arr.length, min: Math.round(s[0] * 100) / 100,
    p50: Math.round(pct(s, 50) * 100) / 100,
    p95: Math.round(pct(s, 95) * 100) / 100,
    max: Math.round(s[s.length - 1] * 100) / 100,
    mean: Math.round((sum / arr.length) * 100) / 100,
  };
}

async function runQueryOnPage({ page, iterationLabel, query, outDir, iterationTs, pairs, timings }) {
  const t_events = {};
  // Setup phase (NOT counted in customer time · this is probe-side typing delay)
  const composerLocator = page.locator("textarea[placeholder*='Ask Nex' i]");
  await composerLocator.waitFor({ state: "visible", timeout: 20_000 });
  await composerLocator.click({ force: true, timeout: 5000 });
  await page.waitForTimeout(200);
  await composerLocator.fill("");
  await composerLocator.fill(query.text);
  await page.waitForTimeout(300);
  const composerValue = await composerLocator.inputValue().catch(() => "");
  if (composerValue.trim() !== query.text.trim()) {
    return { error: `composer_mismatch value="${composerValue}" intended="${query.text}"` };
  }

  // Set up promise for response before click
  const responsePromise = page.waitForResponse((r) => r.url().includes("/api/nex-conv/chat") && r.status() === 200 && r.request().method() === "POST", { timeout: 60_000 }).catch(() => null);

  // ═══ CUSTOMER TIME STARTS HERE (after typing · at Send click) ═══
  const clickStart = performance.now();
  const sendBtn = page.locator("button[aria-label*='Send' i]").first();
  if (await sendBtn.isVisible({ timeout: 800 }).catch(() => false)) {
    await sendBtn.click({ force: true, timeout: 3000 });
  } else {
    await composerLocator.press("Enter");
  }

  // Wait for network response
  const res = await responsePromise;
  t_events.click_to_response_ms = performance.now() - clickStart;

  // Wait for the assistant reply to appear in the DOM
  let assistantVisibleMs = null;
  let cardsVisibleMs = null;
  const deadline = Date.now() + 10_000;
  const userSnippet = query.text.slice(0, 20);
  while (Date.now() < deadline) {
    const txt = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
    const userIdx = txt.indexOf(userSnippet);
    if (userIdx >= 0 && !assistantVisibleMs) {
      const afterUser = txt.slice(userIdx + userSnippet.length);
      if (/Yep|I've got|Hi|Hey|Sip|Nex|Got it|I don't have|I can help|verified/i.test(afterUser)) {
        assistantVisibleMs = performance.now() - clickStart;
      }
    }
    if (!cardsVisibleMs && /HOTEL\s*·|Yogyakarta\s+no\s+(price|rating)|Hotel[\s\S]{0,40}Yogyakarta/i.test(txt)) {
      cardsVisibleMs = performance.now() - clickStart;
    }
    if (assistantVisibleMs && (cardsVisibleMs || query.label.startsWith("ordinary"))) break;
    await page.waitForTimeout(80);
  }
  t_events.click_to_assistant_visible_ms = assistantVisibleMs;
  t_events.click_to_cards_visible_ms = cardsVisibleMs;
  t_events.click_to_dom_stable_ms = performance.now() - clickStart;
  t_events.customer_perceived_total_ms = t_events.click_to_assistant_visible_ms ?? t_events.click_to_dom_stable_ms;

  // Correlate with server timings
  const pair = pairs.find((p) => p.sent_message === query.text && !p._used);
  if (pair) {
    pair._used = true;
    t_events.server_debug_timings = pair.responseBody?._debug_timings ?? null;
    t_events.server_intent = pair.responseBody?.intent ?? null;
    t_events.server_reply_snippet = (pair.responseBody?.reply ?? "").slice(0, 200);
    t_events.server_voice_reply_en = pair.responseBody?.voice_reply?.en ?? null;
  }
  t_events.pairs_count = pairs.length;
  t_events.pairs_pending_response = pairs.filter((p) => !p.responseBody).length;
  t_events.pairs_captured_urls = pairs.map((p) => p.sent_message).slice(-10);

  timings.push({ label: iterationLabel, query: query.text, ...t_events });
  return { ok: true };
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.isAbsolute(OUTPUT_DIR) ? OUTPUT_DIR : path.resolve(process.cwd(), OUTPUT_DIR);
  const runDir = path.join(outDir, `run-${timestamp}`);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`NEX CHAT SPEED AUDIT · N=${N} iterations · ${QUERIES.length} queries per iteration`);
  console.log(`chat URL: ${CHAT_URL}`);
  console.log(`output  : ${runDir}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const browser = await chromium.launch({ headless: !HEADED });
  const originHost = new URL(BASE).hostname;

  // WARMUP · direct-curl the chat API twice to pre-compile any lazy routes
  // BEFORE we measure customer-perceived latency. This isolates Turbopack
  // cold-compile from the real chat latency Founder wants to know about.
  console.log(`\n[warmup] pre-compiling chat route with 2 direct hits...`);
  for (let i = 0; i < 2; i++) {
    try {
      await fetch(`${BASE}/api/nex-conv/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello warmup " + i, conversation_id: null, market: "ID" }),
      });
    } catch {}
  }
  console.log(`[warmup] done · starting measurement\n`);

  const allTimings = [];

  for (let iter = 0; iter < N; iter++) {
    console.log(`\n[iter ${iter + 1}/${N}] fresh browser context`);
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    await context.addCookies([{
      name: "xrated_cookie_consent", value: "accepted",
      domain: originHost, path: "/", httpOnly: false, secure: false, sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    }]);
    const page = await context.newPage();

    // Capture requests + responses
    const pairs = [];
    page.on("request", (req) => {
      if (!req.url().includes("/api/nex-conv/chat")) return;
      if (req.method() !== "POST") return;
      try {
        const parsed = req.postData() ? JSON.parse(req.postData()) : null;
        pairs.push({ requestBody: parsed, responseBody: null, sent_message: parsed?.message ?? null, at: new Date().toISOString() });
      } catch {}
    });
    page.on("response", async (res) => {
      if (!res.url().includes("/api/nex-conv/chat")) return;
      try {
        const body = await res.json().catch(() => null);
        if (!body) return;
        for (let i = pairs.length - 1; i >= 0; i--) {
          if (!pairs[i].responseBody) { pairs[i].responseBody = body; break; }
        }
      } catch {}
    });

    try {
      await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForFunction(() => /Hi, I'm Nex|Ask me|How can I help|What are you/i.test(document.body?.innerText ?? ""), { timeout: 20_000 }).catch(() => null);
      await page.locator("textarea[placeholder*='Ask Nex' i]").waitFor({ state: "visible", timeout: 20_000 }).catch(() => null);
      await page.waitForTimeout(2500);

      for (const q of QUERIES) {
        console.log(`  query: "${q.text}"`);
        const result = await runQueryOnPage({ page, iterationLabel: `iter${iter + 1}`, query: q, outDir: runDir, iterationTs: timestamp, pairs, timings: allTimings });
        if (result?.error) console.log(`    ERROR: ${result.error}`);
        else {
          const last = allTimings[allTimings.length - 1];
          const serverT = last?.server_debug_timings?.stage_ms?.total_before_response_send ?? null;
          const serverOrch = last?.server_debug_timings?.stage_ms?.orchestrator ?? null;
          console.log(`    customer_perceived=${last?.customer_perceived_total_ms?.toFixed(0) ?? "?"}ms  server_total=${serverT?.toFixed(0) ?? "?"}ms  orchestrator=${serverOrch?.toFixed(0) ?? "?"}ms  intent=${last?.server_intent}`);
        }
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.log(`  iter ERROR: ${e.message}`);
    }
    await context.close();
  }

  await browser.close();

  // Aggregate by query label
  const byQuery = {};
  for (const t of allTimings) {
    const label = QUERIES.find((q) => q.text === t.query)?.label ?? "unknown";
    (byQuery[label] ??= []).push(t);
  }

  console.log(``);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`AGGREGATE (per query · across ${N} iterations)`);
  console.log(``);
  for (const [label, samples] of Object.entries(byQuery)) {
    const customer = stats(samples.map((s) => s.customer_perceived_total_ms).filter((v) => typeof v === "number"));
    const t2 = stats(samples.map((s) => s.click_to_response_ms).filter((v) => typeof v === "number"));
    const t3 = stats(samples.map((s) => s.click_to_assistant_visible_ms).filter((v) => typeof v === "number"));
    const t4 = stats(samples.map((s) => s.click_to_cards_visible_ms).filter((v) => typeof v === "number"));
    const serverTotal = stats(samples.map((s) => s.server_debug_timings?.stage_ms?.total_before_response_send).filter((v) => typeof v === "number"));
    const serverOrch = stats(samples.map((s) => s.server_debug_timings?.stage_ms?.orchestrator).filter((v) => typeof v === "number"));
    const anyLLM = samples.some((s) => s.server_debug_timings?.llm_invoked === true);
    console.log(`▸ ${label}  (${samples.length} samples · time from SEND CLICK)`);
    console.log(`    click → response received      : ${t2.n}  P50=${t2.p50}ms  P95=${t2.p95}ms  max=${t2.max}ms`);
    console.log(`    click → assistant visible      : ${t3.n}  P50=${t3.p50}ms  P95=${t3.p95}ms  max=${t3.max}ms`);
    console.log(`    click → cards visible          : ${t4.n}  P50=${t4.p50}ms  P95=${t4.p95}ms  max=${t4.max}ms`);
    console.log(`    CUSTOMER PERCEIVED TOTAL       : n=${customer.n}  P50=${customer.p50}ms  P95=${customer.p95}ms  max=${customer.max}ms`);
    console.log(`    server orchestrator            : n=${serverOrch.n}  P50=${serverOrch.p50}ms  P95=${serverOrch.p95}ms  max=${serverOrch.max}ms`);
    console.log(`    server total_before_response   : n=${serverTotal.n}  P50=${serverTotal.p50}ms  P95=${serverTotal.p95}ms  max=${serverTotal.max}ms`);
    console.log(`    LLM invoked in any            : ${anyLLM}`);
    // Attribution: what portion is server vs client?
    if (customer.p50 && serverTotal.p50) {
      const clientOverhead = customer.p50 - serverTotal.p50;
      const serverPct = ((serverTotal.p50 / customer.p50) * 100).toFixed(1);
      const clientPct = ((clientOverhead / customer.p50) * 100).toFixed(1);
      console.log(`    ATTRIBUTION (P50)             : server=${serverTotal.p50}ms (${serverPct}%)  ·  client/network=${clientOverhead.toFixed(1)}ms (${clientPct}%)`);
    }
    console.log(``);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  fs.writeFileSync(path.join(runDir, "speed-audit-timings.json"), JSON.stringify({
    started_at: timestamp,
    n_iterations: N,
    queries: QUERIES,
    samples: allTimings,
  }, null, 2));
  console.log(`\nfull timings: ${runDir}/speed-audit-timings.json`);
}

main().catch((e) => {
  console.error(`bench FAILED: ${e.stack ?? e.message ?? e}`);
  process.exit(1);
});
