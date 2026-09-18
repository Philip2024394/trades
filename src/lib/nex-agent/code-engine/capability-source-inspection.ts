// src/lib/nex-agent/code-engine/capability-source-inspection.ts
//
// NEX1 · Source Inspection · deterministic · zero LLM · READ-ONLY.
//
// Fix 7 · 2026-09-16 · authorised after Test J boundary
// (docs/doctrine/nex1-test-j-source-level-2026-09-16.md).
//
// Purpose:
//   Investigation Mode can locate files (Tests G/H/I) but produces zero source-
//   level evidence (Test J). This module is the minimal new primitive required
//   to give the native investigation brain "eyes" — the ability to open a file
//   it has located, inspect what is actually there, and emit provenance-tagged
//   structural observations.
//
// Pre-Build Audit finding (2026-09-16):
//   capability-j-runtime-diagnosis  → public API takes Vitest text; not reusable here
//   capability-j2-cause-analysis    → public API requires Nex1RuntimeFailureFinding
//   capability-k-local-value-dataflow → public API requires Nex1RuntimeFailureFinding
//   All three use `ts.createSourceFile` + `readFileSync` internally · none exposes
//   a natural-language-driven file-inspection primitive.
//
// This module is the small ADAPTER + deterministic reader the audit prescribed.
// It uses the SAME primitives K uses (`ts.createSourceFile`, `readFileSync`),
// no new algorithms, no LLM, no interpretation of behaviour.
//
// DISCIPLINE:
//   · READ-ONLY. Never writes any file.
//   · No execution. No spawn. No installs.
//   · Bounded: max file size 128 KB. Refuses larger.
//   · Refuses (returns kind='refused') rather than fabricating on any failure.
//   · Uses scope-enforcer's `isProtected` to skip protected paths.
//   · Emits ONLY structural facts (names, line ranges, verbatim source text).
//     Emits NO interpretation of behaviour, purpose, or policy.
//   · Every extracted item carries `source_file` + `start_line` + `end_line`
//     provenance so consumers can verify.
//   · Zero coupling to Track A (Ed25519, C6/G15, orchestrator authority).

import ts from "typescript";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { isProtected } from "./scope-enforcer";

// ── Public shape ─────────────────────────────────────────────────────────

export type SourceInspectionRefusalKind =
  | "refused_path_outside_repo"
  | "refused_path_traversal"
  | "refused_protected_target"
  | "refused_not_found"
  | "refused_not_a_file"
  | "refused_too_large"
  | "refused_read_error"
  | "refused_parse_error"
  | "refused_unsupported_extension";

/** A structural fact extracted verbatim from source. Every fact names the
 *  file + line range it came from. Text is a verbatim slice of the source. */
export interface SourceFact {
  readonly source_file: string;             // repo-relative, forward-slash
  readonly start_line: number;              // 1-based
  readonly end_line: number;                // 1-based · inclusive
  readonly text: string;                    // verbatim source text (bounded)
}

export interface SourceFunctionRecord extends SourceFact {
  readonly kind: "function_declaration" | "arrow_function" | "function_expression" | "method";
  readonly name: string | null;             // null for anonymous
  readonly exported: boolean;
  readonly param_names: readonly string[];
}

export interface SourceIfBranchRecord extends SourceFact {
  readonly kind: "if_condition";
  readonly enclosing_function: string | null;
  readonly condition_text: string;          // verbatim, bounded
}

export interface SourceReturnRecord extends SourceFact {
  readonly kind: "return_statement";
  readonly enclosing_function: string | null;
  readonly return_expression_text: string;  // verbatim, bounded (e.g. "{ok:false, kind:'escalate_to_founder'}")
}

export interface SourceStringLiteralRecord extends SourceFact {
  readonly kind: "string_literal";
  readonly value: string;                   // literal value, bounded
  readonly enclosing_function: string | null;
}

export interface SourceImportRecord extends SourceFact {
  readonly kind: "import_statement";
  readonly specifier: string;               // module path
  readonly imported_names: readonly string[];
}

/** Fix 10 · 2026-09-16 · added to enable structural producer_consumer and
 *  selector_literal_mapping detection. Emits (const|let|var) declarations
 *  with a named identifier and the verbatim initializer text (bounded).
 *  Non-identifier destructuring patterns are recorded with name="<pattern>". */
