// safeWrite unit tests · verifies the single choke-point refuses protected
// paths and grants legitimate ones, and that .env.local is refused even for
// the Integrator (special-case).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { safeWrite } from "../safe-write";

const REPO_ROOT = process.cwd();
const TEST_RUN_ID = `test-safewrite-${Date.now()}`;
const RUN_DIR = path.join(REPO_ROOT, "data", "nex-coding-team", "runs", TEST_RUN_ID);

beforeAll(() => {
  if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true });
});

afterAll(() => {
  if (existsSync(RUN_DIR)) rmSync(RUN_DIR, { recursive: true, force: true });
});

describe("safeWrite · grants legitimate writes", () => {
  it("PM writes ticket.md under its run dir", () => {
    const target = `data/nex-coding-team/runs/${TEST_RUN_ID}/ticket.md`;
    const r = safeWrite(TEST_RUN_ID, "pm", target, "# ticket\n");
    expect(r.ok).toBe(true);
    expect(r.bytes).toBeGreaterThan(0);
    expect(existsSync(path.join(REPO_ROOT, target))).toBe(true);
    expect(readFileSync(path.join(REPO_ROOT, target), "utf8")).toBe("# ticket\n");
  });
});

describe("safeWrite · refuses protected paths", () => {
  it("refuses .env.local for every agent (including integrator)", () => {
    const r = safeWrite(TEST_RUN_ID, "integrator", ".env.local", "SOMETHING=1");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/\.env\.local/);
  });

  it("refuses .env writes", () => {
    const r = safeWrite(TEST_RUN_ID, "builder", ".env", "SOMETHING=1");
    expect(r.ok).toBe(false);
  });

  it("refuses CLAUDE.md writes", () => {
    const r = safeWrite(TEST_RUN_ID, "technical-writer", "CLAUDE.md", "# override");
    expect(r.ok).toBe(false);
  });

  it("refuses writes under src/lib/nex-v3/", () => {
    const r = safeWrite(TEST_RUN_ID, "builder", "src/lib/nex-v3/v3-engine-registry.ts", "export const x=1;");
    expect(r.ok).toBe(false);
  });

  it("refuses writes to the frozen M-1 migration", () => {
    const r = safeWrite(TEST_RUN_ID, "integrator", "supabase/migrations/20260915180000_nex_visual_structural_lock_architecture.sql", "-- x");
    expect(r.ok).toBe(false);
  });
});

describe("safeWrite · refuses cross-role writes", () => {
  it("refuses PM writing to src/", () => {
    const r = safeWrite(TEST_RUN_ID, "pm", "src/lib/foo/index.ts", "export {};\n");
    expect(r.ok).toBe(false);
  });

  it("refuses Builder writing to a test file", () => {
    const r = safeWrite(TEST_RUN_ID, "builder", "src/lib/foo/foo.test.ts", "// test\n");
    expect(r.ok).toBe(false);
  });

  it("refuses Tester writing to application source", () => {
    const r = safeWrite(TEST_RUN_ID, "tester", "src/lib/foo/index.ts", "export {};\n");
    expect(r.ok).toBe(false);
  });
});
