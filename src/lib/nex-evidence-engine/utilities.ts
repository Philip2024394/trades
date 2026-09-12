// src/lib/nex-evidence-engine/utilities.ts
//
// NEX1 · EVIDENCE ENGINE · deterministic utility surface.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// No LLM · no network · deterministic hash + id + fingerprint helpers.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, mkdtempSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Attribution, Provenance, ReproducibilityInformation } from "./types";

let RECORD_COUNTER = 0;
export function nextEvidenceId(): string {
  RECORD_COUNTER++;
  return "EV-" + String(RECORD_COUNTER).padStart(10, "0") + "-" + randomBytes(3).toString("hex");
}
export function nextBundleId(): string {
  return "EB-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex");
}
export function nextDeclarationId(): string {
  return "ND-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex");
}

export function sha256Prefix(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16);
}

export function hashSourceFiles(sources: readonly { path: string; content: string }[]): readonly { path: string; sha256_prefix: string }[] {
  return sources
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((s) => ({ path: s.path, sha256_prefix: sha256Prefix(s.content) }));
}

export function envFingerprint(): string {
  // Deterministic fingerprint of a bounded set of environment variables
  // that are load-bearing for measurement reproducibility. NEVER captures
  // secrets · never captures user-scoped env values.
  const relevant = ["NODE_ENV", "TZ", "LANG", "PATH_SEP_HINT"];
  const parts = relevant.map((k) => `${k}=${process.env[k] ?? ""}`);
  parts.push(`node=${process.version}`);
  parts.push(`platform=${process.platform}`);
  parts.push(`arch=${process.arch}`);
  return sha256Prefix(parts.join("|"));
}

export function reproducibility(command: string, cwd: string, seed?: number): ReproducibilityInformation {
  return {
    command,
    cwd,
    env_fingerprint: envFingerprint(),
    node_version: process.version,
    platform: process.platform,
    seed,
  };
}

export function attributionMeasurement(): Attribution {
  return {
    external_llm_used: false,
    deterministic: true,
    taught_by: "master_ai_engineer",
    role: "evidence_engine",
    authority: "measurement",
  };
}
export function attributionDeclaration(): Attribution {
  return {
    external_llm_used: false,
    deterministic: true,
    taught_by: "master_ai_engineer",
    role: "nex1_builder",
    authority: "declaration_only",
  };
}

export function provenance(
  requested_by: string,
  produced_by: string,
  parents: readonly string[],
  tools: readonly { tool: string; tool_version: string }[],
): Provenance {
  const chainStr = [requested_by, produced_by, ...parents, ...tools.map((t) => t.tool + "@" + t.tool_version)].join("|");
  return {
    requested_by,
    produced_by,
    parent_records: parents,
    tool_chain: tools,
    chain_integrity_hash: sha256Prefix(chainStr),
  };
}

// ─── Isolated write area · outside the measured project ─────────
// Every measurement that needs to write anything (tsc temp files · vitest
// output) uses a NEW isolated temp dir under os.tmpdir(). Never writes
// into the measured project. Cleaned up on exit.

export interface IsolatedArea {
  readonly root: string;
  readonly write: (relativePath: string, content: string) => string;
  readonly cleanup: () => void;
}

export function createIsolatedArea(prefix = "nex-ev-"): IsolatedArea {
  const root = mkdtempSync(join(tmpdir(), prefix));
  return {
    root,
    write(relativePath: string, content: string): string {
      const abs = join(root, relativePath);
      // Ensure parent dirs
      const dir = abs.substring(0, abs.replace(/[\\/]/g, "/").lastIndexOf("/"));
      if (dir && !existsSync(dir)) {
        try {
          // Recursive mkdir via require for older node compat
          require("node:fs").mkdirSync(dir, { recursive: true });
        } catch { /* ignore */ }
      }
      writeFileSync(abs, content, "utf8");
      return abs;
    },
    cleanup() {
      try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ }
    },
  };
}

