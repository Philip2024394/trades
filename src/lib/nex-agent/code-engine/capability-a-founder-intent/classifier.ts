// src/lib/nex-agent/code-engine/capability-a-founder-intent/classifier.ts
//
// NEX1 · CAPABILITY A · Native Founder-Intent Classifier · pure function.
// Deterministic · zero LLM · zero I/O · same input → same output every call.
//
// Contract:
//   classifyFounderIntent(goal: string): Nex1IntentResult
//
// Design rules:
//   - Never fabricate a classification. If evidence is thin, emit ambiguities.
//   - Never mutate input. Never touch disk. Never make a network call.
//   - Every classification decision leaves a reasoning-trace line.
//   - Refuse on empty / too-short / too-long / no-verb / tied-verbs.
//   - `overall_confidence` is a computed number, not a marketing figure.

import type {
  Nex1AmbiguityFlag,
  Nex1CodingConceptToken,
  Nex1DeliverableKind,
  Nex1DomainToken,
  Nex1FileReference,
  Nex1IntentClassified,
  Nex1IntentRefused,
  Nex1IntentResult,
  Nex1ProjectDirEvidenceKind,
  Nex1ProjectDirReference,
  Nex1RequirementPhrase,
  Nex1TextSpan,
  Nex1VerbFamily,
  Nex1VerbHit,
} from "./types";
import {
  NEX1_INTENT_LOW_CONFIDENCE_BAND,
  NEX1_INTENT_MAX_DOMAIN_TOKENS,
  NEX1_INTENT_MAX_GOAL_CHARS,
  NEX1_INTENT_MIN_GOAL_CHARS,
} from "./types";
import {
  CODING_LEXEME_INDEX,
  DELIVERABLE_SCAN_ORDER,
  REQUIREMENT_MARKERS,
  STOP_WORDS,
  VERB_LEXEME_INDEX,
  VOCABULARY_VERSION,
  WELL_KNOWN_CONFIG_FILES,
  WELL_KNOWN_PROJECT_DIRS,
} from "./vocabulary";
import { requirementMarkerGate } from "./context-evidence-gate";
// Founder 2026-09-17 · C2 Phase 3 · paraphrase fallback before we refuse on
// no-verb-recognised. Same shape as the orchestrator's Layer 1.5 fallback.
import { lookupParaphrase } from "@/lib/nex-agent/language/capability-paraphrase-library";

/**
 * Map from paraphrase-library canonical intent slugs to verb families.
 * Chat-only slugs (small_talk / gratitude / etc.) are deliberately absent —
 * they don't belong in a coding-classifier fallback.
 */
const PARAPHRASE_SLUG_TO_VERB_FAMILY: Readonly<Record<string, Nex1VerbFamily>> = Object.freeze({
  fix_bug: "FIX",
  add_feature: "BUILD",
  add_migration: "BUILD",
  add_api_route: "BUILD",
  add_test: "TEST",
  refactor: "REFACTOR",
  explain: "INVESTIGATE",
});

const TAUGHT_BY = "master_ai_engineer" as const;

// Whitespace + punctuation splitter. Preserves original char offsets via slice.
// Keeps letters, digits, underscore, hyphen, dot, slash — enough for file paths.
//
// v5.0.0-alpha.9 · leading-char class expanded from `[A-Za-z]` to `[A-Za-z_]`
// so double-underscore project dirs (__tests__, __mocks__, __snapshots__,
// __pycache__) that live in WELL_KNOWN_PROJECT_DIRS can actually tokenise.
// Impact analysis confirmed no downstream vocabulary has leading-underscore
// entries that would create false matches (see design doc).
const TOKEN_RE = /[A-Za-z_][A-Za-z0-9._/\-]*/g;

// File-reference extractor · matches paths with any of these extensions.
// CRITICAL: alternation is first-match-wins, so longer extensions MUST come
// before shorter ones that could be a prefix. e.g. 'json' before 'js',
// 'jsonc' before 'json', 'tsx' before 'ts', 'mjs'/'cjs' before 'js', etc.
const FILE_REF_RE =
  /([\w][\w./\-@]*\.(?:jsonc|prisma|graphql|json|tsx|jsx|mts|cts|mjs|cjs|scss|sass|yaml|toml|less|html|htm|bash|swift|hpp|cpp|kt|ts|js|md|mdx|yml|env|sh|zsh|py|rs|go|java|rb|php|cs|css|xml|sql|gql|lock|c|h))(?::(\d+))?/g;

function refuse(
  refusal: Nex1IntentRefused["refusal"],
  reason: string,
  trace: readonly string[],
  goal_length: number,
): Nex1IntentRefused {
  return {
    kind: "refused",
    refusal,
    reason,
    reasoning_trace: trace,
    goal_length,
    vocabulary_version: VOCABULARY_VERSION,
    taught_by: TAUGHT_BY,
  };
}

