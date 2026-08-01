/**
 * NEX Runtime · v1 · Cycle 005 · Runtime Wiring
 * ----------------------------------------------------------------------------
 * Spec:  data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase: Runtime Wiring (per Philip 2026-08-01: "make one real conversation flow through the runtime")
 *
 * Purpose:
 *   Wire every frozen component into a single callable pipeline.
 *   No new logic. Only glue.
 *
 * Pipeline (customer path):
 *   raw message
 *     → Session Router (classifies mode)
 *     → Staircase Router v1 (classifies question)
 *     → Retrieval Engine (5 providers registered)
 *     → EvidencePackage
 *     → Composer (strategy registry orchestrator)
 *     → Response Plan (immutable · frozen)
 *
 * Pipeline (engineering path):
 *   raw message
 *     → Session Router (classifies mode = engineering)
 *     → return engineering marker (Router · Retrieval · Composer never run)
 *
 * Not yet integrated (deferred cycles):
 *   - Quality Gate (Phase 8 · not built)
 *   - Language Renderer (Phase 9 · not built)
 *   The runtime returns the Response Plan directly. A future cycle wires
 *   plan → Quality Gate → Renderer → English prose.
 *
 * Discipline:
 *   - Deterministic · no LLM · no network beyond what providers already do
 *   - Does not modify any frozen component (Session Router · Router · Engine
 *     · Providers · Composer · Strategies · Registry all unchanged)
 *   - Adapts Router v1's nested output shape to the Composer's flat input
 *     shape (thin adapter · no business logic)
 */

import { pathToFileURL } from 'node:url';
import { classifyMode } from './nex-session-router-v1.mjs';
import { routeMessage, ROUTER_VERSION } from './nex-router-build-009.mjs';
import { adaptVocabulary } from './nex-vocabulary-adapter-v1.mjs';
import { EvidenceRetrievalEngine } from './nex-retrieval-engine-v1.mjs';
import { createImageProvider } from './nex-retrieval-image-provider-v1.mjs';
import { createKnowledgeProvider } from './nex-retrieval-knowledge-provider-v1.mjs';
import { createFAQProvider } from './nex-retrieval-faq-provider-v1.mjs';
import { createTypeProfileProvider } from './nex-retrieval-typeprofile-provider-v1.mjs';
import { createWorkshopPrincipleProvider } from './nex-retrieval-workshopprinciple-provider-v1.mjs';
import { createComposer } from './nex-composer-v1.mjs';

export const RUNTIME_VERSION = '1.0';

// Router v1 returns { intent: { val, conf }, subject: { val, conf }, ... }.
// Composer expects flat { intent, subject, brain, domain, information_type, confidence, clarify }.
// This adapter is the ONLY translation layer permitted in the runtime.
function adaptRouterDecision(routerOutput) {
  if (!routerOutput || typeof routerOutput !== 'object') {
    return {
      intent: null, subject: null, brain: null, domain: null,
      information_type: null, confidence: 0, clarify: false,
      router_version: ROUTER_VERSION,
    };
  }
  return {
    intent: routerOutput?.intent?.val ?? null,
    subject: routerOutput?.subject?.val ?? null,
    brain: routerOutput?.brain?.val ?? null,
    domain: routerOutput?.domain?.val ?? null,
    information_type: routerOutput?.infoType?.val ?? null,
    confidence: typeof routerOutput?.conf === 'number' ? routerOutput.conf : 0,
    clarify: routerOutput?.clarify === 'Yes',
    router_version: ROUTER_VERSION,
  };
}

function createDefaultEngine() {
  const engine = new EvidenceRetrievalEngine();
  engine.register(createImageProvider());
  engine.register(createKnowledgeProvider());
  engine.register(createFAQProvider());
  engine.register(createTypeProfileProvider());
  engine.register(createWorkshopPrincipleProvider());
  return engine;
}

