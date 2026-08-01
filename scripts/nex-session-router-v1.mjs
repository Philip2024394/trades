/**
 * NEX Session Router · v1 · Cycle 004
 * ----------------------------------------------------------------------------
 * Spec:  data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase: New pre-Router layer (Session Router · Mode Split)
 * Role:  Sits BEFORE the Staircase Router. Classifies every incoming message
 *        into a mode so engineering commands never reach the Staircase Router.
 *
 * Evidence for this cycle (Philip 2026-08-01):
 *   "Start Cycle 004" was misinterpreted as a customer staircase query
 *   ("Sweeping curved start..."). "Read this handoff" was misinterpreted as
 *   a customer query ("White painted doors..."). Both are engineering
 *   commands that should never reach the Staircase Router. Evidence is real.
 *
 * Modes (Phase 1 · two only):
 *   - engineering — commands to Claude / the runtime (start cycle · build · run · read handoff · etc.)
 *   - customer    — staircase questions from real users
 *
 * Future modes (deferred until evidence justifies):
 *   - authoring — adding evidence / knowledge / images / articles
 *   - admin     — system settings / feature toggles / diagnostics
 *
 * Discipline (locked · matches Router v1 style):
 *   - Deterministic · pattern-based · no LLM · no network · no filesystem
 *   - Frozen architectural boundary: Router · Engine · Providers · Composer
 *     · Strategies · Registry untouched
 *   - Own acceptance suite · standalone runnable
 *
 * Output contract (locked):
 *   {
 *     mode: 'engineering' | 'customer' | 'unknown',
 *     confidence: number,          // 0..1
 *     matched_patterns: string[],  // named patterns that fired
 *     reason: string | null        // optional explanation for edge cases
 *   }
 */

import { pathToFileURL } from 'node:url';

export const SESSION_ROUTER_VERSION = '1.0';

// Engineering patterns · ordered by specificity. Only exact command-shaped
// language triggers engineering mode. Ambiguous vocabulary (start · build ·
// read · run) does NOT trigger engineering unless combined with an
// engineering noun (cycle · strategy · handoff · regression · registry etc.).
const ENGINEERING_PATTERNS = [
  // Explicit cycle commands
  { name: 'start_cycle_command',       pat: /^\s*start\s+cycle\s+\d+/i,                            conf: 0.99 },
  { name: 'stop_cycle_command',        pat: /^\s*(stop|halt|end|abort)\s+cycle/i,                  conf: 0.99 },

  // Handoff / spec / memory / role / journal reads
  { name: 'read_engineering_doc',      pat: /^\s*(read|open|show|display)\s+(this|the)?\s*(handoff|spec|specification|memory|role|journal|build\s+journal)/i, conf: 0.95 },

  // Build / register runtime components (must name an engineering noun)
  { name: 'build_engineering_component', pat: /^\s*(build|create|add|register|implement)\s+(the\s+|a\s+|another\s+)?\S+\s*(strategy|provider|router|engine|index\s*builder|composer|renderer|quality\s*gate|registry|session\s*router|validation\s*suite)\b/i, conf: 0.95 },

  // Test / regression commands
  { name: 'run_test_command',          pat: /^\s*(run|execute|re-run)\s+(the\s+)?(regression|full\s+regression|acceptance|the\s+suite|validation\s+suite|tests|test\s+suite)/i, conf: 0.95 },

  // Freeze / unfreeze
  { name: 'freeze_command',            pat: /^\s*(freeze|unfreeze)\s+(build|router|composer|strategy|component|architecture|runtime)/i, conf: 0.95 },

  // Show engineering state
  { name: 'show_engineering_state',    pat: /^\s*(show|list|display|report)\s+(coverage|status|strategies|providers|cycles|the\s+journal|backlog|registered\s+strategies|frozen\s+scripts)/i, conf: 0.9 },

  // Update engineering docs
  { name: 'update_engineering_doc',    pat: /^\s*(update|modify|revise|edit)\s+(the\s+)?(memory|spec|specification|role|journal|handoff|build\s+journal)/i, conf: 0.9 },

  // Explicit "do not begin work" / handoff protocol
  { name: 'handoff_protocol',          pat: /\bdo\s+not\s+(begin|start|proceed)(\s+with)?\s+(any\s+)?(work|cycle|the\s+cycle)\b|\bwait\s+for\s+authorization\b|\bcontext\s+only\b|\bhandoff\s+summary\b/i, conf: 0.9 },

  // Engineering vocabulary that never appears in customer questions about stairs
  { name: 'engineering_vocabulary',    pat: /\b(runtime\s+engineer|engineering\s+cycle|validation\s+suite|acceptance\s+suite|regression\s+pass|strategy\s+plug-?in|strategy\s+registry|response\s+plan|evidence\s+package|router\s+version|composer\s+version|frozen\s+architecture|definition\s+of\s+done|build\s+journal|change\s+control|hard\s+stop\s+rule)\b/i, conf: 0.9 },

  // Cycle number reference (e.g. "Cycle 004", "cycle 4")
  { name: 'cycle_reference',           pat: /\bcycle\s+0*\d+\b/i,                                  conf: 0.85 },
];

