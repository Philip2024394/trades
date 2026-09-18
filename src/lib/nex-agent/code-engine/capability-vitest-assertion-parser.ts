// src/lib/nex-agent/code-engine/capability-vitest-assertion-parser.ts
//
// NEX1 · Fix 24 · deterministic parser for vitest assertion strings.
// Founder-authorised 2026-09-18 as part of the Class 2 Bridge build.
//
// PURPOSE
//   Given a raw assertion source string emitted by Fix J runtime diagnosis
//   (e.g. `expect(computeWorkerPool().size).toBe(3)`), extract the four
//   deterministic elements the Class 2 Bridge needs to compose an
//   ExpectedBehaviour:
//
//     · call target       — the function being called under expect(...)
//     · argument list     — verbatim arguments to that call
//     · property path     — chain of .field accesses after the call
//     · matcher form      — the matcher name (`toBe`, `toEqual`, ...)
//     · expected literal  — the raw expected-value token(s)
//
//   All parsing is deterministic, regex + light structural scanning; no
//   AST library beyond simple bracket-matching. Zero LLM. Zero external
//   dependency. Refusal is explicit and typed.
//
// SCOPE (v1, per founder decision D1)
//   Supported matchers (primitive only): toBe, toEqual, toStrictEqual.
//   Everything else refused cleanly.
//
// DISCIPLINE
//   · Zero LLM · zero external network · zero fabrication.
//   · Deterministic refusal via ParseAssertionRefusal (typed reason).
//   · Every output field carries evidence_kind: "OBSERVED".

export type AssertionMatcher = "toBe" | "toEqual" | "toStrictEqual";

export interface ParsedAssertion {
  readonly ok: true;
  readonly evidence_kind: "OBSERVED";
  /** Verbatim assertion string received. */
  readonly raw: string;
  /** The identifier called inside `expect(...)`. `computeWorkerPool` for
   *  `expect(computeWorkerPool().size).toBe(3)`. When the expression inside
   *  expect() is a bare identifier (no call), this is that identifier and
   *  argument_list_verbatim is null. */
  readonly call_target: string;
  /** Whether the expression inside expect() is a call form
   *  `identifier(...)`. False when it is a bare identifier (e.g., a value). */
  readonly is_call_form: boolean;
  /** Verbatim argument text between the outermost `(` and `)` of the call.
   *  Null when is_call_form is false. Empty string when the call is niladic
   *  (`computeWorkerPool()`). */
  readonly argument_list_verbatim: string | null;
  /** Chain of `.field` accesses after the call target's closing paren.
   *  Empty array when there is none. Ordered outermost-to-innermost as
   *  written in the source. */
  readonly property_path: readonly string[];
  /** Matcher form used (`toBe` | `toEqual` | `toStrictEqual`). */
  readonly matcher: AssertionMatcher;
  /** Verbatim text between the matcher's `(` and `)` (may include quotes,
   *  numbers, object literals, etc.). */
  readonly expected_literal_verbatim: string;
  /** Whether the expected literal is a simple primitive suitable for
   *  ExpectedBehaviour.expected_value. Matches
   *  Fix 22 normaliseLiteralText regex: `^\+?(-?\d+(?:\.\d+)?)$` OR a
   *  double-quoted string OR `true` | `false` | `null`. */
  readonly expected_is_simple_primitive: boolean;
  /** For simple primitives, the normalised value (strip surrounding
   *  quotes on strings, drop leading `+` on numbers). Null for
   *  non-primitives. */
  readonly expected_normalised: string | null;
}

export type ParseAssertionRefusalKind =
  | "empty_input"
  | "no_expect_call"
  | "unbalanced_parens"
  | "no_matcher_found"
  | "unsupported_matcher"
  | "no_expected_argument"
  | "expected_not_primitive";

export interface ParseAssertionRefusal {
  readonly ok: false;
  readonly refusal_kind: ParseAssertionRefusalKind;
  readonly detail: string;
  readonly raw: string;
}

export type ParseAssertionResult = ParsedAssertion | ParseAssertionRefusal;

const SUPPORTED_MATCHERS: readonly AssertionMatcher[] = [
  "toBe",
  "toEqual",
  "toStrictEqual",
];

