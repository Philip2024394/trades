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
// Assertions (updated Task #72 Step 2 · 2026-08-22 · Factory no longer
// renders worker status · R1/R2/R3/R4/R5/R11 for Factory retired):
//   R1  · REMOVED · STATUS_COLOR palette deleted with WorkersPanel
//   R2  · REMOVED · STATUS_COLOR palette deleted with WorkersPanel
//   R3  · REMOVED · WorkersPanel header deleted
//   R4  · REMOVED · WorkersPanel deleted
//   R5  · REMOVED · totals-bar deleted
//   R6  · factory · ActivityStream header signals HISTORICAL nature (KEPT)
//   R7  · operations-centre · Reception band prefixes state summary
//         with "Right now:" so it can't be confused with historical
//   R8  · operations-centre · Reception band uses "ready & idle"
//   R9  · operations-centre · ProviderTile 24h metrics carry "24h" suffix
//   R10 · operations-centre · ProviderTile · "On task now" banner
//         only shows when there's a real in-flight count
//   R11 · REMOVED · STATUS_COLOR labels deleted
//   R12 · deriveLiveness NOT re-implemented in either dashboard (KEPT)
//   R13 · Step 2 · Factory MUST NOT re-introduce STATUS_COLOR or
//         WorkersPanel · single-canonical-view rule

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const FACTORY = readFileSync(join(REPO, "src/app/nex-head-quarters/factory/page.tsx"), "utf8");
const OPS     = readFileSync(join(REPO, "src/app/nex-head-quarters/operations-centre/page.tsx"), "utf8");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

// R1-R5 · REMOVED in Step 2 (2026-08-22): STATUS_COLOR palette + WorkersPanel
// deleted with WorkerCard. Worker status labels + colours + snapshot
// qualifier + refresh cadence + totals-bar wording all live on
// /nex-head-quarters/workers now · assertions for that surface belong
// in a dedicated workers-page test file, not here. R13 below enforces
// the negative regression check ("must not come back to Factory").

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

// R11 · REMOVED · STATUS_COLOR labels deleted.

// R12 · deriveLiveness not re-implemented in either dashboard
const rederivedFactory = /function deriveLiveness/.test(FACTORY);
const rederivedOps     = /function deriveLiveness/.test(OPS);
record("R12", !rederivedFactory && !rederivedOps,
  `deriveLiveness not re-implemented (factory:${rederivedFactory ? "REGRESSION" : "clean"} · ops:${rederivedOps ? "REGRESSION" : "clean"})`);

// R13 · Step 2 (2026-08-22) constitutional rule "one HQ · one worker
// registry": Factory must NOT re-introduce STATUS_COLOR, WorkersPanel,
// or WorkerCard. Any of these coming back = regression to the
// two-surface-competing-truths problem Step 2 fixed.
const noStatusColor    = !/const STATUS_COLOR/.test(FACTORY);
const noWorkersPanel   = !/function WorkersPanel\b/.test(FACTORY);
const noWorkerCard     = !/function WorkerCard\b/.test(FACTORY);
const noWorkersLiveCall = !/["'`]\/api\/nex\/brain\/workers-live["'`]/.test(FACTORY.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/[^\n\r]*/, "$1")).join("\n"));
record("R13",
  noStatusColor && noWorkersPanel && noWorkerCard && noWorkersLiveCall,
  `Factory purity: STATUS_COLOR-absent=${noStatusColor} · WorkersPanel-absent=${noWorkersPanel} · WorkerCard-absent=${noWorkerCard} · workers-live-not-called=${noWorkersLiveCall}`);

const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\nreception-semantics: ${passed}/${total} assertions passed\n`);
process.exit(passed === total ? 0 : 1);