/** Tokenise the normalised goal into whole-word spans. Preserves original offsets. */
function tokenise(goal: string): readonly { text: string; span: Nex1TextSpan }[] {
  const out: { text: string; span: Nex1TextSpan }[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(goal)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    out.push({
      text: m[0],
      span: { start, end, text: m[0] },
    });
  }
  return out;
}

/** Extract file references via regex over the original goal. */
function extractFileReferences(goal: string): readonly Nex1FileReference[] {
  const out: Nex1FileReference[] = [];
  const seenSpans: Array<{ start: number; end: number }> = [];
  FILE_REF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FILE_REF_RE.exec(goal)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const path = m[1] ?? "";
    const line = m[2] ? Number(m[2]) : null;
    out.push({
      path,
      line,
      span: { start, end, text: goal.slice(start, end) },
    });
    seenSpans.push({ start, end });
  }
  // Second pass: pick up exact-name well-known config files (some have no
  // extension, e.g. "Dockerfile", "Gemfile", "LICENSE", "CODEOWNERS"; others
  // like "package.json" are already caught by the extension regex — dedup by span).
  for (const configName of WELL_KNOWN_CONFIG_FILES) {
    let searchFrom = 0;
    while (searchFrom < goal.length) {
      const idx = goal.indexOf(configName, searchFrom);
      if (idx < 0) break;
      const before = idx === 0 ? "" : goal[idx - 1] ?? "";
      const after = goal[idx + configName.length] ?? "";
      if (isFilenameBoundary(before) && isFilenameBoundary(after)) {
        const end = idx + configName.length;
        const overlaps = seenSpans.some((s) => idx >= s.start && idx < s.end);
        if (!overlaps) {
          out.push({
            path: configName,
            line: null,
            span: { start: idx, end, text: goal.slice(idx, end) },
          });
          seenSpans.push({ start: idx, end });
        }
      }
      searchFrom = idx + configName.length;
    }
  }
  // Deterministic order: by span start.
  return out.slice().sort((a, b) => a.span.start - b.span.start);
}

/** Word boundary for filename lookups. Filenames may contain '.', '-', '_'. */
function isFilenameBoundary(ch: string): boolean {
  if (ch === "") return true;
  // NOT a filename-boundary char if it's alphanumeric, '.', '_', '-', or '/'.
  return !/[A-Za-z0-9._\-/]/.test(ch);
}

// ── PROJECT-DIR EVIDENCE GATE VOCABULARY (Phase 1.10-alpha.2) ────────────────
//
// These sets are LOCAL to the classifier because they are not vocabulary
// registrations — they are anchors used to decide whether a well-known
// directory name in the goal was used as a directory reference vs an English
// word.
//
// Founder decisions (2026-09-16):
//   #1 · `in` IS included in PATH_VERBS_PREPS — enables natural phrases like
//        "in services", "under components", "inside hooks".
//   #2 · framework_anchor is MANDATORY co-occurrence with path_noun — a bare
//        framework mention is not sufficient to claim a directory reference
//        (prevents "React components are stateful" false positives).
//   #3 · compound paths emit ONE reference with path + segments[] — not many
//        independent references (preserves compound structure).

const PATH_NOUNS: ReadonlySet<string> = new Set([
  "directory",
  "directories",
  "folder",
  "folders",
  "dir",
  "dirs",
  "subdir",
  "subdirs",
  "subdirectory",
  "subdirectories",
  "path",
  "paths",
  "tree",
  "layout",
  "structure",
]);

const PATH_VERBS_PREPS: ReadonlySet<string> = new Set([
  // navigation verbs
  "cd",
  "check",
  "open",
  "list",
  "ls",
  "view",
  "explore",
  // prepositions used in path phrasings
  "into",
  "in",
  "inside",
  "under",
  "at",
  "to",
  "from",
  "within",
]);

/**
 * Terminal-position rule for path_verb_anchor emission (v5.0.0-alpha.9).
 *
 * FOUNDER DIRECTIVE 2026-09-16 (Native Understanding Fix Prompt):
 *   "Make NEX1 understand the surrounding structural evidence sufficiently
 *    to distinguish PATH CONTEXT (in src/lib) from NORMAL LANGUAGE
 *    (in services rendered). Develop a deterministic, evidence-backed rule.
 *    The solution must generalise to unseen examples."
 *
 * The rule: a bare-word target that is preceded by a path_verb_prep only
 * emits `path_verb_anchor` when the target sits at a "path-terminal"
 * position — one where the phrase either ENDS or continues with more
 * path-related evidence. If English continues past the target with an
 * unrelated word, no emission.
 *
 * Terminal signals (any ONE is sufficient):
 *   T1 · End of goal (no meaningful character after)
 *   T2 · Sentence-terminating punctuation next (`.`, `,`, `;`, `!`, `?`)
 *   T3 · Next token is another WELL_KNOWN_PROJECT_DIRS entry (list of dirs)
 *   T4 · Next token is a PATH_NOUNS entry (`directory`, `folder`, etc.)
 *   T5 · Next token is `and`/`or` AND the token after is a WELL_KNOWN_PROJECT_DIRS
 *        entry (list continuation via connector)
 *
 * If none of T1-T5 hold, the target sits in an English continuation. The
 * detector refuses to emit — honest UNKNOWN over confident guessing.
 */
