// src/lib/nex/brain/adapters/whatsapp-provider-adapter.ts
//
// Stage 3.38 · WhatsApp adapter · provider-backed (Philip 2026-08-31).
//
// This is the adapter that takes a real WhatsAppProvider and lives
// under the Stage 3.36 ActionAdapter contract. It NEVER touches the
// state machine · it only produces AdapterOutcome shapes that the
// executor already knows how to interpret.
//
// The 3.36 stub (`whatsapp-stub.ts`) stays untouched · that adapter's
// job is to prove the UNKNOWN pipeline works end-to-end when no
// provider is wired. This adapter's job is to prove the UNKNOWN
// pipeline stays honest when a real provider IS wired.
//
// CONSTITUTIONAL:
//   1. Provider "accepted" → adapter "accepted" (→ chain UNKNOWN).
//      Never rounded up.
//   2. Provider "delivered" (with a real proof) → adapter "delivered".
//      This is the ONLY path to VERIFIED.
//   3. Timeout → adapter "accepted" with `awaitingKind: "webhook"`.
//      NEVER FAILED · we don't know what happened.
//   4. Provider throws → adapter "unreachable". Chain → FAILED.
//   5. Second call for the same correlationId is REFUSED at the
//      outbox layer (IdempotencyNotAvailableError). No auto-retry.

import { createHash } from "node:crypto";
import type { ActionAdapter, AdapterOutcome } from "../action-audit";
import type { WhatsAppProvider, ProviderSendOutcome } from "./whatsapp-provider";
import {
  recordAttempt,
  markOutcome,
  IdempotencyNotAvailableError,
} from "./whatsapp-outbox";

function looksLikePhone(v: string): boolean {
  return /^\+?[\d\s\-()]{7,}$/.test(v.trim());
}
function normalizeToE164(v: string): string {
  // Very light normalization · just strip spaces/dashes/parens · we
  // do NOT reformat country codes. A real provider adapter can layer
  // stricter normalization on top.
  return v.replace(/[\s\-()]/g, "");
}
function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export type WhatsAppProviderAdapterOptions = {
  provider: WhatsAppProvider;
  /**
   * Max time to wait for provider.send() before we give up and
   * declare the outcome UNKNOWN. Default 15s. Never null · never
   * unbounded · we must always resolve into a deterministic state.
   */
  timeoutMs?: number;
  /** Injectable clock for tests. */
  now?: () => string;
};

/**
 * Wraps a real WhatsAppProvider into the ActionAdapter interface.
 * Called by runActionChain the same way the stub is called.
 */
