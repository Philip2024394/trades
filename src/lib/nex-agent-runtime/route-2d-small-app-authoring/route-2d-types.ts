// §36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring
// NEX bounded infrastructure · route-2d types + locked vocabularies · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// This file locks every catalogue that Route 2d uses. NEX1's SmallApplicationSpec
// composes values from these catalogues; the primitive refuses any value outside
// the closed sets. Extending a catalogue requires a new §36 amendment.

// ── UI node kinds (locked · 6) ──────────────────────────────────────────

export type UINodeKind =
  | "container"
  | "text"
  | "button"
  | "input"
  | "label"
  | "display_region";

export const UI_NODE_KINDS: readonly UINodeKind[] = Object.freeze([
  "container",
  "text",
  "button",
  "input",
  "label",
  "display_region",
]);

// ── Event kinds (locked · 5) ────────────────────────────────────────────

export type EventKindId =
  | "press_digit"
  | "press_operator"
  | "press_equals"
  | "press_clear"
  | "set_state_literal";

export const EVENT_KINDS: readonly EventKindId[] = Object.freeze([
  "press_digit",
  "press_operator",
  "press_equals",
  "press_clear",
  "set_state_literal",
]);

export type OperatorId = "add" | "subtract" | "multiply" | "divide";
export const OPERATOR_IDS: readonly OperatorId[] = Object.freeze(["add", "subtract", "multiply", "divide"]);

// ── Style-token keys + closed values (locked · 6 keys) ──────────────────

export type StyleTokenKey =
  | "layout"
  | "spacing"
  | "color_primary"
  | "color_neutral"
  | "size"
  | "alignment"
  | "corners"; // §36-2D-c 2026-09-15 · closed corners vocabulary

export const STYLE_TOKEN_KEYS: readonly StyleTokenKey[] = Object.freeze([
  "layout",
  "spacing",
  "color_primary",
  "color_neutral",
  "size",
  "alignment",
  "corners", // §36-2D-c 2026-09-15
]);

export const STYLE_TOKEN_VALUES: Readonly<Record<StyleTokenKey, readonly string[]>> = Object.freeze({
  layout: Object.freeze(["column", "row", "grid-3x3", "grid-4x1"]),
  spacing: Object.freeze(["sm", "md", "lg"]),
  color_primary: Object.freeze(["slate", "emerald", "amber", "rose", "sky"]),
  color_neutral: Object.freeze(["slate", "zinc", "stone"]),
  size: Object.freeze(["sm", "md", "lg"]),
  alignment: Object.freeze(["start", "center", "end"]),
  // §36-2D-c 2026-09-15 · 4 closed values · no arbitrary border-radius
  corners: Object.freeze(["sharp", "rounded_sm", "rounded_md", "rounded_full"]),
});

// ── Locked Tailwind class map per (key, value) ─────────────────────────
//
// NEX1 never emits className strings. The primitive expands StyleTokenBinding
// entries via this locked map. Any (key, value) not in the map is refused.

export const STYLE_TAILWIND_MAP: Readonly<Record<StyleTokenKey, Readonly<Record<string, string>>>> = Object.freeze({
  layout: Object.freeze({
    column: "flex flex-col",
    row: "flex flex-row",
    "grid-3x3": "grid grid-cols-3",
    "grid-4x1": "grid grid-cols-4",
  }),
  spacing: Object.freeze({
    sm: "gap-1 p-1",
    md: "gap-2 p-2",
    lg: "gap-4 p-4",
  }),
  color_primary: Object.freeze({
    slate: "bg-slate-600 text-white",
    emerald: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-white",
    rose: "bg-rose-600 text-white",
    sky: "bg-sky-600 text-white",
  }),
  color_neutral: Object.freeze({
    slate: "bg-slate-100 text-slate-900",
    zinc: "bg-zinc-100 text-zinc-900",
    stone: "bg-stone-100 text-stone-900",
  }),
  size: Object.freeze({
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-2",
    lg: "text-lg px-4 py-3",
  }),
  alignment: Object.freeze({
    start: "text-left",
    center: "text-center",
    end: "text-right",
  }),
  // §36-2D-c 2026-09-15 · corners bounded extension
  corners: Object.freeze({
    sharp: "rounded-none",
    rounded_sm: "rounded-sm",
    rounded_md: "rounded-md",
    rounded_full: "rounded-full",
  }),
});

