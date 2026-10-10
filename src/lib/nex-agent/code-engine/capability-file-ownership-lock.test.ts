import { describe, it, expect } from "vitest";
import {
  claimFile,
  releaseFile,
  markComplete,
  reopen,
  shouldTwinProcess,
  twinCandidateFiles,
  loadFileLocks,
  projectLockHash,
  FILE_OWNERSHIP_LOCK_VERSION,
} from "./capability-file-ownership-lock";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

function tmp() {
  return {
    data_root: mkdtempSync(path.join(tmpdir(), "nex1-flock-")),
    project_id: "proj_A",
  };
}

describe("file ownership lock · founder new rule (never simultaneous · Twin skips completed)", () => {
  describe("basic claim/release", () => {
    it("NEX1 can claim an unclaimed file", () => {
      const opts = tmp();
      try {
        const r = claimFile("src/foo.ts", "NEX1", "sess_1", "editing return literal", opts);
        expect(r.ok).toBe(true);
        expect(r.state).toBe("CLAIMED");
        expect(r.claimed_by).toBe("NEX1");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("release returns file to UNCLAIMED", () => {
      const opts = tmp();
      try {
        claimFile("src/foo.ts", "NEX1", "sess_1", "editing", opts);
        const r = releaseFile("src/foo.ts", "NEX1", opts);
        expect(r.ok).toBe(true);
        expect(r.state).toBe("UNCLAIMED");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("same-agent re-claim is idempotent", () => {
      const opts = tmp();
      try {
        claimFile("src/foo.ts", "NEX1", "sess_1", "editing", opts);
        const r = claimFile("src/foo.ts", "NEX1", "sess_1", "still editing", opts);
        expect(r.ok).toBe(true);
        expect(r.state).toBe("CLAIMED");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("critical rule: NEX1 and Twin NEVER edit same file simultaneously", () => {
    it("Twin cannot claim while NEX1 holds the claim", () => {
      const opts = tmp();
      try {
        claimFile("src/Button.tsx", "NEX1", "sess_1", "adding prop", opts);
        const twinAttempt = claimFile("src/Button.tsx", "TwinNEX", "sess_1", "recovering", opts);
        expect(twinAttempt.ok).toBe(false);
        expect(twinAttempt.state).toBe("CLAIMED");
        expect(twinAttempt.claimed_by).toBe("NEX1");
        expect(twinAttempt.refusal_reason).toContain("already_claimed_by:NEX1");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("NEX1 cannot claim while Twin holds the claim", () => {
      const opts = tmp();
      try {
        claimFile("src/Button.tsx", "TwinNEX", "sess_1", "recovering", opts);
        const nex1Attempt = claimFile("src/Button.tsx", "NEX1", "sess_1", "editing", opts);
        expect(nex1Attempt.ok).toBe(false);
        expect(nex1Attempt.claimed_by).toBe("TwinNEX");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("after NEX1 releases, Twin CAN claim", () => {
      const opts = tmp();
      try {
        claimFile("src/Button.tsx", "NEX1", "sess_1", "editing", opts);
        releaseFile("src/Button.tsx", "NEX1", opts);
        const twinAttempt = claimFile("src/Button.tsx", "TwinNEX", "sess_1", "recovering", opts);
        expect(twinAttempt.ok).toBe(true);
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("critical rule: if NEX1 completed a file, Twin must not re-code it", () => {
    it("Twin cannot claim a file NEX1 has marked COMPLETED", () => {
      const opts = tmp();
      try {
        claimFile("src/Button.tsx", "NEX1", "sess_1", "editing", opts);
        markComplete("src/Button.tsx", "NEX1", opts);
        const twinAttempt = claimFile("src/Button.tsx", "TwinNEX", "sess_1", "recovering", opts);
        expect(twinAttempt.ok).toBe(false);
        expect(twinAttempt.state).toBe("COMPLETED");
        expect(twinAttempt.refusal_reason).toContain("already_completed_by:NEX1");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("shouldTwinProcess returns false when NEX1 has completed the file", () => {
      const opts = tmp();
      try {
        claimFile("src/Button.tsx", "NEX1", "sess_1", "editing", opts);
        markComplete("src/Button.tsx", "NEX1", opts);
        const r = shouldTwinProcess("src/Button.tsx", opts);
        expect(r.should_process).toBe(false);
        expect(r.current_state).toBe("COMPLETED");
        expect(r.current_owner).toBe("NEX1");
        expect(r.reason).toContain("Twin must not re-code");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("shouldTwinProcess returns false while NEX1 has the file claimed", () => {
      const opts = tmp();
      try {
        claimFile("src/Button.tsx", "NEX1", "sess_1", "editing", opts);
        const r = shouldTwinProcess("src/Button.tsx", opts);
        expect(r.should_process).toBe(false);
        expect(r.current_state).toBe("CLAIMED");
        expect(r.reason).toContain("must not edit simultaneously");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("shouldTwinProcess returns true when file is unclaimed", () => {
      const opts = tmp();
      try {
        const r = shouldTwinProcess("src/Fresh.tsx", opts);
        expect(r.should_process).toBe(true);
        expect(r.current_state).toBe("UNCLAIMED");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("Twin batch candidate filtering", () => {
    it("Twin gets a filtered list · skipping files NEX1 owns or has completed", () => {
      const opts = tmp();
      try {
        // NEX1 completes one file
        claimFile("src/A.tsx", "NEX1", "sess_1", "e", opts);
        markComplete("src/A.tsx", "NEX1", opts);
        // NEX1 currently editing another
        claimFile("src/B.tsx", "NEX1", "sess_1", "e", opts);
        // Twin already completed a third
        claimFile("src/C.tsx", "TwinNEX", "sess_1", "e", opts);
        markComplete("src/C.tsx", "TwinNEX", opts);
        // D is unclaimed

        const r = twinCandidateFiles(
          ["src/A.tsx", "src/B.tsx", "src/C.tsx", "src/D.tsx"],
          opts,
        );
        expect(r.available).toEqual(["src/D.tsx"]);
        expect(r.skipped_completed_by_nex1).toEqual(["src/A.tsx"]);
        expect(r.skipped_claimed_by_nex1).toEqual(["src/B.tsx"]);
        expect(r.skipped_completed_by_twin).toEqual(["src/C.tsx"]);
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("mark complete safety", () => {
    it("cannot markComplete a file another agent has claimed", () => {
      const opts = tmp();
      try {
        claimFile("src/foo.ts", "NEX1", "sess_1", "editing", opts);
        const twinTry = markComplete("src/foo.ts", "TwinNEX", opts);
        expect(twinTry.ok).toBe(false);
        expect(twinTry.refusal_reason).toContain("only_claimant_can_mark_complete");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("reopen (only for explicit reason)", () => {
    it("reopen returns COMPLETED file to UNCLAIMED", () => {
      const opts = tmp();
      try {
        claimFile("src/foo.ts", "NEX1", "sess_1", "e", opts);
        markComplete("src/foo.ts", "NEX1", opts);
        const r = reopen("src/foo.ts", "NEX1", "user requested change", opts);
        expect(r.ok).toBe(true);
        expect(r.state).toBe("UNCLAIMED");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });

    it("reopen refuses on non-completed files", () => {
      const opts = tmp();
      try {
        const r = reopen("src/nope.ts", "NEX1", "test", opts);
        expect(r.ok).toBe(false);
        expect(r.refusal_reason).toContain("not_completed");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("multi-project isolation", () => {
    it("locks in proj_A do not affect proj_B", () => {
      const optsA = tmp();
      const optsB = { data_root: optsA.data_root, project_id: "proj_B" };
      try {
        claimFile("src/foo.ts", "NEX1", "sess_1", "e", optsA);
        const bAttempt = claimFile("src/foo.ts", "NEX1", "sess_1", "e", optsB);
        expect(bAttempt.ok).toBe(true);  // different project · same path is OK
      } finally { rmSync(optsA.data_root, { recursive: true, force: true }); }
    });
  });

  describe("path normalisation", () => {
    it("backslash and forward slash paths refer to same file", () => {
      const opts = tmp();
      try {
        claimFile("src\\components\\Button.tsx", "NEX1", "sess_1", "e", opts);
        const r = shouldTwinProcess("src/components/Button.tsx", opts);
        expect(r.should_process).toBe(false);
        expect(r.current_state).toBe("CLAIMED");
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });

  describe("invariants", () => {
    it("canonical version", () => {
      expect(FILE_OWNERSHIP_LOCK_VERSION).toBe("file-ownership-lock.v1.2026-09-19");
    });
    it("projectLockHash is stable across identical state", () => {
      const opts = tmp();
      try {
        claimFile("a.ts", "NEX1", "sess_1", "e", opts);
        const h1 = projectLockHash(opts);
        const h2 = projectLockHash(opts);
        expect(h1.hash).toBe(h2.hash);
        expect(h1.file_count).toBe(1);
      } finally { rmSync(opts.data_root, { recursive: true, force: true }); }
    });
  });
});
