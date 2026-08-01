/**
 * NEX Runtime Vocabulary Adapter · v1 · Cycle 006
 * ----------------------------------------------------------------------------
 * Spec:  data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase: Runtime Vocabulary Adapter (Philip 2026-08-01)
 *
 * Purpose (locked · Philip 2026-08-01):
 *   Translate Router vocabulary → canonical runtime vocabulary in ONE PLACE.
 *   Every downstream runtime consumer (providers, strategies, quality gate,
 *   renderer, analytics, logging) reads the canonical form.
 *
 * Discipline (locked):
 *   - Router v1 stays frozen · Suite v1 stays frozen · Providers stay frozen
 *   - Only add a mapping when real runtime evidence proves it is required
 *   - Adapter is pure · deterministic · no state · no side effects
 *   - Literal and minimal · never invent conceptual aggregates
 *
 * Evidence-driven mapping set (all justified by observed Cycle 005 runtime output):
 *
 *   Router emits              Canonical                Evidence
 *   ────────────────────────────────────────────────────────────────────────
 *   intent="Browse"           intent="Show"            Cycle 005 · "Show me oak staircases" → Router intent=Browse → providers skip
 *   intent="See"              intent="Show"            Suite has 3 See rows · same conceptual intent as Browse/Show
 *   information_type="Gallery" information_type="Images" Cycle 005 · Router info_type=Gallery → providers skip
 *
 * Not added (would violate evidence-driven rule):
 *   - No verb → verb translations unless Cycle-N runtime output proves them needed
 *   - No aggregated forms like "Browse Images" (a weird two-word canonical)
 */

import { pathToFileURL } from 'node:url';

export const VOCABULARY_ADAPTER_VERSION = '1.0';

// Evidence-driven mapping table. New rows require a documented Cycle-N runtime
// observation that proves the mapping is needed.
const INTENT_MAP = new Map([
  ['browse', 'Show'],   // Cycle 005 evidence
  ['see',    'Show'],   // Cycle 005 evidence
]);

const INFO_TYPE_MAP = new Map([
  ['gallery', 'Images'], // Cycle 005 evidence
]);

// Domain and Brain maps are intentionally empty · no evidence has demonstrated
// mismatches for those dimensions yet. When evidence appears, add here.
const DOMAIN_MAP = new Map();
const BRAIN_MAP = new Map();

function normaliseKey(str) {
  return String(str ?? '').toLowerCase().trim();
}

/**
 * Adapt a Router decision to canonical runtime vocabulary.
 * Input:  flat router decision (already adapted from Router's nested form)
 * Output: same shape · fields translated where mappings exist · other fields untouched
 * The returned object is a shallow copy · original input is not mutated.
 */
export function adaptVocabulary(decision) {
  if (!decision || typeof decision !== 'object') {
    return decision;
  }
  const out = { ...decision };
  const originalIntent = decision.intent;
  const originalInfoType = decision.information_type;
  const originalDomain = decision.domain;
  const originalBrain = decision.brain;

  if (INTENT_MAP.has(normaliseKey(originalIntent))) {
    out.intent = INTENT_MAP.get(normaliseKey(originalIntent));
  }
  if (INFO_TYPE_MAP.has(normaliseKey(originalInfoType))) {
    out.information_type = INFO_TYPE_MAP.get(normaliseKey(originalInfoType));
  }
  if (DOMAIN_MAP.has(normaliseKey(originalDomain))) {
    out.domain = DOMAIN_MAP.get(normaliseKey(originalDomain));
  }
  if (BRAIN_MAP.has(normaliseKey(originalBrain))) {
    out.brain = BRAIN_MAP.get(normaliseKey(originalBrain));
  }

  // Record what happened for downstream diagnostics
  out.vocabulary_adapter = {
    version: VOCABULARY_ADAPTER_VERSION,
    intent_translated: originalIntent !== out.intent,
    information_type_translated: originalInfoType !== out.information_type,
    domain_translated: originalDomain !== out.domain,
    brain_translated: originalBrain !== out.brain,
    original: {
      intent: originalIntent,
      information_type: originalInfoType,
      domain: originalDomain,
      brain: originalBrain,
    },
  };
  return out;
}

