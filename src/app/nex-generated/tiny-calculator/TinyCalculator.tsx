// §36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring
// Coded by NEX1 via route_2d_small_application · 2026-09-14
// Route 2d first-app demonstration.
// Tiny calculator · 3 state fields · 12 events · locked vocabulary only.
// Every byte in the emitted files was produced deterministically by authorSmallApplication.
// Contract: TinyCalculator
// Deterministic byte-stable output. Do not edit by hand.
"use client";

import { useState } from "react";
import { handlePressDigit, handlePressOperator, handlePressEquals, handlePressClear } from "@/lib/nex-agent-runtime/route-2d-small-app-authoring/event-handler-runtime";
import { transformIdentity as applyTransform_identity, transformFormatNumber as applyTransform_format_number, transformJoinStrings } from "@/lib/nex-agent-runtime/route-2d-small-app-authoring/event-handler-runtime";

export function TinyCalculator() {
  const [state, setState] = useState<Record<string, string | number | null>>({
  "display": "0",
  "previous": 0,
  "operator": null
});
  const handleEvent_press_digit_0 = () => setState((s) => handlePressDigit(s, 0, "display"));
  const handleEvent_press_digit_1 = () => setState((s) => handlePressDigit(s, 1, "display"));
  const handleEvent_press_digit_2 = () => setState((s) => handlePressDigit(s, 2, "display"));
  const handleEvent_press_digit_3 = () => setState((s) => handlePressDigit(s, 3, "display"));
  const handleEvent_press_digit_4 = () => setState((s) => handlePressDigit(s, 4, "display"));
  const handleEvent_press_digit_5 = () => setState((s) => handlePressDigit(s, 5, "display"));
  const handleEvent_press_digit_6 = () => setState((s) => handlePressDigit(s, 6, "display"));
  const handleEvent_press_digit_7 = () => setState((s) => handlePressDigit(s, 7, "display"));
  const handleEvent_press_digit_8 = () => setState((s) => handlePressDigit(s, 8, "display"));
  const handleEvent_press_digit_9 = () => setState((s) => handlePressDigit(s, 9, "display"));
  const handleEvent_press_operator_add = () => setState((s) => handlePressOperator(s, "add", "display", "previous", "operator"));
  const handleEvent_press_equals = () => setState((s) => handlePressEquals(s, "display", "previous", "operator"));
  const handleEvent_press_clear = () => setState((s) => handlePressClear(s, "display", "previous", "operator"));
  return (
    <div className="flex flex-col gap-2 p-2">
      <div role="status" aria-live="polite" className="bg-slate-100 text-slate-900 text-lg px-4 py-3 text-right">{applyTransform_identity(state["display"])}</div>
      <div className="grid grid-cols-3 gap-1 p-1">
        <button type="button" className="bg-sky-600 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_digit_7}>{"7"}</button>
        <button type="button" className="bg-sky-600 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_digit_8}>{"8"}</button>
        <button type="button" className="bg-sky-600 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_digit_9}>{"9"}</button>
        <button type="button" className="bg-sky-600 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_digit_4}>{"4"}</button>
        <button type="button" className="bg-sky-600 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_digit_5}>{"5"}</button>
        <button type="button" className="bg-sky-600 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_digit_6}>{"6"}</button>
        <button type="button" className="bg-sky-600 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_digit_1}>{"1"}</button>
        <button type="button" className="bg-sky-600 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_digit_2}>{"2"}</button>
        <button type="button" className="bg-sky-600 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_digit_3}>{"3"}</button>
      </div>
      <div className="grid grid-cols-4 gap-1 p-1">
        <button type="button" className="bg-sky-600 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_digit_0}>{"0"}</button>
        <button type="button" className="bg-amber-500 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_operator_add}>{"+"}</button>
        <button type="button" className="bg-amber-500 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_equals}>{"="}</button>
        <button type="button" className="bg-amber-500 text-white text-sm px-3 py-2 text-center rounded-md" onClick={handleEvent_press_clear}>{"C"}</button>
      </div>
    </div>
  );
}
