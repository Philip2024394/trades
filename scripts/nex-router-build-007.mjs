#!/usr/bin/env node
// NEX Router Build 0.07 — Subject Intelligence (homeowner_terms) targeting the 80.5% Subject bottleneck.
//
// Philip 2026-07-31 direction:
//   "Build 0.06 shouldn't just add aliases. I'd evolve the Subject Dictionary into a Subject Intelligence Dictionary.
//    These aren't alias failures. They're concept failures. Subject ≠ Word.
//    Description → Concept → Subject."
//
// Adopted: Subject entries become structured records with `aliases` + `homeowner_terms` fields.
// Homeowner terms are matched alongside aliases · longest-match wins.
// Full Brain/Knowledge/Conversation refactor + 12 biological regions + 7 thinking modules
// preserved as Standard v2 candidate at nex-brain-evolution-v2-candidate-2026-07-31.md · NOT built here.
//
// Regression detection vs Build 0.06 baseline. Per-dimension accuracy.
// IMPORTER DISCIPLINE: reads corpus only · idempotent.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '..', '..');
const SUITE = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'NEX-ROUTER-VALIDATION-SUITE-v1.md');
const DERIVED = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-validation-derived-entries-2026-07-31.md');
const OUT = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-build-007-report-2026-07-31.md');

const BUILD_ID = '0.07';
const CONFIDENCE_THRESHOLD = 0.65;

// ═════════════════════════════════════════════════════════════
// SUBJECT INTELLIGENCE DICTIONARY (Build 0.07 · structured entries)
// ═════════════════════════════════════════════════════════════
// New shape: { aliases: [...], homeowner_terms: [...] }
// Legacy shape (array of aliases) still supported via backward-compat converter below.

const SUBJECT_INTELLIGENCE = {
  'Staircase':          { aliases: ['staircase', 'staircases', 'stair', 'stairs', 'flight of stairs', 'oak stairs', 'timber stairs', 'wooden staircase', 'wooden stairs', 'oak staircase', 'timber staircase'], homeowner_terms: [] },
  'Straight flight':    { aliases: ['straight flight', 'straight-flight', 'straight stairs', 'straight staircase'], homeowner_terms: [] },
  'Quarter turn':       { aliases: ['quarter turn', 'quarter-turn', 'l-shaped stairs', 'l shaped stairs'], homeowner_terms: [] },
  'Half turn':          { aliases: ['half turn', 'half-turn', 'u-shaped stairs', 'u shaped stairs'], homeowner_terms: [] },
  'Winder':             { aliases: ['winder', 'winders', 'kite winder', 'kite winders'], homeowner_terms: [] },
  'Spiral':             { aliases: ['spiral', 'spiral staircase', 'spiral stairs'], homeowner_terms: [] },
  'Curved':             { aliases: ['curved', 'curved staircase', 'curved stairs', 'sweeping staircase'], homeowner_terms: [] },
  'Bifurcated':         { aliases: ['bifurcated', 'double return', 'double-return', 'grand bifurcated'], homeowner_terms: [] },
  'Newel cap':          { aliases: ['newel cap', 'newel caps'], homeowner_terms: ['fancy top', 'decorative top of the post', 'ball on top'] },

  // ★ Subject Intelligence adopted for these 5 core subjects
  'Newel post':         {
    aliases: ['newel post', 'newel posts', 'newel', 'newels'],
    homeowner_terms: ['big post at the bottom', 'big wooden post at the bottom', 'wooden post at the bottom', 'corner post', 'wooden post', 'big post', 'post at the bottom', 'tall wooden thing', 'post at the corner'],
  },
  'Handrail':           {
    aliases: ['handrail', 'handrails', 'hand rail', 'hand rails'],
    homeowner_terms: ['piece you hold', 'piece you hold going up', 'rail you hold', 'grab rail', 'rail on the side', 'thing you hold', 'rail going up'],
  },
  'Tread':              {
    aliases: ['tread', 'treads', 'stair tread', 'stair treads', 'step tread', 'oak stair treads', 'oak treads'],
    homeowner_terms: ['flat bit you stand on', 'flat piece you stand on', 'part you walk on', 'flat top of the step', 'step surface', 'top of the step', 'part you step on'],
  },
  'Riser':              {
    aliases: ['riser', 'risers'],
    homeowner_terms: ['vertical piece between steps', 'vertical bit between steps', 'front of the step', 'back of the step', 'upright between steps', 'vertical face', 'space between steps'],
  },
  'String':             {
    aliases: ['stair strings', 'stair string', 'string', 'strings', 'stringer', 'stringers'],
    homeowner_terms: ['side of the staircase', 'side of the stairs', 'wooden thing under the steps', 'side beam', 'sloped side', 'diagonal side of the stairs'],
  },

  'Baluster':           { aliases: ['baluster', 'balusters', 'balustrade', 'balustrades', 'spindle', 'spindles', 'baluster spindle'], homeowner_terms: [] },
  'Glass balustrade':   { aliases: ['glass balustrade', 'glass balustrades', 'glass panel', 'glass panels', 'frameless glass'], homeowner_terms: [] },
  'Cut string':         { aliases: ['cut string', 'cut-string', 'cut stringer'], homeowner_terms: [] },
  'Closed string':      { aliases: ['closed string', 'closed-string', 'closed stringer'], homeowner_terms: [] },
  'Reclaimed timber':   { aliases: ['reclaimed timber', 'reclaimed wood', 'reclaimed beam', 'reclaimed beams'], homeowner_terms: [] },
  'Site carpenter':     { aliases: ['site carpenter', 'carpenter', 'site joiner'], homeowner_terms: [] },
  'Matching furniture': { aliases: ['matching furniture', 'furniture', 'hallway table', 'console table'], homeowner_terms: [] },
  'Loft ladder':        { aliases: ['loft ladder', 'loft ladders', 'loft access', 'attic ladder'], homeowner_terms: [] },
  'New build':          { aliases: ['new build', 'new-build', 'new build site', 'construction site'], homeowner_terms: [] },
  'Landing':            { aliases: ['landing', 'landing balcony', 'gallery', 'landing gallery', 'stairwell landing'], homeowner_terms: [] },
  'Oak':                { aliases: ['oak', 'european oak', 'american oak', 'white oak'], homeowner_terms: [] },
  'Walnut':             { aliases: ['walnut', 'american black walnut', 'black walnut'], homeowner_terms: [] },
  'Ash':                { aliases: ['ash', 'european ash'], homeowner_terms: [] },
  'Timber':             { aliases: ['timber', 'wood', 'woods', 'hardwood', 'hardwoods', 'softwood', 'softwoods', 'species', 'timber species'], homeowner_terms: [] },
};

