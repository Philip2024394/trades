// NEX Code Brain · Work-assignment ledger
// Append-only record of every task the brain has accepted. One record per
// task_id · lane · path-set. Used to detect duplicate task submissions and to
// produce per-lane feeds. Never mutates prior records — status transitions
// append a NEW record with the same assignment_id.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import * as path from "node:path";
import type { AssignmentRecord } from "./types";
import { getBrainDir } from "./lane-registry";

function getAssignDir(): string {
  return path.join(getBrainDir(), "assignments");
}
function getLedgerPath(): string {
  return path.join(getAssignDir(), "ledger.jsonl");
}

function ensureDir(): void {
  if (!existsSync(getAssignDir())) mkdirSync(getAssignDir(), { recursive: true });
}

export function newAssignmentId(): string {
  return `assign-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
}

export function recordAssignment(record: AssignmentRecord): void {
  ensureDir();
  appendFileSync(getLedgerPath(), JSON.stringify(record) + "\n", "utf8");
}

/**
 * Return the LATEST record per assignment_id · i.e. the current status
 * folded from the append-only ledger.
 */
export function currentAssignments(): readonly AssignmentRecord[] {
  ensureDir();
  if (!existsSync(getLedgerPath())) return [];
  const raw = readFileSync(getLedgerPath(), "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const latest = new Map<string, AssignmentRecord>();
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as AssignmentRecord;
      latest.set(rec.assignment_id, rec);
    } catch {
      /* skip corrupt line */
    }
  }
  return Array.from(latest.values());
}

/** Filter current assignments by lane. */
export function assignmentsForLane(lane: string): readonly AssignmentRecord[] {
  return currentAssignments().filter((a) => a.lane === lane);
}

/** Filter current assignments by status. */
export function assignmentsByStatus(status: AssignmentRecord["status"]): readonly AssignmentRecord[] {
  return currentAssignments().filter((a) => a.status === status);
}

/**
 * Detect if a task_id already has a non-terminal assignment. This is the
 * duplication check the Founder specifically asked for: "we must never allow
 * NEX1 and NEX Twin to code the same files".
 */
export function findActiveAssignment(task_id: string): AssignmentRecord | null {
  return (
    currentAssignments().find((a) => a.task_id === task_id && (a.status === "queued" || a.status === "leased")) ?? null
  );
}

// Test-only reset.
export function __resetAssignmentsForTest(): void {
  if (!existsSync(getLedgerPath())) return;
  const { unlinkSync } = require("node:fs") as typeof import("node:fs");
  try {
    unlinkSync(getLedgerPath());
  } catch {
    /* nothing */
  }
}

export { getLedgerPath, getAssignDir };
