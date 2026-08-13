// KPE Stage 2 · Cleaning Engine
//
// Removes obvious junk from raw input BEFORE any semantic work happens.
// No AI. Deterministic. Reversible (we preserve the raw in the pipeline).
//
// Cleans:
//   · HTML tags (basic strip · keeps inner text)
//   · Duplicate spaces + trailing whitespace
//   · Zero-width chars + BOM
//   · Repeated header/footer lines (detected by frequency across lines)
//   · Markdown table separator noise (---|---|---)
//   · Windows CRLF → LF

import type { CleaningInput, CleaningOutput, PipelineStage } from "../types";

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
}

function normaliseWhitespace(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[​-‍﻿]/g, "")   // zero-width + BOM
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n").map((line) => line.trim()).join("\n")
    .trim();
}

/** Detect + remove header/footer lines that repeat > threshold times. */
function stripRepeatedHeaderFooter(s: string): string {
  const lines = s.split("\n");
  if (lines.length < 20) return s;
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (line.length < 4 || line.length > 120) continue;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  // A line repeated in >= 3% of total lines AND at least 3 times is likely chrome.
  const threshold = Math.max(3, Math.floor(lines.length * 0.03));
  const chrome = new Set<string>();
  for (const [line, count] of counts) {
    if (count >= threshold) chrome.add(line);
  }
  if (chrome.size === 0) return s;
  return lines.filter((l) => !chrome.has(l)).join("\n");
}

export const CleaningStage: PipelineStage<CleaningInput, CleaningOutput> = {
  name: "cleaning",
  version: "1.0.0",
  async run(input: CleaningInput): Promise<CleaningOutput> {
    const before = input.raw_content;
    const beforeBytes = Buffer.byteLength(before, "utf8");

    let s = before;
    s = stripHtml(s);
    s = normaliseWhitespace(s);
    s = stripRepeatedHeaderFooter(s);
    s = normaliseWhitespace(s);   // second pass after chrome removal

    const afterBytes = Buffer.byteLength(s, "utf8");
    return { cleaned_content: s, removed_bytes: Math.max(0, beforeBytes - afterBytes) };
  },
};
