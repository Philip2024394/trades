// WO-M-R-B · deterministic test-assertion parser.
//
// Founder-locked 2026-09-14. Parses `assert.equal(fn(...args), expected)`
// patterns out of a JS/MJS source file · extracts structured input/output
// pairs the matcher can then compare against reference implementations of
// each known algorithm_kind.
//
// This parser is PURE P-S. It cannot execute arbitrary code · it only
// recognises literal-argument shapes. If arguments contain expressions
// beyond string/number/boolean/negative-number literals, the assertion
// is recorded as UNPARSEABLE and skipped. That is safer than
// misinterpreting the input.

export interface ParsedAssertion {
  readonly function_name: string;
  readonly args: readonly (string | number | boolean | readonly (string | number | boolean)[])[];
  readonly expected: string | number | boolean | readonly (string | number | boolean)[];
  readonly source_snippet: string;   // for evidence audit
  readonly parseable: true;
}

export interface UnparseableAssertion {
  readonly source_snippet: string;
  readonly reason: string;
  readonly parseable: false;
}

export interface AssertionParseResult {
  readonly assertions: readonly ParsedAssertion[];
  readonly unparseable: readonly UnparseableAssertion[];
  readonly total_lines_scanned: number;
}

// ── Literal-argument grammar (deliberately restricted) ─────────────────

/** Parse a comma-separated argument list where each argument is one of:
 *  - "string with escapes"
 *  - 'single-quoted'
 *  - 123 (integer)
 *  - -1 (negative int)
 *  - 1.5 (float)
 *  - true / false
 *  Returns null if any argument is anything more complex (identifiers,
 *  arrays, objects, expressions). */
function parseLiteralArgs(raw: string): readonly (string | number | boolean | readonly (string | number | boolean)[])[] | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];
  const args: (string | number | boolean | readonly (string | number | boolean)[])[] = [];
  let i = 0;
  while (i < trimmed.length) {
    // Skip whitespace
    while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
    if (i >= trimmed.length) break;
    const ch = trimmed[i];
    if (ch === '"' || ch === "'") {
      // String literal · scan to matching close quote, honouring simple backslash escapes
      const quote = ch;
      let j = i + 1;
      let s = "";
      while (j < trimmed.length && trimmed[j] !== quote) {
        if (trimmed[j] === "\\" && j + 1 < trimmed.length) {
          const n = trimmed[j + 1];
          switch (n) {
            case "n": s += "\n"; break;
            case "t": s += "\t"; break;
            case "r": s += "\r"; break;
            case "\\": s += "\\"; break;
            case '"': s += '"'; break;
            case "'": s += "'"; break;
            default: s += n;
          }
          j += 2;
        } else {
          s += trimmed[j];
          j++;
        }
      }
      if (j >= trimmed.length) return null;   // unterminated string
      args.push(s);
      i = j + 1;
    } else if (ch === "[") {
      // Phase 2A · array literal (of literal elements only)
      let depth = 1;
      let j = i + 1;
      while (j < trimmed.length && depth > 0) {
        if (trimmed[j] === "[") depth++;
        else if (trimmed[j] === "]") depth--;
        if (depth > 0) j++;
      }
      if (j >= trimmed.length) return null;   // unterminated array
      const inner = trimmed.slice(i + 1, j);
      const parsedInner = parseLiteralArgs(inner);
      if (parsedInner === null) return null;
      // Array-of-literals only · reject nested arrays for this MVP
      const flat: (string | number | boolean)[] = [];
      for (const el of parsedInner) {
        if (Array.isArray(el)) return null;   // nested arrays not supported
        flat.push(el as string | number | boolean);
      }
      args.push(Object.freeze(flat));
      i = j + 1;
    } else if (ch === "-" || /[0-9]/.test(ch)) {
      // Number literal (integer or float, possibly negative)
      let j = i + 1;
      while (j < trimmed.length && /[0-9.eE+-]/.test(trimmed[j])) j++;
      const numStr = trimmed.slice(i, j);
      const num = Number(numStr);
      if (!Number.isFinite(num)) return null;
      args.push(num);
      i = j;
    } else if (trimmed.slice(i, i + 4) === "true") {
      args.push(true); i += 4;
    } else if (trimmed.slice(i, i + 5) === "false") {
      args.push(false); i += 5;
    } else {
      return null;   // unsupported argument (identifier, expression, object, etc.)
    }
    // Consume trailing whitespace + optional comma
    while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
    if (i < trimmed.length && trimmed[i] === ",") i++;
    else if (i < trimmed.length && !/\s/.test(trimmed[i])) return null;   // syntax error
  }
  return Object.freeze(args);
}