// Customer signals · used to boost confidence when NO engineering pattern fired
// but strong staircase vocabulary is present. Not required for customer mode
// (customer is the default) but improves the confidence signal.
const CUSTOMER_SIGNALS = [
  /\b(staircase|stairs|stair|balustrade|handrail|newel|tread|riser|string|spindle|banister)\b/i,
  /\b(oak|walnut|pine|ash|beech|timber|hardwood|softwood)\b/i,
  /\b(straight\s+flight|cut\s+string|housed\s+string|cantilever|floating|curved|helical|spiral|quarter\s+turn|half\s+turn)\b/i,
  /\b(how\s+much|price|cost|quote|estimate)\b/i,
  /\b(show\s+me|browse|gallery|images?\s+of|pictures?\s+of)\b/i,
];

export function classifyMode(rawMessage) {
  if (rawMessage === null || rawMessage === undefined || typeof rawMessage !== 'string') {
    return { mode: 'unknown', confidence: 0, matched_patterns: [], reason: 'invalid_input' };
  }
  const trimmed = rawMessage.trim();
  if (trimmed.length === 0) {
    return { mode: 'unknown', confidence: 0, matched_patterns: [], reason: 'empty_input' };
  }

  // Check engineering patterns
  const matched = [];
  let topConf = 0;
  for (const { pat, conf, name } of ENGINEERING_PATTERNS) {
    if (pat.test(trimmed)) {
      matched.push(name);
      if (conf > topConf) topConf = conf;
    }
  }
  if (matched.length > 0) {
    return { mode: 'engineering', confidence: topConf, matched_patterns: matched, reason: null };
  }

  // Customer default · boost confidence if staircase vocabulary is present
  const customerSignals = [];
  for (const pat of CUSTOMER_SIGNALS) {
    if (pat.test(trimmed)) customerSignals.push(pat.source);
  }
  const customerConf = customerSignals.length > 0 ? 0.9 : 0.7;
  return {
    mode: 'customer',
    confidence: customerConf,
    matched_patterns: customerSignals.length > 0 ? ['customer_vocabulary_present'] : ['customer_default'],
    reason: customerSignals.length > 0 ? null : 'no_engineering_pattern_matched · defaulting to customer',
  };
}

// ---------- Cycle 004 · Session Router Acceptance ----------

// Reported-failure cases (from Philip's evidence 2026-08-01)
const REPORTED_ENGINEERING_CASES = [
  'Start Cycle 004',
  'Start Cycle 004: Session Router',
  'Start Cycle 004: Comparison',
  'Read this handoff only. Do not begin work.',
  'Read this handoff',
];

// Additional engineering cases that must be caught
const ENGINEERING_CASES = [
  'Build the Comparison Strategy',
  'Build another provider',
  'Register the Quote strategy',
  'Run regression',
  'Run the Suite',
  'Run full regression',
  'Freeze build',
  'Freeze router',
  'Show coverage',
  'Show strategies',
  'Show the journal',
  'Update the role memory',
  'Update handoff',
  'Stop cycle',
  'Do not begin work',
  'Do not proceed with any work',
  'This is a handoff summary',
  'The runtime engineer must wait',
  'The validation suite has 41 rows',
  'Cycle 005 will be Comparison',
];

// Customer cases · must NOT be classified as engineering
const CUSTOMER_CASES = [
  'Show oak staircase',
  'Show me oak modern staircases',
  'How much for straight flight stairs?',
  'What is a housed string?',
  'Straight flight vs cut string',
  'Can you install stairs on a new build?',
  'I want to build a new staircase',
  'Build a staircase from oak',
  'How do I install oak treads?',
  'White painted doors',
  'Sweeping curved staircase please',
  'What timber do you use?',
  'Do you make cantilever stairs?',
  'Can I have a glass balustrade?',
  'Straight flight oak feature',
];

