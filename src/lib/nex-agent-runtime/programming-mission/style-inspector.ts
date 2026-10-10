// WO-NEX-RUNTIME-11 · style inspector.
//
// Founder-locked 2026-09-14. Deterministic (P-S) inspection of existing
// workspace files. This is NEX1's real read → understand phase — it
// produces a StyleProfile that genuinely influences the authored diff
// (not a fixed template output).

import { promises as fs } from "node:fs";
import path from "node:path";
import type { StyleProfile } from "./types";
import { buildDependencyGraph, type DependencyGraph } from "./dependency-graph";

export interface InspectionResult {
  readonly ok: true;
  readonly style: StyleProfile;
  readonly file_contents_read: readonly { readonly path: string; readonly bytes: number; readonly sha256_hex: string }[];
  /** M-02 · dependency graph derived from the inspected files. When
   *  there are cross-file edges, NEX1 has genuinely identified the
   *  dependency chain from inspection alone. */
  readonly dependency_graph: DependencyGraph;
}
export type InspectionFailure = { readonly ok: false; readonly reason: string; readonly reason_code: "FILE_MISSING" | "READ_ERROR" | "NO_INPUT_FILES" };

// Count naming-convention signals in a source file
function scoreNamingSignals(source: string): { snake: number; camel: number } {
  const snake = (source.match(/\b(?:function|const|let|var|export\s+function|export\s+const)\s+([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g) ?? []).length;
  const camel = (source.match(/\b(?:function|const|let|var|export\s+function|export\s+const)\s+([a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+)\b/g) ?? []).length;
  return { snake, camel };
}

function detectExportStyle(source: string): "named" | "default" | "unknown" {
  const named = (source.match(/^export\s+(?:function|const|let|class)\s+/gm) ?? []).length;
  const defaults = (source.match(/^export\s+default\b/gm) ?? []).length;
  if (named > defaults && named > 0) return "named";
  if (defaults > named && defaults > 0) return "default";
  return "unknown";
}

function detectSemicolons(source: string): "yes" | "no" | "unknown" {
  const lines = source.split("\n").filter((l) => l.trim().length > 0 && !l.trim().startsWith("//") && !l.trim().startsWith("*"));
  if (lines.length < 3) return "unknown";
  let withSemi = 0;
  let withoutSemi = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    // Only look at statement-ish lines (skip block openers/closers)
    if (trimmed.endsWith("{") || trimmed === "}" || trimmed.startsWith("import ") === false && (trimmed.endsWith("(") || trimmed.endsWith(","))) continue;
    if (trimmed.endsWith(";")) withSemi++;
    else if (/[a-zA-Z0-9"')\]]$/.test(trimmed)) withoutSemi++;
  }
  const total = withSemi + withoutSemi;
  if (total < 3) return "unknown";
  const ratio = withSemi / total;
  if (ratio > 0.7) return "yes";
  if (ratio < 0.3) return "no";
  return "unknown";
}

function detectQuoteStyle(source: string): "double" | "single" | "unknown" {
  // Naive counter — skip comments
  const stripped = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const doubleCount = (stripped.match(/"[^"\n]*"/g) ?? []).length;
  const singleCount = (stripped.match(/'[^'\n]*'/g) ?? []).length;
  if (doubleCount === 0 && singleCount === 0) return "unknown";
  if (doubleCount >= singleCount * 2) return "double";
  if (singleCount >= doubleCount * 2) return "single";
  return "unknown";
}

function detectTestFramework(source: string): "vitest" | "unknown" {
  if (/from\s+["']vitest["']/.test(source)) return "vitest";
  return "unknown";
}

/** Inspect the given files and derive a deterministic StyleProfile. */
export async function inspectWorkspaceStyle(input: {
  readonly workspace_root: string;
  readonly file_paths: readonly string[];
}): Promise<InspectionResult | InspectionFailure> {
  if (input.file_paths.length === 0) {
    return { ok: false, reason: "no target files supplied to inspect", reason_code: "NO_INPUT_FILES" };
  }
  const contents: string[] = [];
  const reads: { path: string; bytes: number; sha256_hex: string }[] = [];
  for (const rel of input.file_paths) {
    const abs = path.join(input.workspace_root, rel);
    let raw: string;
    try {
      raw = await fs.readFile(abs, "utf8");
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      return {
        ok: false,
        reason: `could not read ${rel}: ${(e as Error).message}`,
        reason_code: code === "ENOENT" ? "FILE_MISSING" : "READ_ERROR",
      };
    }
    contents.push(raw);
    const { createHash } = await import("node:crypto");
    reads.push({
      path: rel,
      bytes: Buffer.byteLength(raw, "utf8"),
      sha256_hex: createHash("sha256").update(raw).digest("hex"),
    });
  }

  const joined = contents.join("\n");
  const naming = scoreNamingSignals(joined);
  const namingConvention: StyleProfile["naming_convention"] =
    naming.snake > naming.camel && naming.snake > 0 ? "snake_case"
    : naming.camel > naming.snake && naming.camel > 0 ? "camelCase"
    : "unknown";

  const style: StyleProfile = {
    naming_convention: namingConvention,
    export_style: detectExportStyle(joined),
    semicolons: detectSemicolons(joined),
    quote_style: detectQuoteStyle(joined),
    test_framework: detectTestFramework(joined),
    detected_from_files: Object.freeze([...input.file_paths]),
    detection_confidence:
      namingConvention !== "unknown" && detectExportStyle(joined) !== "unknown"
        ? "high"
        : namingConvention !== "unknown"
          ? "medium"
          : "low",
  };
  const dependency_graph = await buildDependencyGraph({
    workspace_root: input.workspace_root,
    file_paths: input.file_paths,
  });
  return { ok: true, style, file_contents_read: Object.freeze(reads), dependency_graph };
}
