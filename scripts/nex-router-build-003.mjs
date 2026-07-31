#!/usr/bin/env node
// NEX Router Build 0.03 — introduces Subject Dictionary + regression detection.
//
// Philip 2026-07-31 direction for Build 0.03:
//   "Not more patterns. A Subject Dictionary."
//   Canonical subjects · alias arrays · every classifier works from canonical form.
//
// Also adds REGRESSION DETECTION (Philip 2026-07-31):
//   Run Build 002 classifier + Build 003 classifier against the same corpus.
//   Report: Previously Passed → Still Passed · Previously Failed → Now Passed · Previously Passed → Now Failed.
//   Prevents apparent progress from breaking previously-working questions.
//
// Runs against Suite starter (6) + R005 class (10) + derived (5) = 21 questions.
//
// IMPORTER DISCIPLINE (per feedback_nex_importer_discipline_2026_07_31.md):
//   Reads Suite + derived only · never alters · idempotent.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '..', '..');
const SUITE = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'NEX-ROUTER-VALIDATION-SUITE-v1.md');
const DERIVED = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-validation-derived-entries-2026-07-31.md');
const OUT = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-build-003-report-2026-07-31.md');

const BUILD_ID = '0.03';
const CONFIDENCE_THRESHOLD = 0.65;

// ═════════════════════════════════════════════════════════════
// SUBJECT DICTIONARY (Build 0.03 · Philip's directive)
// ═════════════════════════════════════════════════════════════
// Canonical subject → list of surface aliases.
// Router normalises the question against this dictionary before classification.
// Extending the dictionary handles surface variation without adding patterns.

const SUBJECT_DICTIONARY = {
  'Staircase':          ['staircase', 'staircases', 'stair', 'stairs', 'flight of stairs', 'oak stairs', 'timber stairs', 'wooden staircase', 'wooden stairs', 'oak staircase', 'timber staircase'],
  'Straight flight':    ['straight flight', 'straight-flight', 'straight stairs', 'straight staircase'],
  'Quarter turn':       ['quarter turn', 'quarter-turn', 'l-shaped stairs', 'l shaped stairs'],
  'Half turn':          ['half turn', 'half-turn', 'u-shaped stairs', 'u shaped stairs'],
  'Winder':             ['winder', 'winders', 'kite winder', 'kite winders'],
  'Spiral':             ['spiral', 'spiral staircase', 'spiral stairs'],
  'Curved':             ['curved', 'curved staircase', 'curved stairs', 'sweeping staircase'],
  'Bifurcated':         ['bifurcated', 'double return', 'double-return', 'grand bifurcated'],
  'Newel post':         ['newel post', 'newel posts', 'newel', 'newels'],
  'Handrail':           ['handrail', 'handrails', 'hand rail', 'hand rails'],
  'Baluster':           ['baluster', 'balusters', 'spindle', 'spindles', 'baluster spindle'],
  'Tread':              ['tread', 'treads'],
  'Riser':              ['riser', 'risers'],
  'String':             ['string', 'strings', 'stringer', 'stringers'],
  'Glass balustrade':   ['glass balustrade', 'glass balustrades', 'glass panel', 'glass panels', 'frameless glass'],
  'Cut string':         ['cut string', 'cut-string', 'cut stringer'],
  'Closed string':      ['closed string', 'closed-string', 'closed stringer'],
  'Reclaimed timber':   ['reclaimed timber', 'reclaimed wood', 'reclaimed beam', 'reclaimed beams'],
  'Site carpenter':     ['site carpenter', 'carpenter', 'site joiner'],
  'Matching furniture': ['matching furniture', 'furniture', 'hallway table', 'console table'],
  'Loft ladder':        ['loft ladder', 'loft ladders', 'loft access', 'attic ladder'],
  'New build':          ['new build', 'new-build', 'new build site', 'construction site'],
  'Oak':                ['oak', 'european oak', 'american oak', 'white oak'],
  'Walnut':             ['walnut', 'american black walnut', 'black walnut'],
  'Ash':                ['ash', 'european ash'],
  'Timber':             ['timber', 'wood', 'woods', 'hardwood', 'hardwoods', 'softwood', 'softwoods', 'species', 'timber species'],
};

