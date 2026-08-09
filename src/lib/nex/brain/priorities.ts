// src/lib/nex/brain/priorities.ts
//
// Wave 11 · Step 9 · F33 remediation.
//
// SHARED canonical `sourcePriority` for the worker pipeline. Before
// this module, four workers + manager each maintained a byte-identical
// switch statement mapping KnowledgeSource → integer priority. A fifth
// callsite (knowledge-inbox/storage.ts::runProcessInbox) used a
// DIFFERENT SHAPE (Record<KnowledgeSource, number> literal) with
// DIFFERENT VALUES — silent drift the audit flagged as F33.
//
// This module owns the canonical priority table. The 4 identical
// sourcePriority sites migrate here. The 5th (storage.ts) is
// preserved inline with an explicit `F33.b` marker pending Philip's
// product decision on whether to align (that alignment WOULD change
// the enqueue priority for items dispatched via runProcessInbox ·
// see the checkpoint report for full detail).
//
// LOWER numbers run first · matches Postgres SKIP LOCKED claim
// ordering (priority ASC).

import type { KnowledgeSource } from "@/lib/nex/knowledge-inbox/types";

/**
 * Priority for a KnowledgeSource · lower runs first.
 *
 * The table is intentional:
 *   1 · gov-standards      · authoritative reference · run first
 *   2 · chatgpt-approved   · trusted-curated · fast lane
 *   2 · claude-generated   · already golden-rule · fast lane
 *   3 · customer-qa        · FAQ-driven
 *   4 · raw-research       · slow lane
 *   5 · internet-article   · cautious · verify before promoting
 *   5 · <unknown source>   · default fallback (safe middle)
 *   6 · personal-ideas     · sandbox · not industry knowledge
 *   7 · needs-verification · parked until human review
 */
export function sourcePriority(source: KnowledgeSource): number {
  switch (source) {
    case "gov-standards":       return 1;
    case "chatgpt-approved":    return 2;
    case "claude-generated":    return 2;
    case "customer-qa":         return 3;
    case "raw-research":        return 4;
    case "internet-article":    return 5;
    case "personal-ideas":      return 6;
    case "needs-verification":  return 7;
    default:                    return 5;
  }
}
