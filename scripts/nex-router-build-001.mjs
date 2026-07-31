#!/usr/bin/env node
// NEX Router Build 0.01 — first working Router implementation.
// Classifies user questions across the five dimensions (Intent · Subject · Brain · Knowledge Domain · Information Type).
// Produces Router Traces per NEX-ROUTER-TRACE-FORMAT-v1.md.
// Runs against NEX-ROUTER-VALIDATION-SUITE-v1.md starter corpus + derived entries.
// Reports pass/fail + failure codes per NEX-ROUTER-VALIDATION-SUITE-v1.md.
//
// Philip 2026-07-31 directive:
//   "A real Router Build 0.01. Even if it only passes 6/6 or 18/25 · I want to see the Router actually classify
//    questions and produce traces. That's the moment the architecture becomes software."
//
// This is a PATTERN-BASED classifier (not LLM-based).
// Aligns with the research report's Stage 2 recommendation: "Question-type patterns as an authored table (not learned)."
// A future Build 0.02 can swap in LLM-based structured output when API access is provisioned.
//
// IMPORTER DISCIPLINE (per feedback_nex_importer_discipline_2026_07_31.md):
//   - Reads Suite + derived entries · never alters them
//   - Writes report to distinct path
//   - Parse failures reported and loop continues
//   - Idempotent: same input → same output

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '..', '..');
const SUITE = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'NEX-ROUTER-VALIDATION-SUITE-v1.md');
const DERIVED = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-validation-derived-entries-2026-07-31.md');
const OUT = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-build-001-report-2026-07-31.md');

const BUILD_ID = '0.01';
const CONFIDENCE_THRESHOLD = 0.65;

// ─────────────────────────────────────────────────────────────
// Pattern-based classifiers
// ─────────────────────────────────────────────────────────────

const INTENT_PATTERNS = [
  { pat: /\bhow much\b|\bprice\b|\bpricing\b|\bcost\b|\bquote\b/i, val: 'Quote', conf: 0.95 },
  { pat: /\bshow me\b|\bimages?\b|\bphotos?\b|\bpictures?\b|\bexamples? of\b|\bgallery\b/i, val: 'Browse', conf: 0.92 },
  { pat: /\binstall\b|\binstallation\b|\bfitting\b/i, val: 'Service', conf: 0.85 },
  { pat: /\bcompare\b|\bvs\b|\bversus\b|\bdifference between\b|\bwhich is better\b/i, val: 'Compare', conf: 0.90 },
  { pat: /\bcan (?:i|my|you)\b|\bwould (?:you|it)\b|\bshould (?:i|we)\b|\bis it (?:possible|worth|advisable)\b/i, val: 'Advise', conf: 0.80 },
  { pat: /\bwhat type\b|\bwhat kind\b|\bwhat size\b|\bwhat.*(?:available|options?)\b|\bwhat is\b|\bwhat.?s\b|\bwhat are\b/i, val: 'Learn', conf: 0.88 },
  { pat: /\bexplain\b|\bhow does\b|\bhow do\b/i, val: 'Explain', conf: 0.85 },
  { pat: /\b(?:need|want|looking for|require)\b/i, val: 'Buy', conf: 0.70 },
];

const INFO_TYPE_PATTERNS = [
  { pat: /\bhow much\b|\bprice\b|\bcost\b|\bpricing\b|\bquote\b/i, val: 'Cost', conf: 0.95 },
  { pat: /\bshow me\b|\bimages?\b|\bphotos?\b|\bpictures?\b|\bgallery\b/i, val: 'Images', conf: 0.92 },
  { pat: /\bwhat size\b|\bsize\b|\bdimensions?\b|\bhow big\b|\bhow large\b|\bhow (?:wide|tall|deep|thick)\b|\bmm\b|\bwidth\b|\bheight\b/i, val: 'Dimensions', conf: 0.90 },
  { pat: /\bwhat type\b|\bwhat kind\b|\btypes? of\b|\bkinds? of\b|\bclassification\b/i, val: 'Types', conf: 0.90 },
  { pat: /\bavailable\b|\boptions?\b|\bchoices?\b|\bwhich (?:woods?|materials?|colours?|species)\b|\bwhat (?:woods?|materials?|colours?|species)\b/i, val: 'Options', conf: 0.88 },
  { pat: /\bcan (?:i|my|you)\b|\bshould (?:i|we)\b|\bbest practice\b|\brecommend\b/i, val: 'Best Practice', conf: 0.75 },
  { pat: /\bcompare\b|\bvs\b|\bversus\b|\bdifference between\b/i, val: 'Comparison', conf: 0.85 },
  { pat: /\bhow does\b|\bwhat does\b|\bhow do\b|\bfunction\b|\bpurpose\b/i, val: 'Function', conf: 0.75 },
  { pat: /\bwhat is\b|\bwhat.?s\b|\bwhat are\b|\bdefine\b|\bmeaning\b/i, val: 'Definition', conf: 0.80 },
];

