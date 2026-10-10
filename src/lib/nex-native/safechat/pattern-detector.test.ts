// src/lib/nex-native/safechat/pattern-detector.test.ts
//
// Hermetic unit tests for the SafeChat pattern detector. No DB.

import { describe, expect, test, vi } from "vitest";
import { compilePatternRow, matchPatterns } from "./pattern-detector";
import type { CompiledPattern, PatternRow } from "./types";

function row(partial: Partial<PatternRow> & { patternRegex: string; patternId?: string }): PatternRow {
  return {
    patternId: partial.patternId ?? "p-id",
    patternDescription: partial.patternDescription ?? "test pattern",
    patternRegex: partial.patternRegex,
    language: partial.language ?? "en",
    signalType: partial.signalType ?? "image_request",
    severity: partial.severity ?? 2,
  };
}

describe("compilePatternRow", () => {
  test("compiles a valid regex with i flag", () => {
    const c = compilePatternRow(row({ patternRegex: "send\\s+me\\s+a\\s+pic" }));
    expect(c).not.toBeNull();
    expect(c!.regex.test("SEND ME A PIC")).toBe(true);
  });

  test("returns null for invalid regex and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = compilePatternRow(row({ patternRegex: "(unclosed[" }));
    expect(c).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("preserves metadata", () => {
    const c = compilePatternRow(
      row({
        patternRegex: "x",
        patternId: "p-123",
        signalType: "secrecy_request",
        severity: 3,
        language: "id",
      }),
    );
    expect(c!.patternId).toBe("p-123");
    expect(c!.signalType).toBe("secrecy_request");
    expect(c!.severity).toBe(3);
    expect(c!.language).toBe("id");
  });
});

describe("matchPatterns", () => {
  const samplePatterns: CompiledPattern[] = [
    {
      patternId: "p-img",
      signalType: "image_request",
      severity: 2,
      language: "en",
      regex: /send\s+(me\s+)?a\s+(pic|photo)/i,
    },
    {
      patternId: "p-sec",
      signalType: "secrecy_request",
      severity: 3,
      language: "en",
      regex: /don[’']t\s+tell\s+(your\s+)?(mum|mom|parents|anyone)/i,
    },
    {
      patternId: "p-sec-id",
      signalType: "secrecy_request",
      severity: 3,
      language: "id",
      regex: /jangan\s+bilang(\s+siapa[-\s]?siapa)?/i,
    },
  ];

  test("returns empty on empty text", () => {
    expect(
      matchPatterns({ text: "", languages: ["en"], compiled: samplePatterns }),
    ).toEqual([]);
  });

  test("returns empty on empty pattern list", () => {
    expect(
      matchPatterns({ text: "anything", languages: ["en"], compiled: [] }),
    ).toEqual([]);
  });

  test("fires image_request for plain phrase", () => {
    const matches = matchPatterns({
      text: "please send me a pic",
      languages: ["en"],
      compiled: samplePatterns,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.signalType).toBe("image_request");
  });

  test("case-insensitive match", () => {
    const matches = matchPatterns({
      text: "SEND A PHOTO",
      languages: ["en"],
      compiled: samplePatterns,
    });
    expect(matches).toHaveLength(1);
  });

  test("fires secrecy_request for English", () => {
    const matches = matchPatterns({
      text: "don't tell your mum",
      languages: ["en"],
      compiled: samplePatterns,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.signalType).toBe("secrecy_request");
  });

  test("respects language filter", () => {
    const matches = matchPatterns({
      text: "jangan bilang siapa-siapa",
      languages: ["en"],
      compiled: samplePatterns,
    });
    expect(matches).toHaveLength(0);
  });

  test("fires secrecy_request for Bahasa Indonesia", () => {
    const matches = matchPatterns({
      text: "ini rahasia · jangan bilang",
      languages: ["id"],
      compiled: samplePatterns,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.signalType).toBe("secrecy_request");
    expect(matches[0]!.language).toBe("id");
  });

  test("multiple patterns can fire in one message", () => {
    const matches = matchPatterns({
      text: "send me a pic · don't tell your mum",
      languages: ["en"],
      compiled: samplePatterns,
    });
    expect(matches).toHaveLength(2);
  });

  test("each pattern reports at most one match (first)", () => {
    const matches = matchPatterns({
      text: "send me a pic now and send me a photo later",
      languages: ["en"],
      compiled: samplePatterns,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.matchedText.toLowerCase().startsWith("send")).toBe(true);
  });
});
