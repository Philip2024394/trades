/**
 * NEX Composer Strategy Registry · v1
 * ----------------------------------------------------------------------------
 * Spec:  data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase: 7
 *
 * Purpose:
 *   Single registration point for every strategy. Enforces Strategy API v1
 *   compliance, uniqueness of intentName, and deterministic selection.
 *
 * Selection rule (Philip 2026-07-31 · locked):
 *   candidates = strategies where intentName !== "unknown" AND canHandle(request)
 *   0 matches  → return unknown strategy (guaranteed fallback)
 *   1 match    → return that strategy
 *   >1 matches → THROW ConfigurationError · runtime does not guess
 *
 * Adding a new strategy:
 *   (1) Create scripts/strategies/<name>.strategy.mjs
 *   (2) Import + register it below
 *   Composer file is never edited.
 */

import { strategy as unknownStrategy } from './unknown.strategy.mjs';
import { strategy as galleryStrategy } from './gallery.strategy.mjs';
import { strategy as definitionStrategy } from './definition.strategy.mjs';
import { strategy as customerFaqStrategy } from './customer-faq.strategy.mjs';
import { strategy as comparisonStrategy } from './comparison.strategy.mjs';

const REQUIRED_FIELDS = ['strategyApiVersion', 'intentName', 'strategyVersion'];
const REQUIRED_METHODS = ['canHandle', 'execute'];
const SUPPORTED_API_VERSIONS = new Set(['1']);

function validate(strategy) {
  if (!strategy || typeof strategy !== 'object') {
    throw new Error('Strategy must be an object');
  }
  for (const f of REQUIRED_FIELDS) {
    if (typeof strategy[f] !== 'string' || !strategy[f]) {
      throw new Error(`Strategy is missing required field: ${f}`);
    }
  }
  for (const m of REQUIRED_METHODS) {
    if (typeof strategy[m] !== 'function') {
      throw new Error(`Strategy is missing required method: ${m}`);
    }
  }
  if (!SUPPORTED_API_VERSIONS.has(strategy.strategyApiVersion)) {
    throw new Error(
      `Strategy declares Strategy API v${strategy.strategyApiVersion} but registry supports only v${[...SUPPORTED_API_VERSIONS].join(', v')}`
    );
  }
}

export class StrategyRegistry {
  constructor() {
    this.strategies = [];
    this.unknown = null;
  }

  register(strategy) {
    validate(strategy);
    if (this.strategies.some((s) => s.intentName === strategy.intentName)) {
      throw new Error(
        `Duplicate intentName: "${strategy.intentName}" already registered · registry enforces uniqueness`
      );
    }
    this.strategies.push(strategy);
    if (strategy.intentName === 'unknown') {
      this.unknown = strategy;
    }
  }

  findFor(routerDecision) {
    if (!this.unknown) {
      throw new Error(
        'Registry has no unknown strategy registered · unknown is the guaranteed fallback and must be present'
      );
    }
    const candidates = this.strategies.filter(
      (s) => s.intentName !== 'unknown' && safeCanHandle(s, routerDecision)
    );
    if (candidates.length === 0) return this.unknown;
    if (candidates.length === 1) return candidates[0];
    const names = candidates.map((c) => c.intentName).join(', ');
    throw new Error(
      `ConfigurationError: multiple strategies matched the same request [${names}] · registry enforces exactly-one selection`
    );
  }

  list() {
    return this.strategies.map((s) => ({
      intentName: s.intentName,
      strategyVersion: s.strategyVersion,
      strategyApiVersion: s.strategyApiVersion,
    }));
  }
}

function safeCanHandle(strategy, routerDecision) {
  try {
    return Boolean(strategy.canHandle(routerDecision));
  } catch {
    return false;
  }
}

// ---------- Default registry (module-level) ----------

export function createDefaultRegistry() {
  const registry = new StrategyRegistry();
  registry.register(unknownStrategy);
  registry.register(galleryStrategy);
  registry.register(definitionStrategy);
  registry.register(customerFaqStrategy);
  registry.register(comparisonStrategy);
  return registry;
}

// ---------- Phase 7 · Registry Acceptance Tests ----------

function makeStub(overrides = {}) {
  return {
    strategyApiVersion: '1',
    intentName: 'stub',
    strategyVersion: '1.0',
    canHandle: () => true,
    execute: () => ({
      status: 'ok',
      answer_type: 'stub',
      sections: [],
      images: [],
      follow_up_questions: [],
      citations: [],
      confidence: 'medium',
      quality_flags: [],
      provenance: {},
    }),
    ...overrides,
  };
}

