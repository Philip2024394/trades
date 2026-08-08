#!/usr/bin/env node
// reception-semantics.test.mjs · Phase 12.4 followup
//
// Dashboard truthfulness lock. Philip 2026-08-09: the Reception
// dashboard was misleading — idle-healthy workers were rendered as if
// broken, historical 24h metrics were rendered as if live, and
// timeline events could be misread as current state. This test file
// asserts the specific label semantics that the Reception + Factory
// + Operations Centre must never regress on.
//
// PURE STATIC · grep-only · zero runtime dependencies.
//
// Assertions:
//   R1  · factory · STATUS_COLOR.standby label reads as HEALTHY IDLE
//         (not "Standby" · not "Offline" · must include "ready" or
//         "idle" or "queue empty" so a non-engineer understands the
//         worker is fine)
//   R2  · factory · STATUS_COLOR.offline label reads as NEEDS ATTENTION
//         (not "Standby" · signals a real problem)
//   R3  · factory · WorkersPanel header includes "RIGHT NOW" or similar
//         snapshot qualifier
//   R4  · factory · WorkersPanel header notes the refresh cadence
//   R5  · factory · totals-bar span titles use words like "processing"
//         / "ready" / "in flight" — never bare "Standby"/"Offline"
//   R6  · factory · ActivityStream header signals HISTORICAL nature
//         (contains "HISTORY" or "past events" · not just "LAST MOVEMENT")
//   R7  · operations-centre · Reception band prefixes state summary
//         with "Right now:" so it can't be confused with historical
//   R8  · operations-centre · Reception band uses "ready & idle" (not
//         "resting") so the healthy state reads as healthy
//   R9  · operations-centre · ProviderTile 24h metrics carry "24h"
//         suffix on every relevant label (Calls / OK / Fail / Success)
//   R10 · operations-centre · ProviderTile · "On task now" banner
//         only shows when there's a real in-flight count · never fires
//         solely from 24h aggregate presence
//   R11 · Both surfaces · no bare label matching /^(Working|Standby|
//         Offline|Failed)$/ inside a rendered element that could be
//         misread as a bare status pill without context
//   R12 · deriveLiveness NOT re-implemented (single source of truth
//         remains in heartbeat.ts — semantics change here would ripple)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const FACTORY = readFileSync(join(REPO, "src/app/nex-app/nex-brain/factory/page.tsx"), "utf8");
const OPS     = readFileSync(join(REPO, "src/app/nex-app/nex-brain/operations-centre/page.tsx"), "utf8");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

// R1 · factory · standby reads as HEALTHY IDLE
const standbyLabelMatch = FACTORY.match(/standby:\s*\{[^}]*label:\s*"([^"]+)"/);
const standbyLabel = standbyLabelMatch ? standbyLabelMatch[1] : "";
const healthyIdleWords = /\b(ready|idle|queue empty|waiting)\b/i.test(standbyLabel);
record("R1", healthyIdleWords, `standby label = "${standbyLabel}" ${healthyIdleWords ? "(reads as healthy)" : "(BROKEN · reads as fault)"}`);

// R2 · factory · offline reads as NEEDS ATTENTION
const offlineLabelMatch = FACTORY.match(/offline:\s*\{[^}]*label:\s*"([^"]+)"/);
const offlineLabel = offlineLabelMatch ? offlineLabelMatch[1] : "";
const attentionWords = /\b(not responding|failed|down|dead|missing)\b/i.test(offlineLabel);
record("R2", attentionWords, `offline label = "${offlineLabel}" ${attentionWords ? "(signals attention needed)" : "(too ambiguous)"}`);

// R3 · WorkersPanel header includes snapshot qualifier
const workersHeaderQualified = /WORKERS\s*·\s*RIGHT NOW/i.test(FACTORY);
record("R3", workersHeaderQualified, "WORKERS header includes RIGHT NOW qualifier");

// R4 · WorkersPanel header notes refresh cadence
const cadenceNoted = /refreshes every.*POLL_MS|snapshot.*POLL_MS|POLL_MS \/ 1000.*s/i.test(FACTORY);
record("R4", cadenceNoted, "WORKERS header references POLL_MS cadence");