const MATERIAL_DICTIONARY = {
  'Oak':    ['white oak', 'european oak', 'american oak', 'oak'],
  'Walnut': ['american black walnut', 'black walnut', 'walnut'],
  'Ash':    ['european ash', 'ash'],
  'Pine':   ['softwood pine', 'pine'],
  'Steel':  ['stainless steel', 'brushed steel', 'steel'],
  'Glass':  ['toughened glass', 'glass'],
};

// v0.07 normalise: matches on aliases OR homeowner_terms · longest-match wins across both
function normaliseSubject(question) {
  const q = question.toLowerCase();
  let matchedSubject = null, matchedAlias = null, matchedAliasLen = 0, matchedVia = null;
  for (const [canonical, entry] of Object.entries(SUBJECT_INTELLIGENCE)) {
    for (const alias of entry.aliases) {
      if (q.includes(alias) && alias.length > matchedAliasLen) { matchedSubject = canonical; matchedAlias = alias; matchedAliasLen = alias.length; matchedVia = 'alias'; }
    }
    for (const term of entry.homeowner_terms) {
      if (q.includes(term) && term.length > matchedAliasLen) { matchedSubject = canonical; matchedAlias = term; matchedAliasLen = term.length; matchedVia = 'homeowner'; }
    }
  }
  const materials = [];
  for (const [canonicalMat, aliases] of Object.entries(MATERIAL_DICTIONARY)) {
    for (const alias of aliases) { if (q.includes(alias) && !materials.includes(canonicalMat)) { materials.push(canonicalMat); break; } }
  }
  return {
    subject: matchedSubject || 'Unknown',
    matchedAlias,
    matchedVia,
    material: materials[0] || null,
    materials,
    confidence: matchedSubject ? (matchedAliasLen >= 8 ? 0.92 : 0.85) : 0.30,
  };
}