export interface SourceVariableDeclarationRecord extends SourceFact {
  readonly kind: "variable_declaration";
  readonly name: string;
  readonly initializer_text: string;         // verbatim, bounded
  readonly is_exported: boolean;
  readonly enclosing_function: string | null;
}

export type SourceInspectionOk = {
  readonly kind: "ok";
  readonly source_file: string;             // repo-relative
  readonly bytes_read: number;
  readonly total_bytes: number;
  readonly truncated: boolean;
  readonly functions: readonly SourceFunctionRecord[];
  readonly if_branches: readonly SourceIfBranchRecord[];
  readonly returns: readonly SourceReturnRecord[];
  readonly string_literals: readonly SourceStringLiteralRecord[];
  readonly imports: readonly SourceImportRecord[];
  /** Fix 10 · 2026-09-16 · variable declarations for producer_consumer +
   *  selector_literal_mapping detection. */
  readonly variable_declarations: readonly SourceVariableDeclarationRecord[];
  readonly counters: {
    readonly functions_seen: number;
    readonly if_branches_seen: number;
    readonly returns_seen: number;
    readonly string_literals_seen: number;
    readonly imports_seen: number;
    readonly variable_declarations_seen: number;
  };
};

export type SourceInspectionRefused = {
  readonly kind: "refused";
  readonly refusal: SourceInspectionRefusalKind;
  readonly reason: string;
  readonly source_file: string;
};

export type SourceInspection = SourceInspectionOk | SourceInspectionRefused;

// ── Bounds ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_BYTES = 128 * 1024;
const HARD_MAX_BYTES = 512 * 1024;
const MAX_FUNCTIONS_EMITTED = 40;
const MAX_IF_BRANCHES_EMITTED = 40;
const MAX_RETURNS_EMITTED = 40;
const MAX_STRING_LITERALS_EMITTED = 40;
const MAX_IMPORTS_EMITTED = 40;
const MAX_VARIABLE_DECLARATIONS_EMITTED = 80;   // Fix 10 · higher cap · producer_consumer requires more coverage
const MAX_TEXT_SLICE_CHARS = 400;

// ── Public entry point ──────────────────────────────────────────────────

export interface InspectFileSourceInput {
  readonly file_path: string;               // repo-relative or absolute
  readonly repo_root: string;
  readonly max_bytes?: number;
}

/** Read a repository file (bounded), parse it via ts.createSourceFile, and
 *  emit provenance-tagged structural facts. Never invents facts. Never
 *  interprets behaviour. Refuses cleanly on any error. */
