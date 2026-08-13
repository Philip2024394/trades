#!/usr/bin/env node
// scripts/step6-live-probe.mjs
//
// STEP 6 · LIVE PROBE ONLY (Philip GO 2026-08-10).
//
// Purpose:
//   Submit an equivalent controlled probe (the same 30-Q&A carpet+timber
//   dump body) through the CURRENT worker chain — after the Step 5 Avery
//   SYSTEM_PROMPT reduction — and capture the extractor_prompt_assembled
//   telemetry so we can compare against the Step 2 baseline.
//
// Non-negotiable constraints (Philip):
//   · Do NOT modify the historical failed record nx_msndt1sa_238b961a
//   · Do NOT change Mason / Rowan / Blake / provider config / migrations
//   · Do NOT batch-rewrite anything
//   · Report ONLY measured results and provider outcome
//   · STOP after Step 6
//
// How we avoid touching history:
//   The dump endpoint deduplicates by sha256 · so submitting the identical
//   11,655-char body would return the existing item and no new job. We
//   append a single-line probe marker at the very end (~40 chars) so the
//   hash differs. Raw content delta is reported explicitly.

import { readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT     = process.cwd();
const BASE_URL = process.env.NEX_BRAIN_URL || "http://localhost:3008";
const TOKEN    = process.env.NEX_BRAIN_CRON_TOKEN || process.env.CRON_SECRET || "";
const SOURCE_ID = "nx_msndt1sa_238b961a";
const SOURCE_FILE = join(ROOT, "data", "knowledge-inbox", "content", `${SOURCE_ID}.txt`);
const EVENTS_FILE = join(ROOT, "data", "nex-events", "events.jsonl");
const PROBE_TAG = `step6-probe-${Date.now()}`;

function log(msg) { console.log(`[step6] ${msg}`); }

async function post(pathname, body, extraHeaders = {}) {
  const headers = { "content-type": "application/json", ...extraHeaders };
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
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

// ── 1) Read raw content + prepare probe body ─────────────────────────
const rawSource = readFileSync(SOURCE_FILE, "utf8");
const rawSourceChars = rawSource.length;
const probeBody = `${rawSource}\n\n<!-- ${PROBE_TAG} -->\n`;
const probeChars = probeBody.length;
const probeDelta = probeChars - rawSourceChars;

// Title routes the item into the Staircase Brain (Platform · Staircases · L1) ·
// matching the historical intent. Adds "STEP6 PROBE" so it's identifiable in HQ.
const title = `[🌍 Platform · Staircases · L1] STEP6 PROBE · Carpet+Timber Colour Compatibility (${PROBE_TAG})`;

log(`source file:            ${SOURCE_FILE}`);
log(`source raw chars:       ${rawSourceChars}`);
log(`probe raw chars:        ${probeChars}  (delta ${probeDelta} · marker only)`);
log(`base url:               ${BASE_URL}`);
log(`token:                  ${TOKEN ? "configured" : "(none)"}`);
log(`events file:            ${EVENTS_FILE}`);

// Snapshot events size BEFORE submitting so we can enumerate only new events.
const preSize = readFileSync(EVENTS_FILE).length;
log(`events file size (pre): ${preSize} bytes`);

// ── 2) Submit dump ────────────────────────────────────────────────────
log("submitting dump…");
const dump = await post("/api/nex/knowledge-inbox/dump", {
  source: "chatgpt-approved",
  title,
  content: probeBody,
});
log(`  dump status: ${dump.status}`);
if (dump.status !== 200 || !dump.json?.ok) {
  console.error("[step6] dump failed:", dump.text.slice(0, 400));
  process.exit(1);
}
const inboxItemId = dump.json.item?.id ?? null;
const jobId       = dump.json.job?.job_id ?? null;
const deduped     = dump.json.deduplicated === true;
log(`  inbox_item_id:      ${inboxItemId}`);
log(`  job_id:             ${jobId}`);
log(`  deduplicated:       ${deduped}`);

if (deduped) {
  console.error("[step6] dump was deduplicated · marker did not break hash · aborting to avoid touching history");
  process.exit(2);
}
if (!jobId) {
  console.error("[step6] no job created · aborting");
  process.exit(3);
}

// ── 3) Trigger the worker to pick up the job ─────────────────────────
log("triggering worker run-once…");
const runHeaders = TOKEN
  ? { "x-brain-cron-token": TOKEN, "authorization": `Bearer ${TOKEN}` }
  : {};
const run = await post("/api/nex/brain/run-once", {
  context_batch: 5,
  finalize_batch: 5,
  extract_batch: 5,
}, runHeaders);
log(`  run-once status: ${run.status}`);
if (run.status !== 200) {
  console.error("[step6] run-once failed:", run.text.slice(0, 400));
  // Continue anyway · a background worker may still pick it up.
}

// ── 4) Poll for the extractor_prompt_assembled event tied to our job ─
const DEADLINE_MS = 120_000; // 2 min · Avery + downstream + retry envelope
const POLL_MS     = 2_000;
const started = Date.now();
let cursor    = preSize;
let extractorEvent = null;
let providerOutcome = null;
let ranOnceMore = false;

log("polling events for extractor_prompt_assembled…");
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
      // Capture the terminal job outcome for provider reporting.
      if ((evt.event_type === "knowledge_job_completed" || evt.event_type === "knowledge_job_failed") && matchesJob) {
        providerOutcome = evt;
      }
    }
    cursor = newSize;
  }
  if (extractorEvent && providerOutcome) break;
  // If we have the prompt event but no outcome yet, give more time.
  // If neither after 30s, nudge run-once one more time.
  if (!extractorEvent && !ranOnceMore && Date.now() - started > 30_000) {
    log("  nudging worker again (30s no telemetry)…");
    await post("/api/nex/brain/run-once", { context_batch: 5, finalize_batch: 5, extract_batch: 5 }, runHeaders);
    ranOnceMore = true;
  }
  await sleep(POLL_MS);
}

