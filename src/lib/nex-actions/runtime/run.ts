// NEX Actions · runtime orchestrator · F1 contracts only (2026-08-25).
//
// Every NexAction — reaction, weather, grenade, whatever — enters through
// runNexAction(). This function is the SINGLE choke point for permissions,
// rate limits, wallet, execution, and audit. No caller in the app may call a
// handler directly. If it does, PR is rejected.
//
// F1 scope: contracts and stubs. Every gate/write throws NotImplemented so
// nothing accidentally runs. Real implementations arrive in F2 (wallet),
// F3 (message-delete API), F4 (location), F5 (tools).

import { getAction } from "../registry";
import type {
  NexAction,
  NexActionContext,
  NexActionError,
  NexActionHandler,
  NexActionResult,
} from "../types";

// ── Runtime dependency contracts ──────────────────────────────────────
// The real implementations plug in via a light DI object so tests can
// substitute fakes. F1 exports the interface only.

export interface NexRuntimeDeps {
  permissions: {
    /** Throws NexActionError if the user lacks a capability the action declares. */
    require: (action: NexAction, ctx: NexActionContext) => Promise<void>;
  };
  rateLimit: {
    /** Throws { code: "rate-limited" } if the user has exceeded limits. */
    require: (action: NexAction, ctx: NexActionContext) => Promise<void>;
  };
  wallet: {
    /** Returns the user's Sparks balance. */
    balance: (userId: string) => Promise<number>;
    /** Throws { code: "insufficient-sparks" } if balance < required. Does NOT decrement. */
    require: (action: NexAction, ctx: NexActionContext) => Promise<void>;
    /** Decrements Sparks after a successful handler. Idempotent by requestId. */
    commit: (action: NexAction, ctx: NexActionContext) => Promise<void>;
    /** No-op if the action didn't consume Sparks; refund if handler failed after commit. */
    refund: (action: NexAction, ctx: NexActionContext) => Promise<void>;
  };
  audit: {
    write: (
      action: NexAction,
      ctx: NexActionContext,
      result: NexActionResult,
    ) => Promise<void>;
  };
  handlers: {
    /** Returns the handler registered under `handlerKey`, or undefined. */
    resolve: (handlerKey: string) => NexActionHandler | undefined;
  };
}

// ── The orchestrator ──────────────────────────────────────────────────
// F1: contract only. F3 will wire real deps. Tests get a fake deps object.
export async function runNexAction(
  actionId: string,
  ctx: NexActionContext,
  deps: NexRuntimeDeps,
): Promise<NexActionResult> {
  const action = getAction(actionId);
  if (!action) return fail({ code: "handler-not-found", handlerKey: actionId });

  try {
    await deps.permissions.require(action, ctx);
    await deps.rateLimit.require(action, ctx);
    if (action.tier === "consumable") await deps.wallet.require(action, ctx);
  } catch (e) {
    const err = coerceError(e);
    // No wallet commit · no handler execute · audit the reject.
    await deps.audit.write(action, ctx, fail(err));
    return fail(err);
  }

  const handler = deps.handlers.resolve(action.handlerKey);
  if (!handler) {
    const err: NexActionError = { code: "handler-not-found", handlerKey: action.handlerKey };
    await deps.audit.write(action, ctx, fail(err));
    return fail(err);
  }

  // Execute. Handler must NOT touch wallet / rate limit / audit itself.
  let result: NexActionResult;
  try {
    result = await handler.execute(ctx, action.handlerParams);
  } catch (e) {
    const err: NexActionError = { code: "handler-failed", message: describe(e) };
    result = fail(err);
  }

  // Wallet commit / refund based on outcome. Idempotent by ctx.invokedAt+userId.
  if (action.tier === "consumable") {
    if (result.ok) await deps.wallet.commit(action, ctx);
    else await deps.wallet.refund(action, ctx);
  }

  await deps.audit.write(action, ctx, result);
  return result;
}

// ── helpers ─────────────────────────────────────────────────────────────
function fail(error: NexActionError): NexActionResult {
  return { ok: false, error };
}
function coerceError(e: unknown): NexActionError {
  if (e && typeof e === "object" && "code" in (e as Record<string, unknown>)) {
    return e as NexActionError;
  }
  return { code: "handler-failed", message: describe(e) };
}
function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}
