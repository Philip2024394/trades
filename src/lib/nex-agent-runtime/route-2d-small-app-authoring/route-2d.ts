// §36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring
// NEX bounded infrastructure · Route 2d primitive · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function · zero I/O. authorSmallApplication(request) validates a
// SmallApplicationSpec (composed entirely of locked closed vocabularies)
// and returns deterministic TypeScript bytes for a Next.js page + component
// + optional test. Every emitted line comes from a locked template; no
// user-supplied string ever becomes executable code.

import { createHash } from "node:crypto";
import type {
  AuthorSmallApplicationFailure,
  AuthorSmallApplicationRequest,
  AuthorSmallApplicationResult,
  AuthorSmallApplicationSuccess,
  ContentRef,
  DerivedTransformId,
  EmittedFile,
  EventBinding,
  Route2dRefusalCode,
  SmallApplicationSpec,
  StyleTokenBinding,
  StyleTokenKey,
  UINode,
} from "./route-2d-types";
import {
  DERIVED_TRANSFORMS,
  EVENT_KINDS,
  OPERATOR_IDS,
  R2D_MAX_EVENTS,
  R2D_MAX_LITERAL_LENGTH,
  R2D_MAX_STATES,
  R2D_MAX_STRING_LENGTH,
  R2D_MAX_STYLE_TOKENS,
  R2D_MAX_UI_NODE_DEPTH,
  STATE_VALUE_KINDS,
  STYLE_TAILWIND_MAP,
  STYLE_TOKEN_KEYS,
  STYLE_TOKEN_VALUES,
  UI_NODE_KINDS,
} from "./route-2d-types";

const GREP_MARKER = "§36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring" as const;

// ── Prohibited substring guard (reuses the discipline from Route 2) ───

const PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
  "\0",
  "eval(",
  "Function(",
  "new Function",
  "child_process",
  "__proto__",
  "constructor.prototype",
  "<script",
  "</script",
  "javascript:",
  "onerror=",
  "onload=",
  "\\u",
]);

function containsProhibited(s: string): boolean {
  for (const p of PROHIBITED_SUBSTRINGS) if (s.includes(p)) return true;
  return false;
}

// ── Identifier validators ──────────────────────────────────────────────

const APP_NAME_RE = /^[a-z][a-z0-9-]{2,31}$/;
const IDENT_RE = /^[a-z][a-z0-9_-]{0,31}$/;
const COMPONENT_NAME_RE = /^[A-Z][A-Za-z0-9]{2,31}$/;
const PROP_NAME_RE = /^[a-z][a-zA-Z0-9]{0,31}$/;

function fail(
  code: Route2dRefusalCode,
  reason: string,
  offending_field: string | null = null,
): AuthorSmallApplicationFailure {
  return {
    ok: false,
    refusal_code: code,
    reason,
    offending_field,
    grep_marker: GREP_MARKER,
  };
}

// ── SHA helper ─────────────────────────────────────────────────────────

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// ── Path guard ─────────────────────────────────────────────────────────

function targetPathFor(app_name: string, filename: string): string {
  return `src/app/nex-generated/${app_name}/${filename}`;
}

function validateRoutePath(route_path: string, app_name: string): AuthorSmallApplicationFailure | null {
  if (typeof route_path !== "string") return fail("R2D_INVALID_SPEC", "route_path must be a string", "route_path");
  if (!route_path.startsWith("/nex-generated/")) return fail("R2D_ROUTE_PATH_OUTSIDE_NEX_GENERATED", `route_path must start with /nex-generated/`, "route_path");
  if (route_path.includes("..") || route_path.includes("\0")) return fail("R2D_ROUTE_PATH_OUTSIDE_NEX_GENERATED", "route_path contains traversal or null byte", "route_path");
  if (route_path !== `/nex-generated/${app_name}`) return fail("R2D_ROUTE_PATH_OUTSIDE_NEX_GENERATED", `route_path must be exactly /nex-generated/${app_name}`, "route_path");
  return null;
}

// ── Spec validators ────────────────────────────────────────────────────

