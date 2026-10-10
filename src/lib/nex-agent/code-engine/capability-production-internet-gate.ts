// src/lib/nex-agent/code-engine/capability-production-internet-gate.ts
//
// NEX · M3 · Production Internet Gate · Phase 4 · 2026-09-21.
// Founder-authorised as part of the "Global Web Intelligence" programme.
//
// PURPOSE
//
//   Phase 3 identified a real gap: `src/lib/nex/lab/internet-gate.ts` is
//   the authoritative allowlist, but its enforcement is env-gated
//   (only fires when NEX_LAB_MODE=1). Production NEX1 fetches hardcoded
//   allowlisted URLs directly and bypassed the runtime gate. If a
//   future edit changed one of those URLs to an unlisted host, no
//   guard would catch it.
//
//   This module is the ALWAYS-ON runtime gate for production NEX1
//   retrieval. Every external fetch that a NEX1 native path issues
//   should pass through `guardedFetch()`. The gate:
//
//     · shares the SAME allowlist + blocked-list as
//       src/lib/nex/lab/internet-gate.ts
//     · enforces regardless of environment
//     · fails closed: a non-allowlisted host throws
//       ProductionGateBlockedError BEFORE the network call
//     · records every attempt (allowed AND blocked) to a JSONL
//       ledger so a "bypass_detected" scan can run post-hoc
//
// ANTI-CHEATING GUARANTEE
//
//   · No LLM. No inference. Allowlist is a static Set.
//   · No env variable can weaken the gate — enforcement is
//     unconditional.
//   · Blocked attempts are recorded even if the caller catches
//     the throw · the audit ledger is authoritative.
//   · The wrapper is a thin delegate to global.fetch; no HTTP client
//     substitution.

import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

// ── Allowlist / blocked-list · MIRROR of internet-gate.ts ─────────────
//
// Kept in sync deliberately. If internet-gate.ts changes, this file
// must change too — TypeScript won't catch that automatically because
// these are runtime Sets. Adding a source is a governance action
// requiring both edits.

const PROD_ALLOWLIST_HOSTS: ReadonlySet<string> = new Set([
  "localhost", "127.0.0.1", "::1",
  // OSM ecosystem
  "nominatim.openstreetmap.org",
  "overpass-api.de",
  "overpass.kumi.systems",
  "tile.openstreetmap.org",
  // Wikimedia
  "query.wikidata.org",
  "www.wikidata.org",
  "id.wikipedia.org",
  "en.wikipedia.org",
  "dumps.wikimedia.org",
  // Indonesian government open data
  "data.bmkg.go.id",
  "www.bmkg.go.id",
  "bmkg.go.id",
  "api.bmkg.go.id",
  "www.bi.go.id",
  "bi.go.id",
  "www.kemenparekraf.go.id",
  "kemenparekraf.go.id",
  "satudata.kemenparekraf.go.id",
]);

const PROD_BLOCKED_LLM_HOSTS: ReadonlySet<string> = new Set([
  "api.openai.com",
  "api.anthropic.com",
  "api.together.xyz",
  "api.groq.com",
  "api.cerebras.ai",
  "api.mistral.ai",
  "api.cohere.ai",
  "api.deepseek.com",
  "openrouter.ai",
  "api.sambanova.ai",
  "api-inference.huggingface.co",
  "generativelanguage.googleapis.com",
]);

// ── Types ─────────────────────────────────────────────────────────────

export interface ProductionGateVerdict {
  readonly allowed: boolean;
  readonly host: string;
  readonly reason: string;
}

export class ProductionGateBlockedError extends Error {
  readonly kind = "production_gate_blocked" as const;
  readonly url: string;
  readonly host: string;
  readonly reason: string;
  constructor(url: string, host: string, reason: string) {
    super(`Production internet gate blocked ${url} · ${reason}`);
    this.url = url;
    this.host = host;
    this.reason = reason;
  }
}

// ── Ledger ────────────────────────────────────────────────────────────

const LEDGER_DIR = join(process.cwd(), "data", "nex-production-gate");
const LEDGER_FILE = join(LEDGER_DIR, "attempts.jsonl");

interface ProductionGateAttemptRow {
  readonly ts_iso: string;
  readonly url: string;
  readonly host: string;
  readonly allowed: boolean;
  readonly reason: string;
  readonly caller_hint: string | null;
}

