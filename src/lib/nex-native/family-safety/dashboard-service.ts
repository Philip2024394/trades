// src/lib/nex-native/family-safety/dashboard-service.ts
//
// NEX Family Safety · Phase 1 · parent-dashboard access gate.
//
// Server-only. Every PUBLIC read enforces the guardianship invariant
// server-side BEFORE touching any child-adjacent data, and ALWAYS
// writes a row to nex.family_safety_dashboard_access_log (migration
// 201) regardless of outcome.
//
// Load-bearing privacy doctrine (sealed with migration 201):
//   · The parent dashboard is NOT a back door · it NEVER queries raw
//     message bodies, ciphertext, plaintext, rule_matches, signals, or
//     any child-content column. Grep-anchor test enforces this.
//   · The three per-link permission flags (can_see_safety_summaries,
//     can_see_location_when_shared) default FALSE. Phase 1 does NOT
//     expose a path to flip them. Readers here therefore treat them
//     as FALSE in effect.
//   · 403 for not-guardian · NEVER 404. 404 would leak existence of
//     the child account via the dashboard URL.
//   · Error paths MUST NOT include account ids, message content, or
//     permission values · callers receive a sealed enum reason only.
//   · Revoked links return 'denied_revoked' and write the attempt
//     to the audit log. The guardian cannot see data on a revoked
//     link EVEN WITHIN a one-second race window after revocation ·
//     each read re-queries family_link.state.

import "server-only";

import { withClient } from "@/lib/nex/db";
import { isGuardianOf } from "../family-links/family-role-reader";
import { getLinkById, listLinksForGuardian } from "../family-links/family-link-service";
import type { FamilyLinkRow } from "../family-links/types";

// ═════════════════════════════════════════════════════════════════════
// §1 · Sealed outcome enum
// ═════════════════════════════════════════════════════════════════════

export const DASHBOARD_OUTCOMES = [
  "granted",
  "denied_not_guardian",
  "denied_revoked",
  "denied_flag_off",
  "denied_other",
] as const;
export type DashboardOutcome = (typeof DASHBOARD_OUTCOMES)[number];

export const DASHBOARD_SURFACES = [
  "dashboard_root",
  "child_dashboard",
  "child_contacts",
  "child_safechat",
  "safechat_status",
  "privacy_page",
] as const;
export type DashboardSurface = (typeof DASHBOARD_SURFACES)[number];

// Fail-closed reasons returned to callers · must NOT include account ids
// or any content detail. Callers map these to generic user copy.
export const DASHBOARD_DENIAL_REASONS = {
  NOT_GUARDIAN: "family_safety_dashboard.not_guardian",
  LINK_REVOKED: "family_safety_dashboard.link_revoked",
  FLAG_OFF: "family_safety_dashboard.flag_off",
  DB_UNAVAILABLE: "family_safety_dashboard.db_unavailable",
  INVALID_INPUT: "family_safety_dashboard.invalid_input",
} as const;
export type DashboardDenialReason =
  (typeof DASHBOARD_DENIAL_REASONS)[keyof typeof DASHBOARD_DENIAL_REASONS];

