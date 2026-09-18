// src/lib/nex-agent/code-engine/capability-j2-cause-analysis.ts
//
// NEX1 · CAPABILITY J.2 · CAUSE ANALYSIS + REPAIR PROPOSAL · deterministic.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: given a J.1 structured runtime-failure finding, distinguish
// symptom from cause. When the source clearly produced a wrong literal
// against what the test's assertion contract requires, propose a
// STRUCTURED repair. When ambiguity exists, refuse cleanly.
//
// CRITICAL DISCIPLINE (per founder authorization 2026-09-12):
//   · J.2 must NOT mutate production code.
//   · J.2 only produces a Nex1RepairProposal descriptor.
//   · J.3 (future) is the layer that applies a proposal, reruns, and proves.
//   · Refuse when confidence is low, when the failure class is out of scope
//     (timeout / thrown_error / unhandled_rejection · deferred to future
//     iterations), when the source target is protected, when the test may
//     be wrong (contract violated by the test), or when the source cannot
//     be resolved from the test's imports.
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism.

import ts from "typescript";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import type { Nex1RuntimeFailureFinding } from "./capability-j-runtime-diagnosis";
import { isProtected } from "./scope-enforcer";
import {
  traceDataFlowForLiteralCandidates,
  parseArgValue,
  type EvalValue,
  type LiteralCandidate,
} from "./capability-data-flow-tracer";

export type Nex1CauseAnalysisKind =
  | "proposal"
  | "refused_test_may_be_wrong"
  | "refused_low_confidence"
  | "refused_unrepairable_class"
  | "refused_no_source_reference"
  | "refused_protected_target"
  | "refused_missing_stack_hint"
  | "refused_unknown_test_shape";

export interface Nex1RepairProposal {
  readonly change_kind: "replace_return_literal";
  readonly target_file: string;
  readonly target_function: string;
  readonly current_literal: string;
  readonly proposed_literal: string;
  readonly rationale: string;
  /** Fix 23b · 2026-09-17 · when set, the operator must replace the literal
   *  at this specific line within the target function · disambiguates when
   *  the literal text appears multiple times · used by data-flow-aware repair. */
  readonly target_line?: number | null;
  /** Fix 23b · 2026-09-17 · optional exact char range from the tracer. When
   *  provided, the operator uses [start,end) directly instead of text search. */
  readonly target_range?: { readonly start: number; readonly end: number } | null;
}

export interface Nex1FailureDiagnosis {
  readonly kind: Nex1CauseAnalysisKind;
  readonly finding_ref: Nex1RuntimeFailureFinding;
  readonly diagnosis: string;
  readonly proposal: Nex1RepairProposal | null;
  readonly confidence: number;
  readonly reasoning_trace: readonly string[];
  readonly taught_by: "master_ai_engineer";
}

/**
 * @summary Diagnose the root cause of a runtime failure and propose a
 * repair when confidence is high. Otherwise refuse.
 *
 * @param finding · J.1 structured runtime-failure finding
 * @param repoRoot · repo root · used to resolve absolute paths for
 *   protection checks and file reads
 */