// v0.06 baseline: alias-only matching (no homeowner_terms lookup)
function normaliseSubjectV006(question) {
  const q = question.toLowerCase();
  let matchedSubject = null, matchedAlias = null, matchedAliasLen = 0;
  for (const [canonical, entry] of Object.entries(SUBJECT_INTELLIGENCE)) {
    for (const alias of entry.aliases) {
      if (q.includes(alias) && alias.length > matchedAliasLen) { matchedSubject = canonical; matchedAlias = alias; matchedAliasLen = alias.length; }
    }
    // NOTE: does NOT check homeowner_terms — this is the v0.06 behaviour
  }
  const materials = [];
  for (const [canonicalMat, aliases] of Object.entries(MATERIAL_DICTIONARY)) {
    for (const alias of aliases) { if (q.includes(alias) && !materials.includes(canonicalMat)) { materials.push(canonicalMat); break; } }
  }
  return { subject: matchedSubject || 'Unknown', matchedAlias, material: materials[0] || null, materials, confidence: matchedSubject ? (matchedAliasLen >= 8 ? 0.92 : 0.85) : 0.30 };
}

// ═════════════════════════════════════════════════════════════
// INTENT + INFO TYPE PATTERNS (unchanged from 0.06)
// ═════════════════════════════════════════════════════════════

const INTENT_PATTERNS = [
  { pat: /\bi.?m confused\b|\bi don.?t (?:understand|get)\b|\bconfused about\b/i, val: 'Confused', conf: 0.92 },
  { pat: /\bmy (?:staircase|stairs|stair|newel|handrail|tread|riser) (?:squeaks?|creaks?|moves?|is loose|is cracked|has a gap|makes noise)\b|\bwhy is there (?:a gap|movement|noise|cracking)\b/i, val: 'Diagnostic', conf: 0.90 },
  { pat: /\bcan every (?:staircase|stair)\b|\bcan i (?:fit|install|build) (?:a )?(?:staircase|stairs) myself\b|\bcan (?:oak|wood|timber|glass) (?:never|always)\b/i, val: 'Reality', conf: 0.90 },
  { pat: /\bwhy (?:are|is|do|does|can.?t|should|would|has)\b|\bwhy .+ so (?:thick|large|small|expensive|important)\b|\bwhat makes .+ (?:comfortable|strong|safe)\b/i, val: 'Why', conf: 0.90 },
  { pat: /\bcan (?:i|we|you) (?:see|show)\b|\b(?:see|show me) (?:what|the|a|some)\b|\blooks? like\b|\bappearance of\b|\bpicture of\b|\bphotos? of\b|\bimages? of\b/i, val: 'See', conf: 0.94 },
  { pat: /\bwhich (?:type of )?(?:staircase|stairs) (?:can|will|would) fit\b|\bhelp (?:me|us) (?:find|choose)\b|\bcheapest but best\b|\brecommend (?:a|the best) (?:staircase|stairs)\b|\bbest (?:staircase|stairs) for (?:my|our)\b/i, val: 'Consult', conf: 0.92 },
  { pat: /\bcompare\b|\bvs\b|\bversus\b|\bdifference between\b|\bwhich is better\b|\b\w+ or \w+ (?:balustrades?|treads?|risers?|newels?|handrails?|stairs?|staircases?|strings?|balusters?|spindles?|caps?)\b|\bwhich .*(?:better|worse|stronger)/i, val: 'Compare', conf: 0.92 },
  { pat: /\bhow much\b|\bquote\b|\bprice\b|\bpricing\b|\bcost\b/i, val: 'Quote', conf: 0.95 },
  { pat: /\bshow me\b|\bimages?\b|\bphotos?\b|\bpictures?\b|\bgallery\b|\bexamples? of\b|\bwhat (?:options|styles|different (?:options|types|styles))\b/i, val: 'Browse', conf: 0.92 },
  { pat: /\binstall\b|\binstallation\b|\bfitting\b/i, val: 'Service', conf: 0.85 },
  { pat: /\bcan (?:i buy|i get|i order)\b|\bi (?:need|want) to (?:buy|order|get)\b/i, val: 'Buy', conf: 0.90 },
  { pat: /\bcan (?:i|my|you)\b|\bwould (?:you|it)\b|\bshould (?:i|we)\b|\bis it (?:possible|worth|advisable)\b/i, val: 'Advise', conf: 0.80 },
  { pat: /\bdifferent .*(?:types?|kinds?)\b|\bwhat type\b|\bwhat kind\b|\bwhat size\b|\bwhat.*(?:available|options?)\b|\bwhat is\b|\bwhat.?s\b|\bwhat are\b|\bthe (?:piece|part|bit|thing|side)\b/i, val: 'Learn', conf: 0.88 },
  { pat: /\bexplain\b|\bhow does\b|\bhow do\b/i, val: 'Explain', conf: 0.85 },
  { pat: /\b(?:need|want|looking for|require)\b/i, val: 'Buy', conf: 0.75 },
];

