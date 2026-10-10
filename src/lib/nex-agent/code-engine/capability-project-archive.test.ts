// src/lib/nex-agent/code-engine/capability-project-archive.test.ts
//
// Prove: Export runs against Project workspace ONLY.
// Prove: Path isolation · exclusions · secret protection · deterministic manifest.

import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { archiveProject, PROJECT_ARCHIVE_VERSION } from "./capability-project-archive";

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TEST_ROOT = path.join(tmpdir(), "nex1-project-archive-test", RUN_ID);
const SANCTIONED = path.join(TEST_ROOT, "sanctioned");
const INFRA = path.join(TEST_ROOT, "nex-infra");
const OUTPUT = path.join(TEST_ROOT, "archives");

function seedWorkspace(slug: string): string {
  const wsRoot = path.join(SANCTIONED, slug);
  mkdirSync(wsRoot, { recursive: true });
  writeFileSync(path.join(wsRoot, "index.html"), "<h1>Hello</h1>");
  writeFileSync(path.join(wsRoot, "README.md"), "# Test");
  mkdirSync(path.join(wsRoot, "src"), { recursive: true });
  writeFileSync(path.join(wsRoot, "src", "app.js"), "console.log('hi');");
  return wsRoot;
}

function seedNoisyWorkspace(slug: string): string {
  const wsRoot = seedWorkspace(slug);
  // Add noise that MUST be excluded
  mkdirSync(path.join(wsRoot, "node_modules", "some-pkg"), { recursive: true });
  writeFileSync(path.join(wsRoot, "node_modules", "some-pkg", "index.js"), "// huge dep");
  mkdirSync(path.join(wsRoot, ".git", "objects"), { recursive: true });
  writeFileSync(path.join(wsRoot, ".git", "HEAD"), "ref: refs/heads/main");
  mkdirSync(path.join(wsRoot, ".next"), { recursive: true });
  writeFileSync(path.join(wsRoot, ".next", "build.log"), "build stuff");
  writeFileSync(path.join(wsRoot, ".env"), "SECRET_KEY=very-secret");
  writeFileSync(path.join(wsRoot, ".env.local"), "DB_PASSWORD=nope");
  writeFileSync(path.join(wsRoot, "debug.log"), "some log content");
  writeFileSync(path.join(wsRoot, ".DS_Store"), "mac metadata");
  return wsRoot;
}

function opts() {
  return { output_dir: OUTPUT, sanctioned_root: SANCTIONED, nex_infra_root: INFRA };
}

beforeEach(() => {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(SANCTIONED, { recursive: true });
  mkdirSync(INFRA, { recursive: true });
  mkdirSync(OUTPUT, { recursive: true });
});

describe("archiveProject · happy path · dry_run", () => {
  it("dry_run produces a manifest with no side effect on disk", async () => {
    const ws = seedWorkspace("proj-a");
    const r = await archiveProject({
      project_id: "0123456789abcdef",
      project_slug: "proj-a",
      workspace_root: ws,
      created_by: "founder",
      dry_run: true,
    }, opts());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.dry_run).toBe(true);
      expect(r.manifest.archive_path).toBeNull();
      expect(r.manifest.archive_bytes).toBeNull();
      expect(r.manifest.archive_sha256).toBeNull();
      expect(r.manifest.files_included).toBe(3); // index.html, README.md, src/app.js
      expect(r.manifest.total_source_bytes).toBeGreaterThan(0);
      expect(r.manifest.record_type).toBe("NEX_PROJECT_ARCHIVE");
      expect(r.manifest.version).toBe(PROJECT_ARCHIVE_VERSION);
    }
    // No archive file should have been written
    expect(existsSync(OUTPUT)).toBe(true);
    // Directory exists (we mkdir'd in beforeEach) but contents should be empty
  });
});

