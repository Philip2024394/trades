// NEX1 · Capability M-1 · File Memory Store · unit + integration tests.
// Uses os.tmpdir() so tests never touch the real project storage.

import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFileMemoryStore } from "../store";
import type { FileMemoryStore } from "../types";

interface Fixture {
  repoRoot: string;
  storagePath: string;
  store: FileMemoryStore;
}

function makeFixture(): Fixture {
  const repoRoot = mkdtempSync(join(tmpdir(), "nex1-fm-"));
  // Seed a couple of real files.
  const srcDir = join(repoRoot, "src", "lib");
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(join(srcDir, "alpha.ts"), "export const a = 1;\n", "utf8");
  writeFileSync(join(srcDir, "beta.tsx"), "export const b = <div/>;\n", "utf8");
  writeFileSync(join(repoRoot, "package.json"), '{"name":"tmp"}\n', "utf8");
  const storagePath = join(repoRoot, "data", "nex-code-brain", "file-memory", "index.jsonl");
  const store = createFileMemoryStore({ repo_root: repoRoot });
  return { repoRoot, storagePath, store };
}

function cleanup(fx: Fixture): void {
  rmSync(fx.repoRoot, { recursive: true, force: true });
}

describe("FileMemoryStore · path validation", () => {
  let fx: Fixture;
  beforeEach(() => (fx = makeFixture()));
  afterEach(() => cleanup(fx));

  it("refuses empty path", () => {
    const r = fx.store.rememberFile({ path: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("path_empty");
  });

  it("refuses traversal path", () => {
    const r = fx.store.rememberFile({ path: "../secret.ts" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("path_traversal_attempt");
  });

  it("refuses absolute path outside repo root", () => {
    const r = fx.store.rememberFile({ path: "/etc/passwd" });
    expect(r.ok).toBe(false);
    // On Windows: /etc/passwd resolves to something like C:\etc\passwd which
    // is outside the tmp repoRoot. Either refusal is honest.
    if (!r.ok) {
      expect(["path_outside_repo", "file_not_found"]).toContain(r.refusal);
    }
  });

  it("refuses non-existent file", () => {
    const r = fx.store.rememberFile({ path: "src/lib/does-not-exist.ts" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("file_not_found");
  });
});

describe("FileMemoryStore · remember + recall + list", () => {
  let fx: Fixture;
  beforeEach(() => (fx = makeFixture()));
  afterEach(() => cleanup(fx));

  it("remembers a fresh file with correct fields", () => {
    const r = fx.store.rememberFile({ path: "src/lib/alpha.ts", tags: ["seed"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.path).toBe("src/lib/alpha.ts");
    expect(r.entry.language).toBe("typescript");
    expect(r.entry.size_bytes).toBeGreaterThan(0);
    expect(r.entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.entry.tags).toEqual(["seed"]);
    expect(r.was_already_remembered).toBe(false);
    expect(r.content_changed).toBe(false);
  });

  it("recall returns 'found' for a remembered file", () => {
    fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    const c = fx.store.recallFile("src/lib/alpha.ts");
    expect(c.kind).toBe("found");
    if (c.kind === "found") expect(c.entry.language).toBe("typescript");
  });

  it("recall returns 'not_remembered' when unseen", () => {
    const c = fx.store.recallFile("src/lib/never-seen.ts");
    expect(c.kind).toBe("not_remembered");
  });

  it("re-remembering the same file marks was_already_remembered=true", () => {
    fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    const r2 = fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.was_already_remembered).toBe(true);
      expect(r2.content_changed).toBe(false);
    }
  });

  it("detects content_changed when the file content mutates", () => {
    const first = fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    expect(first.ok).toBe(true);
    // Mutate on disk.
    writeFileSync(join(fx.repoRoot, "src", "lib", "alpha.ts"), "export const a = 999;\n", "utf8");
    const second = fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.was_already_remembered).toBe(true);
      expect(second.content_changed).toBe(true);
    }
  });

  it("preserves first_seen_iso across re-remember", () => {
    const r1 = fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    if (!r1.ok) return;
    const firstSeen = r1.entry.first_seen_iso;
    const r2 = fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    if (!r2.ok) return;
    expect(r2.entry.first_seen_iso).toBe(firstSeen);
    expect(r2.entry.last_seen_iso >= firstSeen).toBe(true);
  });

  it("listFiles filters by path_prefix", () => {
    fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    fx.store.rememberFile({ path: "src/lib/beta.tsx" });
    fx.store.rememberFile({ path: "package.json" });
    const inLib = fx.store.listFiles({ path_prefix: "src/lib/" });
    expect(inLib.total_matching).toBe(2);
    const all = fx.store.listFiles();
    expect(all.total_matching).toBe(3);
  });

  it("listFiles filters by language", () => {
    fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    fx.store.rememberFile({ path: "src/lib/beta.tsx" });
    fx.store.rememberFile({ path: "package.json" });
    const jsonOnly = fx.store.listFiles({ language: "json" });
    expect(jsonOnly.total_matching).toBe(1);
    expect(jsonOnly.entries[0]!.path).toBe("package.json");
  });

  it("listFiles filters by tag", () => {
    fx.store.rememberFile({ path: "src/lib/alpha.ts", tags: ["core"] });
    fx.store.rememberFile({ path: "src/lib/beta.tsx", tags: ["ui"] });
    const uiOnly = fx.store.listFiles({ tag: "ui" });
    expect(uiOnly.total_matching).toBe(1);
    expect(uiOnly.entries[0]!.path).toBe("src/lib/beta.tsx");
  });

  it("listFiles caps the limit", () => {
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(fx.repoRoot, `f${i}.ts`), `export const f${i} = ${i};\n`, "utf8");
      fx.store.rememberFile({ path: `f${i}.ts` });
    }
    const r = fx.store.listFiles({ limit: 3 });
    expect(r.total_matching).toBe(5);
    expect(r.returned).toBe(3);
  });

  it("summary too long is refused", () => {
    const long = "x".repeat(3000);
    const r = fx.store.rememberFile({ path: "src/lib/alpha.ts", summary: long });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("summary_too_long");
  });

  it("too many tags is refused", () => {
    const tags = Array.from({ length: 40 }, (_, i) => `t${i}`);
    const r = fx.store.rememberFile({ path: "src/lib/alpha.ts", tags });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("tags_too_many");
  });
});

describe("FileMemoryStore · forget", () => {
  let fx: Fixture;
  beforeEach(() => (fx = makeFixture()));
  afterEach(() => cleanup(fx));

  it("forget marks a remembered file as forgotten and recall returns 'forgotten'", () => {
    fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    const f = fx.store.forgetFile("src/lib/alpha.ts", "no longer relevant");
    expect(f.ok).toBe(true);
    const c = fx.store.recallFile("src/lib/alpha.ts");
    expect(c.kind).toBe("forgotten");
    if (c.kind === "forgotten") expect(c.reason).toBe("no longer relevant");
  });

  it("forget on unknown path refuses cleanly", () => {
    const f = fx.store.forgetFile("src/lib/who.ts", "n/a");
    expect(f.ok).toBe(false);
  });

  it("re-remember after forget restores the entry", () => {
    fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    fx.store.forgetFile("src/lib/alpha.ts", "cleanup");
    const r = fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    expect(r.ok).toBe(true);
    const c = fx.store.recallFile("src/lib/alpha.ts");
    expect(c.kind).toBe("found");
  });
});

describe("FileMemoryStore · persistence", () => {
  let fx: Fixture;
  beforeEach(() => (fx = makeFixture()));
  afterEach(() => cleanup(fx));

  it("writes JSONL that a fresh store can replay", () => {
    fx.store.rememberFile({ path: "src/lib/alpha.ts", tags: ["seed"] });
    fx.store.rememberFile({ path: "src/lib/beta.tsx", tags: ["ui"] });
    fx.store.forgetFile("src/lib/alpha.ts", "outdated");
    expect(existsSync(fx.storagePath)).toBe(true);
    const raw = readFileSync(fx.storagePath, "utf8");
    const lines = raw.split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBe(3);
    const fresh = createFileMemoryStore({ repo_root: fx.repoRoot });
    expect(fresh.size()).toBe(1);
    const c = fresh.recallFile("src/lib/alpha.ts");
    expect(c.kind).toBe("forgotten");
    const c2 = fresh.recallFile("src/lib/beta.tsx");
    expect(c2.kind).toBe("found");
  });

  it("reload() restores in-memory state deterministically", () => {
    fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    fx.store.reload();
    const c = fx.store.recallFile("src/lib/alpha.ts");
    expect(c.kind).toBe("found");
  });

  it("skips corrupt JSONL lines without throwing", () => {
    fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    // Append a corrupt line.
    writeFileSync(fx.storagePath, readFileSync(fx.storagePath, "utf8") + "not-json\n", "utf8");
    const fresh = createFileMemoryStore({ repo_root: fx.repoRoot });
    expect(fresh.size()).toBe(1); // the valid line survived
  });
});

describe("FileMemoryStore · determinism", () => {
  let fx: Fixture;
  beforeEach(() => (fx = makeFixture()));
  afterEach(() => cleanup(fx));

  it("sha256 is stable for identical bytes across calls", () => {
    const r1 = fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    const r2 = fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    if (r1.ok && r2.ok) {
      expect(r1.entry.sha256).toBe(r2.entry.sha256);
    }
  });

  it("attribution present on entry", () => {
    const r = fx.store.rememberFile({ path: "src/lib/alpha.ts" });
    if (r.ok) expect(r.entry.taught_by).toBe("master_ai_engineer");
  });
});