// ── Small structural helpers (no AST library) ────────────────────────────

/** Find the index of the matching closing paren for the paren at openIdx.
 *  Returns -1 if unbalanced. Ignores parens inside single/double/backtick
 *  strings. */
function findMatchingParen(s: string, openIdx: number): number {
  if (s[openIdx] !== "(") return -1;
  let depth = 0;
  let i = openIdx;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escape = false;
  while (i < s.length) {
    const c = s[i];
    if (escape) {
      escape = false;
      i++;
      continue;
    }
    if (c === "\\") {
      escape = true;
      i++;
      continue;
    }
    if (!inDouble && !inBacktick && c === "'") inSingle = !inSingle;
    else if (!inSingle && !inBacktick && c === '"') inDouble = !inDouble;
    else if (!inSingle && !inDouble && c === "`") inBacktick = !inBacktick;
    else if (!inSingle && !inDouble && !inBacktick) {
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) return i;
      }
    }
    i++;
  }
  return -1;
}

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const NUM_RE = /^\+?(-?\d+(?:\.\d+)?)$/;
const STR_DBL_RE = /^"(.*)"$/;
const STR_SGL_RE = /^'(.*)'$/;

function classifyPrimitive(raw: string): {
  is_primitive: boolean;
  normalised: string | null;
} {
  const t = raw.trim();
  if (t === "") return { is_primitive: false, normalised: null };
  const num = t.match(NUM_RE);
  if (num) return { is_primitive: true, normalised: num[1] };
  const dbl = t.match(STR_DBL_RE);
  if (dbl) return { is_primitive: true, normalised: dbl[1] };
  const sgl = t.match(STR_SGL_RE);
  if (sgl) return { is_primitive: true, normalised: sgl[1] };
  if (t === "true" || t === "false" || t === "null") {
    return { is_primitive: true, normalised: t };
  }
  return { is_primitive: false, normalised: null };
}

// ── Public entry ─────────────────────────────────────────────────────────

/**
 * Parse a vitest assertion source string into structured elements.
 * Deterministic. Zero LLM. Returns typed refusal on any unsupported shape.
 */