function validateSpec(spec: SmallApplicationSpec): AuthorSmallApplicationFailure | null {
  if (!spec || typeof spec !== "object") return fail("R2D_INVALID_SPEC", "spec must be an object");
  // app_name
  if (typeof spec.app_name !== "string" || !APP_NAME_RE.test(spec.app_name)) {
    return fail("R2D_APP_NAME_INVALID", "app_name must match /^[a-z][a-z0-9-]{2,31}$/", "app_name");
  }
  // header_comment
  if (typeof spec.header_comment !== "string") return fail("R2D_INVALID_SPEC", "header_comment must be a string", "header_comment");
  if (spec.header_comment.length > 512) return fail("R2D_INVALID_SPEC", "header_comment too long", "header_comment");
  if (containsProhibited(spec.header_comment)) return fail("R2D_PROHIBITED_STRING_CONTENT", "header_comment contains prohibited content", "header_comment");
  // route_path
  const routeFail = validateRoutePath(spec.route_path, spec.app_name);
  if (routeFail) return routeFail;
  // component
  if (!spec.component || typeof spec.component !== "object") return fail("R2D_INVALID_SPEC", "component required", "component");
  if (typeof spec.component.component_name !== "string" || !COMPONENT_NAME_RE.test(spec.component.component_name)) {
    return fail("R2D_INVALID_IDENTIFIER", "component_name must be PascalCase [A-Z][A-Za-z0-9]{2,31}", "component.component_name");
  }
  if (!Array.isArray(spec.component.props)) return fail("R2D_INVALID_SPEC", "component.props must be array", "component.props");
  for (let i = 0; i < spec.component.props.length; i++) {
    const p = spec.component.props[i];
    if (!p || typeof p.prop_name !== "string" || !PROP_NAME_RE.test(p.prop_name)) {
      return fail("R2D_INVALID_IDENTIFIER", `component.props[${i}].prop_name invalid`, `component.props[${i}]`);
    }
    if (p.prop_type !== "string" && p.prop_type !== "number" && p.prop_type !== "boolean") {
      return fail("R2D_INVALID_SPEC", `component.props[${i}].prop_type invalid`, `component.props[${i}]`);
    }
  }
  // state
  if (!Array.isArray(spec.state)) return fail("R2D_INVALID_SPEC", "state must be array", "state");
  if (spec.state.length > R2D_MAX_STATES) return fail("R2D_TOO_MANY_STATES", `state.length > ${R2D_MAX_STATES}`, "state");
  const stateKeys = new Set<string>();
  for (let i = 0; i < spec.state.length; i++) {
    const s = spec.state[i];
    if (!s || typeof s.state_key !== "string" || !IDENT_RE.test(s.state_key)) {
      return fail("R2D_INVALID_IDENTIFIER", `state[${i}].state_key invalid`, `state[${i}]`);
    }
    if (stateKeys.has(s.state_key)) return fail("R2D_INVALID_SPEC", `duplicate state_key '${s.state_key}'`, `state[${i}]`);
    stateKeys.add(s.state_key);
    if (!STATE_VALUE_KINDS.includes(s.value_kind)) {
      return fail("R2D_INVALID_SPEC", `state[${i}].value_kind unknown`, `state[${i}]`);
    }
    if (s.initial_literal !== null && typeof s.initial_literal !== "string" && typeof s.initial_literal !== "number") {
      return fail("R2D_INVALID_SPEC", `state[${i}].initial_literal must be string|number|null`, `state[${i}]`);
    }
    if (typeof s.initial_literal === "string") {
      if (s.initial_literal.length > R2D_MAX_LITERAL_LENGTH) return fail("R2D_INVALID_SPEC", "initial_literal too long", `state[${i}]`);
      if (containsProhibited(s.initial_literal)) return fail("R2D_PROHIBITED_STRING_CONTENT", "initial_literal contains prohibited content", `state[${i}]`);
    }
  }
  // events
  if (!Array.isArray(spec.events)) return fail("R2D_INVALID_SPEC", "events must be array", "events");
  if (spec.events.length > R2D_MAX_EVENTS) return fail("R2D_TOO_MANY_EVENTS", `events.length > ${R2D_MAX_EVENTS}`, "events");
  const eventIds = new Set<string>();
  for (let i = 0; i < spec.events.length; i++) {
    const e = spec.events[i];
    if (!e || typeof e.event_id !== "string" || !IDENT_RE.test(e.event_id)) {
      return fail("R2D_INVALID_IDENTIFIER", `events[${i}].event_id invalid`, `events[${i}]`);
    }
    if (eventIds.has(e.event_id)) return fail("R2D_EVENT_ID_COLLISION", `duplicate event_id '${e.event_id}'`, `events[${i}]`);
    eventIds.add(e.event_id);
    if (!EVENT_KINDS.includes(e.event_kind)) {
      return fail("R2D_UNKNOWN_EVENT_KIND", `events[${i}].event_kind '${e.event_kind}' not in locked catalogue`, `events[${i}]`);
    }
    // payload shape must match event_kind
    const p = e.payload as { kind?: string; digit?: number; operator?: string; target_state_key?: string; literal?: unknown };
    if (!p || typeof p !== "object" || p.kind !== e.event_kind) {
      return fail("R2D_INVALID_SPEC", `events[${i}].payload.kind must equal events[${i}].event_kind`, `events[${i}]`);
    }
    if (e.event_kind === "press_digit") {
      if (typeof p.digit !== "number" || !Number.isInteger(p.digit) || p.digit < 0 || p.digit > 9) {
        return fail("R2D_INVALID_SPEC", `events[${i}].payload.digit must be integer 0..9`, `events[${i}]`);
      }
    } else if (e.event_kind === "press_operator") {
      if (!p.operator || !OPERATOR_IDS.includes(p.operator as never)) {
        return fail("R2D_INVALID_SPEC", `events[${i}].payload.operator must be one of ${OPERATOR_IDS.join("|")}`, `events[${i}]`);
      }
    } else if (e.event_kind === "set_state_literal") {
      if (typeof p.target_state_key !== "string" || !stateKeys.has(p.target_state_key)) {
        return fail("R2D_STATE_KEY_UNDECLARED", `events[${i}].payload.target_state_key '${p.target_state_key}' undeclared`, `events[${i}]`);
      }
      if (typeof p.literal !== "string" && typeof p.literal !== "number") {
        return fail("R2D_INVALID_SPEC", `events[${i}].payload.literal must be string|number`, `events[${i}]`);
      }
      if (typeof p.literal === "string") {
        if (p.literal.length > R2D_MAX_LITERAL_LENGTH) return fail("R2D_INVALID_SPEC", "literal too long", `events[${i}]`);
        if (containsProhibited(p.literal)) return fail("R2D_PROHIBITED_STRING_CONTENT", "literal contains prohibited content", `events[${i}]`);
      }
    }
  }
  // style_tokens
  if (!Array.isArray(spec.style_tokens)) return fail("R2D_INVALID_SPEC", "style_tokens must be array", "style_tokens");
  if (spec.style_tokens.length > R2D_MAX_STYLE_TOKENS) return fail("R2D_TOO_MANY_STYLE_TOKENS", `style_tokens.length > ${R2D_MAX_STYLE_TOKENS}`, "style_tokens");
  const styleRefs = new Set<string>();
  for (let i = 0; i < spec.style_tokens.length; i++) {
    const st = spec.style_tokens[i];
    if (!st || typeof st.style_ref !== "string" || !IDENT_RE.test(st.style_ref)) {
      return fail("R2D_INVALID_IDENTIFIER", `style_tokens[${i}].style_ref invalid`, `style_tokens[${i}]`);
    }
    if (styleRefs.has(st.style_ref)) return fail("R2D_INVALID_SPEC", `duplicate style_ref '${st.style_ref}'`, `style_tokens[${i}]`);
    styleRefs.add(st.style_ref);
    if (!Array.isArray(st.tokens)) return fail("R2D_INVALID_SPEC", `style_tokens[${i}].tokens must be array`, `style_tokens[${i}]`);
    for (let j = 0; j < st.tokens.length; j++) {
      const t = st.tokens[j];
      if (!t || !STYLE_TOKEN_KEYS.includes(t.key as StyleTokenKey)) {
        return fail("R2D_UNKNOWN_STYLE_TOKEN", `style_tokens[${i}].tokens[${j}].key '${t?.key}' not in locked keys`, `style_tokens[${i}].tokens[${j}]`);
      }
      const allowed = STYLE_TOKEN_VALUES[t.key as StyleTokenKey];
      if (!allowed.includes(t.value)) {
        return fail("R2D_UNKNOWN_STYLE_TOKEN", `style_tokens[${i}].tokens[${j}].value '${t.value}' not allowed for key '${t.key}'`, `style_tokens[${i}].tokens[${j}]`);
      }
    }
  }
  // component.root_node — recursive validation with depth limit
  const rootFail = validateUINode(spec.component.root_node, "component.root_node", 0, stateKeys, eventIds, styleRefs);
  if (rootFail) return rootFail;

  // test_scenarios (if any) — must reference declared event_ids + state_keys
  if (!Array.isArray(spec.test_scenarios)) return fail("R2D_INVALID_SPEC", "test_scenarios must be array", "test_scenarios");
  for (let i = 0; i < spec.test_scenarios.length; i++) {
    const s = spec.test_scenarios[i];
    if (!s || typeof s.scenario_id !== "string" || !IDENT_RE.test(s.scenario_id)) {
      return fail("R2D_INVALID_IDENTIFIER", `test_scenarios[${i}].scenario_id invalid`, `test_scenarios[${i}]`);
    }
    if (!Array.isArray(s.initial_state_overrides)) return fail("R2D_INVALID_SPEC", "initial_state_overrides must be array", `test_scenarios[${i}]`);
    for (const ov of s.initial_state_overrides) {
      if (!stateKeys.has(ov.state_key)) return fail("R2D_STATE_KEY_UNDECLARED", `override references undeclared state '${ov.state_key}'`, `test_scenarios[${i}]`);
    }
    if (!Array.isArray(s.event_sequence)) return fail("R2D_INVALID_SPEC", "event_sequence must be array", `test_scenarios[${i}]`);
    for (const ev of s.event_sequence) {
      if (!eventIds.has(ev)) return fail("R2D_INVALID_SPEC", `event_sequence references undeclared event_id '${ev}'`, `test_scenarios[${i}]`);
    }
    if (!Array.isArray(s.final_state)) return fail("R2D_INVALID_SPEC", "final_state must be array", `test_scenarios[${i}]`);
    for (const f of s.final_state) {
      if (!stateKeys.has(f.state_key)) return fail("R2D_STATE_KEY_UNDECLARED", `final_state references undeclared state '${f.state_key}'`, `test_scenarios[${i}]`);
    }
  }
  return null;
}

