// WO-WORKSTATION-03 · generator + syntax validator + diff computer
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Deterministic pipeline stages 3-5:
//   Generate         (FilePlan + templates -> CandidateFile[])
//   SyntaxValidate   (CandidateFile -> ok | reason)
//   Diff             (CandidateFile[] vs workspace disk -> Diff)
//
// None of these functions writes to disk. Diff computation READS the
// workspace filesystem to compare, but never mutates. Actual writes are
// WO-04 (Controlled Hands).

import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { findTemplate } from "./wo3-templates";
import type {
  FilePlan,
  CandidateFile,
  SyntaxValidationResult,
  Diff,
  DiffEntry,
} from "./wo3-types";

// ── Generate ────────────────────────────────────────────────────────────

export type GenerateResult =
  | { ok: true; candidates: readonly CandidateFile[] }
  | { ok: false; reason: string; failed_path?: string };

/**
 * Turn a FilePlan into concrete CandidateFile records by running each
 * template with its params. Never touches disk. Never invokes an LLM.
 *
 * If a template is missing OR its params fail schema validation, the
 * whole generation fails — no partial candidate lists returned. This
 * matches P-C's "code existing is not capability existing": a generator
 * that produces half a project is not a working generator.
 */
export function generate(plan: FilePlan): GenerateResult {
  const candidates: CandidateFile[] = [];
  for (const op of plan.ops) {
    if (op.kind === "delete") {
      // Deletes have no content; skip generation. Diff will still record
      // the operation as a "delete" entry.
      continue;
    }
    if (!op.template_ref) {
      return { ok: false, reason: `op ${op.kind} at ${op.path} has no template_ref`, failed_path: op.path };
    }
    const template = findTemplate(op.template_ref);
    if (!template) {
      return { ok: false, reason: `template not registered: ${op.template_ref}`, failed_path: op.path };
    }
    const parseResult = template.paramsSchema.safeParse(op.template_params ?? {});
    if (!parseResult.success) {
      return {
        ok: false,
        reason: `template ${op.template_ref} params invalid: ${parseResult.error.message}`,
        failed_path: op.path,
      };
    }
    let content: string;
    try {
      content = template.render(parseResult.data);
    } catch (err) {
      return { ok: false, reason: `template ${op.template_ref} render threw: ${(err as Error).message}`, failed_path: op.path };
    }
    const bytes = Buffer.byteLength(content, "utf8");
    const content_hash = createHash("sha256").update(content, "utf8").digest("hex");
    candidates.push({
      path: op.path,
      content,
      content_hash,
      source_template: op.template_ref,
      bytes,
    });
  }
  return { ok: true, candidates };
}

// ── Syntax Validate ─────────────────────────────────────────────────────

/**
 * Per-file-type sanity check on generated content. NOT a full TypeScript
 * compile — this runs at generation time and must be deterministic +
 * fast + free of runtime dependencies on the typescript package.
 *
 * Coverage matches the current template set:
 *   .json  -> JSON.parse must succeed
 *   .tsx / .ts -> balanced brackets + balanced quotes + non-empty
 *   .md / .txt / .css -> non-empty
 *
 * Full TypeScript typecheck happens later during real build (WO-05).
 * Anything that fails this basic check should never reach WO-05.
 */
export function validateSyntax(candidate: CandidateFile): SyntaxValidationResult {
  if (candidate.content.length === 0) {
    return { ok: false, reason: "content is empty", reason_code: "EMPTY_CONTENT", path: candidate.path };
  }
  const ext = extensionOf(candidate.path);
  switch (ext) {
    case "json": {
      try { JSON.parse(candidate.content); return { ok: true }; }
      catch (err) {
        return { ok: false, reason: `JSON.parse failed: ${(err as Error).message}`, reason_code: "JSON_PARSE_FAILED", path: candidate.path };
      }
    }
    case "js":
    case "mjs":
    case "cjs":
    case "ts":
    case "tsx": {
      const brackets = checkBalancedBrackets(candidate.content);
      if (!brackets.ok) return { ok: false, reason: brackets.reason, reason_code: "UNBALANCED_BRACKETS", path: candidate.path };
      const quotes = checkBalancedQuotes(candidate.content);
      if (!quotes.ok) return { ok: false, reason: quotes.reason, reason_code: "UNBALANCED_QUOTES", path: candidate.path };
      return { ok: true };
    }
    case "md":
    case "txt":
    case "css":
      return { ok: true };
    default:
      return { ok: false, reason: `no syntax validator for extension ${ext}`, reason_code: "UNKNOWN_EXTENSION", path: candidate.path };
  }
}

function extensionOf(p: string): string {
  const idx = p.lastIndexOf(".");
  return idx < 0 ? "" : p.slice(idx + 1).toLowerCase();
}

/** Bracket balance ignoring anything inside string/template literals or
 *  line/block comments. Kept intentionally simple — a real parser is
 *  overkill for a generation-time sanity check. */