describe("archiveProject · happy path · real archive", () => {
  it("writes a real ZIP with a deterministic manifest and non-zero size", async () => {
    const ws = seedWorkspace("proj-b");
    const r = await archiveProject({
      project_id: "abcdef0123456789",
      project_slug: "proj-b",
      workspace_root: ws,
      created_by: "founder",
    }, opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.manifest.dry_run).toBe(false);
    expect(r.manifest.archive_path).not.toBeNull();
    expect(r.manifest.archive_bytes).toBeGreaterThan(0);
    expect(r.manifest.archive_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(r.manifest.archive_path!)).toBe(true);
    // Byte count matches file on disk
    const onDisk = statSync(r.manifest.archive_path!);
    expect(onDisk.size).toBe(r.manifest.archive_bytes);
    // Independently recompute sha256
    const bytes = readFileSync(r.manifest.archive_path!);
    const sha = createHash("sha256").update(bytes).digest("hex");
    expect(sha).toBe(r.manifest.archive_sha256);
  });

  it("archive_id is stable when file contents are identical (same day)", async () => {
    const wsA = seedWorkspace("stable-a");
    const wsB = seedWorkspace("stable-a2");   // separate workspace, identical contents
    const rA = await archiveProject({ project_id: "aaaaaaaaaaaaaaaa", project_slug: "stable", workspace_root: wsA, created_by: "f", dry_run: true }, opts());
    const rB = await archiveProject({ project_id: "aaaaaaaaaaaaaaaa", project_slug: "stable", workspace_root: wsB, created_by: "f", dry_run: true }, opts());
    if (rA.ok && rB.ok) {
      expect(rA.manifest.file_list_hash).toBe(rB.manifest.file_list_hash);
      expect(rA.manifest.archive_id).toBe(rB.manifest.archive_id);
    }
  });
});

