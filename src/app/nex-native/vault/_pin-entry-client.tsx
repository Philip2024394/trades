"use client";

// src/app/nex-native/vault/_pin-entry-client.tsx
//
// Vault Phase A · Commit A.3b · real PIN entry client.
//
// Variable 8–12 digit entry (founder-locked 2026-10-06). Wires to the
// client-side unlock-orchestrator which performs KEK derivation + VMK
// unwrap in the browser against the sealed A.2 crypto library.
//
// No `mockVerifyPin`. No hardcoded 6-digit assumption. No fake success.

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  initialPinState,
  reducePinState,
  isSubmittable,
  digitCount,
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
} from "./_pin-entry-reducer";
import { SKIN_NEX, type VaultDoorwaySkin } from "./_doorway-skin";
import { unlockVault } from "@/lib/nex-native/vault/client/unlock-orchestrator";

export interface PinEntryClientProps {
  skin?: VaultDoorwaySkin;
  deviceId: string;
  /** Where to navigate on successful unlock. Defaults to vault home. */
  nextHref?: string;
}

export function PinEntryClient({
  skin = SKIN_NEX,
  deviceId,
  nextHref = "/nex-native/vault/home",
}: PinEntryClientProps) {
  const [state, dispatch] = useReducer(reducePinState, undefined, initialPinState);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.kind === "rate_limited") return;
    inputRef.current?.focus();
  }, [state.kind]);

  // Run the unlock orchestrator when the reducer transitions to submitting.
  useEffect(() => {
    if (state.kind !== "submitting") return;
    let cancelled = false;
    (async () => {
      const result = await unlockVault({
        mode: "pin",
        secret: state.digits,
        deviceId,
      });
      if (cancelled) return;
      if (result.ok) {
        setError(null);
        router.push(nextHref);
        router.refresh();
        return;
      }
      if (result.rateLimited) {
        dispatch({
          kind: "rejectRateLimited",
          retryAfterSeconds: result.retryAfterSeconds ?? 300,
        });
        setError(null);
      } else {
        dispatch({ kind: "rejectWrong" });
        setError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, deviceId, nextHref]);

  const onChange = useCallback((raw: string) => {
    dispatch({ kind: "setDigits", digits: raw });
  }, []);

  const onFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isSubmittable(state)) return;
      dispatch({ kind: "submit" });
    },
    [state],
  );

  const digits = digitCount(state);
  const isRateLimited = state.kind === "rate_limited";
  const isSubmitting = state.kind === "submitting";
  const showWrong = state.kind === "wrong";
  const currentDigits = isRateLimited || showWrong ? "" : (state as { digits?: string }).digits ?? "";

  // Render exactly PIN_MAX_LENGTH cells, with filled dots up to current.
  const cellCount = PIN_MAX_LENGTH;

  const feedback: { message: string; tone: "none" | "orange" | "mute" } =
    isRateLimited
      ? {
          message: "Too many attempts. Try again later.",
          tone: "mute",
        }
      : showWrong
        ? { message: "That PIN didn't work.", tone: "orange" }
        : error
          ? { message: error, tone: "orange" }
          : { message: "", tone: "none" };

  return (
    <div data-nex-vault-pin-root style={{ position: "relative" }}>
      <style>{`
        [data-nex-vault-pin-root] * { box-sizing: border-box; }
        [data-nex-vault-pin-root] [data-vault-cells]:focus-within [data-vault-cell][data-vault-cell-active="true"] {
          border-color: ${skin.text.brandChip};
          box-shadow: 0 0 0 2px ${skin.cells.activeGlow};
        }
      `}</style>

      <form onSubmit={onFormSubmit} autoComplete="off" data-nex-vault-pin-form>
        <div
          data-vault-cells
          onClick={() => inputRef.current?.focus()}
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "space-between",
            padding: "4px 2px",
            position: "relative",
          }}
        >
          {Array.from({ length: cellCount }).map((_, i) => {
            const filled = digits > i;
            const isActiveCursor = !isRateLimited && !isSubmitting && digits === i;
            return (
              <div
                key={i}
                data-vault-cell={i}
                data-vault-cell-filled={filled ? "true" : "false"}
                data-vault-cell-active={isActiveCursor ? "true" : "false"}
                aria-hidden="true"
                style={{
                  flex: 1,
                  aspectRatio: "1",
                  maxWidth: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: skin.cells.bg,
                  border: `1px solid ${isRateLimited ? skin.cells.borderMuted : skin.cells.border}`,
                  borderRadius: 8,
                  fontSize: 18,
                  color: skin.cells.filled,
                  lineHeight: 1,
                  opacity: i >= PIN_MIN_LENGTH && !filled ? 0.6 : 1,
                }}
              >
                {filled ? "•" : ""}
              </div>
            );
          })}

          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            name="vault-pin"
            value={currentDigits}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={isRateLimited || isSubmitting}
            maxLength={PIN_MAX_LENGTH}
            aria-label="Enter your Vault PIN (8 to 12 digits)"
            data-nex-vault-pin-input
            data-nex-vault-pin-state={state.kind}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              background: "transparent",
              border: "none",
              color: "transparent",
              caretColor: "transparent",
              fontSize: 16,
              padding: 0,
              margin: 0,
            }}
          />
        </div>

        <div
          role="status"
          aria-live="polite"
          data-nex-vault-pin-feedback={feedback.tone === "none" ? "" : feedback.tone}
          style={{
            minHeight: 24,
            marginTop: 20,
            textAlign: "center",
            fontSize: 13,
            letterSpacing: "0.01em",
            color:
              feedback.tone === "orange"
                ? skin.feedback.orange
                : feedback.tone === "mute"
                  ? skin.feedback.muted
                  : "transparent",
          }}
        >
          {feedback.message || " "}
        </div>

        <button
          type="submit"
          disabled={!isSubmittable(state) || isSubmitting || isRateLimited}
          data-nex-vault-unlock-btn
          style={{
            display: "block",
            width: "100%",
            marginTop: 20,
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background:
              isSubmittable(state) && !isSubmitting
                ? skin.text.brandChip
                : skin.cells.borderMuted,
            color: skin.text.primary,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.01em",
            cursor:
              isSubmittable(state) && !isSubmitting ? "pointer" : "default",
            opacity: isSubmittable(state) && !isSubmitting ? 1 : 0.6,
          }}
        >
          {isSubmitting ? "Unlocking…" : "Unlock Vault"}
        </button>
      </form>
    </div>
  );
}
