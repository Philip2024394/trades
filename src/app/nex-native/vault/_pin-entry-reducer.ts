// src/app/nex-native/vault/_pin-entry-reducer.ts
//
// NEX Vault · 6-digit PIN entry state machine.
// UI-foundation reducer only. No crypto, no auth, no network, no storage.
// Governed by vault-security-architecture-research.md §0.2 — the PIN is an
// unlock factor at the UI surface; it is NOT the Vault encryption key.

export const PIN_LENGTH = 6;

export type PinEntryKind =
  | "entering"
  | "submitting"
  | "incorrect"
  | "unavailable";

export type PinEntryState =
  | { kind: "entering"; digits: string }
  | { kind: "submitting"; digits: string }
  | { kind: "incorrect"; digits: string }
  | { kind: "unavailable" };

export type PinEntryEvent =
  | { kind: "digit"; value: string }
  | { kind: "backspace" }
  | { kind: "setDigits"; digits: string }
  | { kind: "submit" }
  | { kind: "reject"; reason: "incorrect" | "unavailable" }
  | { kind: "reset" };

export function initialPinState(): PinEntryState {
  return { kind: "entering", digits: "" };
}

export function reducePinState(
  state: PinEntryState,
  event: PinEntryEvent,
): PinEntryState {
  if (state.kind === "unavailable") {
    if (event.kind === "reset") return initialPinState();
    return state;
  }

  switch (event.kind) {
    case "digit": {
      if (state.kind === "submitting") return state;
      if (!/^\d$/.test(event.value)) return state;
      const next = (state.digits + event.value).slice(0, PIN_LENGTH);
      return { kind: "entering", digits: next };
    }
    case "backspace": {
      if (state.kind === "submitting") return state;
      const next = state.digits.slice(0, -1);
      return { kind: "entering", digits: next };
    }
    case "setDigits": {
      if (state.kind === "submitting") return state;
      const cleaned = event.digits.replace(/\D/g, "").slice(0, PIN_LENGTH);
      return { kind: "entering", digits: cleaned };
    }
    case "submit": {
      if (state.kind !== "entering") return state;
      if (state.digits.length !== PIN_LENGTH) return state;
      return { kind: "submitting", digits: state.digits };
    }
    case "reject": {
      if (event.reason === "unavailable") return { kind: "unavailable" };
      return { kind: "incorrect", digits: "" };
    }
    case "reset": {
      return initialPinState();
    }
  }
}

export function isSubmittable(state: PinEntryState): boolean {
  return state.kind === "entering" && state.digits.length === PIN_LENGTH;
}

export function digitCount(state: PinEntryState): number {
  if (state.kind === "unavailable") return 0;
  return state.digits.length;
}
