// src/lib/nex-agent/code-engine/capability-k-local-value-dataflow.ts
//
// NEX1 · CAPABILITY K · LOCAL-VALUE → PRODUCER → DATAFLOW TRACE · deterministic · zero LLM.
//
// Founder direction (2026-09-15): "Native Local Value → Producer → Dataflow Trace.
// Not 'fix supervisor.test.ts'. Extend J.2 so it can deterministically resolve
// this structural pattern."
//
// Scope · ONE structural pattern only. If any step of the pattern doesn't
// match, refuse cleanly. Never guess. Never substitute LLM inference.
//
// Pattern signature (all seven conditions must hold):
//   (P1) failing assertion is `expect(<localVar>.<memberName>).toBe(<numLiteral>)`
//        where memberName is 'size' or 'length' and the finding says
//        `expected=<literal> · actual=<literal>` with expected > actual.
//   (P2) <localVar> is declared in the same test body as
//        `const <localVar> = <fnIdent>({ ..., <arrayArgName>: <arrayExpr>, ... })`
//   (P3) <fnIdent> is imported from a relative module path.
//   (P4) the producer file exports a function <fnIdent> whose body contains
//        `for (const <item> of input.<arrayArgName>) { ... }`
//        AND inside that loop, an early-return filter of shape
//        `if (!<REGISTRY_IDENT>.find((a) => a.<idField> === <item>.<idField>)) continue;`
//   (P5) <REGISTRY_IDENT> is imported from another module path in the producer file.
//   (P6) the registry module exports `<REGISTRY_IDENT>` as an array literal of
//        object literals each carrying `id: <string_literal>` (or the same idField).
//   (P7) each element of <arrayExpr> in the test call site is a call
//        `<builderFn>('<string_literal>')` where the string literal is the id we
//        care about — this lets us enumerate provisioned_ids as string literals.
//
// If all seven hold: compute missing_ids = provisioned_ids \ registry_ids.
// If missing_ids.length === expected - actual, propose an add_array_element
// repair. Otherwise refuse (ambiguous).
//
// This module does NOT modify files. It produces a Nex1DataflowProposal
// descriptor. Application is the responsibility of a future ast-semantic
// operator (add_array_element) — the next rung on the ladder.

import ts from "typescript";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import type { Nex1RuntimeFailureFinding } from "./capability-j-runtime-diagnosis";
import { isProtected } from "./scope-enforcer";

export type Nex1DataflowRefusalKind =
  | "refused_not_assertion_mismatch"
  | "refused_no_test_file"
  | "refused_test_file_missing"
  | "refused_expected_not_numeric"
  | "refused_no_assertion_site"
  | "refused_receiver_not_member_access"
  | "refused_receiver_member_not_size_or_length"
  | "refused_local_var_not_found"
  | "refused_initializer_not_call"
  | "refused_producer_ident_not_imported"
  | "refused_producer_import_not_relative"
  | "refused_producer_source_not_found"
  | "refused_producer_function_not_found"
  | "refused_producer_no_matching_for_of"
  | "refused_producer_no_reject_filter"
  | "refused_registry_ident_not_imported"
  | "refused_registry_source_not_found"
  | "refused_registry_array_not_found"
  | "refused_registry_elements_not_literals"
  | "refused_arg_array_shape_unsupported"
  | "refused_arg_elements_not_builder_calls"
  | "refused_missing_count_mismatch"
  | "refused_ambiguous_multiple_matches"
  | "refused_protected_target";

export interface Nex1DataflowProposal {
  readonly change_kind: "add_array_element";
  readonly target_file: string; // repo-relative
  readonly array_symbol: string; // e.g. AGENT_REGISTRY
  readonly missing_ids: readonly string[]; // one or more
  readonly peer_element_source: string; // verbatim text of a sibling element · for future add_array_element operator
  readonly id_field: string; // e.g. "id"
  readonly rationale: string;
}