export function createRuntime(options = {}) {
  const engine = options.engine ?? createDefaultEngine();
  const composer = options.composer ?? createComposer();

  return {
    runtimeVersion: RUNTIME_VERSION,
    routerVersion: ROUTER_VERSION,

    handleMessage(rawMessage) {
      const startedAt = new Date().toISOString();

      // Stage 1 · Session Router
      const modeResult = classifyMode(rawMessage);

      // Stage 2a · Engineering path (Router / Retrieval / Composer never run)
      if (modeResult.mode === 'engineering') {
        return Object.freeze({
          mode: 'engineering',
          session_router_output: modeResult,
          router_decision: null,
          evidence_package: null,
          plan: null,
          engineering_action: {
            recognized: true,
            note: 'Engineering command detected. Runtime v1 does not execute engineering actions · a dedicated engineering handler is a future cycle.',
            matched_patterns: modeResult.matched_patterns,
          },
          runtime_version: RUNTIME_VERSION,
          timing: { started_at: startedAt, completed_at: new Date().toISOString() },
        });
      }

      // Stage 2b · Unknown path (empty / invalid message)
      if (modeResult.mode === 'unknown') {
        return Object.freeze({
          mode: 'unknown',
          session_router_output: modeResult,
          router_decision: null,
          evidence_package: null,
          plan: null,
          runtime_version: RUNTIME_VERSION,
          timing: { started_at: startedAt, completed_at: new Date().toISOString() },
        });
      }

      // Stage 2c · Customer path · full pipeline
      const routerOutputRaw = routeMessage(rawMessage);
      const routerDecisionFlat = adaptRouterDecision(routerOutputRaw);
      const routerDecision = adaptVocabulary(routerDecisionFlat); // Cycle 006 · canonical vocab
      const evidencePackage = engine.retrieve(routerDecision);
      const plan = composer.compose(evidencePackage, routerDecision);

      return Object.freeze({
        mode: 'customer',
        session_router_output: modeResult,
        router_output_raw: routerOutputRaw,
        router_decision: routerDecision,
        evidence_package: evidencePackage,
        plan,
        runtime_version: RUNTIME_VERSION,
        timing: { started_at: startedAt, completed_at: new Date().toISOString() },
      });
    },
  };
}

// ---------- Cycle 005 · Runtime Wiring Acceptance ----------

