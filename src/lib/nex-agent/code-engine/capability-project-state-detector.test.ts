// src/lib/nex-agent/code-engine/capability-project-state-detector.test.ts
//
// Founder §19: never infer PUSH_SUCCEEDED from commit success.
// Tests must prove this with a real temp git repository.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  assessProjectState,
  PROJECT_STATE_DETECTOR_VERSION,
} from "./capability-project-state-detector";
import path from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

function initRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "nex1-pstate-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@test.local"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: root });
  return root;
}
function commit(root: string, file: string, content: string, msg: string) {
  writeFileSync(path.join(root, file), content);
  execFileSync("git", ["add", file], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", msg], { cwd: root });
}
function head(root: string): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

describe("project state detector · 11 evidence-based states", () => {
  describe("NOT_A_REPOSITORY", () => {
    it("returns NOT_A_REPOSITORY when path does not exist", () => {
      const r = assessProjectState({ project_root: "/definitely/not/a/real/path/xxxx" });
      expect(r.state).toBe("NOT_A_REPOSITORY");
      expect(r.caller_may_close_silently).toBe(true);
    });
    it("returns NOT_A_REPOSITORY for non-git folder", () => {
      const dir = mkdtempSync(path.join(tmpdir(), "nex1-pstate-notgit-"));
      try {
        const r = assessProjectState({ project_root: dir });
        expect(r.state).toBe("NOT_A_REPOSITORY");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("LOCAL_CLEAN vs LOCAL_COMMITTED", () => {
    it("emits LOCAL_COMMITTED when repo has a commit and no changes but no upstream configured", () => {
      // Per §19: commit success ≠ push success · a repo with commits and no
      // remote is LOCAL_COMMITTED, not LOCAL_CLEAN. The user should be told.
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        const r = assessProjectState({ project_root: root });
        expect(r.state).toBe("LOCAL_COMMITTED");
        expect(r.counts.modified).toBe(0);
        expect(r.counts.untracked).toBe(0);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("LOCAL_UNTRACKED", () => {
    it("emits when only untracked files exist", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        writeFileSync(path.join(root, "new.txt"), "new file");
        const r = assessProjectState({ project_root: root });
        expect(r.state).toBe("LOCAL_UNTRACKED");
        expect(r.counts.untracked).toBe(1);
        expect(r.caller_should_prompt).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("LOCAL_MODIFIED", () => {
    it("emits when tracked files are modified", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        writeFileSync(path.join(root, "a.txt"), "hello world");
        const r = assessProjectState({ project_root: root });
        expect(r.state).toBe("LOCAL_MODIFIED");
        expect(r.counts.modified).toBe(1);
        expect(r.caller_should_prompt).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
    it("emits with ambiguity flag when both modified and untracked present", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        writeFileSync(path.join(root, "a.txt"), "hello world");
        writeFileSync(path.join(root, "b.txt"), "new");
        const r = assessProjectState({ project_root: root });
        expect(r.state).toBe("LOCAL_MODIFIED");
        expect(r.ambiguity_flags).toContain("both_modified_and_untracked");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("LOCAL_COMMITTED (no upstream)", () => {
    it("emits when commits exist but no remote is configured", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        const r = assessProjectState({ project_root: root });
        // No remote configured · state is LOCAL_CLEAN with no_remote_evidence ambiguity,
        // OR LOCAL_COMMITTED if we consider "commits present without upstream" as its own state.
        // Our detector uses LOCAL_COMMITTED for exactly that shape.
        expect(["LOCAL_COMMITTED", "LOCAL_CLEAN"]).toContain(r.state);
        expect(r.refs.remote_tracking_branch).toBeNull();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("PUSH_FAILED", () => {
    it("emits PUSH_FAILED when caller supplies failed push attempt evidence", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        const r = assessProjectState({
          project_root: root,
          last_push_attempt: {
            attempted_at_iso: new Date().toISOString(),
            outcome: "failed",
            error_reason: "network_error",
          },
        });
        expect(r.state).toBe("PUSH_FAILED");
        expect(r.caller_should_prompt).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("PUSH_SUCCEEDED anti-fabrication invariant (founder §19)", () => {
    it("DOES NOT emit PUSH_SUCCEEDED merely because commit succeeded", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        const r = assessProjectState({ project_root: root });
        expect(r.state).not.toBe("PUSH_SUCCEEDED");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("DOES NOT emit PUSH_SUCCEEDED without concrete push-attempt evidence", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        const r = assessProjectState({
          project_root: root,
          // Deliberately no last_push_attempt supplied
        });
        expect(r.state).not.toBe("PUSH_SUCCEEDED");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("DOES NOT emit PUSH_SUCCEEDED when last_push_attempt.outcome is 'success' but SHA doesn't match current HEAD", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        const oldSha = head(root);
        commit(root, "a.txt", "hello 2", "second");  // HEAD now different
        const r = assessProjectState({
          project_root: root,
          last_push_attempt: {
            attempted_at_iso: new Date().toISOString(),
            outcome: "success",
            attempted_sha: oldSha,  // stale
          },
        });
        // Push was for an old SHA · current HEAD is different · so PUSH_SUCCEEDED
        // must not apply to the current state.
        expect(r.state).not.toBe("PUSH_SUCCEEDED");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("caller_should_prompt vs caller_may_close_silently", () => {
    it("caller_should_prompt=true for LOCAL_MODIFIED", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        writeFileSync(path.join(root, "a.txt"), "modified");
        const r = assessProjectState({ project_root: root });
        expect(r.caller_should_prompt).toBe(true);
        expect(r.caller_may_close_silently).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("caller_should_prompt=true when commits exist without upstream (user should know)", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        const r = assessProjectState({ project_root: root });
        // Commits without a remote should prompt the user · they may want to
        // set up a remote before closing. Per §22 close-with-saved-local flow.
        expect(r.state).toBe("LOCAL_COMMITTED");
        expect(r.caller_should_prompt).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("determinism + invariants", () => {
    it("produces identical assessment for identical repo state", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        const a = assessProjectState({ project_root: root });
        const b = assessProjectState({ project_root: root });
        expect(a.state).toBe(b.state);
        expect(a.counts).toEqual(b.counts);
        expect(a.refs.local_head_sha).toBe(b.refs.local_head_sha);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("declares zero_llm=true and ledger=B", () => {
      const root = initRepo();
      try {
        commit(root, "a.txt", "hello", "first");
        const r = assessProjectState({ project_root: root });
        expect(r.zero_llm).toBe(true);
        expect(r.ledger).toBe("B");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("stamps canonical version", () => {
      expect(PROJECT_STATE_DETECTOR_VERSION).toBe("project-state-detector.v1.2026-09-19");
    });
  });
});
