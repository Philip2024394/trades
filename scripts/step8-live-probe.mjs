#!/usr/bin/env node
// scripts/step8-live-probe.mjs
//
// STEP 8 · LIVE PROBE · Mason render reduction verification.
//
// Same 30-Q&A carpet+timber body with a fresh Step-8 marker.
// Captures extractor_prompt_assembled telemetry so we can compare
// context_chars against the Step 7 baseline (6,798).
//
// Preserves all prior evidence · touches no historical records.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT     = process.cwd();
const BASE_URL = process.env.NEX_BRAIN_URL || "http://localhost:3008";
const SOURCE_ID = "nx_msndt1sa_238b961a";
const SOURCE_FILE = join(ROOT, "data", "knowledge-inbox", "content", `${SOURCE_ID}.txt`);
const EVENTS_FILE = join(ROOT, "data", "nex-events", "events.jsonl");
const PROBE_TAG = `step8-probe-${Date.now()}`;

// Step 7 baseline (authoritative reference · captured post-Rowan-reduction).
const STEP7 = {
  system:   4488,
  context:  6798,     // ← STEP 8 TARGET · expected drop
  voice:    1294,
  learning: 1504,
  raw:      11691,
  user_msg: 22817,
  total:    27305,
  est_in:   7801,
  est_tot:  15993,
};

const log = (m) => console.log(`[step8] ${m}`);

async function post(pathname, body, extraHeaders = {}) {
  const headers = { "content-type": "application/json", ...extraHeaders };
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST", headers, body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

function readEventsSince(byteOffset) {
  const buf = readFileSync(EVENTS_FILE);
  return { newSize: buf.length, lines: buf.slice(byteOffset).toString("utf8").split("\n").filter(Boolean) };
}

const rawSource = readFileSync(SOURCE_FILE, "utf8");
const probeBody = `${rawSource}\n\n<!-- ${PROBE_TAG} -->\n`;
const title = `[🌍 Platform · Staircases · L1] STEP8 PROBE · Carpet+Timber Colour Compatibility (${PROBE_TAG})`;

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
  console.error("[step8] dump failed:", dump.text.slice(0, 400)); process.exit(1);
}
const inboxItemId = dump.json.item?.id ?? null;
const jobId       = dump.json.job?.job_id ?? null;
log(`  inbox_item_id:   ${inboxItemId}`);
log(`  job_id:          ${jobId}`);
if (!jobId) { console.error("[step8] no job · aborting"); process.exit(2); }

log("polling events for extractor_prompt_assembled…");
const DEADLINE_MS = 240_000;
const POLL_MS = 2_000;
const started = Date.now();
let cursor = preSize;
let extractorEvent = null;
let providerOk = null;

while (Date.now() - started < DEADLINE_MS) {
  const { newSize, lines } = readEventsSince(cursor);
  if (newSize !== cursor) {
    for (const line of lines) {
      let evt = null; try { evt = JSON.parse(line); } catch { continue; }
      const matchesJob   = evt.related_job === jobId;
      const matchesInbox = evt.payload?.inbox_item_id === inboxItemId;
      if (evt.event_type === "extractor_prompt_assembled" && (matchesJob || matchesInbox)) {
        extractorEvent = evt;
      }
      if (evt.event_type === "provider_response_ok" && !providerOk && extractorEvent) {
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

console.log("");
console.log("=".repeat(78));
console.log("STEP 8 · LIVE PROBE · MASON REDUCTION RUNTIME MEASUREMENT");
console.log("=".repeat(78));
console.log(`probe tag:       ${PROBE_TAG}`);
console.log(`inbox_item_id:   ${inboxItemId}`);
console.log(`job_id:          ${jobId}`);
console.log("");

if (!extractorEvent) {
  console.log("EXTRACTOR TELEMETRY: NOT CAPTURED within deadline.");
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
console.log("                     STEP-7 BASELINE     STEP-8 MEASURED       DELTA");
console.log("                     ---------------     ---------------       -------------------");
console.log(`system_chars         ${String(STEP7.system).padStart(14)}      ${String(p.system_chars).padStart(14)}       ${delta(p.system_chars, STEP7.system)}`);
console.log(`context_chars        ${String(STEP7.context).padStart(14)}      ${String(p.context_chars).padStart(14)}       ${delta(p.context_chars, STEP7.context)}   ← STEP 8 TARGET`);
console.log(`voice_chars          ${String(STEP7.voice).padStart(14)}      ${String(p.voice_chars).padStart(14)}       ${delta(p.voice_chars, STEP7.voice)}`);
console.log(`learning_chars       ${String(STEP7.learning).padStart(14)}      ${String(p.learning_chars).padStart(14)}       ${delta(p.learning_chars, STEP7.learning)}`);
console.log(`raw_content_chars    ${String(STEP7.raw).padStart(14)}      ${String(p.raw_content_chars).padStart(14)}       ${delta(p.raw_content_chars, STEP7.raw)}`);
console.log(`user_message_chars   ${String(STEP7.user_msg).padStart(14)}      ${String(p.user_message_chars).padStart(14)}       ${delta(p.user_message_chars, STEP7.user_msg)}`);
console.log(`total_input_chars    ${String(STEP7.total).padStart(14)}      ${String(p.total_input_chars).padStart(14)}       ${delta(p.total_input_chars, STEP7.total)}`);
console.log(`estimated_input_tok  ${String(STEP7.est_in).padStart(14)}      ${String(p.estimated_input_tokens).padStart(14)}       ${delta(p.estimated_input_tokens, STEP7.est_in)}`);
console.log(`estimated_total_tok  ${String(STEP7.est_tot).padStart(14)}      ${String(p.estimated_total_tokens).padStart(14)}       ${delta(p.estimated_total_tokens, STEP7.est_tot)}`);
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
console.log("HALT after Step 8 per Philip's directive.");