export interface Nex1DataflowDiagnosis {
  readonly kind: "proposal" | Nex1DataflowRefusalKind;
  readonly finding_ref: Nex1RuntimeFailureFinding;
  readonly diagnosis: string;
  readonly proposal: Nex1DataflowProposal | null;
  readonly confidence: number;
  readonly reasoning_trace: readonly string[];
  readonly taught_by: "master_ai_engineer";
}

export function traceLocalValueDataflow(
  finding: Nex1RuntimeFailureFinding,
  repoRoot: string,
): Nex1DataflowDiagnosis {
  const trace: string[] = [];
  const T = (s: string) => trace.push(s);

  // Guard: only assertion_mismatch is in scope for K
  if (finding.kind !== "assertion_mismatch") {
    return refuse("refused_not_assertion_mismatch", finding, `kind='${finding.kind}' outside K's scope`, trace, 0.95);
  }
  if (!finding.test_file) {
    return refuse("refused_no_test_file", finding, "finding has no test_file", trace, 0.95);
  }
  const testFileRel = finding.test_file.replace(/\\/g, "/");
  const testFileAbs = pathResolve(repoRoot, testFileRel);
  if (!existsSync(testFileAbs)) {
    return refuse("refused_test_file_missing", finding, `test file not on disk: ${testFileRel}`, trace, 0.95);
  }
  T(`read test file · ${testFileRel}`);

  const expectedNum = parseNumericLiteral(finding.expected);
  const actualNum = parseNumericLiteral(finding.actual);
  if (expectedNum === null || actualNum === null) {
    return refuse(
      "refused_expected_not_numeric",
      finding,
      `expected='${finding.expected}' or actual='${finding.actual}' is not a numeric literal · outside K's scope`,
      trace,
      0.9,
    );
  }
  if (expectedNum <= actualNum) {
    return refuse(
      "refused_expected_not_numeric",
      finding,
      `K only handles expected > actual (missing-entries case) · here expected=${expectedNum} actual=${actualNum}`,
      trace,
      0.85,
    );
  }
  T(`parsed expected=${expectedNum} · actual=${actualNum} · gap=${expectedNum - actualNum}`);

  const testSource = readFileSync(testFileAbs, "utf8");
  const testSf = ts.createSourceFile(testFileRel, testSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  // (P1) Locate expect(<localVar>.<member>).toBe(<literal>) whose literal
  //       matches expected AND (if the finding names one) whose enclosing
  //       it(...) title matches the finding's test_name. Without the test-name
  //       filter, multi-test files would consistently match the FIRST it(...)
  //       block whose literal matched, causing false negatives on iterations
  //       past the first — which is the exact bug the Rung-4 demo exposed.
  const site = findAssertionSite(testSf, expectedNum, finding.test_name ?? null);
  if (!site) {
    return refuse(
      "refused_no_assertion_site",
      finding,
      `no expect(X.size|X.length).toBe(${expectedNum}) call found in test file`,
      trace,
      0.85,
    );
  }
  T(`located assertion site · line=${site.line} · receiver=${site.localVar}.${site.member}`);
  if (site.member !== "size" && site.member !== "length") {
    return refuse(
      "refused_receiver_member_not_size_or_length",
      finding,
      `assertion member '${site.member}' not in K's scope (size|length only)`,
      trace,
      0.85,
    );
  }

  // (P2) Trace <localVar> to `const <localVar> = <fnIdent>({...})` in the same test body
  const decl = findLocalVarDeclaration(site.enclosingBlock, site.localVar);
  if (!decl) {
    return refuse(
      "refused_local_var_not_found",
      finding,
      `local variable '${site.localVar}' not declared in the same block as the assertion`,
      trace,
      0.8,
    );
  }
  if (!decl.callee) {
    return refuse("refused_initializer_not_call", finding, `'${site.localVar}' is not initialised from a function call`, trace, 0.8);
  }
  T(`local var '${site.localVar}' initialised from call to '${decl.callee}' · ${decl.arrayArgName ? `array-arg='${decl.arrayArgName}'` : "no array-arg identified"}`);
  if (!decl.arrayArgName) {
    return refuse(
      "refused_arg_array_shape_unsupported",
      finding,
      `initializer call arguments do not contain an array-valued property this pass understands`,
      trace,
      0.75,
    );
  }
  if (decl.arrayArgElementStrings === null) {
    return refuse(
      "refused_arg_elements_not_builder_calls",
      finding,
      `array-arg '${decl.arrayArgName}' elements are not simple builder(<string>) calls this pass understands`,
      trace,
      0.7,
    );
  }
  T(`extracted ${decl.arrayArgElementStrings.length} provisioned string literals from array-arg '${decl.arrayArgName}': [${decl.arrayArgElementStrings.map((s) => `'${s}'`).join(", ")}]`);

  // (P3) Resolve producer function import in the test file
  const producerImport = findRelativeImportOfIdent(testSf, decl.callee);
  if (!producerImport) {
    return refuse(
      "refused_producer_ident_not_imported",
      finding,
      `'${decl.callee}' has no relative-path import in the test file (K only handles relative imports)`,
      trace,
      0.8,
    );
  }
  T(`producer '${decl.callee}' imported from relative path '${producerImport}'`);

  // (P4) Read producer source · find function · analyze for-of + reject filter
  const producerAbs = resolveRelativeImport(dirname(testFileAbs), producerImport);
  if (!producerAbs || !existsSync(producerAbs)) {
    return refuse("refused_producer_source_not_found", finding, `producer module '${producerImport}' did not resolve to an existing .ts file`, trace, 0.8);
  }
  const producerRel = repoRelative(producerAbs, repoRoot);
  T(`producer source · ${producerRel}`);
  const producerSource = readFileSync(producerAbs, "utf8");
  const producerSf = ts.createSourceFile(producerRel, producerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const producerFn = findExportedFunction(producerSf, decl.callee);
  if (!producerFn) {
    return refuse(
      "refused_producer_function_not_found",
      finding,
      `producer file does not export a function named '${decl.callee}'`,
      trace,
      0.8,
    );
  }
  T(`producer function found · ${decl.callee}`);

  const forOf = findForOfOnInputProperty(producerFn, decl.arrayArgName);
  if (!forOf) {
    return refuse(
      "refused_producer_no_matching_for_of",
      finding,
      `producer body has no 'for (const X of input.${decl.arrayArgName})' loop`,
      trace,
      0.75,
    );
  }
  T(`producer for-of loop · item='${forOf.itemName}'`);

  const rejectFilter = findRejectByFindFilter(forOf.body, forOf.itemName);
  if (!rejectFilter) {
    return refuse(
      "refused_producer_no_reject_filter",
      finding,
      `no 'if (!<REGISTRY>.find(a => a.<field> === ${forOf.itemName}.<field>)) continue;' in the loop body`,
      trace,
      0.75,
    );
  }
  T(`reject filter found · registry='${rejectFilter.registryIdent}' · idField='${rejectFilter.idField}'`);

  // (P5) Resolve REGISTRY import (relative OR '@/' alias)
  const relativeImportPath = findRelativeImportOfIdent(producerSf, rejectFilter.registryIdent);
  const aliasImport = findAliasImportOfIdent(producerSf, rejectFilter.registryIdent);
  const registryImport: { raw: string; kind: "relative" | "alias" } | null =
    relativeImportPath !== null
      ? { raw: relativeImportPath, kind: "relative" }
      : aliasImport;
  if (!registryImport) {
    return refuse(
      "refused_registry_ident_not_imported",
      finding,
      `'${rejectFilter.registryIdent}' has no relative or '@/' alias import in producer`,
      trace,
      0.75,
    );
  }
  T(`registry '${rejectFilter.registryIdent}' imported from '${registryImport.raw}' (kind=${registryImport.kind})`);
  const registryAbs = registryImport.kind === "relative"
    ? resolveRelativeImport(dirname(producerAbs), registryImport.raw)
    : resolveAliasImport(registryImport.raw, repoRoot);
  if (!registryAbs || !existsSync(registryAbs)) {
    return refuse(
      "refused_registry_source_not_found",
      finding,
      `registry module did not resolve to a .ts file`,
      trace,
      0.75,
    );
  }
  const registryRel = repoRelative(registryAbs, repoRoot);

  // Constitutional check
  if (isProtected(registryRel.replace(/\\/g, "/"))) {
    return refuse(
      "refused_protected_target",
      finding,
      `registry file is protected · cannot propose mutation`,
      trace,
      0.95,
    );
  }
  T(`registry source · ${registryRel}`);

  // (P6) Parse registry file · find array literal · extract ids
  const registrySource = readFileSync(registryAbs, "utf8");
  const registrySf = ts.createSourceFile(registryRel, registrySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const registryArr = findExportedArrayLiteral(registrySf, rejectFilter.registryIdent, rejectFilter.idField);
  if (!registryArr) {
    return refuse(
      "refused_registry_array_not_found",
      finding,
      `no exported array literal named '${rejectFilter.registryIdent}' with '${rejectFilter.idField}: <string>' elements`,
      trace,
      0.75,
    );
  }
  T(`registry array literal · ${registryArr.ids.length} entries · idField='${rejectFilter.idField}'`);
  const registryIds = new Set(registryArr.ids);

  // (P7) Cross-reference provisioned ids vs registry ids
  const provisionedIds = decl.arrayArgElementStrings;
  const missing = provisionedIds.filter((id) => !registryIds.has(id));
  T(`missing_ids = provisioned \\ registry = [${missing.map((s) => `'${s}'`).join(", ")}]`);

  const gap = expectedNum - actualNum;
  if (missing.length !== gap) {
    return refuse(
      "refused_missing_count_mismatch",
      finding,
      `missing_ids.length=${missing.length} ≠ expected-actual=${gap} · another root cause is likely · refusing rather than guessing`,
      trace,
      0.85,
    );
  }

  // Success · produce the proposal
  const peer = registryArr.peerElementSource ?? "(unknown peer shape)";
  const proposal: Nex1DataflowProposal = {
    change_kind: "add_array_element",
    target_file: registryRel.replace(/\\/g, "/"),
    array_symbol: rejectFilter.registryIdent,
    missing_ids: missing,
    peer_element_source: peer,
    id_field: rejectFilter.idField,
    rationale:
      `Assertion 'expect(${site.localVar}.${site.member}).toBe(${expectedNum})' fails with actual=${actualNum} ` +
      `because ${gap} provisioned id(s) [${missing.map((s) => `'${s}'`).join(", ")}] are absent from ` +
      `${rejectFilter.registryIdent} · producer '${decl.callee}' rejects them via 'if (!${rejectFilter.registryIdent}.find(...))'`,
  };
  return {
    kind: "proposal",
    finding_ref: finding,
    diagnosis:
      `local-value → producer → dataflow trace succeeded · registry '${rejectFilter.registryIdent}' at '${registryRel}' ` +
      `missing ${missing.length} entry(s): [${missing.map((s) => `'${s}'`).join(", ")}]`,
    proposal,
    confidence: 0.85,
    reasoning_trace: trace,
    taught_by: "master_ai_engineer",
  };
}

// ─── AST helpers ───────────────────────────────────────────────────

interface AssertionSite {
  readonly line: number;
  readonly localVar: string;
  readonly member: string;
  readonly enclosingBlock: ts.Block | ts.SourceFile;
  readonly itName: string | null;
}

function findAssertionSite(
  sf: ts.SourceFile,
  expectedLiteral: number,
  testNameFilter: string | null,
): AssertionSite | null {
  // Extract the short leaf test name (last "> " segment) from the finding
  // path. Vitest reports test names as "describe1 > describe2 > it-name".
  const leafTestName = testNameFilter
    ? testNameFilter.split(">").pop()?.trim() ?? null
    : null;

  const candidates: AssertionSite[] = [];
  const visit = (node: ts.Node, blockCtx: ts.Block | ts.SourceFile, enclosingItName: string | null) => {
    let block = blockCtx;
    if (ts.isBlock(node)) block = node;
    // Track when we enter an `it("name", () => {...})` block so we can filter
    // by the finding's test_name.
    let nextEnclosing = enclosingItName;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "it" &&
      node.arguments.length >= 2 &&
      (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
    ) {
      nextEnclosing = (node.arguments[0] as ts.StringLiteral | ts.NoSubstitutionTemplateLiteral).text;
    }
    // Match: expect(<var>.<member>).toBe(<literal>)
    if (ts.isCallExpression(node)) {
      const info = matchExpectToBeMember(node);
      if (info && info.expectedLiteral === expectedLiteral) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        candidates.push({
          line: line + 1,
          localVar: info.localVar,
          member: info.member,
          enclosingBlock: block,
          itName: nextEnclosing,
        });
      }
    }
    node.forEachChild((c) => visit(c, block, nextEnclosing));
  };
  visit(sf, sf, null);

  if (candidates.length === 0) return null;
  // If we have a filter, prefer a candidate whose enclosing it-name matches
  // (equals or endsWith to accommodate "describe > it-name" variants). If no
  // filter or no match found, fall back to the first candidate.
  if (leafTestName) {
    const filtered = candidates.find((c) => c.itName === leafTestName || (c.itName !== null && leafTestName.endsWith(c.itName)));
    if (filtered) return filtered;
  }
  return candidates[0];
}

function matchExpectToBeMember(
  call: ts.CallExpression,
): { localVar: string; member: string; expectedLiteral: number } | null {
  // Must be a .toBe(...) call on the result of expect(...)
  if (!ts.isPropertyAccessExpression(call.expression)) return null;
  const method = call.expression.name.getText();
  if (method !== "toBe") return null;
  const inner = call.expression.expression;
  if (!ts.isCallExpression(inner)) return null;
  if (!ts.isIdentifier(inner.expression) || inner.expression.text !== "expect") return null;
  if (inner.arguments.length !== 1) return null;
  const arg = inner.arguments[0]!;
  if (!ts.isPropertyAccessExpression(arg)) return null;
  if (!ts.isIdentifier(arg.expression)) return null;
  if (call.arguments.length !== 1) return null;
  const lit = call.arguments[0]!;
  if (!ts.isNumericLiteral(lit)) return null;
  return {
    localVar: arg.expression.text,
    member: arg.name.getText(),
    expectedLiteral: Number(lit.text),
  };
}

interface LocalVarDecl {
  readonly callee: string | null;
  readonly arrayArgName: string | null;
  readonly arrayArgElementStrings: readonly string[] | null;
}

function findLocalVarDeclaration(block: ts.Block | ts.SourceFile, name: string): LocalVarDecl | null {
  let out: LocalVarDecl | null = null;
  const visit = (node: ts.Node) => {
    if (out) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      let callee: string | null = null;
      let arrayArgName: string | null = null;
      let arrayArgElements: string[] | null = null;
      if (node.initializer && ts.isCallExpression(node.initializer)) {
        const call = node.initializer;
        if (ts.isIdentifier(call.expression)) {
          callee = call.expression.text;
        }
        // Look at args for an object literal with one array-valued property
        if (call.arguments.length === 1 && ts.isObjectLiteralExpression(call.arguments[0]!)) {
          const obj = call.arguments[0] as ts.ObjectLiteralExpression;
          for (const p of obj.properties) {
            if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
              if (ts.isArrayLiteralExpression(p.initializer)) {
                arrayArgName = p.name.text;
                arrayArgElements = extractStringArgsFromBuilderCalls(p.initializer);
                break;
              }
            } else if (ts.isShorthandPropertyAssignment(p)) {
              // e.g. { provisioned, trusted_founder_public_keys_hex: [] }
              // The array-valued property is passed by identifier — trace back to its declaration.
              const shorthand = p.name.text;
              const upstream = findArrayDeclInScope(block, shorthand);
              if (upstream) {
                arrayArgName = shorthand;
                arrayArgElements = upstream;
                break;
              }
            }
          }
        }
      }
      out = { callee, arrayArgName, arrayArgElementStrings: arrayArgElements };
      return;
    }
    node.forEachChild(visit);
  };
  visit(block);
  return out;
}

