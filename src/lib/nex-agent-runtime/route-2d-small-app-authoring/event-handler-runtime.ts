// §36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring · §36-2D-a bug-fix scope 2026-09-15
// NEX bounded infrastructure · event-handler runtime · 2026-09-14 (formula-display fix 2026-09-15)
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// This module ships the LOCKED runtime handlers for the 5 event kinds.
// Every Route-2d-emitted page imports these handlers by name; NEX1 selects
// which handler to bind to which button, but NEVER writes handler code.
// Adding or modifying a handler requires a §36 amendment.
//
// §36-2D-a bug-fix scope (2026-09-15): the display is now a FORMULA STRING
// that accumulates digits + operators + result. NEX1's spec + primitive
// grammar are unchanged; the change is purely internal to the 4 calculator
// handlers.

import type { OperatorId } from "./route-2d-types";

// ── Locked state contract (matches State declarations) ──────────────────

export interface Route2dRuntimeState {
  readonly [state_key: string]: string | number | null;
}

// ── Locked bounds ───────────────────────────────────────────────────────

export const R2D_MAX_DISPLAY_LENGTH = 48;

// ── Locked operator-symbol table ────────────────────────────────────────

const OPERATOR_SYMBOL: Readonly<Record<OperatorId, string>> = Object.freeze({
  add: "+",
  subtract: "-",
  multiply: "×",
  divide: "÷",
});

// ── Locked helpers · pure, deterministic ────────────────────────────────

/**
 * Extract the trailing numeric literal from a formula display like
 * "1 + 23" (→ 23) or "0" (→ 0) or "5 - " (→ 0 · no trailing number).
 */
function extractTrailingNumber(display: string): number {
  const m = display.match(/-?\d+(?:\.\d+)?$/);
  if (!m) return 0;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : 0;
}

/** True when display ends with " <op> " · i.e. awaiting the next operand. */
function endsWithOperator(display: string): boolean {
  return / [+\-×÷] $/.test(display);
}

/** True when display contains " = " (evaluation complete). */
function containsEquals(display: string): boolean {
  return display.includes(" = ");
}

/** After an "= result" tail, keep only the result as the new starting value. */
function collapseAfterEquals(display: string): string {
  const idx = display.indexOf(" = ");
  if (idx < 0) return display;
  return display.slice(idx + 3);
}

/** Format a numeric result to a bounded display string. */
function formatResult(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6).replace(/\.?0+$/, "");
}

// ── Handler: press_digit ────────────────────────────────────────────────
//
// If the display currently shows an "= <result>" tail, the digit starts a
// fresh equation. Otherwise the digit is appended to the running formula,
// with the initial "0" replaced. Overall length bounded.

export function handlePressDigit(prev: Route2dRuntimeState, digit: number, display_key: string): Route2dRuntimeState {
  let d = String(prev[display_key] ?? "0");
  if (containsEquals(d)) {
    // Start a fresh formula from this digit; drop pending state.
    return { ...prev, [display_key]: String(digit) };
  }
  if (d === "0") {
    d = String(digit);
  } else {
    d = d + String(digit);
  }
  if (d.length > R2D_MAX_DISPLAY_LENGTH) d = d.slice(0, R2D_MAX_DISPLAY_LENGTH);
  return { ...prev, [display_key]: d };
}

// ── Handler: press_operator ────────────────────────────────────────────
//
// Appends " <op> " to the running formula. If the display already ended
// with an operator, replaces it. If the display shows "= <result>", uses
// the result as the new first operand and continues.

export function handlePressOperator(
  prev: Route2dRuntimeState,
  operator: OperatorId,
  display_key: string,
  previous_key: string,
  operator_key: string,
): Route2dRuntimeState {
  let d = String(prev[display_key] ?? "0");
  // If display ends with an operator (awaiting operand), replace the operator.
  if (endsWithOperator(d)) {
    d = d.replace(/ [+\-×÷] $/, "");
  }
  // If display shows a completed equation, collapse to the result only.
  if (containsEquals(d)) {
    d = collapseAfterEquals(d);
  }
  const symbol = OPERATOR_SYMBOL[operator] ?? "?";
  const lastNumber = extractTrailingNumber(d);
  const nextDisplay = `${d} ${symbol} `;
  const capped = nextDisplay.length > R2D_MAX_DISPLAY_LENGTH ? nextDisplay.slice(0, R2D_MAX_DISPLAY_LENGTH) : nextDisplay;
  return {
    ...prev,
    [previous_key]: Number.isFinite(lastNumber) ? lastNumber : 0,
    [operator_key]: operator,
    [display_key]: capped,
  };
}

// ── Handler: press_equals ──────────────────────────────────────────────
//
// Requires a pending operator + a trailing numeric operand. Appends
// " = <result>" to the formula. previous holds the result for further ops;
// operator resets to null.

export function handlePressEquals(
  prev: Route2dRuntimeState,
  display_key: string,
  previous_key: string,
  operator_key: string,
): Route2dRuntimeState {
  const op = prev[operator_key] as OperatorId | null;
  if (op === null || op === undefined) return prev;
  let d = String(prev[display_key] ?? "0");
  // No trailing operand (e.g., display is "1 + ") — refuse to compute.
  if (endsWithOperator(d)) return prev;
  // If already contains equals, use the result as the base and re-collapse.
  if (containsEquals(d)) d = collapseAfterEquals(d);
  const previous = Number(prev[previous_key] ?? 0);
  const current = extractTrailingNumber(d);
  let result: number;
  switch (op) {
    case "add":
      result = previous + current;
      break;
    case "subtract":
      result = previous - current;
      break;
    case "multiply":
      result = previous * current;
      break;
    case "divide":
      result = current === 0 ? 0 : previous / current;
      break;
    default:
      return prev;
  }
  if (!Number.isFinite(result)) result = 0;
  const formatted = formatResult(result);
  const nextDisplay = `${d} = ${formatted}`;
  const capped = nextDisplay.length > R2D_MAX_DISPLAY_LENGTH ? nextDisplay.slice(0, R2D_MAX_DISPLAY_LENGTH) : nextDisplay;
  return {
    ...prev,
    [display_key]: capped,
    [previous_key]: result,
    [operator_key]: null,
  };
}

// ── Handler: press_clear ───────────────────────────────────────────────

export function handlePressClear(
  prev: Route2dRuntimeState,
  display_key: string,
  previous_key: string,
  operator_key: string,
): Route2dRuntimeState {
  return {
    ...prev,
    [display_key]: "0",
    [previous_key]: 0,
    [operator_key]: null,
  };
}

// ── Handler: set_state_literal ─────────────────────────────────────────

export function handleSetStateLiteral(
  prev: Route2dRuntimeState,
  target_state_key: string,
  literal: string | number,
): Route2dRuntimeState {
  return { ...prev, [target_state_key]: literal };
}

// ── Locked derived transforms (unchanged from initial wave) ─────────────

export function transformIdentity(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function transformFormatNumber(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4).replace(/\.?0+$/, "");
}

export function transformJoinStrings(values: readonly unknown[]): string {
  return values.map((v) => (v === null || v === undefined ? "" : String(v))).join("");
}

// ── Locked runtime marker exported for grep verification ───────────────

export const ROUTE_2D_RUNTIME_MARKER = "§36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring";
