#!/usr/bin/env node
// scripts/step7-live-probe.mjs
//
// STEP 7 · LIVE PROBE · Rowan render reduction verification.
//
// Submits the same 30-Q&A Carpet+Timber body (with a fresh Step-7 marker)
// through the CURRENT worker chain — after the Step 7 renderLearning
// reduction — and captures the extractor_prompt_assembled telemetry so we
// can compare learning_chars against the Step 6 baseline (1,904).
//
// Constraints preserved:
//   · Historical failed record nx_msndt1sa_238b961a untouched
//   · Historical success probe nx_msngtbff_548e39bc untouched
//   · No architecture / provider / config changes
//   · Measurement only · then STOP
//
// This is not a re-proof of Step 6 · this is the measurement pass Philip
// explicitly requested inside Step 7: "Measure the actual before/after
// learning_chars and total prompt size."

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT     = process.cwd();
const BASE_URL = process.env.NEX_BRAIN_URL || "http://localhost:3008";
const SOURCE_ID = "nx_msndt1sa_238b961a";
const SOURCE_FILE = join(ROOT, "data", "knowledge-inbox", "content", `${SOURCE_ID}.txt`);
const EVENTS_FILE = join(ROOT, "data", "nex-events", "events.jsonl");
const PROBE_TAG = `step7-probe-${Date.now()}`;

// Step 6 baseline snapshot (authoritative reference for the comparison).
const STEP6 = {
  system:   4488,
  context:  6558,
  voice:    1294,
  learning: 1904,
  raw:      11691,
  user_msg: 22977,
  total:    27465,
  est_in:   7847,
  est_tot:  16039,
};

function log(msg) { console.log(`[step7] ${msg}`); }

async function post(pathname, body, extraHeaders = {}) {
  const headers = { "content-type": "application/json", ...extraHeaders };
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST", headers, body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, json, text };
}

function readEventsSince(byteOffset) {
  const buf = readFileSync(EVENTS_FILE);
  const slice = buf.slice(byteOffset);
  return { newSize: buf.length, lines: slice.toString("utf8").split("\n").filter(Boolean) };
}

const rawSource = readFileSync(SOURCE_FILE, "utf8");
const probeBody = `${rawSource}\n\n<!-- ${PROBE_TAG} -->\n`;
const title = `[🌍 Platform · Staircases · L1] STEP7 PROBE · Carpet+Timber Colour Compatibility (${PROBE_TAG})`;

log(`base url:                ${BASE_URL}`);
log(`source raw chars:        ${rawSource.length}`);
log(`probe raw chars:         ${probeBody.length}`);

const preSize = readFileSync(EVENTS_FILE).length;
log(`events file size (pre):  ${preSize} bytes`);

log("submitting dump…");
const dump = await post("/api/nex/knowledge-inbox/dump", {
  source: "chatgpt-approved", title, content: probeBody,
});
if (dump.status !== 200 || !dump.json?.ok) {
  console.error("[step7] dump failed:", dump.text.slice(0, 400));
  process.exit(1);
}
const inboxItemId = dump.json.item?.id ?? null;
const jobId       = dump.json.job?.job_id ?? null;
log(`  inbox_item_id:   ${inboxItemId}`);
log(`  job_id:          ${jobId}`);
if (!jobId) { console.error("[step7] no job · aborting"); process.exit(2); }

// The background worker will pick it up automatically (as it did for Step 6).
log("polling events for extractor_prompt_assembled…");
const DEADLINE_MS = 180_000;
const POLL_MS = 2_000;
const started = Date.now();
let cursor = preSize;
let extractorEvent = null;
let providerOk = null;

while (Date.now() - started < DEADLINE_MS) {
  const { newSize, lines } = readEventsSince(cursor);
  if (newSize !== cursor) {
    for (const line of lines) {
      let evt = null;
      try { evt = JSON.parse(line); } catch { continue; }
      const matchesJob   = evt.related_job === jobId;
      const matchesInbox = evt.payload?.inbox_item_id === inboxItemId;
      if (evt.event_type === "extractor_prompt_assembled" && (matchesJob || matchesInbox)) {
        extractorEvent = evt;
      }
      if (evt.event_type === "provider_response_ok" && !providerOk && extractorEvent) {
        // Any provider success after our extractor emission belongs to this probe.
        // (Not perfectly attributed · we take the first success after our event.)
        if (new Date(evt.timestamp).getTime() >= new Date(extractorEvent.timestamp).getTime()) {
          providerOk = evt;
        }
      }
    }
    cursor = newSize;
  }
  if (extractorEvent && providerOk) break;
  await sleep(POLL_MS);
}