const INFO_TYPE_PATTERNS = [
  { pat: /\bmy (?:staircase|stairs|stair) (?:squeaks?|creaks?|moves?)\b|\bwhy is there (?:a gap|movement|noise|cracking)\b/i, val: 'Diagnosis', conf: 0.90 },
  { pat: /\bcan every (?:staircase|stair)\b|\bcan i (?:fit|install|build) (?:a )?(?:staircase|stairs) myself\b|\bcan (?:oak|wood|timber|glass) (?:never|always)\b/i, val: 'Reality', conf: 0.90 },
  { pat: /\bwhy (?:are|is|do|does|can.?t|should|would|has)\b|\bwhy .+ so (?:thick|large|small|expensive|important)\b|\bwhat makes .+ (?:comfortable|strong|safe)\b/i, val: 'Reasoning', conf: 0.90 },
  { pat: /\bcan (?:i|we|you) (?:see|show)\b|\b(?:see|show me) (?:what|the|a|some)\b|\blooks? like\b|\bappearance of\b|\bpicture of\b|\bphotos? of\b|\bimages? of\b/i, val: 'Visual', conf: 0.94 },
  { pat: /\bwhich (?:type of )?(?:staircase|stairs) (?:can|will|would) fit\b|\bhelp (?:me|us) (?:find|choose)\b|\bcheapest but best\b|\brecommend\b|\bbest (?:staircase|stairs) for\b/i, val: 'Recommendation', conf: 0.90 },
  { pat: /\bcompare\b|\bvs\b|\bversus\b|\bdifference between\b|\b\w+ or \w+ (?:balustrades?|treads?|risers?|newels?|handrails?|stairs?|staircases?|strings?|balusters?|spindles?|caps?)\b|\bwhich is better\b/i, val: 'Comparison', conf: 0.88 },
  { pat: /\bhow much\b|\bprice\b|\bcost\b|\bpricing\b|\bquote\b/i, val: 'Pricing', conf: 0.95 },
  { pat: /\bshow me\b|\bimages?\b|\bphotos?\b|\bpictures?\b|\bgallery\b/i, val: 'Gallery', conf: 0.92 },
  { pat: /\bwhat size\b|\bsize\b|\bdimensions?\b|\bhow big\b|\bhow large\b|\bhow (?:wide|tall|deep|thick)\b|\bmm\b|\bwidth\b|\bheight\b/i, val: 'Dimensions', conf: 0.90 },
  { pat: /\bdifferent .*(?:types?|kinds?)\b|\bwhat type\b|\bwhat kind\b|\btypes? of\b|\bkinds? of\b|\bclassification\b/i, val: 'Classification', conf: 0.92 },
  { pat: /\bavailable\b|\boptions?\b|\bchoices?\b|\bwhich (?:woods?|materials?|colours?|species)\b|\bwhat (?:woods?|materials?|colours?|species)\b|\bwhat (?:options|styles) (?:have|in)\b/i, val: 'Options', conf: 0.88 },
  { pat: /\bincluded (?:in|with)\b|\bis (?:the )?.+ included\b|\bscope of (?:work|the price)\b/i, val: 'Function', conf: 0.80 },
  { pat: /\bcan (?:i|my|you)\b|\bshould (?:i|we)\b|\bbest practice\b/i, val: 'Best Practice', conf: 0.75 },
  { pat: /\bhow does\b|\bwhat does\b|\bhow do\b|\bfunction\b|\bpurpose\b/i, val: 'Function', conf: 0.75 },
  { pat: /\bi.?m confused\b|\bi don.?t (?:understand|get)\b|\bconfused about\b/i, val: 'Definition', conf: 0.80 },
  { pat: /\bwhat is\b|\bwhat.?s\b|\bwhat are\b|\bdefine\b|\bmeaning\b|\bthe (?:piece|part|bit|thing|side)\b/i, val: 'Definition', conf: 0.80 },
  { pat: /\b(?:need|want|looking for|require)\b/i, val: 'Inquiry', conf: 0.75 },
];

