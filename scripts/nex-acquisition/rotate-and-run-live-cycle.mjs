#!/usr/bin/env node
// scripts/nex-acquisition/rotate-and-run-live-cycle.mjs
//
// Pass-7 deliverable · 2026-10-12 · founder-authorised recurring runner
// for the sealed acquisition engine (scripts/nex-acquisition/run-live-cycle.mjs).
//
// What this does:
//   1. Reads a persistent rotation cursor from
//      data/nex-acquisition/city-rotation-cursor.json
//   2. Picks the next Indonesian catalogued city that hasn't been run
//      in the last COOLDOWN_HOURS (default 72) · fair rotation by
//      ascending catalogue priority within the cooldown window
//   3. Acquires a process lock (file-based) so overlapping invocations
//      are safe · a stale lock older than LOCK_MAX_AGE_MIN is reclaimed
//   4. Spawns `run-live-cycle.mjs --vertical=food --city=X --apply`
//      with the inherited env (NEX_POSTGRES_URL + CRON_SECRET live
//      in the host's env, never pasted here)
//   5. On success · updates the cursor + records a cycle entry;
//      on failure · records the error + bumps a backoff counter
//      for that city (exponential: 1h → 2h → 4h → 8h cap)
//   6. Exits with the child's exit code so the host scheduler can
//      alert on repeated failures
//
// What this does NOT do:
//   - Does NOT bypass the acquisition engine's Gates 1-4 (it just
//     invokes the engine with --apply)
//   - Does NOT run multiple cities per invocation (one-at-a-time is
//     the host's job via the schedule interval)
//   - Does NOT flip source_registry.can_display
//   - Does NOT touch accommodation or any vertical other than food
//
// Flags:
//   --vertical=food          (default: food · only food is wired today)
//   --dry-run                print the next city without running it
//   --city=<name>            override rotation and run a specific city once
//
// Env vars (host provides these securely):
//   NEX_POSTGRES_URL  · required · passed to the child engine process
//
// Exit codes:
//   0  · child cycle completed cleanly
//   1  · bad CLI args / corrupt cursor
//   2  · lock contention · another instance is running (not an error)
//   3  · child cycle failed (non-zero exit from run-live-cycle.mjs)
//   99 · unexpected internal error

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";

const CATALOGUE_PATH = "data/nex-city-catalogue.json";
const CURSOR_PATH = "data/nex-acquisition/city-rotation-cursor.json";
const LOCK_PATH = "data/nex-acquisition/rotation.lock";
const COOLDOWN_HOURS = Number(process.env.NEX_ROTATION_COOLDOWN_HOURS || 72);
const LOCK_MAX_AGE_MIN = Number(process.env.NEX_ROTATION_LOCK_MAX_AGE_MIN || 90);
const BACKOFF_HOURS = [1, 2, 4, 8];

function nowIso() { return new Date().toISOString(); }
function logJson(obj) { console.log(JSON.stringify({ ts: nowIso(), ...obj })); }

function readArg(name) {
  const prefix = `--${name}=`;
  for (const a of process.argv.slice(2)) if (a.startsWith(prefix)) return a.slice(prefix.length);
  return undefined;
}

function readCursor() {
  if (!existsSync(CURSOR_PATH)) {
    return { last_updated: null, cycles: {} };
  }
  try {
    return JSON.parse(readFileSync(CURSOR_PATH, "utf8"));
  } catch (e) {
    logJson({ event: "cursor-corrupt", path: CURSOR_PATH, error: e.message });
    throw new Error("cursor file corrupt · aborting · fix or delete " + CURSOR_PATH);
  }
}

function writeCursor(cursor) {
  mkdirSync("data/nex-acquisition", { recursive: true });
  cursor.last_updated = nowIso();
  writeFileSync(CURSOR_PATH, JSON.stringify(cursor, null, 2));
}

function acquireLock(runId) {
  mkdirSync("data/nex-acquisition", { recursive: true });
  if (existsSync(LOCK_PATH)) {
    const age = (Date.now() - statSync(LOCK_PATH).mtimeMs) / 60000;
    if (age < LOCK_MAX_AGE_MIN) {
      let holder = "unknown";
      try { holder = readFileSync(LOCK_PATH, "utf8"); } catch {}
      return { acquired: false, reason: "held", age_min: age, holder };
    }
    logJson({ event: "lock-stale-reclaim", age_min: age });
    try { unlinkSync(LOCK_PATH); } catch {}
  }
  writeFileSync(LOCK_PATH, JSON.stringify({ run_id: runId, acquired_at: nowIso(), pid: process.pid }));
  return { acquired: true };
}
function releaseLock() { try { unlinkSync(LOCK_PATH); } catch {} }

