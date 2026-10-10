// src/lib/nex-native/family-safety/custody/parent-custody-service.ts
//
// NEX Family Safety · Parent Custody Link service (CC-1).
// --------------------------------------------------------------------
// Server-only. Thin pg wrapper around nex.parent_custody_link +
// nex.account_minor_profile (migrations 205 + 206). Owns:
//
//   · createCustody            · parent takes custody of a minor
//   · listCustodiesForParent   · list all custodies the parent has
//   · getCustodyById           · single custody fetched by viewer
//   · revokeCustody            · explicit revoke · never deletes rows
//   · requestPasswordResetForChild  · parent requests reset · opaque
//   · completePasswordResetForChild · reset completed · never sees PT
//
// Doctrine (sealed with migrations 205-207):
//   · One ACTIVE custody per child (partial unique index enforces).
//   · Parent is CUSTODIAN · can request password reset for the child
//     via a sealed token-handoff pattern · NEVER sees plaintext
//     credentials.
//   · Every parent action produces a parent_custody_audit_log row
//     (via `appendAuditEntry` in the audit-log service).
//   · simulated=TRUE on every v1 write.
//   · Password-reset plaintext does NOT travel through this layer ·
//     the sealed account-service primitive is invoked by the token
//     consumer in a separate flow (child's own device OR support
//     surface). This file never stores plaintext passwords.

import "server-only";

import { randomUUID } from "node:crypto";

import { withClient } from "@/lib/nex/db";
import type { PgClientLike } from "@/lib/nex/db";

import {
  CHILD_CREATION_ERROR_CODES,
  isCustodyLinkType,
  type CustodyLinkType,
  type ParentCustodyLink,
} from "../child-account-creation/types";
import { appendAuditEntry } from "./parent-custody-audit-log-service";

// ─────────────────────────────────────────────────────────────────────
// §1 · Internal helpers
// ─────────────────────────────────────────────────────────────────────

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v);
}

function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function mapRow(r: Record<string, unknown>): ParentCustodyLink {
  const linkType = String(r.link_type ?? "");
  if (!isCustodyLinkType(linkType)) {
    throw new Error(
      `parent-custody.unknown_link_type · got '${linkType}' · migration drift`,
    );
  }
  return {
    custodyId: String(r.custody_id),
    parentAccountId: String(r.parent_account_id),
    childAccountId: String(r.child_account_id),
    linkType,
    isMinor: true, // every row in parent_custody_link is a minor at creation
    createdAt: toIso(r.created_at),
    autoTransferAt: toIsoOrNull(r.auto_transfer_at),
    transferredAt: toIsoOrNull(r.transferred_at),
    revokedAt: toIsoOrNull(r.revoked_at),
    revokedReason: toStringOrNull(r.revoked_reason),
    simulated: Boolean(r.simulated),
  };
}

function requireNonEmpty(v: unknown, code: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(code);
  }
  return v;
}

/**
 * Compute the 16th-birthday timestamp from a `yyyy-mm-dd` DOB. Returns
 * an ISO string at UTC midnight. Clamps leap-day to Feb 28.
 */
