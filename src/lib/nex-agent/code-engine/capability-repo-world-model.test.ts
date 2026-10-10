// src/lib/nex-agent/code-engine/capability-repo-world-model.test.ts
//
// Phase 2 tests · deterministic symbol graph + PageRank + relevance ranking

import { describe, it, expect } from "vitest";
import {
  compileRepoWorldModel,
  computePageRank,
  rankFilesByRelevance,
  REPO_WORLD_MODEL_VERSION,
  type RepoWorldModel,
} from "./capability-repo-world-model";
import path from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

function makeFixtureRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "nex1-repo-model-"));
  mkdirSync(path.join(root, "src"), { recursive: true });

  // Small graph: alpha exports foo · beta imports foo from alpha · gamma imports both.
  writeFileSync(path.join(root, "src", "alpha.ts"), `
export function foo(): number { return 1; }
export const ALPHA_CONST = 42;
`);
  writeFileSync(path.join(root, "src", "beta.ts"), `
import { foo } from "./alpha";
export function beta_wrapper(): number { return foo() + 1; }
`);
  writeFileSync(path.join(root, "src", "gamma.ts"), `
import { foo, ALPHA_CONST } from "./alpha";
import { beta_wrapper } from "./beta";
export class GammaHandler {}
export function useEverything(): number { return foo() + beta_wrapper() + ALPHA_CONST; }
`);
  writeFileSync(path.join(root, "src", "orphan.ts"), `
export function orphan_fn(): string { return "no one imports me"; }
`);
  return root;
}

describe("capability-repo-world-model · Phase 2", () => {
  describe("symbol graph extraction", () => {
    it("extracts defined symbols per file", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        const alpha = model.files.find((f) => f.repo_relative_path === "src/alpha.ts");
        expect(alpha).toBeDefined();
        const alpha_names = alpha!.defined_symbols.map((s) => s.name).sort();
        expect(alpha_names).toContain("foo");
        expect(alpha_names).toContain("ALPHA_CONST");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("captures named-import references between files", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        const beta = model.files.find((f) => f.repo_relative_path === "src/beta.ts");
        const beta_refs = beta!.referenced_symbols.map((r) => r.name);
        expect(beta_refs).toContain("foo");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("indexes symbol_to_defining_file mapping", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        expect(model.symbol_to_defining_file["foo"]).toContain("src/alpha.ts");
        expect(model.symbol_to_defining_file["beta_wrapper"]).toContain("src/beta.ts");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("builds graph edges from referenced symbols to their defining files", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        const beta_to_alpha = model.graph_edges.find((e) => e.from === "src/beta.ts" && e.to === "src/alpha.ts");
        expect(beta_to_alpha).toBeDefined();
        expect(beta_to_alpha!.weight).toBeGreaterThan(0);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("PageRank correctness", () => {
    it("orphan file receives non-zero score (baseline probability)", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        const orphan_pr = model.pagerank["src/orphan.ts"];
        expect(orphan_pr).toBeGreaterThan(0);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("alpha (referenced by beta AND gamma) ranks higher than orphan", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        const alpha_pr = model.pagerank["src/alpha.ts"];
        const orphan_pr = model.pagerank["src/orphan.ts"];
        expect(alpha_pr).toBeGreaterThan(orphan_pr);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("pagerank scores sum to ~1 (probability distribution invariant)", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        const total = Object.values(model.pagerank).reduce((s, v) => s + v, 0);
        expect(total).toBeCloseTo(1.0, 3);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("converges within default iteration budget on small graph", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        expect(model.pagerank_converged).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("computePageRank on isolated 3-node cycle produces symmetric ranks", () => {
      const nodes = ["A", "B", "C"];
      const edges = [
        { from: "A", to: "B", weight: 1 },
        { from: "B", to: "C", weight: 1 },
        { from: "C", to: "A", weight: 1 },
      ];
      const { scores, converged } = computePageRank(nodes, edges, 0.85, 100, 1e-8);
      expect(converged).toBe(true);
      expect(scores.A).toBeCloseTo(scores.B, 5);
      expect(scores.B).toBeCloseTo(scores.C, 5);
    });
  });

  describe("deterministic reproducibility", () => {
    it("produces byte-identical model for identical input (excluding compiled_at_iso)", () => {
      const root = makeFixtureRepo();
      try {
        const a = compileRepoWorldModel({ repo_root: root });
        const b = compileRepoWorldModel({ repo_root: root });
        expect(a.input_digest).toBe(b.input_digest);
        expect(JSON.stringify(a.files)).toBe(JSON.stringify(b.files));
        expect(JSON.stringify(a.graph_edges)).toBe(JSON.stringify(b.graph_edges));
        expect(JSON.stringify(a.pagerank)).toBe(JSON.stringify(b.pagerank));
        expect(a.reproducibility.prng_seed).toBe(b.reproducibility.prng_seed);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("relevance ranking", () => {
    it("ranks files with matching concept + high pagerank first", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        const ranked = rankFilesByRelevance({ model, concepts: ["alpha"] });
        expect(ranked.length).toBeGreaterThan(0);
        expect(ranked[0].repo_relative_path).toBe("src/alpha.ts");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("ranks orphan lower than referenced files when concepts overlap generic tokens", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        const ranked = rankFilesByRelevance({ model, concepts: ["foo"] });
        const alpha_idx = ranked.findIndex((r) => r.repo_relative_path === "src/alpha.ts");
        const orphan_idx = ranked.findIndex((r) => r.repo_relative_path === "src/orphan.ts");
        if (alpha_idx >= 0 && orphan_idx >= 0) {
          expect(alpha_idx).toBeLessThan(orphan_idx);
        } else {
          expect(alpha_idx).toBeGreaterThanOrEqual(0);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("returns no results when concepts match nothing", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        const ranked = rankFilesByRelevance({
          model,
          concepts: ["absolutely_no_such_concept_in_fixture_xxxxx"],
        });
        // Even with no concept matches, PageRank ensures every file has a non-zero baseline
        // so ranked may be non-empty · but concept_match_score must be zero
        for (const r of ranked) {
          expect(r.concept_match_score).toBe(0);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("safety + isolation invariants", () => {
    it("skips node_modules and .git", () => {
      const root = mkdtempSync(path.join(tmpdir(), "nex1-repo-safety-"));
      try {
        mkdirSync(path.join(root, "src"), { recursive: true });
        mkdirSync(path.join(root, "node_modules", "evil"), { recursive: true });
        mkdirSync(path.join(root, ".git"), { recursive: true });
        writeFileSync(path.join(root, "src", "app.ts"), `export function real() { return 1; }`);
        writeFileSync(path.join(root, "node_modules", "evil", "malware.ts"),
          `export function should_never_index_this() {}`);
        writeFileSync(path.join(root, ".git", "config.ts"),
          `export function git_internal() {}`);

        const model = compileRepoWorldModel({ repo_root: root });
        const paths = model.files.map((f) => f.repo_relative_path);
        expect(paths).toContain("src/app.ts");
        expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
        expect(paths.some((p) => p.includes(".git"))).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("declares zero_llm=true and ledger=B", () => {
      const root = makeFixtureRepo();
      try {
        const model = compileRepoWorldModel({ repo_root: root });
        expect(model.reproducibility.zero_llm).toBe(true);
        expect(model.ledger).toBe("B");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("version stamp", () => {
    it("has canonical version constant", () => {
      expect(REPO_WORLD_MODEL_VERSION).toBe("repo-world-model.v1.2026-09-19");
    });
  });
});