function validateUINode(
  node: UINode,
  path: string,
  depth: number,
  stateKeys: ReadonlySet<string>,
  eventIds: ReadonlySet<string>,
  styleRefs: ReadonlySet<string>,
): AuthorSmallApplicationFailure | null {
  if (!node || typeof node !== "object") return fail("R2D_INVALID_SPEC", `${path} must be an object`, path);
  if (!UI_NODE_KINDS.includes(node.kind)) return fail("R2D_UNKNOWN_UI_NODE_KIND", `${path}.kind '${(node as { kind?: string }).kind}' not in locked catalogue`, path);
  if (depth > R2D_MAX_UI_NODE_DEPTH) return fail("R2D_INVALID_SPEC", `UI tree depth exceeds ${R2D_MAX_UI_NODE_DEPTH}`, path);

  // style_ref check (nullable)
  const styleRef = (node as { style_ref?: string | null }).style_ref;
  if (styleRef !== null && styleRef !== undefined) {
    if (typeof styleRef !== "string" || !styleRefs.has(styleRef)) {
      return fail("R2D_INVALID_SPEC", `${path}.style_ref '${styleRef}' undeclared`, path);
    }
  }

  if (node.kind === "container") {
    if (!Array.isArray(node.children)) return fail("R2D_INVALID_SPEC", `${path}.children must be array`, path);
    for (let i = 0; i < node.children.length; i++) {
      const cf = validateUINode(node.children[i], `${path}.children[${i}]`, depth + 1, stateKeys, eventIds, styleRefs);
      if (cf) return cf;
    }
    return null;
  }
  if (node.kind === "button") {
    if (node.on_press_event_id !== null && !eventIds.has(node.on_press_event_id)) {
      return fail("R2D_INVALID_SPEC", `${path}.on_press_event_id '${node.on_press_event_id}' undeclared`, path);
    }
    return validateContentRef(node.label_ref, `${path}.label_ref`, stateKeys);
  }
  if (node.kind === "input") {
    if (!stateKeys.has(node.value_state_key)) return fail("R2D_STATE_KEY_UNDECLARED", `${path}.value_state_key '${node.value_state_key}' undeclared`, path);
    return null;
  }
  if (node.kind === "text" || node.kind === "label" || node.kind === "display_region") {
    return validateContentRef(node.content_ref, `${path}.content_ref`, stateKeys);
  }
  return null;
}