function classifyBrain(subject) {
  if (['Timber', 'Oak', 'Walnut', 'Ash', 'Reclaimed timber'].includes(subject)) return { val: 'Materials', conf: 0.85 };
  return { val: 'Staircase', conf: 0.85 };
}

function classifyDomain(intent, infoType, brain, subject) {
  if (intent === 'Diagnostic' || infoType === 'Diagnosis') return { val: 'Troubleshooting', conf: 0.90 };
  if (intent === 'Reality' || infoType === 'Reality') return { val: 'Reality Check', conf: 0.90 };
  if (intent === 'Why' || infoType === 'Reasoning') return { val: 'Engineering', conf: 0.88 };
  if (intent === 'Confused') return { val: 'Teaching', conf: 0.85 };
  if (intent === 'See' || infoType === 'Visual') return { val: 'Components', conf: 0.90 };
  if (intent === 'Consult' || infoType === 'Recommendation') return { val: 'Recommendation', conf: 0.92 };
  if (intent === 'Compare' || infoType === 'Comparison') return { val: 'Design Languages', conf: 0.88 };
  if (intent === 'Browse' && (infoType === 'Gallery' || infoType === 'Images' || infoType === 'Options')) return { val: 'Reference Gallery', conf: 0.92 };
  if (intent === 'Quote' || infoType === 'Pricing' || infoType === 'Cost') return { val: 'Pricing', conf: 0.90 };
  if (intent === 'Buy') return { val: 'Sales', conf: 0.85 };
  if (intent === 'Service') return { val: 'Installation', conf: 0.85 };
  if (intent === 'Advise') return { val: 'Customer FAQ', conf: 0.80 };
  if (infoType === 'Classification' || infoType === 'Types') return { val: 'Classification', conf: 0.92 };
  if (infoType === 'Dimensions') return { val: 'Components', conf: 0.88 };
  if (infoType === 'Options' && brain === 'Materials') return { val: 'Species', conf: 0.85 };
  if (infoType === 'Options') return { val: 'Options', conf: 0.75 };
  if (infoType === 'Definition') return { val: 'Components', conf: 0.70 };
  return { val: 'Knowledge Base', conf: 0.60 };
}

function firstMatch(patterns, text) { for (const p of patterns) if (p.pat.test(text)) return p; return null; }

function baseWordCountClarify(intent, wordCount, conf) {
  if (conf < CONFIDENCE_THRESHOLD) return 'Yes';
  if (intent === 'Buy' && wordCount < 4) return 'Yes';
  if (intent === 'Buy') return 'Maybe';
  if (intent === 'Quote' && wordCount < 4) return 'Yes';
  if (intent === 'Quote') return 'Maybe';
  if (intent === 'Consult') return 'Yes';
  if (intent === 'Confused') return 'Yes';
  if (intent === 'Reality' && wordCount < 6) return 'Maybe';
  return 'No';
}

function routeCommon(question, subjNormFn) {
  const q = question.trim();
  const intentMatch = firstMatch(INTENT_PATTERNS, q);
  const infoMatch = firstMatch(INFO_TYPE_PATTERNS, q);
  const subjNorm = subjNormFn(q);
  const intent = intentMatch ? { val: intentMatch.val, conf: intentMatch.conf } : { val: 'Learn', conf: 0.45 };
  const infoType = infoMatch ? { val: infoMatch.val, conf: infoMatch.conf } : { val: 'Definition', conf: 0.50 };
  const subject = { val: subjNorm.subject, conf: subjNorm.confidence, matchedAlias: subjNorm.matchedAlias, matchedVia: subjNorm.matchedVia, material: subjNorm.material, materials: subjNorm.materials };
  const brain = classifyBrain(subject.val);
  const domain = classifyDomain(intent.val, infoType.val, brain.val, subject.val);
  const conf = Math.pow(intent.conf * subject.conf * brain.conf * domain.conf * infoType.conf, 0.2);
  const wordCount = q.split(/\s+/).length;
  const clarify = baseWordCountClarify(intent.val, wordCount, conf);
  return { intent, subject, brain, domain, infoType, conf, clarify };
}

