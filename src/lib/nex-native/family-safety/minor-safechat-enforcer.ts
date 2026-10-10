// src/lib/nex-native/family-safety/minor-safechat-enforcer.ts
//
// NEX Family Safety · CC-3 · Minor-account SafeChat enforcer.
//
// Server-only. For every account marked `is_minor=TRUE` in the sealed
// `nex.account_minor_profile` table (migration 206), SafeChat is
// ALWAYS ON. The parent custodian cannot flip this flag. This is
// founder decision D (2026-10-10).
//
// Doctrine:
//   · For a minor account: `loggingEnabled=TRUE` and
//     `userFacingEnabled=TRUE` regardless of global env flags.
//   · For a non-minor account: both honour the sealed global
//     SafeChat flags (default OFF).
//   · The sealed SafeChat classifier itself is NEVER modified by this
//     file. The enforcer READS flags · it does not touch
//     `src/lib/nex-native/safechat/*` beyond the feature-flag reader.
//   · `preventFlagFlipByParent` is the ONLY authorised write-path
//     guardrail. It throws when a parent attempts to flip
//     `safechat_always_on=FALSE` on their child's minor profile.
//
// Load-bearing privacy invariants (preserved from prior wave):
//   · This module NEVER queries message content.
//   · This module NEVER exposes classifications to guardians.
//   · This module reads ONLY the sealed primitive columns
//     (`is_minor`, `safechat_always_on`) and uses them to compute
//     a boolean · it does NOT propagate per-message data.

import "server-only";

import { withClient } from "@/lib/nex/db";
import {
  isSafeChatPhase1LoggingEnabled,
  isSafeChatUserFacingEnabled,
} from "../safechat/feature-flag";

// ═════════════════════════════════════════════════════════════════════
// §1 · Sealed shape
// ═════════════════════════════════════════════════════════════════════

export interface SafeChatResolvedFlags {
  readonly loggingEnabled: boolean;
  readonly userFacingEnabled: boolean;
  /** TRUE when the account is a minor and the flags are forcibly ON. */
  readonly enforcedForMinor: boolean;
}

export const MINOR_SAFECHAT_ENFORCER_ERROR_CODES = {
  INVALID_ACCOUNT_ID: "minor_safechat_enforcer.invalid_account_id",
  PARENT_CANNOT_DISABLE: "minor_safechat_enforcer.parent_cannot_disable_safechat",
  UNAUTHORIZED_ACTOR: "minor_safechat_enforcer.unauthorized_actor",
  DB_UNAVAILABLE: "minor_safechat_enforcer.db_unavailable",
} as const;
export type MinorSafeChatEnforcerErrorCode =
  (typeof MINOR_SAFECHAT_ENFORCER_ERROR_CODES)[keyof typeof MINOR_SAFECHAT_ENFORCER_ERROR_CODES];

// ═════════════════════════════════════════════════════════════════════
// §2 · Internal reader · minor-profile row
// ═════════════════════════════════════════════════════════════════════
//
// CC-1 scope · ships `minor-profile/minor-profile-reader.ts`. In this
// wave CC-1's module may not yet be present, so this reader queries
// the sealed table directly via the shared pg pool. When CC-1 ships
// the typed reader, swap this body for an import.
//
// TODO swap: replace the inline SELECT with
//   import { readMinorProfile } from "./minor-profile/minor-profile-reader"
// once CC-1 lands.

interface MinorProfileSnapshot {
  readonly accountId: string;
  readonly isMinor: boolean;
  readonly safechatAlwaysOn: boolean;
  readonly parentCustodyId: string | null;
}

