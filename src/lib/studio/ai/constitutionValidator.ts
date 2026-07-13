// constitutionValidator — the auto-retry quality gate.
//
// Lovable's actual quality secret (per the 2026-07-09 research pass)
// isn't the model — it's the `design-system.json` adherence check +
// retry loop. Generated output is inspected against the constitution;
// on violations, the LLM is called again with the specific violations
// fed back in as feedback context.
//
// This module implements the same pattern for our bespoke-prose
// output. It's a pure inspector + a retry wrapper — no LLM-specific
// coupling beyond a caller-supplied `run` function.
//
// Rules mirror `platform/design/CONSTITUTION.md` §2 (universal) and
// the "STRICT RULES" block in bespokeProse.ts. Any drift here should
// be flagged as a constitution-vs-validator mismatch.

import type { BespokePageCopy, BespokeProse } from "./bespokeProse";

export type ConstitutionViolation = {
  path: string;
  rule: string;
  detail: string;
  severity: "block" | "warn";
};

/** Banned marketing-speak that reads as horizontal-SaaS, not UK trades. */
const BANNED_WORDS = [
  "premium",
  "curated",
  "boutique",
  "elevated",
  "solutions",
  "empowering",
  "unlock",
  "delight",
  "revolutionise",
  "revolutionize",
  "seamless",
  "cutting-edge",
  "world-class",
  "innovative",
  "leverage",
  "synergy",
  "utilize"
];

/** Trades-native voice — if none of these appear across the whole
 *  prose block, we suspect the AI drifted into generic marketing.
 *  Warning-severity only. */
const TRADES_NATIVE_HINTS = [
  "gas safe",
  "cpcs",
  "niceic",
  "on the tools",
  "smashed",
  "callout",
  "insured",
  "public liability",
  "we ",
  "mate",
  "trade",
  "job"
];

const LOREM_PATTERN = /\b(lorem ipsum|dolor sit amet|consectetur)\b/i;
const HEX_PATTERN = /#[0-9A-Fa-f]{3,8}\b/;

const LENGTH_CEILINGS: Record<string, number> = {
  "hero.eyebrow": 60,
  "hero.headline": 80,
  "hero.subhead": 200,
  "hero.ctaPrimary": 40,
  "hero.ctaSecondary": 40,
  "about.heading": 60,
  "about.story": 500,
  "services.heading": 60,
  "services.items.title": 60,
  "services.items.description": 120,
  "services.items.priceHint": 40,
  "contact.heading": 60,
  "contact.subhead": 240,
  "contact.responsePromise": 160,
  "projects.heading": 60,
  "projects.subhead": 240,
  "faq.heading": 60,
  "faq.items.question": 160,
  "faq.items.answer": 240,
  "reviews.heading": 60,
  "reviews.subhead": 240
};

function checkString(
  value: string,
  path: string,
  violations: ConstitutionViolation[],
  aggregatedText: string[]
): void {
  aggregatedText.push(value);

  // Length ceiling
  const ceiling = LENGTH_CEILINGS[path];
  if (ceiling && value.length > ceiling) {
    violations.push({
      path,
      rule: "length",
      detail: `Exceeds ${ceiling} char ceiling — got ${value.length}.`,
      severity: "block"
    });
  }

  // Banned marketing-speak
  const lower = value.toLowerCase();
  for (const w of BANNED_WORDS) {
    // Use word boundaries to avoid false positives (e.g. "revolutionise" match on "resolution")
    const re = new RegExp(`\\b${w}\\b`, "i");
    if (re.test(lower)) {
      violations.push({
        path,
        rule: "banned-word",
        detail: `Contains banned marketing-speak "${w}" — replace with trade-plain language.`,
        severity: "block"
      });
    }
  }

  // Lorem ipsum
  if (LOREM_PATTERN.test(value)) {
    violations.push({
      path,
      rule: "lorem-ipsum",
      detail: "Placeholder Latin detected — must be real UK-trade content.",
      severity: "block"
    });
  }

  // Hard-coded hex colours in copy
  if (HEX_PATTERN.test(value)) {
    violations.push({
      path,
      rule: "hard-coded-hex",
      detail: "Copy contains a hex colour — colours are brand-token driven, remove.",
      severity: "warn"
    });
  }
}

