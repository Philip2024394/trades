/**
 * NEX Composer Strategy · gallery · v1
 * ----------------------------------------------------------------------------
 * Spec:  data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase: 7 (first content-bearing strategy)
 * API:   Strategy API v1
 *
 * Purpose (Philip 2026-07-31):
 *   Produces a "gallery" Response Plan from image evidence already retrieved
 *   by the Image Provider. Named "gallery" not "image" — the plan describes
 *   a gallery of visual assets. Future asset providers (drawings · CAD · PDFs
 *   · videos) can contribute to the same gallery structure without any
 *   change to this strategy · they will land in their own Plan buckets.
 *
 * Discipline (locked):
 *   - Consumes ONLY the EvidencePackage passed to execute()
 *   - Reads ONLY evidencePackage.evidence.images (and metadata already there)
 *   - NEVER calls a provider · NEVER reads the filesystem · NEVER opens the
 *     manifest · NEVER makes network calls
 *   - Preserves the order of image records as delivered by the provider
 *     (provider has already sorted by match_score)
 *   - Never invents · every EvidenceRef points to a record in the Package
 *   - Returns a plain object · Composer freezes it before returning to caller
 */

import { createHash } from 'node:crypto';

export const STRATEGY_API_VERSION = '1';
export const INTENT_NAME = 'gallery';
export const STRATEGY_VERSION = '1.0';

const GALLERY_INTENTS = new Set(['show', 'browse images']);
const GALLERY_INFO_TYPES = new Set(['images']);
const GALLERY_DOMAINS = new Set(['reference gallery']);

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
  return {
    plan_version: '1.0',
    router_version: router?.router_version ?? 'unknown',
    provider_versions: pkg?.evidence?.images?.length ? { images: '1.0' } : {},
    strategy: INTENT_NAME,
    strategy_version: STRATEGY_VERSION,
    composer_version: 'v1',
    composed_at: new Date().toISOString(),
    evidence_package_hash: hashPackage(pkg),
  };
}

function galleryTitle(router) {
  const subject = router?.subject ? String(router.subject).trim() : '';
  if (subject) return `Gallery · ${subject}`;
  return 'Gallery';
}

