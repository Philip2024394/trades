/**
 * NEX Composer Strategy · unknown · v1
 * ----------------------------------------------------------------------------
 * Spec:  data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase: 7 (first strategy · guaranteed fallback)
 * API:   Strategy API v1
 *
 * Purpose:
 *   The guaranteed fallback. Returns a syntactically valid Response Plan for
 *   every request that no content-bearing strategy claimed. Handles the three
 *   states that previously lived inside the Composer skeleton:
 *     - zero evidence retrieved         → status: "unknown"
 *     - low Router confidence           → status: "clarify"
 *     - evidence present, no claimant   → status: "ok" (skeleton passthrough)
 *
 * Discipline:
 *   - Never invents · citations trace to real records in the Package
 *   - Never writes prose · only structured content
 *   - Returned Plan will be Object.frozen by the Composer
 *   - canHandle() returns false · unknown is never counted as a candidate,
 *     it is returned only when zero non-unknown strategies match
 */

import { createHash } from 'node:crypto';

export const STRATEGY_API_VERSION = '1';
export const INTENT_NAME = 'unknown';
export const STRATEGY_VERSION = '1.0';

function hashPackage(pkg) {
  const stable = {
    request: pkg?.request ?? null,
    evidence: pkg?.evidence ?? {},
    diagnostics: {
      providers_queried: pkg?.diagnostics?.providers_queried ?? [],
      providers_matched: pkg?.diagnostics?.providers_matched ?? [],
      provider_status: pkg?.diagnostics?.provider_status ?? {},
    },
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

function totalMatches(pkg) {
  if (!pkg?.evidence) return 0;
  let n = 0;
  for (const arr of Object.values(pkg.evidence)) if (Array.isArray(arr)) n += arr.length;
  return n;
}

function extractCitations(pkg) {
  const out = [];
  if (!pkg?.evidence) return out;
  for (const [evidenceType, arr] of Object.entries(pkg.evidence)) {
    if (!Array.isArray(arr)) continue;
    for (const rec of arr) {
      const path_or_id = rec?.path ?? rec?.id ?? null;
      if (path_or_id) out.push({ evidenceType, path_or_id });
    }
  }
  return out;
}

function providersWithMatches(pkg) {
  const out = [];
  const st = pkg?.diagnostics?.provider_status ?? {};
  for (const [et, s] of Object.entries(st)) {
    if (s?.status === 'success' && s?.matches > 0) out.push(et);
  }
  return out;
}

function baseProvenance(pkg, routerDecision) {
  return {
    plan_version: '1.0',
    router_version: routerDecision?.router_version ?? 'unknown',
    provider_versions: {},
    strategy: INTENT_NAME,
    strategy_version: STRATEGY_VERSION,
    composer_version: 'v1',
    composed_at: new Date().toISOString(),
    evidence_package_hash: hashPackage(pkg),
  };
}

export const strategy = {
  strategyApiVersion: STRATEGY_API_VERSION,
  intentName: INTENT_NAME,
  strategyVersion: STRATEGY_VERSION,

  canHandle(_routerDecision) {
    // The fallback is never a candidate. It is returned only when zero
    // non-unknown strategies match. Registry enforces this separation.
    return false;
  },

  execute({ router, evidencePackage /*, requestContext */ } = {}) {
    // Emergency plan for garbage input
    if (!evidencePackage || typeof evidencePackage !== 'object') {
      return {
        status: 'unknown',
        answer_type: 'unknown',
        sections: [],
        images: [],
        follow_up_questions: ['I could not process the incoming evidence.'],
        citations: [],
        confidence: 'unknown',
        quality_flags: ['strategy:unknown', 'emergency:empty_or_invalid_evidence_package'],
        provenance: baseProvenance(evidencePackage, router),
      };
    }

    const total = totalMatches(evidencePackage);
    const routerConfidence = router?.confidence;
    const provenance = baseProvenance(evidencePackage, router);
    provenance.provider_versions = Object.fromEntries(
      providersWithMatches(evidencePackage).map((et) => [et, '1.0'])
    );

    if (total === 0) {
      return {
        status: 'unknown',
        answer_type: 'unknown',
        sections: [],
        images: [],
        follow_up_questions: [
          'I do not yet have authored evidence covering this specifically.',
        ],
        citations: [],
        confidence: 'unknown',
        quality_flags: ['strategy:unknown', 'zero_evidence_matched'],
        provenance,
      };
    }

    if (typeof routerConfidence === 'number' && routerConfidence < 0.7) {
      return {
        status: 'clarify',
        answer_type: 'clarification',
        sections: [],
        images: [],
        follow_up_questions: [
          'Could you tell me a bit more so I can point you at the right information?',
        ],
        citations: [],
        confidence: 'low',
        quality_flags: ['strategy:unknown', 'low_router_confidence'],
        provenance,
      };
    }

    // Evidence exists · Router was confident · but no content-bearing strategy
    // claimed this request. Fallback returns a valid ok-status Plan with the
    // citations trail. Once a real strategy (e.g. gallery) is added, it will
    // claim these requests and produce richer sections.
    return {
      status: 'ok',
      answer_type: 'fallback_passthrough',
      sections: [],
      images: [],
      follow_up_questions: [],
      citations: extractCitations(evidencePackage),
      confidence: 'medium',
      quality_flags: ['strategy:unknown', 'sections_empty_awaiting_content_strategy'],
      provenance,
    };
  },

  explain(plan) {
    if (!plan) return { strategy: INTENT_NAME, reason: 'no plan' };
    return {
      matched_intent: null,
      strategy: INTENT_NAME,
      strategy_version: STRATEGY_VERSION,
      decision_path: (plan.quality_flags || []).filter((f) => !f.startsWith('strategy:')),
      evidence_selected: plan.citations || [],
      evidence_rejected: [],
      rejection_reasons: {},
    };
  },
};
