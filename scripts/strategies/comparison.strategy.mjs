/**
 * NEX Composer Strategy · comparison · v1 · Cycle 007
 * ----------------------------------------------------------------------------
 * Phase: 7 (fourth content-bearing strategy · capability queue)
 * API:   Strategy API v1
 *
 * Selected by evidence: Suite has 4 rows with info_type=Comparison and 4 rows
 * with intent=Compare. Real-world test (Cycle-006 QA run) showed
 * "Compare oak and walnut staircases" routing to unknown fallback for lack of
 * a Comparison strategy — direct capability gap.
 *
 * Discipline (locked):
 *   - Consumes ONLY evidencePackage.evidence.knowledge
 *   - No provider calls · no filesystem · no network · no manifest
 *   - Preserves provider-delivered order
 *   - Never invents · every EvidenceRef points to a Package record
 *   - canHandle is non-overlapping with Gallery / Definition / Customer FAQ
 */

import { createHash } from 'node:crypto';

export const STRATEGY_API_VERSION = '1';
export const INTENT_NAME = 'comparison';
export const STRATEGY_VERSION = '1.0';

// Non-overlapping claim set:
//   - info_type Comparison   (not Definition · Images · Inquiry)
//   - intent Compare         (not Learn · Buy · Show · Browse · Advise)
const COMPARISON_INFO_TYPES = new Set(['comparison']);
const COMPARISON_INTENTS = new Set(['compare']);

function normalise(str) {
  return String(str ?? '').toLowerCase().trim();
}

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

function buildProvenance(pkg, router) {
  const providersUsed = {};
  if (pkg?.evidence?.knowledge?.length) providersUsed.knowledge = '1.0';
  return {
    plan_version: '1.0',
    router_version: router?.router_version ?? 'unknown',
    provider_versions: providersUsed,
    strategy: INTENT_NAME,
    strategy_version: STRATEGY_VERSION,
    composer_version: 'v1',
    composed_at: new Date().toISOString(),
    evidence_package_hash: hashPackage(pkg),
  };
}

function comparisonTitle(router) {
  const subject = router?.subject ? String(router.subject).trim() : '';
  if (subject) return `Comparison · ${subject}`;
  return 'Comparison';
}

