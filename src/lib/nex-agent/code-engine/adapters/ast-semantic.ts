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
  // Step 2 · parent-walk upward
  let cur: ts.Node | undefined = deepest;
  while (cur) {
    if (ts.isObjectLiteralExpression(cur)) return cur;
    if (ts.isParenthesizedExpression(cur) && ts.isObjectLiteralExpression(cur.expression)) {
      return cur.expression;
    }
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
