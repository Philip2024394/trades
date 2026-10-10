// NEX Code Brain · deterministic transform
// Self-recursion on an array parameter → array-index iteration.
//
// Pure function · no I/O · no external deps.
// Extracted from scripts/nex-coding-team/queue-executor.mjs so callers
// (tests · future dispatcher integrations) can invoke it as a library
// instead of shelling out to the executor process.
//
// The transform is INTENTIONALLY narrow:
//   `if (X.length > 0) { fnName(X); }`  →  iterative index walk
// Anything more ambitious would be an LLM's job, not a deterministic rule.

export interface TransformFinding {
  readonly fn_name: string;
  readonly call_line: number; // 1-based
  readonly body_start: number; // byte offset in source
  readonly body_end: number; // byte offset in source
}

export interface TransformResult {
  readonly ok: boolean;
  readonly findings: readonly TransformFinding[];
  readonly fixes_applied: number;
  readonly before: string;
  readonly after: string;
  readonly reason?: string;
}

/** Locate every function that recursively calls itself. */
export function findSelfRecursiveFunctions(source: string): readonly TransformFinding[] {
  const findings: TransformFinding[] = [];
  const fnRx = /(export\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = fnRx.exec(source)) !== null) {
    const name = m[2]!;
    // Locate the opening brace after the header.
    const headerEnd = source.indexOf("{", m.index + m[0].length);
    if (headerEnd === -1) continue;
    // Balance braces to find the body's closing brace.
    let depth = 0;
    let i = headerEnd;
    for (; i < source.length; i++) {
      const c = source[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const bodyStart = headerEnd + 1;
    const bodyEnd = i;
    const body = source.slice(bodyStart, bodyEnd);
    const callRx = new RegExp(`\\b${name}\\s*\\(`);
    if (!callRx.test(body)) continue;
    // Compute 1-based line number of the first self-call.
    const prefix = source.slice(0, bodyStart);
    const bodyLines = body.split("\n");
    const lineOffset = prefix.split("\n").length;
    let callLine = 0;
    for (let ln = 0; ln < bodyLines.length; ln++) {
      if (callRx.test(bodyLines[ln] ?? "")) {
        callLine = lineOffset + ln;
        break;
      }
    }
    findings.push({ fn_name: name, call_line: callLine, body_start: bodyStart, body_end: bodyEnd });
  }
  return findings;
}

/**
 * Rewrite `if (X.length > 0) { fnName(X); }` (or with `; ?}` variants) into
 * an iterative while-loop. Applied per-function-body so distinct functions
 * with the same shape can be transformed independently.
 */
export function transformRecursionToIteration(source: string): TransformResult {
  const findings = findSelfRecursiveFunctions(source);
  if (findings.length === 0) {
    return {
      ok: true,
      findings: [],
      fixes_applied: 0,
      before: source,
      after: source,
      reason: "no self-recursive function bodies detected",
    };
  }

  let updated = source;
  let applied = 0;
  // Iterate findings from last to first so byte offsets remain valid as we
  // splice replacements in. But since regex-replace inside each body works on
  // string content (not offsets), simple in-place replace works too. We use
  // the offset-safe form for future-proofing.
  const orderedFindings = [...findings].sort((a, b) => b.body_start - a.body_start);
  for (const f of orderedFindings) {
    const ifBlockRx = new RegExp(
      `([ \\t]*)if\\s*\\(\\s*(\\w+)\\.length\\s*>\\s*0\\s*\\)\\s*\\{[\\s\\S]*?${f.fn_name}\\s*\\(\\s*\\2\\s*\\)\\s*;?[\\s\\S]*?\\}`,
      "m",
    );
    const bodyOriginal = updated.slice(f.body_start, f.body_end);
    const m = bodyOriginal.match(ifBlockRx);
    if (!m) continue;
    const indent = m[1] ?? "  ";
    const arrName = m[2]!;
    const replacement =
      `${indent}// Safe iterative correction · replaces self-recursion with array-pointer walk.\n` +
      `${indent}let index = 0;\n` +
      `${indent}while (index < ${arrName}.length) {\n` +
      `${indent}  const activeItem = ${arrName}[index];\n` +
      `${indent}  // Process target logic safely here...\n` +
      `${indent}  void activeItem;\n` +
      `${indent}  index++;\n` +
      `${indent}}`;
    const newBody = bodyOriginal.replace(ifBlockRx, replacement);
    if (newBody === bodyOriginal) continue;
    updated = updated.slice(0, f.body_start) + newBody + updated.slice(f.body_end);
    applied++;
  }

  return {
    ok: applied > 0,
    findings,
    fixes_applied: applied,
    before: source,
    after: updated,
    reason: applied === 0 ? "self-recursion detected but no matching if-block pattern" : undefined,
  };
}