export const strategy = {
  strategyApiVersion: STRATEGY_API_VERSION,
  intentName: INTENT_NAME,
  strategyVersion: STRATEGY_VERSION,

  canHandle(routerDecision) {
    if (!routerDecision || typeof routerDecision !== 'object') return false;
    return (
      COMPARISON_INFO_TYPES.has(normalise(routerDecision.information_type)) ||
      COMPARISON_INTENTS.has(normalise(routerDecision.intent))
    );
  },

  execute({ router, evidencePackage /*, requestContext */ } = {}) {
    if (!evidencePackage || typeof evidencePackage !== 'object') {
      return {
        status: 'unknown',
        answer_type: 'comparison',
        sections: [],
        images: [],
        follow_up_questions: ['I could not process the incoming evidence.'],
        citations: [],
        confidence: 'unknown',
        quality_flags: ['strategy:comparison', 'emergency:invalid_evidence_package'],
        provenance: buildProvenance(evidencePackage, router),
      };
    }

    // Low Router confidence · clarify before answering (Unknown Rule)
    const routerConfidence = router?.confidence;
    if (typeof routerConfidence === 'number' && routerConfidence < 0.7) {
      return {
        status: 'clarify',
        answer_type: 'comparison',
        sections: [],
        images: [],
        follow_up_questions: [
          'Which specific items would you like me to compare · and on what dimensions (material · design · cost · install)?',
        ],
        citations: [],
        confidence: 'low',
        quality_flags: ['strategy:comparison', 'low_router_confidence'],
        provenance: buildProvenance(evidencePackage, router),
      };
    }

    const knowledgeRecords = Array.isArray(evidencePackage?.evidence?.knowledge)
      ? evidencePackage.evidence.knowledge
      : [];

    if (knowledgeRecords.length === 0) {
      const subject = router?.subject ? String(router.subject).trim() : 'those items';
      return {
        status: 'unknown',
        answer_type: 'comparison',
        sections: [],
        images: [],
        follow_up_questions: [
          `I do not yet have authored comparison evidence for ${subject}. Could you tell me which specific dimensions matter most (material · design · cost · install)?`,
        ],
        citations: [],
        confidence: 'unknown',
        quality_flags: ['strategy:comparison', 'zero_knowledge_evidence'],
        provenance: buildProvenance(evidencePackage, router),
      };
    }

    const knowledgeRefs = knowledgeRecords.map((rec) => ({
      evidenceType: 'knowledge',
      path_or_id: rec?.path ?? rec?.id ?? '',
    }));

    const keyPoints = knowledgeRecords
      .slice(0, 5)
      .map((r) => (r?.title ? String(r.title).trim() : ''))
      .filter((t) => t.length > 0);

    const section = {
      section_type: 'comparison',
      title: comparisonTitle(router),
      evidence_refs: knowledgeRefs,
      key_points: keyPoints,
    };
    Object.freeze(section.evidence_refs);
    Object.freeze(section.key_points);
    Object.freeze(section);

    const topScore = Number(knowledgeRecords[0]?.match_score ?? 0);
    let confidence = 'medium';
    if (topScore >= 3) confidence = 'high';
    else if (topScore === 0) confidence = 'low';

    return {
      status: 'ok',
      answer_type: 'comparison',
      sections: [section],
      images: [],
      follow_up_questions: [],
      citations: knowledgeRefs.slice(),
      confidence,
      quality_flags: [
        'strategy:comparison',
        `knowledge_count:${knowledgeRecords.length}`,
        `top_score:${topScore}`,
      ],
      provenance: buildProvenance(evidencePackage, router),
    };
  },

  explain(plan) {
    if (!plan) return { strategy: INTENT_NAME, reason: 'no plan' };
    const flags = plan.quality_flags || [];
    return {
      matched_intent: 'comparison',
      strategy: INTENT_NAME,
      strategy_version: STRATEGY_VERSION,
      decision_path: flags.filter((f) => !f.startsWith('strategy:')),
      evidence_selected: plan.citations || [],
      evidence_rejected: [],
      rejection_reasons: {},
    };
  },
};

// ---------- Cycle 007 · Comparison Strategy Acceptance ----------

function fakePackage(knowledgeRecords, requestOverrides = {}) {
  const evidenceBuckets = {
    knowledge: knowledgeRecords, faq: [], workshopPrinciples: [], profiles: [],
    images: [], pricing: [], drawings: [], videos: [],
  };
  return {
    request: {
      intent: 'Compare', subject: 'oak and walnut staircases', brain: 'Staircase',
      domain: 'Design Languages', information_type: 'Comparison', confidence: 0.9, ...requestOverrides,
    },
    evidence: evidenceBuckets,
    diagnostics: {
      providers_queried: ['knowledge'],
      providers_matched: ['knowledge'],
      warnings: [],
      provider_status: { knowledge: { status: 'success', matches: knowledgeRecords.length } },
    },
    timing: { started_at: 'x', completed_at: 'y', duration_ms: 0 },
    metadata: { engine_version: 'v1', phase: 1 },
  };
}