// ─── Byte-identity check for the measured project ───────────────
// Before + after measurement · confirm no source files in the measured
// project were modified.

export interface ByteIdentityWitness {
  readonly at: string;
  readonly path_hashes: readonly { path: string; sha256_prefix: string; size_bytes: number }[];
}

export function witness(paths: readonly string[]): ByteIdentityWitness {
  const at = new Date().toISOString();
  const path_hashes = paths
    .filter((p) => existsSync(p))
    .map((p) => {
      try {
        const content = readFileSync(p, "utf8");
        return { path: p, sha256_prefix: sha256Prefix(content), size_bytes: statSync(p).size };
      } catch {
        return { path: p, sha256_prefix: "unreadable", size_bytes: -1 };
      }
    });
  return { at, path_hashes };
}

export function witnessesMatch(before: ByteIdentityWitness, after: ByteIdentityWitness): { matched: boolean; drifted: readonly string[] } {
  const drifted: string[] = [];
  const beforeMap = new Map(before.path_hashes.map((h) => [h.path, h]));
  for (const a of after.path_hashes) {
    const b = beforeMap.get(a.path);
    if (!b) { drifted.push(a.path + " (new)"); continue; }
    if (b.sha256_prefix !== a.sha256_prefix || b.size_bytes !== a.size_bytes) {
      drifted.push(a.path);
    }
  }
  // check for deletions
  for (const b of before.path_hashes) {
    if (!after.path_hashes.some((a) => a.path === b.path)) drifted.push(b.path + " (deleted)");
  }
  return { matched: drifted.length === 0, drifted };
}

// ─── Spawn with hard timeout · captures stdout + exit code ──────

import { spawnSync } from "node:child_process";
export interface SpawnResult {
  readonly command: string;
  readonly cwd: string;
  readonly exit_code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly elapsed_ms: number;
  readonly timed_out: boolean;
  readonly tool_available: boolean;
}
export function safeSpawn(bin: string, args: readonly string[], cwd: string, timeoutMs: number): SpawnResult {
  const t0 = Date.now();
  try {
    const r = spawnSync(bin, args as string[], {
      cwd,
      encoding: "utf8",
      timeout: timeoutMs,
      shell: false,
      maxBuffer: 8 * 1024 * 1024,
      // Never inherit stdin · never allow interactive prompts
      stdio: ["ignore", "pipe", "pipe"],
    });
    const elapsed_ms = Date.now() - t0;
    if (r.error) {
      const anyErr = r.error as any;
      // ENOENT · tool not available
      if (anyErr.code === "ENOENT") {
        return { command: bin + " " + args.join(" "), cwd, exit_code: null, stdout: "", stderr: anyErr.message ?? String(r.error), elapsed_ms, timed_out: false, tool_available: false };
      }
      return { command: bin + " " + args.join(" "), cwd, exit_code: null, stdout: r.stdout ?? "", stderr: (r.stderr ?? "") + " · " + anyErr.message, elapsed_ms, timed_out: !!r.signal, tool_available: true };
    }
    return {
      command: bin + " " + args.join(" "),
      cwd,
      exit_code: r.status,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
      elapsed_ms,
      timed_out: !!r.signal && r.signal === "SIGTERM",
      tool_available: true,
    };
  } catch (e) {
    return { command: bin + " " + args.join(" "), cwd, exit_code: null, stdout: "", stderr: (e as Error).message, elapsed_ms: Date.now() - t0, timed_out: false, tool_available: false };
  }
}

// ─── Toolchain version detection · deterministic ────────────────

export function detectToolVersion(bin: string, versionArg = "--version"): string | null {
  const r = safeSpawn(bin, [versionArg], process.cwd(), 5000);
  if (!r.tool_available) return null;
  const out = (r.stdout + " " + r.stderr).trim();
  const m = out.match(/\d+\.\d+(?:\.\d+)?(?:[-.\w]*)?/);
  return m ? m[0] : (out.split("\n")[0] || "unknown");
}
