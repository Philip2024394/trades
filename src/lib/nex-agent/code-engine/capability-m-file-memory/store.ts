// src/lib/nex-agent/code-engine/capability-m-file-memory/store.ts
//
// NEX1 · CAPABILITY M-1 · File Memory Store · deterministic · zero LLM.
//
// Append-only JSONL persistence + in-memory index rebuilt on load.
// Latest-write-wins per path on replay.
//
// Safety:
//   - Every path is validated (repo-relative, no traversal, no absolute-outside-repo)
//   - Files above NEX1_FM_MAX_FILE_BYTES are refused (not memorised — reduces
//     risk of accidentally hashing multi-GB build artefacts)
//   - Tags + summary are bounded
//   - JSONL append failures are surfaced as RememberRefused (never swallowed)

import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, resolve as pathResolve, sep as pathSep } from "node:path";
import { detectLanguage } from "./language-detect";
import type {
  CreateFileMemoryStoreInput,
  FileMemoryStore,
  ForgetRecord,
  ListFilesFilter,
  ListFilesResult,
  Nex1FileMemoryEntry,
  PersistenceRecord,
  RecallResult,
  RememberFileInput,
  RememberRecord,
  RememberRefused,
  RememberResult,
} from "./types";
import {
  NEX1_FM_DEFAULT_LIST_LIMIT,
  NEX1_FM_MAX_FILE_BYTES,
  NEX1_FM_MAX_LIST_LIMIT,
  NEX1_FM_MAX_SUMMARY_CHARS,
  NEX1_FM_MAX_TAGS,
} from "./types";

const TAUGHT_BY = "master_ai_engineer" as const;
const DEFAULT_STORAGE_REL = "data/nex-code-brain/file-memory/index.jsonl";

interface ForgottenMark {
  readonly forgotten_at_iso: string;
  readonly reason: string;
}

function normaliseSlashes(p: string): string {
  return p.split(pathSep).join("/");
}

function refuse(refusal: RememberRefused["refusal"], reason: string): RememberRefused {
  return { ok: false, refusal, reason };
}