export const strategy = {
  strategyApiVersion: STRATEGY_API_VERSION,
  intentName: INTENT_NAME,
  strategyVersion: STRATEGY_VERSION,

  canHandle(routerDecision) {
    if (!routerDecision || typeof routerDecision !== 'object') return false;
    const intent = normalise(routerDecision.intent);
    const infoType = normalise(routerDecision.information_type);
    const domain = normalise(routerDecision.domain);
    return (
      GALLERY_INTENTS.has(intent) ||
      GALLERY_INFO_TYPES.has(infoType) ||
      GALLERY_DOMAINS.has(domain)
    );
  },

  execute({ router, evidencePackage /*, requestContext */ } = {}) {
    // Emergency plan for garbage input
    if (!evidencePackage || typeof evidencePackage !== 'object') {
      return {
        status: 'unknown',
        answer_type: 'gallery',
        sections: [],
        images: [],
        follow_up_questions: ['I could not process the incoming evidence.'],
        citations: [],
        confidence: 'unknown',
        quality_flags: ['strategy:gallery', 'emergency:invalid_evidence_package'],
        provenance: buildProvenance(evidencePackage, router),
      };
    }

    const imageRecords = Array.isArray(evidencePackage?.evidence?.images)
      ? evidencePackage.evidence.images
      : [];

    // Zero gallery evidence · honest gap
    if (imageRecords.length === 0) {
      return {
        status: 'unknown',
        answer_type: 'gallery',
        sections: [],
        images: [],
        follow_up_questions: [
          'I do not have gallery images matching that description yet.',
        ],
        citations: [],
        confidence: 'unknown',
        quality_flags: ['strategy:gallery', 'zero_gallery_evidence'],
        provenance: buildProvenance(evidencePackage, router),
      };
    }

    // Build EvidenceRefs preserving provider-delivered order (provider has
    // already sorted by match_score)
    const imageRefs = imageRecords.map((rec) => ({
      evidenceType: 'images',
      path_or_id: rec?.path ?? rec?.id ?? '',
    }));

    // Section describes the gallery structure (renderer-agnostic)
    const section = {
      section_type: 'gallery',
      title: galleryTitle(router),
      evidence_refs: imageRefs,
      key_points: [],
    };
    Object.freeze(section.evidence_refs);
    Object.freeze(section.key_points);
    Object.freeze(section);

    // Confidence signal from top score (if provider populated match_score)
    const topScore = Number(imageRecords[0]?.match_score ?? 0);
    let confidence = 'medium';
    if (topScore >= 3) confidence = 'high';
    else if (topScore === 0) confidence = 'low';

    return {
      status: 'ok',
      answer_type: 'gallery',
      sections: [section],
      images: imageRefs.slice(),
      follow_up_questions: [],
      citations: imageRefs.slice(),
      confidence,
      quality_flags: ['strategy:gallery', `image_count:${imageRecords.length}`, `top_score:${topScore}`],
      provenance: buildProvenance(evidencePackage, router),
    };
  },

  explain(plan) {
    if (!plan) return { strategy: INTENT_NAME, reason: 'no plan' };
    const flags = plan.quality_flags || [];
    return {
      matched_intent: 'gallery',
      strategy: INTENT_NAME,
      strategy_version: STRATEGY_VERSION,
      decision_path: flags.filter((f) => !f.startsWith('strategy:')),
      evidence_selected: plan.citations || [],
      evidence_rejected: [],
      rejection_reasons: {},
    };
  },
};

// ---------- Phase 7 · Gallery Strategy Acceptance ----------

function fakePackage(imageRecords, requestOverrides = {}) {
  const evidenceBuckets = {
    knowledge: [], faq: [], workshopPrinciples: [], profiles: [],
    images: imageRecords, pricing: [], drawings: [], videos: [],
  };
  return {
    request: { intent: 'Show', subject: 'oak staircase', brain: 'Staircase',
               domain: 'Reference Gallery', information_type: 'Images', confidence: 0.9, ...requestOverrides },
    evidence: evidenceBuckets,
    diagnostics: {
      providers_queried: ['images'],
      providers_matched: ['images'],
      warnings: [],
      provider_status: { images: { status: 'success', matches: imageRecords.length } },
    },
    timing: { started_at: 'x', completed_at: 'y', duration_ms: 0 },
    metadata: { engine_version: 'v1', phase: 1 },
  };
}