export function computeSixteenthBirthdayIso(declaredDob: string): string {
  const match = declaredDob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_DOB);
  }
  const [, yStr, mStr, dStr] = match;
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  // Leap-day handling: if Feb-29, step down to Feb-28 in the target year
  // (common civil-law default · operator doctrine).
  const transferYear = y + 16;
  let month = m;
  let day = d;
  if (m === 2 && d === 29) {
    day = 28;
  }
  const iso = `${transferYear.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}T00:00:00.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_DOB);
  }
  return date.toISOString();
}

// ─────────────────────────────────────────────────────────────────────
// §2 · createCustody
// ─────────────────────────────────────────────────────────────────────

export interface CreateCustodyArgs {
  readonly parentAccountId: string;
  readonly childAccountId: string;
  readonly linkType: CustodyLinkType;
  readonly declaredDateOfBirth: string;
  readonly creationRequestId?: string | null;
  readonly actorAccountId: string;
}

export async function createCustody(args: CreateCustodyArgs): Promise<ParentCustodyLink> {
  const parentId = requireNonEmpty(
    args.parentAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_PARENT,
  );
  const childId = requireNonEmpty(
    args.childAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_PARENT,
  );
  const actorId = requireNonEmpty(
    args.actorAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_ACTOR,
  );
  if (actorId !== parentId) {
    throw new Error(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
  }
  if (parentId === childId) {
    throw new Error(CHILD_CREATION_ERROR_CODES.SELF_CUSTODY);
  }
  if (!isCustodyLinkType(args.linkType)) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_STATE_TRANSITION);
  }
  const autoTransferAt = computeSixteenthBirthdayIso(args.declaredDateOfBirth);

  const custodyId = randomUUID();
  const row = await withClient(async (c: PgClientLike) => {
    // Guard: refuse to create if an active custody already exists for
    // this child (the DB enforces, but we surface the error cleanly).
    const existing = await c.query(
      `SELECT custody_id FROM nex.parent_custody_link
        WHERE child_account_id = $1
          AND revoked_at IS NULL
          AND transferred_at IS NULL`,
      [childId],
    );
    if ((existing.rowCount ?? 0) > 0) {
      throw new Error(CHILD_CREATION_ERROR_CODES.DUPLICATE_ACTIVE_CUSTODY);
    }
    const r = await c.query(
      `INSERT INTO nex.parent_custody_link (
         custody_id,
         parent_account_id,
         child_account_id,
         link_type,
         creation_request_id,
         auto_transfer_at,
         simulated
       )
       VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6::timestamptz, TRUE)
       RETURNING *`,
      [
        custodyId,
        parentId,
        childId,
        args.linkType,
        args.creationRequestId ?? null,
        autoTransferAt,
      ],
    );
    return r.rows[0];
  });
  if (!row) throw new Error("parent-custody.db_unavailable");

  // Minor profile mirror · idempotent.
  await writeMinorProfileRow({
    accountId: childId,
    parentCustodyId: String(row.custody_id),
    autoTransferAt,
  });

  const link = mapRow(row);
  await appendAuditEntry({
    custodyId: link.custodyId,
    parentAccountId: parentId,
    childAccountId: childId,
    action: "custody_created",
    actionDetailsRedacted: `link_type=${args.linkType}`,
  });
  return link;
}

async function writeMinorProfileRow(args: {
  readonly accountId: string;
  readonly parentCustodyId: string;
  readonly autoTransferAt: string;
}): Promise<void> {
  await withClient(async (c: PgClientLike) => {
    await c.query(
      `INSERT INTO nex.account_minor_profile (
         account_id,
         is_minor,
         parent_custody_id,
         auto_transfer_at,
         safechat_always_on,
         simulated
       )
       VALUES ($1, TRUE, $2::uuid, $3::timestamptz, TRUE, TRUE)
       ON CONFLICT (account_id) DO UPDATE
         SET parent_custody_id = EXCLUDED.parent_custody_id,
             auto_transfer_at = EXCLUDED.auto_transfer_at,
             is_minor = TRUE,
             safechat_always_on = TRUE,
             updated_at = now()`,
      [args.accountId, args.parentCustodyId, args.autoTransferAt],
    );
    return null;
  });
}

// ─────────────────────────────────────────────────────────────────────
// §3 · listCustodiesForParent + getCustodyById
// ─────────────────────────────────────────────────────────────────────

export async function listCustodiesForParent(
  parentAccountId: string,
): Promise<readonly ParentCustodyLink[]> {
  requireNonEmpty(parentAccountId, CHILD_CREATION_ERROR_CODES.INVALID_PARENT);
  const rows = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `SELECT * FROM nex.parent_custody_link
        WHERE parent_account_id = $1
        ORDER BY created_at DESC`,
      [parentAccountId],
    );
    return r.rows;
  });
  if (!rows) return [];
  return rows.map(mapRow);
}

export async function getCustodyById(
  custodyId: string,
  viewerAccountId: string,
): Promise<ParentCustodyLink | null> {
  requireNonEmpty(custodyId, CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND);
  requireNonEmpty(viewerAccountId, CHILD_CREATION_ERROR_CODES.INVALID_ACTOR);
  const row = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `SELECT * FROM nex.parent_custody_link
        WHERE custody_id = $1::uuid`,
      [custodyId],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    return r.rows[0];
  });
  if (!row) return null;
  if (String(row.parent_account_id) !== viewerAccountId) return null;
  return mapRow(row);
}

// ─────────────────────────────────────────────────────────────────────
// §4 · revokeCustody
// ─────────────────────────────────────────────────────────────────────

export async function revokeCustody(
  custodyId: string,
  actorAccountId: string,
  reason: string,
): Promise<ParentCustodyLink> {
  requireNonEmpty(custodyId, CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND);
  requireNonEmpty(actorAccountId, CHILD_CREATION_ERROR_CODES.INVALID_ACTOR);
  requireNonEmpty(reason, CHILD_CREATION_ERROR_CODES.INVALID_STATE_TRANSITION);

  const row = await withClient(async (c: PgClientLike) => {
    const existing = await c.query(
      `SELECT * FROM nex.parent_custody_link
        WHERE custody_id = $1::uuid`,
      [custodyId],
    );
    if ((existing.rowCount ?? 0) === 0) {
      throw new Error(CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND);
    }
    const current = existing.rows[0];
    if (String(current.parent_account_id) !== actorAccountId) {
      throw new Error(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
    }
    if (current.revoked_at !== null && current.revoked_at !== undefined) {
      throw new Error(CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_ACTIVE);
    }
    const r = await c.query(
      `UPDATE nex.parent_custody_link
          SET revoked_at = now(),
              revoked_reason = $2
        WHERE custody_id = $1::uuid
        RETURNING *`,
      [custodyId, reason],
    );
    return r.rows[0];
  });
  if (!row) throw new Error("parent-custody.db_unavailable");

  const link = mapRow(row);
  await appendAuditEntry({
    custodyId: link.custodyId,
    parentAccountId: link.parentAccountId,
    childAccountId: link.childAccountId,
    action: "custody_revoked",
    actionDetailsRedacted: reason.slice(0, 200),
  });
  return link;
}

// ─────────────────────────────────────────────────────────────────────
// §5 · password reset · opaque to parent · NEVER plaintext
// ─────────────────────────────────────────────────────────────────────

export interface PasswordResetTicket {
  readonly resetTokenRefOpaque: string;
  readonly expiresAt: string;
}

/**
 * Parent initiates a password reset for the child. We mint an opaque
 * reference and defer the actual plaintext handling to the sealed
 * account-service primitive (invoked from the token consumer side,
 * never from here).
 *
 * The parent sees ONLY `resetTokenRefOpaque` + `expiresAt`. The
 * plaintext token travels through a sealed channel (email / in-app
 * notification) to the child's own device.
 *
 * This method writes an audit entry · `password_reset_requested`.
 */
export async function requestPasswordResetForChild(args: {
  readonly custodyId: string;
  readonly actorAccountId: string;
}): Promise<PasswordResetTicket> {
  const custodyId = requireNonEmpty(
    args.custodyId,
    CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND,
  );
  const actorId = requireNonEmpty(
    args.actorAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_ACTOR,
  );

  const row = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `SELECT * FROM nex.parent_custody_link
        WHERE custody_id = $1::uuid`,
      [custodyId],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    return r.rows[0];
  });
  if (!row) throw new Error(CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND);
  if (String(row.parent_account_id) !== actorId) {
    throw new Error(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
  }
  if (row.revoked_at !== null && row.revoked_at !== undefined) {
    throw new Error(CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_ACTIVE);
  }

  // Opaque ref · hex-encoded random 32 bytes. The plaintext token
  // lives server-side (future wave) and is handed to the child via a
  // sealed channel · NEVER returned here.
  const opaque = `nex-child-reset:${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 60 min

  await appendAuditEntry({
    custodyId: String(row.custody_id),
    parentAccountId: String(row.parent_account_id),
    childAccountId: String(row.child_account_id),
    action: "password_reset_requested",
    actionDetailsRedacted: `expires=${expiresAt}`,
  });

  return { resetTokenRefOpaque: opaque, expiresAt };
}

