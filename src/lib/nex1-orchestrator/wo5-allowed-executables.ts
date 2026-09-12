// WO-WORKSTATION-05 · allowed-executables registry
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Explicit allowlist of the executables WO-05 will run. Every request
// resolves through this file — the executor NEVER accepts a raw filesystem
// path. Adding a new executable is a code change, not a config change.
//
// Resolution rules:
//   node -> process.execPath (the exact Node binary that is running us)
//   npm  -> resolve from PATH via `where` (Windows) / `which` (POSIX)
//   npx  -> resolve from PATH the same way
//
// Rationale for node = process.execPath: we get a canonicalised absolute
// path AND we guarantee the version match with what the workstation itself
// runs on. No ambiguity.

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { AllowedExecutableRef } from "./wo5-types";

interface ResolvedExecutable {
  readonly ref: AllowedExecutableRef;
  readonly absolute_path: string;
}

const cache = new Map<AllowedExecutableRef, ResolvedExecutable>();

/**
 * Resolve an executable ref to its absolute path on the current machine.
 * Cached after first resolution. Throws with a specific reason if the
 * executable cannot be located.
 */
export async function resolveAllowedExecutable(ref: AllowedExecutableRef): Promise<ResolvedExecutable> {
  const cached = cache.get(ref);
  if (cached) return cached;

  let absolute: string;
  if (ref === "node") {
    // Whatever node is running us is by definition on the system.
    absolute = process.execPath;
  } else {
    absolute = await locateOnPath(ref);
  }

  // Sanity-check the path exists and is a regular file (or file symlink).
  try {
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) {
      throw makeErr(`EXECUTABLE_NOT_FOUND_ON_DISK`, `resolved path for ${ref} is not a regular file: ${absolute}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw makeErr(`EXECUTABLE_NOT_FOUND_ON_DISK`, `resolved path for ${ref} does not exist: ${absolute}`);
    }
    throw err;
  }

  const resolved: ResolvedExecutable = { ref, absolute_path: path.resolve(absolute) };
  cache.set(ref, resolved);
  return resolved;
}

/** Which executable refs are currently registered as allowlisted. */
export function listAllowedExecutableRefs(): readonly AllowedExecutableRef[] {
  return ["node", "npm", "npx"];
}

/** Is the given ref present in the allowlist? Cheap synchronous check. */
export function isAllowedExecutableRef(ref: unknown): ref is AllowedExecutableRef {
  return ref === "node" || ref === "npm" || ref === "npx";
}

/** Test-only. Drops the cache so tests can rerun resolution. */
export function _wo5_resetAllowedExecutablesCache(): void {
  cache.clear();
}

// ── Path lookup helpers ─────────────────────────────────────────────────

async function locateOnPath(command: string): Promise<string> {
  // Windows uses `where`; POSIX uses `which`. Spawn the tool with the exact
  // command and take the first line of stdout.
  const isWindows = process.platform === "win32";
  const locator = isWindows ? "where" : "which";
  const args = [command];

  return new Promise<string>((resolve, reject) => {
    const child = spawn(locator, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", (err) => reject(makeErr("EXECUTABLE_NOT_FOUND_ON_DISK", `${locator} failed for ${command}: ${err.message}`)));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(makeErr("EXECUTABLE_NOT_FOUND_ON_DISK", `${locator} exited ${code} for ${command}: ${stderr.trim() || "(no stderr)"}`));
        return;
      }
      const first = stdout.split(/\r?\n/).map((s) => s.trim()).find((s) => s.length > 0);
      if (!first) {
        reject(makeErr("EXECUTABLE_NOT_FOUND_ON_DISK", `${locator} produced no output for ${command}`));
        return;
      }
      resolve(first);
    });
  });
}

function makeErr(code: string, message: string): NodeJS.ErrnoException {
  const e = new Error(message) as NodeJS.ErrnoException;
  e.code = code;
  return e;
}
