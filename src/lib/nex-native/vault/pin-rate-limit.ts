// src/lib/nex-native/vault/pin-rate-limit.ts
//
// Vault Phase A · Commit A.2 · PIN + recovery attempt rate-limit
// substrate (server-only).
//
// Append-only writes to nex_vault_pin_attempt and
// nex_vault_recovery_attempt (tables sealed in migration 142). Readers
// return whether the caller is within the rolling window the design §H
// locked:
//
//   PIN attempts:
//     · 5 attempts per rolling 15 min per (account, device)
//     · After 5 failures → PIN disabled on that device for 1h
//     · After +5 within 24h → PIN disabled until password + fresh
//       WebAuthn re-auth (A.3 will wire that policy; A.2 exposes the
//       readers it will consult).
//
//   Recovery attempts:
//     · 5 attempts per 1h per account
//     · After 5 → 24h cooldown + email notification (A.5 wires the
//       notification; this file provides the cooldown check).
//
// These guards protect the ONLINE attacker path only. The offline
// attacker (who has stolen the local envelope and derives KEK offline)
// has no server round-trip and is bounded only by PIN entropy +
// Argon2id cost (honest limitation per design §I.2).
//
// Zero commercial code · no `bisnis` / `tier` / `plan` / `subscription`
// / `entitlement` / `quota` / `allowance` references.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexTimestamp, NexUuid } from "../types";

// ---------------------------------------------------------------------------
// Policy locked at Phase A birth
// ---------------------------------------------------------------------------

export const PIN_WINDOW_SECONDS = 15 * 60; // 15 min
export const PIN_MAX_ATTEMPTS_IN_WINDOW = 5;
export const PIN_LOCKOUT_SECONDS = 60 * 60; // 1h after N failures
export const PIN_ESCALATION_WINDOW_SECONDS = 24 * 60 * 60; // 24h scope for second round

export const RECOVERY_WINDOW_SECONDS = 60 * 60; // 1h
export const RECOVERY_MAX_ATTEMPTS_IN_WINDOW = 5;
export const RECOVERY_COOLDOWN_SECONDS = 24 * 60 * 60; // 24h

// ---------------------------------------------------------------------------
// Shared counters
// ---------------------------------------------------------------------------

interface AttemptCounts {
  totalInWindow: number;
  failuresInWindow: number;
  mostRecentFailureAt: Date | null;
  mostRecentSuccessAt: Date | null;
}

function countInWindow(
  rows: Array<{ success: boolean; attempted_at: NexTimestamp }>,
  windowStart: Date,
): AttemptCounts {
  let totalInWindow = 0;
  let failuresInWindow = 0;
  let mostRecentFailureAt: Date | null = null;
  let mostRecentSuccessAt: Date | null = null;
  for (const row of rows) {
    const t = new Date(row.attempted_at);
    if (!Number.isFinite(t.getTime())) continue;
    if (t < windowStart) continue;
    totalInWindow++;
    if (row.success) {
      if (!mostRecentSuccessAt || t > mostRecentSuccessAt) mostRecentSuccessAt = t;
    } else {
      failuresInWindow++;
      if (!mostRecentFailureAt || t > mostRecentFailureAt) mostRecentFailureAt = t;
    }
  }
  return { totalInWindow, failuresInWindow, mostRecentFailureAt, mostRecentSuccessAt };
}

// ---------------------------------------------------------------------------
// PIN · writer + checker
// ---------------------------------------------------------------------------