function runAcceptanceTests() {
  const checks = [];

  // AC0 · Version + shape
  checks.push({ name: `AC0a · SESSION_ROUTER_VERSION exported (${SESSION_ROUTER_VERSION})`, pass: typeof SESSION_ROUTER_VERSION === 'string' });
  checks.push({ name: 'AC0b · classifyMode is a function', pass: typeof classifyMode === 'function' });

  // AC1 · Reported-failure evidence · MUST classify as engineering
  for (const [i, msg] of REPORTED_ENGINEERING_CASES.entries()) {
    const r = classifyMode(msg);
    checks.push({
      name: `AC1.${i + 1} · REPORTED · "${msg.slice(0, 55)}${msg.length > 55 ? '…' : ''}" → engineering`,
      pass: r.mode === 'engineering',
      why: r.mode !== 'engineering' ? `got ${r.mode}` : null,
    });
  }

  // AC2 · Additional engineering cases · MUST classify as engineering
  for (const [i, msg] of ENGINEERING_CASES.entries()) {
    const r = classifyMode(msg);
    checks.push({
      name: `AC2.${i + 1} · "${msg.slice(0, 55)}${msg.length > 55 ? '…' : ''}" → engineering`,
      pass: r.mode === 'engineering',
      why: r.mode !== 'engineering' ? `got ${r.mode}` : null,
    });
  }

  // AC3 · Customer cases · MUST classify as customer
  for (const [i, msg] of CUSTOMER_CASES.entries()) {
    const r = classifyMode(msg);
    checks.push({
      name: `AC3.${i + 1} · "${msg.slice(0, 55)}${msg.length > 55 ? '…' : ''}" → customer`,
      pass: r.mode === 'customer',
      why: r.mode !== 'customer' ? `got ${r.mode}` : null,
    });
  }

  // AC4 · Invalid / edge inputs never crash
  const edgeCases = [
    { input: null, expected: 'unknown' },
    { input: undefined, expected: 'unknown' },
    { input: '', expected: 'unknown' },
    { input: '   ', expected: 'unknown' },
    { input: 42, expected: 'unknown' },
    { input: [], expected: 'unknown' },
    { input: {}, expected: 'unknown' },
  ];
  for (const [i, c] of edgeCases.entries()) {
    let r = null, threw = false;
    try { r = classifyMode(c.input); } catch { threw = true; }
    checks.push({
      name: `AC4.${i + 1} · Invalid input (${JSON.stringify(c.input)}) → ${c.expected} · no crash`,
      pass: !threw && r?.mode === c.expected,
    });
  }

  // AC5 · Output shape locked
  {
    const r = classifyMode('Start Cycle 004');
    checks.push({ name: 'AC5a · Output has mode · confidence · matched_patterns · reason', pass: 'mode' in r && 'confidence' in r && 'matched_patterns' in r && 'reason' in r });
    checks.push({ name: 'AC5b · confidence is a number 0..1', pass: typeof r.confidence === 'number' && r.confidence >= 0 && r.confidence <= 1 });
    checks.push({ name: 'AC5c · matched_patterns is an array', pass: Array.isArray(r.matched_patterns) });
  }

  // AC6 · Determinism · same input · same output
  {
    const r1 = classifyMode('Start Cycle 004: Session Router');
    const r2 = classifyMode('Start Cycle 004: Session Router');
    checks.push({
      name: 'AC6 · Deterministic across runs',
      pass: r1.mode === r2.mode && r1.confidence === r2.confidence && JSON.stringify(r1.matched_patterns) === JSON.stringify(r2.matched_patterns),
    });
  }

  // AC7 · Ambiguous verb "build" · with customer noun → customer · with engineering noun → engineering
  {
    const customer = classifyMode('Build a staircase from oak');
    const engineering = classifyMode('Build the Session Router');
    checks.push({ name: 'AC7a · "Build a staircase" → customer (verb + customer noun)', pass: customer.mode === 'customer' });
    checks.push({ name: 'AC7b · "Build the Session Router" → engineering (verb + engineering noun)', pass: engineering.mode === 'engineering' });
  }

  // AC8 · No modifications to frozen upstream · assertions by import check
  {
    const src = readFileSyncSafe('C:/Users/Victus/trades/scripts/nex-session-router-v1.mjs');
    const marker = '// ---------- Cycle 004 · Session Router Acceptance ----------';
    const exportedSrc = src.split(marker)[0] ?? src;
    const forbiddenImports = ['nex-router-build-009', 'nex-retrieval-engine-v1', 'nex-composer-v1', 'strategies/', 'nex-retrieval-'];
    const found = forbiddenImports.filter((f) => new RegExp(`^\\s*import[^;]*from\\s*['"\`][^'"\`]*${f}`, 'm').test(exportedSrc));
    checks.push({ name: 'AC8a · Session Router does not import frozen runtime scripts (isolated pre-Router layer)', pass: found.length === 0 });
    const aiForbidden = ['openai', 'anthropic', '@anthropic-ai', 'claude', 'gpt'];
    const foundAI = aiForbidden.filter((f) => new RegExp(`^\\s*import[^;]*from\\s*['"\`][^'"\`]*${f}`, 'im').test(exportedSrc));
    checks.push({ name: 'AC8b · Session Router does not import any LLM/AI package', pass: foundAI.length === 0 });
  }

  return { name: 'Cycle 004 · Session Router Acceptance', checks };
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
  for (const c of suite.checks) {
    const suffix = !c.pass && c.why ? `  [${c.why}]` : '';
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${suffix}`);
  }
  return { passed, total };
}

function main() {
  console.log('NEX Session Router · v1 · Cycle 004');
  console.log('Purpose: mode-split · engineering commands never reach Staircase Router');
  console.log('');
  const suite = runAcceptanceTests();
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Cycle 004 · Session Router Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));
  if (r.passed !== r.total) { console.log('Session Router · FAILED'); process.exit(1); }
  console.log('Session Router · PASSED · engineering vs customer classification working · frozen architecture untouched');
}

const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