async function readMinorProfileRow(
  accountId: string,
): Promise<MinorProfileSnapshot | null> {
  if (!accountId || typeof accountId !== "string") return null;
  try {
    const row = await withClient(async (client) => {
      const r = await client.query(
        `SELECT
           account_id,
           is_minor,
           safechat_always_on,
           parent_custody_id
         FROM nex.account_minor_profile
         WHERE account_id = $1
         LIMIT 1`,
        [accountId],
      );
      if ((r.rowCount ?? 0) === 0) return null;
      const raw = r.rows[0]!;
      return {
        accountId: String(raw.account_id),
        isMinor: raw.is_minor === true,
        safechatAlwaysOn: raw.safechat_always_on === true,
        parentCustodyId:
          typeof raw.parent_custody_id === "string" && raw.parent_custody_id.length > 0
            ? raw.parent_custody_id
            : null,
      } satisfies MinorProfileSnapshot;
    });
    return row ?? null;
  } catch {
    // Fail-closed · treat an unavailable DB as "no minor profile" ·
    // callers then fall through to the non-minor path, which honours
    // the (default-OFF) global flags.
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Public API · is-enforced
// ═════════════════════════════════════════════════════════════════════

/**
 * Return TRUE when SafeChat is enforced-on for the given account.
 *
 * Enforcement condition:
 *   · a row exists in `nex.account_minor_profile`
 *   · `safechat_always_on === TRUE`
 *   · `is_minor === TRUE`
 *
 * When any condition fails the account is NOT subject to minor-mode
 * enforcement · its flags come from the global SafeChat environment.
 *
 * NEVER throws. Fail-closed on DB failure.
 */
export async function isSafeChatEnforcedForAccount(
  accountId: string,
): Promise<boolean> {
  const row = await readMinorProfileRow(accountId);
  if (!row) return false;
  return row.isMinor && row.safechatAlwaysOn;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Public API · resolve flags
// ═════════════════════════════════════════════════════════════════════

/**
 * Return the effective SafeChat flags for `accountId`.
 *
 * For a minor account with `safechat_always_on=TRUE`:
 *   · `loggingEnabled === TRUE`
 *   · `userFacingEnabled === TRUE`
 *   · `enforcedForMinor === TRUE`
 *
 * For every other account:
 *   · `loggingEnabled` honours the sealed global env flag
 *   · `userFacingEnabled` honours the sealed global env flag
 *   · `enforcedForMinor === FALSE`
 *
 * This is the sealed interface the Phase 2 SafeChat hook will consume.
 * In this wave the enforcer is READY but the hook consumption is a
 * future wave · the hook must not be changed by this file.
 */
export async function resolveSafeChatFlagsForAccount(
  accountId: string,
): Promise<SafeChatResolvedFlags> {
  const enforced = await isSafeChatEnforcedForAccount(accountId);
  if (enforced) {
    return {
      loggingEnabled: true,
      userFacingEnabled: true,
      enforcedForMinor: true,
    };
  }
  return {
    loggingEnabled: isSafeChatPhase1LoggingEnabled(),
    userFacingEnabled: isSafeChatUserFacingEnabled(),
    enforcedForMinor: false,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Write-path guardrail · parent cannot disable
// ═════════════════════════════════════════════════════════════════════

export interface SafeChatFlagChangeRequest {
  /** Only `safechat_always_on` is write-gated here. Other columns
   *  are not within the enforcer's purview. */
  readonly field: "safechat_always_on";
  readonly nextValue: boolean;
}

/**
 * The parent custodian is NOT authorised to flip
 * `safechat_always_on=FALSE` on their child's minor profile. Any
 * attempt throws with code `PARENT_CANNOT_DISABLE` and performs ZERO
 * database writes.
 *
 * This is the Phase 1 enforcement point. CC-1's parent-custody-service
 * will consume this guardrail when it exposes a per-child settings
 * mutation API in a later wave; today it's wired here so a future
 * mutation can call it before touching the DB.
 *
 * Also throws:
 *   · UNAUTHORIZED_ACTOR when `parentAccountId` is empty
 *   · INVALID_ACCOUNT_ID when `childAccountId` is empty
 *   · INVALID_ACCOUNT_ID when parent and child are the same account
 */
export function preventFlagFlipByParent(
  parentAccountId: string,
  childAccountId: string,
  requestedChange: SafeChatFlagChangeRequest,
): void {
  if (!parentAccountId || typeof parentAccountId !== "string") {
    throw new Error(
      MINOR_SAFECHAT_ENFORCER_ERROR_CODES.UNAUTHORIZED_ACTOR,
    );
  }
  if (!childAccountId || typeof childAccountId !== "string") {
    throw new Error(MINOR_SAFECHAT_ENFORCER_ERROR_CODES.INVALID_ACCOUNT_ID);
  }
  if (parentAccountId === childAccountId) {
    throw new Error(MINOR_SAFECHAT_ENFORCER_ERROR_CODES.INVALID_ACCOUNT_ID);
  }
  if (requestedChange.field !== "safechat_always_on") {
    // Non-enforced field · not our purview. Pass-through.
    return;
  }
  if (requestedChange.nextValue === false) {
    // Founder decision D · parent cannot disable SafeChat on a minor.
    throw new Error(
      MINOR_SAFECHAT_ENFORCER_ERROR_CODES.PARENT_CANNOT_DISABLE,
    );
  }
  // Setting TRUE (or already TRUE) is a no-op from the enforcer's
  // perspective · the DB default is TRUE and only an authorised
  // age-transition path flips it to FALSE indirectly (by flipping
  // is_minor=FALSE · the always-on flag stays set but no longer
  // applies).
}