export function parseVitestAssertion(rawInput: string | null | undefined): ParseAssertionResult {
  const raw = typeof rawInput === "string" ? rawInput.trim() : "";
  if (raw === "") {
    return { ok: false, refusal_kind: "empty_input", detail: "assertion string is empty or null", raw };
  }

  // Locate `expect(` — the first occurrence at a word boundary.
  const expectMatch = raw.match(/\bexpect\s*\(/);
  if (!expectMatch || expectMatch.index === undefined) {
    return {
      ok: false,
      refusal_kind: "no_expect_call",
      detail: `no \`expect(\` token found`,
      raw,
    };
  }
  const expectOpen = raw.indexOf("(", expectMatch.index);
  const expectClose = findMatchingParen(raw, expectOpen);
  if (expectClose < 0) {
    return {
      ok: false,
      refusal_kind: "unbalanced_parens",
      detail: `unbalanced parens starting at index ${expectOpen}`,
      raw,
    };
  }

  // Content between expect(...) parens.
  const inside = raw.slice(expectOpen + 1, expectClose);

  // Parse the inside as: identifier [ ( args ) ] [ .field ]*
  // Simplest deterministic scan:
  //   1. Read identifier at start.
  //   2. If followed by `(`, consume balanced parens as arg_list.
  //   3. Then consume any `.name` chain.
  const identMatch = inside.match(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (!identMatch) {
    return {
      ok: false,
      refusal_kind: "no_expect_call",
      detail: `no identifier at head of expect(...) body: ${JSON.stringify(inside)}`,
      raw,
    };
  }
  const call_target = identMatch[1];
  let cursor = identMatch.index! + identMatch[1].length + (identMatch[0].length - identMatch[1].length);

  let is_call_form = false;
  let argument_list_verbatim: string | null = null;

  // Skip whitespace
  while (cursor < inside.length && /\s/.test(inside[cursor])) cursor++;

  if (inside[cursor] === "(") {
    // Balance parens inside `inside`
    const argOpen = cursor;
    // Work in the outer raw string so findMatchingParen sees the same
    // structure — translate coords.
    const argOpenAbs = expectOpen + 1 + argOpen;
    const argCloseAbs = findMatchingParen(raw, argOpenAbs);
    if (argCloseAbs < 0 || argCloseAbs > expectClose) {
      return {
        ok: false,
        refusal_kind: "unbalanced_parens",
        detail: `argument list unbalanced inside expect() body`,
        raw,
      };
    }
    is_call_form = true;
    argument_list_verbatim = raw.slice(argOpenAbs + 1, argCloseAbs);
    cursor = argCloseAbs - (expectOpen + 1) + 1;
  }

  // Property path
  const property_path: string[] = [];
  while (cursor < inside.length && /\s/.test(inside[cursor])) cursor++;
  while (cursor < inside.length && inside[cursor] === ".") {
    cursor++;
    const propMatch = inside.slice(cursor).match(/^([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (!propMatch) break;
    property_path.push(propMatch[1]);
    cursor += propMatch[1].length;
    while (cursor < inside.length && /\s/.test(inside[cursor])) cursor++;
  }

  // Now, after expectClose in the outer `raw`, expect either `.toBe(...)`
  // (or chained `.not.toBe(...)` — we refuse `.not` in v1 per D1) or a
  // matcher call directly.
  let after = raw.slice(expectClose + 1).trimStart();

  // Consume a leading `.` and matcher identifier. Note: `.not.toBe` chains
  // are refused as unsupported in v1.
  if (after.startsWith(".not")) {
    return {
      ok: false,
      refusal_kind: "unsupported_matcher",
      detail: `\`.not.<matcher>\` chains are not supported in v1`,
      raw,
    };
  }
  if (!after.startsWith(".")) {
    return {
      ok: false,
      refusal_kind: "no_matcher_found",
      detail: `no matcher follows expect(...) — got: ${JSON.stringify(after.slice(0, 40))}`,
      raw,
    };
  }
  after = after.slice(1); // drop leading `.`
  const matcherMatch = after.match(/^([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (!matcherMatch) {
    return {
      ok: false,
      refusal_kind: "no_matcher_found",
      detail: `no matcher identifier: ${JSON.stringify(after.slice(0, 40))}`,
      raw,
    };
  }
  const matcherName = matcherMatch[1];
  if (!SUPPORTED_MATCHERS.includes(matcherName as AssertionMatcher)) {
    return {
      ok: false,
      refusal_kind: "unsupported_matcher",
      detail: `matcher \`${matcherName}\` not in v1 supported set (${SUPPORTED_MATCHERS.join(", ")})`,
      raw,
    };
  }
  const matcher = matcherName as AssertionMatcher;

  // Find matcher's opening paren
  const matcherOpenRel = after.indexOf("(", matcherMatch[0].length);
  if (matcherOpenRel < 0) {
    return {
      ok: false,
      refusal_kind: "no_matcher_found",
      detail: `matcher \`${matcher}\` has no argument list`,
      raw,
    };
  }
  const matcherOpenAbs = raw.length - after.length + matcherOpenRel;
  const matcherCloseAbs = findMatchingParen(raw, matcherOpenAbs);
  if (matcherCloseAbs < 0) {
    return {
      ok: false,
      refusal_kind: "unbalanced_parens",
      detail: `matcher argument list unbalanced`,
      raw,
    };
  }
  const expected_literal_verbatim = raw.slice(matcherOpenAbs + 1, matcherCloseAbs).trim();
  if (expected_literal_verbatim === "") {
    return {
      ok: false,
      refusal_kind: "no_expected_argument",
      detail: `matcher \`${matcher}\` called with no argument`,
      raw,
    };
  }

  const prim = classifyPrimitive(expected_literal_verbatim);

  return {
    ok: true,
    evidence_kind: "OBSERVED",
    raw,
    call_target,
    is_call_form,
    argument_list_verbatim,
    property_path,
    matcher,
    expected_literal_verbatim,
    expected_is_simple_primitive: prim.is_primitive,
    expected_normalised: prim.normalised,
  };
}

// Marker export identifying the module & version for provenance in receipts.
export const VITEST_ASSERTION_PARSER_VERSION = "fix24.v1";
export const VITEST_ASSERTION_PARSER_SUPPORTED_MATCHERS = SUPPORTED_MATCHERS;