// Material dictionary — extractable as a separate dimension from Subject
const MATERIAL_DICTIONARY = {
  'Oak':    ['oak', 'european oak', 'american oak', 'white oak'],
  'Walnut': ['walnut', 'american black walnut', 'black walnut'],
  'Ash':    ['ash'],
  'Pine':   ['pine', 'softwood pine'],
  'Steel':  ['steel', 'stainless steel', 'brushed steel'],
  'Glass':  ['glass', 'toughened glass'],
};

// Normalise question → canonical subject + material metadata
function normaliseSubject(question) {
  const q = question.toLowerCase();
  let matchedSubject = null;
  let matchedAlias = null;
  let matchedAliasLen = 0;

  // Prefer longest alias match (specificity)
  for (const [canonical, aliases] of Object.entries(SUBJECT_DICTIONARY)) {
    for (const alias of aliases) {
      if (q.includes(alias) && alias.length > matchedAliasLen) {
        matchedSubject = canonical;
        matchedAlias = alias;
        matchedAliasLen = alias.length;
      }
    }
  }

  // Extract material metadata (separate dimension per Philip's example: oak stairs → STAIRCASE + Material=Oak)
  let material = null;
  for (const [canonicalMat, aliases] of Object.entries(MATERIAL_DICTIONARY)) {
    for (const alias of aliases) {
      if (q.includes(alias)) { material = canonicalMat; break; }
    }
    if (material) break;
  }

  return {
    subject: matchedSubject || 'Unknown',
    matchedAlias: matchedAlias || null,
    material,
    confidence: matchedSubject ? (matchedAliasLen >= 8 ? 0.92 : 0.85) : 0.30,
  };
}

// ─────────────────────────────────────────────────────────────
// Intent + Info Type patterns (unchanged from Build 0.02)
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

const INFO_TYPE_PATTERNS = [
  { pat: /\bhow much\b|\bprice\b|\bcost\b|\bpricing\b|\bquote\b/i, val: 'Pricing', conf: 0.95 },
  { pat: /\bshow me\b|\bimages?\b|\bphotos?\b|\bpictures?\b|\bgallery\b/i, val: 'Gallery', conf: 0.92 },
  { pat: /\bwhat size\b|\bsize\b|\bdimensions?\b|\bhow big\b|\bhow large\b|\bhow (?:wide|tall|deep|thick)\b|\bmm\b|\bwidth\b|\bheight\b/i, val: 'Dimensions', conf: 0.90 },
  { pat: /\bdifferent .*(?:types?|kinds?)\b|\bwhat type\b|\bwhat kind\b|\btypes? of\b|\bkinds? of\b|\bclassification\b/i, val: 'Classification', conf: 0.92 },
  { pat: /\bavailable\b|\boptions?\b|\bchoices?\b|\bwhich (?:woods?|materials?|colours?|species)\b|\bwhat (?:woods?|materials?|colours?|species)\b/i, val: 'Options', conf: 0.88 },
  { pat: /\bcan (?:i|my|you)\b|\bshould (?:i|we)\b|\bbest practice\b|\brecommend\b/i, val: 'Best Practice', conf: 0.75 },
  { pat: /\bcompare\b|\bvs\b|\bversus\b|\bdifference between\b/i, val: 'Comparison', conf: 0.85 },
  { pat: /\bhow does\b|\bwhat does\b|\bhow do\b|\bfunction\b|\bpurpose\b/i, val: 'Function', conf: 0.75 },
  { pat: /\bwhat is\b|\bwhat.?s\b|\bwhat are\b|\bdefine\b|\bmeaning\b/i, val: 'Definition', conf: 0.80 },
  { pat: /\b(?:need|want|looking for|require)\b/i, val: 'Inquiry', conf: 0.75 },
];

function classifyBrain(subject) {
  if (['Timber', 'Oak', 'Walnut', 'Ash', 'Reclaimed timber'].includes(subject)) return { val: 'Materials', conf: 0.85 };
  return { val: 'Staircase', conf: 0.85 };
}

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

// ─────────────────────────────────────────────────────────────
// Build 0.02 classifier (baseline · pattern-only Subject matching)
// Copy of Build 0.02's SUBJECT_PATTERNS for regression comparison.
// ─────────────────────────────────────────────────────────────