export function inspectFileSource(input: InspectFileSourceInput): SourceInspection {
  const repoRoot = path.resolve(input.repo_root);
  const relRaw = input.file_path.replace(/\\/g, "/");
  const abs = path.isAbsolute(relRaw) ? relRaw : path.resolve(repoRoot, relRaw);
  const rel = path.relative(repoRoot, abs).replace(/\\/g, "/");

  // ── Path guards ───────────────────────────────────────────────────────
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { kind: "refused", refusal: "refused_path_outside_repo", reason: `path resolves outside repo: ${input.file_path}`, source_file: relRaw };
  }
  if (rel.includes("..")) {
    return { kind: "refused", refusal: "refused_path_traversal", reason: `path contains traversal segments: ${rel}`, source_file: rel };
  }
  if (isProtected(rel) || isProtected(abs.replace(/\\/g, "/"))) {
    return { kind: "refused", refusal: "refused_protected_target", reason: `target is a protected path: ${rel}`, source_file: rel };
  }

  // ── Filesystem guards ─────────────────────────────────────────────────
  if (!existsSync(abs)) {
    return { kind: "refused", refusal: "refused_not_found", reason: `no such file: ${rel}`, source_file: rel };
  }
  const stat = statSync(abs);
  if (!stat.isFile()) {
    return { kind: "refused", refusal: "refused_not_a_file", reason: `not a regular file: ${rel}`, source_file: rel };
  }
  const maxBytes = Math.min(input.max_bytes ?? DEFAULT_MAX_BYTES, HARD_MAX_BYTES);
  if (stat.size > maxBytes) {
    return { kind: "refused", refusal: "refused_too_large", reason: `file size ${stat.size}B exceeds max ${maxBytes}B`, source_file: rel };
  }
  const ext = path.extname(rel);
  if (![".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".cjs"].includes(ext)) {
    return { kind: "refused", refusal: "refused_unsupported_extension", reason: `extension not supported: ${ext}`, source_file: rel };
  }

  // ── Read ──────────────────────────────────────────────────────────────
  let content: string;
  try {
    content = readFileSync(abs, "utf8");
  } catch (e) {
    return { kind: "refused", refusal: "refused_read_error", reason: (e as Error).message, source_file: rel };
  }

  // ── Parse ─────────────────────────────────────────────────────────────
  let sf: ts.SourceFile;
  try {
    const scriptKind = ext === ".tsx" || ext === ".jsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    sf = ts.createSourceFile(rel, content, ts.ScriptTarget.Latest, true, scriptKind);
  } catch (e) {
    return { kind: "refused", refusal: "refused_parse_error", reason: (e as Error).message, source_file: rel };
  }

  // ── Extract ───────────────────────────────────────────────────────────
  const functions: SourceFunctionRecord[] = [];
  const ifBranches: SourceIfBranchRecord[] = [];
  const returns: SourceReturnRecord[] = [];
  const stringLiterals: SourceStringLiteralRecord[] = [];
  const imports: SourceImportRecord[] = [];
  const variableDeclarations: SourceVariableDeclarationRecord[] = [];

  let fnSeen = 0, ifSeen = 0, retSeen = 0, strSeen = 0, impSeen = 0, varSeen = 0;

  const enclosingFn = (node: ts.Node): string | null => {
    let cur: ts.Node | undefined = node.parent;
    while (cur) {
      if (ts.isFunctionDeclaration(cur) || ts.isMethodDeclaration(cur)) {
        return cur.name?.getText(sf) ?? null;
      }
      if (ts.isFunctionExpression(cur) || ts.isArrowFunction(cur)) {
        // Named var declaration?
        const p = cur.parent;
        if (p && ts.isVariableDeclaration(p) && p.name && ts.isIdentifier(p.name)) {
          return p.name.text;
        }
        return null;
      }
      cur = cur.parent;
    }
    return null;
  };

  const posToLine = (pos: number): number => {
    const lc = sf.getLineAndCharacterOfPosition(pos);
    return lc.line + 1;
  };

  const slice = (start: number, end: number): string => {
    const raw = content.slice(start, end);
    if (raw.length <= MAX_TEXT_SLICE_CHARS) return raw;
    return raw.slice(0, MAX_TEXT_SLICE_CHARS - 4) + " …>";
  };

  const walk = (node: ts.Node): void => {
    // Functions
    if (ts.isFunctionDeclaration(node)) {
      fnSeen++;
      if (functions.length < MAX_FUNCTIONS_EMITTED) {
        const isExported = !!(node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
        functions.push({
          source_file: rel,
          start_line: posToLine(node.getStart(sf)),
          end_line: posToLine(node.getEnd()),
          text: slice(node.getStart(sf), node.getEnd()).slice(0, 120),
          kind: "function_declaration",
          name: node.name?.text ?? null,
          exported: isExported,
          param_names: node.parameters.map((p) => p.name.getText(sf)),
        });
      }
    } else if (ts.isMethodDeclaration(node)) {
      fnSeen++;
      if (functions.length < MAX_FUNCTIONS_EMITTED) {
        functions.push({
          source_file: rel,
          start_line: posToLine(node.getStart(sf)),
          end_line: posToLine(node.getEnd()),
          text: slice(node.getStart(sf), node.getEnd()).slice(0, 120),
          kind: "method",
          name: node.name.getText(sf),
          exported: false,
          param_names: node.parameters.map((p) => p.name.getText(sf)),
        });
      }
    } else if (ts.isVariableStatement(node)) {
      const isExported = !!(node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          fnSeen++;
          if (functions.length < MAX_FUNCTIONS_EMITTED && ts.isIdentifier(decl.name)) {
            functions.push({
              source_file: rel,
              start_line: posToLine(decl.getStart(sf)),
              end_line: posToLine(init.getEnd()),
              text: slice(decl.getStart(sf), decl.getEnd()).slice(0, 120),
              kind: ts.isArrowFunction(init) ? "arrow_function" : "function_expression",
              name: decl.name.text,
              exported: isExported,
              param_names: init.parameters.map((p) => p.name.getText(sf)),
            });
          }
        } else {
          // Fix 10 · non-function variable declarations · needed for
          // producer_consumer + selector_literal_mapping detection.
          varSeen++;
          if (variableDeclarations.length < MAX_VARIABLE_DECLARATIONS_EMITTED) {
            const name = ts.isIdentifier(decl.name) ? decl.name.text : "<pattern>";
            const initializerText = init ? slice(init.getStart(sf), init.getEnd()) : "";
            variableDeclarations.push({
              source_file: rel,
              start_line: posToLine(decl.getStart(sf)),
              end_line: posToLine(init ? init.getEnd() : decl.getEnd()),
              text: slice(decl.getStart(sf), decl.getEnd()),
              kind: "variable_declaration",
              name,
              initializer_text: initializerText,
              is_exported: isExported,
              enclosing_function: enclosingFn(node),
            });
          }
        }
      }
    }

    // If conditions
    if (ts.isIfStatement(node)) {
      ifSeen++;
      if (ifBranches.length < MAX_IF_BRANCHES_EMITTED) {
        const cond = node.expression;
        ifBranches.push({
          source_file: rel,
          start_line: posToLine(node.getStart(sf)),
          end_line: posToLine(cond.getEnd()),
          text: slice(node.getStart(sf), cond.getEnd()),
          kind: "if_condition",
          enclosing_function: enclosingFn(node),
          condition_text: slice(cond.getStart(sf), cond.getEnd()),
        });
      }
    }

    // Return statements
    if (ts.isReturnStatement(node)) {
      retSeen++;
      if (returns.length < MAX_RETURNS_EMITTED) {
        const expr = node.expression;
        returns.push({
          source_file: rel,
          start_line: posToLine(node.getStart(sf)),
          end_line: posToLine(node.getEnd()),
          text: slice(node.getStart(sf), node.getEnd()),
          kind: "return_statement",
          enclosing_function: enclosingFn(node),
          return_expression_text: expr ? slice(expr.getStart(sf), expr.getEnd()) : "",
        });
      }
    }

    // String literals
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      strSeen++;
      if (stringLiterals.length < MAX_STRING_LITERALS_EMITTED) {
        stringLiterals.push({
          source_file: rel,
          start_line: posToLine(node.getStart(sf)),
          end_line: posToLine(node.getEnd()),
          text: slice(node.getStart(sf), node.getEnd()),
          kind: "string_literal",
          value: node.text.slice(0, MAX_TEXT_SLICE_CHARS),
          enclosing_function: enclosingFn(node),
        });
      }
    }

    // Imports
    if (ts.isImportDeclaration(node)) {
      impSeen++;
      if (imports.length < MAX_IMPORTS_EMITTED) {
        const spec = node.moduleSpecifier;
        const specText = ts.isStringLiteral(spec) ? spec.text : spec.getText(sf);
        const names: string[] = [];
        const clause = node.importClause;
        if (clause) {
          if (clause.name) names.push(clause.name.text);
          if (clause.namedBindings) {
            if (ts.isNamespaceImport(clause.namedBindings)) {
              names.push(`* as ${clause.namedBindings.name.text}`);
            } else {
              for (const el of clause.namedBindings.elements) {
                names.push(el.name.text);
              }
            }
          }
        }
        imports.push({
          source_file: rel,
          start_line: posToLine(node.getStart(sf)),
          end_line: posToLine(node.getEnd()),
          text: slice(node.getStart(sf), node.getEnd()),
          kind: "import_statement",
          specifier: specText,
          imported_names: names,
        });
      }
    }

    node.forEachChild(walk);
  };

  walk(sf);

  return {
    kind: "ok",
    source_file: rel,
    bytes_read: content.length,
    total_bytes: stat.size,
    truncated: false,
    functions,
    if_branches: ifBranches,
    returns,
    string_literals: stringLiterals,
    imports,
    variable_declarations: variableDeclarations,
    counters: {
      functions_seen: fnSeen,
      if_branches_seen: ifSeen,
      returns_seen: retSeen,
      string_literals_seen: strSeen,
      imports_seen: impSeen,
      variable_declarations_seen: varSeen,
    },
  };
}