function validateContentRef(ref: ContentRef, path: string, stateKeys: ReadonlySet<string>): AuthorSmallApplicationFailure | null {
  if (!ref || typeof ref !== "object") return fail("R2D_INVALID_SPEC", `${path} must be an object`, path);
  if (ref.kind === "literal") {
    if (typeof ref.value !== "string") return fail("R2D_INVALID_SPEC", `${path}.value must be a string`, path);
    if (ref.value.length > R2D_MAX_LITERAL_LENGTH) return fail("R2D_INVALID_SPEC", `${path}.value too long`, path);
    if (containsProhibited(ref.value)) return fail("R2D_PROHIBITED_STRING_CONTENT", `${path}.value contains prohibited content`, path);
    // JSX safety: reject any string containing HTML tag-shape openers
    if (/<[a-zA-Z\/]/.test(ref.value)) return fail("R2D_ARBITRARY_CODE_ATTEMPT", `${path}.value contains tag-shaped content`, path);
    return null;
  }
  if (ref.kind === "state_key") {
    if (!stateKeys.has(ref.key)) return fail("R2D_STATE_KEY_UNDECLARED", `${path}.key '${ref.key}' undeclared`, path);
    if (!DERIVED_TRANSFORMS.includes(ref.transform)) return fail("R2D_INVALID_SPEC", `${path}.transform '${ref.transform}' unknown`, path);
    return null;
  }
  if (ref.kind === "derived") {
    if (!Array.isArray(ref.from_state_keys)) return fail("R2D_INVALID_SPEC", `${path}.from_state_keys must be array`, path);
    for (const k of ref.from_state_keys) {
      if (!stateKeys.has(k)) return fail("R2D_STATE_KEY_UNDECLARED", `${path}.from_state_keys contains undeclared '${k}'`, path);
    }
    if (!DERIVED_TRANSFORMS.includes(ref.transform)) return fail("R2D_INVALID_SPEC", `${path}.transform '${ref.transform}' unknown`, path);
    return null;
  }
  return fail("R2D_INVALID_SPEC", `${path}.kind unknown`, path);
}

