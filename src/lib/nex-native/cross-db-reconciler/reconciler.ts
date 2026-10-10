// src/lib/nex-native/cross-db-reconciler/reconciler.ts
//
// NEX Directory · Cross-DB Reconciler · gated service.
//
// WHAT THIS MODULE IS
//   The service that, once activated by the operator, syncs the
//   NEX-side canonical ownership state into the Supabase soft
//   reference (public.nex_business.canonical_business_id).
//
// WHAT THIS MODULE IS NOT
//   · Not a Supabase client. The real Supabase client is loaded via
//     dynamic import so the module compiles + tests pass even if
//     `@supabase/supabase-js` is uninstalled. If the import fails at
//     call time the reconciler returns `supabase_error` and logs the
//     failure via the audit log; it NEVER crashes the caller.
//   · Not a scheduler. Each invocation is one attempt. Retries are
//     the caller's responsibility (see §Retries below). The attempt
//     counter in the audit log is passed in; the service does NOT
//     persist a retry queue.
//
// SAFETY POSTURE (DEFAULT OFF)
//   isReconcilerEnabled()        false by default · master kill switch
//   isReconcilerSimulateOnly()   true  by default · simulation gate
//
//   With defaults the reconciler returns `feature_disabled` on the
//   first line. Nothing is logged. No Supabase client is loaded.
//
//   With master=on + simulate-only=on the reconciler writes a
//   simulated audit row and returns `simulation_only`. The Supabase
//   client is NEVER instantiated.
//
//   With master=on + simulate-only=off the reconciler imports the
//   Supabase client (dynamic import) and performs the UPDATE/INSERT
//   described in the operator runbook §5.3.
//
// IDEMPOTENCY
//   Each attempt deterministically computes
//     idempotency_key = sha256(claimId + ':' + canonicalId + ':' + accountId)
//     truncated to the first 64 hex chars.
//   The audit log table UNIQUE (idempotency_key, attempt_number)
//   constraint prevents double-insert. A duplicate recordReconcileEvent
//   call for the same key + attempt resolves to ON CONFLICT DO NOTHING
//   and the log service returns alreadyRecorded=true.
//
// RETRIES
//   On `supabase_error`, the result carries `retryAfterMs` so the
//   caller can schedule a retry. Exponential backoff: 1s, 5s, 25s.
//   After attempt 3 the caller SHOULD stop; the weekly orphan sweep
//   will catch persistent failures.

import "server-only";
import { createHash } from "node:crypto";
import {
  recordReconcileEvent,
  RECORD_UNAVAILABLE_SENTINEL,
} from "./log-service";
import {
  isReconcilerEnabled,
  isReconcilerSimulateOnly,
} from "./feature-flag";
import type { ReconcileArgs, ReconcileResult } from "./types";

// ═════════════════════════════════════════════════════════════════════
// §1 · Public API
// ═════════════════════════════════════════════════════════════════════

/**
 * Attempt one cross-DB reconcile for a verified claim.
 *
 * Decision tree:
 *   1. feature flag off           → feature_disabled (no log row)
 *   2. simulate-only on           → simulation_only (one simulated log row)
 *   3. Supabase client unavailable→ supabase_error  (one log row)
 *   4. UPDATE affected 1 row      → linked_existing (one log row)
 *   5. UPDATE affected >1 row     → ambiguous_multiple_profiles (one log row)
 *   6. UPDATE affected 0 rows + INSERT ok → stubbed_new (one log row)
 *   7. INSERT raised 23505        → ambiguous_multiple_profiles (one log row)
 *   8. Any other error            → supabase_error (one log row)
 */