export function makeWhatsAppProviderAdapter(opts: WhatsAppProviderAdapterOptions): ActionAdapter {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const now = opts.now ?? (() => new Date().toISOString());

  return {
    kind: "contact_via_whatsapp",
    async execute({ target, payload, correlationId }): Promise<AdapterOutcome> {
      // ─── Structural gates · same as stub ─────────────────────────
      const ch = target.contactChannel;
      if (!ch || ch.kind !== "whatsapp") {
        return {
          kind: "rejected",
          reason: "target has no whatsapp contact channel · I won't guess a number",
        };
      }
      if (!looksLikePhone(ch.value)) {
        return {
          kind: "rejected",
          reason: `whatsapp channel value "${ch.value}" doesn't look like a phone number`,
        };
      }
      const body = String(payload?.body ?? payload?.messageBody ?? "").trim();
      if (!body) {
        return {
          kind: "rejected",
          reason: "no message body provided · I won't send an empty message",
        };
      }

      // ─── Outbox record · idempotency gate ────────────────────────
      // recordAttempt throws IdempotencyNotAvailableError if a record
      // for this correlationId already exists. That's the no-auto-
      // retry guarantee · the executor sees the throw as an adapter
      // failure and maps to FAILED with the error captured.
      const toE164 = normalizeToE164(ch.value);
      try {
        await recordAttempt({
          correlationId,
          providerId:      opts.provider.id,
          targetCanonical: target.canonical,
          toE164,
          bodyHash:        sha256(body),
          now,
        });
      } catch (err) {
        if (err instanceof IdempotencyNotAvailableError) {
          // Bubble as unreachable · executor maps to FAILED and
          // captures the error message. The user-facing composer
          // already refuses to claim success on FAILED · replay
          // guard preserved end-to-end.
          return {
            kind: "unreachable",
            reason: err.message,
          };
        }
        throw err;
      }

      // ─── Call the provider with a timeout ────────────────────────
      let outcome: ProviderSendOutcome;
      try {
        outcome = await withTimeout(
          opts.provider.send({
            toE164,
            body,
            idempotencyKey: correlationId,
          }),
          timeoutMs,
        );
      } catch (err) {
        if (err instanceof TimeoutError) {
          // CONSTITUTIONAL: timeout is NOT FAILED. We don't know what
          // happened at the wire. Map to accepted → chain UNKNOWN.
          await markOutcome(correlationId, {
            status: "TIMED_OUT",
            resolutionReason: `provider ${opts.provider.id} did not respond within ${timeoutMs}ms`,
            now,
          });
          return {
            kind: "accepted",
            pending: {
              correlationId,
              awaitingKind: "webhook",
              reason: `provider ${opts.provider.id} timeout at ${timeoutMs}ms · message may or may not have been sent · will remain UNKNOWN until reconciliation resolves`,
            },
          };
        }
        // Anything else the provider threw · treat as unreachable.
        const e = err instanceof Error ? err : new Error(String(err));
        markOutcome(correlationId, {
          status: "UNKNOWN",
          resolutionReason: `provider threw: ${e.message}`,
          now,
        });
        return {
          kind: "unreachable",
          reason: `provider ${opts.provider.id} threw: ${e.message}`,
        };
      }

      // ─── Map provider outcome to adapter outcome ────────────────
      switch (outcome.kind) {
        case "delivered": {
          await markOutcome(correlationId, {
            status: "CONFIRMED",
            providerMessageId: outcome.providerMessageId,
            resolutionReason: `provider delivered at ${outcome.deliveredAt} · ${outcome.providerRawStatus}`,
            now,
          });
          return {
            kind: "delivered",
            proof: {
              kind:       "delivery_receipt",
              at:         outcome.deliveredAt,
              detail:     `${opts.provider.id} delivered ${outcome.providerMessageId} · rawStatus=${outcome.providerRawStatus}`,
              externalId: outcome.providerMessageId,
            },
          };
        }
        case "accepted": {
          await markOutcome(correlationId, {
            status: "ACCEPTED",
            providerMessageId: outcome.providerMessageId,
            resolutionReason: `provider accepted · rawStatus=${outcome.providerRawStatus} · awaiting delivery webhook`,
            now,
          });
          return {
            kind: "accepted",
            pending: {
              correlationId,
              awaitingKind: "webhook",
              reason: `provider ${opts.provider.id} accepted (rawStatus=${outcome.providerRawStatus}) but delivery is not yet confirmed · UNKNOWN until webhook reconciliation lands`,
            },
          };
        }
        case "rejected": {
          await markOutcome(correlationId, {
            status: "REJECTED",
            resolutionReason: outcome.reason + (outcome.providerRawStatus ? ` · rawStatus=${outcome.providerRawStatus}` : ""),
            now,
          });
          return { kind: "rejected", reason: `provider ${opts.provider.id} rejected: ${outcome.reason}` };
        }
        case "unreachable": {
          await markOutcome(correlationId, {
            status: "UNKNOWN",
            resolutionReason: `provider unreachable: ${outcome.reason}`,
            now,
          });
          return { kind: "unreachable", reason: `provider ${opts.provider.id} unreachable: ${outcome.reason}` };
        }
      }
    },
  };
}

// ─── Timeout helper ────────────────────────────────────────────────

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutP = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([p, timeoutP]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
