// src/lib/nex-native/cross-db-reconciler/types.ts
//
// NEX Directory · Cross-DB Reconciler · public types.
//
// Shared across:
//   · log-service.ts   (writes to nex.cross_db_reconcile_log)
//   · reconciler.ts    (the gated service that WOULD call Supabase)
//   · feature-flag.ts  (reads env, defaults OFF + simulate-only)
//
// These types are consumed by server code only. The reconciler module
// imports "server-only"; types.ts has no runtime side-effects so it is
// safe to re-export from either direction.

// ─────────────────────────────────────────────────────────────────────
// Audit event vocabulary · sealed to the 9 CHECKed values in
// migration 191. Keep in exact lock-step with ck_cdrl_event_type.
// ─────────────────────────────────────────────────────────────────────

export const RECONCILE_EVENT_TYPES = [
  "link_attempted",
  "link_succeeded",
  "link_updated_existing",
  "link_created_stub",
  "link_ambiguous",
  "link_failed",
  "retry_scheduled",
  "orphan_detected",
  "sweep_run",
] as const;

export type ReconcileEventType = (typeof RECONCILE_EVENT_TYPES)[number];

export function isReconcileEventType(v: unknown): v is ReconcileEventType {
  return (
    typeof v === "string" &&
    (RECONCILE_EVENT_TYPES as readonly string[]).includes(v)
  );
}

// ─────────────────────────────────────────────────────────────────────
// Audit log row shape · mirrors the SELECT projection of
// nex.cross_db_reconcile_log. Shape is Pg-driver-friendly: timestamps
// come back as JS Date, booleans as boolean, uuids as string.
// ─────────────────────────────────────────────────────────────────────

export interface ReconcileLogEntry {
  readonly logId: string;
  readonly eventType: ReconcileEventType;
  readonly claimId: string | null;
  readonly canonicalBusinessId: string | null;
  readonly supabaseAccountId: string | null;
  readonly affectedRows: number | null;
  readonly errorCode: string | null;
  readonly errorDetail: string | null;
  readonly idempotencyKey: string;
  readonly simulated: boolean;
  readonly attemptNumber: number;
  readonly createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────
// recordReconcileEvent argument shape.
// ─────────────────────────────────────────────────────────────────────

export interface RecordReconcileEventArgs {
  readonly eventType: ReconcileEventType;
  readonly claimId?: string | null;
  readonly canonicalBusinessId?: string | null;
  readonly supabaseAccountId?: string | null;
  readonly affectedRows?: number | null;
  readonly errorCode?: string | null;
  readonly errorDetail?: string | null;
  readonly idempotencyKey: string;
  readonly attemptNumber?: number;
  readonly simulated?: boolean;
}

export interface RecordReconcileEventResult {
  readonly logId: string;
  readonly alreadyRecorded: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Reconciler decision tree · ReconcileResult discriminated union.
// Each outcome maps to one or more rows in nex.cross_db_reconcile_log.
//
// ok=true   → the reconciler made (or simulated) progress; a row
//              exists in the audit log for the attempt.
// ok=false  → the reconciler aborted; see outcome for the reason.
//              Some ok=false outcomes DO still write a log row
//              (simulation_only, ambiguous_multiple_profiles,
//              supabase_error) because they represent a measurable
//              state; feature_disabled writes nothing.
// ─────────────────────────────────────────────────────────────────────

export type ReconcileResult =
  | {
      readonly ok: true;
      readonly outcome: "linked_existing";
      readonly logId: string;
      readonly affectedRows: 1;
    }
  | {
      readonly ok: true;
      readonly outcome: "stubbed_new";
      readonly logId: string;
      readonly affectedRows: 1;
    }
  | {
      readonly ok: false;
      readonly outcome: "ambiguous_multiple_profiles";
      readonly logId: string;
      readonly affectedRows: number;
    }
  | {
      readonly ok: false;
      readonly outcome: "feature_disabled";
      readonly logId: null;
    }
  | {
      readonly ok: false;
      readonly outcome: "simulation_only";
      readonly logId: string;
    }
  | {
      readonly ok: false;
      readonly outcome: "supabase_error";
      readonly logId: string;
      readonly errorCode: string;
      readonly retryAfterMs: number;
    };

export interface ReconcileArgs {
  readonly claimId: string;
  readonly canonicalBusinessId: string;
  readonly supabaseAccountId: string;
}