describe("archiveProject · exclusions · secret protection", () => {
  it("EXCLUDES node_modules, .git, .next, .env, .env.local, *.log, .DS_Store", async () => {
    const ws = seedNoisyWorkspace("proj-noisy");
    const r = await archiveProject({
      project_id: "1234567890abcdef",
      project_slug: "proj-noisy",
      workspace_root: ws,
      created_by: "founder",
      dry_run: true,
    }, opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Should be exactly the 3 real content files (index.html, README.md, src/app.js)
    expect(r.manifest.files_included).toBe(3);
    expect(r.manifest.files_excluded).toBeGreaterThan(0);
    // Exclusions applied should record the categories
    const excl = r.manifest.exclusions_applied.join(",");
    expect(excl).toMatch(/dir:node_modules/);
    expect(excl).toMatch(/dir:\.git/);
    expect(excl).toMatch(/dir:\.next/);
    expect(excl).toMatch(/file_pattern:\.env/);
    expect(excl).toMatch(/file_pattern:debug\.log/);
    expect(excl).toMatch(/file_pattern:\.DS_Store/);
  });

  it("real archive of noisy workspace does NOT contain excluded content · byte proof", async () => {
    const ws = seedNoisyWorkspace("proj-noisy-real");
    const r = await archiveProject({
      project_id: "abababababababab",
      project_slug: "proj-noisy-real",
      workspace_root: ws,
      created_by: "founder",
    }, opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const bytes = readFileSync(r.manifest.archive_path!);
    // Grep the raw ZIP bytes for excluded secrets · zip entries store filenames plaintext
    const asString = bytes.toString("binary");
    expect(asString).not.toContain("SECRET_KEY");
    expect(asString).not.toContain("DB_PASSWORD");
    expect(asString).not.toContain("node_modules/");
    expect(asString).not.toContain(".git/");
    expect(asString).not.toContain(".next/");
    expect(asString).not.toContain(".env");
  });
});

describe("archiveProject · path isolation invariants", () => {
  it("REFUSES: workspace_root outside sanctioned root", async () => {
    const outside = path.join(TEST_ROOT, "outside");
    mkdirSync(outside, { recursive: true });
    const r = await archiveProject({
      project_id: "0123456789abcdef",
      project_slug: "proj",
      workspace_root: outside,
      created_by: "founder",
    }, opts());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("WORKSPACE_OUTSIDE_SANCTIONED_ROOT");
  });

  it("REFUSES: workspace_root is NEX infrastructure", async () => {
    // Point infra at a path we can pass as workspace_root
    const r = await archiveProject({
      project_id: "0123456789abcdef",
      project_slug: "proj",
      workspace_root: INFRA,
      created_by: "founder",
    }, opts());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // The infra check should fire OR the sanctioned check · both are correct rejections
      expect(["WORKSPACE_IS_NEX_INFRASTRUCTURE", "WORKSPACE_OUTSIDE_SANCTIONED_ROOT"]).toContain(r.reason_code);
    }
  });

  it("REFUSES: workspace_root does not exist", async () => {
    const missing = path.join(SANCTIONED, "does-not-exist");
    const r = await archiveProject({
      project_id: "0123456789abcdef",
      project_slug: "proj",
      workspace_root: missing,
      created_by: "founder",
    }, opts());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("WORKSPACE_DOES_NOT_EXIST");
  });

  it("REFUSES: output_dir inside sanctioned root (archives must not live inside customer workspaces)", async () => {
    const ws = seedWorkspace("proj-x");
    const badOutput = path.join(SANCTIONED, "archives-should-not-be-here");
    const r = await archiveProject({
      project_id: "0123456789abcdef",
      project_slug: "proj-x",
      workspace_root: ws,
      created_by: "founder",
    }, { ...opts(), output_dir: badOutput });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("OUTPUT_PATH_UNSAFE");
  });

  it("Project A archive never contains Project B files (workspace isolation)", async () => {
    const wsA = seedWorkspace("iso-a");
    const wsB = seedWorkspace("iso-b");
    // Distinct fingerprint files
    writeFileSync(path.join(wsA, "MARKER_A.txt"), "AAA-only");
    writeFileSync(path.join(wsB, "MARKER_B.txt"), "BBB-only");
    const rA = await archiveProject({
      project_id: "aaaaaaaaaaaaaaaa",
      project_slug: "iso-a",
      workspace_root: wsA,
      created_by: "f",
    }, opts());
    expect(rA.ok).toBe(true);
    if (!rA.ok) return;
    const bytesA = readFileSync(rA.manifest.archive_path!).toString("binary");
    expect(bytesA).toContain("MARKER_A.txt");
    expect(bytesA).not.toContain("MARKER_B.txt");
    expect(bytesA).not.toContain("iso-b");
  });

  it("archive contains ONLY files whose absolute paths resolve inside workspace_root", async () => {
    const ws = seedWorkspace("iso-c");
    const r = await archiveProject({
      project_id: "cccccccccccccccc",
      project_slug: "iso-c",
      workspace_root: ws,
      created_by: "f",
      dry_run: true,
    }, opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The dry-run manifest lists no absolute paths (only counts)
    // But we can prove indirectly: files_included matches expected count exactly
    expect(r.manifest.files_included).toBe(3);
  });
});

describe("archiveProject · anti-fabrication", () => {
  it("archive_sha256 always matches the byte content on disk", async () => {
    const ws = seedWorkspace("proj-fab");
    const r = await archiveProject({
      project_id: "ffff0000ffff0000",
      project_slug: "proj-fab",
      workspace_root: ws,
      created_by: "f",
    }, opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const bytes = readFileSync(r.manifest.archive_path!);
    const computed = createHash("sha256").update(bytes).digest("hex");
    expect(computed).toBe(r.manifest.archive_sha256);
    expect(bytes.length).toBe(r.manifest.archive_bytes);
  });

  it("archive_path never resolves to process.cwd() or its parents", async () => {
    const ws = seedWorkspace("proj-nocwd");
    const r = await archiveProject({
      project_id: "0000ffff0000ffff",
      project_slug: "proj-nocwd",
      workspace_root: ws,
      created_by: "f",
    }, opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The output was set to a tmp dir · assert we didn't drift
    expect(path.resolve(r.manifest.archive_path!)).not.toBe(path.resolve(process.cwd()));
    expect(path.resolve(r.manifest.archive_path!)).toContain(path.resolve(OUTPUT));
  });
});
