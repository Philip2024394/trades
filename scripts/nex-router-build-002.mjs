#!/usr/bin/env node
// NEX Router Build 0.02 — targets R005 (Wrong Information Type) as a class.
// Fork of Build 0.01 with expanded Info Type patterns + synonym reconciliation.
// Runs against Suite starter (6) + R005 class (10) + derived (5) = 21 questions.
//
// Philip 2026-07-31 direction for Build 0.02:
//   "Don't work on 'Need staircase' specifically. Work on R005 as a class of problems."
//   "If Build 0.02 learns this class well, you'll probably reduce several failures at once instead of fixing one sentence."
//
// Changes vs Build 0.01:
//   1. Info Type patterns extended for Inquiry / Pricing / Gallery / Classification
//   2. Buy intent now maps Info Type to Inquiry (was Definition fallback)
//   3. Quote intent Info Type = Pricing (Cost accepted as synonym)
//   4. Browse intent Info Type = Gallery (Images accepted as synonym)
//   5. Learn "different X types" pattern → Classification
//   6. Synonym map extended to align Suite + Philip's R005 test set vocabulary
//
// IMPORTER DISCIPLINE (per feedback_nex_importer_discipline_2026_07_31.md):
//   Reads Suite + derived only · never alters · idempotent.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '..', '..');
const SUITE = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'NEX-ROUTER-VALIDATION-SUITE-v1.md');
const DERIVED = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-validation-derived-entries-2026-07-31.md');
const OUT = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-build-002-report-2026-07-31.md');

const BUILD_ID = '0.02';
const CONFIDENCE_THRESHOLD = 0.65;

// ─────────────────────────────────────────────────────────────
// Intent patterns (unchanged from 0.01 apart from ordering tweaks)
// ─────────────────────────────────────────────────────────────

const INTENT_PATTERNS = [
  { pat: /\bhow much\b|\bquote\b|\bprice\b|\bpricing\b|\bcost\b/i, val: 'Quote', conf: 0.95 },
  { pat: /\bshow me\b|\bimages?\b|\bphotos?\b|\bpictures?\b|\bgallery\b|\bexamples? of\b/i, val: 'Browse', conf: 0.92 },
  { pat: /\binstall\b|\binstallation\b|\bfitting\b/i, val: 'Service', conf: 0.85 },
  { pat: /\bcompare\b|\bvs\b|\bversus\b|\bdifference between\b|\bwhich is better\b/i, val: 'Compare', conf: 0.90 },
  { pat: /\bcan (?:i buy|i get|i order)\b|\bi (?:need|want) to (?:buy|order|get)\b/i, val: 'Buy', conf: 0.90 },
  { pat: /\bcan (?:i|my|you)\b|\bwould (?:you|it)\b|\bshould (?:i|we)\b|\bis it (?:possible|worth|advisable)\b/i, val: 'Advise', conf: 0.80 },
  { pat: /\bdifferent .*(?:types?|kinds?)\b|\bwhat type\b|\bwhat kind\b|\bwhat size\b|\bwhat.*(?:available|options?)\b|\bwhat is\b|\bwhat.?s\b|\bwhat are\b/i, val: 'Learn', conf: 0.88 },
  { pat: /\bexplain\b|\bhow does\b|\bhow do\b/i, val: 'Explain', conf: 0.85 },
  { pat: /\b(?:need|want|looking for|require)\b/i, val: 'Buy', conf: 0.75 },
];

// ─────────────────────────────────────────────────────────────
// Info Type patterns — EXPANDED for R005 class coverage (Build 0.02)
// ─────────────────────────────────────────────────────────────

