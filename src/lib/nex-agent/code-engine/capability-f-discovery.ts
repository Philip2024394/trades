// src/lib/nex-agent/code-engine/capability-f-discovery.ts
//
// NEX1 · CAPABILITY F · AUTONOMOUS REPOSITORY FILE DISCOVERY · deterministic.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: given a target type name and a bounded scope, discover which
// files declare that type and which files consume it. Feed the resulting
// source set into Capability C/D/E's multi-source mechanisms.
//
// Discipline:
//   · deterministic · zero LLM · zero network
//   · scope-bounded (files list or root+extensions+excludes)
//   · respects `isProtected`
//   · fails safe on ambiguity (duplicate symbol with unresolvable import)
//   · audit trail records why each file is included / excluded
//   · no persistent cache / dependency graph / vector store
//   · relative-import resolution only (aliases/node_modules deferred)
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism.

import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join, extname, relative, normalize } from "node:path";
import { isProtected } from "./scope-enforcer";

export interface Nex1DiscoveryScope {
  readonly files?: readonly string[];
  readonly root?: string;
  readonly extensions?: readonly string[];
  readonly exclude_globs?: readonly string[];
}

export interface Nex1DiscoveredFile {
  readonly path: string;
  readonly content: string;
  readonly reason: string;
  readonly matched_declaration_path?: string;
}

export type Nex1DiscoveryAmbiguity =
  | "none"
  | "duplicate_symbol_with_resolution"
  | "duplicate_symbol_unresolvable";

export interface Nex1DiscoveryResult {
  readonly type_name: string;
  readonly declaring_files: readonly Nex1DiscoveredFile[];
  readonly consuming_files: readonly Nex1DiscoveredFile[];
  readonly excluded_files: readonly { path: string; reason: string }[];
  readonly ambiguity: Nex1DiscoveryAmbiguity;
  readonly audit: readonly string[];
  readonly taught_by: "master_ai_engineer";
}

/**
 * @summary Discover the working set for `typeName` inside `scope`.
 * Deterministic, bounded, auditable.
 */
