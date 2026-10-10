// src/lib/nex-native/family-safety/minor-profile/minor-profile-reader.ts
//
// NEX Family Safety · Minor Profile Reader (CC-1).
// --------------------------------------------------------------------
// Read-only service exposing nex.account_minor_profile for consumers.
// CC-3's SafeChat enforcer reads `isMinor` to decide gating.
// CC-3's age-transition workflow reads `autoTransferAt`.
//
// Doctrine (sealed with migration 206):
//   · This file NEVER writes · all writes come from
//     parent-custody-service.createCustody (initial row) and from the
//     age-transition workflow (which flips is_minor / transferred_at).
//   · safechat_always_on is READ-ONLY · the parent never has a toggle.
//   · simulated=TRUE enforced by migration default.
//   · A missing row is NOT an error · callers get null and MUST treat
//     "unknown minor state" as "not a minor" by default (CC-3 enforcer
//     doctrine).

import "server-only";

import { withClient } from "@/lib/nex/db";
import type { PgClientLike } from "@/lib/nex/db";

import {
  CHILD_CREATION_ERROR_CODES,
  type MinorProfile,
} from "../child-account-creation/types";

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

function mapRow(r: Record<string, unknown>): MinorProfile {
  return {
    accountId: String(r.account_id),
    isMinor: Boolean(r.is_minor),
    parentCustodyId: toStringOrNull(r.parent_custody_id),
    autoTransferAt: toIsoOrNull(r.auto_transfer_at),
    transferredAt: toIsoOrNull(r.transferred_at),
    safechatAlwaysOn: Boolean(r.safechat_always_on),
    simulated: Boolean(r.simulated),
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function requireNonEmpty(v: unknown, code: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(code);
  }
  return v;
}

/**
 * Read the minor profile for an account. Returns null when no row
 * exists · callers MUST default to "not a minor" in that case.
 */
export async function getMinorProfile(
  accountId: string,
): Promise<MinorProfile | null> {
  requireNonEmpty(accountId, CHILD_CREATION_ERROR_CODES.INVALID_PARENT);
  const row = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `SELECT * FROM nex.account_minor_profile
        WHERE account_id = $1`,
      [accountId],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    return r.rows[0];
  });
  if (!row) return null;
  return mapRow(row);
}

/**
 * Thin shortcut used by CC-3's SafeChat enforcer. Returns FALSE on an
 * absent row (default-closed semantics for the enforcer).
 */
export async function isMinor(accountId: string): Promise<boolean> {
  const profile = await getMinorProfile(accountId);
  if (!profile) return false;
  return profile.isMinor === true && profile.transferredAt === null;
}

/**
 * Thin shortcut used by CC-3's SafeChat enforcer. Returns TRUE on an
 * active minor row (default-closed semantics · absent row → false).
 */
export async function isSafeChatAlwaysOn(accountId: string): Promise<boolean> {
  const profile = await getMinorProfile(accountId);
  if (!profile) return false;
  // Doctrine D · minor accounts always have safechat_always_on=TRUE.
  // A row that has already transferred (16+) MUST NOT keep SafeChat
  // forced on.
  if (profile.transferredAt !== null) return false;
  return profile.isMinor === true && profile.safechatAlwaysOn === true;
}
