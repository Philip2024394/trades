// NEX Workforce V2 · Supervisor · Process exit classifier
// ─────────────────────────────────────────────────────────────────────────────
// Classifies a child process exit into one of the C9 § 15 categories.
// Uses exit code + signal + optional stderr snippet + prior exit history.
//
// Convention · workers exit with:
//   0  · clean shutdown / expected end (SIGTERM/SIGINT graceful)
//   1  · transient crash (default Node uncaught exception)
//   2  · quarantine safety-net (legacy quarantine or self-quarantine)
//   3  · configuration failure (missing env / bad config)
//   4  · authentication failure (bad DB creds / bad token)
//   5  · permission failure (42501 · RLS violation)

import { ExitClass } from "./lifecycle_contract.mjs";

/**
 * Classify a process exit.
 * @param {object} args
 * @param {number|null} args.code - process exit code (null if killed by signal)
 * @param {string|null} args.signal - signal name (e.g., 'SIGKILL') or null
 * @param {number} [args.restartCount=0] - number of restarts in the current window
 * @param {number} [args.repeatedThreshold=2] - restarts before promoting TRANSIENT → REPEATED
 * @param {string} [args.stderrTail=""] - last N chars of stderr (for pattern matching)
 * @returns {{ class: string, reason: string }}
 */
export function classifyExit({
  code,
  signal,
  restartCount = 0,
  repeatedThreshold = 2,
  stderrTail = "",
} = {}) {
  // Signal-terminated
  if (signal) {
    if (signal === "SIGTERM" || signal === "SIGINT") {
      return { class: ExitClass.CLEAN_SHUTDOWN, reason: `signal ${signal}` };
    }
    if (signal === "SIGKILL") {
      return { class: ExitClass.CATASTROPHIC_FAILURE, reason: "SIGKILL · force-terminated" };
    }
    if (signal === "SIGSEGV" || signal === "SIGBUS" || signal === "SIGABRT") {
      return { class: ExitClass.CATASTROPHIC_FAILURE, reason: `fatal signal ${signal}` };
    }
    return { class: ExitClass.UNKNOWN_FAILURE, reason: `unknown signal ${signal}` };
  }

  // Exit code
  if (code === 0) {
    return { class: ExitClass.EXPECTED_EXIT, reason: "exit code 0" };
  }
  if (code === 3) {
    return { class: ExitClass.CONFIGURATION_FAILURE, reason: "exit code 3 · configuration" };
  }
  if (code === 4) {
    return { class: ExitClass.AUTHENTICATION_FAILURE, reason: "exit code 4 · authentication" };
  }
  if (code === 5) {
    return { class: ExitClass.PERMISSION_FAILURE, reason: "exit code 5 · permission denied" };
  }

  // stderr pattern signals (defensive · code=1 with permission-denied text)
  if (stderrTail && /permission denied|42501/i.test(stderrTail)) {
    return { class: ExitClass.PERMISSION_FAILURE, reason: "stderr contains permission-denied signal" };
  }
  if (stderrTail && /(cannot find module|missing.*env|invalid configuration)/i.test(stderrTail)) {
    return { class: ExitClass.CONFIGURATION_FAILURE, reason: "stderr contains configuration failure signal" };
  }

  // Generic non-zero
  if (code === 1) {
    if (restartCount >= repeatedThreshold) {
      return { class: ExitClass.REPEATED_CRASH, reason: `code 1 · ${restartCount} prior restarts in window` };
    }
    return { class: ExitClass.TRANSIENT_CRASH, reason: "code 1 · first-window crash" };
  }

  return { class: ExitClass.UNKNOWN_FAILURE, reason: `unclassified exit code ${code}` };
}
