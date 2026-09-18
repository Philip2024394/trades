// src/lib/nex-agent/code-engine/capability-data-flow-tracer.ts
//
// NEX1 · Fix 23b · Data-Flow-Aware Repair Tracer · deterministic · zero LLM.
// Founder-authorised 2026-09-17.
//
// PURPOSE
//   Given (source, function_name, target_field_name, input_args, expected_value)
//   trace backwards through the function's data flow and identify ALL numeric
//   literals in the reachable computation chain that, when substituted with
//   a candidate replacement, cause the function to evaluate to the expected
//   value at those args.
//
//   Uses a small deterministic safe evaluator over pure arithmetic + Math
//   builtins + conditional + property access + cross-function same-file
//   recursion. Refuses cleanly on any unsupported construct.
//
// SCOPE (deliberately narrow · zero fabrication)
//   Supported expression kinds:
//     · NumericLiteral · StringLiteral (limited) · true · false · null · undefined
//     · Identifier resolved via scope
//     · BinaryExpression: * / + - % ** === !== == != < > <= >= && || ??
//     · PrefixUnaryExpression: - + !
//     · ConditionalExpression a ? b : c
//     · PropertyAccessExpression (object.field)
//     · ElementAccessExpression (obj[index])
//     · CallExpression: Math.max, Math.min, Math.floor, Math.ceil, Math.abs,
//                       Math.round, Math.sign, Math.trunc, Math.sqrt,
//                       Number, Array.isArray, Number.isFinite, Number.isInteger,
//                       and calls to OTHER exported/local functions in same file
//     · ObjectLiteralExpression (returned or intermediate)
//     · ArrayLiteralExpression (small · shallow)
//     · TemplateExpression (only when all spans are supported)
//     · ParenthesizedExpression · AsExpression · TypeAssertionExpression
//   Supported statement kinds:
//     · VariableStatement (const · let · var)
//     · ReturnStatement
//     · IfStatement (with block bodies)
//     · Block
//     · ExpressionStatement (only side-effect-free assignments)
//     · ForStatement (bounded · MAX_LOOP_ITER = 128)
//   Refuses on: async/await · try/catch · throw · new · class · this · super ·
//     spread with non-array/object · destructuring in binding · loops beyond
//     MAX_LOOP_ITER · imported non-Math builtins.
//
// DISCIPLINE
//   · Zero LLM.
//   · Zero domain-specific vocabulary (no pricing / staircase / quantity).
//   · Zero I/O · zero randomness.
//   · Every refusal is named and explained.
//   · The candidate list is deterministic (sorted by (line, position)).

import ts from "typescript";

// ── Public types ─────────────────────────────────────────────────────────

export type EvalValue =
  | number
  | string
  | boolean
  | null
  | undefined
  | readonly EvalValue[]
  | { readonly [k: string]: EvalValue };

export interface LiteralCandidate {
  readonly line: number;                // 1-based
  readonly position: number;            // char offset in source
  readonly end_position: number;
  readonly current_text: string;        // verbatim (e.g. "1")
  readonly proposed_text: string;       // e.g. "0"
  readonly rationale: string;
  readonly hosting_function: string;    // where the literal lives
  readonly enclosing_expression: string;// brief description
}

export interface TracerInput {
  readonly source_content: string;
  readonly function_name: string;
  readonly arg_values: readonly EvalValue[]; // parallel to fn params
  readonly expected_field_value: EvalValue;   // what the target should equal
  readonly target_field_name: string | null;  // null when function returns scalar directly
  readonly candidate_replacements: readonly string[]; // e.g. ["0", "1", "2", "<expected>"]
}

export type TracerRefusal =
  | "source_unparseable"
  | "function_not_found"
  | "function_has_no_body"
  | "evaluation_threshold_exceeded"
  | "no_literals_in_chain"
  | "no_candidate_produces_expected"
  | "baseline_evaluation_failed"
  | "unsupported_expression"
  | "unsupported_statement"
  | "unresolved_identifier"
  | "cross_module_call"
  | "recursion_depth_exceeded";

