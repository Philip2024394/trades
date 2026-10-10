// src/lib/nex-native/family-links/family-role-reader.ts
//
// NEX Family Links · Phase 1 · READ-ONLY family-role resolver.
//
// Server-only. Thin pg wrapper around nex.family_link (migration 198).
// Other sealed layers consume these helpers to answer:
//
//   · "is X a guardian of Y right now?"
//   · "who are Y's guardians?"
//   · "who are X's wards?"
//   · "what is the kind of relationship from viewer → target?"
//
// Doctrine:
//   · READ-ONLY · NEVER writes to the database
//   · Returns the LEAST-INFORMATION-POSSIBLE shape · the parent-doctrine
//     default: give consumers only what they strictly need. No child
//     name, no DOB, no counts beyond the lookup target.
//   · Pool-unavailable degrades to "no relationship" rather than
//     throwing · consumers must still be safe to call this during
//     dev-offline.

import "server-only";

import { withClient } from "@/lib/nex/db";
import type { PgClientLike } from "@/lib/nex/db";
import {
  isFamilyRole,
  type FamilyRelationshipKind,
  type FamilyRole,
  type GuardianLookupResult,
} from "./types";

// ═════════════════════════════════════════════════════════════════════
// §1 · isGuardianOf
// ═════════════════════════════════════════════════════════════════════

export interface IsGuardianOfArgs {
  readonly guardianAccountId: string;
  readonly childAccountId: string;
}

/**
 * Resolve the strict "actor is an active guardian of target" question.
 * Returns the active link id + role when found (role in
 * guardian_primary|guardian_secondary · trusted_adult / mentor roles
 * do NOT count as guardians at the Phase 1 primitive level).
 */
export async function isGuardianOf(
  args: IsGuardianOfArgs,
): Promise<GuardianLookupResult> {
  if (!args.guardianAccountId || !args.childAccountId) {
    return { isGuardian: false, role: null, linkId: null };
  }
  if (args.guardianAccountId === args.childAccountId) {
    return { isGuardian: false, role: null, linkId: null };
  }

  const result = await withClient(async (client) => {
    const res = await client.query(
      `SELECT link_id, role
         FROM nex.family_link
        WHERE guardian_account_id = $1
          AND child_account_id    = $2
          AND state               = 'active'
          AND role                IN ('guardian_primary','guardian_secondary')
        ORDER BY CASE role
                   WHEN 'guardian_primary'   THEN 0
                   WHEN 'guardian_secondary' THEN 1
                   ELSE 2
                 END
        LIMIT 1`,
      [args.guardianAccountId, args.childAccountId],
    );
    if (res.rowCount !== 1 || !res.rows[0]) {
      return null;
    }
    const row = res.rows[0];
    const role = String(row.role ?? "");
    if (!isFamilyRole(role)) return null;
    return { linkId: String(row.link_id), role };
  });

  if (!result) return { isGuardian: false, role: null, linkId: null };
  return { isGuardian: true, role: result.role, linkId: result.linkId };
}

// ═════════════════════════════════════════════════════════════════════
// §2 · listGuardianAccountIdsFor
// ═════════════════════════════════════════════════════════════════════

/** Return the account ids of ACTIVE guardians (primary|secondary) for
 *  this child. Trusted adults and mentors are NOT included — the
 *  Phase 1 primitive layer treats only primary/secondary as guardians. */
export async function listGuardianAccountIdsFor(
  childAccountId: string,
): Promise<readonly string[]> {
  if (!childAccountId) return [];
  const rows = await withClient(async (client) => {
    const res = await client.query(
      `SELECT guardian_account_id
         FROM nex.family_link
        WHERE child_account_id = $1
          AND state            = 'active'
          AND role             IN ('guardian_primary','guardian_secondary')
        ORDER BY CASE role
                   WHEN 'guardian_primary'   THEN 0
                   WHEN 'guardian_secondary' THEN 1
                   ELSE 2
                 END,
                 initiated_at ASC`,
      [childAccountId],
    );
    return res.rows;
  });
  if (!rows) return [];
  return rows.map((r) => String(r.guardian_account_id));
}

// ═════════════════════════════════════════════════════════════════════
// §3 · listChildAccountIdsFor
// ═════════════════════════════════════════════════════════════════════

/** Return the account ids of ACTIVE wards for this guardian · guardian
 *  roles only. */
export async function listChildAccountIdsFor(
  guardianAccountId: string,
): Promise<readonly string[]> {
  if (!guardianAccountId) return [];
  const rows = await withClient(async (client) => {
    const res = await client.query(
      `SELECT child_account_id
         FROM nex.family_link
        WHERE guardian_account_id = $1
          AND state               = 'active'
          AND role                IN ('guardian_primary','guardian_secondary')
        ORDER BY initiated_at ASC`,
      [guardianAccountId],
    );
    return res.rows;
  });
  if (!rows) return [];
  return rows.map((r) => String(r.child_account_id));
}

// ═════════════════════════════════════════════════════════════════════
// §4 · resolveFamilyRelationshipKind
// ═════════════════════════════════════════════════════════════════════

export interface ResolveRelationshipArgs {
  readonly viewerAccountId: string;
  readonly targetAccountId: string;
}

/**
 * Classify the viewer → target relationship using ONLY active rows.
 *
 * Precedence · higher wins:
 *   1. self
 *   2. guardian_of_target
 *   3. child_of_target
 *   4. trusted_adult_of_target
 *   5. no_relationship
 *
 * Returns no_relationship when:
 *   · either id is empty
 *   · no active row ties the pair
 *   · pool unavailable
 */
export async function resolveFamilyRelationshipKind(
  args: ResolveRelationshipArgs,
): Promise<FamilyRelationshipKind> {
  if (!args.viewerAccountId || !args.targetAccountId) return "no_relationship";
  if (args.viewerAccountId === args.targetAccountId) return "self";

  const kind = await withClient(async (client) => {
    return await resolveKindInternal(
      client,
      args.viewerAccountId,
      args.targetAccountId,
    );
  });
  if (!kind) return "no_relationship";
  return kind;
}

async function resolveKindInternal(
  client: PgClientLike,
  viewerAccountId: string,
  targetAccountId: string,
): Promise<FamilyRelationshipKind | null> {
  // 1 · viewer is guardian of target (primary|secondary)
  const asGuardian = await client.query(
    `SELECT 1 FROM nex.family_link
       WHERE guardian_account_id = $1
         AND child_account_id    = $2
         AND state               = 'active'
         AND role                IN ('guardian_primary','guardian_secondary')
       LIMIT 1`,
    [viewerAccountId, targetAccountId],
  );
  if ((asGuardian.rowCount ?? 0) > 0) return "guardian_of_target";

  // 2 · viewer is child of target (viewer is child, target is guardian)
  const asChild = await client.query(
    `SELECT 1 FROM nex.family_link
       WHERE child_account_id    = $1
         AND guardian_account_id = $2
         AND state               = 'active'
         AND role                IN ('guardian_primary','guardian_secondary')
       LIMIT 1`,
    [viewerAccountId, targetAccountId],
  );
  if ((asChild.rowCount ?? 0) > 0) return "child_of_target";

  // 3 · viewer is a trusted adult of target
  const asTrusted = await client.query(
    `SELECT 1 FROM nex.family_link
       WHERE guardian_account_id = $1
         AND child_account_id    = $2
         AND state               = 'active'
         AND role                = 'trusted_adult'
       LIMIT 1`,
    [viewerAccountId, targetAccountId],
  );
  if ((asTrusted.rowCount ?? 0) > 0) return "trusted_adult_of_target";

  return "no_relationship";
}