// ── Report ────────────────────────────────────────────────────────────
console.log("");
console.log("=".repeat(78));
console.log("STEP 7 · LIVE PROBE · ROWAN REDUCTION RUNTIME MEASUREMENT");
console.log("=".repeat(78));
console.log(`probe tag:             ${PROBE_TAG}`);
console.log(`inbox_item_id:         ${inboxItemId}`);
console.log(`job_id:                ${jobId}`);
console.log("");

if (!extractorEvent) {
  console.log("EXTRACTOR TELEMETRY: NOT CAPTURED within deadline.");
  console.log("Check worker log · re-check events.jsonl for later completion.");
  process.exit(3);
}

const p = extractorEvent.payload || {};
const delta = (now, base) => {
  const d = now - base;
  const pct = base === 0 ? "n/a" : `${((d / base) * 100).toFixed(1)}%`;
  return `${d >= 0 ? "+" : ""}${d}  (${pct})`;
};

console.log("EXTRACTOR TELEMETRY (extractor_prompt_assembled):");
console.log("");
console.log("                     STEP-6 BASELINE     STEP-7 MEASURED       DELTA");
console.log("                     ---------------     ---------------       -------------------");
console.log(`system_chars         ${String(STEP6.system).padStart(14)}      ${String(p.system_chars).padStart(14)}       ${delta(p.system_chars, STEP6.system)}`);
console.log(`context_chars        ${String(STEP6.context).padStart(14)}      ${String(p.context_chars).padStart(14)}       ${delta(p.context_chars, STEP6.context)}`);
console.log(`voice_chars          ${String(STEP6.voice).padStart(14)}      ${String(p.voice_chars).padStart(14)}       ${delta(p.voice_chars, STEP6.voice)}`);
console.log(`learning_chars       ${String(STEP6.learning).padStart(14)}      ${String(p.learning_chars).padStart(14)}       ${delta(p.learning_chars, STEP6.learning)}   ← STEP 7 TARGET`);
console.log(`raw_content_chars    ${String(STEP6.raw).padStart(14)}      ${String(p.raw_content_chars).padStart(14)}       ${delta(p.raw_content_chars, STEP6.raw)}`);
console.log(`user_message_chars   ${String(STEP6.user_msg).padStart(14)}      ${String(p.user_message_chars).padStart(14)}       ${delta(p.user_message_chars, STEP6.user_msg)}`);
console.log(`total_input_chars    ${String(STEP6.total).padStart(14)}      ${String(p.total_input_chars).padStart(14)}       ${delta(p.total_input_chars, STEP6.total)}`);
console.log(`estimated_input_tok  ${String(STEP6.est_in).padStart(14)}      ${String(p.estimated_input_tokens).padStart(14)}       ${delta(p.estimated_input_tokens, STEP6.est_in)}`);
console.log(`estimated_total_tok  ${String(STEP6.est_tot).padStart(14)}      ${String(p.estimated_total_tokens).padStart(14)}       ${delta(p.estimated_total_tokens, STEP6.est_tot)}`);
console.log("");
console.log(`context records: ${p.context_records_count} · gap keywords: ${p.context_gap_keywords_count}`);
console.log(`voice audience:  ${p.voice_primary_audience} · brand terms: ${p.voice_brand_terms_count}`);
console.log(`learning examples: ${p.learning_examples_count}`);
console.log(`assembled_at:      ${p.assembled_at}`);
console.log("");

if (providerOk) {
  const pp = providerOk.payload || {};
  console.log(`Provider success after our event: ${pp.provider}/${pp.model} · attempt ${pp.attempt} · tokens_in=${pp.tokens_in} tokens_out=${pp.tokens_out}`);
} else {
  console.log("(no provider_response_ok observed within deadline · worker may still be running)");
}
console.log("");
console.log("HALT after Step 7 per Philip's directive.");