// ── 5) Report ─────────────────────────────────────────────────────────
console.log("");
console.log("=".repeat(78));
console.log("STEP 6 · LIVE PROBE RESULT · POST-STEP-5 AVERY REDUCTION");
console.log("=".repeat(78));
console.log(`probe tag:             ${PROBE_TAG}`);
console.log(`inbox_item_id:         ${inboxItemId}`);
console.log(`job_id:                ${jobId}`);
console.log(`source raw chars:      ${rawSourceChars}`);
console.log(`probe raw chars:       ${probeChars}  (delta ${probeDelta} · marker only)`);
console.log("");

if (!extractorEvent) {
  console.log("EXTRACTOR TELEMETRY: NOT CAPTURED within 120s deadline.");
  console.log("(worker may not have reached extract phase · check worker log)");
} else {
  const p = extractorEvent.payload || {};
  const BASELINE = {
    system: 5717, context: 6332, voice: 1664, learning: 1946,
    raw: 85, user_msg: 11475, total: 17192,
    est_input: 4912, est_total: 13104,
  };
  const delta = (now, base) => {
    const d = now - base;
    const pct = base === 0 ? "n/a" : `${((d / base) * 100).toFixed(1)}%`;
    return `${d >= 0 ? "+" : ""}${d}  (${pct})`;
  };
  console.log("EXTRACTOR TELEMETRY (extractor_prompt_assembled):");
  console.log("");
  console.log("                    STEP-2 BASELINE     STEP-6 MEASURED       DELTA");
  console.log("                    ---------------     ---------------       -------------------");
  console.log(`system_chars        ${String(BASELINE.system).padStart(13)}       ${String(p.system_chars).padStart(13)}       ${delta(p.system_chars, BASELINE.system)}`);
  console.log(`context_chars       ${String(BASELINE.context).padStart(13)}       ${String(p.context_chars).padStart(13)}       ${delta(p.context_chars, BASELINE.context)}`);
  console.log(`voice_chars         ${String(BASELINE.voice).padStart(13)}       ${String(p.voice_chars).padStart(13)}       ${delta(p.voice_chars, BASELINE.voice)}`);
  console.log(`learning_chars      ${String(BASELINE.learning).padStart(13)}       ${String(p.learning_chars).padStart(13)}       ${delta(p.learning_chars, BASELINE.learning)}`);
  console.log(`raw_content_chars   ${String(BASELINE.raw).padStart(13)}       ${String(p.raw_content_chars).padStart(13)}       ${delta(p.raw_content_chars, BASELINE.raw)}`);
  console.log(`  ↳ original        ${String(BASELINE.raw).padStart(13)}       ${String(p.raw_content_original_chars).padStart(13)}`);
  console.log(`  ↳ truncated       ${"—".padStart(13)}       ${String(p.raw_content_truncated).padStart(13)}`);
  console.log(`user_message_chars  ${String(BASELINE.user_msg).padStart(13)}       ${String(p.user_message_chars).padStart(13)}       ${delta(p.user_message_chars, BASELINE.user_msg)}`);
  console.log(`total_input_chars   ${String(BASELINE.total).padStart(13)}       ${String(p.total_input_chars).padStart(13)}       ${delta(p.total_input_chars, BASELINE.total)}`);
  console.log(`estimated_input_tok ${String(BASELINE.est_input).padStart(13)}       ${String(p.estimated_input_tokens).padStart(13)}       ${delta(p.estimated_input_tokens, BASELINE.est_input)}`);
  console.log(`estimated_total_tok ${String(BASELINE.est_total).padStart(13)}       ${String(p.estimated_total_tokens).padStart(13)}       ${delta(p.estimated_total_tokens, BASELINE.est_total)}`);
  console.log("");
  console.log(`estimator:          kind=${p.estimator_kind} · chars/token=${p.estimator_chars_per_token}`);
  console.log(`prefer_provider:    ${p.prefer_provider}`);
  console.log(`requires_capability:${p.requires_capability}`);
  console.log(`context records:    ${p.context_records_count} · gap keywords: ${p.context_gap_keywords_count}`);
  console.log(`voice audience:     ${p.voice_primary_audience}  · brand terms: ${p.voice_brand_terms_count}`);
  console.log(`learning examples:  ${p.learning_examples_count}`);
  console.log(`assembled_at:       ${p.assembled_at}`);
  console.log("");
  const targetSys = 4488;
  const sysOk = p.system_chars === targetSys;
  console.log(`STEP 5 VERIFICATION: system_chars target ${targetSys} · measured ${p.system_chars} → ${sysOk ? "MATCH" : "MISMATCH"}`);
}

console.log("");
console.log("-".repeat(78));
if (providerOutcome) {
  console.log(`PROVIDER OUTCOME: ${providerOutcome.event_type} · outcome=${providerOutcome.outcome}`);
  if (providerOutcome.payload?.provider) console.log(`  provider used:     ${providerOutcome.payload.provider}`);
  if (providerOutcome.payload?.model)    console.log(`  model used:        ${providerOutcome.payload.model}`);
  if (providerOutcome.payload?.error)    console.log(`  error:             ${String(providerOutcome.payload.error).slice(0, 400)}`);
  if (providerOutcome.payload?.records_extracted) console.log(`  records extracted: ${providerOutcome.payload.records_extracted}`);
} else {
  console.log("PROVIDER OUTCOME: not observed within deadline (may still be in progress).");
  console.log("  Check `data/nex-jobs/jobs.jsonl` for terminal state on this job_id.");
}
console.log("-".repeat(78));
console.log("HALT after Step 6 per Philip's directive. No further changes made.");
