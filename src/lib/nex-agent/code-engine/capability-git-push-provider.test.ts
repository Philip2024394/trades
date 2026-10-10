// src/lib/nex-agent/code-engine/capability-git-push-provider.test.ts
//
// Tests use real git binary against local file:// remotes (no network required).

import { describe, it, expect } from "vitest";
import { performGitPush, createGitProviderFunctions, GIT_PUSH_PROVIDER_VERSION } from "./capability-git-push-provider";
import path from "node:path";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

function initBareRemote(): string {
  const remote = mkdtempSync(path.join(tmpdir(), "nex1-git-remote-"));
  execFileSync("git", ["init", "-q", "--bare"], { cwd: remote });
  return remote;
}
function initLocal(): string {
  const local = mkdtempSync(path.join(tmpdir(), "nex1-git-local-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: local });
  execFileSync("git", ["config", "user.email", "test@test.local"], { cwd: local });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: local });
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: local });
  return local;
}

describe("git-push provider · real push against local bare remote", () => {
  describe("real push flow", () => {
    it("performs a real push and verifies remote SHA matches local HEAD", async () => {
      const remote = initBareRemote();
      const local = initLocal();
      try {
        writeFileSync(path.join(local, "a.txt"), "hello");
        execFileSync("git", ["remote", "add", "origin", remote], { cwd: local });

        const r = await performGitPush({
          project_root: local,
          remote_name: "origin",
          branch: "main",
          commit_message: "initial commit",
        });
        expect(r.ok).toBe(true);
        expect(r.push_verified).toBe(true);
        expect(r.attempted_sha).toBeTruthy();
        expect(r.remote_head_after).toBe(r.attempted_sha);
        expect(r.error_reason).toBeNull();
      } finally {
        rmSync(remote, { recursive: true, force: true });
        rmSync(local, { recursive: true, force: true });
      }
    }, 15000);

    it("second push with new commit updates remote HEAD", async () => {
      const remote = initBareRemote();
      const local = initLocal();
      try {
        writeFileSync(path.join(local, "a.txt"), "hello");
        execFileSync("git", ["remote", "add", "origin", remote], { cwd: local });

        const first = await performGitPush({
          project_root: local,
          branch: "main",
          commit_message: "first",
        });
        expect(first.push_verified).toBe(true);
        const firstSha = first.attempted_sha;

        writeFileSync(path.join(local, "b.txt"), "second");
        const second = await performGitPush({
          project_root: local,
          branch: "main",
          commit_message: "second",
        });
        expect(second.push_verified).toBe(true);
        expect(second.attempted_sha).not.toBe(firstSha);
        expect(second.remote_head_after).toBe(second.attempted_sha);
      } finally {
        rmSync(remote, { recursive: true, force: true });
        rmSync(local, { recursive: true, force: true });
      }
    }, 15000);
  });

  describe("anti-fabrication: push_verified requires observed remote match", () => {
    it("push_verified=false when remote is unreachable (real error)", async () => {
      const local = initLocal();
      try {
        writeFileSync(path.join(local, "a.txt"), "hello");
        execFileSync("git", ["remote", "add", "origin", "/definitely/no/such/remote/repo.git"], { cwd: local });

        const r = await performGitPush({
          project_root: local,
          branch: "main",
          commit_message: "hopeful",
        });
        expect(r.ok).toBe(false);
        expect(r.push_verified).toBe(false);
        expect(r.error_reason).toBeTruthy();
        expect(r.error_reason).toMatch(/repository_not_found|push_failed|network|permission|unexpected_error/);
      } finally {
        rmSync(local, { recursive: true, force: true });
      }
    }, 15000);
  });

  describe("provider functions integration", () => {
    it("probeConnection returns true when git is available", async () => {
      const fns = createGitProviderFunctions();
      const p = await fns.probeConnection();
      expect(p.connected).toBe(true);
      expect(p.authenticated).toBe(true);
    });

    it("getRemoteState against a local bare remote returns real refs", async () => {
      const remote = initBareRemote();
      const local = initLocal();
      try {
        writeFileSync(path.join(local, "a.txt"), "hello");
        execFileSync("git", ["remote", "add", "origin", remote], { cwd: local });
        execFileSync("git", ["add", "-A"], { cwd: local });
        execFileSync("git", ["commit", "-m", "init"], { cwd: local });
        execFileSync("git", ["push", "origin", "main"], { cwd: local });

        const fns = createGitProviderFunctions();
        const state = await fns.getRemoteState!(remote);
        expect(state.reachable).toBe(true);
        expect(state.head_sha).toBeTruthy();
      } finally {
        rmSync(remote, { recursive: true, force: true });
        rmSync(local, { recursive: true, force: true });
      }
    }, 15000);

    it("checkPushStatus returns matched=true when SHA is present on remote", async () => {
      const remote = initBareRemote();
      const local = initLocal();
      try {
        writeFileSync(path.join(local, "a.txt"), "hello");
        execFileSync("git", ["remote", "add", "origin", remote], { cwd: local });
        execFileSync("git", ["add", "-A"], { cwd: local });
        execFileSync("git", ["commit", "-m", "init"], { cwd: local });
        execFileSync("git", ["push", "origin", "main"], { cwd: local });
        const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: local, encoding: "utf8" }).trim();

        const fns = createGitProviderFunctions();
        const status = await fns.checkPushStatus!(remote, sha);
        expect(status.matched).toBe(true);
        expect(status.actual_sha).toBe(sha);
      } finally {
        rmSync(remote, { recursive: true, force: true });
        rmSync(local, { recursive: true, force: true });
      }
    }, 15000);
  });

  describe("invariants", () => {
    it("canonical version", () => {
      expect(GIT_PUSH_PROVIDER_VERSION).toBe("git-push-provider.v1.2026-09-19");
    });
    it("ok=false implies push_verified=false", async () => {
      const local = initLocal();
      try {
        writeFileSync(path.join(local, "a.txt"), "hello");
        execFileSync("git", ["remote", "add", "origin", "/no/such/path.git"], { cwd: local });
        const r = await performGitPush({
          project_root: local, branch: "main", commit_message: "nope",
        });
        expect(r.ok).toBe(false);
        expect(r.push_verified).toBe(false);
      } finally {
        rmSync(local, { recursive: true, force: true });
      }
    }, 15000);
  });
});
