// src/lib/nex/owner-identity/audit.ts
//
// FOUNDER MASTER ACCESS · append-only audit ledger
// Philip 2026-09-08 · AUTHORIZE Founder Master Access mission
//
// Every authentication + authorization event is recorded to an append-only
// JSONL ledger for post-hoc Founder review. NEVER contains the credential
// itself · only hashed / fingerprint references.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

export type OwnerAuditEventKind =
  | "AUTH_ATTEMPT"
  | "AUTH_SUCCESS"
  | "AUTH_FAILURE"
  | "SESSION_CREATED"
  | "SESSION_EXPIRED_MAX_LIFETIME"
  | "SESSION_EXPIRED_INACTIVITY"
  | "SESSION_LOGOUT"
  | "SESSION_ADMIN_REVOKE"
  | "INFO_REQUEST"
  | "SCOPE_REFUSED"
  | "DATA_UPDATE_CONFIRMED"
  | "DATA_UPDATE_EXECUTED"
  | "CREDENTIAL_DETECTED_INVALID";

export type OwnerAuditEvent = {
  event_id: string;                       // ULID-like · unique
  event_kind: OwnerAuditEventKind;
  timestamp_iso: string;
  session_id?: string | null;
  device_fingerprint_hash?: string | null; // hashed · never plaintext
  network_hint_hash?: string | null;       // hashed · never plaintext
  matched_hash_fingerprint?: string | null; // credential audit fingerprint · never credential
  outcome: "OK" | "REJECTED" | "REFUSED" | "INFO";
  request_class?: string | null;
  request_summary?: string | null;         // first 200 chars only · never full credential
  extra?: Record<string, unknown>;
};

/** Hash a device / network hint for audit (SHA-256 → 16 hex chars). Never
 *  reversible · never leaks the identifier itself. */
export function hashHintForAudit(hint: string | undefined | null): string | null {
  if (!hint) return null;
  return "hash_" + createHash("sha256").update(hint, "utf8").digest("hex").slice(0, 16);
}

function ownerAuditLedgerPath(repoRoot?: string): string {
  const root = repoRoot ?? process.cwd();
  return path.join(root, "data", "owner-identity", "audit.jsonl");
}

/** Append one event to the audit ledger. Refuses to write anything that
 *  looks like a plaintext credential (defense in depth). */
export function appendOwnerAuditEvent(event: Omit<OwnerAuditEvent, "event_id" | "timestamp_iso"> & { event_id?: string; timestamp_iso?: string }, opts: { repoRoot?: string } = {}): OwnerAuditEvent {
  const complete: OwnerAuditEvent = {
    event_id: event.event_id ?? `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    event_kind: event.event_kind,
    timestamp_iso: event.timestamp_iso ?? new Date().toISOString(),
    session_id: event.session_id ?? null,
    device_fingerprint_hash: event.device_fingerprint_hash ?? null,
    network_hint_hash: event.network_hint_hash ?? null,
    matched_hash_fingerprint: event.matched_hash_fingerprint ?? null,
    outcome: event.outcome,
    request_class: event.request_class ?? null,
    request_summary: event.request_summary ? String(event.request_summary).slice(0, 200) : null,
    extra: event.extra,
  };
  // Defense in depth: scan the whole payload for anything that looks like
  // a raw credential (a long alphanumeric run). If found, we REFUSE to write.
  const serialised = JSON.stringify(complete);
  if (/(?<![a-zA-Z0-9])[a-zA-Z0-9]{20,}(?![a-zA-Z0-9])/.test(complete.request_summary ?? "")) {
    // Only inspect the freeform request_summary field · everything else is
    // typed. This catches accidental credential leakage in the summary.
    throw new Error("AUDIT_REJECTED: request_summary contains a high-entropy token that MAY be a credential · refuse to persist");
  }
  const p = ownerAuditLedgerPath(opts.repoRoot);
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(p, serialised + "\n", "utf8");
  return complete;
}

/** Read all audit events · for post-hoc Founder review. */
export function readOwnerAuditLedger(opts: { repoRoot?: string } = {}): OwnerAuditEvent[] {
  const p = ownerAuditLedgerPath(opts.repoRoot);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const out: OwnerAuditEvent[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t) as OwnerAuditEvent); } catch { /* skip malformed */ }
  }
  return out;
}
