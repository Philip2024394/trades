// §36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring
// Coded by NEX1 via route_2d_small_application · 2026-09-14
// Route 2d first-app demonstration.
// Tiny calculator · 3 state fields · 12 events · locked vocabulary only.
// Every byte in the emitted files was produced deterministically by authorSmallApplication.
// Contract: TinyCalculator
// Deterministic byte-stable output. Do not edit by hand.

import { describe, it, expect } from "vitest";
import { handlePressDigit, handlePressOperator, handlePressEquals, handlePressClear } from "@/lib/nex-agent-runtime/route-2d-small-app-authoring/event-handler-runtime";

type State = Record<string, string | number | null>;

function dispatch(prev: State, event_id: string): State {
  switch (event_id) {
      case "press_digit_0":
        return handlePressDigit(prev, 0, "display");
      case "press_digit_1":
        return handlePressDigit(prev, 1, "display");
      case "press_digit_2":
        return handlePressDigit(prev, 2, "display");
      case "press_digit_3":
        return handlePressDigit(prev, 3, "display");
      case "press_digit_4":
        return handlePressDigit(prev, 4, "display");
      case "press_digit_5":
        return handlePressDigit(prev, 5, "display");
      case "press_digit_6":
        return handlePressDigit(prev, 6, "display");
      case "press_digit_7":
        return handlePressDigit(prev, 7, "display");
      case "press_digit_8":
        return handlePressDigit(prev, 8, "display");
      case "press_digit_9":
        return handlePressDigit(prev, 9, "display");
      case "press_operator_add":
        return handlePressOperator(prev, "add", "display", "previous", "operator");
      case "press_equals":
        return handlePressEquals(prev, "display", "previous", "operator");
      case "press_clear":
        return handlePressClear(prev, "display", "previous", "operator");
      default:
        return prev;
    }
}

describe("TinyCalculator", () => {
  it("initial-state", () => {
    let state = { ...{
  "display": "0",
  "previous": 0,
  "operator": null
} };
    for (const ev of []) state = dispatch(state, ev);
    expect(state["display"]).toBe("0");
    expect(state["previous"]).toBe(0);
  });
  it("press-sequence-42", () => {
    let state = { ...{
  "display": "0",
  "previous": 0,
  "operator": null
} };
    for (const ev of ["press_digit_4","press_digit_2"]) state = dispatch(state, ev);
    expect(state["display"]).toBe("42");
  });
  it("formula-1-plus-keeps-both", () => {
    let state = { ...{
  "display": "0",
  "previous": 0,
  "operator": null
} };
    for (const ev of ["press_digit_1","press_operator_add"]) state = dispatch(state, ev);
    expect(state["display"]).toBe("1 + ");
  });
  it("formula-1-plus-2-visible", () => {
    let state = { ...{
  "display": "0",
  "previous": 0,
  "operator": null
} };
    for (const ev of ["press_digit_1","press_operator_add","press_digit_2"]) state = dispatch(state, ev);
    expect(state["display"]).toBe("1 + 2");
  });
  it("add-2-plus-3-eq-5-shown", () => {
    let state = { ...{
  "display": "0",
  "previous": 0,
  "operator": null
} };
    for (const ev of ["press_digit_2","press_operator_add","press_digit_3","press_equals"]) state = dispatch(state, ev);
    expect(state["display"]).toBe("2 + 3 = 5");
  });
  it("clear-resets", () => {
    let state = { ...{
  "display": "0",
  "previous": 0,
  "operator": null
} };
    for (const ev of ["press_digit_9","press_clear"]) state = dispatch(state, ev);
    expect(state["display"]).toBe("0");
  });
});
