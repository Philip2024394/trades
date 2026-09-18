// src/lib/nex-agent/code-engine/adapters/ast-semantic.ts
//
// NEX1 · SEMANTIC MODIFICATION ADAPTER · deterministic · AST-based · zero model.
//
// Founder direction (2026-09-12): "Test the deterministic AST route first · a
// proper TypeScript parser/AST transformation layer could potentially teach
// NEX1 those semantic operations without any model at all."
//
// This adapter uses TypeScript's compiler API (already a repo dep) to perform
// three semantic operations that were beyond template-only:
//   1. add_interface_field         · parse interface body · insert PropertySignature
//   2. add_return_object_property  · locate return-object literal · insert Property
//   3. add_test_case               · locate describe(...) · insert it(...) block
//
// Zero inference. Zero randomness. Zero network. Zero vendor. Deterministic
// under Amendment 1.D: this can be part of NEX1's identity floor once proven,
// because it never leaves the machine and never depends on external state.
//
// NEX1 owns the loop · this adapter merely composes candidate diffs.

import ts from "typescript";
import type {
  Nex1AdapterCapabilities,
  Nex1IntentKind,
  Nex1ReasoningAdapter,
  Nex1ReasoningRequest,
  Nex1ReasoningResponse,
  TemplateDirective,
} from "../types";
import { NEX1_ENGINE_ERRORS } from "../types";

const ID = "ast-semantic";
const SUPPORTED: readonly Nex1IntentKind[] = ["add_feature", "refactor", "add_test", "fix_bug"];

export const AST_SEMANTIC_ID = ID;

export const AstSemanticAdapter: Nex1ReasoningAdapter = {
  id: ID,
  deterministic: true,

  async isAvailable(): Promise<boolean> {
    return true;
  },

  capabilities(): Nex1AdapterCapabilities {
    return {
      deterministic: true,
      supported_intents: SUPPORTED,
      network_egress: "none",
      declared_max_context_bytes: 500_000,
    };
  },

  async reason(req: Nex1ReasoningRequest): Promise<Nex1ReasoningResponse> {
    const started = Date.now();
    const directive = req.template_directive;
    if (!directive) {
      return {
        ok: false,
        code: NEX1_ENGINE_ERRORS.diff_malformed,
        reason: "ast-semantic adapter requires a template_directive",
      };
    }
    if (!isSemanticDirective(directive)) {
      return {
        ok: false,
        code: NEX1_ENGINE_ERRORS.reasoning_not_bound,
        reason: `ast-semantic does not handle directive kind '${directive.kind}' · defer to another adapter`,
      };
    }
    if (!req.context.declared_scope.includes(directive.target_path)) {
      return {
        ok: false,
        code: NEX1_ENGINE_ERRORS.scope_violation,
        reason: `target_path ${directive.target_path} is not in declared_scope`,
      };
    }
    const slice = req.context.file_slices.find((s) => s.path === directive.target_path);
    if (!slice) {
      return {
        ok: false,
        code: NEX1_ENGINE_ERRORS.diff_malformed,
        reason: `ast-semantic requires a file_slice for ${directive.target_path}`,
      };
    }

    try {
      const result = applyAstOperation(slice.content, directive);
      if (!result.ok) {
        return { ok: false, code: NEX1_ENGINE_ERRORS.diff_malformed, reason: result.reason };
      }
      const diff = renderWholeFileDiff(directive.target_path, slice.content, result.next);
      return {
        ok: true,
        result: {
          adapter_id: ID,
          model_id: null,
          model_version: null,
          proposed_diff: diff,
          rationale: result.rationale,
          confidence: 1,
          tokens_in: 0,
          tokens_out: 0,
          latency_ms: Date.now() - started,
          deterministic: true,
          adapter_scope: "code_proposal_only",
        },
      };
    } catch (e) {
      return {
        ok: false,
        code: NEX1_ENGINE_ERRORS.diff_malformed,
        reason: e instanceof Error ? e.message.slice(0, 200) : "ast operation failed",
      };
    }
  },
};

// ─── Directive dispatcher ────────────────────────────────────────────

type SemanticDirective =
  | Extract<TemplateDirective, { kind: "add_interface_field" }>
  | Extract<TemplateDirective, { kind: "add_return_object_property" }>
  | Extract<TemplateDirective, { kind: "add_test_case" }>
  | Extract<TemplateDirective, { kind: "add_property_to_object_at_position" }>;

function isSemanticDirective(d: TemplateDirective): d is SemanticDirective {
  return d.kind === "add_interface_field"
      || d.kind === "add_return_object_property"
      || d.kind === "add_test_case"
      || d.kind === "add_property_to_object_at_position";
}

interface AstApplyOk { ok: true; next: string; rationale: string }
interface AstApplyFail { ok: false; reason: string }
type AstApplyResult = AstApplyOk | AstApplyFail;

function applyAstOperation(source: string, d: SemanticDirective): AstApplyResult {
  switch (d.kind) {
    case "add_interface_field": return applyAddInterfaceField(source, d);
    case "add_return_object_property": return applyAddReturnObjectProperty(source, d);
    case "add_test_case": return applyAddTestCase(source, d);
    case "add_property_to_object_at_position": return applyAddPropertyAtPosition(source, d);
  }
}

// ─── Operation 1 · add_interface_field ───────────────────────────────