// ── Derived transforms (locked · 3) ─────────────────────────────────────

export type DerivedTransformId = "identity" | "format_number" | "join_strings";

export const DERIVED_TRANSFORMS: readonly DerivedTransformId[] = Object.freeze([
  "identity",
  "format_number",
  "join_strings",
]);

// ── State value kinds (locked · 4) ──────────────────────────────────────

export type StateValueKind = "string" | "number" | "operator_slot" | "digit_string";

export const STATE_VALUE_KINDS: readonly StateValueKind[] = Object.freeze([
  "string",
  "number",
  "operator_slot",
  "digit_string",
]);

// ── Refusal codes (locked · 14) ─────────────────────────────────────────

export type Route2dRefusalCode =
  | "R2D_INVALID_SPEC"
  | "R2D_APP_NAME_INVALID"
  | "R2D_ROUTE_PATH_OUTSIDE_NEX_GENERATED"
  | "R2D_UNKNOWN_UI_NODE_KIND"
  | "R2D_UNKNOWN_EVENT_KIND"
  | "R2D_UNKNOWN_STYLE_TOKEN"
  | "R2D_STATE_KEY_UNDECLARED"
  | "R2D_EVENT_ID_COLLISION"
  | "R2D_TOO_MANY_STATES"
  | "R2D_TOO_MANY_EVENTS"
  | "R2D_TOO_MANY_STYLE_TOKENS"
  | "R2D_PROHIBITED_STRING_CONTENT"
  | "R2D_INVALID_IDENTIFIER"
  | "R2D_ARBITRARY_CODE_ATTEMPT";

export const ROUTE_2D_REFUSAL_CODES: readonly Route2dRefusalCode[] = Object.freeze([
  "R2D_INVALID_SPEC",
  "R2D_APP_NAME_INVALID",
  "R2D_ROUTE_PATH_OUTSIDE_NEX_GENERATED",
  "R2D_UNKNOWN_UI_NODE_KIND",
  "R2D_UNKNOWN_EVENT_KIND",
  "R2D_UNKNOWN_STYLE_TOKEN",
  "R2D_STATE_KEY_UNDECLARED",
  "R2D_EVENT_ID_COLLISION",
  "R2D_TOO_MANY_STATES",
  "R2D_TOO_MANY_EVENTS",
  "R2D_TOO_MANY_STYLE_TOKENS",
  "R2D_PROHIBITED_STRING_CONTENT",
  "R2D_INVALID_IDENTIFIER",
  "R2D_ARBITRARY_CODE_ATTEMPT",
]);

// ── Locked bounds ───────────────────────────────────────────────────────

export const R2D_MAX_STATES = 8;
export const R2D_MAX_EVENTS = 16;
export const R2D_MAX_STYLE_TOKENS = 24;
export const R2D_MAX_UI_NODE_DEPTH = 6;
export const R2D_MAX_STRING_LENGTH = 128;
export const R2D_MAX_LITERAL_LENGTH = 64;

// ── Content ref (locked shape) ──────────────────────────────────────────

export type ContentRef =
  | { readonly kind: "literal"; readonly value: string }
  | { readonly kind: "state_key"; readonly key: string; readonly transform: DerivedTransformId }
  | { readonly kind: "derived"; readonly from_state_keys: readonly string[]; readonly transform: DerivedTransformId };

// ── UI node (locked shape · closed union) ───────────────────────────────

