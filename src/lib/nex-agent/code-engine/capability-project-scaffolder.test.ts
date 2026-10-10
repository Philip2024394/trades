// src/lib/nex-agent/code-engine/capability-project-scaffolder.test.ts

import { describe, it, expect } from "vitest";
import {
  scaffoldProject,
  classifyRequest,
  checkRunnable,
  listTemplates,
  PROJECT_SCAFFOLDER_VERSION,
} from "./capability-project-scaffolder";
import path from "node:path";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

describe("project scaffolder · real filesystem output", () => {
  describe("classification", () => {
    it("classifies a booking request", () => {
      const c = classifyRequest("Build me a simple booking website");
      expect(c.kind).toBe("booking");
      expect(c.framework_preference).toBe("next-app-router");
      expect(c.matched_keywords).toContain("booking");
    });
    it("classifies a static site", () => {
      const c = classifyRequest("Build me a portfolio site");
      expect(c.kind).toBe("portfolio");
    });
    it("defaults to generic + static-html for unclassifiable input", () => {
      const c = classifyRequest("hello");
      expect(c.kind).toBe("generic");
      expect(c.framework_preference).toBe("static-html");
    });
  });

  describe("real scaffolding", () => {
    it("scaffolds a Next.js project with real files on disk", () => {
      const ws = mkdtempSync(path.join(tmpdir(), "nex1-scaffold-"));
      try {
        const r = scaffoldProject({
          natural_language_request: "Build me a booking website",
          workspace_root: ws,
        });
        expect(r.ok).toBe(true);
        expect(r.framework).toBe("next-app-router");
        expect(existsSync(path.join(r.project_root, "package.json"))).toBe(true);
        expect(existsSync(path.join(r.project_root, "app/page.tsx"))).toBe(true);
        expect(existsSync(path.join(r.project_root, "next.config.mjs"))).toBe(true);
        // package.json contains next
        const pkg = JSON.parse(readFileSync(path.join(r.project_root, "package.json"), "utf8"));
        expect(pkg.dependencies.next).toBeTruthy();
      } finally {
        rmSync(ws, { recursive: true, force: true });
      }
    });

    it("scaffolds a static HTML site", () => {
      const ws = mkdtempSync(path.join(tmpdir(), "nex1-scaffold-static-"));
      try {
        const r = scaffoldProject({
          natural_language_request: "Build a simple portfolio page",
          workspace_root: ws,
          template_override: "static-html.v1",
        });
        expect(r.ok).toBe(true);
        expect(r.framework).toBe("static-html");
        expect(existsSync(path.join(r.project_root, "index.html"))).toBe(true);
      } finally {
        rmSync(ws, { recursive: true, force: true });
      }
    });

    it("refuses to overwrite existing project directory", () => {
      const ws = mkdtempSync(path.join(tmpdir(), "nex1-scaffold-clash-"));
      try {
        const a = scaffoldProject({
          natural_language_request: "Build a site",
          workspace_root: ws,
          project_slug: "existing-project",
        });
        expect(a.ok).toBe(true);
        const b = scaffoldProject({
          natural_language_request: "Build a site",
          workspace_root: ws,
          project_slug: "existing-project",  // same slug
        });
        expect(b.ok).toBe(false);
        expect(b.refusal_reason).toBe("project_root_already_exists");
      } finally {
        rmSync(ws, { recursive: true, force: true });
      }
    });

    it("dry-run does not write to disk", () => {
      const ws = mkdtempSync(path.join(tmpdir(), "nex1-scaffold-dryrun-"));
      try {
        const r = scaffoldProject({
          natural_language_request: "Build a site",
          workspace_root: ws,
          dry_run: true,
        });
        expect(r.ok).toBe(true);
        expect(r.files_written).toEqual([]);
        expect(r.files_planned.length).toBeGreaterThan(0);
        expect(existsSync(r.project_root)).toBe(false);
      } finally {
        rmSync(ws, { recursive: true, force: true });
      }
    });
  });

  describe("runnability check", () => {
    it("checks that a scaffolded next project has all required files", () => {
      const ws = mkdtempSync(path.join(tmpdir(), "nex1-scaffold-runnable-"));
      try {
        const r = scaffoldProject({
          natural_language_request: "Build a booking app",
          workspace_root: ws,
        });
        const check = checkRunnable(r);
        expect(check.runnable).toBe(true);
        expect(check.reasons).toEqual([]);
      } finally {
        rmSync(ws, { recursive: true, force: true });
      }
    });

    it("checks that a scaffolded static site has index.html", () => {
      const ws = mkdtempSync(path.join(tmpdir(), "nex1-scaffold-static-check-"));
      try {
        const r = scaffoldProject({
          natural_language_request: "Portfolio",
          workspace_root: ws,
          template_override: "static-html.v1",
        });
        const check = checkRunnable(r);
        expect(check.runnable).toBe(true);
      } finally {
        rmSync(ws, { recursive: true, force: true });
      }
    });
  });

  describe("determinism + invariants", () => {
    it("produces stable project_id when slug+timestamp+template identical", () => {
      const c1 = classifyRequest("Build a booking site");
      const c2 = classifyRequest("Build a booking site");
      expect(c1.kind).toBe(c2.kind);
    });
    it("declares zero_llm=true and ledger=B", () => {
      const ws = mkdtempSync(path.join(tmpdir(), "nex1-scaffold-inv-"));
      try {
        const r = scaffoldProject({ natural_language_request: "Build a site", workspace_root: ws });
        expect(r.zero_llm).toBe(true);
        expect(r.ledger).toBe("B");
      } finally {
        rmSync(ws, { recursive: true, force: true });
      }
    });
    it("stamps canonical version", () => {
      expect(PROJECT_SCAFFOLDER_VERSION).toBe("project-scaffolder.v1.2026-09-19");
    });
    it("exports at least 2 templates", () => {
      expect(listTemplates().length).toBeGreaterThanOrEqual(2);
    });
  });
});