// Subject extraction — ordered by specificity (most specific first)
const SUBJECT_PATTERNS = [
  { pat: /\bstraight flight\b/i, val: 'Straight flight' },
  { pat: /\bquarter[- ]turn\b/i, val: 'Quarter turn' },
  { pat: /\bhalf[- ]turn\b/i, val: 'Half turn' },
  { pat: /\bwinder\b|\bkite winder\b/i, val: 'Winder' },
  { pat: /\bspiral\b/i, val: 'Spiral' },
  { pat: /\bcurved\b/i, val: 'Curved' },
  { pat: /\bbifurcated\b|\bdouble return\b/i, val: 'Bifurcated' },
  { pat: /\bnewel post\b|\bnewel\b/i, val: 'Newel post' },
  { pat: /\bhandrail\b/i, val: 'Handrail' },
  { pat: /\bbaluster\b|\bspindle\b/i, val: 'Baluster' },
  { pat: /\btread\b/i, val: 'Tread' },
  { pat: /\briser\b/i, val: 'Riser' },
  { pat: /\bstring\b/i, val: 'String' },
  { pat: /\bglass balustrade\b|\bglass panel\b/i, val: 'Glass balustrade' },
  { pat: /\bcut string\b/i, val: 'Cut string' },
  { pat: /\bclosed string\b/i, val: 'Closed string' },
  { pat: /\boak\b/i, val: 'Oak' },
  { pat: /\bwalnut\b/i, val: 'Walnut' },
  { pat: /\bash\b/i, val: 'Ash' },
  { pat: /\btimber\b|\bwoods?\b|\bhardwoods?\b|\bsoftwoods?\b|\bspecies\b/i, val: 'Timber' },
  { pat: /\breclaimed\b/i, val: 'Reclaimed timber' },
  { pat: /\bcarpenter\b/i, val: 'Site carpenter' },
  { pat: /\bfurniture\b|\btable\b|\bhallway\b/i, val: 'Matching furniture' },
  { pat: /\bloft ladder\b|\bloft\b/i, val: 'Loft ladder' },
  { pat: /\bnew build\b/i, val: 'New build' },
  { pat: /\bstair(?:case)?s?\b/i, val: 'Staircase' },
];

// Brain assignment — checks subject + query context
function classifyBrain(subject, question) {
  if (['Timber', 'Oak', 'Walnut', 'Ash', 'Reclaimed timber'].includes(subject)) return { val: 'Materials', conf: 0.85 };
  return { val: 'Staircase', conf: 0.85 };
}

// Domain assignment — driven by Intent + Info Type + Brain
function classifyDomain(intent, infoType, brain, subject) {
  if (intent === 'Browse' && infoType === 'Images') return { val: 'Reference Gallery', conf: 0.92 };
  if (intent === 'Quote' || infoType === 'Cost') return { val: 'Pricing', conf: 0.90 };
  if (intent === 'Buy') return { val: 'Sales', conf: 0.80 };
  if (intent === 'Service') return { val: 'Installation', conf: 0.85 };
  if (intent === 'Compare') return { val: 'Design Languages', conf: 0.75 };
  if (intent === 'Advise') return { val: 'Customer FAQ', conf: 0.80 };
  if (infoType === 'Types') return { val: 'Classification', conf: 0.90 };
  if (infoType === 'Dimensions') return { val: 'Components', conf: 0.88 };
  if (infoType === 'Options' && brain === 'Materials') return { val: 'Species', conf: 0.85 };
  if (infoType === 'Options') return { val: 'Options', conf: 0.75 };
  return { val: 'Knowledge Base', conf: 0.60 };
}