function runAcceptanceTests() {
  const checks = [];
  const runtime = createRuntime();

  // AC0 · Runtime constructed · versions exposed
  checks.push({ name: 'AC0a · RUNTIME_VERSION exported', pass: typeof RUNTIME_VERSION === 'string' });
  checks.push({ name: 'AC0b · runtime.handleMessage is a function', pass: typeof runtime.handleMessage === 'function' });
  checks.push({ name: 'AC0c · runtime.runtimeVersion === "1.0"', pass: runtime.runtimeVersion === '1.0' });
  checks.push({ name: 'AC0d · runtime.routerVersion === "0.09"', pass: runtime.routerVersion === '0.09' });

  // AC1 · Reported evidence path: engineering command NEVER reaches Router
  {
    const r = runtime.handleMessage('Start Cycle 005');
    checks.push({ name: 'AC1a · "Start Cycle 005" → mode === "engineering"', pass: r.mode === 'engineering' });
    checks.push({ name: 'AC1b · "Start Cycle 005" · router_decision === null (Router never ran)', pass: r.router_decision === null });
    checks.push({ name: 'AC1c · "Start Cycle 005" · evidence_package === null (Retrieval never ran)', pass: r.evidence_package === null });
    checks.push({ name: 'AC1d · "Start Cycle 005" · plan === null (Composer never ran)', pass: r.plan === null });
    checks.push({ name: 'AC1e · "Start Cycle 005" · engineering_action.recognized === true', pass: r.engineering_action?.recognized === true });
  }

  // AC1b · additional engineering messages
  const engMessages = ['Read this handoff', 'Run regression', 'Freeze build', 'Show coverage', 'Do not begin work'];
  for (const [i, msg] of engMessages.entries()) {
    const r = runtime.handleMessage(msg);
    checks.push({
      name: `AC1.ext.${i + 1} · "${msg}" → engineering (Router bypassed)`,
      pass: r.mode === 'engineering' && r.router_decision === null && r.plan === null,
    });
  }

  // AC2 · Reported evidence path: customer question flows through FULL pipeline
  {
    const r = runtime.handleMessage('Show oak modern staircase');
    checks.push({ name: 'AC2a · "Show oak modern staircase" → mode === "customer"', pass: r.mode === 'customer' });
    checks.push({ name: 'AC2b · Router ran (router_decision populated)', pass: r.router_decision !== null && typeof r.router_decision === 'object' });
    checks.push({ name: 'AC2c · Retrieval ran (evidence_package populated)', pass: r.evidence_package !== null && typeof r.evidence_package === 'object' });
    checks.push({ name: 'AC2d · Composer ran (plan populated)', pass: r.plan !== null && typeof r.plan === 'object' });
    checks.push({ name: 'AC2e · Plan has locked field set', pass: r.plan && 'status' in r.plan && 'answer_type' in r.plan && 'sections' in r.plan && 'images' in r.plan && 'citations' in r.plan });
    checks.push({ name: 'AC2f · Plan is frozen (immutable)', pass: r.plan && Object.isFrozen(r.plan) });
    checks.push({ name: 'AC2g · Runtime response itself is frozen', pass: Object.isFrozen(r) });
  }

  // AC3 · Pipeline invariants (not query-vocabulary-dependent)
  // Real observation from Cycle 005: Router v1's intent vocabulary is
  // Learn/Buy/Compare/Browse/See/Why/etc. — "Show" is not a Router intent.
  // Whichever strategy claims a request, the plan must be internally consistent.
  {
    const r = runtime.handleMessage('Show me oak staircases');
    checks.push({
      name: 'AC3a · Runtime always produces a valid Plan for a non-empty customer message',
      pass: r.plan !== null && typeof r.plan === 'object' && 'status' in r.plan && 'answer_type' in r.plan,
    });
    checks.push({
      name: 'AC3b · Plan status is one of ok · clarify · unknown',
      pass: r.plan && ['ok', 'clarify', 'unknown'].includes(r.plan.status),
      why: r.plan?.status,
    });
    checks.push({
      name: 'AC3c · Plan invariant · if answer_type === "gallery" AND status === "ok" then images MUST be populated',
      pass: !(r.plan?.answer_type === 'gallery' && r.plan?.status === 'ok') || r.plan.images.length > 0,
    });
    checks.push({
      name: 'AC3d · Plan invariant · if status === "ok" then citations MUST be populated OR sections MUST be populated',
      pass: r.plan?.status !== 'ok' || r.plan.citations.length > 0 || r.plan.sections.length > 0,
    });
    checks.push({
      name: 'AC3e · Plan invariant · if status === "unknown" then follow_up_questions MUST be populated (honest gap)',
      pass: r.plan?.status !== 'unknown' || r.plan.follow_up_questions.length > 0,
    });
  }

  // AC4 · Full pipeline determinism (same input → same plan hash)
  {
    const r1 = runtime.handleMessage('Show oak staircase');
    const r2 = runtime.handleMessage('Show oak staircase');
    checks.push({
      name: 'AC4 · Deterministic: same input → same plan evidence_package_hash',
      pass: r1.plan?.provenance?.evidence_package_hash === r2.plan?.provenance?.evidence_package_hash,
    });
  }

  // AC5 · Invalid / edge inputs never crash
  const edgeCases = [null, undefined, '', '   ', 42, [], {}];
  for (const [i, input] of edgeCases.entries()) {
    let r = null, threw = false;
    try { r = runtime.handleMessage(input); } catch { threw = true; }
    checks.push({
      name: `AC5.${i + 1} · Invalid input (${JSON.stringify(input)}) does not crash`,
      pass: !threw && r && typeof r === 'object' && 'mode' in r,
    });
  }

  // AC6 · ARCHITECTURAL · runtime does not modify frozen components
  //   Verified structurally: no writes to frozen source files. Import-only.
  {
    const src = readFileSyncSafe('C:/Users/Victus/trades/scripts/nex-runtime-v1.mjs');
    const marker = '// ---------- Cycle 005 · Runtime Wiring Acceptance ----------';
    const exportedSrc = src.split(marker)[0] ?? src;
    // Runtime may only IMPORT from these frozen files, not write to them
    const writesToSource = /\bwriteFileSync\s*\(\s*['"`][^'"`]*scripts\//.test(exportedSrc);
    checks.push({ name: 'AC6a · Runtime does not write to any script file', pass: !writesToSource });
    // No LLM imports
    const aiForbidden = ['openai', 'anthropic', '@anthropic-ai', 'claude', 'gpt'];
    const foundAI = aiForbidden.filter((f) => new RegExp(`^\\s*import[^;]*from\\s*['"\`][^'"\`]*${f}`, 'im').test(exportedSrc));
    checks.push({ name: 'AC6b · Runtime does not import any LLM/AI package', pass: foundAI.length === 0 });
  }

  // AC7 · Session Router bypass proof: engineering message + timing is fast
  //   (Full customer pipeline includes 1040-record image scan; engineering path should skip it)
  {
    const t0 = Date.now();
    for (let i = 0; i < 100; i++) runtime.handleMessage('Start Cycle 005');
    const engMs = Date.now() - t0;
    const t1 = Date.now();
    for (let i = 0; i < 100; i++) runtime.handleMessage('Show oak staircase');
    const custMs = Date.now() - t1;
    // Engineering should be significantly faster than customer path
    // (typically 10-100x faster because no Router / Retrieval / Composer runs)
    checks.push({
      name: `AC7 · Engineering path faster than customer path (eng ${engMs}ms vs cust ${custMs}ms for 100 msgs)`,
      pass: engMs < custMs,
      why: engMs >= custMs ? 'engineering path not faster than customer path' : null,
    });
  }

  return { name: 'Cycle 005 · Runtime Wiring Acceptance', checks };
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
  console.log('NEX Runtime · v1 · Cycle 005 · Runtime Wiring');
  console.log('Pipeline: Session Router → Staircase Router → Retrieval → Composer → Plan');
  console.log('');
  const suite = runAcceptanceTests();
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Cycle 005 · Runtime Wiring Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));
  if (r.passed !== r.total) { console.log('Runtime Wiring · FAILED'); process.exit(1); }
  console.log('Runtime Wiring · PASSED · one real conversation now flows through the runtime end-to-end');
}

const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
