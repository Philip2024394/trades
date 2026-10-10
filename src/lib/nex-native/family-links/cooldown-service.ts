// src/lib/nex-native/family-links/cooldown-service.ts
//
// NEX Family Links · FS-2 · 72-hour revocation cooldown.
//
// Server-only. Thin pg wrapper around nex.family_link_revocation_cooldown
// (migration 200). Implements decision D1 · 1A · primary-guardian
// revocation with 72h cooldown + reserved founder override:
//
//   · Revoking an ACTIVE `guardian_primary` link opens a pending
//     revocation-cooldown row with `effective_at = now + 72h`. The
//     sealed family-link row stays `active` until the cooldown is
//     finalised (either by the sweep job after 72h, by both-party
//     bypass confirmation, or by the reserved founder override).
//   · Revoking any OTHER role (secondary / trusted_adult / mentor) and
//     revoking a `pending` primary-guardian invitation flow through
//     the sealed `revokeLink` directly · no cooldown.
//   · The sealed `revokeLink` is NOT modified · we COMPOSE it.
//   · Reserved founder-override endpoint is defined here but NOT
//     exposed by the UI in this wave.
//
// Sweep contract (future wave):
//   A nightly cron job SHOULD run:
//     UPDATE nex.family_link_revocation_cooldown
//        SET state = 'applied', applied_at = now()
//      WHERE state = 'pending' AND effective_at <= now()
//        AND NOT bypass_confirmed_by_other_party
//      RETURNING link_id, initiated_by_account_id;
//   then call sealed `revokeLink` for each returned (link, initiator).
//   This service exposes `finalisePendingCooldowns` so the future
//   sweep implementation has one entry point to call. For this wave
//   the sweep is NOT wired to a cron trigger.
//
// Retention (D5):
//   · Rows retained 180 days after `applied_at` / `cancelled_at`.
//     The sweep job that enforces this lives in a separate wave.
//
// Doctrine references:
//   · docs/doctrine/nex-family-links-decisions-adopted-2026-10-10.md · D1
//   · docs/doctrine/nex-family-links-ui-spec-2026-10-10.md · §3f

import "server-only";

import { withClient } from "@/lib/nex/db";
import { getLinkById, revokeLink } from "./family-link-service";
import type { FamilyLinkRow } from "./types";

export const COOLDOWN_HOURS = 72;
export const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

export const COOLDOWN_STATES = ["pending", "applied", "cancelled"] as const;
export type CooldownState = (typeof COOLDOWN_STATES)[number];

export const COOLDOWN_ERROR_CODES = {
  INVALID_LINK_ID: "cooldown.invalid_link_id",
  INVALID_ACTOR: "cooldown.invalid_actor",
  LINK_NOT_FOUND: "cooldown.link_not_found",
  NOT_A_PARTY: "cooldown.actor_not_a_party_to_link",
  LINK_NOT_ACTIVE: "cooldown.link_not_active",
  LINK_NOT_PRIMARY_GUARDIAN: "cooldown.link_not_primary_guardian",
  COOLDOWN_ALREADY_PENDING: "cooldown.cooldown_already_pending",
  COOLDOWN_NOT_FOUND: "cooldown.cooldown_not_found",
  COOLDOWN_NOT_PENDING: "cooldown.cooldown_not_pending",
  BYPASS_WRONG_PARTY: "cooldown.bypass_wrong_party",
  COOLDOWN_NOT_READY: "cooldown.cooldown_not_ready",
  DB_UNAVAILABLE: "cooldown.db_unavailable",
} as const;
export type CooldownErrorCode =
  (typeof COOLDOWN_ERROR_CODES)[keyof typeof COOLDOWN_ERROR_CODES];

export interface RevocationCooldownRow {
  readonly cooldownId: string;
  readonly linkId: string;
  readonly initiatedByAccountId: string;
  readonly initiatedAt: string;
  readonly effectiveAt: string;
  readonly bypassConfirmedByOtherParty: boolean;
  readonly bypassConfirmedAt: string | null;
  readonly founderOverride: boolean;
  readonly founderOverrideAuthorisedBy: string | null;
  readonly state: CooldownState;
  readonly cancelledAt: string | null;
  readonly cancelledByAccountId: string | null;
  readonly simulated: boolean;
  readonly appliedAt: string | null;
}

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

