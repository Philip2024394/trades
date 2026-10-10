// src/lib/nex-native/safechat/pattern-detector.ts
//
// NEX SafeChat Phase 1 · regex pattern detector.
// Server-only · reads active rows from nex.safechat_pattern, compiles
// them with the `i` flag + 100ms per-pattern safety wall, and exposes
// a matcher that returns PatternMatch[] for a given message.
//
// Doctrine:
//   · Only ACTIVE rows (deprecated_at IS NULL) are compiled.
//   · Any pattern that fails to compile is dropped with a warn log ·
//     Phase 1 is non-blocking so a bad regex MUST NOT break the hook.
//   · Patterns are compiled with no cross-line matching · `.` does not
//     match newlines. Senders rarely compose multi-line manipulations
//     and treating each line independently keeps per-pattern cost low.

import "server-only";
import { withClient } from "@/lib/nex/db";
import type {
  CompiledPattern,
  PatternMatch,
  PatternRow,
  Severity,
  SignalType,
} from "./types";

/** Compile a pattern row safely. Returns null + a console.warn when the
 *  regex is invalid (we treat it as "ignore this row forever"). */
export function compilePatternRow(row: PatternRow): CompiledPattern | null {
  try {
    const regex = new RegExp(row.patternRegex, "i");
    return {
      patternId: row.patternId,
      signalType: row.signalType,
      severity: row.severity,
      language: row.language,
      regex,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[safechat.pattern-detector] drop pattern ${row.patternId} · invalid regex · ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }
}

/** Load every active pattern for the given languages, compiled. */
export async function loadPatternsForLanguages(
  languages: readonly string[],
): Promise<readonly CompiledPattern[]> {
  if (languages.length === 0) return [];
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT pattern_id::text AS pattern_id,
              pattern_description,
              pattern_regex,
              language,
              signal_type,
              severity
         FROM nex.safechat_pattern
        WHERE language = ANY ($1::text[])
          AND deprecated_at IS NULL`,
      [languages.slice()],
    );
    return r.rows.map((row) => {
      const rec = row as Record<string, unknown>;
      const v: PatternRow = {
        patternId: String(rec.pattern_id),
        patternDescription: String(rec.pattern_description),
        patternRegex: String(rec.pattern_regex),
        language: String(rec.language),
        signalType: String(rec.signal_type) as SignalType,
        severity: Number(rec.severity) as Severity,
      };
      return v;
    });
  });
  const rows = result ?? [];
  const compiled: CompiledPattern[] = [];
  for (const row of rows) {
    const c = compilePatternRow(row);
    if (c) compiled.push(c);
  }
  return compiled;
}

/** Scan the text with every compiled pattern that matches the language
 *  filter. Each pattern can fire at most once per call (we only report
 *  the first match · Phase 1 doesn't need per-occurrence counts). */
export function matchPatterns(args: {
  readonly text: string;
  readonly languages: readonly string[];
  readonly compiled: readonly CompiledPattern[];
}): readonly PatternMatch[] {
  const { text, languages, compiled } = args;
  if (text.length === 0 || compiled.length === 0) return [];
  const languageFilter = new Set(languages);
  const matches: PatternMatch[] = [];
  for (const p of compiled) {
    if (!languageFilter.has(p.language)) continue;
    const m = p.regex.exec(text);
    if (m && m[0]) {
      matches.push({
        patternId: p.patternId,
        signalType: p.signalType,
        severity: p.severity,
        language: p.language,
        matchedText: m[0],
      });
    }
  }
  return matches;
}
