import { describe, it, expect, beforeEach } from "vitest";
import {
  buildOrUpdateIndex,
  invalidateFile,
  getIndex,
  resetIndex,
  _resetAllIndexesForTests,
  findFileBySymbol,
  findFilesByImport,
  INCREMENTAL_REPO_INDEX_VERSION,
} from "./capability-incremental-repo-index";
import path from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";

function makeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "nex1-repoidx-"));
  mkdirSync(path.join(root, "src"), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

beforeEach(() => _resetAllIndexesForTests());

describe("incremental repo index · §22-23", () => {
  describe("initial index build", () => {
    it("indexes all files under src/", () => {
      const root = makeRepo({
        "src/a.ts": "export const A = 1;",
        "src/b.ts": "export function B() {}",
      });
      try {
        const idx = buildOrUpdateIndex({ repo_root: root });
        expect(idx.total_files_indexed).toBe(2);
        expect(idx.files_by_path["src/a.ts"]).toBeTruthy();
        expect(idx.files_by_path["src/a.ts"].exports).toContain("A");
        expect(idx.files_by_path["src/b.ts"].exports).toContain("B");
      } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("skips node_modules/.git/etc", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-repoidx-skip-"));
      try {
        mkdirSync(path.join(root, "src"), { recursive: true });
        mkdirSync(path.join(root, "node_modules/x"), { recursive: true });
        writeFileSync(path.join(root, "src/a.ts"), "export const A = 1;");
        writeFileSync(path.join(root, "node_modules/x/y.ts"), "export const NOISE = 1;");
        const idx = buildOrUpdateIndex({ repo_root: root });
        expect(idx.total_files_indexed).toBe(1);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });
  });

  describe("incremental cache", () => {
    it("second build with no changes hits cache · zero re-reads", () => {
      const root = makeRepo({
        "src/a.ts": "export const A = 1;",
        "src/b.ts": "export const B = 1;",
      });
      try {
        buildOrUpdateIndex({ repo_root: root });
        const idx2 = buildOrUpdateIndex({ repo_root: root });
        expect(idx2.stats.cache_hits).toBeGreaterThanOrEqual(2);
        expect(idx2.stats.incremental_updates).toBe(1);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("changed file mtime triggers re-index of only that file", () => {
      const root = makeRepo({
        "src/a.ts": "export const A = 1;",
        "src/b.ts": "export const B = 1;",
      });
      try {
        buildOrUpdateIndex({ repo_root: root });
        // Modify a.ts · sleep briefly to ensure mtime changes on fast filesystems
        writeFileSync(path.join(root, "src/a.ts"), "export const A = 99; export const A2 = 2;");
        // Force mtime bump (some filesystems have 1s resolution)
        const future = new Date(Date.now() + 5000);
        utimesSync(path.join(root, "src/a.ts"), future, future);

        const idx = buildOrUpdateIndex({ repo_root: root });
        expect(idx.files_by_path["src/a.ts"].exports).toContain("A2");
        expect(idx.stats.files_invalidated).toBeGreaterThanOrEqual(1);
        // b.ts should still be a cache hit
        expect(idx.stats.cache_hits).toBeGreaterThanOrEqual(1);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("deleted files are removed from index", () => {
      const root = makeRepo({
        "src/a.ts": "export const A = 1;",
        "src/b.ts": "export const B = 1;",
      });
      try {
        buildOrUpdateIndex({ repo_root: root });
        rmSync(path.join(root, "src/b.ts"));
        const idx = buildOrUpdateIndex({ repo_root: root });
        expect(idx.files_by_path["src/b.ts"]).toBeUndefined();
        expect(idx.total_files_indexed).toBe(1);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("explicit invalidateFile forces re-read", () => {
      const root = makeRepo({ "src/a.ts": "export const A = 1;" });
      try {
        buildOrUpdateIndex({ repo_root: root });
        invalidateFile(root, "src/a.ts");
        const idx = buildOrUpdateIndex({ repo_root: root });
        expect(idx.stats.files_invalidated).toBeGreaterThanOrEqual(1);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("force_full_rescan re-reads everything", () => {
      const root = makeRepo({
        "src/a.ts": "export const A = 1;",
        "src/b.ts": "export const B = 1;",
      });
      try {
        buildOrUpdateIndex({ repo_root: root });
        const idx = buildOrUpdateIndex({ repo_root: root, force_full_rescan: true });
        expect(idx.stats.full_rescans).toBe(2);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });
  });

  describe("lookups", () => {
    it("findFileBySymbol", () => {
      const root = makeRepo({
        "src/a.ts": "export const Button = 1;",
        "src/b.ts": "export const Card = 1;",
      });
      try {
        buildOrUpdateIndex({ repo_root: root });
        expect(findFileBySymbol(root, "Button")).toEqual(["src/a.ts"]);
        expect(findFileBySymbol(root, "Card")).toEqual(["src/b.ts"]);
        expect(findFileBySymbol(root, "Nonexistent")).toEqual([]);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("findFilesByImport", () => {
      const root = makeRepo({
        "src/a.ts": `import { X } from "./b";`,
        "src/b.ts": `export const X = 1;`,
      });
      try {
        buildOrUpdateIndex({ repo_root: root });
        expect(findFilesByImport(root, "./b")).toEqual(["src/a.ts"]);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });
  });

  describe("invariants", () => {
    it("cache_hit_ratio is non-negative", () => {
      const root = makeRepo({ "src/a.ts": "export const A = 1;" });
      try {
        buildOrUpdateIndex({ repo_root: root });
        const idx = buildOrUpdateIndex({ repo_root: root });
        expect(idx.cache_hit_ratio).toBeGreaterThanOrEqual(0);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("canonical version", () => {
      expect(INCREMENTAL_REPO_INDEX_VERSION).toBe("incremental-repo-index.v1.2026-09-19");
    });
  });
});