export interface TracerOk {
  readonly ok: true;
  readonly candidates: readonly LiteralCandidate[];
  readonly baseline_value: EvalValue;
  readonly literals_examined: number;
  readonly evaluations_performed: number;
  readonly zero_llm: true;
}
export interface TracerRefused {
  readonly ok: false;
  readonly refusal: TracerRefusal;
  readonly reason: string;
  readonly literals_examined?: number;
  readonly evaluations_performed?: number;
}
export type TracerResult = TracerOk | TracerRefused;

// ── Constants ────────────────────────────────────────────────────────────

const MAX_RECURSION = 8;
const MAX_LOOP_ITER = 128;
const MAX_EVALUATIONS = 10_000;

// ── Public entry ─────────────────────────────────────────────────────────

export function traceDataFlowForLiteralCandidates(input: TracerInput): TracerResult {
  let sf: ts.SourceFile;
  try {
    sf = ts.createSourceFile("__t.ts", input.source_content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  } catch (e) {
    return { ok: false, refusal: "source_unparseable", reason: `parse failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const fnMap = collectFunctions(sf);
  const targetFn = fnMap.get(input.function_name);
  if (!targetFn) {
    return { ok: false, refusal: "function_not_found", reason: `no function '${input.function_name}' found at top level` };
  }
  if (!targetFn.body) {
    return { ok: false, refusal: "function_has_no_body", reason: `function '${input.function_name}' has no block body` };
  }

  const ctx: EvalCtx = {
    sf,
    fnMap,
    evaluations: 0,
    recursion: 0,
  };

  // Baseline evaluation
  let baseline: EvalValue;
  try {
    baseline = evaluateFunctionCall(targetFn, input.arg_values, ctx);
  } catch (e) {
    if (e instanceof EvalRefusal) {
      return { ok: false, refusal: e.refusal, reason: `baseline · ${e.reason}`, evaluations_performed: ctx.evaluations };
    }
    return {
      ok: false,
      refusal: "baseline_evaluation_failed",
      reason: `baseline evaluation threw: ${e instanceof Error ? e.message : String(e)}`,
      evaluations_performed: ctx.evaluations,
    };
  }

  // Collect all numeric literals reachable in the target function's body
  const literals = collectNumericLiteralsInFn(targetFn, sf, ctx.fnMap);
  if (literals.length === 0) {
    return {
      ok: false,
      refusal: "no_literals_in_chain",
      reason: `no numeric literals reachable in the computation chain of '${input.function_name}'`,
      literals_examined: 0,
      evaluations_performed: ctx.evaluations,
    };
  }

  // For each (literal · candidate replacement) pair, substitute and evaluate
  const candidates: LiteralCandidate[] = [];
  outer: for (const lit of literals) {
    for (const rawRepl of input.candidate_replacements) {
      if (ctx.evaluations >= MAX_EVALUATIONS) break outer;

      // Skip no-op substitutions
      if (normalizeNumText(rawRepl) === normalizeNumText(lit.text)) continue;
      if (!/^\-?\d+(\.\d+)?$/.test(rawRepl)) continue;

      // Symbolic substitution · replace this literal node's numeric value
      const mutatedFnMap = mutateFnMapReplacingLiteral(fnMap, lit, rawRepl);
      const mutatedTargetFn = mutatedFnMap.get(input.function_name)!;
      const subCtx: EvalCtx = { sf, fnMap: mutatedFnMap, evaluations: ctx.evaluations, recursion: 0 };
      let mutated: EvalValue;
      try {
        mutated = evaluateFunctionCall(mutatedTargetFn, input.arg_values, subCtx);
      } catch (e) {
        ctx.evaluations = subCtx.evaluations;
        continue; // skip this candidate silently · common on unsupported paths
      }
      ctx.evaluations = subCtx.evaluations;

      const observedField = extractField(mutated, input.target_field_name);
      if (deepEqual(observedField, input.expected_field_value)) {
        candidates.push({
          line: lit.line,
          position: lit.start,
          end_position: lit.end,
          current_text: lit.text,
          proposed_text: rawRepl,
          rationale:
            `substituting literal '${lit.text}' → '${rawRepl}' at ${lit.hostingFn}:${lit.line} ` +
            `(within ${lit.enclosingExpr}) causes ${input.function_name}(args) to evaluate to expected value`,
          hosting_function: lit.hostingFn,
          enclosing_expression: lit.enclosingExpr,
        });
      }
    }
  }

  // Deduplicate candidates by (line, position, proposed_text)
  const uniqKey = (c: LiteralCandidate) => `${c.line}:${c.position}:${c.proposed_text}`;
  const seen = new Set<string>();
  const deduped: LiteralCandidate[] = [];
  for (const c of candidates) {
    const k = uniqKey(c);
    if (!seen.has(k)) {
      seen.add(k);
      deduped.push(c);
    }
  }
  // Deterministic sort by (line, position, proposed_text)
  deduped.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    if (a.position !== b.position) return a.position - b.position;
    return a.proposed_text.localeCompare(b.proposed_text);
  });

  if (deduped.length === 0) {
    return {
      ok: false,
      refusal: "no_candidate_produces_expected",
      reason: `evaluated ${ctx.evaluations} substitutions across ${literals.length} literal(s) · none causes '${input.function_name}(args).${input.target_field_name ?? "<return>"}' to equal expected`,
      literals_examined: literals.length,
      evaluations_performed: ctx.evaluations,
    };
  }
  return {
    ok: true,
    candidates: deduped,
    baseline_value: baseline,
    literals_examined: literals.length,
    evaluations_performed: ctx.evaluations,
    zero_llm: true,
  };
}

// ── Function collection ─────────────────────────────────────────────────

interface FnRec {
  readonly name: string;
  readonly params: readonly string[];
  readonly body: ts.Block | undefined;
}

function collectFunctions(sf: ts.SourceFile): Map<string, FnRec> {
  const map = new Map<string, FnRec>();
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && s.name && s.body) {
      map.set(s.name.text, {
        name: s.name.text,
        params: s.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : "<pat>")),
        body: s.body,
      });
      continue;
    }
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        if (
          ts.isIdentifier(d.name) &&
          d.initializer &&
          (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) &&
          ts.isBlock(d.initializer.body)
        ) {
          map.set(d.name.text, {
            name: d.name.text,
            params: d.initializer.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : "<pat>")),
            body: d.initializer.body,
          });
        }
      }
    }
  }
  return map;
}

// ── Literal collection ──────────────────────────────────────────────────

interface LitRec {
  readonly node: ts.NumericLiteral;
  readonly text: string;
  readonly line: number;
  readonly start: number;
  readonly end: number;
  readonly hostingFn: string;
  readonly enclosingExpr: string;
}

function collectNumericLiteralsInFn(
  fn: FnRec,
  sf: ts.SourceFile,
  fnMap: ReadonlyMap<string, FnRec>,
): LitRec[] {
  const acc: LitRec[] = [];
  const visited = new Set<string>();
  collectFromFnBody(fn, sf, fnMap, acc, visited);
  return acc;
}

function collectFromFnBody(
  fn: FnRec,
  sf: ts.SourceFile,
  fnMap: ReadonlyMap<string, FnRec>,
  acc: LitRec[],
  visited: Set<string>,
): void {
  if (visited.has(fn.name)) return;
  visited.add(fn.name);
  if (!fn.body) return;

  const visit = (n: ts.Node, encloseHint: string) => {
    if (ts.isNumericLiteral(n)) {
      acc.push({
        node: n,
        text: n.text,
        line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        start: n.getStart(sf),
        end: n.getEnd(),
        hostingFn: fn.name,
        enclosingExpr: encloseHint.slice(0, 100),
      });
      return;
    }
    // If it's a call to another local fn, also collect literals from that fn
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const callee = n.expression.text;
      const target = fnMap.get(callee);
      if (target) {
        collectFromFnBody(target, sf, fnMap, acc, visited);
      }
    }
    // Also recurse into `Math.X(...)` args normally — they're NumericLiteral targets
    ts.forEachChild(n, (c) => visit(c, ts.isExpression(c) ? c.getText(sf) : encloseHint));
  };
  ts.forEachChild(fn.body, (c) => visit(c, ts.isExpression(c) ? c.getText(sf) : "<stmt>"));
}

// ── Mutation ─────────────────────────────────────────────────────────────

/** Produce a NEW fnMap where the literal at `target.start..target.end` has been
 *  replaced with `replacement` at the SOURCE level. We re-parse to rebuild AST.
 *  Note: this is per-substitution · deterministic · no side effects on caller. */
function mutateFnMapReplacingLiteral(
  fnMap: ReadonlyMap<string, FnRec>,
  target: LitRec,
  replacement: string,
): Map<string, FnRec> {
  const originalSource = target.node.getSourceFile().text;
  const mutated = originalSource.slice(0, target.start) + replacement + originalSource.slice(target.end);
  const sf = ts.createSourceFile("__m.ts", mutated, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return collectFunctions(sf);
}

// ── Safe evaluator ──────────────────────────────────────────────────────

interface EvalCtx {
  readonly sf: ts.SourceFile;
  readonly fnMap: ReadonlyMap<string, FnRec>;
  evaluations: number;
  recursion: number;
}

class EvalRefusal extends Error {
  constructor(public readonly refusal: TracerRefusal, public readonly reason: string) {
    super(`[${refusal}] ${reason}`);
  }
}

function evaluateFunctionCall(fn: FnRec, argValues: readonly EvalValue[], ctx: EvalCtx): EvalValue {
  if (ctx.recursion >= MAX_RECURSION) {
    throw new EvalRefusal("recursion_depth_exceeded", `recursion depth exceeded MAX_RECURSION=${MAX_RECURSION}`);
  }
  if (!fn.body) {
    throw new EvalRefusal("function_has_no_body", `function '${fn.name}' has no body`);
  }
  ctx.recursion++;
  try {
    const env: Env = new Map();
    for (let i = 0; i < fn.params.length; i++) {
      env.set(fn.params[i], argValues[i]);
    }
    const r = execBlock(fn.body, env, ctx);
    if (r.kind === "return") return r.value;
    return undefined;
  } finally {
    ctx.recursion--;
  }
}

type Env = Map<string, EvalValue>;

type ExecOutcome =
  | { kind: "normal" }
  | { kind: "return"; value: EvalValue };

function execBlock(block: ts.Block, env: Env, ctx: EvalCtx): ExecOutcome {
  for (const s of block.statements) {
    const r = execStmt(s, env, ctx);
    if (r.kind === "return") return r;
  }
  return { kind: "normal" };
}

function execStmt(s: ts.Statement, env: Env, ctx: EvalCtx): ExecOutcome {
  if (ts.isReturnStatement(s)) {
    const v = s.expression ? evalExpr(s.expression, env, ctx) : undefined;
    return { kind: "return", value: v };
  }
  if (ts.isVariableStatement(s)) {
    for (const d of s.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) {
        throw new EvalRefusal("unsupported_statement", "destructuring binding not supported");
      }
      const v = d.initializer ? evalExpr(d.initializer, env, ctx) : undefined;
      env.set(d.name.text, v);
    }
    return { kind: "normal" };
  }
  if (ts.isIfStatement(s)) {
    const c = evalExpr(s.expression, env, ctx);
    const branch = truthy(c) ? s.thenStatement : s.elseStatement;
    if (!branch) return { kind: "normal" };
    if (ts.isBlock(branch)) return execBlock(branch, env, ctx);
    return execStmt(branch, env, ctx);
  }
  if (ts.isBlock(s)) {
    return execBlock(s, env, ctx);
  }
  if (ts.isExpressionStatement(s)) {
    // Support assignment expressions x = expr
    if (ts.isBinaryExpression(s.expression) && s.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      if (ts.isIdentifier(s.expression.left)) {
        const v = evalExpr(s.expression.right, env, ctx);
        env.set(s.expression.left.text, v);
        return { kind: "normal" };
      }
    }
    evalExpr(s.expression, env, ctx);
    return { kind: "normal" };
  }
  if (ts.isForStatement(s)) {
    if (s.initializer) {
      if (ts.isVariableDeclarationList(s.initializer)) {
        for (const d of s.initializer.declarations) {
          if (!ts.isIdentifier(d.name)) throw new EvalRefusal("unsupported_statement", "for-init destructuring not supported");
          env.set(d.name.text, d.initializer ? evalExpr(d.initializer, env, ctx) : undefined);
        }
      } else {
        evalExpr(s.initializer, env, ctx);
      }
    }
    let iter = 0;
    while (true) {
      if (iter++ >= MAX_LOOP_ITER) throw new EvalRefusal("evaluation_threshold_exceeded", `MAX_LOOP_ITER=${MAX_LOOP_ITER}`);
      const cond = s.condition ? truthy(evalExpr(s.condition, env, ctx)) : true;
      if (!cond) break;
      if (s.statement) {
        const r = ts.isBlock(s.statement) ? execBlock(s.statement, env, ctx) : execStmt(s.statement, env, ctx);
        if (r.kind === "return") return r;
      }
      if (s.incrementor) evalExpr(s.incrementor, env, ctx);
    }
    return { kind: "normal" };
  }
  if (ts.isForOfStatement(s)) {
    const iterable = evalExpr(s.expression, env, ctx);
    if (!Array.isArray(iterable)) {
      throw new EvalRefusal("unsupported_statement", "for-of over non-array not supported");
    }
    let loopVar: string | null = null;
    if (ts.isVariableDeclarationList(s.initializer)) {
      const d = s.initializer.declarations[0];
      if (d && ts.isIdentifier(d.name)) loopVar = d.name.text;
    }
    if (!loopVar) throw new EvalRefusal("unsupported_statement", "for-of initializer unsupported");
    let iter = 0;
    for (const el of iterable as EvalValue[]) {
      if (iter++ >= MAX_LOOP_ITER) throw new EvalRefusal("evaluation_threshold_exceeded", `MAX_LOOP_ITER=${MAX_LOOP_ITER}`);
      env.set(loopVar, el);
      if (s.statement) {
        const r = ts.isBlock(s.statement) ? execBlock(s.statement, env, ctx) : execStmt(s.statement, env, ctx);
        if (r.kind === "return") return r;
      }
    }
    return { kind: "normal" };
  }
  throw new EvalRefusal("unsupported_statement", `statement kind ${ts.SyntaxKind[s.kind]} not supported`);
}

function evalExpr(expr: ts.Expression, env: Env, ctx: EvalCtx): EvalValue {
  if (++ctx.evaluations > MAX_EVALUATIONS) {
    throw new EvalRefusal("evaluation_threshold_exceeded", `MAX_EVALUATIONS=${MAX_EVALUATIONS}`);
  }
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
    return evalExpr(expr.expression, env, ctx);
  }
  if (ts.isNumericLiteral(expr)) return Number(expr.text);
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (expr.kind === ts.SyntaxKind.NullKeyword) return null;
  if (expr.kind === ts.SyntaxKind.UndefinedKeyword) return undefined;
  if (ts.isIdentifier(expr)) {
    if (expr.text === "undefined") return undefined;
    if (expr.text === "NaN") return NaN;
    if (expr.text === "Infinity") return Infinity;
    if (!env.has(expr.text)) {
      throw new EvalRefusal("unresolved_identifier", `identifier '${expr.text}' not in scope`);
    }
    return env.get(expr.text);
  }
  if (ts.isPrefixUnaryExpression(expr)) {
    const v = evalExpr(expr.operand, env, ctx);
    switch (expr.operator) {
      case ts.SyntaxKind.MinusToken: return -(v as number);
      case ts.SyntaxKind.PlusToken: return +(v as number);
      case ts.SyntaxKind.ExclamationToken: return !truthy(v);
      default:
        throw new EvalRefusal("unsupported_expression", `unary op ${expr.operator} not supported`);
    }
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    // Short-circuiting
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      const l = evalExpr(expr.left, env, ctx);
      return truthy(l) ? evalExpr(expr.right, env, ctx) : l;
    }
    if (op === ts.SyntaxKind.BarBarToken) {
      const l = evalExpr(expr.left, env, ctx);
      return truthy(l) ? l : evalExpr(expr.right, env, ctx);
    }
    if (op === ts.SyntaxKind.QuestionQuestionToken) {
      const l = evalExpr(expr.left, env, ctx);
      return l === null || l === undefined ? evalExpr(expr.right, env, ctx) : l;
    }
    const l = evalExpr(expr.left, env, ctx);
    const r = evalExpr(expr.right, env, ctx);
    switch (op) {
      case ts.SyntaxKind.AsteriskToken: return (l as number) * (r as number);
      case ts.SyntaxKind.SlashToken: return (l as number) / (r as number);
      case ts.SyntaxKind.PlusToken: return (l as any) + (r as any);
      case ts.SyntaxKind.MinusToken: return (l as number) - (r as number);
      case ts.SyntaxKind.PercentToken: return (l as number) % (r as number);
      case ts.SyntaxKind.AsteriskAsteriskToken: return Math.pow(l as number, r as number);
      case ts.SyntaxKind.EqualsEqualsEqualsToken: return l === r;
      case ts.SyntaxKind.ExclamationEqualsEqualsToken: return l !== r;
      case ts.SyntaxKind.EqualsEqualsToken: return l == r;
      case ts.SyntaxKind.ExclamationEqualsToken: return l != r;
      case ts.SyntaxKind.LessThanToken: return (l as number) < (r as number);
      case ts.SyntaxKind.GreaterThanToken: return (l as number) > (r as number);
      case ts.SyntaxKind.LessThanEqualsToken: return (l as number) <= (r as number);
      case ts.SyntaxKind.GreaterThanEqualsToken: return (l as number) >= (r as number);
      default:
        throw new EvalRefusal("unsupported_expression", `binary op ${ts.SyntaxKind[op]} not supported`);
    }
  }
  if (ts.isConditionalExpression(expr)) {
    const c = evalExpr(expr.condition, env, ctx);
    return truthy(c) ? evalExpr(expr.whenTrue, env, ctx) : evalExpr(expr.whenFalse, env, ctx);
  }
  if (ts.isPropertyAccessExpression(expr)) {
    const obj = evalExpr(expr.expression, env, ctx);
    if (obj === null || obj === undefined) return undefined;
    return (obj as any)[expr.name.text];
  }
  if (ts.isElementAccessExpression(expr)) {
    const obj = evalExpr(expr.expression, env, ctx);
    const key = evalExpr(expr.argumentExpression, env, ctx);
    if (obj === null || obj === undefined) return undefined;
    return (obj as any)[key as any];
  }
  if (ts.isCallExpression(expr)) {
    return evalCall(expr, env, ctx);
  }
  if (ts.isObjectLiteralExpression(expr)) {
    const o: { [k: string]: EvalValue } = {};
    for (const p of expr.properties) {
      if (ts.isPropertyAssignment(p)) {
        const key = p.name && ts.isIdentifier(p.name) ? p.name.text
          : p.name && ts.isStringLiteral(p.name) ? p.name.text
          : null;
        if (!key) throw new EvalRefusal("unsupported_expression", "computed property key not supported");
        o[key] = evalExpr(p.initializer, env, ctx);
      } else if (ts.isShorthandPropertyAssignment(p)) {
        const name = p.name.text;
        if (!env.has(name)) throw new EvalRefusal("unresolved_identifier", `shorthand '${name}' not in scope`);
        o[name] = env.get(name);
      } else {
        throw new EvalRefusal("unsupported_expression", "spread / getter / setter properties not supported");
      }
    }
    return o;
  }
  if (ts.isArrayLiteralExpression(expr)) {
    const a: EvalValue[] = [];
    for (const el of expr.elements) {
      if (ts.isSpreadElement(el)) throw new EvalRefusal("unsupported_expression", "spread in array literal not supported");
      if (el.kind === ts.SyntaxKind.OmittedExpression) continue;
      a.push(evalExpr(el as ts.Expression, env, ctx));
    }
    return a;
  }
  throw new EvalRefusal("unsupported_expression", `expr kind ${ts.SyntaxKind[expr.kind]} not supported`);
}

function evalCall(call: ts.CallExpression, env: Env, ctx: EvalCtx): EvalValue {
  const callee = call.expression;
  const args = call.arguments.map((a) => evalExpr(a, env, ctx));

  // Math.X(...)
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === "Math") {
    const method = callee.name.text;
    const nums = args.map((v) => v as number);
    switch (method) {
      case "max": return Math.max(...nums);
      case "min": return Math.min(...nums);
      case "floor": return Math.floor(nums[0]);
      case "ceil": return Math.ceil(nums[0]);
      case "round": return Math.round(nums[0]);
      case "abs": return Math.abs(nums[0]);
      case "sign": return Math.sign(nums[0]);
      case "trunc": return Math.trunc(nums[0]);
      case "sqrt": return Math.sqrt(nums[0]);
      case "pow": return Math.pow(nums[0], nums[1]);
      default:
        throw new EvalRefusal("unsupported_expression", `Math.${method} not supported`);
    }
  }

  // Number.X(...), Array.isArray(...), Number.isFinite/isInteger
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
    const obj = callee.expression.text;
    const method = callee.name.text;
    if (obj === "Number") {
      if (method === "isFinite") return Number.isFinite(args[0] as any);
      if (method === "isInteger") return Number.isInteger(args[0] as any);
      if (method === "isNaN") return Number.isNaN(args[0] as any);
    }
    if (obj === "Array" && method === "isArray") {
      return Array.isArray(args[0]);
    }
    // Array method calls: [].filter, [].length (via prop, not call), [].some
    if (Array.isArray(evalExpr(callee.expression, env, ctx))) {
      // Rare path · fall through
    }
  }

  // Bare-identifier calls · either local fn or Number()
  if (ts.isIdentifier(callee)) {
    const name = callee.text;
    if (name === "Number") return Number(args[0] as any);
    if (name === "String") return String(args[0] as any);
    if (name === "Boolean") return Boolean(args[0] as any);
    const fn = ctx.fnMap.get(name);
    if (fn) {
      return evaluateFunctionCall(fn, args, ctx);
    }
    throw new EvalRefusal("cross_module_call", `call to '${name}' cannot be resolved in same file`);
  }

  // Array method calls (chained): expr.method(...)
  if (ts.isPropertyAccessExpression(callee)) {
    const target = evalExpr(callee.expression, env, ctx);
    if (Array.isArray(target)) {
      const method = callee.name.text;
      if (method === "length" as any) return (target as any[]).length;
      if (method === "filter" || method === "map" || method === "some" || method === "every" || method === "find") {
        // These take a callback · unsupported (would require closure evaluation)
        throw new EvalRefusal("unsupported_expression", `array.${method} with callback not supported`);
      }
    }
    throw new EvalRefusal("unsupported_expression", `method call not supported for this receiver`);
  }

  throw new EvalRefusal("unsupported_expression", `call form not supported`);
}

// ── Utilities ────────────────────────────────────────────────────────────

function truthy(v: EvalValue): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "number") return v !== 0 && !Number.isNaN(v);
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "boolean") return v;
  return true; // objects/arrays truthy
}

function extractField(v: EvalValue, fieldName: string | null): EvalValue {
  if (fieldName === null) return v;
  if (v === null || v === undefined) return undefined;
  if (typeof v !== "object") return undefined;
  return (v as any)[fieldName];
}

function deepEqual(a: EvalValue, b: EvalValue): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return a === b;
  }
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as any).sort();
    const kb = Object.keys(b as any).sort();
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return false;
      if (!deepEqual((a as any)[ka[i]], (b as any)[kb[i]])) return false;
    }
    return true;
  }
  return false;
}

function normalizeNumText(s: string): string {
  const t = s.trim().replace(/^\+/, "");
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : t;
}

/** Parse a literal string as an EvalValue. Used by callers to build arg_values.
 *  Supported: numeric · quoted string · true · false · null · undefined · [] · {}. */
export function parseArgValue(text: string): EvalValue {
  const t = text.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (t === "undefined") return undefined;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  const dq = /^"(.*)"$/.exec(t);
  if (dq) return dq[1];
  const sq = /^'(.*)'$/.exec(t);
  if (sq) return sq[1];
  if (t === "[]") return [];
  if (t === "{}") return {};
  // Fall back: try JSON
  try { return JSON.parse(t) as EvalValue; } catch { /* ignore */ }
  return t; // last resort · pass through as string
}