/** Recursively walk a BespokePageCopy and validate every string. */
function validatePage(
  page: BespokePageCopy,
  pageIdx: number,
  violations: ConstitutionViolation[],
  aggregatedText: string[]
): void {
  const prefix = `pages[${pageIdx}:${page.pageId}]`;

  if (page.hero) {
    checkString(page.hero.eyebrow, `${prefix}.hero.eyebrow`, violations, aggregatedText);
    checkString(page.hero.headline, `${prefix}.hero.headline`, violations, aggregatedText);
    checkString(page.hero.subhead, `${prefix}.hero.subhead`, violations, aggregatedText);
    checkString(page.hero.ctaPrimary, `${prefix}.hero.ctaPrimary`, violations, aggregatedText);
    if (page.hero.ctaSecondary) {
      checkString(page.hero.ctaSecondary, `${prefix}.hero.ctaSecondary`, violations, aggregatedText);
    }
  }

  if (page.about) {
    checkString(page.about.heading, `${prefix}.about.heading`, violations, aggregatedText);
    checkString(page.about.story, `${prefix}.about.story`, violations, aggregatedText);
    for (let i = 0; i < page.about.stats.length; i++) {
      const s = page.about.stats[i];
      checkString(s.label, `${prefix}.about.stats[${i}].label`, violations, aggregatedText);
      checkString(s.value, `${prefix}.about.stats[${i}].value`, violations, aggregatedText);
    }
  }

  if (page.services) {
    checkString(page.services.heading, `${prefix}.services.heading`, violations, aggregatedText);
    for (let i = 0; i < page.services.items.length; i++) {
      const it = page.services.items[i];
      checkString(it.title, `${prefix}.services.items[${i}].title`, violations, aggregatedText);
      checkString(it.description, `${prefix}.services.items[${i}].description`, violations, aggregatedText);
      checkString(it.priceHint, `${prefix}.services.items[${i}].priceHint`, violations, aggregatedText);
    }
  }

  if (page.contact) {
    checkString(page.contact.heading, `${prefix}.contact.heading`, violations, aggregatedText);
    checkString(page.contact.subhead, `${prefix}.contact.subhead`, violations, aggregatedText);
    checkString(
      page.contact.responsePromise,
      `${prefix}.contact.responsePromise`,
      violations,
      aggregatedText
    );
  }

  if (page.projects) {
    checkString(page.projects.heading, `${prefix}.projects.heading`, violations, aggregatedText);
    checkString(page.projects.subhead, `${prefix}.projects.subhead`, violations, aggregatedText);
  }

  if (page.faq) {
    checkString(page.faq.heading, `${prefix}.faq.heading`, violations, aggregatedText);
    for (let i = 0; i < page.faq.items.length; i++) {
      const it = page.faq.items[i];
      checkString(it.question, `${prefix}.faq.items[${i}].question`, violations, aggregatedText);
      checkString(it.answer, `${prefix}.faq.items[${i}].answer`, violations, aggregatedText);
    }
  }

  if (page.reviews) {
    checkString(page.reviews.heading, `${prefix}.reviews.heading`, violations, aggregatedText);
    checkString(page.reviews.subhead, `${prefix}.reviews.subhead`, violations, aggregatedText);
  }
}

/** Validate a BespokeProse output. Returns the list of violations —
 *  empty array = clean. */
export function validateBespokeProse(prose: BespokeProse): ConstitutionViolation[] {
  const violations: ConstitutionViolation[] = [];
  const aggregatedText: string[] = [];

  for (let i = 0; i < prose.pages.length; i++) {
    validatePage(prose.pages[i], i, violations, aggregatedText);
  }

  // Voice-fingerprint check: aggregate every string and check for at
  // least one trades-native hint. If none, warn — the AI likely
  // drifted into generic marketing register.
  const all = aggregatedText.join(" ").toLowerCase();
  const hasVoice = TRADES_NATIVE_HINTS.some((h) => all.includes(h));
  if (!hasVoice && aggregatedText.length > 3) {
    violations.push({
      path: "prose.voice",
      rule: "voice-drift",
      detail:
        "No trades-native voice markers detected across the whole output (no 'we', 'Gas Safe', 'callout', 'on the tools' etc). Rewrite in first-person plural UK trade voice.",
      severity: "block"
    });
  }

  return violations;
}

/** Format the violations as a compact feedback block the model can
 *  read on retry. */
export function formatViolationsForPrompt(
  violations: readonly ConstitutionViolation[]
): string {
  const blocking = violations.filter((v) => v.severity === "block");
  if (blocking.length === 0) return "";
  const lines = blocking.map((v) => `- ${v.path} · ${v.rule}: ${v.detail}`);
  return `PREVIOUS RESPONSE FAILED CONSTITUTION CHECK. FIX THE FOLLOWING BEFORE RESPONDING:\n${lines.join("\n")}\n\nReturn the full corrected JSON — do not partial-patch.`;
}

export type RetryResult<T> = {
  value: T;
  attempts: number;
  finalViolations: ConstitutionViolation[];
};

/** Generic retry-with-validator wrapper.
 *
 *  `run(feedback)` is called with an empty string first, then with the
 *  formatted violations block if a retry is triggered. `validate`
 *  inspects the result; if it returns any blocking violations we retry
 *  up to `maxRetries` times. The final result (even if still violating)
 *  is returned so callers never crash on a stubborn generation. */
export async function withConstitutionRetry<T>(opts: {
  run: (feedback: string) => Promise<T | null>;
  validate: (value: T) => ConstitutionViolation[];
  maxRetries?: number;
}): Promise<RetryResult<T> | null> {
  const maxRetries = opts.maxRetries ?? 2;
  let feedback = "";
  let last: T | null = null;
  let lastViolations: ConstitutionViolation[] = [];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const value = await opts.run(feedback);
    if (!value) {
      if (last) {
        return { value: last, attempts: attempt + 1, finalViolations: lastViolations };
      }
      return null;
    }
    last = value;
    lastViolations = opts.validate(value);
    const blocking = lastViolations.filter((v) => v.severity === "block");
    if (blocking.length === 0) {
      return { value, attempts: attempt + 1, finalViolations: lastViolations };
    }
    feedback = formatViolationsForPrompt(lastViolations);
  }
  return { value: last, attempts: maxRetries + 1, finalViolations: lastViolations };
}
