// src/lib/nex-agent/code-engine/capability-m-file-memory/seed-from-content.ts
//
// NEX1 · Capability M-1 · Deterministic content-scan seeder.
//
// Fix 4 (from Level-1 diagnostic 2026-09-16 · CONNECTION classification).
// Pure connective wrapper around FileMemoryStore.rememberFile · zero new
// capability · zero LLM.
//
// PURPOSE:
//   Populate File Memory with a curated but UNBIASED corpus. Each file is
//   tagged based on:
//     (a) its directory · (deterministic)
//     (b) coding-concept tokens actually present in its content, scanned
//         via CODING_LEXEME_INDEX from vocabulary v5 · (deterministic)
//
//   This gives NEX1 a way to answer "which files contain concept X?" via
//   `store.listFiles({ tag: X })` without any LLM inference · without any
//   founder answer preload · and without any biased search term.
//
// SAFETY:
//   · rememberFile refuses paths outside repo · traversal · too-large
//   · This helper only READS files (via readFileSync) and calls rememberFile
//   · Zero writes to any file other than File Memory JSONL (which is
//     rememberFile's normal storage)
//   · Fully bounded per rememberFile's existing limits.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { FileMemoryStore } from "./types";
import { CODING_LEXEME_INDEX } from "../capability-a-founder-intent/vocabulary";

export interface SeedFromContentInput {
  readonly store: FileMemoryStore;
  readonly repo_root: string;
  /** Repo-relative directories to walk. Every regular .ts/.tsx/.mts/.mjs
   *  file under each is a seed candidate. */
  readonly roots: readonly string[];
  /** File extensions to include (with leading dot). Defaults to
   *  [".ts", ".tsx", ".mts", ".mjs"]. */
  readonly extensions?: readonly string[];
  /** Max total files to seed. Defaults to 1500 · hard-capped at 4000. */
  readonly max_files?: number;
  /** Max bytes per file to inspect for concept tokens. Defaults to
   *  128 KB · larger files are still remembered but not concept-tagged. */
  readonly max_content_scan_bytes?: number;
  /** Additional pre-set tags applied to every seeded file · deterministic. */
  readonly base_tags?: readonly string[];
  /** If true, path segments (e.g. "nex-cap") become individual tags. */
  readonly tag_by_directory?: boolean;
  /** Skip paths starting with any of these prefixes (repo-relative). */
  readonly skip_prefixes?: readonly string[];
}

export interface SeedFromContentResult {
  readonly ok: true;
  readonly total_seeded: number;
  readonly total_skipped: number;
  readonly total_refused: number;
  readonly walked_bytes: number;
  readonly per_root: readonly {
    readonly root: string;
    readonly files_seeded: number;
    readonly files_skipped: number;
  }[];
  readonly refusals: readonly { path: string; reason: string }[];
}

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".mts", ".mjs"] as const;
const DEFAULT_SKIP_PREFIXES = [
  "node_modules/",
  ".next/",
  ".git/",
  ".vercel/",
  "data/nex-storage/",
  "data/external-audits/",
  "data/nex-code-brain/file-memory/",
];
const HARD_MAX_FILES = 4000;

function toForwardSlash(p: string): string {
  return p.split(path.sep).join("/");
}

/** Deterministic content scan for coding-concept tokens present in the file.
 *  Uses whole-token boundary via lowercase word-scan · same discipline as
 *  Capability A's classifier · zero LLM. */
function extractConceptTagsFromContent(content: string): string[] {
  const found = new Set<string>();
  // Whole-token match: lowercase, split on non-alphanumeric (excluding _).
  // This mirrors the classifier's token boundary discipline.
  const lower = content.toLowerCase();
  const tokens = lower.split(/[^a-z0-9_]+/).filter((t) => t.length > 0);
  for (const t of tokens) {
    if (CODING_LEXEME_INDEX.has(t)) {
      // CODING_LEXEME_INDEX maps lowercase token → category string.
      // The token itself IS the tag.
      found.add(t);
    }
  }
  return Array.from(found).sort();
}

/** Split repo-relative directory into deterministic segment tags.
 *  e.g. "src/lib/nex-cap/foo.ts" → ["src", "lib", "nex-cap"]. */