function checkBalancedBrackets(src: string): { ok: true } | { ok: false; reason: string } {
  const stack: string[] = [];
  const openers: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const closers = new Set([")", "]", "}"]);
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    // Line comment
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    // Block comment
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    // String literal
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") i += 2;
        else i++;
      }
      i++;
      continue;
    }
    // Template literal
    if (c === "`") {
      i++;
      while (i < n && src[i] !== "`") {
        if (src[i] === "\\") i += 2;
        else if (src[i] === "$" && src[i + 1] === "{") {
          // Enter template expression; recurse balance via stack tracking
          i += 2;
          let depth = 1;
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            if (depth === 0) break;
            i++;
          }
          i++;
        } else i++;
      }
      i++;
      continue;
    }
    if (c in openers) stack.push(openers[c]);
    else if (closers.has(c)) {
      const expected = stack.pop();
      if (expected !== c) return { ok: false, reason: `bracket mismatch at index ${i}: got ${c}, expected ${expected ?? "no unclosed opener"}` };
    }
    i++;
  }
  if (stack.length > 0) return { ok: false, reason: `unclosed brackets: ${stack.slice().reverse().join("")}` };
  return { ok: true };
}

/** Count string/template quotes ignoring escapes + comments. Detects
 *  clearly unbalanced input like `"foo` or ``` `${...` ```. */
function checkBalancedQuotes(src: string): { ok: true } | { ok: false; reason: string } {
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      let closed = false;
      while (i < n) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === quote) { closed = true; i++; break; }
        // Template expression inside backtick — skip to matching brace
        if (quote === "`" && src[i] === "$" && src[i + 1] === "{") {
          i += 2;
          let depth = 1;
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
            i++;
          }
          continue;
        }
        i++;
      }
      if (!closed) return { ok: false, reason: `unterminated ${quote === "`" ? "template" : "string"} literal starting near index ${i}` };
      continue;
    }
    i++;
  }
  return { ok: true };
}

// ── Diff (vs workspace disk) ────────────────────────────────────────────

/**
 * Compute a diff between candidate files and the current workspace disk
 * state. READ ONLY — never mutates. workspace_root must be an absolute,
 * canonicalised path; caller is responsible for ensuring it points into
 * data/nex-agent-workspaces/{trace_id} or similar.
 *
 * Every path in `deletes` produces a "delete" entry regardless of
 * whether the file exists on disk (WO-04 handles idempotent unlink).
 * Every candidate produces an "add" / "modify" / "unchanged" entry.
 */
export async function computeDiff(input: {
  readonly plan: FilePlan;
  readonly candidates: readonly CandidateFile[];
  readonly workspace_root: string;
}): Promise<Diff> {
  const workspace_root = path.resolve(input.workspace_root);
  const entries: DiffEntry[] = [];
  const seen_paths = new Set<string>();

  for (const candidate of input.candidates) {
    seen_paths.add(candidate.path);
    const abs = path.resolve(workspace_root, candidate.path);
    let current: { hash: string; bytes: number } | null = null;
    try {
      const buf = await fs.readFile(abs);
      current = {
        hash: createHash("sha256").update(buf).digest("hex"),
        bytes: buf.length,
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    let kind: DiffEntry["kind"];
    if (!current) kind = "add";
    else if (current.hash === candidate.content_hash) kind = "unchanged";
    else kind = "modify";
    entries.push({
      path: candidate.path,
      kind,
      current_hash: current?.hash ?? null,
      next_hash: candidate.content_hash,
      current_bytes: current?.bytes ?? null,
      next_bytes: candidate.bytes,
    });
  }

  for (const op of input.plan.ops) {
    if (op.kind !== "delete") continue;
    if (seen_paths.has(op.path)) continue; // already covered
    const abs = path.resolve(workspace_root, op.path);
    let current: { hash: string; bytes: number } | null = null;
    try {
      const buf = await fs.readFile(abs);
      current = { hash: createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    entries.push({
      path: op.path,
      kind: "delete",
      current_hash: current?.hash ?? null,
      next_hash: null,
      current_bytes: current?.bytes ?? null,
      next_bytes: null,
    });
  }

  // Deterministic ordering so the digest is stable
  entries.sort((a, b) => a.path.localeCompare(b.path));

  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        plan_id: input.plan.plan_id,
        entries: entries.map((e) => ({
          path: e.path,
          kind: e.kind,
          current_hash: e.current_hash,
          next_hash: e.next_hash,
          current_bytes: e.current_bytes,
          next_bytes: e.next_bytes,
        })),
      }),
    )
    .digest("hex");

  return {
    record_type: "NEX1_DIFF",
    diff_id: `wo3-diff-${randomUUID()}`,
    plan_id: input.plan.plan_id,
    project_id: input.plan.project_id,
    trace_id: input.plan.trace_id,
    workspace_root,
    entries,
    created_at: new Date().toISOString(),
    digest,
  };
}
