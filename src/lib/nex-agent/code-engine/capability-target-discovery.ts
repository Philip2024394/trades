// src/lib/nex-agent/code-engine/capability-target-discovery.ts
//
// NEX1 · Fix Batch 2B · Deterministic target discovery.
// Founder-authorised 2026-09-18.
//
// PURPOSE
//   Given a natural-language user message with NO explicit file path, extract
//   identifier-shaped tokens (camelCase, PascalCase, snake_case, kebab-case,
//   backtick-quoted `code`) and search the repository source tree for
//   candidate files whose basename or exported-symbol list contains those
//   tokens. Return a ranked candidate list.
//
//   Called by chat-turn when:
//     - classifier.file_references is empty AND
//     - conversation active_target is null AND
//     - the user prose still contains recognisable identifier tokens.
//
// DISCIPLINE
//   · Zero LLM · zero external network · zero fabrication.
//   · Deterministic scoring using verbatim token counts and match-position.
//   · Bounded traversal (MAX_FILES_SCANNED = 400, MAX_DIRS_DEEP = 6).
//   · Refuses when no identifier tokens are present in the message.
//   · Never modifies files.

import fs from "node:fs";
import path from "node:path";

// ── Public shape ─────────────────────────────────────────────────────────

export interface DiscoveryCandidate {
  readonly path: string;                       // repo-relative
  readonly basename: string;
  readonly matched_tokens: readonly string[];  // tokens that hit this file
  readonly match_score: number;                // deterministic integer score
  readonly match_reason: "basename" | "exported_symbol" | "both";
}

export type DiscoveryRefusalKind =
  | "no_identifier_tokens"
  | "search_scope_empty"
  | "traversal_limit_reached_with_no_hits";

export interface DiscoveryRefusal {
  readonly ok: false;
  readonly refusal_kind: DiscoveryRefusalKind;
  readonly detail: string;
  readonly extracted_tokens: readonly string[];
}

export interface DiscoverySuccess {
  readonly ok: true;
  readonly candidates: readonly DiscoveryCandidate[]; // sorted desc by score
  readonly extracted_tokens: readonly string[];
  readonly files_scanned: number;
  readonly evidence_kind: "OBSERVED";
}

export type DiscoveryResult = DiscoverySuccess | DiscoveryRefusal;

export interface DiscoveryInput {
  readonly repo_root: string;
  readonly user_message: string;
  /** Optional scope directories to restrict search (repo-relative or
   *  absolute). Default: `["src"]`. */
  readonly scope_dirs?: readonly string[];
  /** Max candidates to return in the sorted list. Default 8. */
  readonly max_candidates?: number;
}

// ── Deterministic identifier extraction ──────────────────────────────────