// ── Locate a balanced expression starting at position `start` ─────────

function extractBalanced(source: string, start: number, open: string, close: string): { text: string; end: number } | null {
  if (source[start] !== open) return null;
  let depth = 0;
  let inString: string | null = null;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (inString !== null) {
      if (c === "\\") { i++; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inString = c; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return { text: source.slice(start + 1, i), end: i };
    }
  }
  return null;
}

// ── Main parser · looks for assert.equal(callSite, expected) ──────────

export function parseTestAssertions(source: string): AssertionParseResult {
  const assertions: ParsedAssertion[] = [];
  const unparseable: UnparseableAssertion[] = [];

  // Strip block + line comments to reduce false-positive matches
  const clean = source.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  // Look for every `assert.equal(` or `assert.strictEqual(` or plain
  // `assert(...)` opening. For each, extract the parenthesised body.
  const ASSERT_RE = /assert(?:\.(?:equal|strictEqual|deepEqual|deepStrictEqual))?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = ASSERT_RE.exec(clean)) !== null) {
    const openIdx = m.index + m[0].length - 1;
    const balanced = extractBalanced(clean, openIdx, "(", ")");
    if (!balanced) { unparseable.push({ source_snippet: clean.slice(m.index, m.index + 80), reason: "unbalanced parentheses", parseable: false }); continue; }
    const body = balanced.text;

    // Split into top-level comma parts (respecting balanced parens/braces/strings)
    const topLevel = splitTopLevelCommas(body);
    if (topLevel.length < 2) {
      unparseable.push({ source_snippet: `assert...(${body.slice(0, 60)}…)`, reason: "expected at least 2 top-level args", parseable: false });
      continue;
    }
    const lhs = topLevel[0].trim();
    const rhs = topLevel[1].trim();

    // LHS may be `await fnName(args)` (Phase 2A · async support) or bare `fnName(args)`
    const lhsStripped = /^await\s+/.test(lhs) ? lhs.replace(/^await\s+/, "") : lhs;
    const callMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)$/.exec(lhsStripped);
    if (!callMatch) {
      unparseable.push({ source_snippet: lhs.slice(0, 80), reason: "LHS is not a simple function call", parseable: false });
      continue;
    }
    const fnName = callMatch[1];
    const argsRaw = callMatch[2];
    const parsedArgs = parseLiteralArgs(argsRaw);
    if (parsedArgs === null) {
      unparseable.push({ source_snippet: `${fnName}(${argsRaw.slice(0, 60)}…)`, reason: "arguments contain non-literal expressions", parseable: false });
      continue;
    }
    // RHS must be a single literal
    const parsedExpected = parseLiteralArgs(rhs);
    if (parsedExpected === null || parsedExpected.length !== 1) {
      unparseable.push({ source_snippet: rhs.slice(0, 80), reason: "expected value is not a single literal", parseable: false });
      continue;
    }
    assertions.push({
      function_name: fnName,
      args: parsedArgs,
      expected: parsedExpected[0],
      source_snippet: `assert.equal(${fnName}(${argsRaw.trim().slice(0, 60)}), ${rhs.slice(0, 40)})`,
      parseable: true,
    });
  }

  return {
    assertions: Object.freeze(assertions),
    unparseable: Object.freeze(unparseable),
    total_lines_scanned: clean.split("\n").length,
  };
}

// ── Top-level comma splitter (respects parens/braces/brackets/strings) ─

function splitTopLevelCommas(source: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString: string | null = null;
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (inString !== null) {
      if (c === "\\") { i++; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inString = c; continue; }
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(source.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}
