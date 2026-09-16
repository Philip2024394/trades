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
} from "./vocabulary";

const TAUGHT_BY = "master_ai_engineer" as const;

// Whitespace + punctuation splitter. Preserves original char offsets via slice.
// Keeps letters, digits, underscore, hyphen, dot, slash — enough for file paths.
const TOKEN_RE = /[A-Za-z][A-Za-z0-9._/\-]*/g;

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

/** Extract requirement phrases anchored on locked markers. */
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
        const phraseEnd = findClauseEnd(goalLower, idx + marker.prefix.length);
        const alreadyClaimed = claimedRanges.some(
          (r) => idx >= r.start && idx < r.end,
        );
        if (!alreadyClaimed) {
          const span: Nex1TextSpan = {
            start: idx,
            end: phraseEnd,
            text: goal.slice(idx, phraseEnd).trim(),
          };
          out.push({ kind: marker.kind, evidence: span });
          claimedRanges.push({ start: idx, end: phraseEnd });
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
    const family = VERB_LEXEME_INDEX.get(lower);
    if (!family) continue;
    perFamily.set(family, (perFamily.get(family) ?? 0) + 1);
    hits.push({ family, variant: lower, span: t.span });
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
  const verbResult = classifyVerbFamily(tokens, trace);
  if (verbResult.winner === null) {
    return refuse(
      "refused_no_verb_recognised",
      "no verb from the controlled vocabulary appeared in the goal",
      trace,
      goalLength,
    );
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
