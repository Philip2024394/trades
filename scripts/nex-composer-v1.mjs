/**
 * NEX Composer · v1 · Phase 7 · Pure Orchestrator
 * ----------------------------------------------------------------------------
 * Spec:   data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase:  7 of 10 (Composer becomes strategy orchestrator · business logic moves to strategies/)
 * Upstream (frozen · never touched by this file):
 *   - scripts/nex-router-build-009.mjs
 *   - scripts/nex-retrieval-engine-v1.mjs
 *   - scripts/nex-retrieval-*-provider-v1.mjs (5 providers)
 *
 * Composer's ONLY responsibility (Philip 2026-07-31 · locked):
 *   1. Load the strategy registry
 *   2. Find the exactly-one strategy that canHandle the router decision
 *      (registry returns the guaranteed `unknown` fallback when zero match)
 *   3. Call strategy.execute({ router, evidencePackage, requestContext })
 *   4. Object.freeze the returned Plan
 *   5. Return
 *
 * **If this file ever contains staircase logic · pricing logic · gallery
 * logic · FAQ logic · workshop logic — the architecture has been violated.**
 * Business decisions live in scripts/strategies/. Composer only orchestrates.
 *
 * Phase 6 acceptance suite (31/31) is preserved unchanged below · it now
 * exercises the orchestrator + unknown fallback strategy end-to-end.
 */

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { EvidenceRetrievalEngine } from './nex-retrieval-engine-v1.mjs';
import { createDefaultRegistry } from './strategies/registry.mjs';

const COMPOSER_VERSION = 'v1';

// Locked plan-field list (Philip 2026-07-31)
const REQUIRED_PLAN_FIELDS = [
  'status',
  'answer_type',
  'sections',
  'images',
  'follow_up_questions',
  'citations',
  'confidence',
  'quality_flags',
  'provenance',
];