function isPathVerbTerminal(
  goal: string,
  tokens: readonly { text: string; span: Nex1TextSpan }[],
  i: number,
): boolean {
  const t = tokens[i]!;

  // If token itself ends with sentence-terminal punctuation (tokenizer greedy
  // includes trailing `.` in char class), treat as terminal.
  const lastChar = t.text.slice(-1);
  if (".;!?".includes(lastChar)) return true;

  // Look at the raw goal after token end. Skip whitespace, then inspect the
  // next non-whitespace character (which may be punctuation or a token start).
  let scanIdx = t.span.end;
  while (scanIdx < goal.length && /\s/.test(goal[scanIdx]!)) scanIdx++;

  // T1 · EOF after whitespace.
  if (scanIdx >= goal.length) return true;

  // T2 · Sentence-terminating punctuation immediately after target.
  if (".,;!?".includes(goal[scanIdx]!)) return true;

  // Look at the next word token by array position.
  const nextT = i + 1 < tokens.length ? tokens[i + 1] : null;
  if (!nextT) return true; // no next token → terminal
  const nextLower = nextT.text.toLowerCase();

  // T3 · Next token is another well-known dir (list continuation).
  if (WELL_KNOWN_PROJECT_DIRS.has(nextLower)) return true;

  // T4 · Next token is a path_noun (directory / folder / etc.).
  if (PATH_NOUNS.has(nextLower)) return true;

  // T5 · Connector + well-known dir (list-with-connector).
  if (nextLower === "and" || nextLower === "or") {
    const nextNextT = i + 2 < tokens.length ? tokens[i + 2] : null;
    if (nextNextT && WELL_KNOWN_PROJECT_DIRS.has(nextNextT.text.toLowerCase())) return true;
  }

  // None of T1-T5 → English continuation. Suppress emission.
  return false;
}

/**
 * Extract project-directory references. Runs AFTER file-reference extraction
 * (so file-ref spans can be respected) and BEFORE coding-concept extraction
 * (so a well-known dir like `hooks` inside a path isn't double-counted as a
 * bare concept). See design doc
 * `project_nex1_cluster2_project_dirs_design_2026_09_16.md` and Founder
 * decisions of 2026-09-16.
 *
 * Three passes, in order:
 *   1. Directory portion of already-extracted file references → adjacent_file_ref
 *   2. Compound-path tokens (containing '/', not a filename) → path_segment,
 *      or trailing_slash if the token ends with '/'
 *   3. Bare-word tokens matching WELL_KNOWN_PROJECT_DIRS → evidence-gated
 *      emission (path_noun_anchor | path_verb_anchor | framework_anchor)
 *
 * A token can only be claimed once — later passes skip already-claimed spans.
 * Passes 1 and 2 always emit when they see a known dir segment (strong evidence);
 * pass 3 requires a nearby anchor per the founder-locked evidence gate.
 */