export function diagnoseAndPropose(
  finding: Nex1RuntimeFailureFinding,
  repoRoot: string,
): Nex1FailureDiagnosis {
  const trace: string[] = [];
  const T = (s: string) => trace.push(s);

  // ── Out-of-scope failure kinds (deferred to J.2.2 or later) ────────
  if (finding.kind === "timeout" || finding.kind === "thrown_error" || finding.kind === "unhandled_rejection") {
    return diag(
      "refused_unrepairable_class",
      finding,
      `failure kind '${finding.kind}' is not covered by J.2's first pass · deferred`,
      trace,
      0.9,
    );
  }
  if (finding.kind !== "assertion_mismatch" && finding.kind !== "snapshot_mismatch") {
    return diag(
      "refused_unrepairable_class",
      finding,
      `failure kind '${finding.kind}' is not covered by J.2`,
      trace,
      0.9,
    );
  }
  if (finding.kind === "snapshot_mismatch") {
    return diag(
      "refused_unrepairable_class",
      finding,
      "snapshot_mismatch repair is deferred · requires snapshot-file handling out of J.2's scope",
      trace,
      0.9,
    );
  }

  // ── Test-file reachability ─────────────────────────────────────────
  if (!finding.test_file) {
    return diag("refused_no_source_reference", finding, "finding has no test_file · cannot analyse", trace, 0.9);
  }
  const testFileAbs = resolve(repoRoot, finding.test_file);
  if (!existsSync(testFileAbs)) {
    return diag("refused_no_source_reference", finding, `test_file '${finding.test_file}' not found on disk`, trace, 0.9);
  }
  const testSource = readFileSync(testFileAbs, "utf8");
  T(`read test_file · ${finding.test_file} · ${testSource.length}B`);

  // Locate the expect(...).toBe(...) call that matches the observed actual/expected
  const assertionSite = findAssertionSite(testSource, finding);
  if (!assertionSite) {
    return diag(
      "refused_unknown_test_shape",
      finding,
      "no `expect(...).toBe/toEqual(...)` call in the test matches the finding's actual/expected pair",
      trace,
      0.7,
    );
  }
  T(`located assertion · ${assertionSite.summary}`);

  // Refuse ambiguous / out-of-scope assertion shapes cleanly
  if (assertionSite.actualKind === "chained_call") {
    return diag("refused_low_confidence", finding, "assertion argument is a chained call · cause could originate at any of several source functions · J.2.2 refuses without stronger evidence", trace, 0.55);
  }
  if (assertionSite.actualKind === "member_access_on_call_result") {
    return diag("refused_low_confidence", finding, "assertion asserts a field on a returned object · multiple possible source causes · J.2.2 refuses without deeper structural analysis", trace, 0.55);
  }
  if (assertionSite.actualKind === "member_access_on_local") {
    return diag("refused_unknown_test_shape", finding, "assertion asserts a member of a locally-declared identifier · no imported source producer · deferred", trace, 0.5);
  }

  // Fix 20 · 2026-09-17 · Case E-prime · member access on local variable that
  // was initialized from an imported function call:
  //   const x = <importedFn>(...);
  //   expect(x.<field>).toBe(<expected>);
  // Traces to the source function's return-object field. Proposes a
  // repair when the field's value is a simple literal. Refuses cleanly with
  // a precise reason when the value is a computed expression (informs future
  // repair operators without hardcoding).
  if (assertionSite.actualKind === "member_access_on_local_from_imported_call") {
    const importedFn = assertionSite.importedFunctionName!;
    const importSpec = assertionSite.importSpecifier!;
    const memberField = assertionSite.memberField;
    if (!memberField) {
      return diag("refused_low_confidence", finding, "member access has no field name · unusable for structural repair", trace, 0.55);
    }
    if (!importSpec.startsWith(".")) {
      return diag("refused_no_source_reference", finding, `import '${importSpec}' is not relative · alias/pkg resolution deferred`, trace, 0.75);
    }
    const sourceAbs = resolveRelativeImport(dirname(testFileAbs), importSpec);
    if (!sourceAbs) {
      return diag("refused_no_source_reference", finding, `cannot resolve import '${importSpec}' from test file`, trace, 0.8);
    }
    const relSource = relative(repoRoot, sourceAbs).replace(/\\/g, "/");
    if (isProtected(relSource) || isProtected(sourceAbs.replace(/\\/g, "/"))) {
      return diag("refused_protected_target", finding, `source target '${relSource}' is protected`, trace, 0.95);
    }
    T(`fix20 · trace local → imported call · ${importedFn} from ${importSpec} → ${sourceAbs}`);

    const sourceContent = readFileSync(sourceAbs, "utf8");
    const fieldValue = findReturnObjectFieldValue(sourceContent, importedFn, memberField);
    T(`fix20 · return object field '${memberField}' shape: ${fieldValue.kind}`);

    if (fieldValue.kind === "function_not_found") {
      return diag(
        "refused_no_source_reference",
        finding,
        `imported function '${importedFn}' not found in ${relSource}`,
        trace,
        0.85,
      );
    }
    if (fieldValue.kind === "return_not_object") {
      return diag(
        "refused_low_confidence",
        finding,
        `function '${importedFn}' in ${relSource} does not return an object literal · member access on non-object result is out of scope`,
        trace,
        0.6,
      );
    }
    if (fieldValue.kind === "field_not_found") {
      return diag(
        "refused_low_confidence",
        finding,
        `field '${memberField}' not present in return object of '${importedFn}' in ${relSource}`,
        trace,
        0.65,
      );
    }
    const testExpected = normaliseLiteralText(finding.expected ?? "");
    if (testExpected === null) {
      return diag("refused_low_confidence", finding, "test's expected value is not a simple primitive literal", trace, 0.55);
    }

    if (fieldValue.kind === "literal") {
      const sourceCurrent = normaliseLiteralText(fieldValue.text);
      if (sourceCurrent !== null && testExpected === sourceCurrent) {
        return diag("refused_low_confidence", finding, "test expected and source field literal already agree · cause is elsewhere", trace, 0.4);
      }
      const proposal: Nex1RepairProposal = {
        change_kind: "replace_return_literal",
        target_file: relSource,
        target_function: importedFn,
        current_literal: fieldValue.text,
        proposed_literal: finding.expected!,
        rationale:
          `test at ${finding.test_file}:${assertionSite.line} asserts ${importedFn}().${memberField} === ${finding.expected} · ` +
          `source at ${relSource}#${importedFn} returns object with field '${memberField}' = ${fieldValue.text} · ` +
          `disagreement at plain primitive literal · test's expectation treated as specification (Fix 20 path · imported-call → local → field.literal)`,
      };
      T(`fix20 · proposal · replace field '${memberField}' literal ${fieldValue.text} → ${finding.expected} in ${relSource}#${importedFn}`);
      return {
        kind: "proposal",
        finding_ref: finding,
        diagnosis:
          `test contract expects ${importedFn}().${memberField} === ${finding.expected} · ` +
          `source object-return hardcodes ${fieldValue.text} for that field · likely source-value error`,
        proposal,
        confidence: 0.82,
        reasoning_trace: trace,
        taught_by: "master_ai_engineer",
      };
    }

    if (fieldValue.kind === "shorthand") {
      // Try one more step · locate the local variable initializer inside the fn
      const localInit = findLocalVarInFunction(sourceContent, importedFn, fieldValue.localName);
      T(`fix20 · shorthand '${fieldValue.localName}' initializer shape: ${localInit.kind}`);
      if (localInit.kind === "literal") {
        const sourceCurrent = normaliseLiteralText(localInit.text);
        if (sourceCurrent !== null && testExpected === sourceCurrent) {
          return diag("refused_low_confidence", finding, "test expected and source local literal already agree · cause is elsewhere", trace, 0.4);
        }
        const proposal: Nex1RepairProposal = {
          change_kind: "replace_return_literal",
          target_file: relSource,
          target_function: importedFn,
          current_literal: localInit.text,
          proposed_literal: finding.expected!,
          rationale:
            `test at ${finding.test_file}:${assertionSite.line} asserts ${importedFn}().${memberField} === ${finding.expected} · ` +
            `source at ${relSource}#${importedFn} returns { ${memberField} } shorthand · local variable '${fieldValue.localName}' initialized with literal ${localInit.text} at line ${localInit.line} · ` +
            `Fix 20 path · imported-call → shorthand → local.literal`,
        };
        T(`fix20 · proposal · replace shorthand local '${fieldValue.localName}' literal ${localInit.text} → ${finding.expected} in ${relSource}#${importedFn}`);
        return {
          kind: "proposal",
          finding_ref: finding,
          diagnosis:
            `test contract expects ${importedFn}().${memberField} === ${finding.expected} · ` +
            `source object-return uses shorthand for '${memberField}' backed by local literal ${localInit.text} · ` +
            `likely source-value error`,
          proposal,
          confidence: 0.78,
          reasoning_trace: trace,
          taught_by: "master_ai_engineer",
        };
      }
      // Fix 23b · 2026-09-17 · data-flow-aware repair for computed shorthand backing.
      // Invoke the tracer to identify a literal in the reachable computation
      // that, when substituted, causes the function to evaluate to expected.
      return runDataFlowTracerAndPropose({
        sourceContent,
        relSource,
        importedFn,
        memberField,
        assertionSite,
        finding,
        argTexts: assertionSite.argTexts ?? [],
        trace,
        T,
        contextTag: `shorthand→computed local '${fieldValue.localName}'`,
      });
    }

    // fieldValue.kind === "computed" · direct property with computed initializer
    return runDataFlowTracerAndPropose({
      sourceContent,
      relSource,
      importedFn,
      memberField,
      assertionSite,
      finding,
      argTexts: assertionSite.argTexts ?? [],
      trace,
      T,
      contextTag: `property→computed expression (${fieldValue.text})`,
    });
  }
  if (assertionSite.actualKind === "local_computed_value") {
    return diag("refused_unknown_test_shape", finding, "assertion asserts a locally-computed value with no imported producer · deferred", trace, 0.5);
  }

  // Case A · imported function call · optionally wrapped in `as` cast
  // Fix 33 · 2026-09-18 · Case B-prime handler: bare local from imported call.
  // Routes to the same source-repair logic as `imported_function_call` since
  // the target is identical — the imported function's return literal.
  if (assertionSite.actualKind === "local_bare_from_imported_call" || assertionSite.actualKind === "imported_function_call" || assertionSite.actualKind === "imported_function_call_with_cast") {
    const importedFn = assertionSite.importedFunctionName!;
    const importSpec = assertionSite.importSpecifier!;
    // Resolve to source file (relative imports only, aligned with F)
    if (!importSpec.startsWith(".")) {
      return diag("refused_no_source_reference", finding, `import specifier '${importSpec}' is not relative · alias/pkg resolution deferred`, trace, 0.75);
    }
    const sourceAbs = resolveRelativeImport(dirname(testFileAbs), importSpec);
    if (!sourceAbs) {
      return diag("refused_no_source_reference", finding, `cannot resolve import '${importSpec}' from test file`, trace, 0.8);
    }
    T(`resolved import · ${importedFn} from ${importSpec} → ${sourceAbs}`);

    // Protection check on the SOURCE file
    const relSource = relative(repoRoot, sourceAbs).replace(/\\/g, "/");
    if (isProtected(relSource) || isProtected(sourceAbs.replace(/\\/g, "/"))) {
      return diag("refused_protected_target", finding, `source target '${relSource}' is protected · J.2 refuses to propose changes to protected code`, trace, 0.95);
    }

    // Read the source & find the function's return literal
    const sourceContent = readFileSync(sourceAbs, "utf8");
    const returnLiteral = findReturnLiteral(sourceContent, importedFn);
    if (returnLiteral === null) {
      return diag(
        "refused_low_confidence",
        finding,
        `function '${importedFn}' in ${relSource} does not have a simple literal return · cause is not localised to a single literal · J.2 refuses without J.3 test-run confirmation`,
        trace,
        0.6,
      );
    }
    T(`source return literal · ${importedFn}() returns ${returnLiteral.text}`);

    // Now decide: source is wrong OR test is wrong
    // If the assertion's declared type contract permits the source's literal
    // but disagrees with the test's expected literal, that could go either
    // way. For a HIGH-CONFIDENCE source-repair proposal, we require:
    //   · source literal is a raw primitive literal (number/string/boolean)
    //   · test's expected literal is also a raw primitive literal
    //   · the two literals disagree
    //   · the source function has no explicit contract type that would make
    //     the test's expected literal invalid
    const testExpected = normaliseLiteralText(finding.expected ?? "");
    const sourceCurrent = normaliseLiteralText(returnLiteral.text);
    if (testExpected === null || sourceCurrent === null) {
      return diag("refused_low_confidence", finding, "expected/actual are not simple primitive literals", trace, 0.55);
    }
    if (testExpected === sourceCurrent) {
      return diag("refused_low_confidence", finding, "test expected and source literal already agree · cause is elsewhere", trace, 0.4);
    }

    // If the source declares a literal return type (e.g., ": 1" or ': "widget"'),
    // and the test's expected literal differs from that type, the test is wrong.
    if (returnLiteral.declaredLiteralType !== null && returnLiteral.declaredLiteralType !== testExpected) {
      return diag(
        "refused_test_may_be_wrong",
        finding,
        `source function '${importedFn}' declares literal return type '${returnLiteral.declaredLiteralType}' · test expects '${testExpected}' · test may be wrong; J.2 will not silently rewrite source contract`,
        trace,
        0.9,
      );
    }
    // Union of literals: if the test's expected value is NOT among the
    // declared union members, the source contract disallows it · refuse.
    if (returnLiteral.acceptableLiterals && !returnLiteral.acceptableLiterals.includes(testExpected)) {
      return diag(
        "refused_test_may_be_wrong",
        finding,
        `source function '${importedFn}' declares union return type · acceptable literals: [${returnLiteral.acceptableLiterals.join(", ")}] · test expects '${testExpected}' · test may be wrong; J.2 will not silently rewrite source contract`,
        trace,
        0.9,
      );
    }

    // High-confidence source repair proposal
    const proposal: Nex1RepairProposal = {
      change_kind: "replace_return_literal",
      target_file: relSource,
      target_function: importedFn,
      current_literal: returnLiteral.text,
      proposed_literal: finding.expected!,
      rationale:
        `test at ${finding.test_file}:${assertionSite.line} asserts ${importedFn}() === ${finding.expected} · ` +
        `source at ${relSource} returns ${returnLiteral.text} · disagreement is at a plain primitive literal · ` +
        `test's expectation is treated as the specification`,
    };
    T(`proposal · replace_return_literal ${returnLiteral.text} → ${finding.expected} in ${relSource}#${importedFn}`);
    return {
      kind: "proposal",
      finding_ref: finding,
      diagnosis:
        `test contract expects ${importedFn}() === ${finding.expected} · source hard-codes ${returnLiteral.text} · likely source-value error`,
      proposal,
      confidence: 0.85,
      reasoning_trace: trace,
      taught_by: "master_ai_engineer",
    };
  }

  // Case B · imported constant · expect(X).toBe(literal)
  if (assertionSite.actualKind === "imported_constant") {
    const importedName = assertionSite.importedFunctionName!;
    const importSpec = assertionSite.importSpecifier!;
    if (!importSpec.startsWith(".")) {
      return diag("refused_no_source_reference", finding, `import '${importSpec}' is not relative · alias/pkg resolution deferred`, trace, 0.75);
    }
    const sourceAbs = resolveRelativeImport(dirname(testFileAbs), importSpec);
    if (!sourceAbs) {
      return diag("refused_no_source_reference", finding, `cannot resolve import '${importSpec}' from test file`, trace, 0.8);
    }
    const relSource = relative(repoRoot, sourceAbs).replace(/\\/g, "/");
    if (isProtected(relSource) || isProtected(sourceAbs.replace(/\\/g, "/"))) {
      return diag("refused_protected_target", finding, `source target '${relSource}' is protected`, trace, 0.95);
    }
    const sourceContent = readFileSync(sourceAbs, "utf8");
    const constLit = findConstantLiteral(sourceContent, importedName);
    if (constLit === null) {
      return diag(
        "refused_low_confidence",
        finding,
        `constant '${importedName}' in ${relSource} does not have a simple literal initializer · J.2 refuses without J.3 confirmation`,
        trace,
        0.6,
      );
    }
    const testExpected = normaliseLiteralText(finding.expected ?? "");
    const sourceCurrent = normaliseLiteralText(constLit.text);
    if (testExpected === null || sourceCurrent === null) {
      return diag("refused_low_confidence", finding, "expected/actual are not simple primitive literals", trace, 0.55);
    }
    if (testExpected === sourceCurrent) {
      return diag("refused_low_confidence", finding, "test expected and source constant already agree · cause is elsewhere", trace, 0.4);
    }
    if (constLit.declaredLiteralType !== null && constLit.declaredLiteralType !== testExpected) {
      return diag(
        "refused_test_may_be_wrong",
        finding,
        `source constant '${importedName}' declares literal type '${constLit.declaredLiteralType}' · test expects '${testExpected}' · test may be wrong`,
        trace,
        0.9,
      );
    }
    if (constLit.acceptableLiterals && !constLit.acceptableLiterals.includes(testExpected)) {
      return diag(
        "refused_test_may_be_wrong",
        finding,
        `source constant '${importedName}' declares union type · acceptable literals: [${constLit.acceptableLiterals.join(", ")}] · test expects '${testExpected}' · test may be wrong`,
        trace,
        0.9,
      );
    }
    const proposal: Nex1RepairProposal = {
      change_kind: "replace_return_literal",
      target_file: relSource,
      target_function: importedName,
      current_literal: constLit.text,
      proposed_literal: finding.expected!,
      rationale:
        `test at ${finding.test_file}:${assertionSite.line} asserts ${importedName} === ${finding.expected} · ` +
        `source constant at ${relSource} is ${constLit.text} · disagreement is at a plain primitive literal`,
    };
    T(`proposal · replace_constant_literal ${constLit.text} → ${finding.expected} in ${relSource}#${importedName}`);
    return {
      kind: "proposal",
      finding_ref: finding,
      diagnosis: `test contract expects constant ${importedName} === ${finding.expected} · source hard-codes ${constLit.text} · likely source-value error`,
      proposal,
      confidence: 0.85,
      reasoning_trace: trace,
      taught_by: "master_ai_engineer",
    };
  }

  // Case C · actual expression is a member access on a typed value
  // (test-is-wrong detection)
  if (assertionSite.actualKind === "member_access_on_literal_type") {
    return diag(
      "refused_test_may_be_wrong",
      finding,
      `test asserts a member access against a literal-typed field · test's expected value violates the source type contract · J.2 refuses to weaken the contract`,
      trace,
      0.9,
    );
  }

  return diag("refused_unknown_test_shape", finding, "assertion shape not recognised · deferred to future J.2.x iteration", trace, 0.5);
}