// R5 · totals-bar titles no bare Standby/Offline
const barTitles = [...FACTORY.matchAll(/<span title="([^"]+)">🟢|🟡|🔵|🔴|⚪/g)]
  .map((m) => m[1]);
// simpler: grep for the human-friendly title strings we shipped
const usesFriendlyTitles = /title="Actively processing a job right now"/.test(FACTORY)
  && /title="Healthy · queue empty · ready for work"/.test(FACTORY)
  && /title="No heartbeat in 60s · needs attention"/.test(FACTORY);
record("R5", usesFriendlyTitles, "totals-bar span titles use human-friendly wording");

// R6 · ActivityStream header signals HISTORICAL nature
const activityHistorical = /RECENT ACTIVITY\s*·\s*HISTORY/i.test(FACTORY)
  && /past events/i.test(FACTORY)
  && /NOT current worker state/.test(FACTORY);
record("R6", activityHistorical, "ActivityStream header signals HISTORICAL + clarifies NOT current state");

// R7 · operations-centre Reception band prefixes with "Right now:"
const receptionRightNow = /Right now:\s*\$\{totalActive\}\s*processing/.test(OPS)
  || /Right now:.*totalActive.*processing/.test(OPS);
record("R7", receptionRightNow, "Reception band uses \"Right now:\" prefix");

// R8 · operations-centre Reception band uses "ready & idle" (not "resting")
const readyIdle = /ready\s*&\s*idle|ready\s*&amp;\s*idle/i.test(OPS);
const noBareResting = !/\$\{totalSleeping\}\s+resting\b/.test(OPS);
record("R8", readyIdle && noBareResting, `Reception uses "ready & idle" (${readyIdle}) · no bare "resting" (${noBareResting})`);

// R9 · ProviderTile 24h metrics carry "24h" suffix
const provider24hLabels =
  /label="Calls 24h"/.test(OPS)
  && /label="OK 24h"/.test(OPS)
  && /label="Fail 24h"/.test(OPS)
  && /label="Success 24h"/.test(OPS);
record("R9", provider24hLabels, "ProviderTile labels all carry \"24h\" suffix");

// R10 · ProviderTile "On task now" only shows when real in-flight count
// The old code fired the green banner whenever band === "green-active",
// even when activeWorkersUsing was null or 0. The new code splits:
//   if activeWorkersUsing > 0 → "Right now · N in flight"
//   else if band=green-active → "Healthy · had calls in 24h · no active in-flight"
// Search JSX literals (which use {expr}, not ${expr}).
const inFlightGuarded =
  /Right now · \{activeWorkersUsing\} worker/.test(OPS)
  && /activeWorkersUsing !== null && activeWorkersUsing > 0/.test(OPS)
  && /Healthy · had calls in last 24h · no active in-flight/.test(OPS);
record("R10", inFlightGuarded, "\"in flight\" banner gated on activeWorkersUsing > 0 · aggregate-only 24h shows honest label");

// R11 · No bare AMBIGUOUS status pill (Standby/Offline are ambiguous
// to non-engineers · Failed and Working are unambiguous so they're
// allowed to stand alone). Confirms the STATUS_COLOR labels never
// regress back to bare "Standby" / "Offline".
const bareAmbiguous = /label:\s*"(Standby|Offline)"/i.test(FACTORY);
record("R11", !bareAmbiguous, bareAmbiguous
  ? "found bare Standby/Offline label · regression"
  : "no bare Standby/Offline label · both use disambiguating phrasing");

// R12 · deriveLiveness not re-implemented in either dashboard
const rederivedFactory = /function deriveLiveness/.test(FACTORY);
const rederivedOps     = /function deriveLiveness/.test(OPS);
record("R12", !rederivedFactory && !rederivedOps,
  `deriveLiveness not re-implemented (factory:${rederivedFactory ? "REGRESSION" : "clean"} · ops:${rederivedOps ? "REGRESSION" : "clean"})`);

const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\nreception-semantics: ${passed}/${total} assertions passed\n`);
process.exit(passed === total ? 0 : 1);
