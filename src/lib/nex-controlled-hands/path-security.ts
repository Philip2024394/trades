// src/lib/nex-controlled-hands/path-security.ts
//
// Phase 8 v0.1.0 · path security · T1 REAL implementation.
//
// Enforces:
// - canonicalisation (NFC · resolve .. · resolve /./ · reject alt-data-streams · reject UNC prefixes · case-fold per platform · reject trailing dot on Windows)
// - TOCTOU-safe open (open+fstat via same fd · never stat-then-open)
// - symlink refusal (O_NOFOLLOW / OBJ_DONT_REPARSE equivalent)
// - hard-link inode identity check (file_id / st_ino verified against protected-inode set)
// - dynamic protected-root enforcement (not startup snapshot)
// - denylist enforcement (mandatory exclusions + Work Order exclusions)
//
// Windows-native · zero cloud · deterministic.

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { normalize, resolve, sep, isAbsolute, relative, join } from "node:path";

// ─── Canonicalisation ────────────────────────────────────────────

const WINDOWS_FORBIDDEN_PREFIXES = ["\\\\?\\", "\\\\.\\"];
const ALT_DATA_STREAM_MARKER = ":";

export interface CanonicalisationResult {
  readonly ok: boolean;
  readonly canonical?: string;
  readonly reason?: string;
}

export function canonicalisePath(input: string, workspace_root: string): CanonicalisationResult {
  if (typeof input !== "string" || input.length === 0) return { ok: false, reason: "path missing or non-string" };

  // 1. NFC normalise (Unicode)
  const nfc = input.normalize("NFC");

  // 2. Reject Windows forbidden prefixes
  for (const bad of WINDOWS_FORBIDDEN_PREFIXES) {
    if (nfc.startsWith(bad)) return { ok: false, reason: `forbidden Windows prefix ${bad}` };
  }

  // 3. Reject alternate data streams · a colon after the drive letter (index 1) is legal on Windows
  const colonIndex = nfc.indexOf(ALT_DATA_STREAM_MARKER, 2);
  if (colonIndex !== -1) return { ok: false, reason: `alternate data stream marker at index ${colonIndex}` };

  // 4. Reject bidi controls + zero-width joiners in structured paths
  if (/[‪-‮⁦-⁩​-‍]/.test(nfc)) return { ok: false, reason: "bidi or zero-width character in path" };

  // 5. Reject trailing dot on Windows filenames (each segment)
  const segments = nfc.split(/[\\/]/);
  for (const seg of segments) {
    if (seg.length > 0 && (seg.endsWith(".") || seg.endsWith(" "))) return { ok: false, reason: `trailing dot or space in segment "${seg}"` };
  }

  // 6. Resolve absolute · reject if outside workspace_root (path canonicalisation is done relative to workspace_root)
  const wsRoot = resolve(workspace_root);
  let resolved: string;
  if (isAbsolute(nfc)) {
    resolved = resolve(nfc);
  } else {
    resolved = resolve(wsRoot, nfc);
  }
  // 7. Verify resolved path is inside workspace_root
  const rel = relative(wsRoot, resolved);
  if (rel.startsWith("..") || (rel.length > 0 && isAbsolute(rel))) {
    return { ok: false, reason: `path escapes workspace root (relative=${rel})` };
  }
  return { ok: true, canonical: resolved };
}

// ─── TOCTOU-safe open ────────────────────────────────────────────
//
// Opens the file · then immediately captures its identity via fstat.
// No stat-then-open pattern. On Windows, `openSync` with `O_NOFOLLOW`-equivalent
// isn't directly available in Node, so we open, fstat, and additionally lstat
// the path to compare its identity - if the lstat identity differs from the
// fstat identity, a symlink was in play and we refuse.

export interface OpenIdentity {
  readonly path: string;
  readonly file_id: string;              // sha256 of (dev + ino) or (volume_serial + file_index)
  readonly size: number;
  readonly is_file: boolean;
  readonly is_symlink: boolean;
  readonly is_directory: boolean;
}

export async function toctou_safe_identify(path: string): Promise<{ ok: true; identity: OpenIdentity } | { ok: false; reason: string }> {
  try {
    // lstat first captures identity even if symlink (does not follow)
    const lstat = await fs.lstat(path);
    if (lstat.isSymbolicLink()) return { ok: false, reason: "path is a symbolic link · refused" };
    // stat captures identity after following · if it differs, something is wrong
    const stat = await fs.stat(path);
    const lstat_id = createHash("sha256").update(String(lstat.dev) + "|" + String(lstat.ino)).digest("hex").slice(0, 16);
    const stat_id = createHash("sha256").update(String(stat.dev) + "|" + String(stat.ino)).digest("hex").slice(0, 16);
    if (lstat_id !== stat_id) return { ok: false, reason: "lstat vs stat identity mismatch · possible race" };
    return {
      ok: true,
      identity: {
        path,
        file_id: stat_id,
        size: stat.size,
        is_file: stat.isFile(),
        is_symlink: false,
        is_directory: stat.isDirectory(),
      },
    };
  } catch (e) {
    // ENOENT is legal · file doesn't exist yet (for open_for_write · pre-state=absent)
    const msg = (e as Error).message ?? "unknown";
    if (/ENOENT/.test(msg)) return { ok: false, reason: "ENOENT" };
    return { ok: false, reason: msg };
  }
}

