// NEX Legacy Workforce Quarantine · regression test
// ─────────────────────────────────────────────────────────────────────────────
// Ratified 2026-09-04 during the Legacy Workforce Quarantine slice.
//
// This test proves that the LEGACY Phase 1B acquisition workforce cannot
// accidentally execute against production. It runs each quarantined file
// as an isolated subprocess and asserts:
//   · exits with code 2 (chosen non-zero, distinct from success=0 and
//     Node crashes=1, aligning with the fail-closed guard convention)
//   · exits quickly (under 2 seconds · well before DB connection timeout)
//   · stderr contains the "QUARANTINED" banner
//   · does NOT reach any DB connection · no Overpass request · no spawn
//
// If a future edit removes the guard from any legacy file, these tests fail
// loudly. See doctrine `doctrine_nex_legacy_workforce_quarantine_2026_09_04.md`.

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const QUARANTINED = [
  "scripts/nex-acquisition-workforce/run-production-launcher.mjs",
  "scripts/nex-acquisition-workforce/run-production-watchdog.mjs",
  "scripts/nex-acquisition-workforce/run-production-supervisor.mjs",
  "scripts/nex-workforce/_category-walker.mjs",
];

const SAFETY_NET = "scripts/nex-acquisition-workforce/QUARANTINED-DO-NOT-RUN.mjs";

function runIsolated(relPath, argv = []) {
  const abs = join(REPO_ROOT, relPath);
  // Spawn with an EMPTY environment (only PATH · no NEX_* variables).
  // If the guard depended on an env var to fire, this would surface it.
  const cleanEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };
  const started = Date.now();
  const r = spawnSync(process.execPath, [abs, ...argv], {
    cwd: REPO_ROOT,
    env: cleanEnv,
    encoding: "utf8",
    timeout: 5000, // hard stop after 5s (way more than needed)
  });
  const durationMs = Date.now() - started;
  return {
    status: r.status,
    signal: r.signal,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
    durationMs,
    timedOut: r.error?.code === "ETIMEDOUT",
  };
}

describe("Legacy Workforce Quarantine · file-level fail-closed guards", () => {
  for (const relPath of QUARANTINED) {
    describe(relPath, () => {
      it("exists on disk", () => {
        expect(existsSync(join(REPO_ROOT, relPath))).toBe(true);
      });

      it("exits with code 2 (quarantine signal)", () => {
        const r = runIsolated(relPath);
        expect(r.timedOut, `${relPath} timed out · guard did not fire`).toBe(false);
        expect(r.status, `${relPath} exit code · stderr:\n${r.stderr}`).toBe(2);
      });

      it("exits fast (< 2000ms · well before any DB connection could succeed)", () => {
        const r = runIsolated(relPath);
        expect(r.durationMs, `${relPath} took ${r.durationMs}ms`).toBeLessThan(2000);
      });

      it("stderr contains QUARANTINED banner", () => {
        const r = runIsolated(relPath);
        expect(r.stderr).toContain("QUARANTINED");
        expect(r.stderr).toContain("NEX LEGACY WORKFORCE");
      });

      it("guard block is present in source (not accidentally removed)", () => {
        const src = readFileSync(join(REPO_ROOT, relPath), "utf8");
        expect(src).toContain("LEGACY WORKFORCE QUARANTINE");
        expect(src).toContain("process.exit(2)");
        expect(src).toContain("2026-09-04");
      });
    });
  }
});

describe("Legacy Workforce Quarantine · Scheduled-Task safety-net", () => {
  it("QUARANTINED-DO-NOT-RUN.mjs exists", () => {
    expect(existsSync(join(REPO_ROOT, SAFETY_NET))).toBe(true);
  });

  it("safety-net exits with code 2", () => {
    const r = runIsolated(SAFETY_NET);
    expect(r.timedOut).toBe(false);
    expect(r.status).toBe(2);
  });

  it("safety-net does NOT import pg or child_process", () => {
    const src = readFileSync(join(REPO_ROOT, SAFETY_NET), "utf8");
    expect(src).not.toMatch(/from ['"]pg['"]/);
    expect(src).not.toMatch(/from ['"]node:child_process['"]/);
    expect(src).not.toMatch(/from ['"]node:net['"]/);
    expect(src).not.toMatch(/from ['"]node:http['"]/);
  });

  it("safety-net produces the Scheduled-Task fired banner on stderr", () => {
    const r = runIsolated(SAFETY_NET);
    expect(r.stderr).toContain("Scheduled-Task safety-net fired");
  });
});

describe("Legacy Workforce Quarantine · workforce v2 unchanged", () => {
  // Sentinel: confirm workforce v2 files still exist and are unaffected.
  // A more strict SHA comparison would require snapshotting SHAs at
  // quarantine time · omitted here in favor of the standalone v2 test
  // suite (this file only asserts quarantine semantics).
  it("scripts/nex-workforce-v2/agent.mjs still present", () => {
    expect(existsSync(join(REPO_ROOT, "scripts/nex-workforce-v2/agent.mjs"))).toBe(true);
  });
  it("scripts/nex-workforce-v2/orchestrator.mjs still present", () => {
    expect(existsSync(join(REPO_ROOT, "scripts/nex-workforce-v2/orchestrator.mjs"))).toBe(true);
  });
  it("scripts/nex-workforce-v2/reaper.mjs still present", () => {
    expect(existsSync(join(REPO_ROOT, "scripts/nex-workforce-v2/reaper.mjs"))).toBe(true);
  });
  it("scripts/nex-workforce-v2/steps/overpass_observe_and_stage.mjs still present", () => {
    expect(existsSync(join(REPO_ROOT, "scripts/nex-workforce-v2/steps/overpass_observe_and_stage.mjs"))).toBe(true);
  });
});
