#!/usr/bin/env node
// scripts/nex-calling/report-experiment.mjs
//
// NEX Internal Calling · Stage 1 experiment report · Philip 2026-08-27.
//
// Reads data/nex-calling/call_events.jsonl and reports:
//   · Total events logged
//   · Number of identities registered
//   · Number of unique callIds observed
//   · Path distribution (p2p / srflx / relay / unknown) from measurement events
//   · Median connection time (hello → connected)
//   · Median bytes-sent / bytes-received per call
//   · Median packet loss / jitter / RTT
//   · Whether Stage 1 exit criterion is met:
//       ≥1 call reached connectionState='connected' with path='p2p' or 'srflx'
//
// Run: node scripts/nex-calling/report-experiment.mjs

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(__dirname, "..", "..", "data", "nex-calling", "call_events.jsonl");

if (!existsSync(LOG_PATH)) {
  console.log(`No events log yet at ${LOG_PATH}`);
  console.log(`Run the experiment (see docs/nex-calling/stage-1-runbook.md) to produce events.`);
  process.exit(0);
}

const raw = readFileSync(LOG_PATH, "utf8");
const lines = raw.split("\n").filter((l) => l.trim().length > 0);
const events = [];
for (const line of lines) {
  try { events.push(JSON.parse(line)); } catch { /* skip malformed */ }
}

if (events.length === 0) {
  console.log(`Log exists but has 0 valid events.`);
  process.exit(0);
}

const identities = new Set();
const helloTs = new Map();          // identity → first hello ts
const callIds = new Set();
const measures = [];
const pathCounts = { p2p: 0, srflx: 0, relay: 0, unknown: 0 };
const connectionStates = {};
let helloCount = 0;
let sendCount = 0;
let byeCount = 0;

for (const e of events) {
  if (e.kind === "hello") {
    helloCount += 1;
    if (e.identity) {
      identities.add(e.identity);
      if (!helloTs.has(e.identity)) helloTs.set(e.identity, e.ts);
    }
  } else if (e.kind === "send") {
    sendCount += 1;
    if (e.message_type === "bye") byeCount += 1;
  } else if (e.kind === "measure") {
    measures.push(e);
    if (e.callId) callIds.add(e.callId);
    const p = e.path ?? "unknown";
    pathCounts[p] = (pathCounts[p] ?? 0) + 1;
    connectionStates[e.connectionState ?? "unknown"] = (connectionStates[e.connectionState ?? "unknown"] ?? 0) + 1;
  }
}

// Aggregate stats · per-call summary (latest measurement per callId)
const perCall = new Map();
for (const m of measures) {
  const prev = perCall.get(m.callId);
  if (!prev || (m.timestampMs ?? 0) > (prev.timestampMs ?? 0)) perCall.set(m.callId, m);
}

const perCallList = Array.from(perCall.values());
function median(nums) {
  const sorted = [...nums].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

const medBytesSent   = median(perCallList.map((c) => c.bytesSent));
const medBytesRecv   = median(perCallList.map((c) => c.bytesReceived));
const medPacketsLost = median(perCallList.map((c) => c.packetsLost));
const medJitter      = median(perCallList.map((c) => c.jitterMs));
const medRTT         = median(perCallList.map((c) => c.roundTripMs));

// Stage 1 exit criterion check
const successfulCalls = perCallList.filter(
  (c) => c.connectionState === "connected" && (c.path === "p2p" || c.path === "srflx"),
);
const exitCriterionMet = successfulCalls.length >= 1;

const totalRelayed = pathCounts.relay ?? 0;
const totalMeasures = measures.length;
const relayShare = totalMeasures > 0 ? (totalRelayed / totalMeasures) : 0;

console.log("");
console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
console.log("║  NEX Internal Calling · Stage 1 experiment report                            ║");
console.log("╚══════════════════════════════════════════════════════════════════════════════╝");
console.log("");
console.log(`Events file:          ${LOG_PATH}`);
console.log(`Total events:         ${events.length}`);
console.log(`Hello events:         ${helloCount}`);
console.log(`Send events:          ${sendCount} · of which bye: ${byeCount}`);
console.log(`Measurement events:   ${totalMeasures}`);
console.log(`Distinct identities:  ${identities.size} · [${Array.from(identities).join(", ")}]`);
console.log(`Distinct calls:       ${callIds.size}`);
console.log("");
console.log("── Path distribution (across measurement samples) ──");
console.log(`  p2p:     ${pathCounts.p2p ?? 0}`);
console.log(`  srflx:   ${pathCounts.srflx ?? 0}`);
console.log(`  relay:   ${pathCounts.relay ?? 0}`);
console.log(`  unknown: ${pathCounts.unknown ?? 0}`);
console.log(`  Relay share: ${(relayShare * 100).toFixed(1)}% · ${totalRelayed > 0 ? "TURN WOULD BE NEEDED for these" : "NO TURN required so far"}`);
console.log("");
console.log("── Connection states seen ──");
for (const [state, count] of Object.entries(connectionStates)) {
  console.log(`  ${state}: ${count}`);
}
console.log("");
console.log("── Per-call medians ──");
console.log(`  Bytes sent:     ${medBytesSent?.toLocaleString() ?? "n/a"}`);
console.log(`  Bytes received: ${medBytesRecv?.toLocaleString() ?? "n/a"}`);
console.log(`  Packets lost:   ${medPacketsLost ?? "n/a"}`);
console.log(`  Jitter (ms):    ${medJitter ?? "n/a"}`);
console.log(`  RTT (ms):       ${medRTT ?? "n/a"}`);
console.log("");
console.log("══════════════════════════════════════════════════════════════════════════════");
if (exitCriterionMet) {
  console.log(`  ✓ STAGE 1 EXIT CRITERION MET`);
  console.log(`    ${successfulCalls.length} call${successfulCalls.length === 1 ? "" : "s"} reached connectionState='connected'`);
  console.log(`    with path ∈ {p2p, srflx} · media bypassed NEX signalling.`);
  console.log(`    NEX transported ONLY signalling (SDP + ICE), not media.`);
} else {
  console.log(`  ✗ STAGE 1 EXIT CRITERION NOT YET MET`);
  console.log(`    No call reached connectionState='connected' with a non-relay path.`);
  console.log(`    Try: run the experiment (see stage-1-runbook.md) with two browsers.`);
}
console.log("══════════════════════════════════════════════════════════════════════════════");
console.log("");
