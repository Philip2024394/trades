// src/lib/nex/master-ai/storage-rotation.ts
//
// NEX Master AI · Storage Rotation Policy (F-Wave §20)
// Philip 2026-09-07 · AUTHORIZE
//
// Master AI's JSONL ledgers grow unbounded by default. This module
// implements a deterministic rotation policy:
//
//   · When a ledger file exceeds size_cap_bytes OR row_cap_rows,
//     the oldest rows are moved to an archived file (append-only).
//   · Rotation is IDEMPOTENT · re-running does nothing if under caps.
//   · The current file's contents remain machine-readable through
//     the rotation.
//   · Every rotation records a StorageRotationRecord in the
//     rotation ledger.
//
// Never delete data. Rotation moves data to archive files, keeping
// most recent rows in the live file. Archive files have suffix
// `.archive-{iso}.jsonl` so they are sortable.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { storageRotationsPath, masterAiDataRoot } from "./paths";

export type RotationPolicy = {
  size_cap_bytes: number;                          // e.g. 5 * 1024 * 1024 = 5 MB
  row_cap_rows: number;                            // e.g. 20_000 rows
  keep_recent_rows: number;                        // how many rows to keep in live file after rotation
};

export const DEFAULT_POLICY: RotationPolicy = Object.freeze({
  size_cap_bytes: 5 * 1024 * 1024,                 // 5 MB per ledger
  row_cap_rows: 20_000,
  keep_recent_rows: 5_000,                          // keep last 5k rows live · archive the rest
});

export type StorageRotationRecord = {
  rotation_id: string;
  recorded_at_iso: string;
  ledger_path: string;
  archived_path: string | null;
  size_before_bytes: number;
  size_after_bytes: number;
  rows_before: number;
  rows_after: number;
  rows_archived: number;
  reason: string;
  policy_applied: RotationPolicy;
};

/** Count lines in a JSONL file quickly. */
function countLines(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const raw = fs.readFileSync(filePath, "utf8");
  if (raw.length === 0) return 0;
  // Count newlines · minus 1 if last line has no trailing newline (edge case)
  return raw.split(/\r?\n/).filter((l) => l.length > 0).length;
}

/** Rotate a single ledger file if it exceeds the policy caps. */
export function rotateLedgerIfNeeded(ledgerPath: string, policy: RotationPolicy = DEFAULT_POLICY): StorageRotationRecord | null {
  if (!fs.existsSync(ledgerPath)) return null;
  const stat = fs.statSync(ledgerPath);
  const sizeBefore = stat.size;
  const rowsBefore = countLines(ledgerPath);
  if (sizeBefore <= policy.size_cap_bytes && rowsBefore <= policy.row_cap_rows) {
    return null;                                    // no rotation needed
  }
  const raw = fs.readFileSync(ledgerPath, "utf8");
  const allLines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const keep = allLines.slice(-policy.keep_recent_rows);
  const archive = allLines.slice(0, allLines.length - policy.keep_recent_rows);

  // Write archive file (append-safe · single write)
  const archiveIso = new Date().toISOString().replace(/[:.]/g, "-");
  const archivedPath = ledgerPath.replace(/\.jsonl$/, `.archive-${archiveIso}.jsonl`);
  fs.writeFileSync(archivedPath, archive.join("\n") + (archive.length > 0 ? "\n" : ""), "utf8");

  // Rewrite live file atomically (write to tmp, rename)
  const tmpPath = ledgerPath + ".rotate-tmp";
  fs.writeFileSync(tmpPath, keep.join("\n") + (keep.length > 0 ? "\n" : ""), "utf8");
  fs.renameSync(tmpPath, ledgerPath);

  const statAfter = fs.statSync(ledgerPath);
  const rec: StorageRotationRecord = {
    rotation_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    ledger_path: ledgerPath,
    archived_path: archivedPath,
    size_before_bytes: sizeBefore,
    size_after_bytes: statAfter.size,
    rows_before: rowsBefore,
    rows_after: keep.length,
    rows_archived: archive.length,
    reason: sizeBefore > policy.size_cap_bytes
      ? `size_cap_exceeded:${sizeBefore}>${policy.size_cap_bytes}`
      : `row_cap_exceeded:${rowsBefore}>${policy.row_cap_rows}`,
    policy_applied: policy,
  };
  appendJsonLine(storageRotationsPath(), rec);
  return rec;
}

/** Rotate every JSONL ledger in the master-ai data root that exceeds
 *  the policy. Returns a list of rotation records (or empty if none). */
export function rotateAllLedgers(policy: RotationPolicy = DEFAULT_POLICY): StorageRotationRecord[] {
  const dir = masterAiDataRoot();
  if (!fs.existsSync(dir)) return [];
  const out: StorageRotationRecord[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".jsonl") || name.startsWith("storage_rotations")) continue;
    if (name.includes(".archive-")) continue;      // skip already-archived files
    const filePath = path.join(dir, name);
    const rec = rotateLedgerIfNeeded(filePath, policy);
    if (rec) out.push(rec);
  }
  return out;
}

export function readAllRotations(): StorageRotationRecord[] {
  return readJsonlAll<StorageRotationRecord>(storageRotationsPath());
}

export function _resetStorageRotationForTests(): void {
  try { if (fs.existsSync(storageRotationsPath())) fs.unlinkSync(storageRotationsPath()); } catch { /* ignore */ }
}