const INFO_TYPE_PATTERNS = [
  // Pricing / Cost — Quote intent (kept high priority)
  { pat: /\bhow much\b|\bprice\b|\bcost\b|\bpricing\b|\bquote\b/i, val: 'Pricing', conf: 0.95 },

  // Gallery / Images — Browse intent
  { pat: /\bshow me\b|\bimages?\b|\bphotos?\b|\bpictures?\b|\bgallery\b/i, val: 'Gallery', conf: 0.92 },

  // Dimensions — What size / What dimensions
  { pat: /\bwhat size\b|\bsize\b|\bdimensions?\b|\bhow big\b|\bhow large\b|\bhow (?:wide|tall|deep|thick)\b|\bmm\b|\bwidth\b|\bheight\b/i, val: 'Dimensions', conf: 0.90 },

  // Classification — What type / What kind / Different types
  { pat: /\bdifferent .*(?:types?|kinds?)\b|\bwhat type\b|\bwhat kind\b|\btypes? of\b|\bkinds? of\b|\bclassification\b/i, val: 'Classification', conf: 0.92 },

  // Options — What woods/materials/species are available
  { pat: /\bavailable\b|\boptions?\b|\bchoices?\b|\bwhich (?:woods?|materials?|colours?|species)\b|\bwhat (?:woods?|materials?|colours?|species)\b/i, val: 'Options', conf: 0.88 },

  // Best Practice — Can I / Should I / recommend
  { pat: /\bcan (?:i|my|you)\b|\bshould (?:i|we)\b|\bbest practice\b|\brecommend\b/i, val: 'Best Practice', conf: 0.75 },

  // Comparison
  { pat: /\bcompare\b|\bvs\b|\bversus\b|\bdifference between\b/i, val: 'Comparison', conf: 0.85 },

  // Function
  { pat: /\bhow does\b|\bwhat does\b|\bhow do\b|\bfunction\b|\bpurpose\b/i, val: 'Function', conf: 0.75 },

  // Definition — What is X / What's a X
  { pat: /\bwhat is\b|\bwhat.?s\b|\bwhat are\b|\bdefine\b|\bmeaning\b/i, val: 'Definition', conf: 0.80 },

  // NEW in Build 0.02 — Inquiry pattern for under-specified buy intents
  // Detected AFTER the wh-patterns above (so "what is" beats "want")
  { pat: /\b(?:need|want|looking for|require)\b/i, val: 'Inquiry', conf: 0.75 },
];

// Subject patterns (unchanged from 0.01)
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
  { pat: /\breclaimed\b/i, val: 'Reclaimed timber' },
  { pat: /\bcarpenter\b/i, val: 'Site carpenter' },
  { pat: /\bfurniture\b|\btable\b|\bhallway\b/i, val: 'Matching furniture' },
  { pat: /\bloft ladder\b|\bloft\b/i, val: 'Loft ladder' },
  { pat: /\bnew build\b/i, val: 'New build' },
  { pat: /\boak\b/i, val: 'Oak' },
  { pat: /\bwalnut\b/i, val: 'Walnut' },
  { pat: /\bash\b/i, val: 'Ash' },
  { pat: /\btimber\b|\bwoods?\b|\bhardwoods?\b|\bsoftwoods?\b|\bspecies\b/i, val: 'Timber' },
  { pat: /\bstair(?:case)?s?\b/i, val: 'Staircase' },
];

// Brain assignment
function classifyBrain(subject) {
  if (['Timber', 'Oak', 'Walnut', 'Ash', 'Reclaimed timber'].includes(subject)) return { val: 'Materials', conf: 0.85 };
  return { val: 'Staircase', conf: 0.85 };
}

