/**
 * NEX Composer Strategy · definition · v1
 * ----------------------------------------------------------------------------
 * Spec:  data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase: 7 (second content-bearing strategy · biggest single unknown-reduction)
 * API:   Strategy API v1
 *
 * Selected because: info_type=Definition covers 9 of 41 Suite rows · the
 * single largest unmapped bucket. Removing 9 unknown responses in one step.
 *
 * Discipline (locked):
 *   - Consumes ONLY evidencePackage.evidence.knowledge
 *   - No provider calls · no filesystem · no network · no manifest
 *   - Preserves provider-delivered order (already sorted by match_score)
 *   - Never invents · every EvidenceRef points to a record in the Package
 *   - Returns a plain object · Composer freezes it
 */

import { createHash } from 'node:crypto';

export const STRATEGY_API_VERSION = '1';
export const INTENT_NAME = 'definition';
export const STRATEGY_VERSION = '1.0';

// canHandle is intentionally narrow — only info_type=Definition. Broader
// claims (all Learn intents) would collide with future Comparison / Function
// / Material strategies. Registry throws on collisions, so tight canHandle
// discipline matters.
const DEFINITION_INFO_TYPES = new Set(['definition']);

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

function definitionTitle(router) {
  const subject = router?.subject ? String(router.subject).trim() : '';
  if (subject) return `Definition · ${subject}`;
  return 'Definition';
}

