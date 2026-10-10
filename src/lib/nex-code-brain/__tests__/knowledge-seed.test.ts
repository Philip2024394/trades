// Knowledge-seed tests · seeds load, are idempotent, are searchable, and
// suggestion routing surfaces the right pattern for a natural-language query.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { seedLanes, __resetLanesForTest } from "../lane-registry";
import { __resetKnowledgeForTest } from "../knowledge-store";
import { searchKnowledge } from "..";
import { seedCodeBible, suggestPatternsFor, totalSeedEntries } from "../knowledge-seed/seed-loader";
import { CODE_BIBLE_SEED, CODE_BIBLE_SECTIONS } from "../knowledge-seed/engineering-patterns";

const TEST_ROOT = path.join(process.cwd(), "data", `.nex-code-brain-test-${randomBytes(4).toString("hex")}`);
beforeAll(() => {
  process.env.NEX_CODE_BRAIN_ROOT = TEST_ROOT;
});
afterAll(() => {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
  delete process.env.NEX_CODE_BRAIN_ROOT;
});
beforeEach(() => {
  __resetLanesForTest();
  __resetKnowledgeForTest();
  seedLanes();
});

describe("code-bible seed · load + idempotency", () => {
  it("seeds every pattern on first call", () => {
    const outcome = seedCodeBible();
    expect(outcome.rejected).toEqual([]);
    expect(outcome.seeded).toBe(CODE_BIBLE_SEED.length);
    expect(outcome.already_present).toBe(0);
  });

  it("re-running is a no-op", () => {
    seedCodeBible();
    const second = seedCodeBible();
    expect(second.seeded).toBe(0);
    expect(second.already_present).toBe(CODE_BIBLE_SEED.length);
  });

  it("totalSeedEntries reflects the seeded count", () => {
    expect(totalSeedEntries()).toBe(0);
    seedCodeBible();
    expect(totalSeedEntries()).toBe(CODE_BIBLE_SEED.length);
  });

  it("every seeded entry carries a source citation in evidence", () => {
    seedCodeBible();
    const all = searchKnowledge({ tag: "code-bible-seed" });
    for (const e of all) {
      expect(e.evidence.length).toBeGreaterThan(0);
    }
  });

  it("every seeded entry is marked founder_approved=false", () => {
    seedCodeBible();
    const all = searchKnowledge({ tag: "code-bible-seed" });
    for (const e of all) {
      expect(e.founder_approved).toBe(false);
    }
  });
});

describe("code-bible seed · coverage across engineering domains", () => {
  it("covers ten named sections", () => {
    const sections = Object.keys(CODE_BIBLE_SECTIONS);
    expect(sections.length).toBe(10);
    // Sanity — every section has at least 1 entry.
    for (const s of sections) {
      expect((CODE_BIBLE_SECTIONS as any)[s].length).toBeGreaterThan(0);
    }
  });

  it("includes verified NEX-specific gotchas (not just textbook rules)", () => {
    seedCodeBible();
    const nexSpecific = searchKnowledge({ tag: "verified" });
    // Windows-vitest gotcha · SDXL VRAM · Stop-Process anti-pattern · wx flag
    expect(nexSpecific.length).toBeGreaterThanOrEqual(4);
  });

  it("includes at least one entry per intended domain", () => {
    seedCodeBible();
    const domains = ["typescript", "security", "react", "database", "debugging", "visual", "concurrency", "testing"];
    for (const d of domains) {
      const hits = searchKnowledge({ tag: d });
      expect(hits.length, `expected at least 1 entry tagged "${d}"`).toBeGreaterThan(0);
    }
  });
});

describe("code-bible suggest · natural-language retrieval", () => {
  beforeEach(() => {
    seedCodeBible();
  });

  it("returns SQL-injection guidance when asked about user-supplied SQL", () => {
    const s = suggestPatternsFor("user email SQL query concat injection");
    expect(s.length).toBeGreaterThan(0);
    expect(s[0]?.title.toLowerCase()).toContain("sql");
  });

  it("returns path-traversal guidance for user file paths", () => {
    const s = suggestPatternsFor("user supplied file path traversal");
    expect(s.some((h) => h.title.toLowerCase().includes("path"))).toBe(true);
  });

  it("returns test isolation guidance when asked about parallel test flakes", () => {
    const s = suggestPatternsFor("parallel test flake shared state isolation");
    expect(s.some((h) => h.title.toLowerCase().includes("test"))).toBe(true);
  });

  it("returns migration-safety guidance when asked about DROP TABLE", () => {
    const s = suggestPatternsFor("migration drop table alter destructive");
    expect(s.some((h) => h.title.toLowerCase().includes("migration"))).toBe(true);
  });

  it("returns nothing for gibberish (no false confidence)", () => {
    const s = suggestPatternsFor("qwzxplkjb");
    expect(s.length).toBe(0);
  });

  it("returns empty for zero-length or too-short queries", () => {
    expect(suggestPatternsFor("").length).toBe(0);
    expect(suggestPatternsFor("a b c").length).toBe(0);
  });

  it("caps results by limit", () => {
    const s = suggestPatternsFor("typescript testing security react", 3);
    expect(s.length).toBeLessThanOrEqual(3);
  });
});

describe("code-bible seed · honesty posture", () => {
  it("every body cites a Source line", () => {
    for (const p of CODE_BIBLE_SEED) {
      expect(p.body).toMatch(/\*\*Source\.\*\*/);
    }
  });

  it("every body declares a Confidence line", () => {
    for (const p of CODE_BIBLE_SEED) {
      expect(p.body).toMatch(/\*\*Confidence\.\*\*/);
    }
  });

  it("no body is a bare rule · every entry has at least a source citation as context", () => {
    // Minimum honesty requirement: every seeded rule must cite ITS source.
    // A Source citation tells the reader where to verify the rule and gives
    // the context of when it applies (via the cited material). Additional
    // context (rationale, applicability, alternative, example, symptom) is
    // strongly preferred but a Source line alone is the minimum bar.
    for (const p of CODE_BIBLE_SEED) {
      expect(p.body, `entry "${p.title}" missing Source citation`).toMatch(/\*\*Source\.\*\*/);
    }
  });
});