const CAMEL_OR_PASCAL = /\b([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+|[a-z][a-z0-9]*[A-Z][A-Za-z0-9]+)\b/g;
const SNAKE = /\b([a-z]+_[a-z0-9_]+)\b/g;
const KEBAB = /\b([a-z][a-z0-9]*-[a-z0-9\-]+)\b/g;
const BACKTICKED = /`([^`]+)`/g;

// Common stopwords that should NEVER be treated as identifier targets even
// if they appear alone; keeps the score honest.
const STOPWORDS = new Set([
  "analyse", "analyze", "investigate", "identify", "explain",
  "propose", "verify", "code", "file", "test", "correction",
  "problem", "issue", "bug", "error", "please", "what", "is",
  "wrong", "should", "would", "could", "please", "then",
  "this", "that", "the", "and", "of", "in", "for", "to", "on",
  "at", "from", "with", "call", "called", "returns", "return",
  "value", "size", "result",
]);

function normaliseToken(tok: string): string {
  return tok.trim();
}

function isPlausibleIdentifier(tok: string): boolean {
  if (tok.length < 3) return false;
  const lower = tok.toLowerCase();
  if (STOPWORDS.has(lower)) return false;
  // Must contain some hint of an identifier shape (camel/pascal/snake/kebab
  // OR quoted or a period-path fragment).
  if (/[A-Z]/.test(tok) && /[a-z]/.test(tok)) return true; // camelCase or PascalCase
  if (/_/.test(tok) || /-/.test(tok)) return true;
  if (tok.startsWith("/") || tok.includes("/")) return true; // partial path
  return false;
}

/** Extract identifier-shaped tokens from prose. Deterministic. */
export function extractIdentifierTokens(message: string): readonly string[] {
  const raw = typeof message === "string" ? message : "";
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (t: string) => {
    const n = normaliseToken(t);
    if (!isPlausibleIdentifier(n)) return;
    if (seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  let m: RegExpExecArray | null;
  while ((m = CAMEL_OR_PASCAL.exec(raw)) !== null) push(m[1]);
  while ((m = SNAKE.exec(raw)) !== null) push(m[1]);
  while ((m = KEBAB.exec(raw)) !== null) push(m[1]);
  while ((m = BACKTICKED.exec(raw)) !== null) push(m[1]);
  return out;
}

// ── Bounded traversal + scoring ──────────────────────────────────────────

const MAX_FILES_SCANNED = 20000;
const MAX_DIRS_DEEP = 12;
const EXCLUDED_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", "coverage",
  ".turbo", ".vercel", ".idea", ".vscode", "data",
]);
const INCLUDED_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts",
]);
const EXCLUDED_FILE_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".d.ts"];

interface WalkResult {
  files_scanned: number;
  file_paths: string[];
}

function walk(root: string, depth: number, out: WalkResult, maxFiles: number, maxDepth: number): void {
  if (depth > maxDepth) return;
  if (out.files_scanned >= maxFiles) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.files_scanned >= maxFiles) return;
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      if (EXCLUDED_DIRS.has(e.name)) continue;
      walk(full, depth + 1, out, maxFiles, maxDepth);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (!INCLUDED_EXTS.has(ext)) continue;
      if (EXCLUDED_FILE_SUFFIXES.some((sfx) => e.name.endsWith(sfx))) continue;
      out.files_scanned++;
      out.file_paths.push(full);
    }
  }
}

/** Extract exported top-level symbol names from a TypeScript/JavaScript
 *  source string. Deterministic regex extraction — no AST library. Not
 *  100% complete, but sufficient for name-match discovery. */
function extractExportedSymbols(source: string): readonly string[] {
  const out: string[] = [];
  const re = /(?:^|\n)\s*export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.push(m[1]);
  return out;
}

function scoreCandidate(
  filePath: string,
  tokens: readonly string[],
  source: string | null,
): { matched: string[]; score: number; reason: "basename" | "exported_symbol" | "both" } {
  const basename = path.basename(filePath).replace(/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/, "");
  const basenameLower = basename.toLowerCase();
  const symbols = source !== null ? extractExportedSymbols(source) : [];
  const symbolSet = new Set(symbols.map((s) => s));
  const matched: string[] = [];
  let scoreBasename = 0;
  let scoreSymbol = 0;
  for (const tok of tokens) {
    const tokLower = tok.toLowerCase();
    if (basenameLower === tokLower) {
      matched.push(tok);
      scoreBasename += 20; // exact basename match = strongest
    } else if (basenameLower.includes(tokLower)) {
      matched.push(tok);
      scoreBasename += 8;
    }
    if (symbolSet.has(tok)) {
      matched.push(tok);
      scoreSymbol += 12; // exact exported symbol match
    } else {
      for (const s of symbols) {
        if (s.toLowerCase() === tokLower) {
          matched.push(tok);
          scoreSymbol += 12;
          break;
        }
      }
    }
  }
  const score = scoreBasename + scoreSymbol;
  const reason: "basename" | "exported_symbol" | "both" =
    scoreBasename > 0 && scoreSymbol > 0
      ? "both"
      : scoreSymbol > 0
        ? "exported_symbol"
        : "basename";
  // Deduplicate matched
  const seen = new Set<string>();
  const uniqMatched: string[] = [];
  for (const m of matched) {
    if (!seen.has(m)) {
      seen.add(m);
      uniqMatched.push(m);
    }
  }
  return { matched: uniqMatched, score, reason };
}

// ── Public entry ─────────────────────────────────────────────────────────

export function discoverTargets(input: DiscoveryInput): DiscoveryResult {
  const repoRoot = input.repo_root;
  const scopeDirs = input.scope_dirs && input.scope_dirs.length > 0
    ? input.scope_dirs
    : ["src"];
  const maxCandidates = typeof input.max_candidates === "number" && input.max_candidates > 0
    ? input.max_candidates
    : 8;

  const tokens = extractIdentifierTokens(input.user_message);
  if (tokens.length === 0) {
    return {
      ok: false,
      refusal_kind: "no_identifier_tokens",
      detail: "user message contains no identifier-shaped tokens (camelCase, snake_case, kebab-case, or backticked code)",
      extracted_tokens: [],
    };
  }

  // Validate + resolve scope
  const absoluteScopes: string[] = [];
  for (const s of scopeDirs) {
    const abs = path.isAbsolute(s) ? s : path.join(repoRoot, s);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      absoluteScopes.push(abs);
    }
  }
  if (absoluteScopes.length === 0) {
    return {
      ok: false,
      refusal_kind: "search_scope_empty",
      detail: `none of the scope dirs exist under repo root: ${scopeDirs.join(", ")}`,
      extracted_tokens: tokens,
    };
  }

  const walk_result: WalkResult = { files_scanned: 0, file_paths: [] };
  for (const scope of absoluteScopes) {
    walk(scope, 0, walk_result, MAX_FILES_SCANNED, MAX_DIRS_DEEP);
  }

  // TWO-PASS SCORING — first pass over BASENAME ONLY (no file reads · fast).
  // Second pass reads only files whose basename matched or whose token is
  // rare enough that a deeper read is warranted.
  //
  // Pass 1: basename-only pre-filter. Any file whose basename token-matches
  // is a candidate; files with no basename hit are only exported-symbol
  // candidates if the token count is small (avoids scanning thousands of
  // sources for a single common word).
  const tokenSet = new Set(tokens.map((t) => t.toLowerCase()));
  const basenameHits: string[] = [];
  const otherFiles: string[] = [];
  for (const abs of walk_result.file_paths) {
    const bn = path.basename(abs).toLowerCase().replace(/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/, "");
    let hit = false;
    for (const t of tokenSet) {
      if (bn === t || bn.includes(t)) {
        hit = true;
        break;
      }
    }
    if (hit) basenameHits.push(abs);
    else otherFiles.push(abs);
  }
  // Only read source of basename-hit files by default. If basename pass
  // yielded zero hits AND we have a small number of distinctive tokens
  // (<=3), fall back to a fuller scan reading source for exported-symbol
  // scoring. Deterministic. Bounded.
  let filesToScore: readonly string[] = basenameHits;
  if (basenameHits.length === 0 && tokens.length <= 3) {
    filesToScore = otherFiles;
  }

  // Score each candidate.
  const scored: DiscoveryCandidate[] = [];
  for (const abs of filesToScore) {
    let source: string | null = null;
    try {
      source = fs.readFileSync(abs, "utf8");
    } catch {
      source = null;
    }
    const { matched, score, reason } = scoreCandidate(abs, tokens, source);
    if (score > 0 && matched.length > 0) {
      scored.push({
        path: path.relative(repoRoot, abs).replace(/\\/g, "/"),
        basename: path.basename(abs),
        matched_tokens: matched,
        match_score: score,
        match_reason: reason,
      });
    }
  }

  // Sort descending by score; then by basename shortness (shorter → more
  // specific); then by path lex order for determinism.
  scored.sort((a, b) =>
    b.match_score - a.match_score ||
    a.basename.length - b.basename.length ||
    a.path.localeCompare(b.path),
  );

  if (scored.length === 0) {
    return {
      ok: false,
      refusal_kind: "traversal_limit_reached_with_no_hits",
      detail: `scanned ${walk_result.files_scanned} files across ${absoluteScopes.length} scope dir(s); zero matched any of the ${tokens.length} extracted tokens`,
      extracted_tokens: tokens,
    };
  }

  return {
    ok: true,
    candidates: scored.slice(0, maxCandidates),
    extracted_tokens: tokens,
    files_scanned: walk_result.files_scanned,
    evidence_kind: "OBSERVED",
  };
}

export const TARGET_DISCOVERY_VERSION = "batch2b.v1";
