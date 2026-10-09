// scripts/nex-canonical/admin-promote-lifecycle.ts
//
// NEX Canonical · Admin lifecycle promotion runner.
//
// SEALED CLAIM:
//   Promotes ONE canonical row from `DISCOVERED` to `VERIFIED` via an
//   admin-attested transition. Writes to both:
//     · nex.business_canonical    — UPDATE lifecycle_state + updated_at
//     · nex.business_canonical_lifecycle_log — INSERT audit row
//   in a single DB transaction. Either both succeed or neither does.
//
// SCOPE:
//   One row at a time, admin-selected, with a non-blank admin identifier.
//   NOT a bulk promoter. NOT a resolver. NOT a replacement for the sealed
//   canonical-handoff write path · the input canonical ALREADY EXISTS
//   (from an earlier approved resolver pass).
//
// SAFETY:
//   · Pure logic (`planAdminPromotion`) is testable without a DB.
//   · The runner wraps the SQL execution in BEGIN / COMMIT.
//   · Refuses to promote when:
//       - canonical_business_id is blank
//       - admin_id is blank
//       - current lifecycle_state is not in the sealed CLAIMABLE set
//       - current lifecycle_state is already the target state
//   · All inputs validated BEFORE the transaction opens.
//   · Statement timeout 10s.
//
// REQUIRED MIGRATIONS APPLIED BEFORE USE:
//   · 167 · nex.business_canonical
//   · 168 · nex.business_canonical_lifecycle_log (THIS RUNNER WRITES TO IT)
//
// WHAT THIS RUNNER IS NOT:
//   · Not a lifecycle_state autopromoter · operator decision per invocation.
//   · Not a publication-gate opener · the view still enforces D-1 + D-2 + D-5.
//   · Not a Rule-5m-gated action · Rule 5m gates the BULK legacy backfill
//     (migration 169); single-row admin promotion on an EXISTING canonical
//     uses the sealed canonical-handoff invariants, not Rule 5m.

import { Client } from "pg";

// ═════════════════════════════════════════════════════════════════════
// §1 · Public types + sealed value sets
// ═════════════════════════════════════════════════════════════════════

export const SEALED_LIFECYCLE_STATES = [
  "DISCOVERED",
  "ENRICHED",
  "VERIFIED",
  "OWNER_CLAIMED",
  "OWNER_VERIFIED",
  "DORMANT",
  "SUPERSEDED",
] as const;
export type LifecycleState = typeof SEALED_LIFECYCLE_STATES[number];

/** Lifecycle states that admin may promote FROM. */
export const PROMOTABLE_FROM: readonly LifecycleState[] = [
  "DISCOVERED",
  "ENRICHED",
] as const;

/** Lifecycle states that admin may promote TO. OWNER_CLAIMED is
 *  excluded · that transition requires a verified business_claim, not
 *  admin attestation. */
export const PROMOTABLE_TO: readonly LifecycleState[] = [
  "VERIFIED",
  "OWNER_VERIFIED",
  "DORMANT",
] as const;

export const SEALED_TRANSITION_REASONS = [
  "admin_verify",
  "owner_verify",
  "dormancy",
] as const;
export type TransitionReason =
  typeof SEALED_TRANSITION_REASONS[number];

// ═════════════════════════════════════════════════════════════════════
// §2 · Pure planner
// ═════════════════════════════════════════════════════════════════════

export interface PromotePlanInput {
  readonly canonical_business_id: string;
  readonly current_lifecycle_state: LifecycleState;
  readonly target_lifecycle_state: LifecycleState;
  readonly admin_id: string;
  readonly transition_reason: TransitionReason;
  readonly now: Date;
  /** Optional pointer to an attesting evidence row. Not required · admin
   *  attestation is itself the evidence for this transition. */
  readonly attesting_evidence_id?: string;
  /** Optional attached decision_record hash (64-char lowercase hex). */
  readonly decision_record_id?: string;
}