function sha256File(absPath: string): string {
  const bytes = readFileSync(absPath);
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Validate a caller-provided path. Returns the canonical repo-relative form
 * (forward-slash) or a refusal.
 */
function normalisePath(
  callerPath: string,
  repoRoot: string,
): { ok: true; repo_relative: string; abs: string } | RememberRefused {
  if (typeof callerPath !== "string" || callerPath.trim().length === 0) {
    return refuse("path_empty", "path is empty");
  }
  const raw = callerPath.trim();

  // Explicit traversal segment refusal.
  const traversalSegments = raw.split(/[\\/]/).filter((s) => s === "..");
  if (traversalSegments.length > 0) {
    return refuse("path_traversal_attempt", `path contains '..' segments: ${raw}`);
  }

  // Absolute paths must land inside repoRoot.
  const abs = isAbsolute(raw) ? pathResolve(raw) : pathResolve(repoRoot, raw);
  const rootResolved = pathResolve(repoRoot);
  const relFromRoot = pathResolve(abs).slice(rootResolved.length);
  if (!pathResolve(abs).startsWith(rootResolved + pathSep) && pathResolve(abs) !== rootResolved) {
    return refuse("path_outside_repo", `path resolves outside repo_root: ${abs}`);
  }
  // Strip leading separator.
  const stripped = relFromRoot.startsWith(pathSep) ? relFromRoot.slice(1) : relFromRoot;
  return { ok: true, repo_relative: normaliseSlashes(stripped), abs };
}

export function createFileMemoryStore(input: CreateFileMemoryStoreInput): FileMemoryStore {
  const repoRoot = pathResolve(input.repo_root);
  const storagePath = input.storage_path
    ? pathResolve(input.repo_root, input.storage_path)
    : pathResolve(input.repo_root, DEFAULT_STORAGE_REL);

  // In-memory state.
  const remembered = new Map<string, Nex1FileMemoryEntry>();
  const forgotten = new Map<string, ForgottenMark>();

  function ensureStorageDir(): void {
    const dir = dirname(storagePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  function appendRecord(rec: PersistenceRecord): { ok: true } | { ok: false; reason: string } {
    try {
      ensureStorageDir();
      appendFileSync(storagePath, JSON.stringify(rec) + "\n", { encoding: "utf8" });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
  }

  function loadFromDisk(): void {
    remembered.clear();
    forgotten.clear();
    if (!existsSync(storagePath)) return;
    const raw = readFileSync(storagePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (t.length === 0) continue;
      let rec: PersistenceRecord;
      try {
        rec = JSON.parse(t) as PersistenceRecord;
      } catch {
        continue; // deliberately skip corrupt lines (do not throw)
      }
      if (rec.kind === "remember") {
        remembered.set(rec.entry.path, rec.entry);
        forgotten.delete(rec.entry.path);
      } else if (rec.kind === "forget") {
        forgotten.set(rec.path, {
          forgotten_at_iso: rec.recorded_at_iso,
          reason: rec.reason,
        });
        remembered.delete(rec.path);
      }
    }
  }

  // Load on construction.
  loadFromDisk();

  function rememberFile(inp: RememberFileInput): RememberResult {
    const pathCheck = normalisePath(inp.path, repoRoot);
    if ("refusal" in pathCheck) return pathCheck;
    const { repo_relative, abs } = pathCheck;

    if (!existsSync(abs)) {
      return refuse("file_not_found", `no file at ${abs}`);
    }
    const stat = statSync(abs);
    if (!stat.isFile()) {
      return refuse("file_not_found", `not a regular file: ${abs}`);
    }
    if (stat.size > NEX1_FM_MAX_FILE_BYTES) {
      return refuse(
        "file_too_large",
        `size ${stat.size} exceeds NEX1_FM_MAX_FILE_BYTES=${NEX1_FM_MAX_FILE_BYTES}`,
      );
    }

    const tags = (inp.tags ?? []).slice();
    if (tags.length > NEX1_FM_MAX_TAGS) {
      return refuse("tags_too_many", `${tags.length} tags exceeds max ${NEX1_FM_MAX_TAGS}`);
    }
    const summary = inp.summary ?? null;
    if (summary && summary.length > NEX1_FM_MAX_SUMMARY_CHARS) {
      return refuse(
        "summary_too_long",
        `summary ${summary.length} chars exceeds ${NEX1_FM_MAX_SUMMARY_CHARS}`,
      );
    }

    const nowIso = new Date().toISOString();
    const hash = sha256File(abs);
    const language = detectLanguage(repo_relative);
    const prior = remembered.get(repo_relative);

    const entry: Nex1FileMemoryEntry = {
      path: repo_relative,
      sha256: hash,
      size_bytes: stat.size,
      language,
      first_seen_iso: prior?.first_seen_iso ?? nowIso,
      last_seen_iso: nowIso,
      tags: Object.freeze([...tags]),
      summary,
      taught_by: TAUGHT_BY,
    };

    const rec: RememberRecord = { kind: "remember", entry, recorded_at_iso: nowIso };
    const write = appendRecord(rec);
    if (!write.ok) return refuse("storage_write_failed", write.reason);

    remembered.set(repo_relative, entry);
    forgotten.delete(repo_relative);

    return {
      ok: true,
      entry,
      was_already_remembered: prior !== undefined,
      content_changed: prior !== undefined && prior.sha256 !== hash,
    };
  }

  function recallFile(callerPath: string): RecallResult {
    const pathCheck = normalisePath(callerPath, repoRoot);
    if ("refusal" in pathCheck) {
      return { kind: "not_remembered", path: callerPath };
    }
    const key = pathCheck.repo_relative;
    const entry = remembered.get(key);
    if (entry) return { kind: "found", entry };
    const mark = forgotten.get(key);
    if (mark) {
      return {
        kind: "forgotten",
        path: key,
        forgotten_at_iso: mark.forgotten_at_iso,
        reason: mark.reason,
      };
    }
    return { kind: "not_remembered", path: key };
  }

  function listFiles(filter?: ListFilesFilter): ListFilesResult {
    const all = Array.from(remembered.values());
    let filtered = all;
    if (filter?.path_prefix) {
      const prefix = normaliseSlashes(filter.path_prefix);
      filtered = filtered.filter((e) => e.path.startsWith(prefix));
    }
    if (filter?.language) {
      const wanted = filter.language.toLowerCase();
      filtered = filtered.filter((e) => e.language === wanted);
    }
    if (filter?.tag) {
      const tag = filter.tag;
      filtered = filtered.filter((e) => e.tags.includes(tag));
    }
    filtered.sort((a, b) => (a.last_seen_iso < b.last_seen_iso ? 1 : a.last_seen_iso > b.last_seen_iso ? -1 : 0));
    const totalMatching = filtered.length;
    const rawLimit = filter?.limit ?? NEX1_FM_DEFAULT_LIST_LIMIT;
    const limit = Math.min(Math.max(1, rawLimit), NEX1_FM_MAX_LIST_LIMIT);
    const entries = filtered.slice(0, limit);
    return { total_matching: totalMatching, returned: entries.length, entries };
  }

  function forgetFile(callerPath: string, reason: string): { ok: boolean; reason?: string } {
    const pathCheck = normalisePath(callerPath, repoRoot);
    if ("refusal" in pathCheck) return { ok: false, reason: pathCheck.reason };
    const key = pathCheck.repo_relative;
    if (!remembered.has(key) && !forgotten.has(key)) {
      return { ok: false, reason: `path not remembered: ${key}` };
    }
    const nowIso = new Date().toISOString();
    const rec: ForgetRecord = {
      kind: "forget",
      path: key,
      reason: reason.slice(0, 500),
      recorded_at_iso: nowIso,
    };
    const write = appendRecord(rec);
    if (!write.ok) return { ok: false, reason: write.reason };
    remembered.delete(key);
    forgotten.set(key, { forgotten_at_iso: nowIso, reason: rec.reason });
    return { ok: true };
  }

  return {
    rememberFile,
    recallFile,
    listFiles,
    forgetFile,
    size: () => remembered.size,
    storagePathAbs: () => storagePath,
    reload: loadFromDisk,
  };
}
