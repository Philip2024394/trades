import { describe, it, expect } from "vitest";
import {
  snapshotWorkspace,
  promoteFilesFromTwinWorkspace,
  digestFile,
  digestWorkspace,
  TWIN_WORKSPACE_VERSION,
} from "./capability-twin-workspace";
import path from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

function makeNex1Workspace(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "nex1-nex1ws-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

describe("Twin isolated workspace · §20 invariant", () => {
  describe("snapshot", () => {
    it("copies files from NEX1 workspace to isolated Twin workspace", () => {
      const nex1 = makeNex1Workspace({
        "src/a.ts": "// file a",
        "src/b.ts": "// file b",
        "package.json": "{}",
      });
      const twinsRoot = mkdtempSync(path.join(tmpdir(), "nex1-twinws-"));
      try {
        const snap = snapshotWorkspace({
          project_id: "proj_A",
          nex1_workspace_root: nex1,
          twin_workspaces_root: twinsRoot,
        });
        expect(snap.files_copied).toBe(3);
        expect(existsSync(path.join(snap.twin_workspace_root, "src/a.ts"))).toBe(true);
        expect(existsSync(path.join(snap.twin_workspace_root, "src/b.ts"))).toBe(true);
        expect(existsSync(path.join(snap.twin_workspace_root, "package.json"))).toBe(true);
      } finally {
        rmSync(nex1, { recursive: true, force: true });
        rmSync(twinsRoot, { recursive: true, force: true });
      }
    });

    it("skips node_modules / .next / dist / .git / etc", () => {
      const nex1 = makeNex1Workspace({
        "src/a.ts": "// a",
        "node_modules/pkg/index.js": "// noise",
        ".next/cache/x": "// cache",
        ".git/config": "// git",
      });
      const twinsRoot = mkdtempSync(path.join(tmpdir(), "nex1-twinws-"));
      try {
        const snap = snapshotWorkspace({
          project_id: "proj_A",
          nex1_workspace_root: nex1,
          twin_workspaces_root: twinsRoot,
        });
        expect(existsSync(path.join(snap.twin_workspace_root, "src/a.ts"))).toBe(true);
        expect(existsSync(path.join(snap.twin_workspace_root, "node_modules"))).toBe(false);
        expect(existsSync(path.join(snap.twin_workspace_root, ".next"))).toBe(false);
        expect(existsSync(path.join(snap.twin_workspace_root, ".git"))).toBe(false);
      } finally {
        rmSync(nex1, { recursive: true, force: true });
        rmSync(twinsRoot, { recursive: true, force: true });
      }
    });
  });

  describe("isolation invariant (§20)", () => {
    it("Twin modifications to the isolated workspace do NOT leak to NEX1 workspace", () => {
      const nex1 = makeNex1Workspace({ "src/a.ts": "// original" });
      const twinsRoot = mkdtempSync(path.join(tmpdir(), "nex1-twinws-"));
      try {
        const nex1Before = digestFile(path.join(nex1, "src/a.ts"));
        const snap = snapshotWorkspace({
          project_id: "proj_A",
          nex1_workspace_root: nex1,
          twin_workspaces_root: twinsRoot,
        });
        // Twin modifies the isolated copy
        writeFileSync(path.join(snap.twin_workspace_root, "src/a.ts"), "// modified by Twin");
        // NEX1 workspace must be unchanged
        const nex1After = digestFile(path.join(nex1, "src/a.ts"));
        expect(nex1After.digest).toBe(nex1Before.digest);
        expect(readFileSync(path.join(nex1, "src/a.ts"), "utf8")).toBe("// original");
      } finally {
        rmSync(nex1, { recursive: true, force: true });
        rmSync(twinsRoot, { recursive: true, force: true });
      }
    });
  });

  describe("promote (verified repair candidates only)", () => {
    it("promoteFilesFromTwinWorkspace copies only the named files back", () => {
      const nex1 = makeNex1Workspace({
        "src/a.ts": "// original a",
        "src/b.ts": "// original b",
      });
      const twinsRoot = mkdtempSync(path.join(tmpdir(), "nex1-twinws-"));
      try {
        const snap = snapshotWorkspace({
          project_id: "proj_A",
          nex1_workspace_root: nex1,
          twin_workspaces_root: twinsRoot,
        });
        // Twin modifies both files
        writeFileSync(path.join(snap.twin_workspace_root, "src/a.ts"), "// repaired a");
        writeFileSync(path.join(snap.twin_workspace_root, "src/b.ts"), "// repaired b");
        // Promote only a.ts
        const r = promoteFilesFromTwinWorkspace({
          twin_workspace_root: snap.twin_workspace_root,
          nex1_workspace_root: nex1,
          files_to_promote: ["src/a.ts"],
          promoted_by_agent: "Referee",
          promotion_reason: "verified repair",
        });
        expect(r.ok).toBe(true);
        expect(r.files_promoted).toEqual(["src/a.ts"]);
        // a.ts changed · b.ts unchanged
        expect(readFileSync(path.join(nex1, "src/a.ts"), "utf8")).toBe("// repaired a");
        expect(readFileSync(path.join(nex1, "src/b.ts"), "utf8")).toBe("// original b");
      } finally {
        rmSync(nex1, { recursive: true, force: true });
        rmSync(twinsRoot, { recursive: true, force: true });
      }
    });

    it("promote refuses files not present in twin workspace", () => {
      const nex1 = makeNex1Workspace({ "src/a.ts": "// a" });
      const twinsRoot = mkdtempSync(path.join(tmpdir(), "nex1-twinws-"));
      try {
        const snap = snapshotWorkspace({
          project_id: "proj_A",
          nex1_workspace_root: nex1,
          twin_workspaces_root: twinsRoot,
        });
        const r = promoteFilesFromTwinWorkspace({
          twin_workspace_root: snap.twin_workspace_root,
          nex1_workspace_root: nex1,
          files_to_promote: ["src/nonexistent.ts"],
          promoted_by_agent: "Referee",
          promotion_reason: "test",
        });
        expect(r.ok).toBe(false);
        expect(r.files_refused[0]?.reason).toBe("not_in_twin_workspace");
      } finally {
        rmSync(nex1, { recursive: true, force: true });
        rmSync(twinsRoot, { recursive: true, force: true });
      }
    });

    it("promotion manifest is written for audit", () => {
      const nex1 = makeNex1Workspace({ "src/a.ts": "// a" });
      const twinsRoot = mkdtempSync(path.join(tmpdir(), "nex1-twinws-"));
      try {
        const snap = snapshotWorkspace({
          project_id: "proj_A",
          nex1_workspace_root: nex1,
          twin_workspaces_root: twinsRoot,
        });
        writeFileSync(path.join(snap.twin_workspace_root, "src/a.ts"), "// repaired");
        const r = promoteFilesFromTwinWorkspace({
          twin_workspace_root: snap.twin_workspace_root,
          nex1_workspace_root: nex1,
          files_to_promote: ["src/a.ts"],
          promoted_by_agent: "Referee",
          promotion_reason: "verified after regression pass",
        });
        expect(existsSync(r.promotion_manifest_path)).toBe(true);
        const manifest = JSON.parse(readFileSync(r.promotion_manifest_path, "utf8"));
        expect(manifest.promoted_by_agent).toBe("Referee");
        expect(manifest.files_promoted).toEqual(["src/a.ts"]);
      } finally {
        rmSync(nex1, { recursive: true, force: true });
        rmSync(twinsRoot, { recursive: true, force: true });
      }
    });
  });

  describe("digest helpers", () => {
    it("digestWorkspace returns per-file digests", () => {
      const nex1 = makeNex1Workspace({
        "src/a.ts": "// a",
        "src/b.ts": "// b",
      });
      try {
        const d = digestWorkspace(nex1);
        expect(d.total_files).toBe(2);
        expect(d.file_digests["src/a.ts"]).toBeTruthy();
        expect(d.file_digests["src/b.ts"]).toBeTruthy();
      } finally { rmSync(nex1, { recursive: true, force: true }); }
    });
  });

  describe("invariants", () => {
    it("canonical version", () => {
      expect(TWIN_WORKSPACE_VERSION).toBe("twin-workspace.v1.2026-09-19");
    });
  });
});