// ─── Helpers ─────────────────────────────────────────────────────────

interface AssertionSite {
  readonly line: number;
  readonly summary: string;
  readonly actualKind:
    | "imported_function_call"
    | "imported_function_call_with_cast"
    | "imported_constant"
    | "chained_call"
    | "member_access_on_call_result"
    | "member_access_on_local"
    | "member_access_on_local_from_imported_call"  // Fix 20 · 2026-09-17
    | "local_bare_from_imported_call"              // Fix 33 · 2026-09-18
    | "local_computed_value"
    | "member_access_on_literal_type"
    | "unknown";
  readonly importedFunctionName: string | null;
  readonly importSpecifier: string | null;
  readonly castTargetType?: string | null;
  /** Fix 20 · 2026-09-17 · the field accessed when actualKind is
   *  member_access_on_local_from_imported_call or member_access_on_local. */
  readonly memberField?: string | null;
  /** Fix 23b · 2026-09-17 · verbatim argument texts from the local's initializer
   *  when actualKind is member_access_on_local_from_imported_call. Used by the
   *  data-flow tracer to evaluate the target function at concrete args. */
  readonly argTexts?: readonly string[];
}

function findAssertionSite(testSource: string, finding: Nex1RuntimeFailureFinding): AssertionSite | null {
  const sf = ts.createSourceFile("__t.ts", testSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  // Build map of imported names → module specifier
  const imports = new Map<string, string>();
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && stmt.importClause && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const spec = stmt.moduleSpecifier.text;
      if (stmt.importClause.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
        for (const el of stmt.importClause.namedBindings.elements) {
          imports.set(el.name.text, spec);
        }
      }
      if (stmt.importClause.name) {
        imports.set(stmt.importClause.name.text, spec);
      }
    }
  }

  const expectedLit = normaliseLiteralText(finding.expected ?? "");
  const actualLit = normaliseLiteralText(finding.actual ?? "");

  const boxed: { hit: AssertionSite | null } = { hit: null };
  const visit = (node: ts.Node) => {
    if (boxed.hit) return;
    // Match `expect(...).toBe(...)` and related assertions
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isCallExpression(node.expression.expression) &&
      ts.isIdentifier(node.expression.expression.expression) &&
      node.expression.expression.expression.text === "expect"
    ) {
      const expectArg = node.expression.expression.arguments[0];
      const assertArg = node.arguments[0];
      if (!expectArg || !assertArg) { ts.forEachChild(node, visit); return; }

      // Verify the assertArg literal matches finding.expected (best-effort)
      const assertLitText = assertArg.getText(sf);
      const assertNorm = normaliseLiteralText(assertLitText);
      if (expectedLit !== null && assertNorm !== null && assertNorm !== expectedLit) {
        ts.forEachChild(node, visit); return;
      }

      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

      // Unwrap parentheses/as-casts to reach the underlying expression
      let inner: ts.Expression = expectArg;
      let castTarget: string | null = null;
      while (true) {
        if (ts.isParenthesizedExpression(inner)) { inner = inner.expression; continue; }
        if (ts.isAsExpression(inner) || ts.isTypeAssertionExpression(inner)) {
          castTarget = inner.type.getText(sf);
          inner = inner.expression;
          continue;
        }
        break;
      }

      // Case A · expect(<callToImportedFn>()).toBe(literal) · optionally cast
      if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression)) {
        const fnName = inner.expression.text;
        const spec = imports.get(fnName);
        if (spec) {
          boxed.hit = {
            line,
            summary: `expect(${fnName}()${castTarget ? " as " + castTarget : ""}).toBe(${assertLitText})`,
            actualKind: castTarget ? "imported_function_call_with_cast" : "imported_function_call",
            importedFunctionName: fnName,
            importSpecifier: spec,
            castTargetType: castTarget,
          };
          return;
        }
      }

      // Case B · expect(<importedConstant>).toBe(literal)
      if (ts.isIdentifier(inner)) {
        const spec = imports.get(inner.text);
        if (spec) {
          boxed.hit = {
            line,
            summary: `expect(${inner.text}).toBe(${assertLitText})`,
            actualKind: "imported_constant",
            importedFunctionName: inner.text,
            importSpecifier: spec,
            castTargetType: castTarget,
          };
          return;
        }
        // Fix 33 · 2026-09-18 · Case B-prime · BARE LOCAL FROM IMPORTED CALL.
        //   const result = <importedFn>(...);
        //   expect(result).toBe(<literal>);
        // Analogous to Fix 20's Case E-prime but WITHOUT the property access.
        // Trace the local identifier back to an imported function call and
        // route to the same source-return-literal repair path used by
        // `imported_function_call`.
        const importedProducer = findLocalInitializedFromImportedCall(sf, inner.text, imports);
        if (importedProducer) {
          boxed.hit = {
            line,
            summary: `expect(${inner.text}).toBe(${assertLitText})`,
            actualKind: "local_bare_from_imported_call",
            importedFunctionName: importedProducer.fnName,
            importSpecifier: importedProducer.spec,
            argTexts: importedProducer.argTexts,
          };
          return;
        }
        // Local identifier · unknown value
        boxed.hit = {
          line,
          summary: `expect(${inner.text}).toBe(${assertLitText})`,
          actualKind: "local_computed_value",
          importedFunctionName: null,
          importSpecifier: null,
        };
        return;
      }

      // Case C · chained calls like fn1().fn2()
      if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression)) {
        boxed.hit = {
          line,
          summary: `expect(${inner.getText(sf).slice(0, 60)}).toBe(${assertLitText})`,
          actualKind: "chained_call",
          importedFunctionName: null,
          importSpecifier: null,
        };
        return;
      }

      // Case D · member access on the result of a call, e.g. fn().field
      if (ts.isPropertyAccessExpression(inner) && ts.isCallExpression(inner.expression)) {
        boxed.hit = {
          line,
          summary: `expect(${inner.getText(sf)}).toBe(${assertLitText})`,
          actualKind: "member_access_on_call_result",
          importedFunctionName: null,
          importSpecifier: null,
        };
        return;
      }

      // Case E · member access on a local identifier · x.field
      if (ts.isPropertyAccessExpression(inner) && ts.isIdentifier(inner.expression)) {
        const localName = inner.expression.text;
        const memberField = ts.isIdentifier(inner.name) ? inner.name.text : null;

        // Fix 20 · 2026-09-17 · Case E-prime · detect the pattern
        //   const x = <importedFn>(...);
        //   expect(x.<field>).toBe(...)
        // by looking for a variable declaration of `localName` initialized
        // from a call to an imported identifier.
        const importedProducer = findLocalInitializedFromImportedCall(sf, localName, imports);
        if (importedProducer) {
          boxed.hit = {
            line,
            summary: `expect(${inner.getText(sf)}).toBe(${assertLitText})`,
            actualKind: "member_access_on_local_from_imported_call",
            importedFunctionName: importedProducer.fnName,
            importSpecifier: importedProducer.spec,
            memberField,
            argTexts: importedProducer.argTexts,
          };
          return;
        }

        boxed.hit = {
          line,
          summary: `expect(${inner.getText(sf)}).toBe(${assertLitText})`,
          actualKind: "member_access_on_local",
          importedFunctionName: null,
          importSpecifier: null,
          memberField,
        };
        return;
      }

      // Case F · legacy fallback member access
      if (ts.isPropertyAccessExpression(inner)) {
        boxed.hit = {
          line,
          summary: `expect(${inner.getText(sf)}).toBe(${assertLitText})`,
          actualKind: "member_access_on_literal_type",
          importedFunctionName: null,
          importSpecifier: null,
        };
        return;
      }

      boxed.hit = {
        line,
        summary: `expect(${expectArg.getText(sf).slice(0, 60)}).toBe(${assertLitText})`,
        actualKind: "unknown",
        importedFunctionName: null,
        importSpecifier: null,
      };
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return boxed.hit;
}