function firstMatch(patterns, text) {
  for (const p of patterns) if (p.pat.test(text)) return p;
  return null;
}

// ─────────────────────────────────────────────────────────────
// Router itself
// ─────────────────────────────────────────────────────────────

function route(question) {
  const q = question.trim();
  const intentMatch = firstMatch(INTENT_PATTERNS, q);
  const infoMatch = firstMatch(INFO_TYPE_PATTERNS, q);
  const subjectMatch = firstMatch(SUBJECT_PATTERNS, q);

  const intent = intentMatch ? { val: intentMatch.val, conf: intentMatch.conf } : { val: 'Learn', conf: 0.45 };
  const infoType = infoMatch ? { val: infoMatch.val, conf: infoMatch.conf } : { val: 'Definition', conf: 0.50 };
  const subject = subjectMatch ? { val: subjectMatch.val, conf: 0.88 } : { val: 'Unknown', conf: 0.30 };

  const brain = classifyBrain(subject.val, q);
  const domain = classifyDomain(intent.val, infoType.val, brain.val, subject.val);

  // Aggregate router confidence — geometric mean of per-dimension confidence
  const conf = Math.pow(intent.conf * subject.conf * brain.conf * domain.conf * infoType.conf, 0.2);

  // Clarify decision — Low Confidence OR short Buy query
  const wordCount = q.split(/\s+/).length;
  let clarify;
  if (conf < CONFIDENCE_THRESHOLD) clarify = 'Yes';
  else if (intent.val === 'Buy' && wordCount < 4) clarify = 'Yes';
  else if (intent.val === 'Quote') clarify = 'Maybe';
  else clarify = 'No';

  return { intent, subject, brain, domain, infoType, conf, clarify };
}

// ─────────────────────────────────────────────────────────────
// Validation Suite parser
// ─────────────────────────────────────────────────────────────