export type UINode =
  | { readonly kind: "container"; readonly children: readonly UINode[]; readonly style_ref: string | null }
  | { readonly kind: "text"; readonly content_ref: ContentRef; readonly style_ref: string | null }
  | { readonly kind: "button"; readonly label_ref: ContentRef; readonly on_press_event_id: string | null; readonly style_ref: string | null }
  | { readonly kind: "input"; readonly value_state_key: string; readonly kind_hint: "text" | "number"; readonly style_ref: string | null }
  | { readonly kind: "label"; readonly content_ref: ContentRef; readonly for_state_key: string | null; readonly style_ref: string | null }
  | { readonly kind: "display_region"; readonly content_ref: ContentRef; readonly style_ref: string | null };

// ── State declaration ───────────────────────────────────────────────────

export interface StateDeclaration {
  readonly state_key: string;                                    // [a-z][a-z0-9_-]{0,31}
  readonly value_kind: StateValueKind;
  readonly initial_literal: string | number | null;
}

// ── Event binding + payloads ────────────────────────────────────────────

export type EventPayload =
  | { readonly kind: "press_digit"; readonly digit: number }
  | { readonly kind: "press_operator"; readonly operator: OperatorId }
  | { readonly kind: "press_equals" }
  | { readonly kind: "press_clear" }
  | { readonly kind: "set_state_literal"; readonly target_state_key: string; readonly literal: string | number };

export interface EventBinding {
  readonly event_id: string;              // stable within-spec · [a-z][a-z0-9_-]{0,31}
  readonly event_kind: EventKindId;
  readonly payload: EventPayload;
}

// ── Style token binding ─────────────────────────────────────────────────

export interface StyleTokenBinding {
  readonly style_ref: string;             // [a-z][a-z0-9_-]{0,31}
  readonly tokens: readonly { readonly key: StyleTokenKey; readonly value: string }[];
}

// ── Component + prop declaration ───────────────────────────────────────

export interface PropDeclaration {
  readonly prop_name: string;             // camelCase
  readonly prop_type: "string" | "number" | "boolean";
}

export interface ComponentDeclaration {
  readonly component_name: string;        // PascalCase
  readonly root_node: UINode;
  readonly props: readonly PropDeclaration[];
}

// ── Test scenario ───────────────────────────────────────────────────────

export interface StateAssertion {
  readonly state_key: string;
  readonly expected_value: string | number;
}

export interface TestScenario {
  readonly scenario_id: string;
  readonly initial_state_overrides: readonly StateAssertion[];
  readonly event_sequence: readonly string[];  // event_ids from spec.events
  readonly final_state: readonly StateAssertion[];
}

// ── Root spec ───────────────────────────────────────────────────────────

export interface SmallApplicationSpec {
  readonly app_name: string;              // kebab-case · [a-z0-9-]{3,32}
  readonly header_comment: string;        // free-form (validated for prohibited substrings)
  readonly route_path: string;            // MUST start with "/nex-generated/"
  readonly component: ComponentDeclaration;
  readonly state: readonly StateDeclaration[];
  readonly events: readonly EventBinding[];
  readonly style_tokens: readonly StyleTokenBinding[];
  readonly test_scenarios: readonly TestScenario[];
}

// ── Emitted-file shape ──────────────────────────────────────────────────

export interface EmittedFile {
  readonly path: string;                  // workspace-relative · under src/app/nex-generated/<app_name>/
  readonly content: string;
  readonly byte_size: number;
  readonly sha256_hex: string;
}

// ── Request / response shapes ───────────────────────────────────────────

export interface AuthorSmallApplicationRequest {
  readonly spec: SmallApplicationSpec;
  readonly emit_tests: boolean;
}

export interface AuthorSmallApplicationSuccess {
  readonly ok: true;
  readonly emitted_files: readonly EmittedFile[];  // exactly 2 or 3 entries
  readonly spec_sha256: string;
  readonly grep_marker: "§36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring";
}

export interface AuthorSmallApplicationFailure {
  readonly ok: false;
  readonly refusal_code: Route2dRefusalCode;
  readonly reason: string;
  readonly offending_field: string | null;
  readonly grep_marker: "§36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring";
}

export type AuthorSmallApplicationResult = AuthorSmallApplicationSuccess | AuthorSmallApplicationFailure;