function extractProjectDirs(
  goal: string,
  tokens: readonly { text: string; span: Nex1TextSpan }[],
  fileRefs: readonly Nex1FileReference[],
): readonly Nex1ProjectDirReference[] {
  const out: Nex1ProjectDirReference[] = [];
  const claimed: { start: number; end: number }[] = [];

  const overlapsClaimed = (span: { start: number; end: number }): boolean =>
    claimed.some((r) => span.start < r.end && span.end > r.start);

  const claim = (start: number, end: number): void => {
    claimed.push({ start, end });
  };

  // ── Pass 1 · directory portion of file references ────────────────────────
  for (const fref of fileRefs) {
    const parts = fref.path.split("/");
    if (parts.length < 2) continue;
    const dirParts = parts.slice(0, -1);
    const anyKnown = dirParts.some((s) => WELL_KNOWN_PROJECT_DIRS.has(s.toLowerCase()));
    if (!anyKnown) continue;
    const dirStr = dirParts.join("/");
    const start = fref.span.start;
    const end = start + dirStr.length;
    out.push({
      path: dirStr,
      segments: dirParts.slice(),
      evidence: "adjacent_file_ref",
      span: { start, end, text: goal.slice(start, end) },
    });
    claim(fref.span.start, fref.span.end);
  }

  // ── Pass 2 · compound-path tokens (contain '/') ──────────────────────────
  for (const tok of tokens) {
    if (overlapsClaimed(tok.span)) continue;
    const lower = tok.text.toLowerCase();
    if (!lower.includes("/")) continue;

    // Trim trailing slashes and leading slashes.
    let stripped = lower;
    let hadTrailingSlash = false;
    while (stripped.endsWith("/")) {
      stripped = stripped.slice(0, -1);
      hadTrailingSlash = true;
    }
    while (stripped.startsWith("/")) stripped = stripped.slice(1);
    if (stripped.length === 0) continue;

    const segs = stripped.split("/").filter((s) => s.length > 0);
    if (segs.length === 0) continue;

    // Skip filename-shaped tokens (last segment has an internal dot). Dotfiles
    // like `.env` start with a dot and are excluded anyway by the "no /" check
    // in Pass 3.
    const lastSeg = segs[segs.length - 1] ?? "";
    if (lastSeg.includes(".") && !lastSeg.startsWith(".")) continue;

    const anyKnown = segs.some((s) => WELL_KNOWN_PROJECT_DIRS.has(s));
    if (!anyKnown) continue;

    const evidence: Nex1ProjectDirEvidenceKind = hadTrailingSlash ? "trailing_slash" : "path_segment";
    const spanEnd = hadTrailingSlash ? tok.span.end - 1 : tok.span.end;
    out.push({
      path: stripped,
      segments: segs,
      evidence,
      span: { start: tok.span.start, end: spanEnd, text: goal.slice(tok.span.start, spanEnd) },
    });
    claim(tok.span.start, tok.span.end);
  }

  // ── Pass 3 · bare-word tokens matching WELL_KNOWN_PROJECT_DIRS ───────────
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (overlapsClaimed(tok.span)) continue;
    const rawLower = tok.text.toLowerCase();
    // Tokenizer includes trailing sentence punctuation (`.`, `;`, `!`, `?`)
    // greedily in the token because those chars are in the char class. Strip
    // them for the dir-lookup so "services." matches "services".
    let lower = rawLower;
    let trailingPunc = 0;
    while (lower.length > 0 && ".;!?".includes(lower.slice(-1))) {
      lower = lower.slice(0, -1);
      trailingPunc++;
    }
    if (lower.includes("/") || lower.includes(".")) continue;
    if (!WELL_KNOWN_PROJECT_DIRS.has(lower)) continue;

    // Evidence gate. Priority (highest → lowest):
    //   framework_anchor (requires path_noun co-occurrence · founder #2)
    //   path_noun_anchor
    //   path_verb_anchor
    const prevLower = i > 0 ? tokens[i - 1]!.text.toLowerCase() : "";
    const windowStart = Math.max(0, i - 2);
    const windowEnd = Math.min(tokens.length - 1, i + 2);
    let hasPathNoun = false;
    let hasFramework = false;
    for (let j = windowStart; j <= windowEnd; j++) {
      if (j === i) continue;
      const nlower = tokens[j]!.text.toLowerCase();
      if (PATH_NOUNS.has(nlower)) hasPathNoun = true;
      if (CODING_LEXEME_INDEX.get(nlower) === "framework") hasFramework = true;
    }
    const hasPathVerbBefore = PATH_VERBS_PREPS.has(prevLower);

    let evidence: Nex1ProjectDirEvidenceKind | null = null;
    if (hasFramework && hasPathNoun) {
      // Founder decision #2 · framework anchor REQUIRES path_noun co-occurrence.
      evidence = "framework_anchor";
    } else if (hasPathNoun) {
      evidence = "path_noun_anchor";
    } else if (hasPathVerbBefore) {
      // v5.0.0-alpha.9 · path_verb_anchor bare-word emission requires the
      // target at a path-terminal position. See isPathVerbTerminal comment.
      // "in services rendered" no longer emits; "in services", "in
      // services.", "in services directory", "in components and hooks"
      // still emit correctly.
      if (isPathVerbTerminal(goal, tokens, i)) {
        evidence = "path_verb_anchor";
      }
    }
    if (!evidence) continue;

    // Span excludes any trailing punctuation the tokenizer swallowed.
    const emitSpanEnd = tok.span.end - trailingPunc;
    out.push({
      path: lower,
      segments: [lower],
      evidence,
      span: {
        start: tok.span.start,
        end: emitSpanEnd,
        text: goal.slice(tok.span.start, emitSpanEnd),
      },
    });
    claim(tok.span.start, tok.span.end);
  }

  // Deterministic order: by span start.
  return out.slice().sort((a, b) => a.span.start - b.span.start);
}

/**
 * Extract coding-concept tokens from the tokenised goal.
 *
 * Runs AFTER verb + deliverable extraction. A token is a coding concept iff:
 *   - it is in CODING_LEXEME_INDEX (tool / framework / concept / language), AND
 *   - it is not the exact text of a verb hit (verbs already claimed it), AND
 *   - it is not inside a file-reference span.
 *
 * Tokens inside the matched deliverable phrase are allowed as concepts —
 * intentional overlap so "build a react component" carries both
 * deliverable=component AND concept=react.
 */