function applyAddInterfaceField(
  source: string,
  d: Extract<TemplateDirective, { kind: "add_interface_field" }>,
): AstApplyResult {
  const sf = ts.createSourceFile("__nex1.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  // Parse the desired field via a synthetic snippet · avoids manual type-string parsing
  const readonlyKw = d.readonly_field === false ? "" : "readonly ";
  const jsdoc = d.field_annotation ? `  /** ${d.field_annotation} */\n` : "";
  const memberText = `${jsdoc}  ${readonlyKw}${d.field_name}: ${d.field_type};`;
  const template = `interface __N { ${memberText} }`;
  const templateSf = ts.createSourceFile("__t.ts", template, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const templateInterface = templateSf.statements.find(ts.isInterfaceDeclaration);
  if (!templateInterface || templateInterface.members.length === 0) {
    return { ok: false, reason: `could not parse field_type '${d.field_type}' as a valid PropertySignature` };
  }
  const newMember = templateInterface.members[0];

  let found = false;
  let alreadyPresent = false;
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === d.target_interface) {
        found = true;
        if (node.members.some((m) => ts.isPropertySignature(m) && ts.isIdentifier(m.name) && m.name.text === d.field_name)) {
          alreadyPresent = true;
          return node;
        }
        return ts.factory.updateInterfaceDeclaration(
          node,
          node.modifiers,
          node.name,
          node.typeParameters,
          node.heritageClauses,
          [...node.members, newMember],
        );
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sourceFile) => ts.visitNode(sourceFile, visit) as ts.SourceFile;
  };

  const result = ts.transform(sf, [transformer]);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });
  const next = printer.printFile(result.transformed[0]);
  result.dispose();

  if (!found) return { ok: false, reason: `interface '${d.target_interface}' not found in ${d.target_path}` };
  if (alreadyPresent) return { ok: true, next: source, rationale: `field ${d.field_name} already present · no-op` };
  return { ok: true, next, rationale: `AST: added field '${d.field_name}: ${d.field_type}' to interface '${d.target_interface}'` };
}

// ─── Operation 2 · add_return_object_property ────────────────────────
//
// Finds an exported function whose body contains a `return { ... };` and
// inserts a new property into that object literal.

function applyAddReturnObjectProperty(
  source: string,
  d: Extract<TemplateDirective, { kind: "add_return_object_property" }>,
): AstApplyResult {
  const sf = ts.createSourceFile("__nex1.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  // Parse just the VALUE expression via a synthetic snippet · then use
  // ts.factory.createPropertyAssignment fresh so the injected node has no
  // lingering parent from the synthetic SourceFile.
  const template = `const __x = ${d.property_value};`;
  const templateSf = ts.createSourceFile("__t.ts", template, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let valueExpr: ts.Expression | undefined;
  for (const s of templateSf.statements) {
    if (ts.isVariableStatement(s)) {
      valueExpr = s.declarationList.declarations[0]?.initializer;
    }
  }
  if (!valueExpr) {
    return { ok: false, reason: `could not parse property_value '${d.property_value}' as a valid expression` };
  }
  // Deep-clone the parsed expression so it has no lingering parent / range
  // pointing at the synthetic template SourceFile · printer needs synthetic nodes.
  const clonedValue = deepCloneAsSynthetic(valueExpr);
  const newProperty = ts.factory.createPropertyAssignment(d.property_name, clonedValue);

  let found = false;
  let modified = false;
  let alreadyPresent = false;
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      // Target: FunctionDeclaration whose name matches
      if (ts.isFunctionDeclaration(node) && node.name?.text === d.target_function) {
        found = true;
        if (!node.body) return node;
        const newBody = insertPropertyIntoReturnObject(node.body, newProperty!, d.property_name, context);
        if (newBody.alreadyPresent) alreadyPresent = true;
        if (newBody.modified) modified = true;
        return ts.factory.updateFunctionDeclaration(
          node, node.modifiers, node.asteriskToken, node.name, node.typeParameters,
          node.parameters, node.type, newBody.body,
        );
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sourceFile) => ts.visitNode(sourceFile, visit) as ts.SourceFile;
  };

  const result = ts.transform(sf, [transformer]);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });
  const next = printer.printFile(result.transformed[0]);
  result.dispose();

  if (!found) return { ok: false, reason: `function '${d.target_function}' not found in ${d.target_path}` };
  if (alreadyPresent) return { ok: true, next: source, rationale: `property ${d.property_name} already present · no-op` };
  if (!modified) return { ok: false, reason: `function '${d.target_function}' has no return-object literal to modify` };
  return { ok: true, next, rationale: `AST: added property '${d.property_name}' to return-object of '${d.target_function}'` };
}