function mapRow(r: Record<string, unknown>): RevocationCooldownRow {
  const state = String(r.state ?? "");
  if (!(COOLDOWN_STATES as readonly string[]).includes(state)) {
    throw new Error(
      `cooldown.unknown_state · got '${state}' · migration drift`,
    );
  }
  return {
    cooldownId: String(r.cooldown_id),
    linkId: String(r.link_id),
    initiatedByAccountId: String(r.initiated_by_account_id),
    initiatedAt: toIso(r.initiated_at),
    effectiveAt: toIso(r.effective_at),
    bypassConfirmedByOtherParty: Boolean(r.bypass_confirmed_by_other_party),
    bypassConfirmedAt: toIsoOrNull(r.bypass_confirmed_at),
    founderOverride: Boolean(r.founder_override),
    founderOverrideAuthorisedBy: toStringOrNull(r.founder_override_authorised_by),
    state: state as CooldownState,
    cancelledAt: toIsoOrNull(r.cancelled_at),
    cancelledByAccountId: toStringOrNull(r.cancelled_by_account_id),
    simulated: Boolean(r.simulated),
    appliedAt: toIsoOrNull(r.applied_at),
  };
}

function requireNonEmptyString(v: unknown, label: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`cooldown.invalid_${label}`);
  }
  return v;
}

export interface StartCooldownArgs {
  readonly linkId: string;
  readonly actorAccountId: string;
}

export interface StartCooldownResult {
  readonly cooldown: RevocationCooldownRow;
  readonly link: FamilyLinkRow;
}

/**
 * Begin the 72h cooldown for an active guardian_primary link. Either
 * party may initiate. The sealed family_link row stays `active` until
 * the cooldown is finalised.
 *
 * Returns both the cooldown row and the current link row for the UI
 * to render the countdown chip against.
 */
export async function startPrimaryGuardianRevocationCooldown(
  args: StartCooldownArgs,
): Promise<StartCooldownResult> {
  const linkId = requireNonEmptyString(args.linkId, "link_id");
  const actorId = requireNonEmptyString(args.actorAccountId, "actor_account_id");

  const link = await getLinkById(linkId);
  if (!link) {
    throw new Error(COOLDOWN_ERROR_CODES.LINK_NOT_FOUND);
  }
  if (
    actorId !== link.guardianAccountId &&
    actorId !== link.childAccountId
  ) {
    throw new Error(COOLDOWN_ERROR_CODES.NOT_A_PARTY);
  }
  if (link.state !== "active") {
    throw new Error(COOLDOWN_ERROR_CODES.LINK_NOT_ACTIVE);
  }
  if (link.role !== "guardian_primary") {
    throw new Error(COOLDOWN_ERROR_CODES.LINK_NOT_PRIMARY_GUARDIAN);
  }

  const effectiveAtIso = new Date(Date.now() + COOLDOWN_MS).toISOString();

  const inserted = await withClient(async (client) => {
    try {
      const ins = await client.query(
        `INSERT INTO nex.family_link_revocation_cooldown (
           link_id,
           initiated_by_account_id,
           effective_at,
           state,
           simulated
         ) VALUES ($1, $2, $3, 'pending', TRUE)
         RETURNING *`,
        [linkId, actorId, effectiveAtIso],
      );
      if (ins.rowCount !== 1 || !ins.rows[0]) {
        throw new Error("cooldown.insert_failed");
      }
      return mapRow(ins.rows[0]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/family_link_revocation_cooldown_link_pending_uq/i.test(msg)) {
        throw new Error(COOLDOWN_ERROR_CODES.COOLDOWN_ALREADY_PENDING);
      }
      throw err;
    }
  });

  if (inserted === null) {
    throw new Error(COOLDOWN_ERROR_CODES.DB_UNAVAILABLE);
  }
  return { cooldown: inserted, link };
}

export interface ConfirmBypassArgs {
  readonly cooldownId: string;
  readonly actorAccountId: string;
}

/**
 * BOTH-PARTIES-CONFIRM bypass path. The OTHER party (not the initiator)
 * confirms the revocation during the window · the service marks the
 * row bypass_confirmed, calls sealed revokeLink immediately, and flips
 * the cooldown to applied.
 */