export async function recordPinAttempt(input: {
  accountId: NexUuid;
  deviceId: string;
  success: boolean;
  at?: Date;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin.from("nex_vault_pin_attempt").insert({
    account_id: input.accountId,
    device_id: input.deviceId,
    success: input.success,
    attempted_at: (input.at ?? new Date()).toISOString(),
  });
  if (error) {
    throw new Error(`vault/pin-rate-limit.recordPinAttempt: ${error.message}`);
  }
}

export interface PinRateVerdict {
  /** Is a NEW PIN attempt allowed right now? */
  allowed: boolean;
  /** Reason the caller should surface in the 429 response · null when allowed. */
  reason:
    | null
    | "window_exceeded"
    | "escalated_lockout"
    | "cooldown_active";
  /** Seconds the caller should propagate in Retry-After when !allowed. */
  retryAfterSeconds: number;
  /** Diagnostic counts the caller can log · never put in client response. */
  diagnostics: {
    totalInWindow: number;
    failuresInWindow: number;
    escalatedFailuresIn24h: number;
    mostRecentFailureAt: NexTimestamp | null;
  };
}

/**
 * Decide whether a new PIN attempt is permitted for (account, device).
 *
 * Policy (design §H):
 *   · Count attempts in the last 15 min window.
 *   · ≥ 5 failures in that window → 'window_exceeded', retry after the
 *     lockout seconds remaining.
 *   · ≥ 10 failures in last 24h   → 'escalated_lockout', unlock only via
 *     the escalation path (A.3 enforces: password + fresh WebAuthn).
 *   · Otherwise → allowed.
 */
export async function checkPinRateLimit(input: {
  accountId: NexUuid;
  deviceId: string;
  now?: Date;
}): Promise<PinRateVerdict> {
  const now = input.now ?? new Date();
  const windowStart = new Date(now.getTime() - PIN_WINDOW_SECONDS * 1000);
  const escalationStart = new Date(
    now.getTime() - PIN_ESCALATION_WINDOW_SECONDS * 1000,
  );
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_pin_attempt")
    .select("success, attempted_at")
    .eq("account_id", input.accountId)
    .eq("device_id", input.deviceId)
    .gte("attempted_at", escalationStart.toISOString())
    .order("attempted_at", { ascending: false });
  if (error) {
    throw new Error(`vault/pin-rate-limit.checkPinRateLimit: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{
    success: boolean;
    attempted_at: NexTimestamp;
  }>;

  const inWindow = countInWindow(rows, windowStart);
  const escalatedFailures = rows.filter((r) => !r.success).length;

  const diagnostics = {
    totalInWindow: inWindow.totalInWindow,
    failuresInWindow: inWindow.failuresInWindow,
    escalatedFailuresIn24h: escalatedFailures,
    mostRecentFailureAt:
      inWindow.mostRecentFailureAt?.toISOString() ?? null,
  } as const;

  if (
    escalatedFailures >= PIN_MAX_ATTEMPTS_IN_WINDOW * 2 &&
    inWindow.mostRecentFailureAt
  ) {
    // 10+ failures in last 24h · require escalation path.
    return {
      allowed: false,
      reason: "escalated_lockout",
      retryAfterSeconds: Math.max(
        0,
        PIN_ESCALATION_WINDOW_SECONDS -
          Math.floor(
            (now.getTime() - inWindow.mostRecentFailureAt.getTime()) / 1000,
          ),
      ),
      diagnostics,
    };
  }

  if (
    inWindow.failuresInWindow >= PIN_MAX_ATTEMPTS_IN_WINDOW &&
    inWindow.mostRecentFailureAt
  ) {
    const sinceLast = Math.floor(
      (now.getTime() - inWindow.mostRecentFailureAt.getTime()) / 1000,
    );
    const retry = Math.max(0, PIN_LOCKOUT_SECONDS - sinceLast);
    return {
      allowed: retry === 0 ? true : false,
      reason: retry === 0 ? null : "window_exceeded",
      retryAfterSeconds: retry,
      diagnostics,
    };
  }

  return {
    allowed: true,
    reason: null,
    retryAfterSeconds: 0,
    diagnostics,
  };
}

// ---------------------------------------------------------------------------
// Recovery passphrase · writer + checker
// ---------------------------------------------------------------------------

export async function recordRecoveryAttempt(input: {
  accountId: NexUuid;
  success: boolean;
  at?: Date;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_recovery_attempt")
    .insert({
      account_id: input.accountId,
      success: input.success,
      attempted_at: (input.at ?? new Date()).toISOString(),
    });
  if (error) {
    throw new Error(
      `vault/pin-rate-limit.recordRecoveryAttempt: ${error.message}`,
    );
  }
}

export interface RecoveryRateVerdict {
  allowed: boolean;
  reason: null | "window_exceeded" | "cooldown_active";
  retryAfterSeconds: number;
  diagnostics: {
    failuresInWindow: number;
    mostRecentFailureAt: NexTimestamp | null;
  };
}

/**
 * Decide whether a new recovery-passphrase attempt is permitted for an
 * account.
 *
 * Policy (design §H):
 *   · Count failures in the last 1h window.
 *   · ≥ 5 failures → 24h cooldown; 'cooldown_active' until elapsed.
 *   · Otherwise → allowed.
 */
export async function checkRecoveryRateLimit(input: {
  accountId: NexUuid;
  now?: Date;
}): Promise<RecoveryRateVerdict> {
  const now = input.now ?? new Date();
  // Fetch the full cooldown period, not just the 1h window · the breach
  // cluster can be hours in the past and the cooldown is still active.
  const cooldownStart = new Date(now.getTime() - RECOVERY_COOLDOWN_SECONDS * 1000);
  const windowStart = new Date(now.getTime() - RECOVERY_WINDOW_SECONDS * 1000);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_recovery_attempt")
    .select("success, attempted_at")
    .eq("account_id", input.accountId)
    .gte("attempted_at", cooldownStart.toISOString())
    .order("attempted_at", { ascending: false });
  if (error) {
    throw new Error(
      `vault/pin-rate-limit.checkRecoveryRateLimit: ${error.message}`,
    );
  }
  const rows = (data ?? []) as Array<{
    success: boolean;
    attempted_at: NexTimestamp;
  }>;

  // Failures sorted most-recent-first within the 24h cooldown lookback.
  const sortedFailures = rows
    .filter((r) => !r.success)
    .map((r) => new Date(r.attempted_at))
    .filter((d) => Number.isFinite(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  // Diagnostics report failures in the actual 1h rolling window.
  const failuresInWindow = sortedFailures.filter((d) => d >= windowStart).length;
  const diagnostics = {
    failuresInWindow,
    mostRecentFailureAt: sortedFailures[0]?.toISOString() ?? null,
  } as const;

  // Detect the most-recent cluster of ≥ RECOVERY_MAX_ATTEMPTS_IN_WINDOW
  // failures within any 1h sliding window. Anchor the cooldown on the
  // latest failure in that cluster.
  let cooldownAnchor: Date | null = null;
  const windowMs = RECOVERY_WINDOW_SECONDS * 1000;
  for (
    let i = 0;
    i + RECOVERY_MAX_ATTEMPTS_IN_WINDOW - 1 < sortedFailures.length;
    i++
  ) {
    const latest = sortedFailures[i]!;
    const fifth = sortedFailures[i + RECOVERY_MAX_ATTEMPTS_IN_WINDOW - 1]!;
    if (latest.getTime() - fifth.getTime() <= windowMs) {
      cooldownAnchor = latest;
      break;
    }
  }

  if (cooldownAnchor) {
    const sinceAnchor = Math.floor(
      (now.getTime() - cooldownAnchor.getTime()) / 1000,
    );
    const retry = Math.max(0, RECOVERY_COOLDOWN_SECONDS - sinceAnchor);
    return {
      allowed: retry === 0,
      reason: retry === 0 ? null : "cooldown_active",
      retryAfterSeconds: retry,
      diagnostics,
    };
  }

  return { allowed: true, reason: null, retryAfterSeconds: 0, diagnostics };
}