/** Fix 20 · 2026-09-17 · trace a local variable to an imported function call.
 *  Looks for a top-level or nested statement `const <name> = <fn>(...)` where
 *  `<fn>` is a bare identifier present in the `imports` map. Returns the
 *  imported function name and specifier when found · null otherwise.
 *  Deterministic · read-only · zero LLM · zero fabrication. */
function findLocalInitializedFromImportedCall(
  sf: ts.SourceFile,
  localName: string,
  imports: ReadonlyMap<string, string>,
): { readonly fnName: string; readonly spec: string; readonly argTexts: readonly string[] } | null {
  const box: { hit: { fnName: string; spec: string; argTexts: readonly string[] } | null } = { hit: null };
  const visit = (node: ts.Node) => {
    if (box.hit) return;
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.text === localName &&
          decl.initializer &&
          ts.isCallExpression(decl.initializer) &&
          ts.isIdentifier(decl.initializer.expression)
        ) {
          const fnName = decl.initializer.expression.text;
          const spec = imports.get(fnName);
          if (spec) {
            const argTexts = decl.initializer.arguments.map((a) => a.getText(sf));
            box.hit = { fnName, spec, argTexts };
            return;
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return box.hit;
}

/** Fix 20 · 2026-09-17 · shape of a returned-object field value.
 *  kind = "literal"          · the field's value is a primitive literal
 *  kind = "shorthand"        · shorthand property · look up the local variable
 *  kind = "computed"         · the field's value is a computed expression
 *                              (arithmetic · function call · etc.)
 *  kind = "field_not_found"  · no field with that name in the return object
 *  kind = "return_not_object"· return statement did not return an object literal
 *  kind = "function_not_found"· no function/arrow with that name */
type ReturnObjectFieldValue =
  | { readonly kind: "literal"; readonly text: string; readonly line: number }
  | { readonly kind: "shorthand"; readonly localName: string; readonly line: number }
  | { readonly kind: "computed"; readonly text: string; readonly line: number }
  | { readonly kind: "field_not_found" }
  | { readonly kind: "return_not_object" }
  | { readonly kind: "function_not_found" };

/** Fix 20 · 2026-09-17 · locate a specific field's value within the return
 *  object literal of a named function/arrow. Read-only · deterministic. */
function findReturnObjectFieldValue(
  sourceContent: string,
  functionName: string,
  fieldName: string,
): ReturnObjectFieldValue {
  const sf = ts.createSourceFile("__s.ts", sourceContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const box: { hit: ReturnObjectFieldValue | null } = { hit: null };
  const visit = (node: ts.Node) => {
    if (box.hit) return;
    let fnBody: ts.Block | undefined;
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      fnBody = node.body;
    } else if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (d) =>
          ts.isIdentifier(d.name) &&
          d.name.text === functionName &&
          d.initializer &&
          (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)),
      )
    ) {
      const decl = node.declarationList.declarations.find(
        (d) => ts.isIdentifier(d.name) && d.name.text === functionName,
      );
      if (decl && decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
        if (ts.isBlock(decl.initializer.body)) fnBody = decl.initializer.body;
      }
    }
    if (fnBody) {
      for (const s of fnBody.statements) {
        if (ts.isReturnStatement(s) && s.expression) {
          let expr: ts.Expression = s.expression;
          while (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
            expr = (expr as any).expression;
          }
          if (!ts.isObjectLiteralExpression(expr)) {
            box.hit = { kind: "return_not_object" };
            return;
          }
          // Search for the field
          for (const prop of expr.properties) {
            if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === fieldName) {
              box.hit = {
                kind: "shorthand",
                localName: prop.name.text,
                line: sf.getLineAndCharacterOfPosition(prop.getStart(sf)).line + 1,
              };
              return;
            }
            if (
              ts.isPropertyAssignment(prop) &&
              ((ts.isIdentifier(prop.name) && prop.name.text === fieldName) ||
                (ts.isStringLiteral(prop.name) && prop.name.text === fieldName))
            ) {
              const val = prop.initializer;
              const line = sf.getLineAndCharacterOfPosition(prop.getStart(sf)).line + 1;
              const text = val.getText(sf);
              const isSimpleLiteral =
                ts.isNumericLiteral(val) ||
                ts.isStringLiteral(val) ||
                val.kind === ts.SyntaxKind.TrueKeyword ||
                val.kind === ts.SyntaxKind.FalseKeyword ||
                val.kind === ts.SyntaxKind.NullKeyword;
              box.hit = isSimpleLiteral
                ? { kind: "literal", text, line }
                : { kind: "computed", text, line };
              return;
            }
          }
          box.hit = { kind: "field_not_found" };
          return;
        }
      }
      // No return statement found · not object
      box.hit = { kind: "return_not_object" };
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return box.hit ?? { kind: "function_not_found" };
}