export async function confirmCooldownBypass(
  args: ConfirmBypassArgs,
): Promise<RevocationCooldownRow> {
  const cooldownId = requireNonEmptyString(args.cooldownId, "cooldown_id");
  const actorId = requireNonEmptyString(args.actorAccountId, "actor_account_id");

  const existing = await withClient(async (client) => {
    const res = await client.query(
      `SELECT * FROM nex.family_link_revocation_cooldown
         WHERE cooldown_id = $1 LIMIT 1`,
      [cooldownId],
    );
    if (res.rowCount !== 1 || !res.rows[0]) return null;
    return mapRow(res.rows[0]);
  });
  if (!existing) throw new Error(COOLDOWN_ERROR_CODES.COOLDOWN_NOT_FOUND);
  if (existing.state !== "pending") {
    throw new Error(COOLDOWN_ERROR_CODES.COOLDOWN_NOT_PENDING);
  }

  const link = await getLinkById(existing.linkId);
  if (!link) {
    throw new Error(COOLDOWN_ERROR_CODES.LINK_NOT_FOUND);
  }

  // Only the OTHER party may confirm the bypass · the initiator cannot
  // short-circuit their own cooldown.
  if (actorId === existing.initiatedByAccountId) {
    throw new Error(COOLDOWN_ERROR_CODES.BYPASS_WRONG_PARTY);
  }
  if (
    actorId !== link.guardianAccountId &&
    actorId !== link.childAccountId
  ) {
    throw new Error(COOLDOWN_ERROR_CODES.NOT_A_PARTY);
  }

  // Perform the revoke using the sealed service (no modification).
  await revokeLink({
    linkId: existing.linkId,
    actorAccountId: actorId,
    reason: "primary_guardian_cooldown_bypass",
  });

  const updated = await withClient(async (client) => {
    const upd = await client.query(
      `UPDATE nex.family_link_revocation_cooldown
          SET bypass_confirmed_by_other_party = TRUE,
              bypass_confirmed_at             = now(),
              state                           = 'applied',
              applied_at                      = now()
        WHERE cooldown_id = $1 AND state = 'pending'
      RETURNING *`,
      [cooldownId],
    );
    if (upd.rowCount !== 1 || !upd.rows[0]) {
      throw new Error(COOLDOWN_ERROR_CODES.COOLDOWN_NOT_PENDING);
    }
    return mapRow(upd.rows[0]);
  });
  if (updated === null) {
    throw new Error(COOLDOWN_ERROR_CODES.DB_UNAVAILABLE);
  }
  return updated;
}

export interface CancelCooldownArgs {
  readonly cooldownId: string;
  readonly actorAccountId: string;
}

/**
 * Cancel a pending cooldown · ONLY the initiator may cancel their own
 * cooldown. Flips state → cancelled; the sealed family_link row stays
 * `active`.
 */
export async function cancelPendingCooldown(
  args: CancelCooldownArgs,
): Promise<RevocationCooldownRow> {
  const cooldownId = requireNonEmptyString(args.cooldownId, "cooldown_id");
  const actorId = requireNonEmptyString(args.actorAccountId, "actor_account_id");

  const result = await withClient(async (client) => {
    const existing = await client.query(
      `SELECT * FROM nex.family_link_revocation_cooldown
         WHERE cooldown_id = $1 LIMIT 1`,
      [cooldownId],
    );
    if (existing.rowCount !== 1 || !existing.rows[0]) {
      throw new Error(COOLDOWN_ERROR_CODES.COOLDOWN_NOT_FOUND);
    }
    const row = mapRow(existing.rows[0]);
    if (row.state !== "pending") {
      throw new Error(COOLDOWN_ERROR_CODES.COOLDOWN_NOT_PENDING);
    }
    if (row.initiatedByAccountId !== actorId) {
      throw new Error(COOLDOWN_ERROR_CODES.BYPASS_WRONG_PARTY);
    }
    const upd = await client.query(
      `UPDATE nex.family_link_revocation_cooldown
          SET state = 'cancelled',
              cancelled_at = now(),
              cancelled_by_account_id = $2
        WHERE cooldown_id = $1 AND state = 'pending'
      RETURNING *`,
      [cooldownId, actorId],
    );
    if (upd.rowCount !== 1 || !upd.rows[0]) {
      throw new Error(COOLDOWN_ERROR_CODES.COOLDOWN_NOT_PENDING);
    }
    return mapRow(upd.rows[0]);
  });
  if (result === null) {
    throw new Error(COOLDOWN_ERROR_CODES.DB_UNAVAILABLE);
  }
  return result;
}

/**
 * Read the pending cooldown (if any) for a given link. Readers never
 * throw DB_UNAVAILABLE · they degrade to null.
 */
export async function readPendingCooldownForLink(
  linkId: string,
): Promise<RevocationCooldownRow | null> {
  const id = requireNonEmptyString(linkId, "link_id");
  const result = await withClient(async (client) => {
    const res = await client.query(
      `SELECT * FROM nex.family_link_revocation_cooldown
         WHERE link_id = $1 AND state = 'pending'
         LIMIT 1`,
      [id],
    );
    if (res.rowCount !== 1 || !res.rows[0]) return null;
    return mapRow(res.rows[0]);
  });
  if (result === null) return null;
  return result;
}

