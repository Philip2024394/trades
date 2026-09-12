#!/usr/bin/env node
// scripts/nex-harvest-daemon.mjs
//
// Founder Phase 1a · OSM Harvester Daemon.
//
// Single-shot per invocation. Windows Scheduled Task fires this hourly.
// Each invocation:
//   1. Reads the rotating city cursor from data/harvest-osm/cursor.json
//   2. Picks the next city in the rotation
//   3. Runs the OSM harvester for that city
//   4. Updates the cursor and appends to daemon.log
//   5. Exits (never blocks · Task Scheduler owns the lifecycle)
//
// Windows Scheduled Task cadence: every 1 hour.
// Rate: 1 city per hour = 120 city-runs per 5 days.
// Coverage: each run pulls ~450-1500 accommodation rows for a city.
//
// This is deliberately dependency-free (spawns the existing standalone
// harvester as a child process) so if the harvester changes we don't
// have to rebuild the daemon.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DATA_DIR  = join(REPO_ROOT, "data", "harvest-osm");
const CURSOR    = join(DATA_DIR, "cursor.json");
const LOG       = join(DATA_DIR, "daemon.log");

// Rotating city list · matches nex-harvest-osm.mjs's CITY_BBOXES.
// Extend as we validate coverage per country. Founder can edit this
// file to add more without touching daemon code.
const DEFAULT_CITIES = [
  "yogyakarta",
  "bali",
  "jakarta",
  "bandung",
  "surabaya",
];

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    appendFileSync(LOG, msg);
  } catch { /* never break on log failure */ }
}

function loadCursor() {
  try {
    if (!existsSync(CURSOR)) return { index: 0, cities: DEFAULT_CITIES, runs: 0 };
    const raw = JSON.parse(readFileSync(CURSOR, "utf8"));
    return {
      index: Number.isFinite(raw.index) ? raw.index : 0,
      cities: Array.isArray(raw.cities) && raw.cities.length > 0 ? raw.cities : DEFAULT_CITIES,
      runs: Number.isFinite(raw.runs) ? raw.runs : 0,
    };
  } catch (err) {
    log(`cursor read error · resetting to defaults: ${String(err).slice(0, 200)}`);
    return { index: 0, cities: DEFAULT_CITIES, runs: 0 };
  }
}

function saveCursor(state) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CURSOR, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    log(`cursor save error: ${String(err).slice(0, 200)}`);
  }
}

function main() {
  const startMs = Date.now();
  log(`daemon start · pid=${process.pid}`);

  const state = loadCursor();
  const city = state.cities[state.index % state.cities.length];
  log(`selected city: ${city} (index ${state.index % state.cities.length} of ${state.cities.length})`);

  // Spawn the standalone harvester as a child process.
  // --persist would write to Postgres · daemon runs dry-run by default
  // so it caches to jsonl. Founder flips to persist mode when local
  // Postgres has schema loaded.
  const shouldPersist = process.env.NEX_HARVEST_PERSIST === "1";
  const argv = ["scripts/nex-harvest-osm.mjs", "--city", city];
  if (shouldPersist) argv.push("--persist");

  log(`spawning: node ${argv.join(" ")}`);
  const child = spawnSync("node", argv, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 300_000, // 5 min max per city
  });

  if (child.error) {
    log(`spawn error: ${String(child.error).slice(0, 300)}`);
  } else {
    // Log last 6 lines of stdout for founder visibility
    const lines = (child.stdout ?? "").trim().split("\n").slice(-6);
    for (const l of lines) log(`  harvest| ${l}`);
    if (child.status !== 0) {
      log(`harvester exit code ${child.status} · stderr: ${(child.stderr ?? "").slice(0, 300)}`);
    }
  }

  // Advance cursor + persist state
  const next = {
    ...state,
    index: (state.index + 1) % state.cities.length,
    runs: state.runs + 1,
    last_run_iso: new Date().toISOString(),
    last_city: city,
    last_persist_mode: shouldPersist,
  };
  saveCursor(next);

  const totalMs = Date.now() - startMs;
  log(`daemon complete · ${totalMs}ms · cursor advanced to index ${next.index} · total runs: ${next.runs}`);
}

try {
  main();
} catch (err) {
  log(`fatal: ${String(err).slice(0, 500)}`);
  process.exit(1);
}