export function discoverRelevantSources(typeName: string, scope: Nex1DiscoveryScope): Nex1DiscoveryResult {
  const audit: string[] = [];
  const excluded: { path: string; reason: string }[] = [];

  // Step 1 · enumerate candidate files under scope
  let candidates: string[] = [];
  if (scope.files && scope.files.length > 0) {
    candidates = [...scope.files];
    audit.push(`enumeration: explicit file list · count=${candidates.length}`);
  } else if (scope.root) {
    const exts = scope.extensions ?? [".ts", ".tsx"];
    const excludes = scope.exclude_globs ?? ["node_modules", ".next", "dist", "build"];
    candidates = walkDirectory(scope.root, exts, excludes);
    audit.push(`enumeration: walk root=${scope.root} · extensions=${JSON.stringify(exts)} · found=${candidates.length}`);
  } else {
    audit.push("enumeration: neither files nor root supplied · scope is empty");
    return {
      type_name: typeName,
      declaring_files: [],
      consuming_files: [],
      excluded_files: [],
      ambiguity: "none",
      audit,
      taught_by: "master_ai_engineer",
    };
  }

  // Step 2 · filter protected + non-existent
  const filtered: string[] = [];
  for (const p of candidates) {
    const normalised = p.replace(/\\/g, "/");
    if (isProtected(normalised)) {
      excluded.push({ path: normalised, reason: "isProtected() rejected" });
      continue;
    }
    try {
      const st = statSync(p);
      if (!st.isFile()) {
        excluded.push({ path: normalised, reason: "not a regular file" });
        continue;
      }
    } catch {
      excluded.push({ path: normalised, reason: "stat failed · file missing" });
      continue;
    }
    filtered.push(p);
  }

  // Step 3 · parse each candidate; classify as declaring / consuming / irrelevant
  const declaring: {
    path: string;
    content: string;
    kind: "interface" | "type_alias";
    lineHint: number;
  }[] = [];
  const consuming: { path: string; content: string; consume_reason: string }[] = [];

  for (const p of filtered) {
    let content: string;
    try {
      content = readFileSync(p, "utf8");
    } catch (e) {
      excluded.push({ path: p, reason: `read failed · ${e instanceof Error ? e.message : String(e)}` });
      continue;
    }
    const sf = ts.createSourceFile(p, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    type DeclHit = { kind: "interface" | "type_alias"; lineHint: number };
    const declBox: { value: DeclHit | null } = { value: null };
    const consumeReasons: string[] = [];

    const visit = (node: ts.Node) => {
      if (
        !declBox.value &&
        ts.isInterfaceDeclaration(node) &&
        node.name.text === typeName
      ) {
        declBox.value = { kind: "interface", lineHint: sf.getLineAndCharacterOfPosition(node.name.getStart(sf)).line + 1 };
      } else if (
        !declBox.value &&
        ts.isTypeAliasDeclaration(node) &&
        node.name.text === typeName
      ) {
        declBox.value = { kind: "type_alias", lineHint: sf.getLineAndCharacterOfPosition(node.name.getStart(sf)).line + 1 };
      }
      // Import: `import type? { X, Y } from "...";` OR `import X from "...";`
      if (ts.isImportDeclaration(node) && node.importClause) {
        const clause = node.importClause;
        // Named bindings
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const el of clause.namedBindings.elements) {
            const importedName = (el.propertyName ?? el.name).text;
            const localName = el.name.text;
            if (importedName === typeName || localName === typeName) {
              const moduleText = (node.moduleSpecifier as ts.StringLiteral).text;
              consumeReasons.push(`imports '${typeName}' from '${moduleText}' on line ${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
            }
          }
        }
        // Default import
        if (clause.name && clause.name.text === typeName) {
          const moduleText = (node.moduleSpecifier as ts.StringLiteral).text;
          consumeReasons.push(`default-imports '${typeName}' from '${moduleText}' on line ${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
        }
      }
      // Type reference: `foo: TypeName` or `Array<TypeName>` etc.
      if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && node.typeName.text === typeName) {
        consumeReasons.push(`type-reference on line ${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    const normalised = p.replace(/\\/g, "/");
    if (declBox.value) {
      declaring.push({ path: normalised, content, kind: declBox.value.kind, lineHint: declBox.value.lineHint });
      audit.push(`declaring: ${normalised} · ${declBox.value.kind} on line ${declBox.value.lineHint}`);
    } else if (consumeReasons.length > 0) {
      consuming.push({ path: normalised, content, consume_reason: consumeReasons.join(" · ") });
      audit.push(`consuming: ${normalised} · ${consumeReasons[0]}`);
    } else {
      excluded.push({ path: normalised, reason: `does not declare or reference '${typeName}'` });
    }
  }

  // Step 4 · duplicate-symbol resolution via import path matching
  let ambiguity: Nex1DiscoveryAmbiguity = "none";
  const consumingFiles: Nex1DiscoveredFile[] = [];

  if (declaring.length <= 1) {
    // Simple: no ambiguity
    for (const c of consuming) {
      consumingFiles.push({ path: c.path, content: c.content, reason: c.consume_reason, matched_declaration_path: declaring[0]?.path });
    }
  } else {
    // Multiple declarations · resolve each consumer's import against declaring paths
    let anyUnresolvable = false;
    let anyResolved = false;
    for (const c of consuming) {
      const resolvedDecl = resolveConsumerImport(c.path, c.content, typeName, declaring.map((d) => d.path));
      if (resolvedDecl === null) {
        anyUnresolvable = true;
        audit.push(`ambiguity: consumer ${c.path} references '${typeName}' but its import does not resolve to any declaring file`);
        consumingFiles.push({ path: c.path, content: c.content, reason: c.consume_reason + " · UNRESOLVED import target" });
      } else {
        anyResolved = true;
        audit.push(`resolved: consumer ${c.path} → declaring ${resolvedDecl}`);
        consumingFiles.push({ path: c.path, content: c.content, reason: c.consume_reason, matched_declaration_path: resolvedDecl });
      }
    }
    ambiguity = anyUnresolvable ? "duplicate_symbol_unresolvable" : (anyResolved ? "duplicate_symbol_with_resolution" : "none");
  }

  return {
    type_name: typeName,
    declaring_files: declaring.map((d) => ({
      path: d.path,
      content: d.content,
      reason: `${d.kind} declaration on line ${d.lineHint}`,
    })),
    consuming_files: consumingFiles,
    excluded_files: excluded,
    ambiguity,
    audit,
    taught_by: "master_ai_engineer",
  };
}

/**
 * @summary Resolve which declaring path a consumer's import for `typeName`
 * points to. Handles only relative imports (`./foo`, `../foo`). Returns
 * null when the import cannot be matched to a declaring path.
 */
function resolveConsumerImport(
  consumerPath: string,
  consumerContent: string,
  typeName: string,
  declaringPaths: readonly string[],
): string | null {
  const sf = ts.createSourceFile(consumerPath, consumerContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specBox: { value: string | null } = { value: null };
  const visit = (node: ts.Node) => {
    if (specBox.value) return;
    if (ts.isImportDeclaration(node) && node.importClause) {
      const clause = node.importClause;
      const importsTypeName =
        (clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.some((el) => {
          const importedName = (el.propertyName ?? el.name).text;
          const localName = el.name.text;
          return importedName === typeName || localName === typeName;
        })) ||
        (clause.name && clause.name.text === typeName);
      if (importsTypeName && ts.isStringLiteral(node.moduleSpecifier)) {
        specBox.value = node.moduleSpecifier.text;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const importSpecifier = specBox.value;
  if (!importSpecifier) return null;
  if (!importSpecifier.startsWith(".")) return null; // aliases/node_modules deferred

  const consumerDir = dirname(consumerPath);
  const candidateBases = [
    resolve(consumerDir, importSpecifier),
    resolve(consumerDir, importSpecifier + ".ts"),
    resolve(consumerDir, importSpecifier + ".tsx"),
    resolve(consumerDir, importSpecifier, "index.ts"),
    resolve(consumerDir, importSpecifier, "index.tsx"),
  ];
  for (const candidate of candidateBases) {
    const norm = candidate.replace(/\\/g, "/");
    for (const dp of declaringPaths) {
      const dpAbs = resolve(dp).replace(/\\/g, "/");
      if (norm === dpAbs) return dp;
    }
  }
  return null;
}

function walkDirectory(root: string, extensions: readonly string[], excludeGlobs: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      if (excludeGlobs.some((g) => entry === g || full.includes(`/${g}/`) || full.includes(`\\${g}\\`))) continue;
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile()) {
        const ext = extname(full);
        if (extensions.includes(ext)) out.push(full);
      }
    }
  };
  walk(root);
  return out;
}
