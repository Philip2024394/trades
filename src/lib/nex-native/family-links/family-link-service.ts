// src/lib/nex-native/family-links/family-link-service.ts
//
// NEX Family Links · Phase 1 · family_link lifecycle service.
//
// Server-only. Thin pg wrapper around nex.family_link (migration 198).
// Owns the sealed 4-state lifecycle:
//
//   pending → active → revoked
//           ↘ expired
//
// Doctrine:
//   · Phase 1 PILOT · every INSERT forces simulated=TRUE. Callers may
//     NOT create a link with simulated=false; the service throws
//     FAMILY_LINK_ERROR_CODES.SIMULATED_ONLY.
//   · Default-closed permissions · all three permission flags
//     (can_see_safety_summaries, can_see_location_when_shared) stay at
//     their migration-level FALSE default on INSERT. The exception is
//     can_see_emergency_alerts whose DB default is TRUE (Emergency Help
//     still gates fan-out on its own trust envelope, so this is a
//     primitive-level bit, not a capability grant).
//   · No permission-flag flip in Phase 1 · updateLinkPermissions is
//     NOT exposed. Flipping the two default-FALSE flags requires a
//     future wave with its own explicit authorisation.
//   · Append-only revocation · a revoked row stays as history. A new
//     link may be initiated for the same pair afterwards.
//   · Authorization is enforced by this layer. The soft-reference text
//     column model means the DB cannot enforce "actor must be
//     guardian OR child"; the service does.

import "server-only";

import { withClient } from "@/lib/nex/db";
import type { PgClientLike } from "@/lib/nex/db";
import {
  FAMILY_LINK_ERROR_CODES,
  isFamilyLinkInitiatedBy,
  isFamilyLinkState,
  isFamilyRole,
  type FamilyLinkInitiatedBy,
  type FamilyLinkRevokeReason,
  type FamilyLinkRow,
  type FamilyLinkState,
  type FamilyRole,
} from "./types";

// ═════════════════════════════════════════════════════════════════════
// §1 · Internal helpers
// ═════════════════════════════════════════════════════════════════════

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

function mapRow(r: Record<string, unknown>): FamilyLinkRow {
  const role = String(r.role ?? "");
  const state = String(r.state ?? "");
  const initiatedBy = String(r.initiated_by ?? "");
  if (!isFamilyRole(role)) {
    throw new Error(
      `family-link.unknown_role · got '${role}' · migration drift`,
    );
  }
  if (!isFamilyLinkState(state)) {
    throw new Error(
      `family-link.unknown_state · got '${state}' · migration drift`,
    );
  }
  if (!isFamilyLinkInitiatedBy(initiatedBy)) {
    throw new Error(
      `family-link.unknown_initiated_by · got '${initiatedBy}' · migration drift`,
    );
  }
  return {
    linkId: String(r.link_id),
    guardianAccountId: String(r.guardian_account_id),
    childAccountId: String(r.child_account_id),
    role,
    state,
    initiatedBy,
    initiatedAt: toIso(r.initiated_at),
    confirmedAt: toIsoOrNull(r.confirmed_at),
    revokedAt: toIsoOrNull(r.revoked_at),
    revokedBy: toStringOrNull(r.revoked_by),
    revokedReason: toStringOrNull(r.revoked_reason),
    expiresAt: toIsoOrNull(r.expires_at),
    canSeeEmergencyAlerts: Boolean(r.can_see_emergency_alerts),
    canSeeSafetySummaries: Boolean(r.can_see_safety_summaries),
    canSeeLocationWhenShared: Boolean(r.can_see_location_when_shared),
    simulated: Boolean(r.simulated),
    createdAt: toIso(r.created_at),
  };
}

function requireNonEmptyString(v: unknown, label: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`family-link.invalid_${label}`);
  }
  return v;
}

