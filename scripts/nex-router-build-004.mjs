#!/usr/bin/env node
// NEX Router Build 0.04 — adds Visual + Consultation intents + Newel cap distinct subject.
//
// Philip 2026-07-31 direction for Build 0.04:
//   VISUAL_COMPONENT intent: "see" / "show" / "picture" / "photo" / "image" / "looks like" / ...
//   → route to Info Type = Visual · not Definition.
//   CONSULTATIVE_INQUIRY intent: "which staircase can fit" / "help me find" / "cheapest but best" / ...
//   → route to Info Type = Recommendation · Clarify=Yes (ask for measurements first).
//   NEWEL CAP as distinct subject from Newel post (longest-alias-match already handles this).
//
// Runs against 27 questions (Suite 6 starter + 10 R005-class + 6 Visual/Consult class + 5 derived).
// Regression detection: runs BOTH Build 0.03 and Build 0.04 · reports Improved/Regressed/Net Gain.
//
// IMPORTER DISCIPLINE: reads corpus only · never alters · idempotent.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '..', '..');
const SUITE = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'NEX-ROUTER-VALIDATION-SUITE-v1.md');
const DERIVED = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-validation-derived-entries-2026-07-31.md');
const OUT = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-build-004-report-2026-07-31.md');

const BUILD_ID = '0.04';
const CONFIDENCE_THRESHOLD = 0.65;

// ═════════════════════════════════════════════════════════════
// SUBJECT DICTIONARY (Build 0.04 · Newel cap added as distinct canonical)
// ═════════════════════════════════════════════════════════════

const SUBJECT_DICTIONARY = {
  'Staircase':          ['staircase', 'staircases', 'stair', 'stairs', 'flight of stairs', 'oak stairs', 'timber stairs', 'wooden staircase', 'wooden stairs', 'oak staircase', 'timber staircase'],
  'Straight flight':    ['straight flight', 'straight-flight', 'straight stairs', 'straight staircase'],
  'Quarter turn':       ['quarter turn', 'quarter-turn', 'l-shaped stairs', 'l shaped stairs'],
  'Half turn':          ['half turn', 'half-turn', 'u-shaped stairs', 'u shaped stairs'],
  'Winder':             ['winder', 'winders', 'kite winder', 'kite winders'],
  'Spiral':             ['spiral', 'spiral staircase', 'spiral stairs'],
  'Curved':             ['curved', 'curved staircase', 'curved stairs', 'sweeping staircase'],
  'Bifurcated':         ['bifurcated', 'double return', 'double-return', 'grand bifurcated'],
  'Newel cap':          ['newel cap', 'newel caps'],  // NEW in 0.04 · longer alias · matches first
  'Newel post':         ['newel post', 'newel posts', 'newel', 'newels'],
  'Handrail':           ['handrail', 'handrails', 'hand rail', 'hand rails'],
  'Baluster':           ['baluster', 'balusters', 'spindle', 'spindles', 'baluster spindle'],
  'Tread':              ['tread', 'treads', 'stair tread', 'stair treads', 'step tread'],
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
  'Landing':            ['landing', 'landing balcony', 'gallery', 'landing gallery', 'stairwell landing'],  // NEW in 0.04
  'Oak':                ['oak', 'european oak', 'american oak', 'white oak'],
  'Walnut':             ['walnut', 'american black walnut', 'black walnut'],
  'Ash':                ['ash', 'european ash'],
  'Timber':             ['timber', 'wood', 'woods', 'hardwood', 'hardwoods', 'softwood', 'softwoods', 'species', 'timber species'],
};

const MATERIAL_DICTIONARY = {
  'Oak':    ['oak', 'european oak', 'american oak', 'white oak'],
  'Walnut': ['walnut', 'american black walnut', 'black walnut'],
  'Ash':    ['ash'],
  'Pine':   ['pine', 'softwood pine'],
  'Steel':  ['steel', 'stainless steel', 'brushed steel'],
  'Glass':  ['glass', 'toughened glass'],
};

