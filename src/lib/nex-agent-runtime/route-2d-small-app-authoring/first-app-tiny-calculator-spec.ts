// §36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring
// NEX bounded infrastructure · tiny-calculator spec fixture · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule.
//
// This module ships the exact SmallApplicationSpec that NEX1 uses to author
// the tiny-calculator via authorSmallApplication. The spec ITSELF is MAI
// infrastructure. The BYTES emitted by the primitive from this spec are
// what NEX1 authored. Files at src/app/nex-generated/tiny-calculator/
// carry the "Coded by NEX1" header · this module carries "NEX bounded
// infrastructure". Provenance separation is explicit.

import type {
  EventBinding,
  SmallApplicationSpec,
  StateDeclaration,
  StyleTokenBinding,
  UINode,
} from "./route-2d-types";

// ── State (exactly 3 fields per design §4.2) ────────────────────────────

const STATE: readonly StateDeclaration[] = Object.freeze([
  { state_key: "display", value_kind: "digit_string", initial_literal: "0" },
  { state_key: "previous", value_kind: "number", initial_literal: 0 },
  { state_key: "operator", value_kind: "operator_slot", initial_literal: null },
]);

// ── Events (exactly 12 per design §4.4) ────────────────────────────────

const DIGIT_EVENTS: readonly EventBinding[] = Object.freeze(
  Array.from({ length: 10 }, (_, d) => ({
    event_id: `press_digit_${d}`,
    event_kind: "press_digit" as const,
    payload: { kind: "press_digit" as const, digit: d },
  })),
);

const OTHER_EVENTS: readonly EventBinding[] = Object.freeze([
  { event_id: "press_operator_add", event_kind: "press_operator", payload: { kind: "press_operator", operator: "add" } },
  { event_id: "press_equals", event_kind: "press_equals", payload: { kind: "press_equals" } },
  { event_id: "press_clear", event_kind: "press_clear", payload: { kind: "press_clear" } },
]);

// ── Style tokens (exactly 6 per design §4.6) ───────────────────────────

const STYLE: readonly StyleTokenBinding[] = Object.freeze([
  { style_ref: "column_layout_md", tokens: [{ key: "layout", value: "column" }, { key: "spacing", value: "md" }] },
  { style_ref: "keypad_grid", tokens: [{ key: "layout", value: "grid-3x3" }, { key: "spacing", value: "sm" }] },
  { style_ref: "bottom_row", tokens: [{ key: "layout", value: "grid-4x1" }, { key: "spacing", value: "sm" }] },
  { style_ref: "display_style", tokens: [{ key: "color_neutral", value: "slate" }, { key: "size", value: "lg" }, { key: "alignment", value: "end" }] },
  { style_ref: "digit_button_style", tokens: [{ key: "color_primary", value: "sky" }, { key: "size", value: "md" }, { key: "alignment", value: "center" }] },
  { style_ref: "action_button_style", tokens: [{ key: "color_primary", value: "amber" }, { key: "size", value: "md" }, { key: "alignment", value: "center" }] },
]);

// ── UI tree (15 leaves · 2 wrapping containers per design §4.3) ────────

function digitButton(d: number): UINode {
  return {
    kind: "button",
    label_ref: { kind: "literal", value: String(d) },
    on_press_event_id: `press_digit_${d}`,
    style_ref: "digit_button_style",
  };
}

function actionButton(label: string, event_id: string): UINode {
  return {
    kind: "button",
    label_ref: { kind: "literal", value: label },
    on_press_event_id: event_id,
    style_ref: "action_button_style",
  };
}

const ROOT: UINode = {
  kind: "container",
  style_ref: "column_layout_md",
  children: [
    {
      kind: "display_region",
      content_ref: { kind: "state_key", key: "display", transform: "identity" },
      style_ref: "display_style",
    },
    {
      kind: "container",
      style_ref: "keypad_grid",
      children: [
        digitButton(7), digitButton(8), digitButton(9),
        digitButton(4), digitButton(5), digitButton(6),
        digitButton(1), digitButton(2), digitButton(3),
      ],
    },
    {
      kind: "container",
      style_ref: "bottom_row",
      children: [
        digitButton(0),
        actionButton("+", "press_operator_add"),
        actionButton("=", "press_equals"),
        actionButton("C", "press_clear"),
      ],
    },
  ],
};

// ── Test scenarios (§36-2D-a bug-fix scope · formula-display update) ────
//
// Display now accumulates as a formula: "1", "1 + ", "1 + 2", "1 + 2 = 3".
// Founder-visible expression + result stays on screen after evaluation.

const TEST_SCENARIOS = Object.freeze([
  {
    scenario_id: "initial-state",
    initial_state_overrides: [],
    event_sequence: [],
    final_state: [
      { state_key: "display", expected_value: "0" },
      { state_key: "previous", expected_value: 0 },
    ],
  },
  {
    scenario_id: "press-sequence-42",
    initial_state_overrides: [],
    event_sequence: ["press_digit_4", "press_digit_2"],
    final_state: [{ state_key: "display", expected_value: "42" }],
  },
  {
    scenario_id: "formula-1-plus-keeps-both",
    initial_state_overrides: [],
    event_sequence: ["press_digit_1", "press_operator_add"],
    final_state: [{ state_key: "display", expected_value: "1 + " }],
  },
  {
    scenario_id: "formula-1-plus-2-visible",
    initial_state_overrides: [],
    event_sequence: ["press_digit_1", "press_operator_add", "press_digit_2"],
    final_state: [{ state_key: "display", expected_value: "1 + 2" }],
  },
  {
    scenario_id: "add-2-plus-3-eq-5-shown",
    initial_state_overrides: [],
    event_sequence: ["press_digit_2", "press_operator_add", "press_digit_3", "press_equals"],
    final_state: [{ state_key: "display", expected_value: "2 + 3 = 5" }],
  },
  {
    scenario_id: "clear-resets",
    initial_state_overrides: [],
    event_sequence: ["press_digit_9", "press_clear"],
    final_state: [{ state_key: "display", expected_value: "0" }],
  },
]);

// ── Complete spec (locked) ──────────────────────────────────────────────

export function buildTinyCalculatorSpec(): SmallApplicationSpec {
  return {
    app_name: "tiny-calculator",
    header_comment:
      "Route 2d first-app demonstration.\n" +
      "Tiny calculator · 3 state fields · 12 events · locked vocabulary only.\n" +
      "Every byte in the emitted files was produced deterministically by authorSmallApplication.",
    route_path: "/nex-generated/tiny-calculator",
    component: {
      component_name: "TinyCalculator",
      root_node: ROOT,
      props: [],
    },
    state: STATE,
    events: [...DIGIT_EVENTS, ...OTHER_EVENTS],
    style_tokens: STYLE,
    test_scenarios: TEST_SCENARIOS,
  };
}