function findArrayDeclInScope(scope: ts.Block | ts.SourceFile, name: string): string[] | null {
  let out: string[] | null = null;
  const visit = (node: ts.Node) => {
    if (out) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      if (node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
        out = extractStringArgsFromBuilderCalls(node.initializer);
      }
      return;
    }
    node.forEachChild(visit);
  };
  visit(scope);
  return out;
}

// From [builder('a'), builder(`b`), builder('c')] → ['a', 'b', 'c']
// Accepts StringLiteral or NoSubstitutionTemplateLiteral · rejects template
// strings that contain expressions. If any element is not that shape, null.
function extractStringArgsFromBuilderCalls(arr: ts.ArrayLiteralExpression): string[] | null {
  const out: string[] = [];
  for (const el of arr.elements) {
    if (!ts.isCallExpression(el)) return null;
    if (el.arguments.length !== 1) return null;
    const a = el.arguments[0]!;
    const literal = extractPlainStringLiteral(a);
    if (literal === null) return null;
    out.push(literal);
  }
  return out;
}

function extractPlainStringLiteral(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function findRelativeImportOfIdent(sf: ts.SourceFile, name: string): string | null {
  let hit: string | null = null;
  sf.forEachChild((node) => {
    if (hit) return;
    if (!ts.isImportDeclaration(node)) return;
    const spec = node.moduleSpecifier;
    if (!ts.isStringLiteral(spec)) return;
    const modulePath = spec.text;
    if (!modulePath.startsWith(".")) return;
    const clause = node.importClause;
    if (!clause?.namedBindings) return;
    if (ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        const local = el.name.text;
        if (local === name) {
          hit = modulePath;
          return;
        }
      }
    }
  });
  return hit;
}