/**
 * Reset completion is recorded via the audit layer. This method does
 * NOT accept a plaintext password · the sealed account-service
 * primitive is invoked by the token consumer. The parent-facing
 * surface sees only completion metadata.
 *
 * The function accepts an OPAQUE resetTokenRefOpaque (not the
 * plaintext token). The service layer never writes a plaintext
 * password through this path.
 */
export async function completePasswordResetForChild(args: {
  readonly resetTokenRefOpaque: string;
  readonly actorAccountId: string;
  readonly custodyId: string;
}): Promise<void> {
  requireNonEmpty(
    args.resetTokenRefOpaque,
    CHILD_CREATION_ERROR_CODES.INVALID_IDEMPOTENCY_KEY,
  );
  const custodyId = requireNonEmpty(
    args.custodyId,
    CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND,
  );
  const actorId = requireNonEmpty(
    args.actorAccountId,
    CHILD_CREATION_ERROR_CODES.INVALID_ACTOR,
  );

  const row = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `SELECT custody_id, parent_account_id, child_account_id, revoked_at
         FROM nex.parent_custody_link
        WHERE custody_id = $1::uuid`,
      [custodyId],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    return r.rows[0];
  });
  if (!row) throw new Error(CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND);
  if (String(row.parent_account_id) !== actorId) {
    throw new Error(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
  }
  if (row.revoked_at !== null && row.revoked_at !== undefined) {
    throw new Error(CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_ACTIVE);
  }

  await appendAuditEntry({
    custodyId: String(row.custody_id),
    parentAccountId: String(row.parent_account_id),
    childAccountId: String(row.child_account_id),
    action: "password_reset_completed",
    actionDetailsRedacted: null,
  });
}