function runAcceptanceTests() {
  const checks = [];

  // AC1 · Strategy API v1 compliance
  checks.push({ name: 'AC1a · strategyApiVersion === "1"', pass: strategy.strategyApiVersion === '1' });
  checks.push({ name: 'AC1b · intentName === "comparison"', pass: strategy.intentName === 'comparison' });
  checks.push({ name: 'AC1c · canHandle · execute · explain present', pass: typeof strategy.canHandle === 'function' && typeof strategy.execute === 'function' && typeof strategy.explain === 'function' });

  // AC2 · canHandle non-overlapping with existing strategies
  checks.push({ name: 'AC2a · canHandle=true for info_type Comparison', pass: strategy.canHandle({ information_type: 'Comparison' }) === true });
  checks.push({ name: 'AC2b · canHandle=true for intent Compare', pass: strategy.canHandle({ intent: 'Compare' }) === true });
  checks.push({ name: 'AC2c · canHandle=true case-insensitive', pass: strategy.canHandle({ information_type: 'comparison' }) === true && strategy.canHandle({ intent: 'compare' }) === true });
  checks.push({ name: 'AC2d · canHandle=false for Definition info_type (Definition strategy owns)', pass: strategy.canHandle({ information_type: 'Definition' }) === false });
  checks.push({ name: 'AC2e · canHandle=false for Images info_type (Gallery owns)', pass: strategy.canHandle({ information_type: 'Images' }) === false });
  checks.push({ name: 'AC2f · canHandle=false for Inquiry info_type (Customer FAQ owns)', pass: strategy.canHandle({ information_type: 'Inquiry' }) === false });
  checks.push({ name: 'AC2g · canHandle=false for Show intent (Gallery owns)', pass: strategy.canHandle({ intent: 'Show' }) === false });
  checks.push({ name: 'AC2h · canHandle=false for Learn intent (multiple potential owners · not Comparison)', pass: strategy.canHandle({ intent: 'Learn' }) === false });
  checks.push({ name: 'AC2i · canHandle=false for Buy intent (Customer FAQ owns)', pass: strategy.canHandle({ intent: 'Buy' }) === false });
  checks.push({ name: 'AC2j · canHandle=false for null/undefined/empty input', pass: strategy.canHandle(null) === false && strategy.canHandle(undefined) === false && strategy.canHandle({}) === false });

  // AC3 · Empty knowledge evidence → status unknown (honest gap)
  {
    const pkg = fakePackage([]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    checks.push({ name: 'AC3a · No knowledge evidence · status === "unknown"', pass: plan.status === 'unknown' });
    checks.push({ name: 'AC3b · No knowledge evidence · answer_type === "comparison"', pass: plan.answer_type === 'comparison' });
    checks.push({ name: 'AC3c · No knowledge evidence · follow_up references subject', pass: plan.follow_up_questions[0]?.includes('oak and walnut staircases') });
    checks.push({ name: 'AC3d · No knowledge evidence · sections empty', pass: plan.sections.length === 0 });
  }

  // AC4 · Knowledge evidence exists → status ok
  {
    const pkg = fakePackage([
      { path: 'a.md', title: 'Oak vs Walnut · Grain & Durability', match_score: 3 },
      { path: 'b.md', title: 'Species Comparison Overview', match_score: 2 },
    ]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    checks.push({ name: 'AC4a · Knowledge evidence · status === "ok"', pass: plan.status === 'ok' });
    checks.push({ name: 'AC4b · Knowledge evidence · exactly 1 section (comparison)', pass: plan.sections.length === 1 && plan.sections[0].section_type === 'comparison' });
    checks.push({ name: 'AC4c · Section title includes subject', pass: plan.sections[0].title.includes('oak and walnut') });
    checks.push({ name: 'AC4d · Section carries key_points from titles', pass: plan.sections[0].key_points.length === 2 && plan.sections[0].key_points[0].includes('Oak vs Walnut') });
    checks.push({ name: 'AC4e · citations mirror knowledge refs', pass: plan.citations.length === 2 && plan.citations.every((c) => c.evidenceType === 'knowledge') });
    checks.push({ name: 'AC4f · confidence "high" (top_score 3)', pass: plan.confidence === 'high' });
    checks.push({ name: 'AC4g · images empty (comparison does not lead with images · Phase 1)', pass: plan.images.length === 0 });
  }

  // AC5 · Low Router confidence · clarify
  {
    const pkg = fakePackage([{ path: 'x.md' }], { confidence: 0.5 });
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    checks.push({ name: 'AC5a · Low Router confidence · status === "clarify"', pass: plan.status === 'clarify' });
    checks.push({ name: 'AC5b · Low Router confidence · follow_up_questions populated', pass: plan.follow_up_questions.length > 0 });
  }

  // AC6 · Order preserved · no invention
  {
    const pkg = fakePackage([{ path: 'first', match_score: 10 }, { path: 'second', match_score: 5 }]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    const orderOK = plan.citations[0].path_or_id === 'first' && plan.citations[1].path_or_id === 'second';
    const paths = new Set(pkg.evidence.knowledge.map((r) => r.path));
    const allTraced = plan.citations.every((ref) => paths.has(ref.path_or_id));
    checks.push({ name: 'AC6a · Order preserved', pass: orderOK });
    checks.push({ name: 'AC6b · Every EvidenceRef traces to Package record (no invention)', pass: allTraced });
  }

  // AC7 · Invalid inputs tolerated
  const invalidCases = [undefined, { evidencePackage: {} }, { evidencePackage: { evidence: null } }, { evidencePackage: { evidence: { knowledge: 'not-array' } } }];
  for (const [i, input] of invalidCases.entries()) {
    let plan = null, threw = false;
    try { plan = strategy.execute(input); } catch { threw = true; }
    const valid = plan && typeof plan === 'object' && 'status' in plan;
    checks.push({ name: `AC7.${i + 1} · Invalid input tolerated`, pass: !threw && valid });
  }

  // AC8 · ARCHITECTURAL · no provider/filesystem/network access in exported code
  {
    const fullSrc = readFileSyncSafe('C:/Users/Victus/trades/scripts/strategies/comparison.strategy.mjs');
    const marker = '// ---------- Cycle 007 · Comparison Strategy Acceptance ----------';
    const exportedSrc = fullSrc.split(marker)[0] ?? fullSrc;
    const forbiddenImports = ['nex-retrieval-', 'nex-knowledge-index-builder', 'nex-image-manifest', 'knowledge-index'];
    const found = forbiddenImports.filter((f) => new RegExp(`^\\s*import[^;]*from\\s*['"\`][^'"\`]*${f}`, 'm').test(exportedSrc));
    checks.push({ name: 'AC8a · No provider/engine/builder imports in exported code', pass: found.length === 0 });
    const fsReads = /\breadFileSync\b|\breadFile\b/.test(exportedSrc);
    checks.push({ name: 'AC8b · No filesystem reads in exported code', pass: !fsReads });
    const netCalls = /\bfetch\b|\bhttps?\.\w+\b|\baxios\b/.test(exportedSrc);
    checks.push({ name: 'AC8c · No network calls in exported code', pass: !netCalls });
    const fsImport = /^\s*import[^;]*from\s*['"`]node:fs['"`]/m.test(exportedSrc);
    checks.push({ name: 'AC8d · No node:fs import in exported code', pass: !fsImport });
  }

  // AC9 · Determinism
  {
    const pkg = fakePackage([{ path: 'a', match_score: 2 }]);
    const p1 = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    const p2 = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    checks.push({ name: 'AC9 · Deterministic across runs', pass: p1.provenance.evidence_package_hash === p2.provenance.evidence_package_hash });
  }

  // AC10 · explain() returns diagnostic
  {
    const pkg = fakePackage([{ path: 'x', match_score: 3, title: 'T' }]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    const diag = strategy.explain(plan);
    checks.push({ name: 'AC10a · explain returns matched_intent · strategy · decision_path', pass: !!diag && 'matched_intent' in diag && 'strategy' in diag && 'decision_path' in diag });
    checks.push({ name: 'AC10b · explain diag has no prose-shaped field', pass: !('text' in diag) && !('response' in diag) && !('markdown' in diag) });
  }

  return { name: 'Cycle 007 · Comparison Strategy Acceptance', checks };
}

import { readFileSync } from 'node:fs';
function readFileSyncSafe(p) { try { return readFileSync(p, 'utf8'); } catch { return ''; } }

function report(suite) {
  const total = suite.checks.length;
  const passed = suite.checks.filter((c) => c.pass).length;
  const line = '-'.repeat(78);
  console.log(line);
  console.log(`${suite.name} · ${passed}/${total}`);
  console.log(line);
  for (const c of suite.checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}`);
  return { passed, total };
}

function main() {
  console.log('NEX Composer Strategy · comparison · v1 · Cycle 007');
  console.log('');
  const suite = runAcceptanceTests();
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Cycle 007 · Comparison Strategy Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));
  if (r.passed !== r.total) { console.log('Comparison Strategy · FAILED'); process.exit(1); }
  console.log('Comparison Strategy · PASSED · non-overlapping · no provider access · zero invention');
}

import { pathToFileURL } from 'node:url';
const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