// ── Renderers ──────────────────────────────────────────────────────────

function renderContentRefForJsx(ref: ContentRef): string {
  if (ref.kind === "literal") {
    // Escape JSX-hostile chars: backticks, curly braces via double-quoted string wrap
    return JSON.stringify(ref.value);
  }
  if (ref.kind === "state_key") {
    return `applyTransform_${ref.transform}(state[${JSON.stringify(ref.key)}])`;
  }
  // derived
  const list = ref.from_state_keys.map((k) => `state[${JSON.stringify(k)}]`).join(", ");
  if (ref.transform === "join_strings") return `transformJoinStrings([${list}])`;
  return `applyTransform_${ref.transform}(${list})`;
}

function renderStyleClasses(style_ref: string | null, styleMap: ReadonlyMap<string, StyleTokenBinding>): string {
  if (!style_ref) return "";
  const binding = styleMap.get(style_ref);
  if (!binding) return "";
  const classes: string[] = [];
  for (const t of binding.tokens) {
    const cls = STYLE_TAILWIND_MAP[t.key as StyleTokenKey]?.[t.value];
    if (cls) classes.push(cls);
  }
  return classes.join(" ");
}

function renderNode(node: UINode, styleMap: ReadonlyMap<string, StyleTokenBinding>, indent: string): string {
  const styleRef = (node as { style_ref?: string | null }).style_ref ?? null;
  const cls = renderStyleClasses(styleRef, styleMap);
  const classAttr = cls ? ` className=${JSON.stringify(cls)}` : "";
  if (node.kind === "container") {
    const children = node.children.map((c) => renderNode(c, styleMap, indent + "  ")).join("\n");
    return `${indent}<div${classAttr}>\n${children}\n${indent}</div>`;
  }
  if (node.kind === "text") {
    return `${indent}<span${classAttr}>{${renderContentRefForJsx(node.content_ref)}}</span>`;
  }
  if (node.kind === "button") {
    const onClick = node.on_press_event_id ? ` onClick={handleEvent_${node.on_press_event_id}}` : "";
    return `${indent}<button type="button"${classAttr}${onClick}>{${renderContentRefForJsx(node.label_ref)}}</button>`;
  }
  if (node.kind === "input") {
    const type = node.kind_hint === "number" ? "number" : "text";
    return `${indent}<input type="${type}"${classAttr} value={String(state[${JSON.stringify(node.value_state_key)}] ?? "")} readOnly />`;
  }
  if (node.kind === "label") {
    const htmlFor = node.for_state_key ? ` htmlFor=${JSON.stringify(node.for_state_key)}` : "";
    return `${indent}<label${classAttr}${htmlFor}>{${renderContentRefForJsx(node.content_ref)}}</label>`;
  }
  if (node.kind === "display_region") {
    return `${indent}<div role="status" aria-live="polite"${classAttr}>{${renderContentRefForJsx(node.content_ref)}}</div>`;
  }
  return `${indent}<span />`;
}