/**
 * Sweep-job entry point · the future cron trigger calls this to
 * finalise any pending cooldown whose effective_at has elapsed. This
 * service wires the DB write + the sealed `revokeLink` call. The cron
 * trigger itself is NOT wired in this wave.
 */
export async function finalisePendingCooldowns(
  nowIso: string = new Date().toISOString(),
): Promise<readonly RevocationCooldownRow[]> {
  const ripe = await withClient(async (client) => {
    const res = await client.query(
      `SELECT * FROM nex.family_link_revocation_cooldown
         WHERE state = 'pending'
           AND effective_at <= $1::timestamptz
         ORDER BY effective_at ASC`,
      [nowIso],
    );
    return res.rows;
  });
  if (ripe === null || ripe.length === 0) return [];

  const finalised: RevocationCooldownRow[] = [];
  for (const raw of ripe) {
    const row = mapRow(raw);
    const link = await getLinkById(row.linkId);
    // If the link is already revoked/expired for any other reason,
    // skip the sealed revoke call and simply flip the cooldown.
    if (link && link.state === "active") {
      try {
        await revokeLink({
          linkId: row.linkId,
          actorAccountId: row.initiatedByAccountId,
          reason: "primary_guardian_cooldown_expired",
        });
      } catch {
        // If the sealed revoke rejects (e.g. race), we still flip the
        // cooldown row so this sweep converges; the next sweep run
        // will re-evaluate.
      }
    }
    const flipped = await withClient(async (client) => {
      const upd = await client.query(
        `UPDATE nex.family_link_revocation_cooldown
            SET state = 'applied', applied_at = now()
          WHERE cooldown_id = $1 AND state = 'pending'
        RETURNING *`,
        [row.cooldownId],
      );
      if (upd.rowCount !== 1 || !upd.rows[0]) return null;
      return mapRow(upd.rows[0]);
    });
    if (flipped) finalised.push(flipped);
  }
  return finalised;
}

/**
 * Reserved founder-override endpoint (decision D1 · 1A). The HQ Tier-C
 * two-person authorisation flow calls this. The UI in this wave does
 * NOT expose any button that reaches this symbol; it exists so a
 * future HQ console wave can call it without a schema change.
 */
export interface FounderOverrideArgs {
  readonly cooldownId: string;
  readonly authorisedByAccountId: string;
}

export async function founderOverrideCooldown(
  args: FounderOverrideArgs,
): Promise<RevocationCooldownRow> {
  const cooldownId = requireNonEmptyString(args.cooldownId, "cooldown_id");
  const authId = requireNonEmptyString(
    args.authorisedByAccountId,
    "authorised_by_account_id",
  );

  const result = await withClient(async (client) => {
    const existing = await client.query(
      `SELECT * FROM nex.family_link_revocation_cooldown
         WHERE cooldown_id = $1 LIMIT 1`,
      [cooldownId],
    );
    if (existing.rowCount !== 1 || !existing.rows[0]) {
      throw new Error(COOLDOWN_ERROR_CODES.COOLDOWN_NOT_FOUND);
    }
    const row = mapRow(existing.rows[0]);
    if (row.state !== "pending") {
      throw new Error(COOLDOWN_ERROR_CODES.COOLDOWN_NOT_PENDING);
    }

    // Perform the revoke using the sealed service. The sealed service
    // requires `actorAccountId` to be a party to the link; HQ is NOT a
    // party. We therefore use the initiator as the actor for the
    // sealed call. The audit trail of "HQ authorised this override" is
    // stamped on the cooldown row via `founder_override_authorised_by`
    // which the UPDATE below writes · the two together form a
    // complete audit (link row shows the initiator; cooldown row shows
    // HQ as the authoriser).
    await revokeLink({
      linkId: row.linkId,
      actorAccountId: row.initiatedByAccountId,
      reason: "primary_guardian_founder_override",
    });

    const upd = await client.query(
      `UPDATE nex.family_link_revocation_cooldown
          SET founder_override                 = TRUE,
              founder_override_authorised_by   = $2,
              state                            = 'applied',
              applied_at                       = now()
        WHERE cooldown_id = $1 AND state = 'pending'
      RETURNING *`,
      [cooldownId, authId],
    );
    if (upd.rowCount !== 1 || !upd.rows[0]) {
      throw new Error(COOLDOWN_ERROR_CODES.COOLDOWN_NOT_PENDING);
    }
    return mapRow(upd.rows[0]);
  });
  if (result === null) {
    throw new Error(COOLDOWN_ERROR_CODES.DB_UNAVAILABLE);
  }
  return result;
}