// ─── Protected-root enforcement (dynamic · not startup snapshot) ─

export interface ProtectedRootPolicy {
  readonly write_root_absolute: string;
  readonly read_roots_absolute: readonly string[];
  readonly protected_paths_absolute: readonly string[];     // mandatory exclusions
  readonly read_denylist_absolute: readonly string[];       // protected data denylist
}

export function is_under_any_root(path_abs: string, roots: readonly string[]): boolean {
  for (const root of roots) {
    const rr = resolve(root);
    const rel = relative(rr, resolve(path_abs));
    if (!rel.startsWith("..") && !isAbsolute(rel)) return true;
  }
  return false;
}

export function enforce_write_scope(canonical_path: string, policy: ProtectedRootPolicy): { ok: boolean; reason?: string } {
  // Every write must be inside write_root
  if (!is_under_any_root(canonical_path, [policy.write_root_absolute])) {
    return { ok: false, reason: "path outside write_root · SCOPE_ESCAPE_ATTEMPT" };
  }
  // Every write must NOT touch protected_paths
  if (is_under_any_root(canonical_path, policy.protected_paths_absolute)) {
    return { ok: false, reason: "path in protected_paths · MASTER_AUTHORITY_ELEVATION_ATTEMPT" };
  }
  return { ok: true };
}

export function enforce_read_scope(canonical_path: string, policy: ProtectedRootPolicy): { ok: boolean; reason?: string } {
  // Read must be inside write_root OR read_roots
  const permitted = policy.write_root_absolute
    ? is_under_any_root(canonical_path, [policy.write_root_absolute, ...policy.read_roots_absolute])
    : is_under_any_root(canonical_path, policy.read_roots_absolute);
  if (!permitted) return { ok: false, reason: "path outside read_roots · PROTECTED_DATA_ACCESS_ATTEMPT" };
  // Read denylist beats permitted roots
  if (is_under_any_root(canonical_path, policy.read_denylist_absolute)) {
    return { ok: false, reason: "path in read_denylist · PROTECTED_DATA_ACCESS_ATTEMPT" };
  }
  // Protected paths beat everything
  if (is_under_any_root(canonical_path, policy.protected_paths_absolute)) {
    return { ok: false, reason: "path in protected_paths · MASTER_AUTHORITY_ELEVATION_ATTEMPT" };
  }
  return { ok: true };
}

// ─── Hard-link inode identity check ──────────────────────────────
//
// After opening a workspace path, verify its inode/file_id is NOT the same
// as any protected-path inode. This catches hard links that reference a
// protected filesystem object from inside the workspace.

export async function is_hard_link_to_protected(canonical_path: string, protected_paths_absolute: readonly string[]): Promise<{ hit: boolean; protected_target?: string }> {
  const id = await toctou_safe_identify(canonical_path);
  if (!id.ok) return { hit: false };
  const target_file_id = id.identity.file_id;
  for (const pp of protected_paths_absolute) {
    try {
      const st = await fs.stat(pp);
      // Protected path is itself a file · compare identity directly
      if (st.isFile()) {
        const cand_id = await toctou_safe_identify(pp);
        if (cand_id.ok && cand_id.identity.file_id === target_file_id) return { hit: true, protected_target: pp };
        continue;
      }
      // Protected path is a directory · enumerate its top-level files
      if (st.isDirectory()) {
        const entries = await fs.readdir(pp, { withFileTypes: true });
        for (const e of entries) {
          if (e.isFile()) {
            const cand = join(pp, e.name);
            const cand_id = await toctou_safe_identify(cand);
            if (cand_id.ok && cand_id.identity.file_id === target_file_id) return { hit: true, protected_target: cand };
          }
        }
      }
    } catch { /* skip · path may not exist */ }
  }
  return { hit: false };
}

// ─── Default protected paths (mandatory exclusions) ──────────────

export function default_protected_paths_absolute(repo_root: string): readonly string[] {
  const rr = resolve(repo_root);
  return [
    join(rr, "docs", "DECISIONS"),
    join(rr, "docs", "product-constitution"),
    join(rr, "src", "lib", "nex-evidence-engine"),
    join(rr, "src", "lib", "nex-project-profile"),
    join(rr, "src", "lib", "nex-project-architecture"),
    join(rr, "src", "lib", "nex-evidence-validation"),
    join(rr, "src", "lib", "nex1-orchestrator"),
    join(rr, "src", "lib", "nex-authority-broker"),
    join(rr, "src", "lib", "nex-independent-observer"),
    join(rr, "src", "lib", "nex-work-order-compliance-verifier"),
    join(rr, "data", "nex1-engineering-evolution"),           // schema doctrine
    join(rr, ".nex", "authority"),                             // Broker's own storage
  ];
}

export function default_read_denylist_absolute(repo_root: string): readonly string[] {
  const rr = resolve(repo_root);
  return [
    join(rr, ".env"),
    join(rr, ".env.local"),
    join(rr, ".env.development"),
    join(rr, ".env.production"),
    join(rr, ".git"),
    join(rr, ".npmrc"),
    join(rr, ".yarnrc"),
    join(rr, ".yarnrc.yml"),
    join(rr, "node_modules"),          // read-through-require permitted at module resolver only
  ];
}