export interface PromotionPlan {
  readonly update_canonical: {
    readonly canonical_business_id: string;
    readonly to_lifecycle_state: LifecycleState;
    readonly updated_at: Date;
  };
  readonly insert_lifecycle_log: {
    readonly canonical_business_id: string;
    readonly from_state: LifecycleState;
    readonly to_state: LifecycleState;
    readonly transition_reason: TransitionReason;
    readonly transitioned_by: string;
    readonly transitioned_at: Date;
    readonly attesting_evidence_id: string | null;
    readonly decision_record_id: string | null;
  };
}

export type PromotionResult =
  | { readonly ok: true; readonly plan: PromotionPlan }
  | {
      readonly ok: false;
      readonly reason:
        | "blank_canonical_business_id"
        | "blank_admin_id"
        | "unknown_current_state"
        | "unknown_target_state"
        | "unknown_transition_reason"
        | "not_promotable_from"
        | "not_promotable_to"
        | "same_state_noop"
        | "invalid_decision_record_fmt";
    };

const HASH_RE = /^[a-f0-9]{64}$/;

export function planAdminPromotion(
  input: PromotePlanInput,
): PromotionResult {
  if (input.canonical_business_id.trim().length === 0) {
    return { ok: false, reason: "blank_canonical_business_id" };
  }
  if (input.admin_id.trim().length === 0) {
    return { ok: false, reason: "blank_admin_id" };
  }
  if (!(SEALED_LIFECYCLE_STATES as readonly string[]).includes(input.current_lifecycle_state)) {
    return { ok: false, reason: "unknown_current_state" };
  }
  if (!(SEALED_LIFECYCLE_STATES as readonly string[]).includes(input.target_lifecycle_state)) {
    return { ok: false, reason: "unknown_target_state" };
  }
  if (!(SEALED_TRANSITION_REASONS as readonly string[]).includes(input.transition_reason)) {
    return { ok: false, reason: "unknown_transition_reason" };
  }
  if (input.current_lifecycle_state === input.target_lifecycle_state) {
    return { ok: false, reason: "same_state_noop" };
  }
  if (!PROMOTABLE_FROM.includes(input.current_lifecycle_state)) {
    return { ok: false, reason: "not_promotable_from" };
  }
  if (!PROMOTABLE_TO.includes(input.target_lifecycle_state)) {
    return { ok: false, reason: "not_promotable_to" };
  }
  if (
    input.decision_record_id !== undefined &&
    !HASH_RE.test(input.decision_record_id)
  ) {
    return { ok: false, reason: "invalid_decision_record_fmt" };
  }

  return {
    ok: true,
    plan: {
      update_canonical: {
        canonical_business_id: input.canonical_business_id,
        to_lifecycle_state: input.target_lifecycle_state,
        updated_at: input.now,
      },
      insert_lifecycle_log: {
        canonical_business_id: input.canonical_business_id,
        from_state: input.current_lifecycle_state,
        to_state: input.target_lifecycle_state,
        transition_reason: input.transition_reason,
        transitioned_by: `admin:${input.admin_id}`,
        transitioned_at: input.now,
        attesting_evidence_id: input.attesting_evidence_id ?? null,
        decision_record_id: input.decision_record_id ?? null,
      },
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Executor · wraps the plan in a transaction
// ═════════════════════════════════════════════════════════════════════

export interface ExecutePromotionArgs {
  readonly plan: PromotionPlan;
  readonly connectionString: string;
  readonly statementTimeoutMs?: number;
}

export interface ExecutePromotionOutcome {
  readonly ok: boolean;
  readonly updated_canonical_rows: number;
  readonly inserted_log_rows: number;
  readonly error?: string;
}

export async function executeAdminPromotion(
  args: ExecutePromotionArgs,
): Promise<ExecutePromotionOutcome> {
  const client = new Client({ connectionString: args.connectionString });
  const timeoutMs = args.statementTimeoutMs ?? 10_000;
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = '${timeoutMs}ms'`);

    const upd = await client.query(
      `UPDATE nex.business_canonical
         SET lifecycle_state = $1,
             updated_at = $2,
             last_verified_at = CASE WHEN $1 IN ('VERIFIED','OWNER_VERIFIED')
                                     THEN $2 ELSE last_verified_at END
       WHERE canonical_business_id = $3
         AND lifecycle_state IN ('DISCOVERED','ENRICHED')
       RETURNING canonical_business_id`,
      [
        args.plan.update_canonical.to_lifecycle_state,
        args.plan.update_canonical.updated_at.toISOString(),
        args.plan.update_canonical.canonical_business_id,
      ],
    );

    if (upd.rowCount !== 1) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        updated_canonical_rows: upd.rowCount ?? 0,
        inserted_log_rows: 0,
        error:
          "expected exactly 1 row to be promoted · precondition failed " +
          "(canonical not found OR not in DISCOVERED/ENRICHED state)",
      };
    }

    const ins = await client.query(
      `INSERT INTO nex.business_canonical_lifecycle_log
         (canonical_business_id, from_state, to_state, transition_reason,
          transitioned_by, transitioned_at,
          attesting_evidence_id, decision_record_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING log_id`,
      [
        args.plan.insert_lifecycle_log.canonical_business_id,
        args.plan.insert_lifecycle_log.from_state,
        args.plan.insert_lifecycle_log.to_state,
        args.plan.insert_lifecycle_log.transition_reason,
        args.plan.insert_lifecycle_log.transitioned_by,
        args.plan.insert_lifecycle_log.transitioned_at.toISOString(),
        args.plan.insert_lifecycle_log.attesting_evidence_id,
        args.plan.insert_lifecycle_log.decision_record_id,
      ],
    );

    if (ins.rowCount !== 1) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        updated_canonical_rows: upd.rowCount,
        inserted_log_rows: ins.rowCount ?? 0,
        error: "lifecycle log insert failed · transaction rolled back",
      };
    }

    await client.query("COMMIT");
    return {
      ok: true,
      updated_canonical_rows: upd.rowCount,
      inserted_log_rows: ins.rowCount,
    };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    return {
      ok: false,
      updated_canonical_rows: 0,
      inserted_log_rows: 0,
      error: (e instanceof Error ? e.message : String(e)).replace(
        args.connectionString,
        "<redacted>",
      ),
    };
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

// ═════════════════════════════════════════════════════════════════════
// §4 · CLI entry
// ═════════════════════════════════════════════════════════════════════
//
// Operator usage:
//   NEX_POSTGRES_URL=postgresql://... npx tsx \
//     scripts/nex-canonical/admin-promote-lifecycle.ts \
//       --canonical-id <uuid> --to VERIFIED --admin <handle> --reason admin_verify
//
// Prerequisites (operator confirms before running):
//   · Migration 168 applied (business_canonical_lifecycle_log table exists)
//   · The target canonical currently has lifecycle_state=DISCOVERED
//   · The admin handle is non-blank

export interface CliArgs {
  readonly canonicalId: string;
  readonly to: LifecycleState;
  readonly admin: string;
  readonly reason: TransitionReason;
}

export function parseCliArgs(argv: readonly string[]): CliArgs {
  let canonicalId = "";
  let to: LifecycleState = "VERIFIED";
  let admin = "";
  let reason: TransitionReason = "admin_verify";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--canonical-id") canonicalId = argv[++i] ?? "";
    else if (argv[i] === "--to") to = (argv[++i] ?? "") as LifecycleState;
    else if (argv[i] === "--admin") admin = argv[++i] ?? "";
    else if (argv[i] === "--reason") reason = (argv[++i] ?? "") as TransitionReason;
  }
  return { canonicalId, to, admin, reason };
}
