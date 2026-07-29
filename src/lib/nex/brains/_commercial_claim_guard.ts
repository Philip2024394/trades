// src/lib/nex/brains/_commercial_claim_guard.ts
//
// Phase 1.5 · Commercial Claim Guard (Philip 2026-07-29)
// ────────────────────────────────────────────────────────────────────
// Cross-cutting post-composition guard. Runs for EVERY intent (not
// just terminology). Detects the class of claim Philip flagged in his
// four-probe assessment:
//
//   • unsupported numeric multipliers      ("2x", "3-4x", "twice as expensive")
//   • unsupported percentages              ("15-25%", "40 percent")
//   • unsupported dimensional absolutes    ("1400-1600mm", "900mm minimum")
//   • catalogue-style product language     ("Made to order", "View | Quote")
//   • hard tier labels                     ("Premium tier ·", used as row label)
//   • regulation absolutes without citation ("loft-only legal", "not permitted")
//
// Design rule (Philip 2026-07-29): "When should I give a general trade
// explanation, and when am I making a commercial claim that needs
// evidence?" — the guard enforces the distinction.
//
// Rule A/B/C compliance:
//   Rule A · every claim above becomes silence-worthy when unsupported
//   Rule B · the guard is code · authored content untouched
//   Rule C · claims permitted only when the number/label appears in the
//           retrieval context OR the sentence carries a regulation citation
//
// Support test principle:
//   For a numeric claim (multiplier / percentage / dimension), the
//   NUMBER itself must appear in at least one context snippet.
//   For tier labels, the SAME tier vocabulary must appear in context.
//   For product-availability language, the guard treats this as
//   never-supported (no product catalogue is wired to the composer today).
//   For regulation absolutes, the SAME sentence must cite Approved
//   Document K / BS EN / etc.

export type ClaimKind =
  | "multiplier"
  | "percentage"
  | "dimension"
  | "product_availability"
  | "tier_label"
  | "regulation_absolute";

export type ClaimHit = {
  kind:     ClaimKind;
  text:     string;   // the matched substring
  sentence: string;   // the sentence containing it
  reason:   string;   // why the guard flagged it
};

export type GuardResult = {
  passed:            boolean;
  unsupported:       ClaimHit[];
  retry_hint?:       string;   // added to the LLM prompt on retry
  stripped_answer?:  string;   // safety fallback if retry not attempted / fails
};

// ─── Detection patterns ─────────────────────────────────────────────

type PatternDef = {
  kind:     ClaimKind;
  pattern:  RegExp;
  // extract the "supportable atom" from the match (e.g. the number)
  atom?:    (match: RegExpExecArray) => string | null;
};