/** Fix 20 · 2026-09-17 · shape of a local variable's initializer.
 *  Similar categorization to ReturnObjectFieldValue but for a local var. */
type LocalVarInitializerShape =
  | { readonly kind: "literal"; readonly text: string; readonly line: number }
  | { readonly kind: "computed"; readonly text: string; readonly line: number }
  | { readonly kind: "not_found" };

/** Fix 20 · 2026-09-17 · find the initializer expression of a local variable
 *  declared inside a named function. Read-only · deterministic. */
function findLocalVarInFunction(
  sourceContent: string,
  functionName: string,
  localName: string,
): LocalVarInitializerShape {
  const sf = ts.createSourceFile("__s.ts", sourceContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const box: { hit: LocalVarInitializerShape | null } = { hit: null };
  const visit = (node: ts.Node) => {
    if (box.hit) return;
    let fnBody: ts.Block | undefined;
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      fnBody = node.body;
    } else if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (d) =>
          ts.isIdentifier(d.name) &&
          d.name.text === functionName &&
          d.initializer &&
          (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)),
      )
    ) {
      const decl = node.declarationList.declarations.find(
        (d) => ts.isIdentifier(d.name) && d.name.text === functionName,
      );
      if (decl && decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
        if (ts.isBlock(decl.initializer.body)) fnBody = decl.initializer.body;
      }
    }
    if (fnBody) {
      for (const s of fnBody.statements) {
        if (ts.isVariableStatement(s)) {
          for (const d of s.declarationList.declarations) {
            if (ts.isIdentifier(d.name) && d.name.text === localName && d.initializer) {
              const init = d.initializer;
              const text = init.getText(sf);
              const line = sf.getLineAndCharacterOfPosition(d.getStart(sf)).line + 1;
              const isSimpleLiteral =
                ts.isNumericLiteral(init) ||
                ts.isStringLiteral(init) ||
                init.kind === ts.SyntaxKind.TrueKeyword ||
                init.kind === ts.SyntaxKind.FalseKeyword ||
                init.kind === ts.SyntaxKind.NullKeyword;
              box.hit = isSimpleLiteral
                ? { kind: "literal", text, line }
                : { kind: "computed", text, line };
              return;
            }
          }
        }
      }
      box.hit = { kind: "not_found" };
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return box.hit ?? { kind: "not_found" };
}