// Domain assignment — EXPANDED for R005 class
function classifyDomain(intent, infoType, brain, subject) {
  if (intent === 'Browse' && (infoType === 'Gallery' || infoType === 'Images')) return { val: 'Reference Gallery', conf: 0.92 };
  if (intent === 'Quote' || infoType === 'Pricing' || infoType === 'Cost') return { val: 'Pricing', conf: 0.90 };
  if (intent === 'Buy') return { val: 'Sales', conf: 0.85 };
  if (intent === 'Service') return { val: 'Installation', conf: 0.85 };
  if (intent === 'Compare') return { val: 'Design Languages', conf: 0.75 };
  if (intent === 'Advise') return { val: 'Customer FAQ', conf: 0.80 };
  if (infoType === 'Classification' || infoType === 'Types') return { val: 'Classification', conf: 0.92 };
  if (infoType === 'Dimensions') return { val: 'Components', conf: 0.88 };
  if (infoType === 'Options' && brain === 'Materials') return { val: 'Species', conf: 0.85 };
  if (infoType === 'Options') return { val: 'Options', conf: 0.75 };
  if (infoType === 'Definition') return { val: 'Components', conf: 0.70 };
  return { val: 'Knowledge Base', conf: 0.60 };
}

function firstMatch(patterns, text) {
  for (const p of patterns) if (p.pat.test(text)) return p;
  return null;
}

function route(question) {
  const q = question.trim();
  const intentMatch = firstMatch(INTENT_PATTERNS, q);
  const infoMatch = firstMatch(INFO_TYPE_PATTERNS, q);
  const subjectMatch = firstMatch(SUBJECT_PATTERNS, q);

  const intent = intentMatch ? { val: intentMatch.val, conf: intentMatch.conf } : { val: 'Learn', conf: 0.45 };
  const infoType = infoMatch ? { val: infoMatch.val, conf: infoMatch.conf } : { val: 'Definition', conf: 0.50 };
  const subject = subjectMatch ? { val: subjectMatch.val, conf: 0.88 } : { val: 'Unknown', conf: 0.30 };

  const brain = classifyBrain(subject.val);
  const domain = classifyDomain(intent.val, infoType.val, brain.val, subject.val);
  const conf = Math.pow(intent.conf * subject.conf * brain.conf * domain.conf * infoType.conf, 0.2);

  const wordCount = q.split(/\s+/).length;
  let clarify;
  if (conf < CONFIDENCE_THRESHOLD) clarify = 'Yes';
  else if (intent.val === 'Buy' && wordCount < 4) clarify = 'Yes';
  else if (intent.val === 'Buy') clarify = 'Maybe';
  else if (intent.val === 'Quote' && wordCount < 4) clarify = 'Yes';
  else if (intent.val === 'Quote') clarify = 'Maybe';
  else clarify = 'No';

  return { intent, subject, brain, domain, infoType, conf, clarify };
}

// ─────────────────────────────────────────────────────────────
// Suite parser — captures ALL rows from ALL tables (starter + R005 class)
// ─────────────────────────────────────────────────────────────

function parseAllRowsFromSuite(mdPath, tableHeaderMustContain) {
  const raw = fs.readFileSync(mdPath, 'utf8');
  const lines = raw.split('\n');
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (!inTable) {
      if (line.startsWith('|') && tableHeaderMustContain.every((s) => line.includes(s))) {
        inTable = true;
        continue;
      }
    } else {
      if (!line.startsWith('|')) { inTable = false; continue; }
      if (line.startsWith('|---')) continue;
      const cells = line.split('|').map((c) => c.trim());
      cells.shift();
      cells.pop();
      if (cells.length >= 7 && !cells[0].startsWith('*populated')) rows.push(cells);
    }
  }
  return rows;
}

// Synonym reconciliation — Vocabulary Elasticity per Standard v1 §1.3
const SYNONYMS = {
  Intent: { Learn: ['Explain'], Buy: ['Enquire', 'Purchase'], Quote: ['Pricing'], Browse: ['Show'] },
  Subject: {},
  Brain: {},
  Domain: { 'Classification': ['Types'], 'Reference Gallery': ['Images', 'Gallery'] },
  'Information Type': {
    Types: ['Classification'],
    Classification: ['Types'],
    Options: ['Selection'],
    Cost: ['Price', 'Pricing'],
    Pricing: ['Cost', 'Price'],
    Images: ['Gallery'],
    Gallery: ['Images'],
    Inquiry: ['Enquiry'],
  },
};