function findAliasImportOfIdent(sf: ts.SourceFile, name: string): { raw: string; kind: "alias" } | null {
  let hit: { raw: string; kind: "alias" } | null = null;
  sf.forEachChild((node) => {
    if (hit) return;
    if (!ts.isImportDeclaration(node)) return;
    const spec = node.moduleSpecifier;
    if (!ts.isStringLiteral(spec)) return;
    const modulePath = spec.text;
    if (!modulePath.startsWith("@/")) return;
    const clause = node.importClause;
    if (!clause?.namedBindings) return;
    if (ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        if (el.name.text === name) {
          hit = { raw: modulePath, kind: "alias" };
          return;
        }
      }
    }
  });
  return hit;
}

function findRelativeImportOfIdentWithKind(sf: ts.SourceFile, name: string): { raw: string; kind: "relative" } | null {
  const raw = findRelativeImportOfIdent(sf, name);
  return raw ? { raw, kind: "relative" } : null;
}
void findRelativeImportOfIdentWithKind; // reserved for future use

function resolveRelativeImport(fromDir: string, spec: string): string | null {
  const base = pathResolve(fromDir, spec);
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  if (existsSync(base) && (base.endsWith(".ts") || base.endsWith(".tsx"))) return base;
  return null;
}

function resolveAliasImport(spec: string, repoRoot: string): string | null {
  // "@/lib/x/y" → <repoRoot>/src/lib/x/y
  if (!spec.startsWith("@/")) return null;
  const rel = spec.slice(2);
  const base = pathResolve(repoRoot, "src", rel);
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function repoRelative(abs: string, repoRoot: string): string {
  const rr = repoRoot.replace(/\\/g, "/");
  const a = abs.replace(/\\/g, "/");
  return a.startsWith(rr + "/") ? a.slice(rr.length + 1) : a;
}

function findExportedFunction(sf: ts.SourceFile, name: string): ts.FunctionDeclaration | null {
  let hit: ts.FunctionDeclaration | null = null;
  sf.forEachChild((node) => {
    if (hit) return;
    if (ts.isFunctionDeclaration(node) && node.name && node.name.text === name) {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (isExported) hit = node;
    }
  });
  return hit;
}

interface ForOfMatch {
  readonly itemName: string;
  readonly body: ts.Block;
}

function findForOfOnInputProperty(fn: ts.FunctionDeclaration, argPropName: string): ForOfMatch | null {
  if (!fn.body) return null;
  let hit: ForOfMatch | null = null;
  const visit = (node: ts.Node) => {
    if (hit) return;
    if (ts.isForOfStatement(node)) {
      // `for (const X of input.<argPropName>) { ... }`
      const init = node.initializer;
      let itemName: string | null = null;
      if (ts.isVariableDeclarationList(init) && init.declarations.length === 1) {
        const d = init.declarations[0]!;
        if (ts.isIdentifier(d.name)) itemName = d.name.text;
      }
      const expr = node.expression;
      let isInputArg = false;
      if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
        // input.<name>
        if (expr.name.getText() === argPropName) isInputArg = true;
      }
      if (itemName && isInputArg && ts.isBlock(node.statement)) {
        hit = { itemName, body: node.statement };
        return;
      }
    }
    node.forEachChild(visit);
  };
  visit(fn.body);
  return hit;
}