function extractCodingConcepts(
  tokens: readonly { text: string; span: Nex1TextSpan }[],
  fileRefs: readonly Nex1FileReference[],
  verbHits: readonly Nex1VerbHit[],
): readonly Nex1CodingConceptToken[] {
  const verbSpans = new Set(verbHits.map((v) => `${v.span.start}:${v.span.end}`));
  const fileRefSpans = fileRefs.map((f) => f.span);
  const isInsideFileRef = (t: { span: Nex1TextSpan }): boolean =>
    fileRefSpans.some((s) => t.span.start >= s.start && t.span.end <= s.end);

  const buckets = new Map<
    string,
    { category: Nex1CodingConceptToken["category"]; spans: Nex1TextSpan[]; firstIndex: number }
  >();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const lower = t.text.toLowerCase();
    const category = CODING_LEXEME_INDEX.get(lower);
    if (!category) continue;
    if (verbSpans.has(`${t.span.start}:${t.span.end}`)) continue;
    if (isInsideFileRef(t)) continue;

    const existing = buckets.get(lower);
    if (existing) {
      existing.spans.push(t.span);
    } else {
      buckets.set(lower, { category, spans: [t.span], firstIndex: i });
    }
  }
  const arr: Nex1CodingConceptToken[] = [];
  for (const [token, data] of buckets) {
    arr.push({
      token,
      category: data.category,
      occurrences: data.spans.length,
      spans: data.spans,
    });
  }
  // Sort: by first-appearance index for stable output.
  arr.sort(
    (a, b) => (buckets.get(a.token)!.firstIndex - buckets.get(b.token)!.firstIndex),
  );
  return arr;
}

/** Scan the lower-cased goal for deliverable phrases (longer phrases first). */
function scanDeliverables(
  goalLower: string,
): { kind: Nex1DeliverableKind; span: Nex1TextSpan; matchedPhrase: string } | null {
  for (const entry of DELIVERABLE_SCAN_ORDER) {
    const idx = goalLower.indexOf(entry.phrase);
    if (idx < 0) continue;
    // Whole-word boundary check on both sides to avoid "map" inside "mapping" etc.
    const before = idx === 0 ? "" : goalLower[idx - 1] ?? "";
    const after = goalLower[idx + entry.phrase.length] ?? "";
    if (isWordBoundaryChar(before) && isWordBoundaryChar(after)) {
      return {
        kind: entry.kind,
        span: { start: idx, end: idx + entry.phrase.length, text: entry.phrase },
        matchedPhrase: entry.phrase,
      };
    }
  }
  return null;
}

function isWordBoundaryChar(ch: string): boolean {
  if (ch === "") return true;
  return !/[a-z0-9]/i.test(ch);
}

/**
 * Extract requirement phrases anchored on locked markers.
 *
 * v5.0.0-alpha.10 · Context Evidence Gate (CEG) integration:
 * Each marker match is consulted against `requirementMarkerGate()` before
 * emission. REJECT verdicts suppress emission (English perfective/passive,
 * temporal "within", English quantifier "only", speculative modal frames).
 * ACCEPT emissions retain the existing behaviour. UNKNOWN treated as REJECT
 * per founder's "when NEX cannot know, it says UNKNOWN rather than guessing".
 *
 * Existing behaviour preserved for strong markers ("must be able to",
 * "must not", "should not", "shall not", "verify/confirm/prove ...", etc.).
 */
function extractRequirementPhrases(goalLower: string, goal: string): readonly Nex1RequirementPhrase[] {
  const out: Nex1RequirementPhrase[] = [];
  const claimedRanges: { start: number; end: number }[] = [];

  for (const marker of REQUIREMENT_MARKERS) {
    let searchFrom = 0;
    while (searchFrom < goalLower.length) {
      const idx = goalLower.indexOf(marker.prefix, searchFrom);
      if (idx < 0) break;

      // Must be at a word boundary at the start.
      const beforeCh = idx === 0 ? "" : goalLower[idx - 1] ?? "";
      const afterMarkerCh = goalLower[idx + marker.prefix.length] ?? "";
      const startBoundary = isWordBoundaryChar(beforeCh);
      const endBoundary = isWordBoundaryChar(afterMarkerCh);

      if (startBoundary && endBoundary) {
        const alreadyClaimed = claimedRanges.some(
          (r) => idx >= r.start && idx < r.end,
        );
        if (!alreadyClaimed) {
          // v5.0.0-alpha.10 · CEG check. Under founder rule, ACCEPT emits,
          // REJECT and UNKNOWN both suppress.
          const verdict = requirementMarkerGate(
            goal,
            marker.prefix,
            idx,
            idx + marker.prefix.length,
          );
          if (verdict === "ACCEPT") {
            const phraseEnd = findClauseEnd(goalLower, idx + marker.prefix.length);
            const span: Nex1TextSpan = {
              start: idx,
              end: phraseEnd,
              text: goal.slice(idx, phraseEnd).trim(),
            };
            out.push({ kind: marker.kind, evidence: span });
            claimedRanges.push({ start: idx, end: phraseEnd });
          }
          // REJECT / UNKNOWN → do NOT claim range; a stronger marker at
          // a longer prefix (or a different position) may still match here.
        }
      }
      searchFrom = idx + marker.prefix.length;
    }
  }
  // Sort by original position for stable output.
  out.sort((a, b) => a.evidence.start - b.evidence.start);
  return out;
}