function normaliseSubject(question) {
  const q = question.toLowerCase();
  let matchedSubject = null;
  let matchedAlias = null;
  let matchedAliasLen = 0;
  for (const [canonical, aliases] of Object.entries(SUBJECT_DICTIONARY)) {
    for (const alias of aliases) {
      if (q.includes(alias) && alias.length > matchedAliasLen) {
        matchedSubject = canonical;
        matchedAlias = alias;
        matchedAliasLen = alias.length;
      }
    }
  }
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

// ═════════════════════════════════════════════════════════════
// INTENT PATTERNS (Build 0.04 · adds See + Consult)
// ═════════════════════════════════════════════════════════════

const INTENT_PATTERNS = [
  // NEW · VISUAL_COMPONENT (See) — must precede Learn "what is" patterns
  { pat: /\bcan (?:i|we|you) (?:see|show)\b|\b(?:see|show me) (?:what|the|a|some)\b|\blooks? like\b|\bappearance of\b|\bpicture of\b|\bphotos? of\b|\bimages? of\b/i, val: 'See', conf: 0.94 },

  // NEW · CONSULTATIVE_INQUIRY (Consult) — recommendation-seeking with context
  { pat: /\bwhich (?:type of )?(?:staircase|stairs) (?:can|will|would) fit\b|\bhelp (?:me|us) (?:find|choose)\b|\bcheapest but best\b|\brecommend (?:a|the best) (?:staircase|stairs)\b|\bbest (?:staircase|stairs) for (?:my|our)\b/i, val: 'Consult', conf: 0.92 },

  { pat: /\bhow much\b|\bquote\b|\bprice\b|\bpricing\b|\bcost\b/i, val: 'Quote', conf: 0.95 },
  { pat: /\bshow me\b|\bimages?\b|\bphotos?\b|\bpictures?\b|\bgallery\b|\bexamples? of\b|\bwhat (?:options|styles|different (?:options|types|styles))\b/i, val: 'Browse', conf: 0.92 },
  { pat: /\binstall\b|\binstallation\b|\bfitting\b/i, val: 'Service', conf: 0.85 },
  { pat: /\bcompare\b|\bvs\b|\bversus\b|\bdifference between\b|\bwhich is better\b/i, val: 'Compare', conf: 0.90 },
  { pat: /\bcan (?:i buy|i get|i order)\b|\bi (?:need|want) to (?:buy|order|get)\b/i, val: 'Buy', conf: 0.90 },
  { pat: /\bcan (?:i|my|you)\b|\bwould (?:you|it)\b|\bshould (?:i|we)\b|\bis it (?:possible|worth|advisable)\b/i, val: 'Advise', conf: 0.80 },
  { pat: /\bdifferent .*(?:types?|kinds?)\b|\bwhat type\b|\bwhat kind\b|\bwhat size\b|\bwhat.*(?:available|options?)\b|\bwhat is\b|\bwhat.?s\b|\bwhat are\b/i, val: 'Learn', conf: 0.88 },
  { pat: /\bexplain\b|\bhow does\b|\bhow do\b/i, val: 'Explain', conf: 0.85 },
  { pat: /\b(?:need|want|looking for|require)\b/i, val: 'Buy', conf: 0.75 },
];

// ═════════════════════════════════════════════════════════════
// INFO TYPE PATTERNS (Build 0.04 · adds Visual + Recommendation)
// ═════════════════════════════════════════════════════════════

const INFO_TYPE_PATTERNS = [
  // NEW · Visual — paired with See intent
  { pat: /\bcan (?:i|we|you) (?:see|show)\b|\b(?:see|show me) (?:what|the|a|some)\b|\blooks? like\b|\bappearance of\b|\bpicture of\b|\bphotos? of\b|\bimages? of\b/i, val: 'Visual', conf: 0.94 },

  // NEW · Recommendation — paired with Consult intent
  { pat: /\bwhich (?:type of )?(?:staircase|stairs) (?:can|will|would) fit\b|\bhelp (?:me|us) (?:find|choose)\b|\bcheapest but best\b|\brecommend\b|\bbest (?:staircase|stairs) for\b/i, val: 'Recommendation', conf: 0.90 },

  { pat: /\bhow much\b|\bprice\b|\bcost\b|\bpricing\b|\bquote\b/i, val: 'Pricing', conf: 0.95 },
  { pat: /\bshow me\b|\bimages?\b|\bphotos?\b|\bpictures?\b|\bgallery\b/i, val: 'Gallery', conf: 0.92 },
  { pat: /\bwhat size\b|\bsize\b|\bdimensions?\b|\bhow big\b|\bhow large\b|\bhow (?:wide|tall|deep|thick)\b|\bmm\b|\bwidth\b|\bheight\b/i, val: 'Dimensions', conf: 0.90 },
  { pat: /\bdifferent .*(?:types?|kinds?)\b|\bwhat type\b|\bwhat kind\b|\btypes? of\b|\bkinds? of\b|\bclassification\b/i, val: 'Classification', conf: 0.92 },
  { pat: /\bavailable\b|\boptions?\b|\bchoices?\b|\bwhich (?:woods?|materials?|colours?|species)\b|\bwhat (?:woods?|materials?|colours?|species)\b|\bwhat (?:options|styles) (?:have|in)\b/i, val: 'Options', conf: 0.88 },
  { pat: /\bincluded (?:in|with)\b|\bis (?:the )?.+ included\b|\bscope of (?:work|the price)\b/i, val: 'Function', conf: 0.80 },
  { pat: /\bcan (?:i|my|you)\b|\bshould (?:i|we)\b|\bbest practice\b/i, val: 'Best Practice', conf: 0.75 },
  { pat: /\bcompare\b|\bvs\b|\bversus\b|\bdifference between\b/i, val: 'Comparison', conf: 0.85 },
  { pat: /\bhow does\b|\bwhat does\b|\bhow do\b|\bfunction\b|\bpurpose\b/i, val: 'Function', conf: 0.75 },
  { pat: /\bwhat is\b|\bwhat.?s\b|\bwhat are\b|\bdefine\b|\bmeaning\b/i, val: 'Definition', conf: 0.80 },
  { pat: /\b(?:need|want|looking for|require)\b/i, val: 'Inquiry', conf: 0.75 },
];

function classifyBrain(subject) {
  if (['Timber', 'Oak', 'Walnut', 'Ash', 'Reclaimed timber'].includes(subject)) return { val: 'Materials', conf: 0.85 };
  return { val: 'Staircase', conf: 0.85 };
}

// Domain classifier — extended for Recommendation + Scope of Work
function classifyDomain(intent, infoType, brain, subject) {
  if (intent === 'See' || infoType === 'Visual') return { val: 'Components', conf: 0.90 };
  if (intent === 'Consult' || infoType === 'Recommendation') return { val: 'Recommendation', conf: 0.92 };
  if (intent === 'Browse' && (infoType === 'Gallery' || infoType === 'Images' || infoType === 'Options')) return { val: 'Reference Gallery', conf: 0.92 };
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
  // NEW · Scope-of-work queries
  if (/\bincluded\b|\bscope\b/i.test(subject || '')) return { val: 'Scope of Work', conf: 0.80 };
  return { val: 'Knowledge Base', conf: 0.60 };
}

function firstMatch(patterns, text) {
  for (const p of patterns) if (p.pat.test(text)) return p;
  return null;
}

// ─────────────────────────────────────────────────────────────
// Build 0.03 baseline (Subject Dictionary · v0.03 intents)
// ─────────────────────────────────────────────────────────────

const B003_INTENT_PATTERNS = INTENT_PATTERNS.slice(2); // strip See + Consult
const B003_INFO_TYPE_PATTERNS = INFO_TYPE_PATTERNS.slice(2); // strip Visual + Recommendation

function baseWordCountClarify(intent, wordCount, conf) {
  if (conf < CONFIDENCE_THRESHOLD) return 'Yes';
  if (intent === 'Buy' && wordCount < 4) return 'Yes';
  if (intent === 'Buy') return 'Maybe';
  if (intent === 'Quote' && wordCount < 4) return 'Yes';
  if (intent === 'Quote') return 'Maybe';
  if (intent === 'Consult') return 'Yes';  // NEW · consultation always asks first
  return 'No';
}

function routeCommon(question, intentPats, infoPats) {
  const q = question.trim();
  const intentMatch = firstMatch(intentPats, q);
  const infoMatch = firstMatch(infoPats, q);
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

const routeV003 = (q) => routeCommon(q, B003_INTENT_PATTERNS, B003_INFO_TYPE_PATTERNS);
const routeV004 = (q) => routeCommon(q, INTENT_PATTERNS, INFO_TYPE_PATTERNS);

// ─────────────────────────────────────────────────────────────
// Compare + failure codes
// ─────────────────────────────────────────────────────────────

const SYNONYMS = {
  Intent: { Learn: ['Explain'], Buy: ['Enquire', 'Purchase'], Quote: ['Pricing'], Browse: ['Show'], See: ['Show'] },
  Subject: {},
  Brain: {},
  Domain: {
    'Classification': ['Types'],
    'Reference Gallery': ['Images', 'Gallery'],
    'Recommendation': ['Consultation', 'Sales', 'Consult'],
    'Scope of Work': ['Pricing', 'Sales'],
    'Components': ['Knowledge Base'],
  },
  'Information Type': {
    Types: ['Classification'], Classification: ['Types'],
    Options: ['Selection'],
    Cost: ['Price', 'Pricing'], Pricing: ['Cost', 'Price'],
    Images: ['Gallery'], Gallery: ['Images'],
    Inquiry: ['Enquiry'],
    Visual: ['Image', 'Photo', 'Picture'],
    Recommendation: ['Consultation', 'Advice'],
    Function: ['Scope', 'Purpose'],
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

function parseAllRowsFromSuite(mdPath, tableHeaderMustContain) {
  const raw = fs.readFileSync(mdPath, 'utf8');
  const lines = raw.split('\n');
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (!inTable) {
      if (line.startsWith('|') && tableHeaderMustContain.every((s) => line.includes(s))) { inTable = true; continue; }
    } else {
      if (!line.startsWith('|')) { inTable = false; continue; }
      if (line.startsWith('|---')) continue;
      const cells = line.split('|').map((c) => c.trim());
      cells.shift(); cells.pop();
      if (cells.length >= 7 && !cells[0].startsWith('*populated')) rows.push(cells);
    }
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────
// Run BOTH classifiers + regression
// ─────────────────────────────────────────────────────────────

const suiteRows = parseAllRowsFromSuite(SUITE, ['User Question', 'Expected Intent', 'Clarify']);
const derivedRows = parseAllRowsFromSuite(DERIVED, ['User Question', 'Expected Intent', 'Source Artefact']);
const allRows = [...suiteRows.map((r) => ({ src: 'suite', row: r })), ...derivedRows.map((r) => ({ src: 'derived', row: r }))];

const results = [];
const failureCodeCounts = { R001: 0, R002: 0, R003: 0, R004: 0, R005: 0, R006: 0, R007: 0, R008: 0 };
let passed = 0, failed = 0;
let stillPassed = 0, nowPassed = 0, nowFailed = 0, stillFailed = 0;

for (const { src, row } of allRows) {
  const question = row[0];
  const v003 = routeV003(question);
  const v004 = routeV004(question);
  const failCodesV003 = compareToExpected(v003, row);
  const failCodesV004 = compareToExpected(v004, row);
  const passV003 = failCodesV003.length === 0;
  const passV004 = failCodesV004.length === 0;

  if (passV004) passed++; else failed++;
  failCodesV004.forEach((c) => { if (failureCodeCounts[c] !== undefined) failureCodeCounts[c]++; });

  let regressionState;
  if (passV003 && passV004) { stillPassed++; regressionState = 'still-passed'; }
  else if (!passV003 && passV004) { nowPassed++; regressionState = 'improved'; }
  else if (passV003 && !passV004) { nowFailed++; regressionState = 'regressed'; }
  else { stillFailed++; regressionState = 'still-failed'; }

  results.push({ src, question, v003: { routed: v003, pass: passV003, failCodes: failCodesV003 }, v004: { routed: v004, pass: passV004, failCodes: failCodesV004 }, regressionState });
}

const total = allRows.length;
const passRateV004 = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';
const passRateV003 = total > 0 ? (results.filter((r) => r.v003.pass).length / total * 100).toFixed(1) : '0.0';
const netGain = nowPassed - nowFailed;

let topFailure = 'No failures';
if (failed > 0) {
  const topCode = Object.entries(failureCodeCounts).sort((a, b) => b[1] - a[1]).find(([, n]) => n > 0);
  const meanings = { R001: 'Wrong intent', R002: 'Wrong subject', R003: 'Wrong brain', R004: 'Wrong domain', R005: 'Wrong info type', R006: 'Missing clarify', R007: 'Wrong evidence', R008: 'Response contradicted evidence' };
  const exampleFailed = results.filter((r) => !r.v004.pass)[0]?.question || '';
  topFailure = topCode ? `${meanings[topCode[0]]} (${topCode[0]}) — ${topCode[1]} case${topCode[1] > 1 ? 's' : ''}${exampleFailed ? ` · e.g. "${exampleFailed}"` : ''}` : 'No failures';
}

const regressedRows = results.filter((r) => r.regressionState === 'regressed');
const improvedRows = results.filter((r) => r.regressionState === 'improved');

function renderTrace(question, routed, failCodes) {
  const c = (n) => n.toFixed(2);
  const dimFailed = (code) => failCodes.includes(code);
  const materialLine = routed.subject.material ? `\nMaterial (derived)\n✓ ${routed.subject.material}\n` : '';
  const aliasLine = routed.subject.matchedAlias && routed.subject.matchedAlias !== routed.subject.val.toLowerCase() ? ` (via alias "${routed.subject.matchedAlias}")` : '';
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
generated_by: scripts/nex-router-build-004.mjs
generated_at: 2026-07-31
classifier_type: pattern-based + Subject Dictionary + See/Consult intents (Build 0.04)
changes_from_0_03: |
  1. New Intent · See (VISUAL_COMPONENT) — "can I see" / "looks like" / "picture of" → Info Type Visual · Domain Components.
  2. New Intent · Consult (CONSULTATIVE_INQUIRY) — "which staircase can fit" / "help me find" / "cheapest but best" → Info Type Recommendation · Domain Recommendation · Clarify=Yes always.
  3. Subject Dictionary: Newel cap added as distinct canonical from Newel post (longest-alias-match ensures correct routing).
  4. Subject Dictionary: Landing added as canonical with aliases (landing balcony · gallery · stairwell landing).
  5. New Info Type · Visual (paired with See intent) + Recommendation (paired with Consult intent).
regenerate: node scripts/nex-router-build-004.mjs
---

# NEX Router Build ${BUILD_ID} — Report

**Classifier:** pattern-based + Subject Dictionary + See/Consult intents

## Summary

| Metric | Value |
|---|---|
| Total questions tested | ${total} |
| Passed | **${passed}** |
| Failed | **${failed}** |
| Pass Rate | **${passRateV004}%** |
| Build 0.03 baseline (against current Suite) | ${passRateV003}% |
| Delta | **${(parseFloat(passRateV004) - parseFloat(passRateV003)).toFixed(1) >= 0 ? '+' : ''}${(parseFloat(passRateV004) - parseFloat(passRateV003)).toFixed(1)}%** |
| Acceptance target | ≥95% |

## Regression Detection

| State | Count |
|---|---|
| Still Passed | ${stillPassed} |
| **Improved** | **+${nowPassed}** |
| **Regressed** | **-${nowFailed}** |
| Still Failed | ${stillFailed} |
| **Net Gain** | **${netGain >= 0 ? '+' : ''}${netGain}** |

${regressedRows.length > 0 ? `**Regressed questions:**\n${regressedRows.map((r) => `- \`${r.question}\` · v003 PASS → v004 FAIL:${r.v004.failCodes.join(',')}`).join('\n')}\n` : '**No regressions.** All previously-passing questions still pass.\n'}

${improvedRows.length > 0 ? `**Improved questions:**\n${improvedRows.map((r) => `- \`${r.question}\` · v003 FAIL:${r.v003.failCodes.join(',')} → v004 PASS`).join('\n')}\n` : ''}

## Failure Code Breakdown (Build 0.04)

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

${results.map((r, i) => `### Q${i + 1} · ${r.src} · ${r.v004.pass ? 'PASS' : 'FAIL:' + r.v004.failCodes.join(',')} · ${r.regressionState}\n${renderTrace(r.question, r.v004.routed, r.v004.failCodes)}`).join('\n')}
`;

fs.writeFileSync(OUT, report);
console.log(`\nRouter Build ${BUILD_ID} complete.`);
console.log(`Tested: ${total} questions`);
console.log(`Passed: ${passed} · Failed: ${failed} · Pass Rate: ${passRateV004}%`);
console.log(`Baseline v0.03: ${passRateV003}%`);
console.log(`Regression: Still Passed ${stillPassed} · Improved +${nowPassed} · Regressed -${nowFailed} · Net Gain ${netGain >= 0 ? '+' : ''}${netGain}`);
console.log(`Report: ${OUT}`);