export interface DashboardGateResult {
  readonly ok: boolean;
  readonly outcome: DashboardOutcome;
  readonly reason: DashboardDenialReason | null;
  readonly link: FamilyLinkRow | null;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Audit log writer (fire-and-safe-swallow)
// ═════════════════════════════════════════════════════════════════════

interface LogArgs {
  readonly viewerAccountId: string;
  readonly viewedChildAccountId: string | null;
  readonly surface: DashboardSurface;
  readonly outcome: DashboardOutcome;
}

/** Internal · writes one row to nex.family_safety_dashboard_access_log.
 *  Never throws · a logging failure must not deny access the caller
 *  already earned (and must not grant access the caller already lost).
 *  Returns true when the row was written, false when the pool was
 *  unavailable or an error swallowed. */
export async function logDashboardAccess(args: LogArgs): Promise<boolean> {
  if (!args.viewerAccountId || typeof args.viewerAccountId !== "string") {
    return false;
  }
  // Normalise null · empty string is NOT equivalent to null for the
  // DB CHECK (viewed_child_account_id is text NULL · must be true NULL
  // when absent).
  const child =
    args.viewedChildAccountId && args.viewedChildAccountId.length > 0
      ? args.viewedChildAccountId
      : null;
  try {
    const written = await withClient(async (client) => {
      await client.query(
        `INSERT INTO nex.family_safety_dashboard_access_log (
           viewer_account_id,
           viewed_child_account_id,
           surface_name,
           outcome,
           simulated
         ) VALUES ($1, $2, $3, $4, TRUE)`,
        [args.viewerAccountId, child, args.surface, args.outcome],
      );
      return true;
    });
    return written === true;
  } catch {
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Per-child dashboard gate
// ═════════════════════════════════════════════════════════════════════

export interface ChildDashboardGateArgs {
  readonly viewerAccountId: string;
  readonly childAccountId: string;
  readonly surface: DashboardSurface;
}

/**
 * Resolve "is `viewer` authorised to see the dashboard for `child`
 * right now?". Server-authoritative. Writes an audit log row with
 * the outcome. On deny, the returned `reason` is a sealed enum ·
 * callers map to generic user copy and MUST NOT echo the enum back
 * to the client without translation.
 *
 * Precedence (deliberate):
 *   1. invalid input → denied_other / INVALID_INPUT
 *   2. not an active guardian link → denied_not_guardian / NOT_GUARDIAN
 *   3. link exists but is in state 'revoked' or 'expired' → denied_revoked
 *      (this can happen in a race where isGuardianOf saw an active row
 *       and a parallel revoke flipped it between the two queries · we
 *       always re-fetch the specific link below to close that window)
 *   4. granted · the link + role are returned
 */
export async function resolveChildDashboardAccess(
  args: ChildDashboardGateArgs,
): Promise<DashboardGateResult> {
  if (
    !args.viewerAccountId ||
    typeof args.viewerAccountId !== "string" ||
    !args.childAccountId ||
    typeof args.childAccountId !== "string" ||
    !(DASHBOARD_SURFACES as readonly string[]).includes(args.surface)
  ) {
    await logDashboardAccess({
      viewerAccountId: args.viewerAccountId ?? "",
      viewedChildAccountId: args.childAccountId ?? null,
      surface: (DASHBOARD_SURFACES as readonly string[]).includes(args.surface)
        ? args.surface
        : "dashboard_root",
      outcome: "denied_other",
    });
    return {
      ok: false,
      outcome: "denied_other",
      reason: DASHBOARD_DENIAL_REASONS.INVALID_INPUT,
      link: null,
    };
  }

  if (args.viewerAccountId === args.childAccountId) {
    // A guardian cannot be their own child · treat as not-guardian
    // and log loudly.
    await logDashboardAccess({
      viewerAccountId: args.viewerAccountId,
      viewedChildAccountId: args.childAccountId,
      surface: args.surface,
      outcome: "denied_not_guardian",
    });
    return {
      ok: false,
      outcome: "denied_not_guardian",
      reason: DASHBOARD_DENIAL_REASONS.NOT_GUARDIAN,
      link: null,
    };
  }

  const g = await isGuardianOf({
    guardianAccountId: args.viewerAccountId,
    childAccountId: args.childAccountId,
  });

  if (!g.isGuardian || !g.linkId) {
    await logDashboardAccess({
      viewerAccountId: args.viewerAccountId,
      viewedChildAccountId: args.childAccountId,
      surface: args.surface,
      outcome: "denied_not_guardian",
    });
    return {
      ok: false,
      outcome: "denied_not_guardian",
      reason: DASHBOARD_DENIAL_REASONS.NOT_GUARDIAN,
      link: null,
    };
  }

  // Re-fetch the specific link to close the race window between the
  // isGuardianOf check and this read. If a parallel revoke flipped
  // state in between, we must deny HERE and log 'denied_revoked'.
  const link = await getLinkById(g.linkId);
  if (!link) {
    await logDashboardAccess({
      viewerAccountId: args.viewerAccountId,
      viewedChildAccountId: args.childAccountId,
      surface: args.surface,
      outcome: "denied_revoked",
    });
    return {
      ok: false,
      outcome: "denied_revoked",
      reason: DASHBOARD_DENIAL_REASONS.LINK_REVOKED,
      link: null,
    };
  }

  if (link.state !== "active") {
    await logDashboardAccess({
      viewerAccountId: args.viewerAccountId,
      viewedChildAccountId: args.childAccountId,
      surface: args.surface,
      outcome: "denied_revoked",
    });
    return {
      ok: false,
      outcome: "denied_revoked",
      reason: DASHBOARD_DENIAL_REASONS.LINK_REVOKED,
      link: null,
    };
  }

  // Cross-check · the fetched link's actors must still match the
  // viewer+child pair. Defends against row-id substitution via the
  // guardian role reader returning a stale link id.
  if (
    link.guardianAccountId !== args.viewerAccountId ||
    link.childAccountId !== args.childAccountId
  ) {
    await logDashboardAccess({
      viewerAccountId: args.viewerAccountId,
      viewedChildAccountId: args.childAccountId,
      surface: args.surface,
      outcome: "denied_not_guardian",
    });
    return {
      ok: false,
      outcome: "denied_not_guardian",
      reason: DASHBOARD_DENIAL_REASONS.NOT_GUARDIAN,
      link: null,
    };
  }

  await logDashboardAccess({
    viewerAccountId: args.viewerAccountId,
    viewedChildAccountId: args.childAccountId,
    surface: args.surface,
    outcome: "granted",
  });
  return {
    ok: true,
    outcome: "granted",
    reason: null,
    link,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Permission-flag gate (default-closed)
// ═════════════════════════════════════════════════════════════════════

export type PermissionFlagToken =
  | "can_see_safety_summaries"
  | "can_see_location_when_shared";

export interface PermissionFlagGateArgs {
  readonly viewerAccountId: string;
  readonly childAccountId: string;
  readonly flag: PermissionFlagToken;
  readonly surface: DashboardSurface;
}

/**
 * Resolve "may `viewer` see the data protected by `flag` on `child`'s
 * link right now?". In Phase 1 both flags default FALSE · this
 * function therefore returns `denied_flag_off` unconditionally for
 * the two Phase-1 default-FALSE flags, even for an active guardian.
 *
 * This is NOT a bug · it is the sealed privacy ceiling. The caller
 * MUST render the honest "not available in this phase" page.
 */
export async function resolvePermissionFlag(
  args: PermissionFlagGateArgs,
): Promise<DashboardGateResult> {
  const base = await resolveChildDashboardAccess({
    viewerAccountId: args.viewerAccountId,
    childAccountId: args.childAccountId,
    surface: args.surface,
  });
  if (!base.ok || !base.link) return base;

  // Default-closed · Phase 1 has no flip path. If the flag is FALSE
  // on the row, deny and log. If the flag is TRUE (which Phase 1
  // service layer prohibits writing), we STILL deny with FLAG_OFF
  // because higher layers (SafeChat summaries, location sharing) are
  // not wired to Phase 1 regardless of the DB value.
  const flagValue =
    args.flag === "can_see_safety_summaries"
      ? base.link.canSeeSafetySummaries
      : base.link.canSeeLocationWhenShared;

  if (!flagValue) {
    // Rewrite the audit log entry outcome to 'denied_flag_off' so the
    // specific denial reason is visible to future audits. We write a
    // SECOND row (append-only) rather than mutate the existing one.
    await logDashboardAccess({
      viewerAccountId: args.viewerAccountId,
      viewedChildAccountId: args.childAccountId,
      surface: args.surface,
      outcome: "denied_flag_off",
    });
    return {
      ok: false,
      outcome: "denied_flag_off",
      reason: DASHBOARD_DENIAL_REASONS.FLAG_OFF,
      link: null,
    };
  }

  // Phase 1 ceiling: even if some future wave flipped the flag, the
  // underlying surfaces are not wired. Return flag_off until the wave
  // that wires them lands with its own authorisation.
  await logDashboardAccess({
    viewerAccountId: args.viewerAccountId,
    viewedChildAccountId: args.childAccountId,
    surface: args.surface,
    outcome: "denied_flag_off",
  });
  return {
    ok: false,
    outcome: "denied_flag_off",
    reason: DASHBOARD_DENIAL_REASONS.FLAG_OFF,
    link: null,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Dashboard root list (all linked children)
// ═════════════════════════════════════════════════════════════════════

export interface DashboardChildEntry {
  readonly childAccountId: string;
  readonly linkId: string;
  readonly role: FamilyLinkRow["role"];
  readonly state: FamilyLinkRow["state"];
  readonly initiatedAt: string;
  readonly confirmedAt: string | null;
  readonly revokedAt: string | null;
}

export interface DashboardRootResult {
  readonly viewerAccountId: string;
  readonly entries: readonly DashboardChildEntry[];
  readonly simulatedPhase1: true;
}

/**
 * List the children (and pending/active/revoked links) visible on the
 * guardian's dashboard. ALWAYS writes a `dashboard_root` audit row.
 *
 * Scope ceiling · each entry is RELATIONSHIP STRUCTURE only · no
 * display name, no DOB, no handle, no content. Downstream rendering
 * joins account display names via account-service · THIS service
 * refuses to leak them because its only job is the gate.
 */
export async function listDashboardEntriesForGuardian(
  viewerAccountId: string,
): Promise<DashboardRootResult> {
  if (!viewerAccountId || typeof viewerAccountId !== "string") {
    await logDashboardAccess({
      viewerAccountId: viewerAccountId ?? "",
      viewedChildAccountId: null,
      surface: "dashboard_root",
      outcome: "denied_other",
    });
    return {
      viewerAccountId: viewerAccountId ?? "",
      entries: [],
      simulatedPhase1: true,
    };
  }

  const rows = await listLinksForGuardian(viewerAccountId);
  const entries: DashboardChildEntry[] = rows.map((r) => ({
    childAccountId: r.childAccountId,
    linkId: r.linkId,
    role: r.role,
    state: r.state,
    initiatedAt: r.initiatedAt,
    confirmedAt: r.confirmedAt,
    revokedAt: r.revokedAt,
  }));

  await logDashboardAccess({
    viewerAccountId,
    viewedChildAccountId: null,
    surface: "dashboard_root",
    outcome: "granted",
  });

  return {
    viewerAccountId,
    entries,
    simulatedPhase1: true,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Custody-based child list (CC-3 · dashboard always-active)
// ═════════════════════════════════════════════════════════════════════
//
// Founder decision F (2026-10-10): the dashboard is always active and
// surfaces the REAL children in the parent's custody. The sealed
// `parent-custody-service` from CC-1 ships `listCustodiesForParent` ·
// in this wave the typed service may not yet be present, so we read
// `nex.parent_custody_link` directly. All prior privacy invariants
// are preserved: SELECT-only · no raw message content · relationship
// structure only · audit row on every outcome.
//
// TODO swap: replace the inline SELECT with
//   import { listCustodiesForParent } from "./custody/parent-custody-service"
// once CC-1 lands.

export interface DashboardCustodyEntry {
  readonly custodyId: string;
  readonly parentAccountId: string;
  readonly childAccountId: string;
  readonly linkType: "created_minor" | "transferred_at_16" | "manual_grant";
  readonly autoTransferAt: string | null;
  readonly transferredAt: string | null;
  readonly revokedAt: string | null;
  readonly simulated: boolean;
  readonly createdAt: string;
}

export interface DashboardCustodyRootResult {
  readonly viewerAccountId: string;
  readonly entries: readonly DashboardCustodyEntry[];
  readonly simulatedPhase1: true;
}

/**
 * List the ACTIVE custody rows for the parent viewer (both children
 * created inside the Family Safety flow and any manual grants).
 *
 * Active definition for this reader: `transferred_at IS NULL AND
 * revoked_at IS NULL`. Transferred and revoked custodies are omitted
 * so a 16-year-old who completed their transition no longer appears
 * on the parent's dashboard (invariant #14).
 *
 * Writes a `dashboard_root` audit row with outcome `granted` on
 * success · `denied_other` when the viewer id is invalid. NEVER
 * reads child content.
 */
export async function listActiveCustodiesForParent(
  viewerAccountId: string,
): Promise<DashboardCustodyRootResult> {
  if (!viewerAccountId || typeof viewerAccountId !== "string") {
    await logDashboardAccess({
      viewerAccountId: viewerAccountId ?? "",
      viewedChildAccountId: null,
      surface: "dashboard_root",
      outcome: "denied_other",
    });
    return {
      viewerAccountId: viewerAccountId ?? "",
      entries: [],
      simulatedPhase1: true,
    };
  }

  const rows = await withClient(async (client) => {
    const r = await client.query(
      `SELECT
         custody_id,
         parent_account_id,
         child_account_id,
         link_type,
         auto_transfer_at,
         transferred_at,
         revoked_at,
         simulated,
         created_at
       FROM nex.parent_custody_link
       WHERE parent_account_id = $1
         AND transferred_at IS NULL
         AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [viewerAccountId],
    );
    return r.rows;
  });

  const entries: DashboardCustodyEntry[] = (rows ?? []).map((raw) => ({
    custodyId: String(raw.custody_id),
    parentAccountId: String(raw.parent_account_id),
    childAccountId: String(raw.child_account_id),
    linkType: String(raw.link_type) as DashboardCustodyEntry["linkType"],
    autoTransferAt:
      raw.auto_transfer_at == null ? null : String(raw.auto_transfer_at),
    transferredAt:
      raw.transferred_at == null ? null : String(raw.transferred_at),
    revokedAt: raw.revoked_at == null ? null : String(raw.revoked_at),
    simulated: raw.simulated === true,
    createdAt: String(raw.created_at),
  }));

  await logDashboardAccess({
    viewerAccountId,
    viewedChildAccountId: null,
    surface: "dashboard_root",
    outcome: "granted",
  });

  return {
    viewerAccountId,
    entries,
    simulatedPhase1: true,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Per-custody gate (CC-3 · child detail page)
// ═════════════════════════════════════════════════════════════════════

export interface CustodyGateResult {
  readonly ok: boolean;
  readonly outcome: DashboardOutcome;
  readonly reason: DashboardDenialReason | null;
  readonly custody: DashboardCustodyEntry | null;
}

/**
 * Resolve "is `viewer` the parent custodian of this custody row right
 * now?". Server-authoritative. Writes a `child_dashboard` audit row.
 *
 * Deny posture:
 *   · custody not found · denied_not_guardian + NOT_GUARDIAN
 *     (deliberate · we never 404 or echo existence)
 *   · parent on the row does not match viewer · denied_not_guardian
 *   · custody transferred or revoked · denied_revoked
 *
 * On grant, returns the SELECTed row (relationship structure only).
 */
export async function resolveParentCustodyAccess(args: {
  readonly viewerAccountId: string;
  readonly custodyId: string;
}): Promise<CustodyGateResult> {
  if (
    !args.viewerAccountId ||
    typeof args.viewerAccountId !== "string" ||
    !args.custodyId ||
    typeof args.custodyId !== "string"
  ) {
    await logDashboardAccess({
      viewerAccountId: args.viewerAccountId ?? "",
      viewedChildAccountId: null,
      surface: "child_dashboard",
      outcome: "denied_other",
    });
    return {
      ok: false,
      outcome: "denied_other",
      reason: DASHBOARD_DENIAL_REASONS.INVALID_INPUT,
      custody: null,
    };
  }

  const row = await withClient(async (client) => {
    const r = await client.query(
      `SELECT
         custody_id,
         parent_account_id,
         child_account_id,
         link_type,
         auto_transfer_at,
         transferred_at,
         revoked_at,
         simulated,
         created_at
       FROM nex.parent_custody_link
       WHERE custody_id = $1
       LIMIT 1`,
      [args.custodyId],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    return r.rows[0]!;
  });

  if (!row) {
    await logDashboardAccess({
      viewerAccountId: args.viewerAccountId,
      viewedChildAccountId: null,
      surface: "child_dashboard",
      outcome: "denied_not_guardian",
    });
    return {
      ok: false,
      outcome: "denied_not_guardian",
      reason: DASHBOARD_DENIAL_REASONS.NOT_GUARDIAN,
      custody: null,
    };
  }

  if (String(row.parent_account_id) !== args.viewerAccountId) {
    await logDashboardAccess({
      viewerAccountId: args.viewerAccountId,
      viewedChildAccountId: null,
      surface: "child_dashboard",
      outcome: "denied_not_guardian",
    });
    return {
      ok: false,
      outcome: "denied_not_guardian",
      reason: DASHBOARD_DENIAL_REASONS.NOT_GUARDIAN,
      custody: null,
    };
  }

  if (row.transferred_at != null || row.revoked_at != null) {
    await logDashboardAccess({
      viewerAccountId: args.viewerAccountId,
      viewedChildAccountId: String(row.child_account_id),
      surface: "child_dashboard",
      outcome: "denied_revoked",
    });
    return {
      ok: false,
      outcome: "denied_revoked",
      reason: DASHBOARD_DENIAL_REASONS.LINK_REVOKED,
      custody: null,
    };
  }

  const custody: DashboardCustodyEntry = {
    custodyId: String(row.custody_id),
    parentAccountId: String(row.parent_account_id),
    childAccountId: String(row.child_account_id),
    linkType: String(row.link_type) as DashboardCustodyEntry["linkType"],
    autoTransferAt:
      row.auto_transfer_at == null ? null : String(row.auto_transfer_at),
    transferredAt:
      row.transferred_at == null ? null : String(row.transferred_at),
    revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
    simulated: row.simulated === true,
    createdAt: String(row.created_at),
  };

  await logDashboardAccess({
    viewerAccountId: args.viewerAccountId,
    viewedChildAccountId: custody.childAccountId,
    surface: "child_dashboard",
    outcome: "granted",
  });

  return {
    ok: true,
    outcome: "granted",
    reason: null,
    custody,
  };
}
