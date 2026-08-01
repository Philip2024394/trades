/**
 * NEX Retrieval Engine · v1 · Phase 1 Skeleton
 * ----------------------------------------------------------------------------
 * Spec:   data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase:  1 of 8 (Retrieval Engine Skeleton · no providers)
 * Freeze: Router v1 (scripts/nex-router-build-009.mjs) is the caller contract
 *
 * Purpose:
 *   Prove that the runtime has a stable EvidencePackage contract.
 *   No providers registered · every evidence array empty · structure locked.
 *
 * Non-goals for Phase 1:
 *   No image lookup · no knowledge lookup · no FAQ lookup · no composition · no chat.
 *
 * Provider interface (locked · used by Phase 2+):
 *   {
 *     evidenceType: string,           // must match a key in evidence bucket
 *     canHandle(request) → boolean,   // self-declares relevance
 *     retrieve(request) → object[]    // returns matching evidence records
 *   }
 */

const ENGINE_VERSION = 'v1';
const ENGINE_PHASE = 1;

const EVIDENCE_BUCKETS = [
  'knowledge',
  'faq',
  'workshopPrinciples',
  'profiles',
  'images',
  'pricing',
  'drawings',
  'videos',
];

function emptyEvidence() {
  const out = {};
  for (const key of EVIDENCE_BUCKETS) out[key] = [];
  return out;
}

export class EvidenceRetrievalEngine {
  constructor() {
    this.providers = [];
  }

  register(provider) {
    if (!provider || typeof provider !== 'object') {
      throw new Error('Provider must be an object');
    }
    if (typeof provider.evidenceType !== 'string' || !provider.evidenceType) {
      throw new Error('Provider must declare an evidenceType string');
    }
    if (typeof provider.canHandle !== 'function') {
      throw new Error('Provider must implement canHandle(request) → boolean');
    }
    if (typeof provider.retrieve !== 'function') {
      throw new Error('Provider must implement retrieve(request) → EvidenceRecord[]');
    }
    if (!EVIDENCE_BUCKETS.includes(provider.evidenceType)) {
      throw new Error(
        `Provider evidenceType "${provider.evidenceType}" is not a recognised bucket. ` +
          `Recognised: ${EVIDENCE_BUCKETS.join(', ')}`
      );
    }
    this.providers.push(provider);
  }

  retrieve(request) {
    const started = Date.now();
    const started_at = new Date(started).toISOString();

    const evidence = emptyEvidence();
    const providers_queried = [];
    const providers_matched = [];
    const warnings = [];
    // provider_status: derived per-provider outcome so runtime can distinguish
    //   "no results" (searched cleanly, 0 matches) from "cannot search" (threw).
    // Additive · does not change existing diagnostic fields.
    const provider_status = {};

    for (const provider of this.providers) {
      const et = provider.evidenceType;
      providers_queried.push(et);
      let handles = false;
      try {
        handles = Boolean(provider.canHandle(request));
      } catch (err) {
        warnings.push(`Provider "${et}" canHandle threw: ${err.message}`);
        provider_status[et] = { status: 'error', matches: 0, error: err.message, stage: 'canHandle' };
        continue;
      }
      if (!handles) {
        provider_status[et] = { status: 'skipped', matches: 0 };
        continue;
      }
      providers_matched.push(et);
      let records = [];
      try {
        records = provider.retrieve(request);
      } catch (err) {
        warnings.push(`Provider "${et}" retrieve threw: ${err.message}`);
        provider_status[et] = { status: 'error', matches: 0, error: err.message, stage: 'retrieve' };
        continue;
      }
      if (!Array.isArray(records)) {
        warnings.push(`Provider "${et}" returned non-array from retrieve`);
        provider_status[et] = { status: 'error', matches: 0, error: 'non-array return', stage: 'retrieve' };
        continue;
      }
      evidence[et].push(...records);
      provider_status[et] = { status: 'success', matches: records.length };
    }

    const completed = Date.now();
    return {
      request,
      evidence,
      diagnostics: { providers_queried, providers_matched, warnings, provider_status },
      timing: {
        started_at,
        completed_at: new Date(completed).toISOString(),
        duration_ms: completed - started,
      },
      metadata: { engine_version: ENGINE_VERSION, phase: ENGINE_PHASE },
    };
  }
}

// ---------- Phase 1 Structural Contract Test ----------

const SAMPLE_ROUTER_DECISION = {
  intent: 'Show',
  subject: 'Straight Flight Staircase',
  brain: 'Staircase',
  domain: 'Reference Gallery',
  information_type: 'Images',
  confidence: 0.92,
  clarify: false,
};