function matches(dim, actual, expected) {
  if (!expected || expected === '*derived*') return true;
  const a = actual.trim();
  const e = expected.trim();
  if (a.toLowerCase() === e.toLowerCase()) return true;
  const alts = (SYNONYMS[dim] && SYNONYMS[dim][a]) || [];
  if (alts.map((x) => x.toLowerCase()).includes(e.toLowerCase())) return true;
  if (e.includes('/') && e.split('/').map((x) => x.trim().toLowerCase()).includes(a.toLowerCase())) return true;
  return false;
}

function compareToExpected(routed, expected) {
  const failCodes = [];
  if (!matches('Intent', routed.intent.val, expected[1])) failCodes.push('R001');
  if (!matches('Subject', routed.subject.val, expected[2])) failCodes.push('R002');
  if (!matches('Brain', routed.brain.val, expected[3])) failCodes.push('R003');
  if (!matches('Domain', routed.domain.val, expected[4])) failCodes.push('R004');
  if (!matches('Information Type', routed.infoType.val, expected[5])) failCodes.push('R005');
  const expectedClarify = (expected[6] || '').trim();
  if (expectedClarify === 'Yes' && routed.clarify !== 'Yes') failCodes.push('R006');
  if (expectedClarify === 'No' && routed.clarify === 'Yes') failCodes.push('R006');
  return failCodes;
}

function renderTrace(question, routed, failCodes) {
  const c = (n) => n.toFixed(2);
  const isLow = routed.conf < CONFIDENCE_THRESHOLD;
  const pass = failCodes.length === 0;
  const dimFailed = (code) => failCodes.includes(code);

  let trace = `\n\`\`\`\nUSER\n${question}\n\n──────────────────────────\n\n`;
  trace += `Intent\n${!dimFailed('R001') ? '✓' : '✗'} ${routed.intent.val} (${c(routed.intent.conf)})\n\n`;
  trace += `Subject\n${!dimFailed('R002') ? '✓' : '✗'} ${routed.subject.val} (${c(routed.subject.conf)})\n\n`;
  trace += `Brain\n${!dimFailed('R003') ? '✓' : '✗'} ${routed.brain.val} (${c(routed.brain.conf)})\n\n`;
  trace += `Knowledge Domain\n${!dimFailed('R004') ? '✓' : '✗'} ${routed.domain.val} (${c(routed.domain.conf)})\n\n`;
  trace += `Information Type\n${!dimFailed('R005') ? '✓' : '✗'} ${routed.infoType.val} (${c(routed.infoType.conf)})\n\n`;
  trace += `Router Confidence\n${Math.round(routed.conf * 100)}%${isLow ? '  (LOW)' : ''}\n\n`;

  if (pass) {
    trace += `Result\nPASS\n\`\`\`\n`;
  } else {
    trace += `Fail Code${failCodes.length > 1 ? 's' : ''}\n${failCodes.join(', ')}\n\nResult\nFAIL:${failCodes.join(',')}\n\`\`\`\n`;
  }

  return trace;
}

// ─────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────

const suiteRows = parseAllRowsFromSuite(SUITE, ['User Question', 'Expected Intent', 'Clarify']);
const derivedRows = parseAllRowsFromSuite(DERIVED, ['User Question', 'Expected Intent', 'Source Artefact']);

const allRows = [
  ...suiteRows.map((r) => ({ src: 'suite', row: r })),
  ...derivedRows.map((r) => ({ src: 'derived', row: r })),
];

const results = [];
const failureCodeCounts = { R001: 0, R002: 0, R003: 0, R004: 0, R005: 0, R006: 0, R007: 0, R008: 0 };
let passed = 0, failed = 0;