// ── Event handler emission ─────────────────────────────────────────────

function renderEventHandler(e: EventBinding, keyRoles: KeyRoles): string {
  const disp = JSON.stringify(keyRoles.display);
  const prev = JSON.stringify(keyRoles.previous);
  const opk = JSON.stringify(keyRoles.operator);
  switch (e.event_kind) {
    case "press_digit": {
      const p = e.payload as { digit: number };
      return `  const handleEvent_${e.event_id} = () => setState((s) => handlePressDigit(s, ${p.digit}, ${disp}));`;
    }
    case "press_operator": {
      const p = e.payload as { operator: string };
      return `  const handleEvent_${e.event_id} = () => setState((s) => handlePressOperator(s, ${JSON.stringify(p.operator)}, ${disp}, ${prev}, ${opk}));`;
    }
    case "press_equals":
      return `  const handleEvent_${e.event_id} = () => setState((s) => handlePressEquals(s, ${disp}, ${prev}, ${opk}));`;
    case "press_clear":
      return `  const handleEvent_${e.event_id} = () => setState((s) => handlePressClear(s, ${disp}, ${prev}, ${opk}));`;
    case "set_state_literal": {
      const p = e.payload as { target_state_key: string; literal: string | number };
      return `  const handleEvent_${e.event_id} = () => setState((s) => handleSetStateLiteral(s, ${JSON.stringify(p.target_state_key)}, ${JSON.stringify(p.literal)}));`;
    }
    default:
      return `  const handleEvent_${e.event_id} = () => undefined;`;
  }
}

// ── Locked "key role" inference ────────────────────────────────────────
//
// The runtime handlers need to know which state_key acts as "display",
// "previous", "operator". We infer by value_kind. If exactly one state has
// each role we use that; else we fall back to placeholder names that will
// still resolve at runtime (setter picks up undefined gracefully).

interface KeyRoles {
  readonly display: string;
  readonly previous: string;
  readonly operator: string;
}

function inferKeyRoles(spec: SmallApplicationSpec): KeyRoles {
  const byKind = new Map<string, string[]>();
  for (const s of spec.state) {
    const arr = byKind.get(s.value_kind) ?? [];
    arr.push(s.state_key);
    byKind.set(s.value_kind, arr);
  }
  return {
    display: (byKind.get("digit_string") ?? byKind.get("string") ?? ["display"])[0],
    previous: (byKind.get("number") ?? ["previous"])[0],
    operator: (byKind.get("operator_slot") ?? ["operator"])[0],
  };
}

// ── Initial state literal renderer ─────────────────────────────────────