function validateRevokeReason(reason: string | undefined): string | null {
  if (reason === undefined || reason === null) return null;
  if (typeof reason !== "string" || reason.length < 1 || reason.length > 200) {
    throw new Error(FAMILY_LINK_ERROR_CODES.INVALID_REVOKE_REASON);
  }
  return reason;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · initiateLink
// ═════════════════════════════════════════════════════════════════════

export interface InitiateLinkArgs {
  readonly guardianAccountId: string;
  readonly childAccountId: string;
  readonly role: FamilyRole;
  readonly initiatedBy: FamilyLinkInitiatedBy;
  readonly actorAccountId: string;
  readonly expiresAt?: string | null;
}

/**
 * Create a new family_link row in `pending` state. Authorization:
 *   · initiatedBy='guardian_invite'  → actorAccountId MUST equal guardianAccountId
 *   · initiatedBy='child_invite'     → actorAccountId MUST equal childAccountId
 *   · initiatedBy='system_setup'     → actorAccountId MUST equal guardianAccountId
 *     (system flows arrive as guardian-attached setup · never
 *     child-attached in Phase 1 to keep the audit trail bounded)
 *
 * Always writes simulated=TRUE. Permission flags default to the
 * migration-level values; the service refuses to flip them on INSERT.
 */
export async function initiateLink(args: InitiateLinkArgs): Promise<FamilyLinkRow> {
  const guardianId = requireNonEmptyString(args.guardianAccountId, "guardian_account_id");
  const childId = requireNonEmptyString(args.childAccountId, "child_account_id");
  const actorId = requireNonEmptyString(args.actorAccountId, "actor_account_id");

  if (!isFamilyRole(args.role)) {
    throw new Error(FAMILY_LINK_ERROR_CODES.INVALID_ROLE);
  }
  if (!isFamilyLinkInitiatedBy(args.initiatedBy)) {
    throw new Error(FAMILY_LINK_ERROR_CODES.INVALID_INITIATED_BY);
  }
  if (guardianId === childId) {
    throw new Error(FAMILY_LINK_ERROR_CODES.SELF_LINK);
  }

  // Authorization gate.
  if (args.initiatedBy === "guardian_invite" && actorId !== guardianId) {
    throw new Error(FAMILY_LINK_ERROR_CODES.UNAUTHORIZED_ACTOR);
  }
  if (args.initiatedBy === "child_invite" && actorId !== childId) {
    throw new Error(FAMILY_LINK_ERROR_CODES.UNAUTHORIZED_ACTOR);
  }
  if (args.initiatedBy === "system_setup" && actorId !== guardianId) {
    throw new Error(FAMILY_LINK_ERROR_CODES.UNAUTHORIZED_ACTOR);
  }

  const result = await withClient(async (client) => {
    // Pre-check: if role is guardian_primary, assert no active primary
    // guardian for this child. The partial-unique index also enforces
    // this on commit, but we want a stable error code before the
    // round-trip to the DB complains about index violation.
    if (args.role === "guardian_primary") {
      const dup = await client.query(
        `SELECT 1 FROM nex.family_link
          WHERE child_account_id = $1
            AND role             = 'guardian_primary'
            AND state            = 'active'
          LIMIT 1`,
        [childId],
      );
      if ((dup.rowCount ?? 0) > 0) {
        throw new Error(FAMILY_LINK_ERROR_CODES.PRIMARY_GUARDIAN_ALREADY_EXISTS);
      }
    }

    const expiresAt = args.expiresAt ?? null;

    const ins = await client.query(
      `INSERT INTO nex.family_link (
         guardian_account_id,
         child_account_id,
         role,
         state,
         initiated_by,
         expires_at,
         simulated
       ) VALUES ($1, $2, $3, 'pending', $4, $5, TRUE)
       RETURNING *`,
      [guardianId, childId, args.role, args.initiatedBy, expiresAt],
    );
    if (ins.rowCount !== 1 || !ins.rows[0]) {
      throw new Error("family-link.insert_failed");
    }
    return mapRow(ins.rows[0]);
  });

  if (result === null) {
    throw new Error(FAMILY_LINK_ERROR_CODES.DB_UNAVAILABLE);
  }
  return result;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · confirmLink
// ═════════════════════════════════════════════════════════════════════

export interface ConfirmLinkArgs {
  readonly linkId: string;
  readonly actorAccountId: string;
}

/**
 * Flip a pending link to active. Authorization: the OTHER party must
 * confirm · guardian_invite requires the child; child_invite requires
 * the guardian; system_setup requires the child (asymmetric by design).
 */
export async function confirmLink(args: ConfirmLinkArgs): Promise<FamilyLinkRow> {
  const linkId = requireNonEmptyString(args.linkId, "link_id");
  const actorId = requireNonEmptyString(args.actorAccountId, "actor_account_id");

  const result = await withClient(async (client) => {
    const existing = await fetchLinkByIdInternal(client, linkId);
    if (!existing) {
      throw new Error(FAMILY_LINK_ERROR_CODES.LINK_NOT_FOUND);
    }
    if (existing.state === "active") {
      throw new Error(FAMILY_LINK_ERROR_CODES.ALREADY_CONFIRMED);
    }
    if (existing.state !== "pending") {
      // revoked / expired: cannot flip back to active.
      throw new Error(FAMILY_LINK_ERROR_CODES.WRONG_CONFIRMING_PARTY);
    }

    // Determine the required confirming party.
    let requiredConfirmer: string;
    switch (existing.initiatedBy) {
      case "guardian_invite":
        requiredConfirmer = existing.childAccountId;
        break;
      case "child_invite":
        requiredConfirmer = existing.guardianAccountId;
        break;
      case "system_setup":
        // system_setup is created by/on behalf of the guardian; the
        // child must confirm.
        requiredConfirmer = existing.childAccountId;
        break;
    }
    if (actorId !== requiredConfirmer) {
      throw new Error(FAMILY_LINK_ERROR_CODES.WRONG_CONFIRMING_PARTY);
    }

    // If this is a guardian_primary confirmation, re-check the
    // partial-unique in case another primary became active in between.
    if (existing.role === "guardian_primary") {
      const dup = await client.query(
        `SELECT 1 FROM nex.family_link
          WHERE child_account_id = $1
            AND role             = 'guardian_primary'
            AND state            = 'active'
            AND link_id         <> $2
          LIMIT 1`,
        [existing.childAccountId, linkId],
      );
      if ((dup.rowCount ?? 0) > 0) {
        throw new Error(FAMILY_LINK_ERROR_CODES.PRIMARY_GUARDIAN_ALREADY_EXISTS);
      }
    }

    const upd = await client.query(
      `UPDATE nex.family_link
          SET state        = 'active',
              confirmed_at = now()
        WHERE link_id = $1
          AND state   = 'pending'
      RETURNING *`,
      [linkId],
    );
    if (upd.rowCount !== 1 || !upd.rows[0]) {
      throw new Error(FAMILY_LINK_ERROR_CODES.WRONG_CONFIRMING_PARTY);
    }
    return mapRow(upd.rows[0]);
  });

  if (result === null) {
    throw new Error(FAMILY_LINK_ERROR_CODES.DB_UNAVAILABLE);
  }
  return result;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · revokeLink
// ═════════════════════════════════════════════════════════════════════

export interface RevokeLinkArgs {
  readonly linkId: string;
  readonly actorAccountId: string;
  readonly reason?: FamilyLinkRevokeReason;
}

/**
 * Revoke a link. Either the guardian OR the child may revoke. Already
 * revoked / expired links throw ALREADY_REVOKED. Revocation is
 * append-only · the row stays as history.
 */
export async function revokeLink(args: RevokeLinkArgs): Promise<FamilyLinkRow> {
  const linkId = requireNonEmptyString(args.linkId, "link_id");
  const actorId = requireNonEmptyString(args.actorAccountId, "actor_account_id");
  const reason = validateRevokeReason(args.reason);

  const result = await withClient(async (client) => {
    const existing = await fetchLinkByIdInternal(client, linkId);
    if (!existing) {
      throw new Error(FAMILY_LINK_ERROR_CODES.LINK_NOT_FOUND);
    }
    if (existing.state === "revoked" || existing.state === "expired") {
      throw new Error(FAMILY_LINK_ERROR_CODES.ALREADY_REVOKED);
    }

    if (
      actorId !== existing.guardianAccountId &&
      actorId !== existing.childAccountId
    ) {
      throw new Error(FAMILY_LINK_ERROR_CODES.UNAUTHORIZED_ACTOR);
    }

    const upd = await client.query(
      `UPDATE nex.family_link
          SET state          = 'revoked',
              revoked_at     = now(),
              revoked_by     = $2,
              revoked_reason = $3
        WHERE link_id = $1
          AND state IN ('pending','active')
      RETURNING *`,
      [linkId, actorId, reason],
    );
    if (upd.rowCount !== 1 || !upd.rows[0]) {
      throw new Error(FAMILY_LINK_ERROR_CODES.ALREADY_REVOKED);
    }
    return mapRow(upd.rows[0]);
  });

  if (result === null) {
    throw new Error(FAMILY_LINK_ERROR_CODES.DB_UNAVAILABLE);
  }
  return result;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · readers
// ═════════════════════════════════════════════════════════════════════

async function fetchLinkByIdInternal(
  client: PgClientLike,
  linkId: string,
): Promise<FamilyLinkRow | null> {
  const res = await client.query(
    `SELECT * FROM nex.family_link WHERE link_id = $1 LIMIT 1`,
    [linkId],
  );
  if (res.rowCount !== 1 || !res.rows[0]) return null;
  return mapRow(res.rows[0]);
}

export async function getLinkById(linkId: string): Promise<FamilyLinkRow | null> {
  requireNonEmptyString(linkId, "link_id");
  const result = await withClient(async (client) => {
    return await fetchLinkByIdInternal(client, linkId);
  });
  if (result === null) {
    // Could be "pool unavailable" OR "no such row". We distinguish by
    // asking the pool once more via a direct marker; simpler is to
    // let callers treat null as "no row visible". readers never throw
    // DB_UNAVAILABLE · they degrade gracefully.
    return null;
  }
  return result;
}

export async function listLinksForGuardian(
  guardianAccountId: string,
): Promise<readonly FamilyLinkRow[]> {
  const id = requireNonEmptyString(guardianAccountId, "guardian_account_id");
  const rows = await withClient(async (client) => {
    const res = await client.query(
      `SELECT * FROM nex.family_link
         WHERE guardian_account_id = $1
         ORDER BY initiated_at DESC`,
      [id],
    );
    return res.rows;
  });
  if (rows === null) return [];
  return rows.map(mapRow);
}

export async function listLinksForChild(
  childAccountId: string,
): Promise<readonly FamilyLinkRow[]> {
  const id = requireNonEmptyString(childAccountId, "child_account_id");
  const rows = await withClient(async (client) => {
    const res = await client.query(
      `SELECT * FROM nex.family_link
         WHERE child_account_id = $1
         ORDER BY initiated_at DESC`,
      [id],
    );
    return res.rows;
  });
  if (rows === null) return [];
  return rows.map(mapRow);
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Phase-1 denial surface for permission flips
// ═════════════════════════════════════════════════════════════════════

/**
 * Documented refusal · Phase 1 does NOT expose a path to flip the
 * default-closed permission flags. Any caller importing this symbol
 * and calling it will get a loud rejection — the symbol exists so
 * static grep audits can prove "there is no live mutation path for
 * these flags in Phase 1".
 */
export async function updateLinkPermissions(): Promise<never> {
  throw new Error(FAMILY_LINK_ERROR_CODES.PERMISSION_FLAGS_LOCKED);
}