export const strategy = {
  strategyApiVersion: STRATEGY_API_VERSION,
  intentName: INTENT_NAME,
  strategyVersion: STRATEGY_VERSION,

  canHandle(routerDecision) {
    if (!routerDecision || typeof routerDecision !== 'object') return false;
    return DEFINITION_INFO_TYPES.has(normalise(routerDecision.information_type));
  },

  execute({ router, evidencePackage /*, requestContext */ } = {}) {
    if (!evidencePackage || typeof evidencePackage !== 'object') {
      return {
        status: 'unknown',
        answer_type: 'definition',
        sections: [],
        images: [],
        follow_up_questions: ['I could not process the incoming evidence.'],
        citations: [],
        confidence: 'unknown',
        quality_flags: ['strategy:definition', 'emergency:invalid_evidence_package'],
        provenance: buildProvenance(evidencePackage, router),
      };
    }

    const knowledgeRecords = Array.isArray(evidencePackage?.evidence?.knowledge)
      ? evidencePackage.evidence.knowledge
      : [];

    // Low Router confidence · clarify before answering (Unknown Rule)
    const routerConfidence = router?.confidence;
    if (typeof routerConfidence === 'number' && routerConfidence < 0.7) {
      return {
        status: 'clarify',
        answer_type: 'definition',
        sections: [],
        images: [],
        follow_up_questions: [
          'Could you tell me a bit more so I can point you at the right definition?',
        ],
        citations: [],
        confidence: 'low',
        quality_flags: ['strategy:definition', 'low_router_confidence'],
        provenance: buildProvenance(evidencePackage, router),
      };
    }

    // Zero knowledge evidence · honest gap (evidence-side backlog is honest)
    if (knowledgeRecords.length === 0) {
      const subject = router?.subject ? String(router.subject).trim() : 'this topic';
      return {
        status: 'unknown',
        answer_type: 'definition',
        sections: [],
        images: [],
        follow_up_questions: [
          `I do not yet have an authored definition for ${subject}.`,
        ],
        citations: [],
        confidence: 'unknown',
        quality_flags: ['strategy:definition', 'zero_knowledge_evidence'],
        provenance: buildProvenance(evidencePackage, router),
      };
    }

    // Build EvidenceRefs preserving provider order (provider sorts by match_score)
    const knowledgeRefs = knowledgeRecords.map((rec) => ({
      evidenceType: 'knowledge',
      path_or_id: rec?.path ?? rec?.id ?? '',
    }));

    // Section describes the definition structure (renderer-agnostic)
    // key_points are structured hints for the renderer, extracted from record titles
    const keyPoints = knowledgeRecords
      .slice(0, 5)
      .map((r) => (r?.title ? String(r.title).trim() : ''))
      .filter((t) => t.length > 0);

    const section = {
      section_type: 'definition',
      title: definitionTitle(router),
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
      answer_type: 'definition',
      sections: [section],
      images: [],
      follow_up_questions: [],
      citations: knowledgeRefs.slice(),
      confidence,
      quality_flags: [
        'strategy:definition',
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
      matched_intent: 'definition',
      strategy: INTENT_NAME,
      strategy_version: STRATEGY_VERSION,
      decision_path: flags.filter((f) => !f.startsWith('strategy:')),
      evidence_selected: plan.citations || [],
      evidence_rejected: [],
      rejection_reasons: {},
    };
  },
};

// ---------- Phase 7 · Definition Strategy Acceptance ----------

function fakePackage(knowledgeRecords, requestOverrides = {}) {
  const evidenceBuckets = {
    knowledge: knowledgeRecords, faq: [], workshopPrinciples: [], profiles: [],
    images: [], pricing: [], drawings: [], videos: [],
  };
  return {
    request: {
      intent: 'Learn', subject: 'housed string', brain: 'Staircase',
      domain: 'Components', information_type: 'Definition', confidence: 0.9, ...requestOverrides,
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
  checks.push({ name: 'AC1b · intentName === "definition"', pass: strategy.intentName === 'definition' });
  checks.push({ name: 'AC1c · strategyVersion is a string', pass: typeof strategy.strategyVersion === 'string' });
  checks.push({ name: 'AC1d · canHandle is a function', pass: typeof strategy.canHandle === 'function' });
  checks.push({ name: 'AC1e · execute is a function', pass: typeof strategy.execute === 'function' });
  checks.push({ name: 'AC1f · explain is a function (optional but present)', pass: typeof strategy.explain === 'function' });

  // AC2 · canHandle self-declares correctly · narrow · no overlap with Gallery
  checks.push({ name: 'AC2a · canHandle=true for information_type === Definition', pass: strategy.canHandle({ information_type: 'Definition' }) === true });
  checks.push({ name: 'AC2b · canHandle=true (case-insensitive)', pass: strategy.canHandle({ information_type: 'definition' }) === true });
  checks.push({ name: 'AC2c · canHandle=false for information_type === Images (belongs to Gallery)', pass: strategy.canHandle({ information_type: 'Images' }) === false });
  checks.push({ name: 'AC2d · canHandle=false for information_type === Comparison (belongs to future Comparison strategy)', pass: strategy.canHandle({ information_type: 'Comparison' }) === false });
  checks.push({ name: 'AC2e · canHandle=false for null/undefined/empty input', pass: strategy.canHandle(null) === false && strategy.canHandle(undefined) === false && strategy.canHandle({}) === false });

  // AC3 · Empty knowledge evidence → status unknown (honest gap)
  {
    const pkg = fakePackage([]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    checks.push({ name: 'AC3a · No knowledge evidence · status === "unknown"', pass: plan.status === 'unknown' });
    checks.push({ name: 'AC3b · No knowledge evidence · answer_type still === "definition"', pass: plan.answer_type === 'definition' });
    checks.push({ name: 'AC3c · No knowledge evidence · follow_up references subject verbatim', pass: plan.follow_up_questions[0]?.includes('housed string') });
    checks.push({ name: 'AC3d · No knowledge evidence · sections empty', pass: plan.sections.length === 0 });
    checks.push({ name: 'AC3e · No knowledge evidence · citations empty', pass: plan.citations.length === 0 });
  }

  // AC4 · Knowledge evidence exists → status ok · rich section
  {
    const pkg = fakePackage([
      { path: 'a.md', title: 'Housed String · Anatomy', match_score: 3 },
      { path: 'b.md', title: 'String Types Overview', match_score: 2 },
    ]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    checks.push({ name: 'AC4a · Knowledge evidence · status === "ok"', pass: plan.status === 'ok' });
    checks.push({ name: 'AC4b · Knowledge evidence · answer_type === "definition"', pass: plan.answer_type === 'definition' });
    checks.push({ name: 'AC4c · Knowledge evidence · exactly 1 section', pass: plan.sections.length === 1 });
    checks.push({ name: 'AC4d · Knowledge evidence · section title includes subject', pass: plan.sections[0].title.includes('housed string') });
    checks.push({ name: 'AC4e · Knowledge evidence · section carries key_points from titles', pass: plan.sections[0].key_points.length === 2 && plan.sections[0].key_points[0].includes('Housed String') });
    checks.push({ name: 'AC4f · Knowledge evidence · images empty (definition does not lead with images)', pass: plan.images.length === 0 });
    checks.push({ name: 'AC4g · Knowledge evidence · citations mirror knowledge refs', pass: plan.citations.length === 2 && plan.citations.every((c) => c.evidenceType === 'knowledge') });
    checks.push({ name: 'AC4h · Knowledge evidence · confidence "high" (top_score 3)', pass: plan.confidence === 'high' });
  }

  // AC5 · Order preserved
  {
    const pkg = fakePackage([
      { path: 'first', match_score: 10, title: 'First' },
      { path: 'second', match_score: 5, title: 'Second' },
      { path: 'third', match_score: 1, title: 'Third' },
    ]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    checks.push({
      name: 'AC5 · Knowledge order preserved',
      pass: plan.citations[0].path_or_id === 'first' && plan.citations[1].path_or_id === 'second' && plan.citations[2].path_or_id === 'third',
    });
  }

  // AC6 · Every EvidenceRef traces to a record in the Package (no invention)
  {
    const pkg = fakePackage([{ path: 'a' }, { path: 'b' }]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    const packagePaths = new Set(pkg.evidence.knowledge.map((r) => r.path));
    const allTraced = plan.citations.every((ref) => packagePaths.has(ref.path_or_id));
    checks.push({ name: 'AC6 · Every knowledge EvidenceRef traces to a record in Package', pass: allTraced });
  }

  // AC7 · Invalid inputs tolerated
  const invalidCases = [
    { label: 'null input', input: undefined },
    { label: 'empty object', input: { evidencePackage: {} } },
    { label: 'package without evidence', input: { evidencePackage: { evidence: null } } },
    { label: 'package.evidence.knowledge not array', input: { evidencePackage: { evidence: { knowledge: 'not-array' } } } },
  ];
  for (const c of invalidCases) {
    let plan = null, threw = false;
    try { plan = strategy.execute(c.input); } catch { threw = true; }
    const valid = plan && typeof plan === 'object' && 'status' in plan && 'answer_type' in plan;
    checks.push({ name: `AC7 · ${c.label} · valid Plan returned`, pass: !threw && valid });
  }

  // AC8 · ARCHITECTURAL · strategy does not import providers/filesystem/manifest
  {
    const fullSrc = readFileSyncSafe('C:/Users/Victus/trades/scripts/strategies/definition.strategy.mjs');
    const marker = '// ---------- Phase 7 · Definition Strategy Acceptance ----------';
    const exportedSrc = fullSrc.split(marker)[0] ?? fullSrc;
    const forbiddenImports = [
      'nex-retrieval-image-provider',
      'nex-retrieval-knowledge-provider',
      'nex-retrieval-faq-provider',
      'nex-retrieval-typeprofile-provider',
      'nex-retrieval-workshopprinciple-provider',
      'nex-retrieval-engine',
      'nex-knowledge-index-builder',
      'nex-image-manifest',
      'knowledge-index',
    ];
    const found = forbiddenImports.filter((f) =>
      new RegExp(`^\\s*import[^;]*from\\s*['"\`][^'"\`]*${f}`, 'm').test(exportedSrc)
    );
    checks.push({ name: 'AC8a · Strategy does not import providers · engine · builder', pass: found.length === 0 });
    const fsReads = /\breadFileSync\b|\breadFile\b|\brequire\s*\(\s*['"`]fs/.test(exportedSrc);
    checks.push({ name: 'AC8b · Exported strategy code contains no filesystem read calls', pass: !fsReads });
    const netCalls = /\bfetch\b|\bhttps?\.\w+\b|\baxios\b/.test(exportedSrc);
    checks.push({ name: 'AC8c · Exported strategy code contains no network calls', pass: !netCalls });
    const fsImport = /^\s*import[^;]*from\s*['"`]node:fs['"`]/m.test(exportedSrc);
    checks.push({ name: 'AC8d · Exported strategy code does not import node:fs', pass: !fsImport });
  }

  // AC9 · Determinism
  {
    const pkg = fakePackage([{ path: 'a', match_score: 2 }, { path: 'b', match_score: 1 }]);
    const p1 = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    const p2 = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    const same = p1.status === p2.status && p1.citations.length === p2.citations.length && p1.provenance.evidence_package_hash === p2.provenance.evidence_package_hash;
    checks.push({ name: 'AC9 · Deterministic content across runs', pass: same });
  }

  // AC10 · explain() returns diagnostic
  {
    const pkg = fakePackage([{ path: 'x', match_score: 3, title: 'T' }]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    const diag = strategy.explain(plan);
    checks.push({ name: 'AC10a · explain returns object with matched_intent · strategy · decision_path', pass: !!diag && 'matched_intent' in diag && 'strategy' in diag && 'decision_path' in diag });
    checks.push({ name: 'AC10b · explain diag has no prose-shaped field', pass: !('text' in diag) && !('response' in diag) && !('markdown' in diag) });
  }

  return { name: 'Phase 7 · Definition Strategy Acceptance', checks };
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
  console.log('NEX Composer Strategy · definition · v1 · Phase 7');
  console.log('');
  const suite = runAcceptanceTests();
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Definition Strategy Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));
  if (r.passed !== r.total) { console.log('Definition Strategy · FAILED'); process.exit(1); }
  console.log('Definition Strategy · PASSED · Strategy API v1 · no provider access · zero invention');
}

import { pathToFileURL } from 'node:url';
const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
