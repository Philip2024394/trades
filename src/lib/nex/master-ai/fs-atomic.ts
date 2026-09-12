// src/lib/nex/master-ai/fs-atomic.ts
//
// NEX Master AI Engineer · shared atomic-write + append-JSONL primitives
// Philip 2026-09-07 · AUTHORIZE
//
// Inherits Ops-1 discipline (bounded EPERM retry) from
// src/lib/nex/agent-runtime/heartbeat.ts::renameWithRetry.  Copy of that
// logic is deliberate · never breaks the existing heartbeat contract.

import fs from "node:fs";
import path from "node:path";

const WINDOWS_RENAME_RETRY_CODES = new Set(["EPERM", "EBUSY", "EACCES", "UNKNOWN"]);
const RENAME_RETRY_BACKOFFS_MS = [25, 50, 100, 200];

function sleepSync(ms: number): void {
  if (ms <= 0) return;
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

function renameWithRetry(tmp: string, target: string): void {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= RENAME_RETRY_BACKOFFS_MS.length; attempt++) {
    try {
      fs.renameSync(tmp, target);
      return;
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string })?.code;
      if (!code || !WINDOWS_RENAME_RETRY_CODES.has(code)) break;
      if (attempt === RENAME_RETRY_BACKOFFS_MS.length) break;
      sleepSync(RENAME_RETRY_BACKOFFS_MS[attempt]);
    }
  }
  try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* ignore */ }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export function ensureDir(p: string): void {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function writeJsonAtomic(target: string, value: unknown): void {
  ensureDir(target);
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  renameWithRetry(tmp, target);
}

/** Append a single JSONL line. Append is atomic on POSIX and near-atomic
 *  on Windows for small writes. This is the standard NEX append-only
 *  primitive used by event-bus.ts and by every ledger below. */
export function appendJsonLine(target: string, value: unknown): void {
  ensureDir(target);
  fs.appendFileSync(target, JSON.stringify(value) + "\n", "utf8");
}

/** Read all JSONL records from a file. Skips malformed lines silently
 *  (a corrupt line must not crash Master AI). Returns [] when file
 *  does not exist. */
export function readJsonlAll<T>(target: string): T[] {
  try {
    if (!fs.existsSync(target)) return [];
    const raw = fs.readFileSync(target, "utf8");
    if (!raw.trim()) return [];
    const out: T[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try { out.push(JSON.parse(t) as T); } catch { /* skip malformed */ }
    }
    return out;
  } catch {
    return [];
  }
}