function renderStateInitializer(spec: SmallApplicationSpec): string {
  const parts: string[] = [];
  for (const s of spec.state) {
    const v = s.initial_literal;
    if (v === null) parts.push(`  ${JSON.stringify(s.state_key)}: null`);
    else if (typeof v === "number") parts.push(`  ${JSON.stringify(s.state_key)}: ${v}`);
    else parts.push(`  ${JSON.stringify(s.state_key)}: ${JSON.stringify(v)}`);
  }
  return `{\n${parts.join(",\n")}\n}`;
}

// ── Transform imports used by rendered JSX ─────────────────────────────

function renderTransformImports(): string {
  return `import { transformIdentity as applyTransform_identity, transformFormatNumber as applyTransform_format_number, transformJoinStrings } from "@/lib/nex-agent-runtime/route-2d-small-app-authoring/event-handler-runtime";`;
}

function renderHandlerImports(usedKinds: ReadonlySet<string>): string {
  const parts: string[] = [];
  if (usedKinds.has("press_digit")) parts.push("handlePressDigit");
  if (usedKinds.has("press_operator")) parts.push("handlePressOperator");
  if (usedKinds.has("press_equals")) parts.push("handlePressEquals");
  if (usedKinds.has("press_clear")) parts.push("handlePressClear");
  if (usedKinds.has("set_state_literal")) parts.push("handleSetStateLiteral");
  if (parts.length === 0) return "";
  return `import { ${parts.join(", ")} } from "@/lib/nex-agent-runtime/route-2d-small-app-authoring/event-handler-runtime";`;
}

// ── Emit page.tsx ──────────────────────────────────────────────────────

function emitPageTsx(spec: SmallApplicationSpec): string {
  const header = renderHeader(spec);
  return `${header}
"use client";

import { ${spec.component.component_name} } from "./${spec.component.component_name}";

export default function Page() {
  return <${spec.component.component_name} />;
}
`;
}

// ── Emit component.tsx ─────────────────────────────────────────────────

function emitComponentTsx(spec: SmallApplicationSpec): string {
  const header = renderHeader(spec);
  const keyRoles = inferKeyRoles(spec);
  const styleMap = new Map(spec.style_tokens.map((st) => [st.style_ref, st] as const));
  const usedKinds = new Set<string>(spec.events.map((e) => e.event_kind));
  const jsx = renderNode(spec.component.root_node, styleMap, "    ");
  const handlers = spec.events.map((e) => renderEventHandler(e, keyRoles)).join("\n");
  const stateInit = renderStateInitializer(spec);
  const handlerImports = renderHandlerImports(usedKinds);
  const transformImports = renderTransformImports();
  return `${header}
"use client";

import { useState } from "react";
${handlerImports}
${transformImports}

export function ${spec.component.component_name}() {
  const [state, setState] = useState<Record<string, string | number | null>>(${stateInit});
${handlers}
  return (
${jsx}
  );
}
`;
}

// ── Emit component.test.tsx ────────────────────────────────────────────

