// src/lib/nex/agents/nex-speaking/taught-patterns.ts
//
// NEX Speaking Intelligence Engineer · Phase 4 · taught-knowledge participation
// Philip 2026-09-07 · AUTHORIZE Phase 4 · W5-3
//
// Analogous to R6 for Programmer (Y-W5-1-C): the specialist can consult
// taught knowledge that AUGMENTS its detection patterns. Discipline:
//
//   · ADDITIVE ONLY — taught knowledge can only STRENGTHEN detection
//     (add more patterns that signal life-safety) · NEVER weaken it.
//   · The hardcoded LIFE_SAFETY_PATTERNS baseline is inviolate.
//   · Only VERIFIED knowledge with confidence >= 0.7 fires.
//   · Only knowledge with domain starting with "speaking.life_safety"
//     is consulted for life-safety extension.
//   · Every taught-pattern hit is auditable via knowledge_id.
//   · Invalid regex patterns are silently skipped (never crash).
//   · Life-safety is the ONLY signal type accepting taught extensions
//     in Phase 4. Medical/legal/humor/spelling extensions can follow
//     under separate Founder authorization once the pattern proves out.

import { readKnowledge } from "@/lib/nex/programmer-learning/store";
import type { KnowledgeItem } from "@/lib/nex/programmer-learning/types";

/** Extract regex-string patterns from a VERIFIED knowledge item's
 *  statement. Format expected (per candidate-authoring convention):
 *  the knowledge statement contains a JSON array segment like
 *    `PATTERNS: ["pattern one", "pattern two"]`
 *  or the item's technology field lists patterns as comma-separated.
 *  Returns [] when nothing usable is present.
 *
 *  Free-form statements without a recognizable PATTERNS block are
 *  intentionally NOT parsed — refusing to guess is honest per doctrine. */
function extractPatternsFromKnowledge(k: KnowledgeItem): string[] {
  const stmt = k.statement ?? "";
  const m = stmt.match(/PATTERNS:\s*(\[[^\]]+\])/);
  if (m) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return parsed as string[];
      }
    } catch { /* malformed · skip */ }
  }
  return [];
}

/** Read all VERIFIED speaking.life_safety knowledge items from the
 *  specialist's knowledge store · return the union of their extracted
 *  patterns. Deterministic. Auditable. Safe under empty store. */
export function getTaughtLifeSafetyPatterns(): Array<{ pattern: string; knowledge_id: string }> {
  let items: KnowledgeItem[] = [];
  try { items = readKnowledge(); } catch { items = []; }
  const out: Array<{ pattern: string; knowledge_id: string }> = [];
  for (const k of items) {
    // Domain gate: only knowledge tagged for speaking.life_safety fires
    if (!(k.domain ?? "").toLowerCase().startsWith("speaking.life_safety")) continue;
    // Verification gate
    if (k.verification_status !== "VERIFIED") continue;
    // Confidence gate
    if (typeof k.confidence !== "number" || k.confidence < 0.7) continue;
    const patterns = extractPatternsFromKnowledge(k);
    for (const p of patterns) {
      // Validate regex compiles before offering it
      try {
        // eslint-disable-next-line no-new
        new RegExp(p, "i");
        out.push({ pattern: p, knowledge_id: k.knowledge_id });
      } catch { /* invalid regex · skip */ }
    }
  }
  return out;
}

/** Test a text against taught life-safety patterns. Returns the
 *  knowledge_id of the first pattern that matched · or null. */
export function matchTaughtLifeSafetyPattern(text: string): { knowledge_id: string; pattern: string } | null {
  const patterns = getTaughtLifeSafetyPatterns();
  for (const p of patterns) {
    try {
      if (new RegExp(p.pattern, "i").test(text)) return p;
    } catch { /* skip invalid at test-time too */ }
  }
  return null;
}
