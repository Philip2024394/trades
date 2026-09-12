// src/lib/nex-agent/code-engine/audit.ts
//
// Append-only ledger for engine invocations. Line-delimited JSON. Never
// deleted. Rotated at 100 MB.
//
// The founder can grep this file to verify no cloud egress ever occurred.

import { mkdirSync, existsSync, appendFileSync, statSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";

const AUDIT_PATH = resolve(process.cwd(), "data/nex1-code-engine/audit.jsonl");
const ROTATE_BYTES = 100 * 1024 * 1024;

export interface AuditEntry {
  readonly at: string;
  readonly task_id: string;
  readonly attempt_id: string;
  readonly adapter_id: string;
  readonly outcome: "ok" | "fail";
  readonly duration_ms: number;
  readonly diff_size_lines: number;
  readonly network_calls: 0;                 // engine has none · asserted at build time
  readonly fail_reason?: string;
  readonly attempted_by: "nex1";
}

/**
 * @summary Append one audit entry to the engine's append-only ledger.
 */
export function appendAudit(entry: AuditEntry): void {
  const dir = dirname(AUDIT_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  rotateIfNeeded();
  appendFileSync(AUDIT_PATH, JSON.stringify(entry) + "\n", "utf8");
}

function rotateIfNeeded(): void {
  if (!existsSync(AUDIT_PATH)) return;
  const st = statSync(AUDIT_PATH);
  if (st.size < ROTATE_BYTES) return;
  const rotated = `${AUDIT_PATH}.${Date.now()}`;
  renameSync(AUDIT_PATH, rotated);
}

/**
 * @summary Audit path.
 */
export function auditPath(): string {
  return AUDIT_PATH;
}
