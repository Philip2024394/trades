// src/app/nex-native/vault/_pin-entry-reducer.ts
//
// Vault Phase A · Commit A.3b · PIN entry state machine (8-12 digits).
//
// Founder-locked policy 2026-10-06: 8-12 digit PINs ONLY. 6-digit PINs
// are impossible at every surface. Users who want stronger protection
// use passphrase mode (_passphrase-entry-client.tsx).
//
// Pure state machine · no crypto, no network, no storage. The actual
// cryptographic flow lives in unlock-orchestrator.ts; this reducer only
// drives the UI.

export const PIN_MIN_LENGTH = 8;
export const PIN_MAX_LENGTH = 12;

export type PinEntryKind =
  | "entering"
  | "ready"
  | "submitting"
  | "wrong"
  | "rate_limited";

export type PinEntryState =
  | { kind: "entering"; digits: string }
  | { kind: "ready"; digits: string }
  | { kind: "submitting"; digits: string }
  | { kind: "wrong"; digits: "" }
  | { kind: "rate_limited"; retryAfterSeconds: number };

export type PinEntryEvent =
  | { kind: "digit"; value: string }
  | { kind: "backspace" }
  | { kind: "setDigits"; digits: string }
  | { kind: "submit" }
  | { kind: "rejectWrong" }
  | { kind: "rejectRateLimited"; retryAfterSeconds: number }
  | { kind: "reset" };

export function initialPinState(): PinEntryState {
  return { kind: "entering", digits: "" };
}

function enterState(digits: string): PinEntryState {
  const cleaned = digits.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH);
  if (cleaned.length >= PIN_MIN_LENGTH) {
    return { kind: "ready", digits: cleaned };
  }
  return { kind: "entering", digits: cleaned };
}

export function reducePinState(
  state: PinEntryState,
  event: PinEntryEvent,
): PinEntryState {
  if (state.kind === "rate_limited") {
    if (event.kind === "reset") return initialPinState();
    return state;
  }

  switch (event.kind) {
    case "digit": {
      if (state.kind === "submitting") return state;
      if (!/^\d$/.test(event.value)) return state;
      const current = state.kind === "wrong" ? "" : state.digits;
      return enterState(current + event.value);
    }
    case "backspace": {
      if (state.kind === "submitting") return state;
      const current = state.kind === "wrong" ? "" : state.digits;
      return enterState(current.slice(0, -1));
    }
    case "setDigits": {
      if (state.kind === "submitting") return state;
      return enterState(event.digits);
    }
    case "submit": {
      if (state.kind !== "ready") return state;
      return { kind: "submitting", digits: state.digits };
    }
    case "rejectWrong": {
      return { kind: "wrong", digits: "" };
    }
    case "rejectRateLimited": {
      return {
        kind: "rate_limited",
        retryAfterSeconds: event.retryAfterSeconds,
      };
    }
    case "reset": {
      return initialPinState();
    }
  }
}

export function isSubmittable(state: PinEntryState): boolean {
  return state.kind === "ready";
}

export function digitCount(state: PinEntryState): number {
  if (state.kind === "rate_limited") return 0;
  if (state.kind === "wrong") return 0;
  return state.digits.length;
}