interface RejectFilterMatch {
  readonly registryIdent: string;
  readonly idField: string; // e.g. "id"
}

function findRejectByFindFilter(block: ts.Block, itemName: string): RejectFilterMatch | null {
  for (const stmt of block.statements) {
    if (!ts.isIfStatement(stmt)) continue;
    const cond = stmt.expression;
    // Expect: !<REG>.find((a) => a.<field> === <item>.<field>)
    if (!ts.isPrefixUnaryExpression(cond) || cond.operator !== ts.SyntaxKind.ExclamationToken) continue;
    const call = cond.operand;
    if (!ts.isCallExpression(call)) continue;
    const findAccess = call.expression;
    if (!ts.isPropertyAccessExpression(findAccess)) continue;
    if (findAccess.name.getText() !== "find") continue;
    if (!ts.isIdentifier(findAccess.expression)) continue;
    const registryIdent = findAccess.expression.text;
    if (call.arguments.length !== 1) continue;
    const arrow = call.arguments[0]!;
    if (!ts.isArrowFunction(arrow)) continue;
    if (arrow.parameters.length !== 1 || !ts.isIdentifier(arrow.parameters[0]!.name)) continue;
    const arrowParamName = arrow.parameters[0]!.name.text;
    // arrow body: <param>.<field> === <item>.<field>
    const body = arrow.body;
    let cmp: ts.BinaryExpression | null = null;
    if (ts.isBinaryExpression(body)) cmp = body;
    else if (ts.isBlock(body)) {
      const ret = body.statements.find((s) => ts.isReturnStatement(s)) as ts.ReturnStatement | undefined;
      if (ret?.expression && ts.isBinaryExpression(ret.expression)) cmp = ret.expression;
    }
    if (!cmp) continue;
    if (cmp.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken) continue;
    if (!ts.isPropertyAccessExpression(cmp.left) || !ts.isPropertyAccessExpression(cmp.right)) continue;
    const leftBase = ts.isIdentifier(cmp.left.expression) ? cmp.left.expression.text : "";
    const rightBase = ts.isIdentifier(cmp.right.expression) ? cmp.right.expression.text : "";
    // Identify which side is the arrow parameter (registry element side).
    // The idField for the registry lookup is the field on that side.
    let idField: string | null = null;
    if (leftBase === arrowParamName && rightBase === itemName) {
      idField = cmp.left.name.getText();
    } else if (rightBase === arrowParamName && leftBase === itemName) {
      idField = cmp.right.name.getText();
    }
    if (!idField) continue;
    // Then-branch must be `continue` (reject path)
    const then = stmt.thenStatement;
    let hasContinue = false;
    if (ts.isContinueStatement(then)) hasContinue = true;
    else if (ts.isBlock(then)) {
      hasContinue = then.statements.some((s) => ts.isContinueStatement(s));
    }
    if (!hasContinue) continue;

    return { registryIdent, idField };
  }
  return null;
}