const PATTERNS: PatternDef[] = [
  // Numeric multipliers: "2x", "3.5x", "3-4x", "10 ×"
  { kind: "multiplier",
    pattern: /\b(\d+(?:\.\d+)?)(?:\s*-\s*\d+(?:\.\d+)?)?\s*[x×]\b/gi,
    atom: (m) => m[1] },
  // Word-form multipliers: "twice as expensive", "three times more", "double the cost"
  { kind: "multiplier",
    pattern: /\b(twice|three\s+times|four\s+times|five\s+times|half|double|triple|quadruple)\s+(?:as\s+)?(?:much|expensive|the\s+cost|the\s+price|as\s+long|the\s+size|as\s+wide)\b/gi,
    atom: (m) => m[1].toLowerCase() },
  // "two to three times", "3 to 4 times"
  { kind: "multiplier",
    pattern: /\b(?:one|two|three|four|five|\d+)\s+to\s+(?:one|two|three|four|five|\d+)\s+times\b/gi,
    atom: (m) => m[0].toLowerCase() },
  // Percentages: "15%", "25.5%", "15-25%", "40 percent"
  { kind: "percentage",
    pattern: /\b(\d+(?:\.\d+)?)(?:\s*-\s*\d+(?:\.\d+)?)?\s*%/g,
    atom: (m) => m[1] },
  { kind: "percentage",
    pattern: /\b(\d+)\s+to\s+(\d+)\s+percent\b/gi,
    atom: (m) => m[1] },
  // Dimensions: "1400mm", "1400-1600mm", "900 mm", "2000 mm minimum"
  { kind: "dimension",
    pattern: /\b(\d+(?:\.\d+)?)(?:\s*-\s*\d+(?:\.\d+)?)?\s*mm\b/g,
    atom: (m) => m[1] },
  { kind: "dimension",
    pattern: /\b(\d+(?:\.\d+)?)\s*(?:cm|centimetres?|centimeters?)\b/gi,
    atom: (m) => m[1] },
  // Tier labels used as catalogue-style row/bullet metadata
  // Pattern deliberately targets the "· Premium tier ·" or "Premium tier |" shape
  // rather than prose usage ("premium options" is fine).
  { kind: "tier_label",
    pattern: /\b(premium|entry|bespoke|mid|top|luxury|budget|entry-to-mid|mid-plus)(?:-to-\w+)?\s+tier\b/gi,
    atom: (m) => m[1].toLowerCase() },
  // Product availability language
  { kind: "product_availability",
    pattern: /\b(?:made\s+to\s+order|in\s+stock|out\s+of\s+stock|short\s+lead\s+time|next-?day\s+delivery)\b/gi },
  { kind: "product_availability",
    pattern: /\b(?:view|quote)\s*[|·]\s*(?:view|quote)\b/gi },
  // Regulation absolutes without inline citation — the sentence-level
  // citation check happens in evaluateHit below.
  { kind: "regulation_absolute",
    pattern: /\bloft[- ]only\s+(?:legal|permitted|allowed|use|access)\b/gi },
  { kind: "regulation_absolute",
    pattern: /\b(?:not\s+permitted|not\s+legal|not\s+allowed)\s+(?:under\s+UK|by\s+regulation|by\s+law)\b/gi },
  { kind: "regulation_absolute",
    pattern: /\billegal\s+(?:under\s+UK|in\s+the\s+UK|in\s+domestic)\b/gi },
  { kind: "regulation_absolute",
    pattern: /\bmust\s+not\s+(?:exceed|be\s+less|be\s+more|be\s+greater|be\s+smaller)\b/gi },
];

// Regulation citations that legitimise a regulation-absolute statement
// when they appear in the SAME sentence.
const REGULATION_CITATIONS = [
  /Approved\s+Document\s+K/i,
  /Approved\s+Doc\s+K/i,
  /\bADK\b/,
  /BS\s?\d/i,
  /BS\s+EN\b/i,
  /Building\s+Regulations/i,
  /Building\s+Standards/i,
  /Technical\s+Booklet\s+H/i,
];

// ─── Public API ────────────────────────────────────────────────────

export function runCommercialClaimGuard(
  answer: string,
  contextSnippets: string[],
): GuardResult {
  const contextJoined = contextSnippets.join(" \n ").toLowerCase();
  const sentences = splitSentences(answer);
  const unsupported: ClaimHit[] = [];

  for (const def of PATTERNS) {
    const p = new RegExp(def.pattern.source, def.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = p.exec(answer)) !== null) {
      const text = m[0];
      const sentence = findSentence(answer, m.index, sentences);
      const hit = evaluateHit(def, text, m, sentence, contextJoined);
      if (hit) unsupported.push(hit);
      // Guard against zero-length matches causing infinite loops
      if (m.index === p.lastIndex) p.lastIndex++;
    }
  }

  if (unsupported.length === 0) {
    return { passed: true, unsupported: [] };
  }

  // Deduplicate on (kind + text) to keep the retry hint short
  const deduped = dedupeHits(unsupported);
  const retry_hint = buildRetryHint(deduped);
  const stripped_answer = stripUnsupportedSentences(answer, sentences, deduped);

  return {
    passed: false,
    unsupported: deduped,
    retry_hint,
    stripped_answer,
  };
}

// ─── Evaluation ────────────────────────────────────────────────────

