// src/lib/nex/idempotency/store.ts
//
// WAVE-P-1.2 · Idempotency store · JSONL default (self-sustained)
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// Storage layout under data/idempotency/ · append-only JSONL with
// tombstone records for state transitions · sweep on write. This is
// a NEW root · never mixes with other NEX data roots. Env-overridable
// via NEX_IDEMPOTENCY_DATA_ROOT for test isolation.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type {
  IdempotencyRecord,
  IdempotencyStore,
  IdempotencyLookupResult,
} from "./types";
import { DEFAULT_IDEMPOTENCY_TTL_MS } from "./types";

// ─── Path resolution ───────────────────────────────────────────

export function idempotencyDataRoot(): string {
  const override = process.env.NEX_IDEMPOTENCY_DATA_ROOT;
  if (override && override.length > 0) return override;
  return path.join(process.cwd(), "data", "idempotency");
}

export function idempotencyLedgerPath(): string {
  return path.join(idempotencyDataRoot(), "records.jsonl");
}

// ─── Hashing ───────────────────────────────────────────────────

export function hashRequest(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex").slice(0, 32);
}

export function hashActor(actor_id: string | null | undefined): string | undefined {
  if (!actor_id) return undefined;
  return "act_" + createHash("sha256").update(actor_id, "utf8").digest("hex").slice(0, 16);
}

// ─── Ledger primitives ────────────────────────────────────────

type LedgerEntry =
  | { op: "begin"; record: IdempotencyRecord }
  | { op: "complete"; key: string; status_code: number; response_body_json: string; completed_at_ms: number }
  | { op: "fail"; key: string; reason: string; failed_at_ms: number };

function ensureDir(): void {
  const dir = idempotencyDataRoot();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readAllEntries(): LedgerEntry[] {
  const p = idempotencyLedgerPath();
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const out: LedgerEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const parsed = JSON.parse(t) as LedgerEntry;
      if (parsed && (parsed.op === "begin" || parsed.op === "complete" || parsed.op === "fail")) {
        out.push(parsed);
      }
    } catch { /* skip malformed */ }
  }
  return out;
}

function appendEntry(entry: LedgerEntry): void {
  ensureDir();
  appendFileSync(idempotencyLedgerPath(), JSON.stringify(entry) + "\n", "utf8");
}

/** Fold the append-only log into current-state per-key. */
function foldState(entries: LedgerEntry[]): Map<string, IdempotencyRecord> {
  const map = new Map<string, IdempotencyRecord>();
  for (const e of entries) {
    if (e.op === "begin") {
      map.set(e.record.key, { ...e.record });
    } else if (e.op === "complete") {
      const cur = map.get(e.key);
      if (cur) {
        map.set(e.key, {
          ...cur,
          status: "completed",
          response_body_json: e.response_body_json,
          status_code: e.status_code,
          completed_at_ms: e.completed_at_ms,
        });
      }
    } else if (e.op === "fail") {
      const cur = map.get(e.key);
      if (cur) {
        map.set(e.key, { ...cur, status: "failed" });
      }
    }
  }
  return map;
}

// ─── The default JSONL-backed implementation ──────────────────

export class JsonlIdempotencyStore implements IdempotencyStore {
  async lookup(key: string, request_hash: string): Promise<IdempotencyLookupResult> {
    const state = foldState(readAllEntries());
    const rec = state.get(key);
    if (!rec) return { kind: "not_found" };
    if (rec.expires_at_ms <= Date.now()) return { kind: "expired" };
    if (rec.request_hash !== request_hash) return { kind: "completed_different_request", record: rec, new_hash: request_hash };
    if (rec.status === "in_flight") return { kind: "in_flight", record: rec };
    if (rec.status === "completed") return { kind: "completed_same_request", record: rec };
    // failed status · caller may retry as if not_found
    return { kind: "not_found" };
  }

  async begin(record: Omit<IdempotencyRecord, "status" | "completed_at_ms" | "response_body_json" | "status_code"> & { status?: "in_flight" }): Promise<void> {
    const full: IdempotencyRecord = {
      ...record,
      status: "in_flight",
    };
    appendEntry({ op: "begin", record: full });
  }

  async complete(key: string, status_code: number, response_body_json: string): Promise<void> {
    appendEntry({ op: "complete", key, status_code, response_body_json, completed_at_ms: Date.now() });
  }

  async fail(key: string, reason: string): Promise<void> {
    appendEntry({ op: "fail", key, reason, failed_at_ms: Date.now() });
  }

  async sweepExpired(now_ms?: number): Promise<number> {
    const cutoff = now_ms ?? Date.now();
    const state = foldState(readAllEntries());
    let expired = 0;
    for (const rec of state.values()) {
      if (rec.expires_at_ms <= cutoff) expired += 1;
    }
    // Note: JSONL is append-only · we don't rewrite the file here.
    // Compaction is a separate operation. This returns the count
    // of currently-expired records for observability.
    return expired;
  }

  /** For tests · truncate the ledger. */
  reset(): void {
    const p = idempotencyLedgerPath();
    if (existsSync(p)) writeFileSync(p, "", "utf8");
  }
}

/** Helper: canonical TTL from creation. */
export function computeExpiry(created_at_ms: number, ttl_ms?: number): number {
  return created_at_ms + (ttl_ms ?? DEFAULT_IDEMPOTENCY_TTL_MS);
}