interface RegistryArrayInfo {
  readonly ids: readonly string[];
  readonly peerElementSource: string | null;
}

function findExportedArrayLiteral(sf: ts.SourceFile, name: string, idField: string): RegistryArrayInfo | null {
  let hit: RegistryArrayInfo | null = null;
  sf.forEachChild((node) => {
    if (hit) return;
    if (!ts.isVariableStatement(node)) return;
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (!isExported) return;
    for (const d of node.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== name) continue;
      if (!d.initializer) continue;
      // Support: export const X = [...]  OR  export const X = Object.freeze([...])
      let arr: ts.ArrayLiteralExpression | null = null;
      if (ts.isArrayLiteralExpression(d.initializer)) arr = d.initializer;
      else if (
        ts.isCallExpression(d.initializer) &&
        ts.isPropertyAccessExpression(d.initializer.expression) &&
        ts.isIdentifier(d.initializer.expression.expression) &&
        d.initializer.expression.expression.text === "Object" &&
        d.initializer.expression.name.getText() === "freeze" &&
        d.initializer.arguments.length === 1 &&
        ts.isArrayLiteralExpression(d.initializer.arguments[0]!)
      ) {
        arr = d.initializer.arguments[0] as ts.ArrayLiteralExpression;
      }
      if (!arr) continue;
      const ids: string[] = [];
      let peer: string | null = null;
      for (const el of arr.elements) {
        if (!ts.isObjectLiteralExpression(el)) return; // heterogeneous · unsupported
        const idProp = el.properties.find((p) => {
          if (!ts.isPropertyAssignment(p)) return false;
          if (!ts.isIdentifier(p.name)) return false;
          return p.name.text === idField;
        }) as ts.PropertyAssignment | undefined;
        if (!idProp || !ts.isStringLiteral(idProp.initializer)) return; // element lacks the id field · unsupported
        ids.push(idProp.initializer.text);
        if (peer === null) peer = el.getText(sf);
      }
      hit = { ids, peerElementSource: peer };
      return;
    }
  });
  return hit;
}

// ─── util ─────────────────────────────────────────────────────────

function parseNumericLiteral(s: string | null): number | null {
  if (s === null) return null;
  const t = s.trim();
  // Vitest renders negative zero as "+0" or "-0" in its compact-verbose
  // output; accept an optional leading sign so K can consume those cases.
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function refuse(
  kind: Nex1DataflowRefusalKind,
  finding: Nex1RuntimeFailureFinding,
  reason: string,
  trace: readonly string[],
  confidence: number,
): Nex1DataflowDiagnosis {
  return {
    kind,
    finding_ref: finding,
    diagnosis: reason,
    proposal: null,
    confidence,
    reasoning_trace: trace,
    taught_by: "master_ai_engineer",
  };
}
