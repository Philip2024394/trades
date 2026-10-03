"use client";

// src/app/nex-native/vault/_pin-entry-client.tsx
//
// NEX Vault · 6-digit PIN entry · UI foundation only.
// NO cryptography · NO auth · NO network · NO persistence · NO telemetry.
//
// Governed by:
//   · vault-research.md §10.0 — user-facing simplicity principle
//   · vault-security-architecture-research.md §0.2 — PIN is an unlock factor,
//     not the Vault encryption key.
//
// The eventual verifyPin implementation (Phase A/B) will replace the mock
// boundary below with the real KEK-derivation + HSM-gated path. For now the
// mock exists only to drive UI state transitions in isolation.

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  initialPinState,
  reducePinState,
  isSubmittable,
  digitCount,
  PIN_LENGTH,
  type PinEntryState,
} from "./_pin-entry-reducer";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  cellBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.18)",
  cyanDeep: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  orangeSoft: "rgba(255, 114, 0, 0.14)",
};

type MockReason = "incorrect" | "unavailable";

const MOCK_VERIFY_DELAY_MS = 900;

async function mockVerifyPin(
  _digits: string,
  mockReason: MockReason,
): Promise<{ ok: false; reason: MockReason }> {
  // Isolated mock boundary. The _digits parameter is intentionally unused —
  // the UI prototype never inspects, hashes, logs, or transmits the PIN.
  await new Promise((r) => setTimeout(r, MOCK_VERIFY_DELAY_MS));
  return { ok: false, reason: mockReason };
}

export interface PinEntryClientProps {
  mockReason?: MockReason;
}

export function PinEntryClient({ mockReason = "incorrect" }: PinEntryClientProps) {
  const [state, dispatch] = useReducer(reducePinState, undefined, initialPinState);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.kind === "unavailable") return;
    inputRef.current?.focus();
  }, [state.kind]);

  useEffect(() => {
    if (state.kind !== "submitting") return;
    let cancelled = false;
    (async () => {
      const result = await mockVerifyPin(state.digits, mockReason);
      if (cancelled) return;
      dispatch({ kind: "reject", reason: result.reason });
    })();
    return () => {
      cancelled = true;
    };
  }, [state.kind, mockReason]);

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

  useEffect(() => {
    if (state.kind === "entering" && state.digits.length === PIN_LENGTH) {
      dispatch({ kind: "submit" });
    }
  }, [state]);

  const digits = digitCount(state);
  const isUnavailable = state.kind === "unavailable";
  const isSubmitting = state.kind === "submitting";
  const showIncorrect = state.kind === "incorrect";

  const feedback: { message: string; tone: "none" | "orange" | "mute" } = isUnavailable
    ? { message: "Vault temporarily unavailable", tone: "mute" }
    : showIncorrect
      ? { message: "Incorrect PIN", tone: "orange" }
      : { message: "", tone: "none" };

  return (
    <div data-nex-vault-pin-root style={{ position: "relative" }}>
      <style>{`
        [data-nex-vault-pin-root] * { box-sizing: border-box; }
        [data-nex-vault-pin-root] [data-vault-cells]:focus-within [data-vault-cell][data-vault-cell-active="true"] {
          border-color: ${NEX.cyan};
          box-shadow: 0 0 0 2px ${NEX.cyanDeep};
        }
      `}</style>

      <form onSubmit={onFormSubmit} autoComplete="off" data-nex-vault-pin-form>
        <div
          data-vault-cells
          onClick={() => inputRef.current?.focus()}
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
            padding: "4px 2px",
            position: "relative",
          }}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const filled = digits > i;
            const isActiveCursor = !isUnavailable && !isSubmitting && digits === i;
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
                  maxWidth: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: NEX.cellBg,
                  border: `1px solid ${isUnavailable ? NEX.cyanFaint : NEX.cyanSoft}`,
                  borderRadius: 10,
                  fontSize: 22,
                  color: NEX.textPrimary,
                  lineHeight: 1,
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
            value={state.kind === "unavailable" ? "" : state.digits}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={isUnavailable || isSubmitting}
            aria-label="Enter your 6-digit Vault PIN"
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
                ? NEX.orange
                : feedback.tone === "mute"
                  ? NEX.textSecondary
                  : "transparent",
          }}
        >
          {feedback.message || " "}
        </div>
      </form>
    </div>
  );
}