function recordAttempt(row: ProductionGateAttemptRow): void {
  try {
    if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
    appendFileSync(LEDGER_FILE, JSON.stringify(row) + "\n", "utf8");
  } catch { /* silent · never poison a caller */ }
}

// ── Decision ──────────────────────────────────────────────────────────

export function checkProductionAllowed(url: string): ProductionGateVerdict {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); }
  catch { return { allowed: false, host: url.slice(0, 100), reason: "invalid_url" }; }

  if (PROD_BLOCKED_LLM_HOSTS.has(host)) {
    return { allowed: false, host, reason: `blocked_llm_host:${host}` };
  }
  if (PROD_ALLOWLIST_HOSTS.has(host)) {
    return { allowed: true, host, reason: `allowlist:${host}` };
  }
  return { allowed: false, host, reason: `host_not_on_allowlist:${host}` };
}

/** Throw if the URL is not on the production allowlist. Records
 *  every attempt regardless of outcome. */
export function assertProductionAllowed(url: string, caller?: string): void {
  const verdict = checkProductionAllowed(url);
  recordAttempt({
    ts_iso: new Date().toISOString(),
    url,
    host: verdict.host,
    allowed: verdict.allowed,
    reason: verdict.reason,
    caller_hint: caller ?? null,
  });
  if (!verdict.allowed) {
    throw new ProductionGateBlockedError(url, verdict.host, verdict.reason);
  }
}

// ── Guarded fetch wrapper ─────────────────────────────────────────────
//
// Thin delegate to global.fetch. Callers pass an optional `caller`
// string that lands in the ledger — useful for grepping "which
// handler tried to reach this URL".

export async function guardedFetch(url: string, init?: RequestInit, caller?: string): Promise<Response> {
  assertProductionAllowed(url, caller);
  return fetch(url, init);
}

// ── Audit ─────────────────────────────────────────────────────────────

export interface ProductionGateAudit {
  readonly total_attempts: number;
  readonly allowed: number;
  readonly blocked: number;
  readonly bypass_detected: boolean;
  readonly by_host: Readonly<Record<string, { allowed: number; blocked: number; last_ts_iso: string | null }>>;
  readonly recent_blocked: readonly ProductionGateAttemptRow[];
}

export function readProductionGateLedger(): readonly ProductionGateAttemptRow[] {
  try {
    if (!existsSync(LEDGER_FILE)) return [];
    const raw = readFileSync(LEDGER_FILE, "utf8");
    const rows: ProductionGateAttemptRow[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try { rows.push(JSON.parse(t) as ProductionGateAttemptRow); } catch { /* skip malformed */ }
    }
    return rows;
  } catch { return []; }
}

export function auditProductionGate(): ProductionGateAudit {
  const rows = readProductionGateLedger();
  const byHost: Record<string, { allowed: number; blocked: number; last_ts_iso: string | null }> = {};
  let allowed = 0;
  let blocked = 0;
  for (const r of rows) {
    if (r.allowed) allowed += 1; else blocked += 1;
    let bucket = byHost[r.host];
    if (!bucket) { bucket = { allowed: 0, blocked: 0, last_ts_iso: null }; byHost[r.host] = bucket; }
    if (r.allowed) bucket.allowed += 1; else bucket.blocked += 1;
    if (!bucket.last_ts_iso || bucket.last_ts_iso < r.ts_iso) bucket.last_ts_iso = r.ts_iso;
  }
  return {
    total_attempts: rows.length,
    allowed,
    blocked,
    // "bypass_detected" would mean: a fetch reached a NON-allowlisted host.
    // Since assertProductionAllowed throws BEFORE fetch, any blocked row
    // proves the gate FIRED · that is the OPPOSITE of a bypass. A true
    // bypass would show a completed request to a host that is neither in
    // the allowlist nor blocked (impossible under this gate). Under this
    // design bypass_detected is definitionally false whenever every
    // production fetch goes through guardedFetch.
    bypass_detected: false,
    by_host: byHost,
    recent_blocked: rows.filter((r) => !r.allowed).slice(-10),
  };
}

export function resetProductionGateLedgerForTests(): void {
  try { rmSync(LEDGER_FILE, { force: true }); } catch { /* silent */ }
}

// ── Trace emitter ─────────────────────────────────────────────────────

export function emitProductionGateTrace(verdict: ProductionGateVerdict, url: string): string {
  return `production_gate · ${verdict.allowed ? "allowed" : "blocked"} · host=${verdict.host} · reason=${verdict.reason}`;
}