function parseSuiteTable(mdPath, tableHeaderMustContain) {
  const raw = fs.readFileSync(mdPath, 'utf8');
  const lines = raw.split('\n');
  const rows = [];
  let inTable = false;
  let headerCols = [];
  for (const line of lines) {
    if (!inTable) {
      if (line.startsWith('|') && tableHeaderMustContain.every((s) => line.includes(s))) {
        inTable = true;
        headerCols = line.split('|').map((c) => c.trim()).filter(Boolean);
        continue;
      }
    } else {
      if (!line.startsWith('|')) { inTable = false; continue; }
      if (line.startsWith('|---')) continue;
      const cells = line.split('|').map((c) => c.trim());
      cells.shift();
      cells.pop();
      if (cells.length >= 7) rows.push(cells);
    }
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────
// Compare + failure codes
// ─────────────────────────────────────────────────────────────

const SYNONYMS = {
  Intent: { Learn: ['Explain'], Buy: ['Enquire', 'Purchase'], Quote: ['Pricing'], Browse: ['Show'] },
  Subject: {},
  Brain: {},
  Domain: { 'Classification': ['Types'], 'Reference Gallery': ['Images'] },
  'Information Type': { Types: ['Classification'], Options: ['Selection'], Cost: ['Price'] },
};

function matches(dim, actual, expected) {
  if (!expected || expected === '*derived*') return true;
  const a = actual.trim();
  const e = expected.trim();
  if (a.toLowerCase() === e.toLowerCase()) return true;
  const alts = (SYNONYMS[dim] && SYNONYMS[dim][a]) || [];
  if (alts.map((x) => x.toLowerCase()).includes(e.toLowerCase())) return true;
  // Allow Estimator/Staircase-style compound acceptance
  if (e.includes('/') && e.split('/').map((x) => x.trim().toLowerCase()).includes(a.toLowerCase())) return true;
  return false;
}

function compareToExpected(routed, expected) {
  // expected columns: [Question, Intent, Subject, Brain, Domain, InfoType, Clarify, ...]
  const failCodes = [];
  if (!matches('Intent', routed.intent.val, expected[1])) failCodes.push('R001');
  if (!matches('Subject', routed.subject.val, expected[2])) failCodes.push('R002');
  if (!matches('Brain', routed.brain.val, expected[3])) failCodes.push('R003');
  if (!matches('Domain', routed.domain.val, expected[4])) failCodes.push('R004');
  if (!matches('Information Type', routed.infoType.val, expected[5])) failCodes.push('R005');
  const expectedClarify = (expected[6] || '').trim();
  if (expectedClarify === 'Yes' && routed.clarify !== 'Yes') failCodes.push('R006');
  if (expectedClarify === 'No' && routed.clarify === 'Yes') failCodes.push('R006');
  // R007 and R008 not applicable in Build 0.01 (retrieval + response layer not yet implemented)
  return failCodes;
}

// ─────────────────────────────────────────────────────────────
// Trace renderer
// ─────────────────────────────────────────────────────────────

function renderTrace(question, routed, failCodes, expected) {
  const c = (n) => n.toFixed(2);
  const isLow = routed.conf < CONFIDENCE_THRESHOLD;
  const pass = failCodes.length === 0;

  let trace = `\n\`\`\`\nUSER\n${question}\n\n──────────────────────────\n\n`;
  trace += `Intent\n${pass || !failCodes.includes('R001') ? '✓' : 'Fail'} ${routed.intent.val} (${c(routed.intent.conf)})\n\n`;
  trace += `Subject\n${pass || !failCodes.includes('R002') ? '✓' : 'Fail'} ${routed.subject.val} (${c(routed.subject.conf)})\n\n`;
  trace += `Brain\n${pass || !failCodes.includes('R003') ? '✓' : 'Fail'} ${routed.brain.val} (${c(routed.brain.conf)})\n\n`;
  trace += `Knowledge Domain\n${pass || !failCodes.includes('R004') ? '✓' : 'Fail'} ${routed.domain.val} (${c(routed.domain.conf)})\n\n`;
  trace += `Information Type\n${pass || !failCodes.includes('R005') ? '✓' : 'Fail'} ${routed.infoType.val} (${c(routed.infoType.conf)})\n\n`;
  trace += `Router Confidence\n${Math.round(routed.conf * 100)}%${isLow ? '  (LOW)' : ''}\n\n`;

  if (isLow) {
    trace += `Correct Behaviour\n${expected[6] === 'Yes' ? 'Ask clarification' : 'Retrieve evidence'}\n\n`;
    trace += `Actual Behaviour\nWould ${routed.clarify === 'Yes' ? 'ask clarifying question (retrieval skipped per Runtime Contract)' : 'proceed to retrieval'}\n\n`;
  }

  if (!pass) {
    trace += `Fail Code${failCodes.length > 1 ? 's' : ''}\n${failCodes.join(', ')}\n\n`;
    trace += `Result\nFAIL:${failCodes.join(',')}\n\`\`\`\n`;
  } else {
    trace += `Result\nPASS\n\`\`\`\n`;
  }

  return trace;
}

// ─────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────

const starterRows = parseSuiteTable(SUITE, ['User Question', 'Expected Intent', 'Clarify']);
const derivedRows = parseSuiteTable(DERIVED, ['User Question', 'Expected Intent', 'Source Artefact']);

const allRows = [
  ...starterRows.slice(0, 6).map((r) => ({ src: 'starter', row: r })),
  ...derivedRows.map((r) => ({ src: 'derived', row: r })),
];

const results = [];
const failureCodeCounts = { R001: 0, R002: 0, R003: 0, R004: 0, R005: 0, R006: 0, R007: 0, R008: 0 };
let passed = 0, failed = 0;

for (const { src, row } of allRows) {
  const question = row[0];
  const routed = route(question);
  const failCodes = compareToExpected(routed, row);
  const trace = renderTrace(question, routed, failCodes, row);
  const pass = failCodes.length === 0;
  if (pass) passed++; else failed++;
  failCodes.forEach((c) => { if (failureCodeCounts[c] !== undefined) failureCodeCounts[c]++; });
  results.push({ src, question, routed, failCodes, trace, pass });
}

const total = allRows.length;
const passRate = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';

// Top failure descriptor
let topFailure = 'No failures';
if (failed > 0) {
  const topCode = Object.entries(failureCodeCounts).sort((a, b) => b[1] - a[1]).find(([, n]) => n > 0);
  const failedRows = results.filter((r) => !r.pass);
  const meanings = { R001: 'Wrong intent', R002: 'Wrong subject', R003: 'Wrong brain', R004: 'Wrong domain', R005: 'Wrong info type', R006: 'Missing clarify', R007: 'Wrong evidence', R008: 'Response contradicted evidence' };
  const exampleFailed = failedRows[0]?.question || '';
  topFailure = topCode ? `${meanings[topCode[0]]} (${topCode[0]}) — ${topCode[1]} case${topCode[1] > 1 ? 's' : ''}${exampleFailed ? ` · e.g. "${exampleFailed}"` : ''}` : 'No failures';
}

const report = `---
title: NEX Router Build ${BUILD_ID} — Report
build_id: ${BUILD_ID}
generated_by: scripts/nex-router-build-001.mjs
generated_at: 2026-07-31
classifier_type: pattern-based (deterministic · idempotent · no LLM)
composes_with:
  - NEX-ROUTER-VALIDATION-SUITE-v1.md (source of validation rows)
  - nex-router-validation-derived-entries-2026-07-31.md (source of derived rows)
  - NEX-ROUTER-TRACE-FORMAT-v1.md (trace rendering format)
  - NEX-ROUTER-BUILD-DASHBOARD-v1.html (dashboard rendering format)
regenerate: node scripts/nex-router-build-001.mjs
---

# NEX Router Build ${BUILD_ID} — Report

**Classifier:** pattern-based (deterministic · no LLM · Stage 2 pattern-table approach per research report)

## Summary

| Metric | Value |
|---|---|
| Total questions tested | ${total} |
| Passed | **${passed}** |
| Failed | **${failed}** |
| Pass Rate | **${passRate}%** |
| Acceptance target | ≥95% |
| Status | ${parseFloat(passRate) >= 95 ? '✅ PASSES target' : '⚠️ BELOW target'} |

## Failure Code Breakdown

| Code | Meaning | Count |
|---|---|---|
| R001 | Wrong intent detected | ${failureCodeCounts.R001} |
| R002 | Wrong subject detected | ${failureCodeCounts.R002} |
| R003 | Wrong brain selected | ${failureCodeCounts.R003} |
| R004 | Wrong knowledge domain | ${failureCodeCounts.R004} |
| R005 | Wrong information type | ${failureCodeCounts.R005} |
| R006 | Clarification should have been requested | ${failureCodeCounts.R006} |
| R007 | Retrieved incorrect evidence | ${failureCodeCounts.R007} · *N/A in Build 0.01 (no retrieval layer yet)* |
| R008 | Response contradicted evidence | ${failureCodeCounts.R008} · *N/A in Build 0.01 (no composition layer yet)* |

## Top Failure

**${topFailure}**

## Per-Question Traces

${results.map((r, i) => `### Q${i + 1} · ${r.src} · ${r.pass ? 'PASS' : 'FAIL:' + r.failCodes.join(',')}\n${r.trace}`).join('\n')}

---

## Notes for the next Build

- Build 0.01 covers Router dimensions 1-5 (Intent · Subject · Brain · Domain · Information Type) + Clarify decision. R007/R008 not applicable until retrieval + composition layers are added.
- Pattern-based classifier is deterministic + idempotent → identical output on re-run.
- Failure codes above tell the next build exactly which patterns to extend.
- Suggested Build 0.02: swap in LLM-based structured output for the intents where pattern coverage falls short (per research report Stage 1).
- Suggested Build 0.03: add retrieval scoped to the classified Brain + Knowledge Domain (research report Stage 4).

*Every improvement is measurable. Every regression is visible. No debate. No opinion.*
`;

fs.writeFileSync(OUT, report);
console.log(`\nRouter Build ${BUILD_ID} complete.`);
console.log(`Tested: ${total} questions`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Pass Rate: ${passRate}%`);
console.log(`Report: ${OUT}`);