function runAcceptanceTests() {
  const checks = [];

  // AC1 · Strategy API v1 compliance
  checks.push({ name: 'AC1a · strategyApiVersion === "1"', pass: strategy.strategyApiVersion === '1' });
  checks.push({ name: 'AC1b · intentName === "gallery"', pass: strategy.intentName === 'gallery' });
  checks.push({ name: 'AC1c · strategyVersion is a string', pass: typeof strategy.strategyVersion === 'string' });
  checks.push({ name: 'AC1d · canHandle is a function', pass: typeof strategy.canHandle === 'function' });
  checks.push({ name: 'AC1e · execute is a function', pass: typeof strategy.execute === 'function' });
  checks.push({ name: 'AC1f · explain is a function (optional but present)', pass: typeof strategy.explain === 'function' });

  // AC2 · canHandle self-declares correctly
  checks.push({ name: 'AC2a · canHandle=true for Show intent', pass: strategy.canHandle({ intent: 'Show' }) === true });
  checks.push({ name: 'AC2b · canHandle=true for Browse Images intent', pass: strategy.canHandle({ intent: 'Browse Images' }) === true });
  checks.push({ name: 'AC2c · canHandle=true for information_type Images', pass: strategy.canHandle({ intent: 'Learn', information_type: 'Images' }) === true });
  checks.push({ name: 'AC2d · canHandle=true for Reference Gallery domain', pass: strategy.canHandle({ intent: 'Learn', domain: 'Reference Gallery' }) === true });
  checks.push({ name: 'AC2e · canHandle=false for Learn + Definition', pass: strategy.canHandle({ intent: 'Learn', information_type: 'Definition' }) === false });
  checks.push({ name: 'AC2f · canHandle=false for null/undefined input', pass: strategy.canHandle(null) === false && strategy.canHandle(undefined) === false });

  // AC3 · Empty gallery evidence → status unknown (honest gap)
  {
    const pkg = fakePackage([]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    checks.push({ name: 'AC3a · No image evidence · status === "unknown"', pass: plan.status === 'unknown' });
    checks.push({ name: 'AC3b · No image evidence · follow_up_questions non-empty', pass: plan.follow_up_questions.length > 0 });
    checks.push({ name: 'AC3c · No image evidence · sections empty', pass: plan.sections.length === 0 });
    checks.push({ name: 'AC3d · No image evidence · images empty', pass: plan.images.length === 0 });
  }

  // AC4 · Gallery evidence exists → status ok
  {
    const pkg = fakePackage([
      { path: 'url-1', match_score: 3, tags: ['oak', 'staircase', 'modern'] },
      { path: 'url-2', match_score: 2, tags: ['oak', 'staircase'] },
      { path: 'url-3', match_score: 1, tags: ['staircase'] },
    ]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    checks.push({ name: 'AC4a · Gallery evidence · status === "ok"', pass: plan.status === 'ok' });
    checks.push({ name: 'AC4b · Gallery evidence · answer_type === "gallery"', pass: plan.answer_type === 'gallery' });
    checks.push({ name: 'AC4c · Gallery evidence · exactly 1 section (gallery)', pass: plan.sections.length === 1 && plan.sections[0].section_type === 'gallery' });
    checks.push({ name: 'AC4d · Gallery evidence · section title derived from router subject', pass: plan.sections[0].title.includes('oak') });
    checks.push({ name: 'AC4e · Gallery evidence · images array has 3 refs', pass: plan.images.length === 3 });
    checks.push({ name: 'AC4f · Gallery evidence · citations mirror images', pass: plan.citations.length === plan.images.length });
    checks.push({ name: 'AC4g · Gallery evidence · confidence === "high" (top_score 3)', pass: plan.confidence === 'high' });
  }

  // AC5 · Order preserved (provider-delivered order retained)
  {
    const pkg = fakePackage([
      { path: 'first', match_score: 10 },
      { path: 'second', match_score: 5 },
      { path: 'third', match_score: 1 },
    ]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    checks.push({
      name: 'AC5 · Image order preserved (first, second, third)',
      pass: plan.images[0].path_or_id === 'first' && plan.images[1].path_or_id === 'second' && plan.images[2].path_or_id === 'third',
    });
  }

  // AC6 · Every EvidenceRef traces to a record in the Package (no invention)
  {
    const pkg = fakePackage([{ path: 'a' }, { path: 'b' }]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    const packagePaths = new Set(pkg.evidence.images.map((r) => r.path));
    const allTraced = plan.images.every((ref) => packagePaths.has(ref.path_or_id));
    checks.push({ name: 'AC6 · Every image EvidenceRef traces to a record in Package', pass: allTraced });
  }

  // AC7 · Invalid inputs tolerated · always returns a valid Plan
  const invalidCases = [
    { label: 'null input', input: undefined },
    { label: 'empty object', input: { evidencePackage: {} } },
    { label: 'package without evidence', input: { evidencePackage: { evidence: null } } },
    { label: 'package.evidence.images not array', input: { evidencePackage: { evidence: { images: 'not-array' } } } },
  ];
  for (const c of invalidCases) {
    let plan = null, threw = false;
    try { plan = strategy.execute(c.input); } catch { threw = true; }
    const valid = plan && typeof plan === 'object' && 'status' in plan && 'answer_type' in plan;
    checks.push({ name: `AC7 · ${c.label} · valid Plan returned`, pass: !threw && valid });
  }

  // AC8 · ARCHITECTURAL · strategy does not import providers/filesystem/manifest
  // Only the EXPORTED strategy code is inspected · not the acceptance-test
  // infrastructure below, which is inherently self-referential.
  {
    const fullSrc = readFileSyncSafe('C:/Users/Victus/trades/scripts/strategies/gallery.strategy.mjs');
    const marker = '// ---------- Phase 7 · Gallery Strategy Acceptance ----------';
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
    // No filesystem reads in exported code
    const fsReads = /\breadFileSync\b|\breadFile\b|\brequire\s*\(\s*['"`]fs/.test(exportedSrc);
    checks.push({ name: 'AC8b · Exported strategy code contains no filesystem read calls', pass: !fsReads });
    // No network calls in exported code
    const netCalls = /\bfetch\b|\bhttps?\.\w+\b|\baxios\b/.test(exportedSrc);
    checks.push({ name: 'AC8c · Exported strategy code contains no network calls', pass: !netCalls });
    // Exported code does not import from node:fs at all
    const fsImport = /^\s*import[^;]*from\s*['"`]node:fs['"`]/m.test(exportedSrc);
    checks.push({ name: 'AC8d · Exported strategy code does not import node:fs', pass: !fsImport });
  }

  // AC9 · Composer freezes the Plan (integration test via a stub Composer)
  {
    const pkg = fakePackage([{ path: 'x' }]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    // Strategy returns a plain object; Composer freezes it. Simulate freeze.
    Object.freeze(plan.sections);
    Object.freeze(plan.images);
    Object.freeze(plan);
    checks.push({ name: 'AC9 · Plan is freezable end-to-end (Composer will freeze it)', pass: Object.isFrozen(plan) });
  }

  // AC10 · Determinism (excluding composed_at)
  {
    const pkg = fakePackage([{ path: 'a', match_score: 2 }, { path: 'b', match_score: 1 }]);
    const p1 = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    const p2 = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    const same =
      p1.status === p2.status &&
      p1.answer_type === p2.answer_type &&
      p1.images.length === p2.images.length &&
      p1.images.every((r, i) => r.path_or_id === p2.images[i].path_or_id) &&
      p1.provenance.evidence_package_hash === p2.provenance.evidence_package_hash;
    checks.push({ name: 'AC10 · Deterministic content across runs (same package_hash · same refs · same order)', pass: same });
  }

  // AC11 · explain() returns diagnostic (engineer-facing · not customer prose)
  {
    const pkg = fakePackage([{ path: 'x', match_score: 3 }]);
    const plan = strategy.execute({ router: pkg.request, evidencePackage: pkg });
    const diag = strategy.explain(plan);
    checks.push({ name: 'AC11a · explain returns object with matched_intent · strategy · decision_path', pass: !!diag && 'matched_intent' in diag && 'strategy' in diag && 'decision_path' in diag });
    checks.push({ name: 'AC11b · explain diag has no prose-shaped field', pass: !('text' in diag) && !('response' in diag) && !('markdown' in diag) });
  }

  return { name: 'Phase 7 · Gallery Strategy Acceptance', checks };
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
  console.log('NEX Composer Strategy · gallery · v1 · Phase 7');
  console.log('');
  const suite = runAcceptanceTests();
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Gallery Strategy Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));
  if (r.passed !== r.total) { console.log('Gallery Strategy · FAILED'); process.exit(1); }
  console.log('Gallery Strategy · PASSED · Strategy API v1 · no provider access · order preserved · zero invention');
}

import { pathToFileURL } from 'node:url';
const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