function runStructuralTest() {
  const engine = new EvidenceRetrievalEngine();
  const pkg = engine.retrieve(SAMPLE_ROUTER_DECISION);
  const checks = [];

  const topLevel = ['request', 'evidence', 'diagnostics', 'timing', 'metadata'];
  for (const key of topLevel) {
    checks.push({ name: `EvidencePackage.${key} present`, pass: key in pkg });
  }

  for (const bucket of EVIDENCE_BUCKETS) {
    checks.push({
      name: `evidence.${bucket} exists and is empty array`,
      pass: Array.isArray(pkg.evidence[bucket]) && pkg.evidence[bucket].length === 0,
    });
  }

  checks.push({
    name: 'request preserved verbatim',
    pass:
      pkg.request &&
      pkg.request.subject === SAMPLE_ROUTER_DECISION.subject &&
      pkg.request.intent === SAMPLE_ROUTER_DECISION.intent &&
      pkg.request.brain === SAMPLE_ROUTER_DECISION.brain,
  });

  checks.push({
    name: 'diagnostics.providers_queried is empty array (no providers registered)',
    pass:
      Array.isArray(pkg.diagnostics.providers_queried) &&
      pkg.diagnostics.providers_queried.length === 0,
  });
  checks.push({
    name: 'diagnostics.providers_matched is empty array',
    pass:
      Array.isArray(pkg.diagnostics.providers_matched) &&
      pkg.diagnostics.providers_matched.length === 0,
  });
  checks.push({
    name: 'diagnostics.warnings is empty array',
    pass: Array.isArray(pkg.diagnostics.warnings) && pkg.diagnostics.warnings.length === 0,
  });

  checks.push({
    name: 'timing has ISO started_at, completed_at, numeric duration_ms',
    pass:
      typeof pkg.timing.started_at === 'string' &&
      typeof pkg.timing.completed_at === 'string' &&
      typeof pkg.timing.duration_ms === 'number' &&
      pkg.timing.duration_ms >= 0,
  });

  checks.push({
    name: 'metadata.engine_version === "v1"',
    pass: pkg.metadata.engine_version === 'v1',
  });
  checks.push({
    name: 'metadata.phase === 1',
    pass: pkg.metadata.phase === 1,
  });

  return { name: 'Structural Contract', checks };
}

function runInterfaceContractTest() {
  const checks = [];

  const cases = [
    {
      name: 'Rejects null provider',
      provider: null,
    },
    {
      name: 'Rejects provider without evidenceType',
      provider: { canHandle: () => false, retrieve: () => [] },
    },
    {
      name: 'Rejects provider without canHandle',
      provider: { evidenceType: 'images', retrieve: () => [] },
    },
    {
      name: 'Rejects provider without retrieve',
      provider: { evidenceType: 'images', canHandle: () => false },
    },
    {
      name: 'Rejects provider with unknown evidenceType',
      provider: { evidenceType: 'unicorns', canHandle: () => false, retrieve: () => [] },
    },
  ];

  for (const c of cases) {
    const engine = new EvidenceRetrievalEngine();
    let threw = false;
    try {
      engine.register(c.provider);
    } catch {
      threw = true;
    }
    checks.push({ name: c.name, pass: threw });
  }

  // Positive case: a minimal valid provider is accepted and its results appear in the correct bucket
  const engine = new EvidenceRetrievalEngine();
  const stubProvider = {
    evidenceType: 'images',
    canHandle: (req) => req.information_type === 'Images',
    retrieve: () => [{ id: 'stub-0001' }],
  };
  let acceptError = null;
  try {
    engine.register(stubProvider);
  } catch (err) {
    acceptError = err;
  }
  checks.push({ name: 'Accepts a minimal valid provider', pass: acceptError === null });

  const pkg = engine.retrieve(SAMPLE_ROUTER_DECISION);
  checks.push({
    name: 'Registered provider is queried',
    pass: pkg.diagnostics.providers_queried.includes('images'),
  });
  checks.push({
    name: 'Provider that returns true from canHandle is matched',
    pass: pkg.diagnostics.providers_matched.includes('images'),
  });
  checks.push({
    name: 'Retrieved records land in the declared bucket',
    pass:
      pkg.evidence.images.length === 1 &&
      pkg.evidence.images[0].id === 'stub-0001',
  });

  // Negative case: a provider that says canHandle=false must not populate its bucket
  const engine2 = new EvidenceRetrievalEngine();
  engine2.register({
    evidenceType: 'faq',
    canHandle: () => false,
    retrieve: () => [{ id: 'should-not-appear' }],
  });
  const pkg2 = engine2.retrieve(SAMPLE_ROUTER_DECISION);
  checks.push({
    name: 'Provider with canHandle=false does not populate bucket',
    pass: pkg2.evidence.faq.length === 0 && !pkg2.diagnostics.providers_matched.includes('faq'),
  });

  return { name: 'Provider Interface Contract', checks };
}

function report(suite) {
  const total = suite.checks.length;
  const passed = suite.checks.filter((c) => c.pass).length;
  const line = '-'.repeat(72);
  console.log(line);
  console.log(`${suite.name} · ${passed}/${total}`);
  console.log(line);
  for (const c of suite.checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}`);
  }
  return { passed, total };
}

function main() {
  console.log('NEX Retrieval Engine · v1 · Phase 1 · Skeleton Test');
  console.log('Spec: NEX-RUNTIME-PIPELINE-v1-SPEC.md');
  console.log('Router caller: scripts/nex-router-build-009.mjs (v1 · frozen)');
  console.log('');

  const suites = [runStructuralTest(), runInterfaceContractTest()];
  let totalPassed = 0;
  let totalCount = 0;
  for (const s of suites) {
    const r = report(s);
    totalPassed += r.passed;
    totalCount += r.total;
    console.log('');
  }

  console.log('='.repeat(72));
  console.log(`Phase 1 Overall · ${totalPassed}/${totalCount}`);
  console.log('='.repeat(72));

  if (totalPassed !== totalCount) {
    console.log('Phase 1 · FAILED · skeleton does not satisfy Phase 1 contract');
    process.exit(1);
  }
  console.log('Phase 1 · PASSED · Retrieval Engine skeleton satisfies Phase 1 contract');
  console.log('Next: Phase 2 · Image Provider (uses existing nex-image-manifest.json)');
}

import { pathToFileURL } from 'node:url';
const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