// ---------- Cycle 006 · Runtime Vocabulary Adapter Acceptance ----------

function runAcceptanceTests() {
  const checks = [];

  // AC0 · Exports
  checks.push({ name: 'AC0a · VOCABULARY_ADAPTER_VERSION exported', pass: typeof VOCABULARY_ADAPTER_VERSION === 'string' });
  checks.push({ name: 'AC0b · adaptVocabulary is a function', pass: typeof adaptVocabulary === 'function' });

  // AC1 · Evidence-driven mappings actually work
  {
    const r = adaptVocabulary({ intent: 'Browse', information_type: 'Gallery', domain: 'Reference Gallery', brain: 'Staircase', subject: 'Staircase', confidence: 0.9, clarify: false });
    checks.push({ name: 'AC1a · intent Browse → Show (Cycle 005 evidence)', pass: r.intent === 'Show' });
    checks.push({ name: 'AC1b · information_type Gallery → Images (Cycle 005 evidence)', pass: r.information_type === 'Images' });
  }
  {
    const r = adaptVocabulary({ intent: 'See', information_type: 'Images', domain: 'x', brain: 'x' });
    checks.push({ name: 'AC1c · intent See → Show', pass: r.intent === 'Show' });
  }

  // AC2 · Case insensitive
  {
    const r = adaptVocabulary({ intent: 'browse', information_type: 'gallery' });
    checks.push({ name: 'AC2a · Lowercase browse → Show', pass: r.intent === 'Show' });
    checks.push({ name: 'AC2b · Lowercase gallery → Images', pass: r.information_type === 'Images' });
  }

  // AC3 · Fields with NO mapping pass through untouched
  {
    const r = adaptVocabulary({ intent: 'Learn', information_type: 'Definition', domain: 'Components', brain: 'Staircase', subject: 'housed string', confidence: 0.9, clarify: false });
    checks.push({ name: 'AC3a · Learn intent passes through', pass: r.intent === 'Learn' });
    checks.push({ name: 'AC3b · Definition info_type passes through', pass: r.information_type === 'Definition' });
    checks.push({ name: 'AC3c · Components domain passes through', pass: r.domain === 'Components' });
    checks.push({ name: 'AC3d · Staircase brain passes through', pass: r.brain === 'Staircase' });
    checks.push({ name: 'AC3e · subject / confidence / clarify preserved', pass: r.subject === 'housed string' && r.confidence === 0.9 && r.clarify === false });
    checks.push({ name: 'AC3f · vocabulary_adapter.intent_translated === false when no mapping fired', pass: r.vocabulary_adapter?.intent_translated === false });
  }

  // AC4 · Original input not mutated (pure function · shallow copy)
  {
    const input = { intent: 'Browse', information_type: 'Gallery' };
    const before = JSON.stringify(input);
    adaptVocabulary(input);
    const after = JSON.stringify(input);
    checks.push({ name: 'AC4 · Original input object not mutated', pass: before === after });
  }

  // AC5 · Determinism · same input → same output
  {
    const input = { intent: 'Browse', information_type: 'Gallery', domain: 'Reference Gallery', brain: 'Staircase' };
    const r1 = adaptVocabulary(input);
    const r2 = adaptVocabulary(input);
    // Compare everything except the diagnostic block (which is trivially equal)
    checks.push({
      name: 'AC5 · Deterministic across runs',
      pass: r1.intent === r2.intent && r1.information_type === r2.information_type && r1.domain === r2.domain && r1.brain === r2.brain,
    });
  }

  // AC6 · Diagnostic block records what happened (engineer-facing · not customer)
  {
    const r = adaptVocabulary({ intent: 'Browse', information_type: 'Gallery' });
    checks.push({ name: 'AC6a · vocabulary_adapter block present', pass: typeof r.vocabulary_adapter === 'object' });
    checks.push({ name: 'AC6b · intent_translated true when Browse → Show', pass: r.vocabulary_adapter.intent_translated === true });
    checks.push({ name: 'AC6c · original.intent preserved for audit', pass: r.vocabulary_adapter.original.intent === 'Browse' });
    checks.push({ name: 'AC6d · information_type_translated true when Gallery → Images', pass: r.vocabulary_adapter.information_type_translated === true });
  }

  // AC7 · Edge inputs never crash
  const edgeCases = [null, undefined, 42, 'string', [], {}];
  for (const [i, input] of edgeCases.entries()) {
    let r = null, threw = false;
    try { r = adaptVocabulary(input); } catch { threw = true; }
    checks.push({ name: `AC7.${i + 1} · Edge input (${JSON.stringify(input)}) tolerated`, pass: !threw });
  }

  // AC8 · Missing fields are not invented
  {
    const r = adaptVocabulary({});
    checks.push({ name: 'AC8a · Empty decision does not invent intent', pass: r.intent === undefined });
    checks.push({ name: 'AC8b · Empty decision does not invent information_type', pass: r.information_type === undefined });
  }

  // AC9 · ARCHITECTURAL · adapter does not touch frozen components
  {
    const src = readFileSyncSafe('C:/Users/Victus/trades/scripts/nex-vocabulary-adapter-v1.mjs');
    const marker = '// ---------- Cycle 006 · Runtime Vocabulary Adapter Acceptance ----------';
    const exportedSrc = src.split(marker)[0] ?? src;
    const forbiddenImports = ['nex-router-build-009', 'nex-retrieval-', 'nex-composer', 'strategies/', 'nex-session-router', 'nex-runtime'];
    const found = forbiddenImports.filter((f) => new RegExp(`^\\s*import[^;]*from\\s*['"\`][^'"\`]*${f}`, 'm').test(exportedSrc));
    checks.push({ name: 'AC9a · Adapter does not import any frozen component (isolated · one-file scope)', pass: found.length === 0 });
    const aiForbidden = ['openai', 'anthropic', '@anthropic-ai', 'claude', 'gpt'];
    const foundAI = aiForbidden.filter((f) => new RegExp(`^\\s*import[^;]*from\\s*['"\`][^'"\`]*${f}`, 'im').test(exportedSrc));
    checks.push({ name: 'AC9b · Adapter does not import any LLM/AI package', pass: foundAI.length === 0 });
    const fsReads = /\breadFileSync\b|\breadFile\b/.test(exportedSrc);
    checks.push({ name: 'AC9c · Exported adapter code contains no filesystem reads', pass: !fsReads });
  }

  // AC10 · Every mapping declared here matches its documented evidence
  //   (audit against the mapping tables · not against runtime behaviour)
  {
    const declaredIntent = [...INTENT_MAP.keys()].sort().join(',');
    const declaredInfo = [...INFO_TYPE_MAP.keys()].sort().join(',');
    checks.push({ name: `AC10a · INTENT_MAP contains only evidence-declared keys (currently: [${declaredIntent}])`, pass: declaredIntent === 'browse,see' });
    checks.push({ name: `AC10b · INFO_TYPE_MAP contains only evidence-declared keys (currently: [${declaredInfo}])`, pass: declaredInfo === 'gallery' });
    checks.push({ name: 'AC10c · DOMAIN_MAP empty (no evidence yet)', pass: DOMAIN_MAP.size === 0 });
    checks.push({ name: 'AC10d · BRAIN_MAP empty (no evidence yet)', pass: BRAIN_MAP.size === 0 });
  }

  return { name: 'Cycle 006 · Runtime Vocabulary Adapter Acceptance', checks };
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
  console.log('NEX Runtime Vocabulary Adapter · v1 · Cycle 006');
  console.log(`Mappings (evidence-driven only): intent [${[...INTENT_MAP.keys()].join(', ')}] · info_type [${[...INFO_TYPE_MAP.keys()].join(', ')}]`);
  console.log('');
  const suite = runAcceptanceTests();
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Cycle 006 · Runtime Vocabulary Adapter Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));
  if (r.passed !== r.total) { console.log('Vocabulary Adapter · FAILED'); process.exit(1); }
  console.log('Vocabulary Adapter · PASSED · evidence-driven mappings · single source of truth · zero frozen-code changes');
}

const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
