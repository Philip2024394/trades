// src/lib/nex-comms/suppression.ts
//
// SUPPRESSION ENGINE · global · cross-domain · bright-line rule.
//
// Doctrine (INVIOLABLE): a suppression applies to EVERY NEX domain. No domain
// may override. The engine looks up suppressions BEFORE any send decision.
//
// STOP words map to scope:
//   STOP / UNSUBSCRIBE                 → scope='all'          (suppresses every category)
//   TIDAK / STOP MARKETING             → scope='marketing_only'
//   STOP RECRUITMENT / JANGAN HUBUNGI → scope='recruitment_only'
//     ("JANGAN HUBUNGI" = "don't contact" · treated as recruitment stop by default ·
//      an admin may extend to 'all' if the recipient's intent is clearer)

import type {
  CommsCategory,
  CommsSuppressionRow,
  CommsSuppressionScope,
  CommsSuppressionSource,
} from "./types";

export interface StopWordClassification {
  detected: boolean;
  scope: CommsSuppressionScope | null;
  category: CommsCategory | null;
  matchedWord: string | null;
}

// Order matters: more specific patterns first.
const STOP_WORD_RULES: {
  pattern: RegExp;
  scope: CommsSuppressionScope;
  category?: CommsCategory;
  label: string;
}[] = [
  { pattern: /\bstop\s+recruitment\b/i,      scope: "recruitment_only", label: "STOP RECRUITMENT" },
  { pattern: /\bjangan\s+hubungi\b/i,        scope: "recruitment_only", label: "JANGAN HUBUNGI" },
  { pattern: /\bstop\s+marketing\b/i,        scope: "marketing_only",   label: "STOP MARKETING" },
  { pattern: /^\s*tidak\s*$/i,                scope: "marketing_only",   label: "TIDAK" },
  { pattern: /^\s*stop\s*$/i,                 scope: "all",              label: "STOP" },
  { pattern: /^\s*unsubscribe\s*$/i,          scope: "all",              label: "UNSUBSCRIBE" },
  { pattern: /^\s*berhenti\s*$/i,             scope: "all",              label: "BERHENTI" },
];

/**
 * Classify an incoming message body to see whether it triggers a suppression.
 * Returns { detected: false, ... } when no stop word matches.
 */
export function classifyStopSignal(body: string): StopWordClassification {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { detected: false, scope: null, category: null, matchedWord: null };
  }
  for (const rule of STOP_WORD_RULES) {
    if (rule.pattern.test(trimmed)) {
      return {
        detected: true,
        scope: rule.scope,
        category: rule.category ?? null,
        matchedWord: rule.label,
      };
    }
  }
  return { detected: false, scope: null, category: null, matchedWord: null };
}

export interface EvaluateSuppressionInput {
  contactId: string;
  category: CommsCategory;
  now: Date;
  suppressions: CommsSuppressionRow[];  // ideally pre-scoped to contactId · function still filters defensively
}

export interface EvaluateSuppressionResult {
  suppressed: boolean;
  matchedSuppressionId: string | null;
  matchedScope: CommsSuppressionScope | null;
  reason: string;
}

/**
 * Determine whether a proposed send to (contact, category) is suppressed. A
 * suppression matches when: it belongs to this contact AND its effective window
 * covers `now` AND its scope covers the category:
 *   scope='all'                → matches every category
 *   scope='marketing_only'     → matches category='marketing'
 *   scope='recruitment_only'   → matches category='recruitment'
 *   scope='category_specific'  → matches only when suppression.category === category
 */
export function evaluateSuppression(input: EvaluateSuppressionInput): EvaluateSuppressionResult {
  const nowMs = input.now.getTime();
  const applicable = input.suppressions.filter((s) => {
    if (s.contactId !== input.contactId) return false;
    if (s.effectiveFrom.getTime() > nowMs) return false;
    if (s.effectiveTo != null && s.effectiveTo.getTime() <= nowMs) return false;
    switch (s.scope) {
      case "all":              return true;
      case "marketing_only":   return input.category === "marketing";
      case "recruitment_only": return input.category === "recruitment";
      case "category_specific":return s.category === input.category;
    }
  });

  if (applicable.length === 0) {
    return { suppressed: false, matchedSuppressionId: null, matchedScope: null, reason: "no suppression applies" };
  }
  const match = applicable[0];
  return {
    suppressed: true,
    matchedSuppressionId: match.suppressionId,
    matchedScope: match.scope,
    reason: `suppressed by ${match.source} (scope=${match.scope}${match.category ? ` · category=${match.category}` : ""})`,
  };
}

/**
 * Compose a new suppression row from a stop-word classification. Returns null
 * when no stop signal was detected.
 */
export function suppressionFromStopSignal(
  contactId: string,
  classification: StopWordClassification,
  now: Date = new Date(),
): Omit<CommsSuppressionRow, "suppressionId"> | null {
  if (!classification.detected || !classification.scope) return null;
  return {
    contactId,
    scope: classification.scope,
    category: classification.category,
    source: "recipient_stop_word" as CommsSuppressionSource,
    rawSignal: classification.matchedWord,
    createdAt: now,
    effectiveFrom: now,
    effectiveTo: null,
    auditNote: `Automatic suppression from inbound stop word '${classification.matchedWord}'.`,
  };
}