export async function reconcileVerifiedClaim(
  args: ReconcileArgs,
  opts: ReconcileOptions = {},
): Promise<ReconcileResult> {
  // Gate 1: master kill switch.
  if (!isReconcilerEnabled()) {
    return { ok: false, outcome: "feature_disabled", logId: null };
  }

  const attemptNumber = opts.attemptNumber ?? 1;
  const idempotencyKey = computeIdempotencyKey(args);

  // Gate 2: simulate-only.
  if (isReconcilerSimulateOnly()) {
    const sim = await recordReconcileEvent({
      eventType: "link_attempted",
      claimId: args.claimId,
      canonicalBusinessId: args.canonicalBusinessId,
      supabaseAccountId: args.supabaseAccountId,
      idempotencyKey,
      attemptNumber,
      simulated: true,
    });
    return { ok: false, outcome: "simulation_only", logId: sim.logId };
  }

  // Live path: resolve the Supabase client via dynamic import.
  const client = await resolveSupabaseClient(opts);
  if (!client) {
    const logged = await recordReconcileEvent({
      eventType: "link_failed",
      claimId: args.claimId,
      canonicalBusinessId: args.canonicalBusinessId,
      supabaseAccountId: args.supabaseAccountId,
      idempotencyKey,
      attemptNumber,
      simulated: false,
      errorCode: "client_unavailable",
      errorDetail: "supabase client could not be constructed · check deps + env",
    });
    return {
      ok: false,
      outcome: "supabase_error",
      logId: logged.logId,
      errorCode: "client_unavailable",
      retryAfterMs: backoffMs(attemptNumber),
    };
  }

  // Live path: attempt the UPDATE first.
  try {
    const updateResult = await client.updateExistingLink({
      canonicalBusinessId: args.canonicalBusinessId,
      supabaseAccountId: args.supabaseAccountId,
    });

    if (updateResult.rowCount === 1) {
      const logged = await recordReconcileEvent({
        eventType: "link_updated_existing",
        claimId: args.claimId,
        canonicalBusinessId: args.canonicalBusinessId,
        supabaseAccountId: args.supabaseAccountId,
        idempotencyKey,
        attemptNumber,
        simulated: false,
        affectedRows: 1,
      });
      return {
        ok: true,
        outcome: "linked_existing",
        logId: logged.logId,
        affectedRows: 1,
      };
    }

    if (updateResult.rowCount > 1) {
      const logged = await recordReconcileEvent({
        eventType: "link_ambiguous",
        claimId: args.claimId,
        canonicalBusinessId: args.canonicalBusinessId,
        supabaseAccountId: args.supabaseAccountId,
        idempotencyKey,
        attemptNumber,
        simulated: false,
        affectedRows: updateResult.rowCount,
        errorCode: "ambiguous_multiple_profiles",
        errorDetail: `owner has ${updateResult.rowCount} nex_business rows · operator triage required`,
      });
      return {
        ok: false,
        outcome: "ambiguous_multiple_profiles",
        logId: logged.logId,
        affectedRows: updateResult.rowCount,
      };
    }

    // UPDATE affected 0 rows → attempt the INSERT fallback.
    const insertResult = await client.insertStubLink({
      canonicalBusinessId: args.canonicalBusinessId,
      supabaseAccountId: args.supabaseAccountId,
    });

    if (insertResult.rowCount === 1) {
      const logged = await recordReconcileEvent({
        eventType: "link_created_stub",
        claimId: args.claimId,
        canonicalBusinessId: args.canonicalBusinessId,
        supabaseAccountId: args.supabaseAccountId,
        idempotencyKey,
        attemptNumber,
        simulated: false,
        affectedRows: 1,
      });
      return {
        ok: true,
        outcome: "stubbed_new",
        logId: logged.logId,
        affectedRows: 1,
      };
    }

    // Fallback failed with 0 rows affected (should be impossible on
    // success · treat as supabase_error).
    const logged = await recordReconcileEvent({
      eventType: "link_failed",
      claimId: args.claimId,
      canonicalBusinessId: args.canonicalBusinessId,
      supabaseAccountId: args.supabaseAccountId,
      idempotencyKey,
      attemptNumber,
      simulated: false,
      affectedRows: 0,
      errorCode: "insert_zero_rows",
      errorDetail: "INSERT reported 0 affected rows · unexpected",
    });
    return {
      ok: false,
      outcome: "supabase_error",
      logId: logged.logId,
      errorCode: "insert_zero_rows",
      retryAfterMs: backoffMs(attemptNumber),
    };
  } catch (err) {
    // 23505 (unique_violation) collapses to the ambiguous bucket; the
    // runbook §5.3 calls this out explicitly.
    const errCode = (err as { code?: string } | null)?.code ?? "";
    const errMsg = err instanceof Error ? err.message : String(err);
    const sanitised = sanitiseError(errMsg).slice(0, 2000);

    if (errCode === "23505") {
      const logged = await recordReconcileEvent({
        eventType: "link_ambiguous",
        claimId: args.claimId,
        canonicalBusinessId: args.canonicalBusinessId,
        supabaseAccountId: args.supabaseAccountId,
        idempotencyKey,
        attemptNumber,
        simulated: false,
        errorCode: "unique_violation",
        errorDetail: sanitised,
      });
      return {
        ok: false,
        outcome: "ambiguous_multiple_profiles",
        logId: logged.logId,
        affectedRows: 0,
      };
    }

    const logged = await recordReconcileEvent({
      eventType: "link_failed",
      claimId: args.claimId,
      canonicalBusinessId: args.canonicalBusinessId,
      supabaseAccountId: args.supabaseAccountId,
      idempotencyKey,
      attemptNumber,
      simulated: false,
      errorCode: errCode || "unknown",
      errorDetail: sanitised,
    });
    return {
      ok: false,
      outcome: "supabase_error",
      logId: logged.logId,
      errorCode: errCode || "unknown",
      retryAfterMs: backoffMs(attemptNumber),
    };
  }
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Options + injection
// ═════════════════════════════════════════════════════════════════════

/**
 * Internal Supabase client contract. The dynamic import adapter maps
 * `@supabase/supabase-js` onto this interface. Tests inject a mock
 * that implements the two methods directly.
 */
export interface ReconcilerSupabaseClient {
  updateExistingLink(args: {
    canonicalBusinessId: string;
    supabaseAccountId: string;
  }): Promise<{ rowCount: number }>;
  insertStubLink(args: {
    canonicalBusinessId: string;
    supabaseAccountId: string;
  }): Promise<{ rowCount: number }>;
}

export interface ReconcileOptions {
  readonly attemptNumber?: number;
  /**
   * Dependency injection seam. Production code leaves this undefined;
   * the service then attempts a dynamic import of @supabase/supabase-js.
   * Tests inject a mock client here.
   */
  readonly clientFactory?: () => Promise<ReconcilerSupabaseClient | null>;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Internal helpers
// ═════════════════════════════════════════════════════════════════════

/** sha256(claimId + ':' + canonicalId + ':' + accountId) · first 64 hex chars. */
export function computeIdempotencyKey(args: ReconcileArgs): string {
  const payload = `${args.claimId}:${args.canonicalBusinessId}:${args.supabaseAccountId}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 64);
}

/** Exponential backoff: 1s, 5s, 25s · caps at attempt 3. */
export function backoffMs(attemptNumber: number): number {
  const n = Math.max(1, Math.min(attemptNumber, 3));
  return 1000 * Math.pow(5, n - 1);
}

async function resolveSupabaseClient(
  opts: ReconcileOptions,
): Promise<ReconcilerSupabaseClient | null> {
  if (opts.clientFactory) {
    try {
      return await opts.clientFactory();
    } catch {
      return null;
    }
  }
  // Dynamic import so the module compiles even if the pkg is absent.
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("@supabase/supabase-js");
    const createClient = mod?.createClient ?? mod?.default?.createClient;
    if (typeof createClient !== "function") return null;

    const sb = createClient(url, key, { auth: { persistSession: false } });

    return {
      async updateExistingLink({ canonicalBusinessId, supabaseAccountId }) {
        const { data, error } = await sb
          .from("nex_business")
          .update({ canonical_business_id: canonicalBusinessId })
          .eq("owner_account_id", supabaseAccountId)
          .is("canonical_business_id", null)
          .select("id");
        if (error) {
          const e = new Error(error.message);
          (e as unknown as { code?: string }).code = error.code ?? "";
          throw e;
        }
        return { rowCount: Array.isArray(data) ? data.length : 0 };
      },
      async insertStubLink({ canonicalBusinessId, supabaseAccountId }) {
        const { data, error } = await sb
          .from("nex_business")
          .insert({
            owner_account_id: supabaseAccountId,
            canonical_business_id: canonicalBusinessId,
            status: "claim_pending",
          })
          .select("id");
        if (error) {
          const e = new Error(error.message);
          (e as unknown as { code?: string }).code = error.code ?? "";
          throw e;
        }
        return { rowCount: Array.isArray(data) ? data.length : 0 };
      },
    };
  } catch {
    return null;
  }
}

/**
 * Credential-safe redactor for error strings · mirrors the sealed
 * `sanitiseError` helper in directory-service.ts. Local copy avoids
 * a cross-module import for an identity-only utility.
 */
function sanitiseError(message: string): string {
  let out = message;
  out = out.replace(
    /postgres(?:ql)?:\/\/[^:]*:[^@]*@[^\s'"]+/gi,
    "postgres://[redacted]",
  );
  out = out.replace(/password\s*=\s*['"][^'"]*['"]/gi, "password=[redacted]");
  out = out.replace(/password\s*=\s*\S+/gi, "password=[redacted]");
  // JWT-shaped tokens.
  out = out.replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, "[redacted-jwt]");
  return out;
}

// Export for tests · never consumed by production callers.
export { RECORD_UNAVAILABLE_SENTINEL };
