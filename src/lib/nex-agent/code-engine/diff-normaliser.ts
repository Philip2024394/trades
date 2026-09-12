// src/lib/nex-agent/code-engine/diff-normaliser.ts
//
// NEX1's diff normaliser · parses a proposed unified diff · rejects malformed
// or oversized diffs · applies to a file map for in-memory validation.

import { extractTouchedPaths } from "./scope-enforcer";

const MAX_HUNK_LINES = 300;
const MAX_CONTEXT_LINE_CHARS = 200;

export interface NormaliseResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly touched_paths?: readonly string[];
}

/**
 * @summary Reject malformed diffs · no binary chunks · no oversized hunks.
 */
export function normaliseDiff(diff: string): NormaliseResult {
  if (diff.trim().length === 0) {
    return { ok: false, reason: "empty diff" };
  }
  const lines = diff.split(/\r?\n/);
  let inHunk = false;
  let hunkLines = 0;
  let hasHeader = false;
  for (const l of lines) {
    if (l.length > MAX_CONTEXT_LINE_CHARS && !/^(\+\+\+|---|@@)/.test(l)) {
      return { ok: false, reason: `line exceeds ${MAX_CONTEXT_LINE_CHARS} chars` };
    }
    if (/^Binary files /.test(l)) return { ok: false, reason: "binary diff not permitted" };
    if (/^\+\+\+/.test(l) || /^---/.test(l)) hasHeader = true;
    if (/^@@/.test(l)) {
      inHunk = true;
      hunkLines = 0;
      continue;
    }
    if (inHunk) {
      hunkLines++;
      if (hunkLines > MAX_HUNK_LINES) {
        return { ok: false, reason: `hunk exceeds ${MAX_HUNK_LINES} lines · decompose into multiple diffs` };
      }
    }
  }
  if (!hasHeader) return { ok: false, reason: "diff missing +++/--- headers" };
  const touched = extractTouchedPaths(diff);
  if (touched.length === 0) return { ok: false, reason: "no touched paths detected" };
  return { ok: true, touched_paths: touched };
}

/**
 * Apply a NEX1-generated diff (as produced by TemplateOnlyAdapter's
 * renderUnifiedDiff) to an in-memory file map. Sprint-1-sufficient: whole-file
 * replacement diffs. A more precise hunk applier can replace this later
 * without changing the engine's public surface.
 */
export function applyWholeFileDiff(diff: string): Map<string, string> {
  const out = new Map<string, string>();
  const paths = extractTouchedPaths(diff);
  for (const path of paths) {
    const marker = `+++ b/${path}`;
    const idx = diff.indexOf(marker);
    if (idx === -1) continue;
    const rest = diff.slice(idx);
    const linesAfterHeader = rest.split(/\r?\n/);
    // Skip until first @@ line
    let cursor = 0;
    while (cursor < linesAfterHeader.length && !linesAfterHeader[cursor].startsWith("@@")) cursor++;
    cursor++; // skip @@ line itself
    const additions: string[] = [];
    for (; cursor < linesAfterHeader.length; cursor++) {
      const line = linesAfterHeader[cursor];
      if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("@@")) break;
      if (line.startsWith("+")) additions.push(line.slice(1));
      else if (line.startsWith("-")) continue;
      else if (line === "" && cursor === linesAfterHeader.length - 1) continue; // trailing newline
    }
    out.set(path, additions.join("\n"));
  }
  return out;
}