const routeV006 = (q) => routeCommon(q, normaliseSubjectV006);
const routeV007 = (q) => routeCommon(q, normaliseSubject);

const SYNONYMS = {
  Intent: { Learn: ['Explain'], Buy: ['Enquire', 'Purchase'], Quote: ['Pricing'], Browse: ['Show'], See: ['Show'], Why: ['Explain', 'Curiosity'] },
  Subject: {}, Brain: {},
  Domain: { 'Classification': ['Types'], 'Reference Gallery': ['Images', 'Gallery'], 'Recommendation': ['Consultation', 'Sales', 'Consult'], 'Scope of Work': ['Pricing', 'Sales'], 'Components': ['Knowledge Base'], 'Engineering': ['Reasoning'], 'Reality Check': ['Reality'], 'Teaching': ['Definition', 'Confused'], 'Troubleshooting': ['Diagnostic', 'FAQ'] },
  'Information Type': { Types: ['Classification'], Classification: ['Types'], Options: ['Selection'], Cost: ['Price', 'Pricing'], Pricing: ['Cost', 'Price'], Images: ['Gallery'], Gallery: ['Images'], Inquiry: ['Enquiry'], Visual: ['Image', 'Photo', 'Picture'], Recommendation: ['Consultation', 'Advice'], Function: ['Scope', 'Purpose'], Reasoning: ['Explanation', 'Why'], Reality: ['Reality Check'], Diagnosis: ['Diagnostic', 'Symptom'] },
};

function matches(dim, actual, expected) {
  if (!expected || expected === '*derived*') return true;
  const a = actual.trim(), e = expected.trim();
  if (a.toLowerCase() === e.toLowerCase()) return true;
  const alts = (SYNONYMS[dim] && SYNONYMS[dim][a]) || [];
  if (alts.map((x) => x.toLowerCase()).includes(e.toLowerCase())) return true;
  if (e.includes('/') && e.split('/').map((x) => x.trim().toLowerCase()).includes(a.toLowerCase())) return true;
  return false;
}

function compareToExpected(routed, expected) {
  const per = { intent: false, subject: false, brain: false, domain: false, infoType: false, clarify: false };
  per.intent = matches('Intent', routed.intent.val, expected[1]);
  per.subject = matches('Subject', routed.subject.val, expected[2]);
  per.brain = matches('Brain', routed.brain.val, expected[3]);
  per.domain = matches('Domain', routed.domain.val, expected[4]);
  per.infoType = matches('Information Type', routed.infoType.val, expected[5]);
  const expectedClarify = (expected[6] || '').trim();
  per.clarify = (expectedClarify === 'Yes' && routed.clarify === 'Yes') || (expectedClarify === 'No' && routed.clarify !== 'Yes') || (expectedClarify === 'Maybe');
  const failCodes = [];
  if (!per.intent) failCodes.push('R001');
  if (!per.subject) failCodes.push('R002');
  if (!per.brain) failCodes.push('R003');
  if (!per.domain) failCodes.push('R004');
  if (!per.infoType) failCodes.push('R005');
  if (!per.clarify) failCodes.push('R006');
  return { failCodes, per };
}

function parseAllRowsFromSuite(mdPath, tableHeaderMustContain) {
  const raw = fs.readFileSync(mdPath, 'utf8');
  const lines = raw.split('\n');
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (!inTable) { if (line.startsWith('|') && tableHeaderMustContain.every((s) => line.includes(s))) { inTable = true; continue; } }
    else {
      if (!line.startsWith('|')) { inTable = false; continue; }
      if (line.startsWith('|---')) continue;
      const cells = line.split('|').map((c) => c.trim());
      cells.shift(); cells.pop();
      if (cells.length >= 7 && !cells[0].startsWith('*populated')) rows.push(cells);
    }
  }
  return rows;
}

const suiteRows = parseAllRowsFromSuite(SUITE, ['User Question', 'Expected Intent', 'Clarify']);
const derivedRows = parseAllRowsFromSuite(DERIVED, ['User Question', 'Expected Intent', 'Source Artefact']);
const allRows = [...suiteRows.map((r) => ({ src: 'suite', row: r })), ...derivedRows.map((r) => ({ src: 'derived', row: r }))];