function emitComponentTestTsx(spec: SmallApplicationSpec): string {
  const header = renderHeader(spec);
  const keyRoles = inferKeyRoles(spec);
  const stateInit = renderStateInitializer(spec);
  const usedKinds = new Set<string>(spec.events.map((e) => e.event_kind));
  const handlerImports = renderHandlerImports(usedKinds);
  // Table of event_id → handler call
  const dispatchLines: string[] = [];
  for (const e of spec.events) {
    dispatchLines.push(`      case ${JSON.stringify(e.event_id)}:`);
    if (e.event_kind === "press_digit") {
      dispatchLines.push(`        return handlePressDigit(prev, ${(e.payload as { digit: number }).digit}, ${JSON.stringify(keyRoles.display)});`);
    } else if (e.event_kind === "press_operator") {
      dispatchLines.push(`        return handlePressOperator(prev, ${JSON.stringify((e.payload as { operator: string }).operator)}, ${JSON.stringify(keyRoles.display)}, ${JSON.stringify(keyRoles.previous)}, ${JSON.stringify(keyRoles.operator)});`);
    } else if (e.event_kind === "press_equals") {
      dispatchLines.push(`        return handlePressEquals(prev, ${JSON.stringify(keyRoles.display)}, ${JSON.stringify(keyRoles.previous)}, ${JSON.stringify(keyRoles.operator)});`);
    } else if (e.event_kind === "press_clear") {
      dispatchLines.push(`        return handlePressClear(prev, ${JSON.stringify(keyRoles.display)}, ${JSON.stringify(keyRoles.previous)}, ${JSON.stringify(keyRoles.operator)});`);
    } else if (e.event_kind === "set_state_literal") {
      const p = e.payload as { target_state_key: string; literal: string | number };
      dispatchLines.push(`        return handleSetStateLiteral(prev, ${JSON.stringify(p.target_state_key)}, ${JSON.stringify(p.literal)});`);
    }
  }
  const dispatch = dispatchLines.join("\n");
  const scenarios: string[] = [];
  for (const s of spec.test_scenarios) {
    const overrides = s.initial_state_overrides.map((o) => `${JSON.stringify(o.state_key)}: ${JSON.stringify(o.expected_value)}`).join(", ");
    const finalAsserts = s.final_state.map((f) => `    expect(state[${JSON.stringify(f.state_key)}]).toBe(${JSON.stringify(f.expected_value)});`).join("\n");
    scenarios.push(`  it(${JSON.stringify(s.scenario_id)}, () => {
    let state = { ...${stateInit}${overrides ? `, ${overrides}` : ""} };
    for (const ev of ${JSON.stringify(s.event_sequence)}) state = dispatch(state, ev);
${finalAsserts}
  });`);
  }
  return `${header}

import { describe, it, expect } from "vitest";
${handlerImports}

type State = Record<string, string | number | null>;

function dispatch(prev: State, event_id: string): State {
  switch (event_id) {
${dispatch}
      default:
        return prev;
    }
}

describe(${JSON.stringify(spec.component.component_name)}, () => {
${scenarios.join("\n")}
});
`;
}

// ── Header renderer ────────────────────────────────────────────────────

function renderHeader(spec: SmallApplicationSpec): string {
  const banner = spec.header_comment.trim();
  const lines: string[] = [];
  lines.push(`// ${GREP_MARKER}`);
  lines.push(`// Coded by NEX1 via route_2d_small_application · 2026-09-14`);
  if (banner.length > 0) {
    for (const line of banner.split(/\r?\n/)) lines.push(`// ${line.replace(/^\/\/\s*/, "")}`);
  }
  lines.push(`// Contract: ${spec.component.component_name}`);
  lines.push(`// Deterministic byte-stable output. Do not edit by hand.`);
  return lines.join("\n");
}

// ── Entry point ────────────────────────────────────────────────────────

export function authorSmallApplication(request: AuthorSmallApplicationRequest): AuthorSmallApplicationResult {
  if (!request || typeof request !== "object") return fail("R2D_INVALID_SPEC", "request must be an object");
  const { spec, emit_tests } = request;
  const specFail = validateSpec(spec);
  if (specFail) return specFail;

  // Emit
  const pageContent = emitPageTsx(spec);
  const componentContent = emitComponentTsx(spec);
  const emitted: EmittedFile[] = [
    toEmittedFile(targetPathFor(spec.app_name, "page.tsx"), pageContent),
    toEmittedFile(targetPathFor(spec.app_name, `${spec.component.component_name}.tsx`), componentContent),
  ];
  if (emit_tests && spec.test_scenarios.length > 0) {
    const testContent = emitComponentTestTsx(spec);
    emitted.push(toEmittedFile(targetPathFor(spec.app_name, `${spec.component.component_name}.test.tsx`), testContent));
  }

  const specSha = sha256Hex(JSON.stringify(spec));
  const success: AuthorSmallApplicationSuccess = {
    ok: true,
    emitted_files: Object.freeze(emitted),
    spec_sha256: specSha,
    grep_marker: GREP_MARKER,
  };
  return success;
}

function toEmittedFile(p: string, content: string): EmittedFile {
  return {
    path: p,
    content,
    byte_size: Buffer.byteLength(content, "utf8"),
    sha256_hex: sha256Hex(content),
  };
}

// Assert against unused-string warnings by re-exporting R2D_MAX_STRING_LENGTH.
export const R2D_MAX_STRING_LENGTH_EXPORTED = R2D_MAX_STRING_LENGTH;
