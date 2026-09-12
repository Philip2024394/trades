// src/lib/nex-agent/step-renderer.test.ts

import { describe, it, expect } from "vitest";
import {
  extractDecision,
  extractExplicitCodeBlocks,
  splitTextAndCode,
  compactBodySummary,
} from "./step-renderer";

describe("extractDecision", () => {
  it("returns null for non-decision body", () => {
    expect(extractDecision({ summary: "hi" })).toBeNull();
    expect(extractDecision(null)).toBeNull();
    expect(extractDecision("string")).toBeNull();
  });

  it("returns null for single-option body (needs ≥2 options)", () => {
    expect(extractDecision({ options: [{ id: "a", label: "A" }] })).toBeNull();
  });

  it("parses body.options with recommended flag", () => {
    const d = extractDecision({
      question: "Pick a DB",
      options: [
        { id: "pg", label: "Postgres", recommended: true },
        { id: "sqlite", label: "SQLite" },
      ],
    });
    expect(d).not.toBeNull();
    expect(d!.question).toBe("Pick a DB");
    expect(d!.options.length).toBe(2);
    expect(d!.options[0].recommended).toBe(true);
    expect(d!.options[1].recommended).toBe(false);
  });

  it("auto-marks first option recommended if none flagged", () => {
    const d = extractDecision({
      question: "Which?",
      options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
    });
    expect(d!.options[0].recommended).toBe(true);
    expect(d!.options[1].recommended).toBe(false);
  });

  it("supports body.decision.options nested shape", () => {
    const d = extractDecision({
      decision: {
        question: "Which port?",
        options: [
          { id: "3000", label: "3000", recommended: true },
          { id: "3008", label: "3008" },
        ],
      },
    });
    expect(d).not.toBeNull();
    expect(d!.question).toBe("Which port?");
    expect(d!.options[0].id).toBe("3000");
  });

  it("skips malformed options (missing id or label)", () => {
    const d = extractDecision({
      options: [
        { id: "a", label: "A" },
        { label: "no id" },
        { id: "b", label: "B" },
      ],
    });
    expect(d!.options.length).toBe(2);
  });
});

describe("extractExplicitCodeBlocks", () => {
  it("extracts body.sql", () => {
    const blocks = extractExplicitCodeBlocks({ sql: "SELECT 1" });
    expect(blocks.length).toBe(1);
    expect(blocks[0].language).toBe("sql");
    expect(blocks[0].code).toBe("SELECT 1");
  });

  it("extracts body.migration_sql with note", () => {
    const blocks = extractExplicitCodeBlocks({ migration_sql: "CREATE TABLE x()" });
    expect(blocks[0].note).toBe("migration");
  });

  it("extracts body.code with body.language", () => {
    const blocks = extractExplicitCodeBlocks({ code: "console.log(1)", language: "ts" });
    expect(blocks[0].language).toBe("ts");
    expect(blocks[0].code).toBe("console.log(1)");
  });

  it("extracts proposed_files with preview_content", () => {
    const blocks = extractExplicitCodeBlocks({
      proposed_files: [
        { path: "src/foo.ts", language: "typescript", preview_content: "export const x = 1;" },
        { path: "db/mig.sql", language: "sql", preview_content: "SELECT 2" },
        { path: "no-content.ts", language: "typescript" },
      ],
    });
    expect(blocks.length).toBe(2);
    expect(blocks[0].note).toBe("src/foo.ts");
    expect(blocks[1].note).toBe("db/mig.sql");
  });

  it("returns empty array for empty body", () => {
    expect(extractExplicitCodeBlocks({})).toEqual([]);
    expect(extractExplicitCodeBlocks(null)).toEqual([]);
  });
});

describe("splitTextAndCode", () => {
  it("returns single text segment when no fences", () => {
    const s = splitTextAndCode("plain text with no code");
    expect(s.length).toBe(1);
    expect(s[0].kind).toBe("text");
  });

  it("splits fenced code from surrounding prose", () => {
    const s = splitTextAndCode("intro text\n```sql\nSELECT 1\n```\noutro text");
    expect(s.length).toBe(3);
    expect(s[0].kind).toBe("text");
    expect(s[1].kind).toBe("code");
    expect(s[1].language).toBe("sql");
    expect(s[1].text.trim()).toBe("SELECT 1");
    expect(s[2].kind).toBe("text");
  });

  it("handles multiple fenced blocks", () => {
    const s = splitTextAndCode("```js\na\n```\nmiddle\n```py\nb\n```");
    const codes = s.filter((x) => x.kind === "code");
    expect(codes.length).toBe(2);
    expect(codes[0].language).toBe("js");
    expect(codes[1].language).toBe("py");
  });

  it("defaults language to 'text' when fence has no lang tag", () => {
    const s = splitTextAndCode("```\nno-lang\n```");
    expect(s.length).toBe(1);
    expect(s[0].kind).toBe("code");
    expect(s[0].language).toBe("text");
  });

  it("returns empty array on empty input", () => {
    expect(splitTextAndCode("")).toEqual([]);
  });
});

describe("compactBodySummary", () => {
  it("summarises common fields", () => {
    const s = compactBodySummary({ summary: "did a thing", round: 2, ok: true });
    expect(s).toContain("did a thing");
    expect(s).toContain("round 2");
    expect(s).toContain("ok");
  });

  it("falls back to json when no known fields", () => {
    const s = compactBodySummary({ arbitrary: "value" });
    expect(s).toContain("arbitrary");
  });
});