function evaluateHit(
  def: PatternDef,
  text: string,
  match: RegExpExecArray,
  sentence: string,
  contextJoined: string,
): ClaimHit | null {
  const sentenceLower = sentence.toLowerCase();
  const textLower = text.toLowerCase();

  switch (def.kind) {
    case "regulation_absolute": {
      // Allowed when the same sentence carries a regulation citation
      if (REGULATION_CITATIONS.some((r) => r.test(sentence))) return null;
      return {
        kind: def.kind,
        text,
        sentence: sentence.trim(),
        reason: `regulation absolute without citation in the same sentence`,
      };
    }
    case "product_availability": {
      // Product catalogue framing is never supported (no product database
      // is wired to the composer today). If one lands later, extend here.
      return {
        kind: def.kind,
        text,
        sentence: sentence.trim(),
        reason: `catalogue-style availability language · no product database is wired to the composer`,
      };
    }
    case "tier_label": {
      // Allowed only when the same tier vocabulary appears in the context
      if (contextJoined.includes(textLower)) return null;
      return {
        kind: def.kind,
        text,
        sentence: sentence.trim(),
        reason: `tier label '${text}' not present in retrieval context`,
      };
    }
    case "multiplier":
    case "percentage":
    case "dimension": {
      const atom = def.atom ? def.atom(match) : null;
      if (!atom) return null;
      if (contextJoined.includes(atom.toLowerCase())) return null;
      // For dimensions also try the number+unit shape as a stricter check
      if (def.kind === "dimension") {
        const withUnit = `${atom} mm`.toLowerCase();
        const withUnitTight = `${atom}mm`.toLowerCase();
        if (contextJoined.includes(withUnit) || contextJoined.includes(withUnitTight)) return null;
      }
      return {
        kind: def.kind,
        text,
        sentence: sentence.trim(),
        reason: `${def.kind} '${atom}' not present in retrieval context`,
      };
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  // Split on sentence terminators OR paragraph breaks. Preserves the
  // sentence's position via prefix/suffix trimming after the join.
  return text
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function findSentence(text: string, position: number, sentences: string[]): string {
  let cursor = 0;
  for (const s of sentences) {
    const start = text.indexOf(s, cursor);
    if (start < 0) continue;
    const end = start + s.length;
    if (position >= start && position <= end) return s;
    cursor = end;
  }
  return sentences[0] ?? text.slice(0, 200);
}

function dedupeHits(hits: ClaimHit[]): ClaimHit[] {
  const seen = new Set<string>();
  const out: ClaimHit[] = [];
  for (const h of hits) {
    const key = `${h.kind}::${h.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function buildRetryHint(hits: ClaimHit[]): string {
  // Group hits by kind for a readable brief · keep the whole hint short
  // so the LLM re-reads and adjusts without confusion.
  const byKind: Partial<Record<ClaimKind, string[]>> = {};
  for (const h of hits) {
    (byKind[h.kind] ??= []).push(h.text);
  }
  const parts: string[] = [];
  const kindLabels: Record<ClaimKind, string> = {
    multiplier:            "numeric multipliers",
    percentage:            "percentages",
    dimension:             "dimensions",
    tier_label:            "tier labels used as catalogue metadata",
    product_availability:  "product-availability language",
    regulation_absolute:   "regulation absolutes without citation",
  };
  for (const kind of Object.keys(byKind) as ClaimKind[]) {
    parts.push(`${kindLabels[kind]}: ${byKind[kind]!.slice(0, 4).map((t) => `"${t}"`).join(", ")}`);
  }
  return [
    "The previous attempt included claims not supported by the CONTEXT:",
    ...parts.map((p) => `  · ${p}`),
    "",
    "Regenerate using qualitative language where those claims appeared",
    "(e.g. 'generally more expensive', 'requires more skilled manufacture',",
    "'considerably wider footprint', 'common industry options include...').",
    "For regulation statements, cite Approved Document K / BS EN by name",
    "in the same sentence, or use conditional wording ('may be subject to",
    "restrictions under UK Building Regulations — confirm with local",
    "building control').",
    "Do NOT invent numbers, dimensions, tier labels, or product availability.",
  ].join("\n");
}

function stripUnsupportedSentences(
  answer: string,
  sentences: string[],
  hits: ClaimHit[],
): string {
  const badSentences = new Set(hits.map((h) => h.sentence.trim()));
  const kept: string[] = [];
  let cursor = 0;
  for (const s of sentences) {
    const idx = answer.indexOf(s, cursor);
    if (idx < 0) continue;
    if (!badSentences.has(s.trim())) {
      kept.push(s);
    }
    cursor = idx + s.length;
  }
  const rebuilt = kept.join(" ").replace(/\s{2,}/g, " ").trim();
  return rebuilt;
}
