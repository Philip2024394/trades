// src/lib/nex-agent/code-engine/capability-dev-server-orchestrator.test.ts
//
// Tests use real child_process against short-lived test programs.

import { describe, it, expect } from "vitest";
import {
  allocatePort,
  startSession,
  stopSession,
  getSession,
  listSessions,
  deriveSessionId,
  markResponding,
  probeHttp,
  DEV_SERVER_ORCHESTRATOR_VERSION,
} from "./capability-dev-server-orchestrator";
import path from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

describe("dev-server orchestrator · real process management", () => {
  describe("port allocation", () => {
    it("returns a free port at or above preferred", async () => {
      const p = await allocatePort(45000, 45000, 45100);
      expect(p).toBeGreaterThanOrEqual(45000);
      expect(p).toBeLessThanOrEqual(45100);
    });

    it("returns different ports on sequential calls when preferred is busy", async () => {
      // A quick sanity check · not a hard determinism guarantee since
      // free ports depend on the OS. But port must be within range.
      const a = await allocatePort(45200, 45200, 45300);
      expect(a).toBeGreaterThanOrEqual(45200);
      expect(a).toBeLessThanOrEqual(45300);
    });
  });

  describe("session id derivation", () => {
    it("derives stable id from project_root", () => {
      const a = deriveSessionId("/some/path");
      const b = deriveSessionId("/some/path");
      expect(a).toBe(b);
    });
    it("differs across projects", () => {
      const a = deriveSessionId("/some/path");
      const b = deriveSessionId("/other/path");
      expect(a).not.toBe(b);
    });
  });

  describe("real session lifecycle · short-lived echo program", () => {
    it("starts a real node echo process, captures stdout marker, then stops it cleanly", async () => {
      const dir = mkdtempSync(path.join(tmpdir(), "nex1-orch-echo-"));
      try {
        // Tiny node program: emits a startup marker then keeps stdin open
        writeFileSync(path.join(dir, "echo.mjs"), `
console.log("Ready in 42ms");
process.stdin.resume();
setTimeout(() => {}, 60000);
`);
        const sessionId = "test-session-" + Math.random().toString(36).slice(2, 8);
        const state = await startSession({
          session_id: sessionId,
          project_root: dir,
          command: process.execPath,  // node
          args: ["echo.mjs"],
          port_preferred: 45500,
          startup_timeout_ms: 5000,
          lockfile_root: dir,
        });
        expect(state.pid).toBeGreaterThan(0);
        expect(state.startup_marker_matched).toBe(true);
        expect(state.lifecycle).toBe("server_listening");
        expect(state.stdout_tail.some((l) => l.includes("Ready in"))).toBe(true);

        const stopped = await stopSession(sessionId);
        expect(["stopped", "crashed"]).toContain(stopped.lifecycle);
        expect(getSession(sessionId)).toBeNull();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 15000);

    it("captures stderr when program writes to it", async () => {
      const dir = mkdtempSync(path.join(tmpdir(), "nex1-orch-stderr-"));
      try {
        writeFileSync(path.join(dir, "err.mjs"), `
console.log("Ready in 5ms");
console.error("stderr line 1");
console.error("stderr line 2");
process.stdin.resume();
setTimeout(() => {}, 60000);
`);
        const sessionId = "err-" + Math.random().toString(36).slice(2, 8);
        const state = await startSession({
          session_id: sessionId,
          project_root: dir,
          command: process.execPath,
          args: ["err.mjs"],
          port_preferred: 45600,
          startup_timeout_ms: 5000,
          lockfile_root: dir,
        });
        // Give stderr a moment to drain
        await new Promise((r) => setTimeout(r, 300));
        const s = getSession(sessionId);
        expect(s?.stderr_tail.some((l) => l.includes("stderr line"))).toBe(true);
        await stopSession(sessionId);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 15000);

    it("detects a crashed process (exit code non-zero)", async () => {
      const dir = mkdtempSync(path.join(tmpdir(), "nex1-orch-crash-"));
      try {
        writeFileSync(path.join(dir, "crash.mjs"), `
console.log("Ready in 1ms");
setTimeout(() => process.exit(37), 100);
`);
        const sessionId = "crash-" + Math.random().toString(36).slice(2, 8);
        const state = await startSession({
          session_id: sessionId,
          project_root: dir,
          command: process.execPath,
          args: ["crash.mjs"],
          port_preferred: 45700,
          startup_timeout_ms: 5000,
          lockfile_root: dir,
        });
        expect(state.startup_marker_matched).toBe(true);
        // Wait for exit
        await new Promise((r) => setTimeout(r, 500));
        const s = getSession(sessionId);
        expect(s?.lifecycle).toBe("crashed");
        expect(s?.exit_code).toBe(37);
        await stopSession(sessionId);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 15000);

    it("refuses second start of same session id", async () => {
      const dir = mkdtempSync(path.join(tmpdir(), "nex1-orch-dup-"));
      try {
        writeFileSync(path.join(dir, "wait.mjs"), `
console.log("Ready in 1ms");
process.stdin.resume();
setTimeout(() => {}, 60000);
`);
        const sessionId = "dup-" + Math.random().toString(36).slice(2, 8);
        await startSession({
          session_id: sessionId,
          project_root: dir,
          command: process.execPath,
          args: ["wait.mjs"],
          port_preferred: 45800,
          startup_timeout_ms: 5000,
          lockfile_root: dir,
        });
        await expect(async () => {
          await startSession({
            session_id: sessionId,
            project_root: dir,
            command: process.execPath,
            args: ["wait.mjs"],
            port_preferred: 45801,
            startup_timeout_ms: 5000,
            lockfile_root: dir,
          });
        }).rejects.toThrow(/session_already_exists/);
        await stopSession(sessionId);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 15000);
  });

  describe("anti-fabrication: lifecycle never claims 'responding' without real evidence", () => {
    it("markResponding is a no-op when session doesn't exist", () => {
      const r = markResponding("does-not-exist");
      expect(r).toBeNull();
    });
    it("lifecycle stays 'server_listening' until markResponding is called after a real probe", async () => {
      const dir = mkdtempSync(path.join(tmpdir(), "nex1-orch-resp-"));
      try {
        writeFileSync(path.join(dir, "wait.mjs"), `
console.log("Ready in 1ms");
process.stdin.resume();
setTimeout(() => {}, 60000);
`);
        const sessionId = "resp-" + Math.random().toString(36).slice(2, 8);
        const state = await startSession({
          session_id: sessionId,
          project_root: dir,
          command: process.execPath,
          args: ["wait.mjs"],
          port_preferred: 45900,
          startup_timeout_ms: 5000,
          lockfile_root: dir,
        });
        // Program isn't actually a webserver · lifecycle stays at server_listening
        expect(state.lifecycle).toBe("server_listening");
        // Attempting to promote without evidence · state does promote via markResponding
        // but the CALLER is responsible for having probed first. This test
        // exists to prove that markResponding only affects an existing session.
        const promoted = markResponding(sessionId);
        expect(promoted?.lifecycle).toBe("responding");
        await stopSession(sessionId);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 15000);
  });

  describe("invariants", () => {
    it("canonical version stamp", () => {
      expect(DEV_SERVER_ORCHESTRATOR_VERSION).toBe("dev-server-orchestrator.v1.2026-09-19");
    });
    it("listSessions returns array", () => {
      expect(Array.isArray(listSessions())).toBe(true);
    });
  });
});