function pickNextCity(cursor, override) {
  const cat = JSON.parse(readFileSync(CATALOGUE_PATH, "utf8"));
  if (override) {
    const match = cat.cities.find((c) => c.canonical.toLowerCase() === override.toLowerCase());
    if (!match) throw new Error(`city not in catalogue: ${override}`);
    return match;
  }
  const now = Date.now();
  const cooldownMs = COOLDOWN_HOURS * 3600 * 1000;
  // Rank: eligible first (never run OR last_run > cooldown OR next_eligible_at
  // in the past) · then ascending catalogue priority · then alphabetical.
  const eligible = cat.cities.filter((c) => {
    const h = cursor.cycles[c.canonical];
    if (!h) return true;
    if (h.next_eligible_at && new Date(h.next_eligible_at).getTime() > now) return false;
    if (!h.last_success_at) return true;
    return (now - new Date(h.last_success_at).getTime()) > cooldownMs;
  });
  if (eligible.length === 0) throw new Error("no catalogued city eligible for rotation · increase cooldown or wait");
  eligible.sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999) || a.canonical.localeCompare(b.canonical));
  return eligible[0];
}

function recordCycleResult(cursor, city, result) {
  const h = cursor.cycles[city.canonical] || { backoff_index: 0 };
  const now = new Date();
  h.last_attempt_at = now.toISOString();
  if (result.ok) {
    h.last_success_at = now.toISOString();
    h.backoff_index = 0;
    delete h.next_eligible_at;
    h.last_result = { ok: true, exit_code: result.exit_code, duration_ms: result.duration_ms };
  } else {
    h.backoff_index = Math.min(BACKOFF_HOURS.length - 1, (h.backoff_index ?? 0) + 1);
    const hours = BACKOFF_HOURS[h.backoff_index];
    h.next_eligible_at = new Date(now.getTime() + hours * 3600 * 1000).toISOString();
    h.last_result = { ok: false, exit_code: result.exit_code, duration_ms: result.duration_ms, error: result.error ?? null };
  }
  cursor.cycles[city.canonical] = h;
}

function runEngineForCity(city, dryRun) {
  const started = Date.now();
  if (dryRun) {
    logJson({ event: "would-run", city: city.canonical, province: city.province });
    return { ok: true, exit_code: 0, duration_ms: 0 };
  }
  logJson({ event: "spawn-engine", city: city.canonical, province: city.province, priority: city.priority });
  const result = spawnSync(
    process.execPath,
    [
      "scripts/nex-acquisition/run-live-cycle.mjs",
      "--vertical=food",
      `--city=${city.canonical}`,
      "--apply",
    ],
    { env: process.env, stdio: "inherit" },
  );
  const duration_ms = Date.now() - started;
  if (result.error) return { ok: false, exit_code: 99, duration_ms, error: result.error.message };
  const code = result.status ?? 99;
  return { ok: code === 0, exit_code: code, duration_ms, error: code === 0 ? null : `exit ${code}` };
}

function main() {
  const vertical = readArg("vertical") ?? "food";
  const override = readArg("city");
  const dryRun = process.argv.includes("--dry-run");

  if (vertical !== "food") {
    logJson({ event: "unsupported-vertical", vertical });
    process.exit(1);
  }
  if (!process.env.NEX_POSTGRES_URL) {
    logJson({ event: "missing-env", missing: "NEX_POSTGRES_URL" });
    process.exit(1);
  }
  if (!existsSync(CATALOGUE_PATH)) {
    logJson({ event: "missing-catalogue", path: CATALOGUE_PATH });
    process.exit(1);
  }

  const runId = randomUUID();
  const lockState = acquireLock(runId);
  if (!lockState.acquired) {
    logJson({ event: "lock-contention", reason: lockState.reason, holder: lockState.holder, age_min: lockState.age_min });
    process.exit(2);
  }

  try {
    const cursor = readCursor();
    let city;
    try { city = pickNextCity(cursor, override); }
    catch (e) { logJson({ event: "no-eligible-city", error: e.message }); process.exit(0); }
    logJson({ event: "selected-city", run_id: runId, city: city.canonical, province: city.province, priority: city.priority });
    const result = runEngineForCity(city, dryRun);
    // Dry-run is diagnostic only · must NOT mutate the rotation cursor
    // (otherwise a dry-run bumps Denpasar's "last_success_at" and the
    // next real run would skip it incorrectly).
    if (!dryRun) {
      recordCycleResult(cursor, city, result);
      writeCursor(cursor);
    }
    logJson({ event: "cycle-complete", run_id: runId, city: city.canonical, dry_run: dryRun, result });
    // Release lock BEFORE process.exit() · exit() does not always run
    // the enclosing finally block before terminating on Node 20+.
    releaseLock();
    process.exit(result.ok ? 0 : 3);
  } finally {
    releaseLock();
  }
}

try { main(); }
catch (e) {
  logJson({ event: "fatal", error: e.message });
  releaseLock();
  process.exit(99);
}