function insertPropertyIntoReturnObject(
  body: ts.Block,
  newProperty: ts.PropertyAssignment,
  propertyName: string,
  context: ts.TransformationContext,
): { body: ts.Block; modified: boolean; alreadyPresent: boolean } {
  let modified = false;
  let alreadyPresent = false;
  const visitor: ts.Visitor = (n) => {
    if (ts.isReturnStatement(n) && n.expression && ts.isObjectLiteralExpression(n.expression)) {
      const obj = n.expression;
      if (obj.properties.some((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === propertyName)) {
        alreadyPresent = true;
        return n;
      }
      modified = true;
      const updatedObj = ts.factory.updateObjectLiteralExpression(obj, [...obj.properties, newProperty]);
      return ts.factory.updateReturnStatement(n, updatedObj);
    }
    return ts.visitEachChild(n, visitor, context);
  };
  const updated = ts.visitEachChild(body, visitor, context);
  return { body: updated, modified, alreadyPresent };
}

// ─── Operation 3 · add_test_case ─────────────────────────────────────
//
// Finds a `describe("title", () => { ... })` call and inserts a new
// `it("name", async () => { <body> })` call inside its arrow-function body.

function applyAddTestCase(
  source: string,
  d: Extract<TemplateDirective, { kind: "add_test_case" }>,
): AstApplyResult {
  // Text-based splicing implementation (taught_by=master_ai_engineer · 2026-09-12).
  //
  // Rationale: AST-based cloning across SourceFile boundaries proved
  // unreliable for verbatim body preservation. Two independent failures
  // were observed:
  //   · ts.getSynthesizedDeepClone drops NumericLiteral nodes silently
  //     (verified against typescript@5.6 · confirmed by testing all
  //     primitive literal kinds).
  //   · Nodes re-parsed into a small wrapper SourceFile retain positions
  //     that address the wrapper text; when spliced into the target file
  //     and printed via printer.printFile, the printer reads text from
  //     the target at those positions, producing garbled output.
  // The safe, robust approach is: use the AST to LOCATE the describe(...)
  // arrow-function body's closing brace; insert the it() test as literal
  // text with correct indentation. No AST transform on the body.
  const sf = ts.createSourceFile("__nex1.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  if (!d.test_body || d.test_body.trim().length === 0) {
    return { ok: false, reason: "test_body must not be empty" };
  }

  let insertOffset: number | null = null;
  let indent = "    ";
  let alreadyPresent = false;
  const visit = (node: ts.Node) => {
    if (insertOffset !== null || alreadyPresent) return;
    if (
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "describe" &&
      node.expression.arguments.length >= 2 &&
      ts.isStringLiteral(node.expression.arguments[0]) &&
      node.expression.arguments[0].text === d.target_describe
    ) {
      const cb = node.expression.arguments[1];
      if (ts.isArrowFunction(cb) && ts.isBlock(cb.body)) {
        if (blockContainsTest(cb.body, d.test_name)) {
          alreadyPresent = true;
          return;
        }
        // Position immediately before the closing brace of the arrow body
        insertOffset = cb.body.getEnd() - 1;
        // Detect indent · try an existing statement; otherwise detect from
        // the describe(...) call's own indent + 4 spaces.
        if (cb.body.statements.length > 0) {
          const firstStmtStart = cb.body.statements[0].getStart(sf);
          const lineStart = source.lastIndexOf("\n", firstStmtStart - 1) + 1;
          const guess = source.slice(lineStart, firstStmtStart);
          if (/^\s*$/.test(guess)) indent = guess;
        } else {
          const describeStart = node.getStart(sf);
          const lineStart = source.lastIndexOf("\n", describeStart - 1) + 1;
          const describeIndent = source.slice(lineStart, describeStart);
          if (/^\s*$/.test(describeIndent)) indent = describeIndent + "    ";
        }
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (alreadyPresent) {
    return { ok: true, next: source, rationale: `it('${d.test_name}') already present · no-op` };
  }
  if (insertOffset === null) {
    return { ok: false, reason: `describe('${d.target_describe}') not found in ${d.target_path}` };
  }

  const bodyIndent = indent + "    ";
  const bodyLines = d.test_body.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const indentedBody = bodyLines.map((l) => bodyIndent + l).join("\n");
  const insertion =
    indent + `it(${JSON.stringify(d.test_name)}, async () => {\n` +
    indentedBody + "\n" +
    indent + `});\n`;
  const next = source.slice(0, insertOffset) + insertion + source.slice(insertOffset);
  return { ok: true, next, rationale: `text-splice: added it('${d.test_name}') to describe('${d.target_describe}')` };
}

function blockContainsTest(block: ts.Block, testName: string): boolean {
  return block.statements.some((s) =>
    ts.isExpressionStatement(s) &&
    ts.isCallExpression(s.expression) &&
    ts.isIdentifier(s.expression.expression) &&
    s.expression.expression.text === "it" &&
    s.expression.arguments.length >= 1 &&
    ts.isStringLiteral(s.expression.arguments[0]) &&
    s.expression.arguments[0].text === testName,
  );
}

// ─── Operation 4 · add_property_to_object_at_position (Sprint 2.5) ──
//
// Finds the ObjectLiteralExpression at or enclosing the given (line, column)
// and adds a new property. This is how NEX1 repairs a TS2322 diagnostic that
// says "type X is missing the following properties from type Y".

function applyAddPropertyAtPosition(
  source: string,
  d: Extract<TemplateDirective, { kind: "add_property_to_object_at_position" }>,
): AstApplyResult {
  const sf = ts.createSourceFile("__nex1.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  // Compute absolute char offset from 1-indexed (line, column)
  const targetOffset = lineColToOffset(source, d.line, d.column);
  if (targetOffset < 0) {
    return { ok: false, reason: `line ${d.line} column ${d.column} out of bounds` };
  }

  // Parse the value expression via a synthetic snippet + deep-clone to synthetic
  const templateSource = `const __x = ${d.property_value};`;
  const templateSf = ts.createSourceFile("__t.ts", templateSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let valueExpr: ts.Expression | undefined;
  for (const s of templateSf.statements) {
    if (ts.isVariableStatement(s)) valueExpr = s.declarationList.declarations[0]?.initializer;
  }
  if (!valueExpr) return { ok: false, reason: `could not parse property_value '${d.property_value}'` };
  const clonedValue = deepCloneAsSynthetic(valueExpr);
  const newProperty = ts.factory.createPropertyAssignment(d.property_name, clonedValue);

  // Locate the smallest ObjectLiteralExpression that contains targetOffset
  let bestNode: ts.ObjectLiteralExpression | null = null;
  let bestSize = Number.POSITIVE_INFINITY;
  const walker = (n: ts.Node) => {
    if (ts.isObjectLiteralExpression(n)) {
      const s = n.getStart(sf);
      const e = n.getEnd();
      if (s <= targetOffset && targetOffset <= e) {
        const size = e - s;
        if (size < bestSize) {
          bestSize = size;
          bestNode = n;
        }
      }
    }
    ts.forEachChild(n, walker);
  };
  ts.forEachChild(sf, walker);
  if (!bestNode) {
    // ── Teacher-authored bootstrap · Capability A · 2026-09-12 ──
    // taught_by=claude_reviewer · not NEX1 authorship · training infrastructure only.
    // Fallback: tsc often reports diagnostic positions slightly before the
    // ObjectLiteralExpression's opening `{` (e.g., at the `(` of `({...})`,
    // or on the enclosing CallExpression / ArrowFunction). Walk from the
    // deepest node containing `targetOffset` upward via parent pointers, and
    // if that fails, walk descendants forward for the nearest literal.
    bestNode = findEnclosingObjectLiteralAdjacent(sf, targetOffset);
  }
  if (!bestNode) {
    return { ok: false, reason: `no ObjectLiteralExpression at ${d.target_path}:${d.line}:${d.column}` };
  }
  const enclosing = bestNode as ts.ObjectLiteralExpression;
  if (enclosing.properties.some((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === d.property_name)) {
    return { ok: true, next: source, rationale: `property ${d.property_name} already present · no-op` };
  }

  // Transform: replace bestNode with updated node carrying the new property
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (node === enclosing) {
        return ts.factory.updateObjectLiteralExpression(
          enclosing,
          [...enclosing.properties, newProperty],
        );
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sourceFile) => ts.visitNode(sourceFile, visit) as ts.SourceFile;
  };
  const result = ts.transform(sf, [transformer]);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });
  const next = printer.printFile(result.transformed[0]);
  result.dispose();
  return {
    ok: true,
    next,
    rationale: `AST: added property '${d.property_name}: ${d.property_value}' to enclosing object literal at ${d.target_path}:${d.line}:${d.column}`,
  };
}

function lineColToOffset(source: string, line1: number, col1: number): number {
  const lines = source.split(/\r?\n/);
  if (line1 < 1 || line1 > lines.length) return -1;
  let offset = 0;
  for (let i = 0; i < line1 - 1; i++) offset += (lines[i]?.length ?? 0) + 1;
  return offset + Math.max(0, col1 - 1);
}

// ─── Teacher-authored bootstrap · Capability A · 2026-09-12 ──────────
//
// taught_by = claude_reviewer
// Training infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: when tsc reports a diagnostic position that does not fall
// strictly inside an ObjectLiteralExpression's char range (which happens
// for e.g. `arr.map((x,i) => ({...}))` where TS2322 lands at the outer
// expression), locate the intended object literal by:
//   (1) descending to the deepest node whose range contains targetOffset
//   (2) walking parent chain upward for ObjectLiteralExpression, unwrapping
//       ParenthesizedExpression whose expression is an ObjectLiteralExpression
//   (3) if steps 1-2 fail, scanning descendants of the deepest-containing
//       node for the ObjectLiteralExpression nearest to targetOffset.
//
// Removing this function must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism. See the
// adapter-removal conformance test.
function findEnclosingObjectLiteralAdjacent(
  sf: ts.SourceFile,
  targetOffset: number,
): ts.ObjectLiteralExpression | null {
  // Step 1 · descend to the deepest node whose range contains targetOffset
  const findDeepest = (n: ts.Node): ts.Node => {
    let deepest: ts.Node = n;
    ts.forEachChild(n, (c) => {
      const cs = c.getStart(sf);
      const ce = c.getEnd();
      if (cs <= targetOffset && targetOffset <= ce) {
        const inner = findDeepest(c);
        const innerSize = inner.getEnd() - inner.getStart(sf);
        const deepestSize = deepest.getEnd() - deepest.getStart(sf);
        if (innerSize <= deepestSize) deepest = inner;
      }
    });
    return deepest;
  };
  const deepest = findDeepest(sf);
  // Step 2 · parent-walk upward · with sibling-initializer lookahead so
  // diagnostics reported at a VariableDeclaration's name / type-annotation
  // still resolve to the RHS object literal (Rung-5 gap: `export const x: T
  // = { ... };` — tsc points at `x`, the object literal is the initializer).
  let cur: ts.Node | undefined = deepest;
  while (cur) {
    if (ts.isObjectLiteralExpression(cur)) return cur;
    if (ts.isParenthesizedExpression(cur) && ts.isObjectLiteralExpression(cur.expression)) {
      return cur.expression;
    }
    // Sibling-initializer lookahead
    if (ts.isVariableDeclaration(cur) && cur.initializer) {
      if (ts.isObjectLiteralExpression(cur.initializer)) return cur.initializer;
      if (ts.isAsExpression(cur.initializer) && ts.isObjectLiteralExpression(cur.initializer.expression)) return cur.initializer.expression;
      if (ts.isParenthesizedExpression(cur.initializer) && ts.isObjectLiteralExpression(cur.initializer.expression)) return cur.initializer.expression;
    }
    // Return-statement lookahead: `return { ... }`
    if (ts.isReturnStatement(cur) && cur.expression && ts.isObjectLiteralExpression(cur.expression)) return cur.expression;
    cur = cur.parent;
  }
  // Step 3 · descendant search within the deepest containing node, preferring
  // the ObjectLiteralExpression whose start is closest to targetOffset.
  let nearest: ts.ObjectLiteralExpression | null = null;
  let nearestDist = Number.POSITIVE_INFINITY;
  const descend = (n: ts.Node) => {
    if (ts.isObjectLiteralExpression(n)) {
      const s = n.getStart(sf);
      const dist = Math.abs(s - targetOffset);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = n;
      }
    }
    ts.forEachChild(n, descend);
  };
  descend(deepest);
  return nearest;
}

// ─── AST utilities ──────────────────────────────────────────────────

/**
 * Return a deep clone of `node` with all positions marked synthetic (-1) and
 * no lingering parent references. This is required when injecting a node
 * parsed from a synthetic SourceFile into a different SourceFile — otherwise
 * the printer emits based on stale text ranges and produces garbled output.
 */
function deepCloneAsSynthetic<T extends ts.Node>(node: T): T {
  // `getSynthesizedDeepClone` is a public TypeScript API since 4.0 and is what
  // the compiler itself uses to inject nodes across SourceFiles safely.
  const anyTs = ts as unknown as { getSynthesizedDeepClone?: <U extends ts.Node>(n: U, includeTrivia?: boolean) => U };
  if (typeof anyTs.getSynthesizedDeepClone === "function") {
    return anyTs.getSynthesizedDeepClone(node, /*includeTrivia*/ false);
  }
  // Fallback: reprint the node to text and reparse in a fresh SourceFile.
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });
  const dummySf = ts.createSourceFile("__d.ts", "", ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const printed = printer.printNode(ts.EmitHint.Unspecified, node, dummySf);
  const reparsed = ts.createSourceFile("__r.ts", `const __x = ${printed};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const first = reparsed.statements[0];
  if (ts.isVariableStatement(first)) {
    const init = first.declarationList.declarations[0]?.initializer;
    if (init) return init as unknown as T;
  }
  return node;
}

// ─── Operation 5 · add_array_element (Rung 3 · authorised 2026-09-15) ──
//
// taught_by = master_ai_engineer · Founder authorisation 2026-09-15
//
// Deterministic · zero LLM · text-splicing on AST-located coordinates.
//
// Purpose: consume the `Nex1DataflowProposal` emitted by capability-K
// (change_kind = "add_array_element") and produce a mutated source that
// inserts one new element per missing_id into an array-literal symbol.
//
// Reusable across ANY of these shapes:
//   export const X = [ ... ];
//   export const X: readonly T[] = [ ... ];
//   export const X = Object.freeze([ ... ]);
//   export const X: readonly T[] = Object.freeze([ ... ]);
//
// Element template = peer_element_source (verbatim text of an existing
// element from the source array). The operator substitutes ONLY the
// id_field's string-literal value with the missing id. Every other field
// is preserved verbatim from the peer to keep behaviour predictable and
// to avoid inventing semantic content.
//
// Refuses cleanly on: symbol not found · duplicate symbol · wrong initializer
// shape · peer unparseable · peer missing id_field · already-present id ·
// substitution would produce invalid TypeScript. Every refusal is named.

export interface AddArrayElementInput {
  readonly array_symbol: string;
  readonly missing_ids: readonly string[];
  readonly peer_element_source: string;
  readonly id_field: string;
}

export type AddArrayElementRefusal =
  | "input_no_missing_ids"
  | "input_empty_peer"
  | "input_empty_array_symbol"
  | "source_unparseable"
  | "symbol_not_found"
  | "symbol_ambiguous_multiple_declarations"
  | "initializer_not_supported_form"
  | "array_literal_not_found"
  | "peer_unparseable"
  | "peer_missing_id_field"
  | "peer_id_field_not_string_literal"
  | "all_ids_already_present"
  | "mutation_produced_invalid_source";

export interface AddArrayElementApplyOk {
  readonly ok: true;
  readonly next: string;
  readonly rationale: string;
  readonly inserted_ids: readonly string[];
  readonly skipped_already_present_ids: readonly string[];
}
export interface AddArrayElementApplyRefusal {
  readonly ok: false;
  readonly refusal: AddArrayElementRefusal;
  readonly reason: string;
}
export type AddArrayElementResult = AddArrayElementApplyOk | AddArrayElementApplyRefusal;

export function applyAddArrayElement(source: string, input: AddArrayElementInput): AddArrayElementResult {
  // Input validation
  if (!input.array_symbol || input.array_symbol.length === 0) {
    return { ok: false, refusal: "input_empty_array_symbol", reason: "array_symbol is empty" };
  }
  if (input.missing_ids.length === 0) {
    return { ok: false, refusal: "input_no_missing_ids", reason: "missing_ids is empty · nothing to add" };
  }
  if (!input.peer_element_source || input.peer_element_source.trim().length === 0) {
    return { ok: false, refusal: "input_empty_peer", reason: "peer_element_source is empty" };
  }

  // Parse source
  let sf: ts.SourceFile;
  try {
    sf = ts.createSourceFile("__nex1.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  } catch (e) {
    return {
      ok: false,
      refusal: "source_unparseable",
      reason: `source did not parse: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`,
    };
  }

  // Locate exported variable declaration named array_symbol
  const matches: ts.VariableDeclaration[] = [];
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const d of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue;
      if (d.name.text !== input.array_symbol) continue;
      matches.push(d);
    }
  }
  if (matches.length === 0) {
    return { ok: false, refusal: "symbol_not_found", reason: `no variable declaration named '${input.array_symbol}' at top level` };
  }
  if (matches.length > 1) {
    return { ok: false, refusal: "symbol_ambiguous_multiple_declarations", reason: `${matches.length} top-level declarations named '${input.array_symbol}'` };
  }
  const decl = matches[0]!;
  if (!decl.initializer) {
    return { ok: false, refusal: "initializer_not_supported_form", reason: `'${input.array_symbol}' has no initializer` };
  }

  // Resolve to underlying ArrayLiteralExpression (bare or wrapped in Object.freeze)
  const arr = resolveArrayLiteral(decl.initializer);
  if (!arr) {
    return { ok: false, refusal: "initializer_not_supported_form", reason: `initializer is not an array literal or Object.freeze([...]) · got ${ts.SyntaxKind[decl.initializer.kind]}` };
  }

  // Parse peer as a standalone expression via a template SourceFile
  const peerTemplate = `const __peer = ${input.peer_element_source};`;
  const peerSf = ts.createSourceFile("__peer.ts", peerTemplate, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const peerStmt = peerSf.statements.find(ts.isVariableStatement);
  const peerExpr = peerStmt?.declarationList.declarations[0]?.initializer;
  if (!peerExpr || !ts.isObjectLiteralExpression(peerExpr)) {
    return { ok: false, refusal: "peer_unparseable", reason: "peer_element_source did not parse as a valid ObjectLiteralExpression" };
  }
  // Verify peer has the id_field with a string-literal value
  const peerIdProp = findIdProperty(peerExpr, input.id_field);
  if (!peerIdProp) {
    return { ok: false, refusal: "peer_missing_id_field", reason: `peer element has no '${input.id_field}' property` };
  }
  if (!ts.isStringLiteral(peerIdProp.initializer) && !ts.isNoSubstitutionTemplateLiteral(peerIdProp.initializer)) {
    return { ok: false, refusal: "peer_id_field_not_string_literal", reason: `peer '${input.id_field}' property value is not a plain string literal` };
  }
  const peerIdValue = peerIdProp.initializer.text;

  // Enumerate existing ids in the target array (dedup)
  const existingIds = new Set<string>();
  for (const el of arr.elements) {
    if (!ts.isObjectLiteralExpression(el)) continue;
    const idProp = findIdProperty(el, input.id_field);
    if (!idProp) continue;
    if (ts.isStringLiteral(idProp.initializer) || ts.isNoSubstitutionTemplateLiteral(idProp.initializer)) {
      existingIds.add(idProp.initializer.text);
    }
  }
  const toInsert: string[] = [];
  const skipped: string[] = [];
  for (const id of input.missing_ids) {
    if (existingIds.has(id)) skipped.push(id);
    else toInsert.push(id);
  }
  if (toInsert.length === 0) {
    return {
      ok: true,
      next: source,
      rationale: `all ${input.missing_ids.length} missing_ids already present · no-op`,
      inserted_ids: [],
      skipped_already_present_ids: skipped,
    };
  }

  // Detect the element indent by looking at the char range preceding an
  // existing element. Prefer the last element for the closest structural sibling.
  const referenceElement = arr.elements[arr.elements.length - 1] ?? arr.elements[0];
  let elementIndent = "  ";
  if (referenceElement) {
    const elStart = referenceElement.getStart(sf);
    const prevNewline = source.lastIndexOf("\n", elStart - 1);
    if (prevNewline >= 0) {
      const candidate = source.slice(prevNewline + 1, elStart);
      if (/^[ \t]*$/.test(candidate)) elementIndent = candidate;
    }
  }

  // Build the insertion text: for each new id, take peer verbatim and
  // substitute JUST the id_field's string-literal value. All other fields
  // are preserved verbatim from the peer. Each element ends with ",".
  //
  // The substitution is anchored to the peer's actual id-property text via
  // a positional splice inside the peer string (NOT a blind global regex),
  // which avoids collateral edits if the peer id string happens to appear
  // elsewhere in the element.
  const peerText = input.peer_element_source;
  // Locate the peer's id-property string span inside peerText using the
  // peer AST offsets (peer AST was parsed from `const __peer = <peer>;`
  // so we must translate offsets back to peer-only coordinates).
  const peerConstPrefix = `const __peer = `;
  const peerAstOffsetBase = peerConstPrefix.length;
  const peerIdLiteralStart = peerIdProp.initializer.getStart(peerSf) - peerAstOffsetBase;
  const peerIdLiteralEnd = peerIdProp.initializer.getEnd() - peerAstOffsetBase;
  if (
    peerIdLiteralStart < 0 ||
    peerIdLiteralEnd > peerText.length ||
    peerIdLiteralStart >= peerIdLiteralEnd
  ) {
    return {
      ok: false,
      refusal: "peer_unparseable",
      reason: "peer id-property offsets did not resolve inside peer_element_source",
    };
  }
  const peerLiteralQuote = peerText.charAt(peerIdLiteralStart); // " or ' or `

  const newElements: string[] = [];
  for (const id of toInsert) {
    const escaped = escapeStringLiteralByQuote(id, peerLiteralQuote);
    const substituted =
      peerText.slice(0, peerIdLiteralStart) +
      peerLiteralQuote + escaped + peerLiteralQuote +
      peerText.slice(peerIdLiteralEnd);
    newElements.push(substituted);
  }

  // Determine splice position: just before the array's closing bracket.
  // Preserve the exact whitespace pattern used between existing elements.
  const arrCloseBracketPos = arr.getEnd() - 1; // position OF `]`
  // Scan backward from `]` to find the last non-whitespace char BEFORE it.
  let cursor = arrCloseBracketPos - 1;
  while (cursor >= 0 && (source.charAt(cursor) === " " || source.charAt(cursor) === "\t" || source.charAt(cursor) === "\n" || source.charAt(cursor) === "\r")) {
    cursor--;
  }
  // If the char before is `,` we already have a trailing comma → element
  // separator is just `<newline><indent>`. Otherwise we need to prepend ","
  // to the first inserted element.
  const needsLeadingComma = cursor >= 0 && source.charAt(cursor) !== ",";
  // Build insertion text
  const parts: string[] = [];
  for (let i = 0; i < newElements.length; i++) {
    const isFirst = i === 0;
    if (isFirst && needsLeadingComma) parts.push(",");
    parts.push("\n" + elementIndent + newElements[i] + ",");
  }
  parts.push("\n"); // ensure `]` stays on its own line if it was
  // If the `]` didn't originally sit on its own line (single-line array),
  // don't force a newline before it — just leave a space.
  // Detect: was there any `\n` between last non-ws char and `]`?
  const hadNewlineBeforeClose = source.slice(cursor + 1, arrCloseBracketPos).includes("\n");
  const insertion = hadNewlineBeforeClose
    ? parts.slice(0, -1).join("") // drop trailing newline · original already provides one before `]`
    : parts.join("") + " ";

  const next = source.slice(0, arrCloseBracketPos) + insertion + source.slice(arrCloseBracketPos);

  // Re-parse the mutated source to verify it's still valid TypeScript
  const verify = ts.createSourceFile("__nex1v.ts", next, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  // Rough validity check: reparse and count syntactic diagnostics (skip
  // full type-check · adapter's contract is syntactic validity only)
  if ((verify as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics
      && (verify as unknown as { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length > 0) {
    return {
      ok: false,
      refusal: "mutation_produced_invalid_source",
      reason: `re-parse of mutated source produced ${(verify as unknown as { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length} parse diagnostic(s)`,
    };
  }
  void peerIdValue;

  return {
    ok: true,
    next,
    rationale:
      `text-splice: inserted ${toInsert.length} element(s) into ${input.array_symbol} ` +
      `(ids: ${toInsert.map((s) => `'${s}'`).join(", ")}${skipped.length > 0 ? ` · skipped already-present: ${skipped.map((s) => `'${s}'`).join(", ")}` : ""})`,
    inserted_ids: toInsert,
    skipped_already_present_ids: skipped,
  };
}

function resolveArrayLiteral(expr: ts.Expression): ts.ArrayLiteralExpression | null {
  if (ts.isArrayLiteralExpression(expr)) return expr;
  // Object.freeze([...])
  if (
    ts.isCallExpression(expr) &&
    ts.isPropertyAccessExpression(expr.expression) &&
    ts.isIdentifier(expr.expression.expression) &&
    expr.expression.expression.text === "Object" &&
    expr.expression.name.getText() === "freeze" &&
    expr.arguments.length === 1 &&
    ts.isArrayLiteralExpression(expr.arguments[0]!)
  ) {
    return expr.arguments[0] as ts.ArrayLiteralExpression;
  }
  // `as const` assertion around an array literal (as ArrayLiteralExpression)
  if (ts.isAsExpression(expr) && ts.isArrayLiteralExpression(expr.expression)) {
    return expr.expression;
  }
  return null;
}

function findIdProperty(obj: ts.ObjectLiteralExpression, fieldName: string): ts.PropertyAssignment | null {
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    if (ts.isIdentifier(p.name) && p.name.text === fieldName) return p;
    if (ts.isStringLiteral(p.name) && p.name.text === fieldName) return p;
  }
  return null;
}

function escapeStringLiteralByQuote(value: string, quote: string): string {
  // Escape only the specific quote char and backslash. Also escape newlines
  // as `\\n` since single-quoted / double-quoted literals cannot span lines.
  // Template-literal (backtick) quote allows newlines, so leave them alone
  // when quote === "`".
  const esc = value.replace(/\\/g, "\\\\").replace(new RegExp(quote, "g"), `\\${quote}`);
  if (quote === "`") return esc;
  return esc.replace(/\r?\n/g, "\\n");
}

// ─── Operation 6 · replace_return_literal (Fix 23a · authorised 2026-09-17) ──
//
// Consume the `Nex1RepairProposal` emitted by capability-J.2 (change_kind =
// "replace_return_literal") and produce a mutated source that replaces
// exactly one literal within the named function body.
//
// Handles three sub-shapes deterministically:
//   1. Direct literal return:  return 42;
//   2. Object literal return with an explicit literal property:
//        return { field: 42 };
//   3. Object literal return with a shorthand property backed by a local var
//      initialized with a literal:
//        const field = 42; return { field };
//
// Refuses cleanly on any of:
//   symbol_not_found · initializer_not_supported_form · no_match_for_literal ·
//   multiple_matches_ambiguous · mutation_produced_invalid_source
//
// Zero LLM · zero randomness · zero fabrication.

export interface ReplaceReturnLiteralInput {
  readonly target_function: string;
  readonly current_literal: string;
  readonly proposed_literal: string;
  /** Fix 23b · optional line-precise disambiguation for computed intermediates.
   *  When set, the operator restricts its search to numeric literals whose
   *  1-based line matches. */
  readonly target_line?: number | null;
  /** Fix 23b · optional exact char-range from the data-flow tracer. When set,
   *  the operator replaces exactly that range · line/text checks are still
   *  performed as safety belt. */
  readonly target_range?: { readonly start: number; readonly end: number } | null;
}

export type ReplaceReturnLiteralRefusal =
  | "input_empty_function"
  | "input_empty_current_literal"
  | "input_empty_proposed_literal"
  | "source_unparseable"
  | "symbol_not_found"
  | "return_not_found"
  | "no_match_for_literal"
  | "multiple_matches_ambiguous"
  | "mutation_produced_invalid_source"
  | "target_range_safety_belt_failed";

export interface ReplaceReturnLiteralOk {
  readonly ok: true;
  readonly next: string;
  readonly rationale: string;
  readonly replaced_at_line: number;
  readonly replaced_shape:
    | "direct_return"
    | "object_property"
    | "shorthand_local_literal"
    | "line_precise_in_function";
}
export interface ReplaceReturnLiteralRefused {
  readonly ok: false;
  readonly refusal: ReplaceReturnLiteralRefusal;
  readonly reason: string;
}
export type ReplaceReturnLiteralResult = ReplaceReturnLiteralOk | ReplaceReturnLiteralRefused;

/** Normalise a literal string for comparison. Strips leading +. Retains
 *  original quoting style for strings. Mirrors capability-j2's normaliser
 *  behaviour just enough for equality checks. */
function normLitForCompare(s: string): string {
  const t = s.trim();
  if (/^\+?-?\d+(\.\d+)?$/.test(t)) return t.replace(/^\+/, "");
  return t;
}

export function applyReplaceReturnLiteral(
  source: string,
  input: ReplaceReturnLiteralInput,
): ReplaceReturnLiteralResult {
  if (!input.target_function) {
    return { ok: false, refusal: "input_empty_function", reason: "target_function is empty" };
  }
  if (!input.current_literal || input.current_literal.trim() === "") {
    return { ok: false, refusal: "input_empty_current_literal", reason: "current_literal is empty" };
  }
  if (!input.proposed_literal || input.proposed_literal.trim() === "") {
    return { ok: false, refusal: "input_empty_proposed_literal", reason: "proposed_literal is empty" };
  }

  let sf: ts.SourceFile;
  try {
    sf = ts.createSourceFile("__t.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  } catch (e) {
    return { ok: false, refusal: "source_unparseable", reason: `parse failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  // Fix 23b · line-precise replacement (data-flow-aware repair path).
  // When target_range is set, verify that the text at [start,end) equals the
  // supplied current_literal (safety belt) and that start's line matches
  // target_line if provided. Replace exactly that range.
  if (input.target_range) {
    const { start, end } = input.target_range;
    if (start < 0 || end > source.length || start >= end) {
      return { ok: false, refusal: "target_range_safety_belt_failed", reason: `range [${start},${end}) is invalid for source length ${source.length}` };
    }
    const slice = source.slice(start, end);
    if (slice.trim() !== input.current_literal.trim()) {
      return {
        ok: false,
        refusal: "target_range_safety_belt_failed",
        reason: `text at range [${start},${end}) is '${slice}' but current_literal is '${input.current_literal}'`,
      };
    }
    if (input.target_line != null) {
      const line = sf.getLineAndCharacterOfPosition(start).line + 1;
      if (line !== input.target_line) {
        return {
          ok: false,
          refusal: "target_range_safety_belt_failed",
          reason: `range starts at line ${line} but target_line=${input.target_line}`,
        };
      }
    }
    const next = source.slice(0, start) + input.proposed_literal + source.slice(end);
    if (!isValidTypeScript(next)) {
      return { ok: false, refusal: "mutation_produced_invalid_source", reason: "post-mutation TS parse failed" };
    }
    return {
      ok: true,
      next,
      rationale:
        `replaced line-precise literal '${input.current_literal}' with '${input.proposed_literal}' at ` +
        `${input.target_function}:${sf.getLineAndCharacterOfPosition(start).line + 1} (range [${start},${end}))`,
      replaced_at_line: sf.getLineAndCharacterOfPosition(start).line + 1,
      replaced_shape: "line_precise_in_function",
    };
  }

  // Locate the named function's body
  let fnBody: ts.Block | undefined;
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === input.target_function && stmt.body) {
      fnBody = stmt.body;
      break;
    }
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (
          ts.isIdentifier(d.name) &&
          d.name.text === input.target_function &&
          d.initializer &&
          (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) &&
          ts.isBlock(d.initializer.body)
        ) {
          fnBody = d.initializer.body;
          break;
        }
      }
      if (fnBody) break;
    }
  }
  if (!fnBody) {
    return { ok: false, refusal: "symbol_not_found", reason: `no function '${input.target_function}' with a body found at top level` };
  }

  const wantedNorm = normLitForCompare(input.current_literal);

  // Sub-shape 1 · direct literal return
  for (const s of fnBody.statements) {
    if (ts.isReturnStatement(s) && s.expression) {
      const e = s.expression;
      const isLit =
        ts.isNumericLiteral(e) ||
        ts.isStringLiteral(e) ||
        e.kind === ts.SyntaxKind.TrueKeyword ||
        e.kind === ts.SyntaxKind.FalseKeyword ||
        e.kind === ts.SyntaxKind.NullKeyword;
      if (isLit) {
        const text = e.getText(sf);
        if (normLitForCompare(text) === wantedNorm) {
          const start = e.getStart(sf);
          const end = e.getEnd();
          const before = source.slice(0, start);
          const after = source.slice(end);
          const next = before + input.proposed_literal + after;
          if (!isValidTypeScript(next)) {
            return { ok: false, refusal: "mutation_produced_invalid_source", reason: "post-mutation TS parse failed" };
          }
          const line = sf.getLineAndCharacterOfPosition(start).line + 1;
          return {
            ok: true,
            next,
            rationale: `replaced direct return literal '${input.current_literal}' with '${input.proposed_literal}' in ${input.target_function} at line ${line}`,
            replaced_at_line: line,
            replaced_shape: "direct_return",
          };
        }
      }
    }
  }

  // Sub-shape 2 · object literal return with an explicit literal property
  // Sub-shape 3 · shorthand property backed by a local variable literal
  const matches: Array<{
    start: number;
    end: number;
    line: number;
    shape: "object_property" | "shorthand_local_literal";
    localName?: string;
  }> = [];

  for (const s of fnBody.statements) {
    if (!ts.isReturnStatement(s) || !s.expression) continue;
    let expr: ts.Expression = s.expression;
    while (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
      expr = (expr as any).expression;
    }
    if (!ts.isObjectLiteralExpression(expr)) continue;
    for (const prop of expr.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const val = prop.initializer;
        const isLit =
          ts.isNumericLiteral(val) ||
          ts.isStringLiteral(val) ||
          val.kind === ts.SyntaxKind.TrueKeyword ||
          val.kind === ts.SyntaxKind.FalseKeyword ||
          val.kind === ts.SyntaxKind.NullKeyword;
        if (isLit && normLitForCompare(val.getText(sf)) === wantedNorm) {
          matches.push({
            start: val.getStart(sf),
            end: val.getEnd(),
            line: sf.getLineAndCharacterOfPosition(val.getStart(sf)).line + 1,
            shape: "object_property",
          });
        }
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        const localName = prop.name.text;
        // Find the local variable declaration in fnBody
        for (const inner of fnBody.statements) {
          if (!ts.isVariableStatement(inner)) continue;
          for (const d of inner.declarationList.declarations) {
            if (ts.isIdentifier(d.name) && d.name.text === localName && d.initializer) {
              const init = d.initializer;
              const isLit =
                ts.isNumericLiteral(init) ||
                ts.isStringLiteral(init) ||
                init.kind === ts.SyntaxKind.TrueKeyword ||
                init.kind === ts.SyntaxKind.FalseKeyword ||
                init.kind === ts.SyntaxKind.NullKeyword;
              if (isLit && normLitForCompare(init.getText(sf)) === wantedNorm) {
                matches.push({
                  start: init.getStart(sf),
                  end: init.getEnd(),
                  line: sf.getLineAndCharacterOfPosition(init.getStart(sf)).line + 1,
                  shape: "shorthand_local_literal",
                  localName,
                });
              }
            }
          }
        }
      }
    }
  }

  if (matches.length === 0) {
    return { ok: false, refusal: "no_match_for_literal", reason: `no literal '${input.current_literal}' found in return chain of ${input.target_function}` };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      refusal: "multiple_matches_ambiguous",
      reason: `${matches.length} literals in ${input.target_function} match '${input.current_literal}' · deterministic operator refuses without disambiguation`,
    };
  }
  const m = matches[0];
  const next = source.slice(0, m.start) + input.proposed_literal + source.slice(m.end);
  if (!isValidTypeScript(next)) {
    return { ok: false, refusal: "mutation_produced_invalid_source", reason: "post-mutation TS parse failed" };
  }
  return {
    ok: true,
    next,
    rationale:
      `replaced ${m.shape} literal '${input.current_literal}' with '${input.proposed_literal}' in ${input.target_function}` +
      (m.localName ? ` (via shorthand local '${m.localName}')` : ``) +
      ` at line ${m.line}`,
    replaced_at_line: m.line,
    replaced_shape: m.shape,
  };
}

/** Deterministic TS parse validity check · no diagnostics semantics, just
 *  "parser did not blow up." Mirrors the pattern used by applyAddArrayElement. */
function isValidTypeScript(source: string): boolean {
  try {
    ts.createSourceFile("__v.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    return true;
  } catch {
    return false;
  }
}

// ─── Diff renderer (whole-file replacement · same shape as template-only) ──

function renderWholeFileDiff(path: string, before: string, after: string): string {
  const beforeLines = before === "" ? [] : before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const header = [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${beforeLines.length === 0 ? "0,0" : `1,${beforeLines.length}`} +1,${afterLines.length} @@`,
  ];
  const body: string[] = [];
  for (const l of beforeLines) body.push(`-${l}`);
  for (const l of afterLines) body.push(`+${l}`);
  return [...header, ...body].join("\n") + "\n";
}