function resolveRelativeImport(fromDir: string, spec: string): string | null {
  const candidates = [
    resolve(fromDir, spec + ".ts"),
    resolve(fromDir, spec + ".tsx"),
    resolve(fromDir, spec),
    resolve(fromDir, spec, "index.ts"),
    resolve(fromDir, spec, "index.tsx"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

interface ReturnLiteralResult {
  readonly text: string;
  readonly declaredLiteralType: string | null;
  readonly acceptableLiterals: readonly string[] | null;
}

function findReturnLiteral(sourceContent: string, functionName: string): ReturnLiteralResult | null {
  const sf = ts.createSourceFile("__s.ts", sourceContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const box: { hit: ReturnLiteralResult | null } = { hit: null };
  const visit = (node: ts.Node) => {
    if (box.hit) return;
    let fnBody: ts.Block | undefined;
    let declaredReturnType: ts.TypeNode | undefined;
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      fnBody = node.body;
      declaredReturnType = node.type;
    } else if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (d) => ts.isIdentifier(d.name) && d.name.text === functionName && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)),
      )
    ) {
      const decl = node.declarationList.declarations.find(
        (d) => ts.isIdentifier(d.name) && d.name.text === functionName,
      );
      if (decl && decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
        if (ts.isBlock(decl.initializer.body)) fnBody = decl.initializer.body;
        declaredReturnType = decl.initializer.type;
      }
    }
    if (fnBody) {
      for (const s of fnBody.statements) {
        if (ts.isReturnStatement(s) && s.expression) {
          const text = s.expression.getText(sf);
          const isSimpleLiteral =
            ts.isNumericLiteral(s.expression) ||
            ts.isStringLiteral(s.expression) ||
            s.expression.kind === ts.SyntaxKind.TrueKeyword ||
            s.expression.kind === ts.SyntaxKind.FalseKeyword ||
            s.expression.kind === ts.SyntaxKind.NullKeyword;
          if (isSimpleLiteral) {
            const literalTypeInfo = captureLiteralTypeInfo(sf, declaredReturnType);
            box.hit = {
              text,
              declaredLiteralType: literalTypeInfo.singleLiteral,
              acceptableLiterals: literalTypeInfo.unionMembers,
            };
            return;
          }
          // Complex return · not eligible for J.2 first-pass
          return;
        }
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return box.hit;
}

function findConstantLiteral(sourceContent: string, constantName: string): ReturnLiteralResult | null {
  const sf = ts.createSourceFile("__s.ts", sourceContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const box: { hit: ReturnLiteralResult | null } = { hit: null };
  const visit = (node: ts.Node) => {
    if (box.hit) return;
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.text === constantName &&
          decl.initializer
        ) {
          const init = decl.initializer;
          const isSimpleLiteral =
            ts.isNumericLiteral(init) ||
            ts.isStringLiteral(init) ||
            init.kind === ts.SyntaxKind.TrueKeyword ||
            init.kind === ts.SyntaxKind.FalseKeyword ||
            init.kind === ts.SyntaxKind.NullKeyword;
          if (isSimpleLiteral) {
            const literalTypeInfo = captureLiteralTypeInfo(sf, decl.type);
            box.hit = {
              text: init.getText(sf),
              declaredLiteralType: literalTypeInfo.singleLiteral,
              acceptableLiterals: literalTypeInfo.unionMembers,
            };
            return;
          }
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return box.hit;
}

/**
 * @summary Inspect a return/annotation type node. Returns:
 *   · singleLiteral · normalised text if the node is exactly one literal
 *   · unionMembers · list of normalised literals if the node is a union of
 *                    literals ("on" | "off" · 1 | 2 · true | false)
 *   · both null · if the type node is anything else, or absent
 */
function captureLiteralTypeInfo(
  sf: ts.SourceFile,
  typeNode: ts.TypeNode | undefined,
): { singleLiteral: string | null; unionMembers: readonly string[] | null } {
  if (!typeNode) return { singleLiteral: null, unionMembers: null };
  if (ts.isLiteralTypeNode(typeNode)) {
    const norm = normaliseLiteralText(typeNode.getText(sf));
    return { singleLiteral: norm, unionMembers: norm ? [norm] : null };
  }
  if (ts.isUnionTypeNode(typeNode)) {
    const members: string[] = [];
    let allLiteral = true;
    for (const t of typeNode.types) {
      if (ts.isLiteralTypeNode(t)) {
        const n = normaliseLiteralText(t.getText(sf));
        if (n) members.push(n);
        else { allLiteral = false; break; }
      } else {
        allLiteral = false;
        break;
      }
    }
    if (allLiteral && members.length > 0) return { singleLiteral: null, unionMembers: members };
  }
  return { singleLiteral: null, unionMembers: null };
}

function normaliseLiteralText(t: string): string | null {
  if (!t) return null;
  const s = t.trim();
  // Numeric · accept optional leading + (Fix 22 · 2026-09-17 · vitest's
  // util.inspect emits "+0" for positive zero which the regex previously
  // rejected). Strip the redundant "+" so downstream equality checks work
  // against source literals like "0".
  const numMatch = /^\+?(-?\d+(?:\.\d+)?)$/.exec(s);
  if (numMatch) return numMatch[1];
  // Boolean · null · undefined
  if (s === "true" || s === "false" || s === "null" || s === "undefined") return s;
  // Quoted string · normalise to single-quoted form
  const dq = /^"(.*)"$/.exec(s);
  if (dq) return `"${dq[1]}"`;
  const sq = /^'(.*)'$/.exec(s);
  if (sq) return `"${sq[1]}"`;
  // Backtick single-token
  const bt = /^`(.*)`$/.exec(s);
  if (bt) return `"${bt[1]}"`;
  return null;
}

// ─── Fix 23b · data-flow-aware repair proposal helper ────────────────

interface DataFlowTracerArgs {
  readonly sourceContent: string;
  readonly relSource: string;
  readonly importedFn: string;
  readonly memberField: string;
  readonly assertionSite: AssertionSite;
  readonly finding: Nex1RuntimeFailureFinding;
  readonly argTexts: readonly string[];
  readonly trace: string[];
  readonly T: (s: string) => void;
  readonly contextTag: string;
}

function runDataFlowTracerAndPropose(a: DataFlowTracerArgs): Nex1FailureDiagnosis {
  const testExpected = normaliseLiteralText(a.finding.expected ?? "");
  if (testExpected === null) {
    return diag("refused_low_confidence", a.finding, "test's expected value is not a simple primitive literal · data-flow tracer refused", a.trace, 0.55);
  }

  // Parse the expected value back into an EvalValue for comparison
  const expectedEvalValue: EvalValue = parseArgValue(testExpected);

  // Parse the concrete argument values from the test's call site
  const argValues: EvalValue[] = a.argTexts.map((t) => parseArgValue(t));

  a.T(`fix23b · data-flow tracer · fn=${a.importedFn} · argTexts=[${a.argTexts.join(", ")}] · expected=${testExpected} · field=${a.memberField}`);

  // Candidate replacements to try: the expected value, then 0 / 1 / -1
  const candidateReplacements = uniqueStrings([
    testExpected,
    "0",
    "1",
    "-1",
  ]);

  const tracer = traceDataFlowForLiteralCandidates({
    source_content: a.sourceContent,
    function_name: a.importedFn,
    arg_values: argValues,
    expected_field_value: expectedEvalValue,
    target_field_name: a.memberField,
    candidate_replacements: candidateReplacements,
  });

  if (!tracer.ok) {
    a.T(`fix23b · tracer refused · ${tracer.refusal} · ${tracer.reason}`);
    return diag(
      "refused_low_confidence",
      a.finding,
      `data-flow tracer refused (${tracer.refusal}): ${tracer.reason} · context: ${a.contextTag}`,
      a.trace,
      0.55,
    );
  }
  a.T(`fix23b · tracer ok · literals_examined=${tracer.literals_examined} evaluations=${tracer.evaluations_performed} candidates=${tracer.candidates.length}`);

  if (tracer.candidates.length === 0) {
    return diag(
      "refused_low_confidence",
      a.finding,
      `data-flow tracer found zero literal candidates that satisfy the constraint · context: ${a.contextTag}`,
      a.trace,
      0.55,
    );
  }

  // Prefer candidates hosted in the target function itself (locality)
  const localCandidates = tracer.candidates.filter((c) => c.hosting_function === a.importedFn);
  const chosen: LiteralCandidate | null = pickSingleUnambiguous(localCandidates.length > 0 ? localCandidates : tracer.candidates);
  if (!chosen) {
    // Multiple candidates: report but do not propose (avoid unsafe guess)
    const preview = tracer.candidates.slice(0, 5).map((c) => `${c.hosting_function}:${c.line} '${c.current_text}'→'${c.proposed_text}'`).join(" · ");
    return diag(
      "refused_low_confidence",
      a.finding,
      `data-flow tracer found ${tracer.candidates.length} candidate literal(s); ambiguous · deterministic operator refuses to guess · preview: ${preview}`,
      a.trace,
      0.55,
    );
  }

  a.T(`fix23b · chose ${chosen.hosting_function}:${chosen.line} '${chosen.current_text}' → '${chosen.proposed_text}'`);

  const proposal: Nex1RepairProposal = {
    change_kind: "replace_return_literal",
    target_file: a.relSource,
    target_function: a.importedFn,
    current_literal: chosen.current_text,
    proposed_literal: chosen.proposed_text,
    target_line: chosen.line,
    target_range: { start: chosen.position, end: chosen.end_position },
    rationale:
      `data-flow tracer identified literal '${chosen.current_text}' at ${a.relSource}:${chosen.line} ` +
      `(within ${chosen.enclosing_expression}); substituting → '${chosen.proposed_text}' causes ${a.importedFn}(args).${a.memberField} to evaluate to expected value (${testExpected}). ` +
      `Zero LLM · deterministic evaluator · Fix 23b path.`,
  };

  return {
    kind: "proposal",
    finding_ref: a.finding,
    diagnosis:
      `test contract expects ${a.importedFn}(args).${a.memberField} === ${a.finding.expected} · ` +
      `data-flow trace through computed intermediate identified literal '${chosen.current_text}' at ` +
      `${a.relSource}:${chosen.line} within ${chosen.hosting_function} as the controlling value`,
    proposal,
    confidence: 0.75,
    reasoning_trace: a.trace,
    taught_by: "master_ai_engineer",
  };
}

/** Return a single candidate iff the list has exactly one unique
 *  (hosting_function, line, position, proposed_text). Otherwise null. */
function pickSingleUnambiguous(cands: readonly LiteralCandidate[]): LiteralCandidate | null {
  if (cands.length === 0) return null;
  if (cands.length === 1) return cands[0];
  // Deduplicate by (fn, line, position) · if all candidates share these across
  // multiple proposed_text choices, pick the one whose proposed_text is
  // shortest / canonical to be deterministic.
  const grouped = new Map<string, LiteralCandidate[]>();
  for (const c of cands) {
    const k = `${c.hosting_function}:${c.line}:${c.position}`;
    const arr = grouped.get(k) ?? [];
    arr.push(c);
    grouped.set(k, arr);
  }
  if (grouped.size === 1) {
    const list = [...grouped.values()][0]!;
    // Pick the shortest proposed_text (typically the smallest change)
    const chosen = [...list].sort((a, b) => {
      if (a.proposed_text.length !== b.proposed_text.length) return a.proposed_text.length - b.proposed_text.length;
      return a.proposed_text.localeCompare(b.proposed_text);
    })[0];
    return chosen;
  }
  return null;
}

function uniqueStrings(arr: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) if (!seen.has(s)) { seen.add(s); out.push(s); }
  return out;
}

function diag(
  kind: Nex1CauseAnalysisKind,
  finding: Nex1RuntimeFailureFinding,
  diagnosis: string,
  trace: readonly string[],
  confidence: number,
): Nex1FailureDiagnosis {
  return {
    kind,
    finding_ref: finding,
    diagnosis,
    proposal: null,
    confidence,
    reasoning_trace: trace,
    taught_by: "master_ai_engineer",
  };
}