/** Find the end of the current clause: nearest ",", ".", ";", "\n", or end-of-string. */
function findClauseEnd(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (ch === "." || ch === "," || ch === ";" || ch === "\n") return i;
  }
  return text.length;
}

/**
 * Extract domain tokens (top-N by occurrence, ties broken by first-appearance).
 * Excludes: stop-words, verb lexemes, deliverable phrase words, coding-concept
 * lexemes (they moved to the coding_concepts field), file-path pieces, tokens
 * shorter than 3 chars, purely-numeric tokens.
 */
function extractDomainTokens(
  tokens: readonly { text: string; span: Nex1TextSpan }[],
  deliverableMatchedPhrase: string | null,
  fileRefs: readonly Nex1FileReference[],
): readonly Nex1DomainToken[] {
  const deliverableWords = new Set<string>();
  if (deliverableMatchedPhrase) {
    for (const w of deliverableMatchedPhrase.split(/\s+/)) deliverableWords.add(w);
  }
  const fileRefSpans = fileRefs.map((f) => f.span);
  const isInsideFileRef = (t: { span: Nex1TextSpan }): boolean =>
    fileRefSpans.some((s) => t.span.start >= s.start && t.span.end <= s.end);

  const buckets = new Map<string, { occurrences: number; spans: Nex1TextSpan[]; firstIndex: number }>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const lower = t.text.toLowerCase();
    if (lower.length < 3) continue;
    if (/^\d+$/.test(lower)) continue;
    if (STOP_WORDS.has(lower)) continue;
    if (VERB_LEXEME_INDEX.has(lower)) continue;
    if (CODING_LEXEME_INDEX.has(lower)) continue; // goes to coding_concepts
    if (deliverableWords.has(lower)) continue;
    if (isInsideFileRef(t)) continue;
    if (lower.includes("/") || lower.includes(".")) continue; // filepath fragments

    const existing = buckets.get(lower);
    if (existing) {
      existing.occurrences += 1;
      existing.spans.push(t.span);
    } else {
      buckets.set(lower, { occurrences: 1, spans: [t.span], firstIndex: i });
    }
  }

  const arr: Nex1DomainToken[] = [];
  for (const [token, data] of buckets) {
    arr.push({ token, occurrences: data.occurrences, spans: data.spans });
  }
  // Sort: higher occurrences first, then earlier first-appearance for ties.
  arr.sort((a, b) => {
    if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
    const aFirst = buckets.get(a.token)!.firstIndex;
    const bFirst = buckets.get(b.token)!.firstIndex;
    return aFirst - bFirst;
  });
  return arr.slice(0, NEX1_INTENT_MAX_DOMAIN_TOKENS);
}

/** Count verb hits and pick the winning family. */
function classifyVerbFamily(
  tokens: readonly { text: string; span: Nex1TextSpan }[],
  trace: string[],
): {
  winner: Nex1VerbFamily | null;
  confidence: number;
  hits: readonly Nex1VerbHit[];
  tiedTop: boolean;
} {
  const perFamily = new Map<Nex1VerbFamily, number>();
  const hits: Nex1VerbHit[] = [];
  for (const t of tokens) {
    const lower = t.text.toLowerCase();
    // Fix 2026-09-16 · TOKEN_RE includes "." in the character class (needed for
    // filenames like foo.ts). This means a verb at the end of a sentence
    // captures the trailing period · e.g. "Investigate." → "investigate.".
    // Strip trailing punctuation before verb-family lookup so sentence-final
    // verbs are recognised. Filename tokens still preserve their extension
    // because the period is INTERNAL (e.g. "foo.ts" has no trailing punct).
    const stripped = lower.replace(/[.,;:!?]+$/, "");
    const family = VERB_LEXEME_INDEX.get(stripped);
    if (!family) continue;
    perFamily.set(family, (perFamily.get(family) ?? 0) + 1);
    hits.push({ family, variant: stripped, span: t.span });
  }

  const totalHits = hits.length;
  trace.push(`verb_hits_total=${totalHits} · per_family=${JSON.stringify(Object.fromEntries(perFamily))}`);

  if (totalHits === 0) return { winner: null, confidence: 0, hits, tiedTop: false };

  // Winner = family with highest count. Tiebreak = family whose FIRST hit appears earliest.
  const firstHitIndex = new Map<Nex1VerbFamily, number>();
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]!;
    if (!firstHitIndex.has(h.family)) firstHitIndex.set(h.family, i);
  }

  let topFamily: Nex1VerbFamily | null = null;
  let topCount = -1;
  let tiedFamilies: Nex1VerbFamily[] = [];
  for (const [family, count] of perFamily) {
    if (count > topCount) {
      topFamily = family;
      topCount = count;
      tiedFamilies = [family];
    } else if (count === topCount) {
      tiedFamilies.push(family);
    }
  }

  const tiedTop = tiedFamilies.length > 1;
  let winner: Nex1VerbFamily = topFamily!;
  if (tiedTop) {
    // Tiebreak by earliest first-appearance.
    tiedFamilies.sort((a, b) => (firstHitIndex.get(a) ?? 0) - (firstHitIndex.get(b) ?? 0));
    winner = tiedFamilies[0]!;
    trace.push(`tiebreak · tied_families=[${tiedFamilies.join(",")}] · winner_by_first_appearance=${winner}`);
  }

  const confidence = topCount / totalHits;
  return { winner, confidence, hits, tiedTop };
}