for (const { src, row } of allRows) {
  const question = row[0];
  const routed = route(question);
  const failCodes = compareToExpected(routed, row);
  const trace = renderTrace(question, routed, failCodes);
  const pass = failCodes.length === 0;
  if (pass) passed++; else failed++;
  failCodes.forEach((c) => { if (failureCodeCounts[c] !== undefined) failureCodeCounts[c]++; });
  results.push({ src, question, routed, failCodes, trace, pass });
}

const total = allRows.length;
const passRate = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';

let topFailure = 'No failures';
if (failed > 0) {
  const topCode = Object.entries(failureCodeCounts).sort((a, b) => b[1] - a[1]).find(([, n]) => n > 0);
  const meanings = { R001: 'Wrong intent', R002: 'Wrong subject', R003: 'Wrong brain', R004: 'Wrong domain', R005: 'Wrong info type', R006: 'Missing clarify', R007: 'Wrong evidence', R008: 'Response contradicted evidence' };
  const exampleFailed = results.filter((r) => !r.pass)[0]?.question || '';
  topFailure = topCode ? `${meanings[topCode[0]]} (${topCode[0]}) — ${topCode[1]} case${topCode[1] > 1 ? 's' : ''}${exampleFailed ? ` · e.g. "${exampleFailed}"` : ''}` : 'No failures';
}

const report = `---
title: NEX Router Build ${BUILD_ID} — Report
build_id: ${BUILD_ID}
generated_by: scripts/nex-router-build-002.mjs
generated_at: 2026-07-31
classifier_type: pattern-based (deterministic · idempotent · no LLM)
changes_from_0_01: |
  R005 targeted as a class per Philip's 2026-07-31 direction.
  Info Type patterns extended for Inquiry / Pricing / Gallery / Classification.
  Synonym map extended: Cost≈Pricing · Images≈Gallery · Types≈Classification · Inquiry≈Enquiry.
  Buy intent Info Type = Inquiry (not Definition fallback).
  Quote intent Info Type = Pricing (Cost accepted synonym).
  Browse intent Info Type = Gallery (Images accepted synonym).
  Learn "different X types" → Classification.
regenerate: node scripts/nex-router-build-002.mjs
---

# NEX Router Build ${BUILD_ID} — Report

**Classifier:** pattern-based (deterministic · Build 0.02 targets R005 as a class)

## Summary

| Metric | Value |
|---|---|
| Total questions tested | ${total} |
| Passed | **${passed}** |
| Failed | **${failed}** |
| Pass Rate | **${passRate}%** |
| Acceptance target | ≥95% |
| Status | ${parseFloat(passRate) >= 95 ? '✅ PASSES target' : '⚠️ BELOW target'} |

## Failure Code Breakdown (PRIMARY KPI · Philip 2026-07-31)

| Code | Meaning | Count |
|---|---|---|
| R001 | Wrong intent | ${failureCodeCounts.R001} |
| R002 | Wrong subject | ${failureCodeCounts.R002} |
| R003 | Wrong brain | ${failureCodeCounts.R003} |
| R004 | Wrong knowledge domain | ${failureCodeCounts.R004} |
| R005 | Wrong information type | ${failureCodeCounts.R005} |
| R006 | Clarification should have been requested | ${failureCodeCounts.R006} |
| R007 | Retrieved incorrect evidence | ${failureCodeCounts.R007} · *N/A no retrieval layer yet* |
| R008 | Response contradicted evidence | ${failureCodeCounts.R008} · *N/A no composition layer yet* |

## Top Failure

**${topFailure}**

## Per-Question Traces

${results.map((r, i) => `### Q${i + 1} · ${r.src} · ${r.pass ? 'PASS' : 'FAIL:' + r.failCodes.join(',')}\n${r.trace}`).join('\n')}
`;

fs.writeFileSync(OUT, report);
console.log(`\nRouter Build ${BUILD_ID} complete.`);
console.log(`Tested: ${total} questions`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Pass Rate: ${passRate}%`);
console.log(`Report: ${OUT}`);