const results = [];
const failureCodeCounts = { R001: 0, R002: 0, R003: 0, R004: 0, R005: 0, R006: 0, R007: 0, R008: 0 };
const perDim = { intent: 0, subject: 0, brain: 0, domain: 0, infoType: 0, clarify: 0 };
let passed = 0, failed = 0;
let stillPassed = 0, nowPassed = 0, nowFailed = 0, stillFailed = 0;
let homeownerMatches = 0;

for (const { src, row } of allRows) {
  const question = row[0];
  const v006 = routeV006(question);
  const v007 = routeV007(question);
  const cmpV006 = compareToExpected(v006, row);
  const cmpV007 = compareToExpected(v007, row);
  const passV006 = cmpV006.failCodes.length === 0;
  const passV007 = cmpV007.failCodes.length === 0;

  if (passV007) passed++; else failed++;
  if (v007.subject.matchedVia === 'homeowner') homeownerMatches++;
  cmpV007.failCodes.forEach((c) => { if (failureCodeCounts[c] !== undefined) failureCodeCounts[c]++; });
  for (const k of Object.keys(perDim)) if (cmpV007.per[k]) perDim[k]++;

  let regressionState;
  if (passV006 && passV007) { stillPassed++; regressionState = 'still-passed'; }
  else if (!passV006 && passV007) { nowPassed++; regressionState = 'improved'; }
  else if (passV006 && !passV007) { nowFailed++; regressionState = 'regressed'; }
  else { stillFailed++; regressionState = 'still-failed'; }

  results.push({ src, question, v006: { routed: v006, pass: passV006, failCodes: cmpV006.failCodes }, v007: { routed: v007, pass: passV007, failCodes: cmpV007.failCodes }, regressionState });
}

const total = allRows.length;
const passRateV007 = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';
const passRateV006 = total > 0 ? (results.filter((r) => r.v006.pass).length / total * 100).toFixed(1) : '0.0';
const netGain = nowPassed - nowFailed;
const perDimPct = Object.fromEntries(Object.entries(perDim).map(([k, v]) => [k, total > 0 ? (v / total * 100).toFixed(1) : '0.0']));

let topFailure = 'No failures';
if (failed > 0) {
  const topCode = Object.entries(failureCodeCounts).sort((a, b) => b[1] - a[1]).find(([, n]) => n > 0);
  const meanings = { R001: 'Wrong intent', R002: 'Wrong subject', R003: 'Wrong brain', R004: 'Wrong domain', R005: 'Wrong info type', R006: 'Missing clarify', R007: 'Wrong evidence', R008: 'Response contradicted evidence' };
  const exampleFailed = results.filter((r) => !r.v007.pass)[0]?.question || '';
  topFailure = topCode ? `${meanings[topCode[0]]} (${topCode[0]}) — ${topCode[1]} case${topCode[1] > 1 ? 's' : ''}${exampleFailed ? ` · e.g. "${exampleFailed}"` : ''}` : 'No failures';
}

const regressedRows = results.filter((r) => r.regressionState === 'regressed');
const improvedRows = results.filter((r) => r.regressionState === 'improved');