/** Compute overall confidence combining signals. */
function computeOverallConfidence(
  verbConfidence: number,
  deliverableConfidence: number,
  domainCount: number,
  requirementCount: number,
): number {
  // Deterministic weighted sum. Weights sum to 1.
  const domainSignal = Math.min(1, domainCount / 3); // saturates at 3 domain tokens
  const requirementSignal = Math.min(1, requirementCount / 2); // saturates at 2 phrases
  const combined =
    0.45 * verbConfidence +
    0.25 * deliverableConfidence +
    0.15 * domainSignal +
    0.15 * requirementSignal;
  // Clamp defensively.
  return Math.min(1, Math.max(0, Number(combined.toFixed(4))));
}

/**
 * Main entry point. Pure function. Deterministic.
 */
export function classifyFounderIntent(goalRaw: string): Nex1IntentResult {
  const trace: string[] = [];

  if (typeof goalRaw !== "string") {
    return refuse("refused_empty_goal", "goal is not a string", ["typeof goal !== 'string'"], 0);
  }
  const goal = goalRaw.trim();
  const goalLength = goal.length;
  trace.push(`goal_length=${goalLength}`);

  if (goalLength === 0) {
    return refuse("refused_empty_goal", "goal is empty after trim", trace, 0);
  }
  if (goalLength < NEX1_INTENT_MIN_GOAL_CHARS) {
    return refuse(
      "refused_goal_too_short",
      `goal length ${goalLength} < minimum ${NEX1_INTENT_MIN_GOAL_CHARS}`,
      trace,
      goalLength,
    );
  }
  if (goalLength > NEX1_INTENT_MAX_GOAL_CHARS) {
    return refuse(
      "refused_goal_too_long",
      `goal length ${goalLength} > maximum ${NEX1_INTENT_MAX_GOAL_CHARS}`,
      trace,
      goalLength,
    );
  }

  const goalLower = goal.toLowerCase();
  const tokens = tokenise(goal);
  trace.push(`token_count=${tokens.length}`);

  // Verb classification
  let verbResult = classifyVerbFamily(tokens, trace);
  if (verbResult.winner === null) {
    // C2 Phase 3 · deterministic paraphrase fallback.
    // Same shape as the orchestrator's Layer 1.5 fallback: only fires when the
    // vocabulary's own verb lexicon missed. Synthesises a single verb hit from
    // the paraphrase source span so downstream signals still have evidence.
    const para = lookupParaphrase(goal);
    const family = para ? PARAPHRASE_SLUG_TO_VERB_FAMILY[para.target_slug] ?? null : null;
    if (para && family) {
      const srcLower = para.source.toLowerCase();
      const idx = goalLower.indexOf(srcLower);
      const start = idx >= 0 ? idx : 0;
      const end = idx >= 0 ? idx + srcLower.length : Math.min(goal.length, srcLower.length);
      const paraphraseHit: Nex1VerbHit = {
        family,
        variant: srcLower,
        span: { start, end, text: goal.slice(start, end) },
      };
      verbResult = { winner: family, confidence: 0.85, hits: [paraphraseHit], tiedTop: false };
      trace.push(`paraphrase_fallback · "${para.source}" → verb_family=${family} · via ${para.match_method}`);
    } else {
      return refuse(
        "refused_no_verb_recognised",
        "no verb from the controlled vocabulary appeared in the goal",
        trace,
        goalLength,
      );
    }
  }
  // A tied top is a real refusal only when confidence is exactly split AND no first-appearance tiebreak is safe.
  // Our tiebreak IS deterministic (first-appearance), so we permit it and flag as ambiguity, not refusal.
  // However, when >1 family has EXACTLY the same count as the winner, we still record an ambiguity.

  // Deliverable classification
  const deliverableMatch = scanDeliverables(goalLower);
  const deliverableKind: Nex1DeliverableKind = deliverableMatch?.kind ?? "unclear";
  const deliverableConfidence = deliverableMatch ? 1.0 : 0.0;
  if (deliverableMatch) {
    trace.push(`deliverable_matched='${deliverableMatch.matchedPhrase}' → kind=${deliverableMatch.kind}`);
  } else {
    trace.push(`deliverable_no_match · kind=unclear`);
  }

  // File references (regex-based, spans preserved; also picks up well-known
  // config files without an extension like Dockerfile / Gemfile).
  const fileRefs = extractFileReferences(goal);
  trace.push(`file_references=${fileRefs.length}`);

  // Project directory references (Phase 1.10-alpha.2). Evidence-gated:
  // bare-word tokens require a path_noun / path_verb / framework anchor,
  // compound paths and trailing-slash tokens emit with structural evidence.
  const projectDirRefs = extractProjectDirs(goal, tokens, fileRefs);
  trace.push(
    `project_dir_references=${projectDirRefs.length}${
      projectDirRefs.length > 0
        ? ` · by_evidence=${JSON.stringify(
            projectDirRefs.reduce<Record<string, number>>((acc, r) => {
              acc[r.evidence] = (acc[r.evidence] ?? 0) + 1;
              return acc;
            }, {}),
          )}`
        : ""
    }`,
  );

  // Requirement phrases
  const requirementPhrases = extractRequirementPhrases(goalLower, goal);
  trace.push(`requirement_phrases=${requirementPhrases.length}`);

  // Coding concepts (tools / frameworks / concepts / languages)
  const codingConcepts = extractCodingConcepts(tokens, fileRefs, verbResult.hits);
  trace.push(
    `coding_concepts=${codingConcepts.length}${
      codingConcepts.length > 0
        ? ` · by_category=${JSON.stringify(
            codingConcepts.reduce<Record<string, number>>((acc, c) => {
              acc[c.category] = (acc[c.category] ?? 0) + 1;
              return acc;
            }, {}),
          )}`
        : ""
    }`,
  );

  // Domain tokens (business-domain nouns — excludes coding concepts)
  const domainTokens = extractDomainTokens(tokens, deliverableMatch?.matchedPhrase ?? null, fileRefs);
  trace.push(`domain_tokens=${domainTokens.length}${
    domainTokens.length > 0 ? ` · top=${domainTokens.slice(0, 3).map((d) => d.token).join(",")}` : ""
  }`);

  // Ambiguities
  const ambiguities: Nex1AmbiguityFlag[] = [];
  if (verbResult.confidence < NEX1_INTENT_LOW_CONFIDENCE_BAND) {
    ambiguities.push({
      kind: "low_verb_confidence",
      detail: `verb_family_confidence=${verbResult.confidence.toFixed(3)} below band ${NEX1_INTENT_LOW_CONFIDENCE_BAND}`,
    });
  }
  if (verbResult.tiedTop) {
    ambiguities.push({
      kind: "multiple_verb_families_close",
      detail: `two or more verb families tied on hit count · resolved by earliest first-appearance`,
    });
  }
  if (deliverableKind === "unclear") {
    ambiguities.push({
      kind: "low_deliverable_confidence",
      detail: `no deliverable phrase from the controlled vocabulary matched`,
    });
  }
  if (domainTokens.length === 0) {
    ambiguities.push({
      kind: "no_domain_extracted",
      detail: `no domain tokens survived stop-word + verb + deliverable filtering`,
    });
  }
  if (requirementPhrases.length === 0) {
    ambiguities.push({
      kind: "requirement_phrases_missing",
      detail: `no phrases matched the requirement marker set`,
    });
  }
  if (codingConcepts.length === 0 && domainTokens.length === 0) {
    ambiguities.push({
      kind: "no_coding_context_detected",
      detail: `no tools / frameworks / concepts / languages recognised, and no domain tokens survived filtering`,
    });
  }

  const overallConfidence = computeOverallConfidence(
    verbResult.confidence,
    deliverableConfidence,
    domainTokens.length,
    requirementPhrases.length,
  );
  trace.push(
    `overall_confidence=${overallConfidence} = 0.45·${verbResult.confidence.toFixed(3)} + 0.25·${deliverableConfidence} + 0.15·domain(${domainTokens.length}) + 0.15·req(${requirementPhrases.length})`,
  );

  const result: Nex1IntentClassified = {
    kind: "classified",
    verb_family: verbResult.winner,
    verb_family_confidence: Number(verbResult.confidence.toFixed(4)),
    verb_hits: verbResult.hits,
    deliverable_kind: deliverableKind,
    deliverable_confidence: deliverableConfidence,
    domain_tokens: domainTokens,
    coding_concepts: codingConcepts,
    file_references: fileRefs,
    project_dir_references: projectDirRefs,
    requirement_phrases: requirementPhrases,
    ambiguities,
    overall_confidence: overallConfidence,
    reasoning_trace: trace,
    goal_length: goalLength,
    vocabulary_version: VOCABULARY_VERSION,
    taught_by: TAUGHT_BY,
  };
  return result;
}