function runAcceptanceTests() {
  const checks = [];

  // AC1 · Registry rejects malformed strategies
  const badCases = [
    { label: 'null', input: null },
    { label: 'missing strategyApiVersion', input: makeStub({ strategyApiVersion: undefined }) },
    { label: 'missing intentName', input: makeStub({ intentName: undefined }) },
    { label: 'missing strategyVersion', input: makeStub({ strategyVersion: undefined }) },
    { label: 'missing canHandle', input: makeStub({ canHandle: undefined }) },
    { label: 'missing execute', input: makeStub({ execute: undefined }) },
    { label: 'unsupported API version', input: makeStub({ strategyApiVersion: '99' }) },
  ];
  for (const c of badCases) {
    const r = new StrategyRegistry();
    let threw = false;
    try { r.register(c.input); } catch { threw = true; }
    checks.push({ name: `AC1 · Rejects: ${c.label}`, pass: threw });
  }

  // AC2 · Registry enforces intentName uniqueness
  {
    const r = new StrategyRegistry();
    r.register(unknownStrategy);
    let threw = false;
    try { r.register(makeStub({ intentName: 'unknown' })); } catch { threw = true; }
    checks.push({ name: 'AC2 · Rejects duplicate intentName', pass: threw });
  }

  // AC3 · findFor without unknown throws
  {
    const r = new StrategyRegistry();
    let threw = false;
    try { r.findFor({ intent: 'Learn' }); } catch { threw = true; }
    checks.push({ name: 'AC3 · findFor without unknown registered throws', pass: threw });
  }

  // AC4 · Zero matches returns unknown
  {
    const r = createDefaultRegistry();
    const selected = r.findFor({ intent: 'Learn', subject: 'x' });
    checks.push({ name: 'AC4 · Zero matches returns unknown', pass: selected.intentName === 'unknown' });
  }

  // AC5 · Exactly one match returns that strategy
  {
    const r = createDefaultRegistry();
    r.register(makeStub({ intentName: 'quote', canHandle: (rd) => rd?.intent === 'Quote' }));
    const selected = r.findFor({ intent: 'Quote' });
    checks.push({ name: 'AC5 · Exactly-one match returns matching strategy', pass: selected.intentName === 'quote' });
  }

  // AC6 · Multiple matches throws ConfigurationError · use fresh registry
  // to avoid clashing with any strategies already registered by default.
  {
    const r = new StrategyRegistry();
    r.register(unknownStrategy);
    r.register(makeStub({ intentName: 'stubOne', canHandle: () => true }));
    r.register(makeStub({ intentName: 'stubTwo', canHandle: () => true }));
    let err = null;
    try { r.findFor({ intent: 'Anything' }); } catch (e) { err = e; }
    checks.push({
      name: 'AC6a · Multiple matches throws',
      pass: err !== null,
    });
    checks.push({
      name: 'AC6b · Error message names the conflicting strategies',
      pass: err?.message?.includes('stubOne') && err?.message?.includes('stubTwo'),
    });
    checks.push({
      name: 'AC6c · Error message uses ConfigurationError label',
      pass: err?.message?.includes('ConfigurationError'),
    });
  }

  // AC7 · Strategy whose canHandle throws is treated as no-match
  {
    const r = createDefaultRegistry();
    r.register(makeStub({ intentName: 'brokenStrategy', canHandle: () => { throw new Error('sim'); } }));
    const selected = r.findFor({ intent: 'Learn' });
    checks.push({ name: 'AC7 · Throwing canHandle treated as no-match, unknown returned', pass: selected.intentName === 'unknown' });
  }

  // AC8 · unknown strategy is registered by default
  {
    const r = createDefaultRegistry();
    const list = r.list();
    checks.push({ name: 'AC8 · Default registry contains unknown strategy', pass: list.some((s) => s.intentName === 'unknown') });
  }

  // AC9 · unknown.canHandle returns false (fallback discipline)
  {
    checks.push({
      name: 'AC9 · unknown.canHandle returns false (never a candidate)',
      pass: unknownStrategy.canHandle({ intent: 'Learn' }) === false,
    });
  }

  return { name: 'Phase 7 · Strategy Registry Acceptance', checks };
}

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
  console.log('NEX Composer · Strategy Registry · v1 · Phase 7');
  console.log('');
  const suite = runAcceptanceTests();
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Registry Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));
  if (r.passed !== r.total) { console.log('Registry · FAILED'); process.exit(1); }
  console.log('Registry · PASSED · deterministic selection, uniqueness, API v1 discipline enforced');
}

import { pathToFileURL } from 'node:url';
const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