function directoryTags(repo_rel: string): string[] {
  const dir = path.posix.dirname(toForwardSlash(repo_rel));
  if (!dir || dir === "." || dir === "/") return [];
  return dir.split("/").filter((s) => s.length > 0 && s !== "src");
}

/** Recursively enumerate files under a repo-relative root.
 *  Deterministic (lexicographic) ordering. Respects skip_prefixes. */
function walkFiles(
  repo_root: string,
  rootRel: string,
  extensions: readonly string[],
  skipPrefixes: readonly string[],
  collected: string[],
  cap: number,
): void {
  if (collected.length >= cap) return;
  const abs = path.join(repo_root, rootRel);
  let entries: string[];
  try {
    entries = readdirSync(abs).sort();
  } catch {
    return;
  }
  for (const entry of entries) {
    if (collected.length >= cap) return;
    const childRel = toForwardSlash(path.posix.join(toForwardSlash(rootRel), entry));
    if (skipPrefixes.some((p) => childRel.startsWith(p))) continue;
    let stat;
    try {
      stat = statSync(path.join(repo_root, childRel));
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkFiles(repo_root, childRel, extensions, skipPrefixes, collected, cap);
    } else if (stat.isFile()) {
      const ext = path.extname(childRel);
      if (extensions.includes(ext)) {
        collected.push(childRel);
      }
    }
  }
}

/** Seed File Memory with a deterministic content-scan corpus.
 *  Every file is tagged with:
 *    · its directory segments (if tag_by_directory=true · default true)
 *    · coding-concept tokens actually present in content (via CODING_LEXEME_INDEX)
 *    · base_tags (if provided)
 *  Returns a structured summary. Zero LLM. Pure connection wrapper. */
export function seedFileMemoryFromContent(
  input: SeedFromContentInput,
): SeedFromContentResult {
  const extensions = input.extensions ?? DEFAULT_EXTENSIONS;
  const skip_prefixes = input.skip_prefixes ?? DEFAULT_SKIP_PREFIXES;
  const max_files = Math.min(input.max_files ?? 1500, HARD_MAX_FILES);
  const max_scan_bytes = input.max_content_scan_bytes ?? 128 * 1024;
  const tag_by_directory = input.tag_by_directory ?? true;
  const base_tags = input.base_tags ?? [];

  const perRoot: { root: string; files_seeded: number; files_skipped: number }[] = [];
  const refusals: { path: string; reason: string }[] = [];
  let totalSeeded = 0;
  let totalSkipped = 0;
  let totalRefused = 0;
  let walkedBytes = 0;

  for (const root of input.roots) {
    const collected: string[] = [];
    walkFiles(input.repo_root, root, extensions, skip_prefixes, collected, max_files - totalSeeded);
    let rootSeeded = 0;
    let rootSkipped = 0;
    for (const rel of collected) {
      if (totalSeeded >= max_files) break;
      const abs = path.join(input.repo_root, rel);
      let content = "";
      try {
        const buf = readFileSync(abs);
        walkedBytes += buf.byteLength;
        content = buf.subarray(0, max_scan_bytes).toString("utf8");
      } catch {
        rootSkipped++;
        totalSkipped++;
        continue;
      }
      const conceptTags = extractConceptTagsFromContent(content);
      const dirTags = tag_by_directory ? directoryTags(rel) : [];
      const allTags = Array.from(
        new Set([...base_tags, ...dirTags, ...conceptTags]),
      ).slice(0, 32); // Nex1FileMemoryEntry allows up to 32 tags
      const remember = input.store.rememberFile({
        path: rel,
        tags: allTags,
      });
      if (remember.ok) {
        totalSeeded++;
        rootSeeded++;
      } else {
        totalRefused++;
        refusals.push({ path: rel, reason: `${remember.refusal}: ${remember.reason}` });
      }
    }
    perRoot.push({ root, files_seeded: rootSeeded, files_skipped: rootSkipped });
  }

  return {
    ok: true,
    total_seeded: totalSeeded,
    total_skipped: totalSkipped,
    total_refused: totalRefused,
    walked_bytes: walkedBytes,
    per_root: perRoot,
    refusals,
  };
}