const B002_SUBJECT_PATTERNS = [
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

// ─────────────────────────────────────────────────────────────
// Router functions (v2 baseline + v3 with Subject Dictionary)
// ─────────────────────────────────────────────────────────────

function baseWordCountClarify(intent, wordCount, conf) {
  if (conf < CONFIDENCE_THRESHOLD) return 'Yes';
  if (intent === 'Buy' && wordCount < 4) return 'Yes';
  if (intent === 'Buy') return 'Maybe';
  if (intent === 'Quote' && wordCount < 4) return 'Yes';
  if (intent === 'Quote') return 'Maybe';
  return 'No';
}

function routeV002(question) {
  const q = question.trim();
  const intentMatch = firstMatch(INTENT_PATTERNS, q);
  const infoMatch = firstMatch(INFO_TYPE_PATTERNS, q);
  const subjectMatch = firstMatch(B002_SUBJECT_PATTERNS, q);
  const intent = intentMatch ? { val: intentMatch.val, conf: intentMatch.conf } : { val: 'Learn', conf: 0.45 };
  const infoType = infoMatch ? { val: infoMatch.val, conf: infoMatch.conf } : { val: 'Definition', conf: 0.50 };
  const subject = subjectMatch ? { val: subjectMatch.val, conf: 0.88 } : { val: 'Unknown', conf: 0.30 };
  const brain = classifyBrain(subject.val);
  const domain = classifyDomain(intent.val, infoType.val, brain.val, subject.val);
  const conf = Math.pow(intent.conf * subject.conf * brain.conf * domain.conf * infoType.conf, 0.2);
  const wordCount = q.split(/\s+/).length;
  const clarify = baseWordCountClarify(intent.val, wordCount, conf);
  return { intent, subject, brain, domain, infoType, conf, clarify };
}

function routeV003(question) {
  const q = question.trim();
  const intentMatch = firstMatch(INTENT_PATTERNS, q);
  const infoMatch = firstMatch(INFO_TYPE_PATTERNS, q);
  const subjNorm = normaliseSubject(q);
  const intent = intentMatch ? { val: intentMatch.val, conf: intentMatch.conf } : { val: 'Learn', conf: 0.45 };
  const infoType = infoMatch ? { val: infoMatch.val, conf: infoMatch.conf } : { val: 'Definition', conf: 0.50 };
  const subject = { val: subjNorm.subject, conf: subjNorm.confidence, matchedAlias: subjNorm.matchedAlias, material: subjNorm.material };
  const brain = classifyBrain(subject.val);
  const domain = classifyDomain(intent.val, infoType.val, brain.val, subject.val);
  const conf = Math.pow(intent.conf * subject.conf * brain.conf * domain.conf * infoType.conf, 0.2);
  const wordCount = q.split(/\s+/).length;
  const clarify = baseWordCountClarify(intent.val, wordCount, conf);
  return { intent, subject, brain, domain, infoType, conf, clarify };
}

// ─────────────────────────────────────────────────────────────
// Compare + failure codes (shared)
// ─────────────────────────────────────────────────────────────

const SYNONYMS = {
  Intent: { Learn: ['Explain'], Buy: ['Enquire', 'Purchase'], Quote: ['Pricing'], Browse: ['Show'] },
  Subject: {},
  Brain: {},
  Domain: { 'Classification': ['Types'], 'Reference Gallery': ['Images', 'Gallery'] },
  'Information Type': {
    Types: ['Classification'], Classification: ['Types'],
    Options: ['Selection'],
    Cost: ['Price', 'Pricing'], Pricing: ['Cost', 'Price'],
    Images: ['Gallery'], Gallery: ['Images'],
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

// ─────────────────────────────────────────────────────────────
// Suite parser
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

// ─────────────────────────────────────────────────────────────
// Run BOTH classifiers · compute regression
// ─────────────────────────────────────────────────────────────

const suiteRows = parseAllRowsFromSuite(SUITE, ['User Question', 'Expected Intent', 'Clarify']);
const derivedRows = parseAllRowsFromSuite(DERIVED, ['User Question', 'Expected Intent', 'Source Artefact']);
const allRows = [...suiteRows.map((r) => ({ src: 'suite', row: r })), ...derivedRows.map((r) => ({ src: 'derived', row: r }))];

const results = [];
const failureCodeCounts = { R001: 0, R002: 0, R003: 0, R004: 0, R005: 0, R006: 0, R007: 0, R008: 0 };
let passed = 0, failed = 0;

// Regression tracking
let stillPassed = 0, nowPassed = 0, nowFailed = 0, stillFailed = 0;

for (const { src, row } of allRows) {
  const question = row[0];
  const v002 = routeV002(question);
  const v003 = routeV003(question);
  const failCodesV002 = compareToExpected(v002, row);
  const failCodesV003 = compareToExpected(v003, row);
  const passV002 = failCodesV002.length === 0;
  const passV003 = failCodesV003.length === 0;

  if (passV003) passed++; else failed++;
  failCodesV003.forEach((c) => { if (failureCodeCounts[c] !== undefined) failureCodeCounts[c]++; });

  // Regression classification
  let regressionState;
  if (passV002 && passV003) { stillPassed++; regressionState = 'still-passed'; }
  else if (!passV002 && passV003) { nowPassed++; regressionState = 'improved'; }
  else if (passV002 && !passV003) { nowFailed++; regressionState = 'regressed'; }
  else { stillFailed++; regressionState = 'still-failed'; }

  results.push({ src, question, v002: { routed: v002, pass: passV002, failCodes: failCodesV002 }, v003: { routed: v003, pass: passV003, failCodes: failCodesV003 }, regressionState });
}

const total = allRows.length;
const passRateV003 = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';
const passRateV002 = total > 0 ? (results.filter((r) => r.v002.pass).length / total * 100).toFixed(1) : '0.0';
const netGain = nowPassed - nowFailed;

let topFailure = 'No failures';
if (failed > 0) {
  const topCode = Object.entries(failureCodeCounts).sort((a, b) => b[1] - a[1]).find(([, n]) => n > 0);
  const meanings = { R001: 'Wrong intent', R002: 'Wrong subject', R003: 'Wrong brain', R004: 'Wrong domain', R005: 'Wrong info type', R006: 'Missing clarify', R007: 'Wrong evidence', R008: 'Response contradicted evidence' };
  const exampleFailed = results.filter((r) => !r.v003.pass)[0]?.question || '';
  topFailure = topCode ? `${meanings[topCode[0]]} (${topCode[0]}) — ${topCode[1]} case${topCode[1] > 1 ? 's' : ''}${exampleFailed ? ` · e.g. "${exampleFailed}"` : ''}` : 'No failures';
}

// Regressed rows (broke previously-working questions)
const regressedRows = results.filter((r) => r.regressionState === 'regressed');
const improvedRows = results.filter((r) => r.regressionState === 'improved');

// ─────────────────────────────────────────────────────────────
// Render report
// ─────────────────────────────────────────────────────────────

function renderTrace(question, routed, failCodes) {
  const c = (n) => n.toFixed(2);
  const dimFailed = (code) => failCodes.includes(code);
  const materialLine = routed.subject.material ? `\nMaterial (derived)\n✓ ${routed.subject.material}\n` : '';
  const aliasLine = routed.subject.matchedAlias && routed.subject.matchedAlias !== routed.subject.val.toLowerCase()
    ? ` (via alias "${routed.subject.matchedAlias}")` : '';
  const isLow = routed.conf < CONFIDENCE_THRESHOLD;

  let trace = `\n\`\`\`\nUSER\n${question}\n\n──────────────────────────\n\n`;
  trace += `Intent\n${!dimFailed('R001') ? '✓' : '✗'} ${routed.intent.val} (${c(routed.intent.conf)})\n\n`;
  trace += `Subject\n${!dimFailed('R002') ? '✓' : '✗'} ${routed.subject.val}${aliasLine} (${c(routed.subject.conf)})${materialLine}\n`;
  trace += `\nBrain\n${!dimFailed('R003') ? '✓' : '✗'} ${routed.brain.val} (${c(routed.brain.conf)})\n\n`;
  trace += `Knowledge Domain\n${!dimFailed('R004') ? '✓' : '✗'} ${routed.domain.val} (${c(routed.domain.conf)})\n\n`;
  trace += `Information Type\n${!dimFailed('R005') ? '✓' : '✗'} ${routed.infoType.val} (${c(routed.infoType.conf)})\n\n`;
  trace += `Router Confidence\n${Math.round(routed.conf * 100)}%${isLow ? '  (LOW)' : ''}\n\n`;
  if (failCodes.length === 0) trace += `Result\nPASS\n\`\`\`\n`;
  else trace += `Fail Code${failCodes.length > 1 ? 's' : ''}\n${failCodes.join(', ')}\n\nResult\nFAIL:${failCodes.join(',')}\n\`\`\`\n`;
  return trace;
}

const report = `---
title: NEX Router Build ${BUILD_ID} — Report
build_id: ${BUILD_ID}
generated_by: scripts/nex-router-build-003.mjs
generated_at: 2026-07-31
classifier_type: pattern-based + SUBJECT DICTIONARY (Build 0.03 addition)
changes_from_0_02: |
  1. Subject Dictionary introduced (Philip's 2026-07-31 directive: "Not more patterns. A Subject Dictionary.").
     Canonical subject → alias list. Longest-alias-match wins. Normalisation before classification.
  2. Material extracted as separate dimension metadata (oak stairs → STAIRCASE + Material=Oak).
  3. Regression detection added. Both Build 0.02 + Build 0.03 classifiers run against same corpus.
     Reports: Previously Passed → Still Passed · Previously Failed → Now Passed · Previously Passed → Now Failed.
regenerate: node scripts/nex-router-build-003.mjs
---

# NEX Router Build ${BUILD_ID} — Report

**Classifier:** pattern-based + Subject Dictionary (Build 0.03 · normalisation layer before classification)

## Summary

| Metric | Value |
|---|---|
| Total questions tested | ${total} |
| Passed | **${passed}** |
| Failed | **${failed}** |
| Pass Rate | **${passRateV003}%** |
| Build 0.02 Pass Rate (baseline) | ${passRateV002}% |
| Delta vs 0.02 | **${(parseFloat(passRateV003) - parseFloat(passRateV002)).toFixed(1) >= 0 ? '+' : ''}${(parseFloat(passRateV003) - parseFloat(passRateV002)).toFixed(1)}%** |
| Acceptance target | ≥95% |
| Status | ${parseFloat(passRateV003) >= 95 ? '✅ PASSES target' : '⚠️ BELOW target'} |

## Regression Detection (Philip 2026-07-31)

| State | Count | Meaning |
|---|---|---|
| Still Passed | ${stillPassed} | Passed in 0.02 · still passes in 0.03 |
| Improved | **${nowPassed}** | Failed in 0.02 · now passes in 0.03 |
| Regressed | **${nowFailed}** | Passed in 0.02 · now fails in 0.03 (⚠️ real progress test) |
| Still Failed | ${stillFailed} | Failed in 0.02 · still fails in 0.03 |
| **Net Gain** | **${netGain >= 0 ? '+' : ''}${netGain}** | Improved minus Regressed |

${regressedRows.length > 0 ? `**Regressed questions (broke previously-working):**\n\n${regressedRows.map((r) => `- \`${r.question}\` · v002 PASS → v003 FAIL:${r.v003.failCodes.join(',')}`).join('\n')}\n` : '**No regressions.** All previously-passing questions still pass.\n'}

${improvedRows.length > 0 ? `**Improved questions (v002 fail → v003 pass):**\n\n${improvedRows.map((r) => `- \`${r.question}\` · v002 FAIL:${r.v002.failCodes.join(',')} → v003 PASS`).join('\n')}\n` : ''}

## Failure Code Breakdown (Build 0.03)

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

## Per-Question Traces (Build 0.03 outputs)

${results.map((r, i) => `### Q${i + 1} · ${r.src} · ${r.v003.pass ? 'PASS' : 'FAIL:' + r.v003.failCodes.join(',')} · ${r.regressionState}\n${renderTrace(r.question, r.v003.routed, r.v003.failCodes)}`).join('\n')}
`;

fs.writeFileSync(OUT, report);
console.log(`\nRouter Build ${BUILD_ID} complete.`);
console.log(`Tested: ${total} questions`);
console.log(`Passed: ${passed} · Failed: ${failed} · Pass Rate: ${passRateV003}%`);
console.log(`Baseline v0.02: ${passRateV002}%`);
console.log(`Regression: Still Passed ${stillPassed} · Improved +${nowPassed} · Regressed -${nowFailed} · Net Gain ${netGain >= 0 ? '+' : ''}${netGain}`);
console.log(`Report: ${OUT}`);