const VALID_STATUS = new Set(['ok', 'clarify', 'unknown']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low', 'unknown']);

// ---------- Pure orchestration ----------

export function createComposer(options = {}) {
  const registry = options.registry ?? createDefaultRegistry();

  return {
    registry,
    composerVersion: COMPOSER_VERSION,

    compose(evidencePackage, routerDecision, requestContext = {}) {
      const strategy = registry.findFor(routerDecision);
      const plan = strategy.execute({
        router: routerDecision,
        evidencePackage,
        requestContext,
      });
      return freezePlan(plan);
    },
  };
}

function freezePlan(plan) {
  if (!plan || typeof plan !== 'object') return plan;
  if (Array.isArray(plan.sections)) Object.freeze(plan.sections);
  if (Array.isArray(plan.images)) Object.freeze(plan.images);
  if (Array.isArray(plan.follow_up_questions)) Object.freeze(plan.follow_up_questions);
  if (Array.isArray(plan.citations)) Object.freeze(plan.citations);
  if (Array.isArray(plan.quality_flags)) Object.freeze(plan.quality_flags);
  if (plan.provenance && typeof plan.provenance === 'object') Object.freeze(plan.provenance);
  return Object.freeze(plan);
}

// ---------- Phase 6 Acceptance (preserved · exercises orchestrator + unknown fallback) ----------

// Use a request shape that no content-bearing strategy currently claims,
// so unknown-fallback path is genuinely exercised for AC1/AC2/AC3.
function fakeEmptyPackage(reqOverrides = {}) {
  const engine = new EvidenceRetrievalEngine();
  const req = {
    intent: 'UnclassifiedIntent',
    subject: 'test subject',
    brain: 'Staircase',
    domain: 'UnclassifiedDomain',
    information_type: 'UnclassifiedInfoType',
    confidence: 0.9,
    clarify: false,
    ...reqOverrides,
  };
  return { req, pkg: engine.retrieve(req) };
}

function fakePackageWithProvider(records, evidenceType, reqOverrides = {}) {
  const engine = new EvidenceRetrievalEngine();
  engine.register({
    evidenceType,
    canHandle: () => true,
    retrieve: () => records,
  });
  const req = {
    intent: 'UnclassifiedIntent',
    subject: 'test subject',
    brain: 'Staircase',
    domain: 'UnclassifiedDomain',
    information_type: 'UnclassifiedInfoType',
    confidence: 0.9,
    clarify: false,
    ...reqOverrides,
  };
  return { req, pkg: engine.retrieve(req) };
}

function isValidPlan(plan) {
  if (!plan || typeof plan !== 'object') return { ok: false, why: 'not-object' };
  for (const f of REQUIRED_PLAN_FIELDS) {
    if (!(f in plan)) return { ok: false, why: `missing:${f}` };
  }
  if (!VALID_STATUS.has(plan.status)) return { ok: false, why: `bad-status:${plan.status}` };
  if (!VALID_CONFIDENCE.has(plan.confidence)) return { ok: false, why: `bad-confidence:${plan.confidence}` };
  if (typeof plan.answer_type !== 'string') return { ok: false, why: 'answer_type-not-string' };
  if (!Array.isArray(plan.sections)) return { ok: false, why: 'sections-not-array' };
  if (!Array.isArray(plan.images)) return { ok: false, why: 'images-not-array' };
  if (!Array.isArray(plan.follow_up_questions)) return { ok: false, why: 'follow_up_questions-not-array' };
  if (!Array.isArray(plan.citations)) return { ok: false, why: 'citations-not-array' };
  if (!Array.isArray(plan.quality_flags)) return { ok: false, why: 'quality_flags-not-array' };
  if (!plan.provenance || typeof plan.provenance !== 'object') return { ok: false, why: 'provenance-not-object' };
  return { ok: true };
}

function runAcceptanceTests() {
  const checks = [];
  const composer = createComposer();

  // AC1 · Empty EvidencePackage produces a valid Plan (unknown status)
  {
    const { req, pkg } = fakeEmptyPackage();
    const plan = composer.compose(pkg, req);
    const v = isValidPlan(plan);
    checks.push({ name: 'AC1a · Empty Package · Plan is syntactically valid', pass: v.ok, why: v.why });
    checks.push({ name: 'AC1b · Empty Package · status === "unknown"', pass: plan.status === 'unknown' });
    checks.push({ name: 'AC1c · Empty Package · answer_type === "unknown"', pass: plan.answer_type === 'unknown' });
    checks.push({ name: 'AC1d · Empty Package · confidence === "unknown"', pass: plan.confidence === 'unknown' });
    checks.push({ name: 'AC1e · Empty Package · follow_up_questions non-empty (honest gap)', pass: plan.follow_up_questions.length > 0 });
    checks.push({ name: 'AC1f · Empty Package · citations empty', pass: plan.citations.length === 0 });
  }

  // AC2 · Package with evidence produces a valid Plan (ok status)
  {
    const { req, pkg } = fakePackageWithProvider(
      [{ path: 'a.md', title: 'A' }, { path: 'b.md', title: 'B' }],
      'knowledge'
    );
    const plan = composer.compose(pkg, req);
    const v = isValidPlan(plan);
    checks.push({ name: 'AC2a · Package with evidence · Plan is syntactically valid', pass: v.ok, why: v.why });
    checks.push({ name: 'AC2b · Package with evidence · status === "ok"', pass: plan.status === 'ok' });
    checks.push({ name: 'AC2c · Package with evidence · citations trail full', pass: plan.citations.length === 2 });
    checks.push({ name: 'AC2d · Package with evidence · citations point to real evidence types', pass: plan.citations.every((c) => c.evidenceType === 'knowledge' && typeof c.path_or_id === 'string') });
  }

  // AC3 · Low Router confidence produces clarify status
  {
    const { req, pkg } = fakePackageWithProvider(
      [{ path: 'x.md' }],
      'knowledge',
      { confidence: 0.5 }
    );
    const plan = composer.compose(pkg, req);
    const v = isValidPlan(plan);
    checks.push({ name: 'AC3a · Low Router confidence · Plan valid', pass: v.ok, why: v.why });
    checks.push({ name: 'AC3b · Low Router confidence · status === "clarify"', pass: plan.status === 'clarify' });
    checks.push({ name: 'AC3c · Low Router confidence · confidence === "low"', pass: plan.confidence === 'low' });
    checks.push({ name: 'AC3d · Low Router confidence · follow_up_questions non-empty', pass: plan.follow_up_questions.length > 0 });
  }

  // AC4 · Invalid input never crashes · always returns a valid Plan
  const invalidCases = [null, undefined, 42, 'string', [], {}];
  for (const [i, input] of invalidCases.entries()) {
    let plan = null;
    let threw = false;
    try {
      plan = composer.compose(input, { intent: 'Learn' });
    } catch {
      threw = true;
    }
    const v = plan ? isValidPlan(plan) : { ok: false, why: 'threw' };
    checks.push({
      name: `AC4.${i + 1} · Invalid input tolerated · Plan still valid (input: ${JSON.stringify(input)?.slice(0, 30) ?? 'undefined'})`,
      pass: !threw && v.ok,
      why: v.why,
    });
  }

  // AC5 · Plan is immutable (frozen)
  {
    const { req, pkg } = fakeEmptyPackage();
    const plan = composer.compose(pkg, req);
    checks.push({ name: 'AC5a · Plan is frozen (top-level)', pass: Object.isFrozen(plan) });
    checks.push({ name: 'AC5b · Plan.sections is frozen', pass: Object.isFrozen(plan.sections) });
    checks.push({ name: 'AC5c · Plan.provenance is frozen', pass: Object.isFrozen(plan.provenance) });
    let mutationBlocked = true;
    try { plan.status = 'ok'; if (plan.status === 'ok') mutationBlocked = false; } catch {}
    checks.push({ name: 'AC5d · Attempting to mutate Plan is blocked', pass: mutationBlocked });
  }

  // AC6 · Composer is pure — same input produces same Plan structure and citations
  {
    const { req, pkg } = fakePackageWithProvider(
      [{ path: 'a.md' }, { path: 'b.md' }],
      'knowledge'
    );
    const plan1 = composer.compose(pkg, req);
    const plan2 = composer.compose(pkg, req);
    checks.push({
      name: 'AC6a · Same input · same status/answer_type/citations count',
      pass: plan1.status === plan2.status && plan1.answer_type === plan2.answer_type && plan1.citations.length === plan2.citations.length,
    });
    checks.push({
      name: 'AC6b · Same input · same evidence_package_hash',
      pass: plan1.provenance.evidence_package_hash === plan2.provenance.evidence_package_hash,
    });
  }

  // AC7 · Composer does not mutate the input EvidencePackage
  {
    const { req, pkg } = fakePackageWithProvider(
      [{ path: 'a.md' }],
      'knowledge'
    );
    const before = JSON.stringify(pkg);
    composer.compose(pkg, req);
    const after = JSON.stringify(pkg);
    checks.push({ name: 'AC7 · Input EvidencePackage unchanged after compose()', pass: before === after });
  }

  // AC8 · Composer never produces prose (only structured content)
  {
    const { req, pkg } = fakePackageWithProvider(
      [{ path: 'a.md' }],
      'knowledge'
    );
    const plan = composer.compose(pkg, req);
    const forbidden = ['text', 'response', 'markdown', 'html', 'prose', 'body', 'content'];
    const foundForbidden = forbidden.filter((f) => f in plan);
    checks.push({
      name: 'AC8 · No prose-shaped fields in Plan (text/response/markdown/html/prose/body/content)',
      pass: foundForbidden.length === 0,
      why: foundForbidden.join(','),
    });
  }

  // AC9 · Composer imports no renderer/gate/LLM AND contains no business logic
  {
    const src = readFileSyncSafe('C:/Users/Victus/trades/scripts/nex-composer-v1.mjs');
    const forbiddenImports = ['nex-renderer', 'nex-quality-gate', 'nex-language-renderer'];
    const found = forbiddenImports.filter((f) =>
      new RegExp(`^\\s*import[^;]*from\\s*['"\`][^'"\`]*${f}`, 'm').test(src)
    );
    checks.push({ name: 'AC9a · Composer does not import from a future renderer or gate', pass: found.length === 0 });
    const aiForbidden = ['openai', 'anthropic', '@anthropic-ai', 'claude', 'gpt'];
    const foundAI = aiForbidden.filter((f) =>
      new RegExp(`^\\s*import[^;]*from\\s*['"\`][^'"\`]*${f}`, 'im').test(src)
    );
    checks.push({ name: 'AC9b · Composer does not import any LLM/AI package', pass: foundAI.length === 0 });
    // Phase 7 addition: Composer must not contain business-logic vocabulary
    const businessLogic = [
      /\bpricing\b/i,
      /\bstaircase\s+type/i,
      /\bcut string\b/i,
      /\bnewel\b/i,
      /\btread\b/i,
      /\bfaq\b/i,
    ];
    // Exclude the header comment block which mentions these words as warnings
    const codeOnly = src.split(/\/\/\s*----------\s*Pure orchestration\s*----------/)[1] ?? '';
    const businessLogicHits = businessLogic.filter((re) => re.test(codeOnly));
    checks.push({
      name: 'AC9c · Composer code contains no business-logic vocabulary (pure orchestration)',
      pass: businessLogicHits.length === 0,
      why: businessLogicHits.map((r) => r.toString()).join(','),
    });
  }

  // AC10 · Full upstream regression — engine and provider imports still work
  {
    const engine = new EvidenceRetrievalEngine();
    const pkg = engine.retrieve({ intent: 'Learn', subject: 'x', brain: 'Staircase' });
    checks.push({
      name: 'AC10 · Engine still produces valid EvidencePackage (Phase 1 unchanged)',
      pass: !!pkg && !!pkg.evidence && !!pkg.diagnostics,
    });
  }

  return { name: 'Phase 6/7 · Composer Orchestrator Acceptance', checks };
}

function readFileSyncSafe(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

function report(suite) {
  const total = suite.checks.length;
  const passed = suite.checks.filter((c) => c.pass).length;
  const line = '-'.repeat(78);
  console.log(line);
  console.log(`${suite.name} · ${passed}/${total}`);
  console.log(line);
  for (const c of suite.checks) {
    const suffix = !c.pass && c.why ? `  [${c.why}]` : '';
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${suffix}`);
  }
  return { passed, total };
}

function main() {
  console.log('NEX Composer · v1 · Phase 7 · Pure Orchestrator Acceptance');
  console.log('Spec: NEX-RUNTIME-PIPELINE-v1-SPEC.md');
  console.log('Upstream (frozen): Router · Retrieval Engine · 5 Providers · Index Builder');
  console.log('Strategies: unknown (fallback) · registry.mjs (deterministic selection)');
  console.log('');
  const composer = createComposer();
  console.log(`Registered strategies: [${composer.registry.list().map((s) => s.intentName).join(', ')}]`);
  console.log('');
  const suite = runAcceptanceTests();
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Composer Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));
  if (r.passed !== r.total) {
    console.log('Composer · FAILED · orchestrator does not satisfy Phase 6/7 contract');
    process.exit(1);
  }
  console.log('Composer · PASSED · pure orchestration · Phase 6 tests preserved · Phase 7 discipline enforced');
  console.log('Next: register first content-bearing strategy (gallery / definition / etc.) when green-lit');
}

const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
