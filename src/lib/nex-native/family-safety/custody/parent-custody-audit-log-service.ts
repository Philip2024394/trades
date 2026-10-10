// src/lib/nex-native/family-safety/custody/parent-custody-audit-log-service.ts
//
// NEX Family Safety · Parent Custody Audit Log service (CC-1).
// --------------------------------------------------------------------
// Append-only ledger of every custodial action the parent takes. Backed
// by nex.parent_custody_audit_log (migration 207).
//
// Doctrine (sealed with migration 207):
//   · APPEND-ONLY · never offers update or delete.
//   · actionDetailsRedacted MUST NOT contain plaintext credentials or
//     private content · we trim at 1000 chars + regex-strip common
//     identifier patterns at this layer (defence in depth).
//   · simulated=TRUE on every write.
//   · The service never exposes a cross-custody list · readers must
//     name a `custodyId` and be the parent on that custody.

import "server-only";

import { randomUUID } from "node:crypto";

import { withClient } from "@/lib/nex/db";
import type { PgClientLike } from "@/lib/nex/db";

import {
  CHILD_CREATION_ERROR_CODES,
  isCustodyAuditAction,
  type CustodyAuditAction,
  type ParentCustodyAuditEntry,
} from "../child-account-creation/types";

// ─────────────────────────────────────────────────────────────────────
// §1 · Helpers
// ─────────────────────────────────────────────────────────────────────

const MAX_DETAILS_LEN = 1000;

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /\+?\d{7,}/g;
const PASSWORD_PATTERNS = [
  /password/gi,
  /secret/gi,
  /token/gi,
  /credential/gi,
];

function redact(details: string | null | undefined): string | null {
  if (details === null || details === undefined) return null;
  if (typeof details !== "string") return null;
  const trimmed = details.slice(0, MAX_DETAILS_LEN);
  let out = trimmed.replace(EMAIL_RE, "[redacted-email]")
    .replace(PHONE_RE, "[redacted-phone]");
  for (const pat of PASSWORD_PATTERNS) {
    out = out.replace(pat, "[redacted]");
  }
  return out;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}

function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function mapRow(r: Record<string, unknown>): ParentCustodyAuditEntry {
  const action = String(r.action ?? "");
  if (!isCustodyAuditAction(action)) {
    throw new Error(
      `parent-custody-audit.unknown_action · got '${action}' · migration drift`,
    );
  }
  return {
    auditId: String(r.audit_id),
    custodyId: String(r.custody_id),
    parentAccountId: String(r.parent_account_id),
    childAccountId: String(r.child_account_id),
    action,
    actionDetailsRedacted: toStringOrNull(r.action_details_redacted),
    simulated: Boolean(r.simulated),
    performedAt: toIso(r.performed_at),
  };
}

function requireNonEmpty(v: unknown, code: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(code);
  }
  return v;
}

// ─────────────────────────────────────────────────────────────────────
// §2 · appendAuditEntry
// ─────────────────────────────────────────────────────────────────────

export interface AppendAuditEntryArgs {
  readonly custodyId: string;
  readonly parentAccountId: string;
  readonly childAccountId: string;
  readonly action: CustodyAuditAction;
  readonly actionDetailsRedacted?: string | null;
}

export async function appendAuditEntry(
  args: AppendAuditEntryArgs,
): Promise<ParentCustodyAuditEntry> {
  const custodyId = requireNonEmpty(
    args.custodyId,
    CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND,
  );
  const parentId = requireNonEmpty(
    args.parentAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_PARENT,
  );
  const childId = requireNonEmpty(
    args.childAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_PARENT,
  );
  if (!isCustodyAuditAction(args.action)) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_STATE_TRANSITION);
  }
  const details = redact(args.actionDetailsRedacted ?? null);

  const auditId = randomUUID();
  const row = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `INSERT INTO nex.parent_custody_audit_log (
         audit_id,
         custody_id,
         parent_account_id,
         child_account_id,
         action,
         action_details_redacted,
         simulated
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, TRUE)
       RETURNING *`,
      [auditId, custodyId, parentId, childId, args.action, details],
    );
    return r.rows[0];
  });
  if (!row) throw new Error("parent-custody-audit.db_unavailable");
  return mapRow(row);
}

// ─────────────────────────────────────────────────────────────────────
// §3 · readRecentForCustody
// ─────────────────────────────────────────────────────────────────────

/**
 * Read the most-recent N audit entries for a custody. Viewer MUST be
 * the parent on the custody · we join against parent_custody_link to
 * enforce.
 */
export async function readRecentForCustody(
  custodyId: string,
  viewerAccountId: string,
  limit: number = 50,
): Promise<readonly ParentCustodyAuditEntry[]> {
  requireNonEmpty(custodyId, CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND);
  requireNonEmpty(viewerAccountId, CHILD_CREATION_ERROR_CODES.INVALID_ACTOR);
  const clamped = Math.min(Math.max(1, Math.floor(limit)), 500);

  const rows = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `SELECT a.* FROM nex.parent_custody_audit_log a
         JOIN nex.parent_custody_link l ON l.custody_id = a.custody_id
        WHERE a.custody_id = $1::uuid
          AND l.parent_account_id = $2
        ORDER BY a.performed_at DESC
        LIMIT $3`,
      [custodyId, viewerAccountId, clamped],
    );
    return r.rows;
  });
  if (!rows) return [];
  return rows.map(mapRow);
}
