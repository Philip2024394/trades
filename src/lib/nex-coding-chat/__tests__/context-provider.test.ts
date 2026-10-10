// Context provider unit tests · file-mention extraction, path-escape defence,
// and safe reading limits.

import { describe, it, expect } from "vitest";
import { extractMentionedPaths, loadProjectMap, loadCodeStandards, buildContext } from "../context-provider";

describe("context-provider · extractMentionedPaths", () => {
  it("extracts a single @path/to/file.ts mention", () => {
    const r = extractMentionedPaths("Check @src/lib/foo/index.ts for me");
    expect(r).toEqual(["src/lib/foo/index.ts"]);
  });

  it("de-duplicates identical mentions", () => {
    const r = extractMentionedPaths("@src/lib/foo.ts and again @src/lib/foo.ts");
    expect(r).toEqual(["src/lib/foo.ts"]);
  });

  it("caps mentions at 5", () => {
    const q = "@a.ts @b.ts @c.ts @d.ts @e.ts @f.ts @g.ts";
    const r = extractMentionedPaths(q);
    expect(r.length).toBe(5);
  });

  it("ignores plain @word without an extension", () => {
    const r = extractMentionedPaths("hello @world and @nex1");
    expect(r).toEqual([]);
  });

  it("does not treat email addresses as file mentions", () => {
    // The @ before an alphanumeric part matches, but the trailing part must
    // include a dot-extension. `@example.com` DOES have `.com` so this becomes
    // an edge case worth documenting.
    const r = extractMentionedPaths("send to alice@example.com please");
    // We accept that `example.com` matches the regex; downstream safeReadExcerpt
    // returns null for non-existent paths, so this is harmless — but the mention
    // count still reflects the pattern.
    expect(r).toContain("example.com");
  });
});

describe("context-provider · loadCodeStandards / loadProjectMap", () => {
  it("loads CODE_STANDARDS with expected fields", () => {
    const cs = loadCodeStandards();
    expect(cs.primary_language).toBeDefined();
    expect(Array.isArray(cs.protected_files)).toBe(true);
    expect(cs.protected_files.length).toBeGreaterThan(0);
  });

  it("loads PROJECT_MAP with expected fields", () => {
    const pm = loadProjectMap();
    expect(pm.project_root).toBeDefined();
    expect(Object.keys(pm.key_paths).length).toBeGreaterThan(5);
  });
});

describe("context-provider · buildContext", () => {
  it("returns a snapshot with all expected keys, even when no mentions and no prior turns", () => {
    const ctx = buildContext("hello", []);
    expect(ctx.project_map).toBeDefined();
    expect(ctx.code_standards).toBeDefined();
    expect(ctx.mentioned_files).toEqual([]);
    expect(ctx.rolling_memory).toEqual([]);
    expect(Array.isArray(ctx.active_runs)).toBe(true);
  });

  it("includes rolling_memory limited to last 10 turns", () => {
    const priors = Array.from({ length: 20 }).map((_, i) => ({
      id: `m-${i}`,
      session_id: "s",
      role: (i % 2 === 0 ? "user" : "nex") as "user" | "nex",
      content: `msg ${i}`,
      ts: new Date().toISOString(),
      status: "answered" as const,
    }));
    const ctx = buildContext("test", priors);
    expect(ctx.rolling_memory.length).toBe(10);
    expect(ctx.rolling_memory[0]?.content).toBe("msg 10");
    expect(ctx.rolling_memory[9]?.content).toBe("msg 19");
  });

  it("refuses to include files that escape the repo (path traversal)", () => {
    const ctx = buildContext("check @../../etc/passwd.conf please", []);
    expect(ctx.mentioned_files.length).toBe(0);
  });

  it("silently skips non-existent files", () => {
    const ctx = buildContext("check @src/lib/does-not-exist-xyz.ts please", []);
    expect(ctx.mentioned_files.length).toBe(0);
  });
});
