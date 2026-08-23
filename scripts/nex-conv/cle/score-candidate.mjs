// NEX CLE · Step 5 · SCORE CANDIDATE (heuristic for smoke · full eval-driven
// scoring is a future iteration that plugs into scripts/nex-conv/evaluate.mjs
// with a shadow-store harness).
//
// For smoke: score = weighted combination of proxies for real signal quality.
// This is enough to prove the pipeline runs end-to-end and produces a
// ranked candidate list. Full scoring (baseline-vs-with-candidate on the
// eval suite) requires the shadow-store pattern documented in the Architecture
// Fit Report.
//
// Score components (all in [0,1]):
//   · evidence_weight       — how many real turns this addresses
//   · candidate_specificity — how targeted the payload is (not generic)
//   · doctrine_compliance   — PII check + brain-isolation check + no-auto-promote
//   · novelty               — how different from existing state (proxy for "adds value not noise")

const PII_PATTERNS = [
  /\+?\d[\d\s\-()]{6,}/,      // phones
  /[\w.-]+@[\w.-]+\.\w+/i,    // emails
  /#FL-\d{4}-[A-Z0-9]{5}/,    // business refs
];

function containsPii(text) {
  const s = String(text ?? "");
  return PII_PATTERNS.some(rx => rx.test(s));
}

function scoreEvidenceWeight(candidate) {
  const n = candidate.evidence_turn_ids?.length ?? 0;
  if (n === 0) return 0;
  return Math.min(1, Math.log2(1 + n) / 4);   // 1→0.25, 15→~1
}

function scoreSpecificity(candidate) {
  if (candidate.strategy === "add_clarification_ki") {
    const q = candidate.payload?.question_text ?? "";
    const words = q.split(/\s+/).filter(w => w.length >= 3).length;
    if (words < 3) return 0.2;
    if (words < 6) return 0.5;
    return 0.8;
  }
  if (candidate.strategy === "add_intent_example") {
    const nExamples = candidate.payload?.add_example_phrases?.length ?? 0;
    if (nExamples === 0) return 0;
    if (nExamples === 1) return 0.4;
    if (nExamples === 2) return 0.7;
    return 0.9;
  }
  return 0.5;
}

function scoreDoctrineCompliance(candidate) {
  const checks = { pii_free: true, no_auto_promote: true, brain_scoped: true };
  const p = candidate.payload ?? {};
  if (p.question_text && containsPii(p.question_text)) checks.pii_free = false;
  if (p.answer_text && containsPii(p.answer_text)) checks.pii_free = false;
  if (Array.isArray(p.add_example_phrases)) {
    for (const e of p.add_example_phrases) if (containsPii(e)) checks.pii_free = false;
  }
  if (p.draft_only === false) checks.no_auto_promote = false;
  if (p.confidence != null && p.confidence >= 0.70 && candidate.strategy === "add_clarification_ki") {
    checks.no_auto_promote = false;
  }
  const allPass = Object.values(checks).every(Boolean);
  return { score: allPass ? 1 : 0, checks };
}

function scoreNovelty(candidate) {
  if (candidate.strategy === "add_intent_example") {
    const proposed = candidate.payload?.add_example_phrases?.length ?? 0;
    const existing = candidate.existing_example_count ?? 0;
    if (existing === 0) return 0.9;
    return Math.min(1, proposed / Math.max(1, existing) * 2);
  }
  if (candidate.strategy === "add_clarification_ki") {
    return 0.7;
  }
  return 0.5;
}

export function scoreCandidate(candidate, config) {
  const evidence = scoreEvidenceWeight(candidate);
  const specificity = scoreSpecificity(candidate);
  const doctrineResult = scoreDoctrineCompliance(candidate);
  const novelty = scoreNovelty(candidate);
  const total = +(
    evidence * 0.40 +
    specificity * 0.30 +
    doctrineResult.score * 0.20 +
    novelty * 0.10
  ).toFixed(3);
  const promoteReady = total >= config.scoreThresholds.promotionFloor && doctrineResult.score === 1;
  return {
    total,
    components: {
      evidence: +evidence.toFixed(3),
      specificity: +specificity.toFixed(3),
      doctrine_score: doctrineResult.score,
      doctrine_checks: doctrineResult.checks,
      novelty: +novelty.toFixed(3),
    },
    promoteReady,
    notes: promoteReady
      ? "clears floor · doctrine passes · ready for admin review"
      : total < config.scoreThresholds.promotionFloor
        ? `below floor (${total} < ${config.scoreThresholds.promotionFloor})`
        : "doctrine check failed",
    // Full eval-driven scoring stubs (needs shadow-store harness · deferred):
    baseline_pass_rate: null,
    with_candidate_pass_rate: null,
    regression_check: "not_run_smoke",
    language_neutrality_check: "not_run_smoke",
  };
}