function renderTrace(question, routed, failCodes) {
  const c = (n) => n.toFixed(2);
  const dimFailed = (code) => failCodes.includes(code);
  const materialsLine = routed.subject.materials && routed.subject.materials.length ? `\nMaterial(s) (derived)\n✓ ${routed.subject.materials.join(', ')}\n` : '';
  const aliasLine = routed.subject.matchedAlias && routed.subject.matchedAlias !== routed.subject.val.toLowerCase() ? ` (via ${routed.subject.matchedVia === 'homeowner' ? 'homeowner term' : 'alias'} "${routed.subject.matchedAlias}")` : '';
  const isLow = routed.conf < CONFIDENCE_THRESHOLD;
  let trace = `\n\`\`\`\nUSER\n${question}\n\n──────────────────────────\n\n`;
  trace += `Intent\n${!dimFailed('R001') ? '✓' : '✗'} ${routed.intent.val} (${c(routed.intent.conf)})\n\n`;
  trace += `Subject\n${!dimFailed('R002') ? '✓' : '✗'} ${routed.subject.val}${aliasLine} (${c(routed.subject.conf)})${materialsLine}\n`;
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
generated_by: scripts/nex-router-build-007.mjs
classifier_type: pattern-based + Subject Intelligence (homeowner_terms) + Curiosity/Reality/Confused/Diagnostic
changes_from_0_06: |
  1. Subject Dictionary evolved into Subject INTELLIGENCE: each entry becomes { aliases: [...], homeowner_terms: [...] }.
  2. Homeowner terms adopted for 5 core subjects: Newel post · Handrail · Tread · Riser · String.
  3. Concept resolution: descriptive queries like "the big wooden post at the bottom" now match Newel post.
  4. Router normalise() searches BOTH aliases AND homeowner_terms · longest-match wins across both.
  5. Trace now shows whether Subject matched via 'alias' or 'homeowner term'.
  6. Learn intent extended to catch "the piece/part/bit/thing/side ..." patterns.
  Full Brain Evolution (Brain/Knowledge/Conversation + 12 regions + 7 thinking modules) preserved as v2 candidate · NOT built here.
regenerate: node scripts/nex-router-build-007.mjs
---

# NEX Router Build ${BUILD_ID} — Report

**Classifier:** pattern-based + Subject Intelligence with homeowner_terms

## Summary

| Metric | Value |
|---|---|
| Total questions tested | ${total} |
| Passed | **${passed}** |
| Failed | **${failed}** |
| Overall Pass Rate | **${passRateV007}%** |
| Build 0.06 baseline (against current Suite) | ${passRateV006}% |
| Delta | **${(parseFloat(passRateV007) - parseFloat(passRateV006)).toFixed(1) >= 0 ? '+' : ''}${(parseFloat(passRateV007) - parseFloat(passRateV006)).toFixed(1)}%** |
| Homeowner-term matches | **${homeownerMatches}** |

## Per-Dimension Accuracy

| Dimension | Accuracy |
|---|---|
| Brain | **${perDimPct.brain}%** |
| Clarify | **${perDimPct.clarify}%** |
| Intent | **${perDimPct.intent}%** |
| Domain | **${perDimPct.domain}%** |
| Information Type | **${perDimPct.infoType}%** |
| Subject | **${perDimPct.subject}%** |

## Regression Detection

| State | Count |
|---|---|
| Still Passed | ${stillPassed} |
| **Improved** | **+${nowPassed}** |
| **Regressed** | **-${nowFailed}** |
| Still Failed | ${stillFailed} |
| **Net Gain** | **${netGain >= 0 ? '+' : ''}${netGain}** |

${regressedRows.length > 0 ? `**Regressed:**\n${regressedRows.map((r) => `- \`${r.question}\` · v006 PASS → v007 FAIL:${r.v007.failCodes.join(',')}`).join('\n')}\n` : '**No regressions.**\n'}

${improvedRows.length > 0 ? `**Improved:**\n${improvedRows.map((r) => `- \`${r.question}\` · v006 FAIL:${r.v006.failCodes.join(',')} → v007 PASS`).join('\n')}\n` : ''}

## Failure Code Breakdown

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

${results.map((r, i) => `### Q${i + 1} · ${r.src} · ${r.v007.pass ? 'PASS' : 'FAIL:' + r.v007.failCodes.join(',')} · ${r.regressionState}\n${renderTrace(r.question, r.v007.routed, r.v007.failCodes)}`).join('\n')}
`;

fs.writeFileSync(OUT, report);
console.log(`\nRouter Build ${BUILD_ID} complete.`);
console.log(`Tested: ${total} · Passed ${passed} · Failed ${failed} · Overall ${passRateV007}%`);
console.log(`Baseline v0.06: ${passRateV006}%`);
console.log(`Per-dim: Subject ${perDimPct.subject}% · Intent ${perDimPct.intent}% · InfoType ${perDimPct.infoType}% · Domain ${perDimPct.domain}% · Brain ${perDimPct.brain}% · Clarify ${perDimPct.clarify}%`);
console.log(`Homeowner-term matches: ${homeownerMatches}`);
console.log(`Regression: Improved +${nowPassed} · Regressed -${nowFailed} · Net Gain ${netGain >= 0 ? '+' : ''}${netGain}`);
console.log(`Report: ${OUT}`);
