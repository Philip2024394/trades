// src/lib/nex-decision/decision-context.ts
//
// DECISION CONTEXT · SCIUD composer.
//
// Consumes a BusinessKnowledge object (evidence overlay) and composes an honest
// answer chain for a specific traveller intent:
//
//   SOURCE      → who saw this
//   CLAIM       → the raw fact NEX has evidence for
//   INTERPRETATION → the honest sentence NEX is allowed to say
//   UNKNOWN     → what NEX explicitly does NOT know
//   DECISION    → belongs to the traveller · NEX never decides for them
//
// This runtime NEVER:
//   - Returns a bare boolean like "family_safe = true"
//   - Ranks businesses against each other
//   - Presents OWNER_CLAIM as VERIFIED
//   - Invents interpretation NEX doesn't have evidence for
//   - Presents absence of evidence as absence of the thing
//
// Doctrine anchors:
//   - Truth Invariant (2026-08-22 CONSTITUTIONAL)
//   - Traveller Protection Principle (2026-08-23)
//   - Business Suitability ≠ Business Quality (2026-08-23)
//   - Reputation Non-Weapon rule (2026-08-23)
//   - SOURCE → CLAIM → INTERPRETATION → UNKNOWN → DECISION chain (2026-08-23)

import type {
  BusinessKnowledge,
  EvidenceItem,
  AttributeDomain,
  SourceTier,
} from "../nex-directory/business-knowledge-object";

export interface DecisionQuery {
  attributeDomain: AttributeDomain;
  attributeKey: string;
  intent: string;
}

export interface DecisionAnswer {
  query: DecisionQuery;
  status: "EVIDENCE_FOUND" | "NO_EVIDENCE" | "EVIDENCE_INSUFFICIENT";
  sources: { source: string; sourceReference: string | null; sourceTier: SourceTier }[];
  claims: unknown[];
  interpretation: string;
  unknown: string;
  decisionPhrasing: string;
  supportingEvidence: EvidenceItem[];
}

const ABSENCE_TEMPLATE = (intent: string, attributeKey: string) =>
  `NEX has no evidence about ${attributeKey}. That does not mean the answer is no — it means NEX cannot answer honestly. ${intent} · traveller should check directly.`;

const INSUFFICIENT_TEMPLATE = (attributeKey: string) =>
  `NEX has some ${attributeKey} evidence but it is not strong enough for an honest interpretation without more context.`;

/**
 * Compose a SCIUD answer for a specific attribute of a business.
 *
 * Never returns a value that a caller could accidentally treat as a boolean
 * verdict. The DecisionAnswer object always contains the full chain so a UI
 * layer must render the evidence honestly.
 */
export function composeDecision(
  bk: BusinessKnowledge | null,
  query: DecisionQuery,
): DecisionAnswer {
  const evidence = bk?.byDomain[query.attributeDomain]?.[query.attributeKey] ?? [];

  if (evidence.length === 0) {
    return {
      query,
      status: "NO_EVIDENCE",
      sources: [],
      claims: [],
      interpretation: "",
      unknown: ABSENCE_TEMPLATE(query.intent, query.attributeKey),
      decisionPhrasing:
        `NEX doesn't have evidence to answer "${query.intent}" for this business. The traveller decides based on what they can confirm elsewhere.`,
      supportingEvidence: [],
    };
  }

  // Prefer the highest tier evidence. If multiple items at the same tier
  // agree, use the earliest interpretation string that exists. If they
  // disagree, mark insufficient (never resolve silently).
  const topTierRank = Math.max(...evidence.map((e) => rankOf(e.sourceTier)));
  const topTier = evidence.filter((e) => rankOf(e.sourceTier) === topTierRank);
  const claims = topTier.map((e) => e.claim);
  const uniqueClaimStrings = new Set(claims.map((c) => JSON.stringify(c)));

  const sources = topTier.map((e) => ({
    source: e.source,
    sourceReference: e.sourceReference,
    sourceTier: e.sourceTier,
  }));

  const interpretations = topTier
    .map((e) => e.interpretation)
    .filter((s): s is string => Boolean(s));
  const unknowns = topTier
    .map((e) => e.unknownNote)
    .filter((s): s is string => Boolean(s));

  if (uniqueClaimStrings.size > 1) {
    return {
      query,
      status: "EVIDENCE_INSUFFICIENT",
      sources,
      claims,
      interpretation:
        `NEX has conflicting evidence for ${query.attributeKey}. It cannot honestly answer "${query.intent}" without more information.`,
      unknown: INSUFFICIENT_TEMPLATE(query.attributeKey),
      decisionPhrasing:
        `NEX found conflicting evidence. The traveller should check directly before deciding.`,
      supportingEvidence: evidence,
    };
  }

  const interpretation =
    interpretations[0] ??
    `NEX has ${topTier[0].sourceTier.toLowerCase().replace("_", " ")} evidence for ${query.attributeKey} = ${JSON.stringify(claims[0])}.`;
  const unknown =
    unknowns[0] ??
    `This evidence covers ${query.attributeKey}. It does not answer any broader question the traveller may be asking.`;

  return {
    query,
    status: "EVIDENCE_FOUND",
    sources,
    claims,
    interpretation,
    unknown,
    decisionPhrasing:
      `Based on the evidence NEX has, the traveller can decide. NEX presents evidence · never a verdict.`,
    supportingEvidence: evidence,
  };
}

function rankOf(tier: SourceTier): number {
  switch (tier) {
    case "VERIFIED": return 5;
    case "OBSERVED": return 4;
    case "OWNER_CLAIM": return 3;
    case "INFERRED": return 2;
    case "UNKNOWN": return 1;
  }
}

/**
 * Render a DecisionAnswer as the 5-line SCIUD text NEX may use in prose form.
 * Callers may not skip lines. If a line is empty (no evidence · no interpretation)
 * that fact is shown honestly rather than hidden.
 */
export function renderSCIUD(answer: DecisionAnswer): string {
  const src = answer.sources.length
    ? answer.sources
        .map(
          (s) =>
            `${s.source}${s.sourceReference ? `#${s.sourceReference}` : ""} (${s.sourceTier})`,
        )
        .join(" · ")
    : "(none)";
  const clm = answer.claims.length ? JSON.stringify(answer.claims) : "(none)";
  const interp = answer.interpretation || "(none)";
  const unk = answer.unknown || "(none)";
  const dec = answer.decisionPhrasing;
  return [
    `SOURCE:         ${src}`,
    `CLAIM:          ${clm}`,
    `INTERPRETATION: ${interp}`,
    `UNKNOWN:        ${unk}`,
    `DECISION:       ${dec}`,
  ].join("\n");
}
