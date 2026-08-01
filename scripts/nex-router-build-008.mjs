#!/usr/bin/env node
// NEX Router Build 0.08 — Targeted defect fixes for 13 failing v0.07 rows.
//
// Diagnostic (Philip 2026-07-31 · engineering filter applied):
//   v0.07 failed 13 of 46 rows · dominated by R002 Wrong Subject (9) plus R001/R004/R005/R006 tail.
//   Categorised into 4 defect classes with 8 concrete fixes below.
//
// FIX A · Subject default when Intent implies staircase context (Q11, Q12, Q13):
//   When Subject=Unknown AND Intent ∈ {Buy, Quote, Browse, See} · default Subject to 'Staircase'.
//
// FIX B1 · Split Balustrade from Baluster (Q23):
//   Add 'Balustrade' as distinct Subject. Remove 'balustrade'/'balustrades' from Baluster aliases.
//
// FIX B2 · Compare-collapse to parent Subject (Q24):
//   When Intent=Compare AND matched Subject is a String variant (cut string · closed string) · use 'String'.
//
// FIX B3 · Learn-intent prefers primary Subject (Q28):
//   When Intent=Learn AND both 'Staircase' AND a sub-component match · use 'Staircase'.
//
// FIX B4 · Reclaimed timber homeowner_term (Q42):
//   Add 'my own timber' + 'supply my own timber' to Reclaimed timber homeowner_terms.
//
// FIX C1 · Scope-of-work Intent pattern (Q22):
//   Add 'is X included in Y' pattern → Learn intent · Function InfoType · BEFORE Quote/Pricing patterns.
//
// FIX C2 · Advise pattern for 'can my/I ... instead of' (Q43):
//   Add pattern → Advise intent · BEFORE Service intent pattern.
//
// FIX D · Buy Inquiry InfoType + Clarify threshold (Q9):
//   Add 'can (i|we) buy/order/get/purchase' → Inquiry InfoType · BEFORE Best Practice.
//   Extend Buy word-count clarify threshold from < 4 to <= 4.
//
// Regression detection vs Build 0.07 baseline. Per-dimension accuracy.
// IMPORTER DISCIPLINE: reads corpus only · idempotent.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '..', '..');
const SUITE = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'NEX-ROUTER-VALIDATION-SUITE-v1.md');
const DERIVED = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-validation-derived-entries-2026-07-31.md');
const OUT = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-build-008-report-2026-07-31.md');

const BUILD_ID = '0.08';
const CONFIDENCE_THRESHOLD = 0.65;

// ═════════════════════════════════════════════════════════════
// SUBJECT INTELLIGENCE DICTIONARY (Build 0.08 · Balustrade split)
// ═════════════════════════════════════════════════════════════

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

  // ★ FIX B1 · Baluster (spindle) split from Balustrade (whole guarding assembly)
  'Baluster':           { aliases: ['baluster', 'balusters', 'spindle', 'spindles', 'baluster spindle'], homeowner_terms: [] },
  'Balustrade':         { aliases: ['balustrade', 'balustrades'], homeowner_terms: [] },

  'Glass balustrade':   { aliases: ['glass balustrade', 'glass balustrades', 'glass panel', 'glass panels', 'frameless glass'], homeowner_terms: [] },
  'Cut string':         { aliases: ['cut string', 'cut-string', 'cut stringer'], homeowner_terms: [] },
  'Closed string':      { aliases: ['closed string', 'closed-string', 'closed stringer'], homeowner_terms: [] },

  // ★ FIX B4 · 'my own timber' homeowner_term for Reclaimed timber
  'Reclaimed timber':   {
    aliases: ['reclaimed timber', 'reclaimed wood', 'reclaimed beam', 'reclaimed beams'],
    homeowner_terms: ['my own timber', 'my own wood', 'supply my own timber', 'supply my own wood', 'bring my own timber'],
  },

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

// String-variant Subjects · used by FIX B2 for Compare-collapse
const STRING_VARIANTS = new Set(['Cut string', 'Closed string']);

// Sub-component Subjects · used by FIX B3 for Learn-intent hierarchy
const SUB_COMPONENT_SUBJECTS = new Set([
  'Newel post', 'Handrail', 'Tread', 'Riser', 'String', 'Baluster', 'Balustrade',
  'Glass balustrade', 'Cut string', 'Closed string', 'Newel cap', 'Landing',
]);

// v0.08 normalise: matches on aliases OR homeowner_terms · longest-match wins across both
// Now also tracks ALL matched Subject candidates WITH position for Compare-collapse and Learn-hierarchy rules.
function normaliseSubject(question) {
  const q = question.toLowerCase();
  let matchedSubject = null, matchedAlias = null, matchedAliasLen = 0, matchedVia = null, matchedPos = -1;
  const allMatches = [];
  for (const [canonical, entry] of Object.entries(SUBJECT_INTELLIGENCE)) {
    let subjectBest = 0, subjectEarliestPos = Infinity;
    for (const alias of entry.aliases) {
      const idx = q.indexOf(alias);
      if (idx !== -1) {
        if (alias.length > subjectBest) subjectBest = alias.length;
        if (idx < subjectEarliestPos) subjectEarliestPos = idx;
        if (alias.length > matchedAliasLen) { matchedSubject = canonical; matchedAlias = alias; matchedAliasLen = alias.length; matchedVia = 'alias'; matchedPos = idx; }
      }
    }
    for (const term of entry.homeowner_terms) {
      const idx = q.indexOf(term);
      if (idx !== -1) {
        if (term.length > subjectBest) subjectBest = term.length;
        if (idx < subjectEarliestPos) subjectEarliestPos = idx;
        if (term.length > matchedAliasLen) { matchedSubject = canonical; matchedAlias = term; matchedAliasLen = term.length; matchedVia = 'homeowner'; matchedPos = idx; }
      }
    }
    if (subjectBest > 0) allMatches.push({ subject: canonical, matchLen: subjectBest, earliestPos: subjectEarliestPos });
  }
  const materials = [];
  for (const [canonicalMat, aliases] of Object.entries(MATERIAL_DICTIONARY)) {
    for (const alias of aliases) { if (q.includes(alias) && !materials.includes(canonicalMat)) { materials.push(canonicalMat); break; } }
  }
  return {
    subject: matchedSubject || 'Unknown',
    matchedAlias,
    matchedVia,
    allMatches,
    material: materials[0] || null,
    materials,
    confidence: matchedSubject ? (matchedAliasLen >= 8 ? 0.92 : 0.85) : 0.30,
  };
}

// v0.07 baseline — regression comparison
function normaliseSubjectV007(question) {
  const q = question.toLowerCase();
  let matchedSubject = null, matchedAlias = null, matchedAliasLen = 0, matchedVia = null;
  const V007_DICT = {
    ...SUBJECT_INTELLIGENCE,
    // v0.07 had Baluster with balustrade aliases · Balustrade did not exist
    'Baluster':   { aliases: ['baluster', 'balusters', 'balustrade', 'balustrades', 'spindle', 'spindles', 'baluster spindle'], homeowner_terms: [] },
    'Balustrade': undefined,
    'Reclaimed timber': { aliases: ['reclaimed timber', 'reclaimed wood', 'reclaimed beam', 'reclaimed beams'], homeowner_terms: [] },
  };
  delete V007_DICT['Balustrade'];
  for (const [canonical, entry] of Object.entries(V007_DICT)) {
    if (!entry) continue;
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
  return { subject: matchedSubject || 'Unknown', matchedAlias, matchedVia, allMatches: [], material: materials[0] || null, materials, confidence: matchedSubject ? (matchedAliasLen >= 8 ? 0.92 : 0.85) : 0.30 };
}

// ═════════════════════════════════════════════════════════════
// INTENT + INFO TYPE PATTERNS (Build 0.08 · new patterns inserted at correct precedence)
// ═════════════════════════════════════════════════════════════

const INTENT_PATTERNS = [
  { pat: /\bi.?m confused\b|\bi don.?t (?:understand|get)\b|\bconfused about\b/i, val: 'Confused', conf: 0.92 },
  { pat: /\bmy (?:staircase|stairs|stair|newel|handrail|tread|riser) (?:squeaks?|creaks?|moves?|is loose|is cracked|has a gap|makes noise)\b|\bwhy is there (?:a gap|movement|noise|cracking)\b/i, val: 'Diagnostic', conf: 0.90 },
  { pat: /\bcan every (?:staircase|stair)\b|\bcan i (?:fit|install|build) (?:a )?(?:staircase|stairs) myself\b|\bcan (?:oak|wood|timber|glass) (?:never|always)\b/i, val: 'Reality', conf: 0.90 },
  { pat: /\bwhy (?:are|is|do|does|can.?t|should|would|has)\b|\bwhy .+ so (?:thick|large|small|expensive|important)\b|\bwhat makes .+ (?:comfortable|strong|safe)\b/i, val: 'Why', conf: 0.90 },
  { pat: /\bcan (?:i|we|you) (?:see|show)\b|\b(?:see|show me) (?:what|the|a|some)\b|\blooks? like\b|\bappearance of\b|\bpicture of\b|\bphotos? of\b|\bimages? of\b/i, val: 'See', conf: 0.94 },
  { pat: /\bwhich (?:type of )?(?:staircase|stairs) (?:can|will|would) fit\b|\bhelp (?:me|us) (?:find|choose)\b|\bcheapest but best\b|\brecommend (?:a|the best) (?:staircase|stairs)\b|\bbest (?:staircase|stairs) for (?:my|our)\b/i, val: 'Consult', conf: 0.92 },
  { pat: /\bcompare\b|\bvs\b|\bversus\b|\bdifference between\b|\bwhich is better\b|\b\w+ or \w+ (?:balustrades?|treads?|risers?|newels?|handrails?|stairs?|staircases?|strings?|balusters?|spindles?|caps?)\b|\bwhich .*(?:better|worse|stronger)/i, val: 'Compare', conf: 0.92 },
  // ★ FIX C1 · "is X included in the Y price/scope" is a scope-of-work Learn question · MUST precede Quote pattern
  { pat: /\bis (?:the )?[\w\s]+ included (?:in|with) (?:the )?[\w\s]+ (?:price|quote|cost|scope|package)\b|\bincluded in (?:the )?(?:price|quote|cost|scope|package)\b|\bpart of the (?:price|quote|cost|scope|package)\b/i, val: 'Learn', conf: 0.90 },
  // ★ FIX C2 · "can (my|I) ... instead of ..." is an Advise question · MUST precede Service pattern
  { pat: /\bcan (?:my|i|we) [\w\s]+ (?:instead of|rather than|in place of)\b/i, val: 'Advise', conf: 0.92 },
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
  // ★ FIX C1 · "is X included" · scope-of-work · Function InfoType · MUST precede Pricing
  { pat: /\bis (?:the )?[\w\s]+ included (?:in|with) (?:the )?[\w\s]+ (?:price|quote|cost|scope|package)\b|\bincluded in (?:the )?(?:price|quote|cost|scope|package)\b|\bpart of the (?:price|quote|cost|scope|package)\b/i, val: 'Function', conf: 0.90 },
  { pat: /\bhow much\b|\bprice\b|\bcost\b|\bpricing\b|\bquote\b/i, val: 'Pricing', conf: 0.95 },
  { pat: /\bshow me\b|\bimages?\b|\bphotos?\b|\bpictures?\b|\bgallery\b/i, val: 'Gallery', conf: 0.92 },
  { pat: /\bwhat size\b|\bsize\b|\bdimensions?\b|\bhow big\b|\bhow large\b|\bhow (?:wide|tall|deep|thick)\b|\bmm\b|\bwidth\b|\bheight\b/i, val: 'Dimensions', conf: 0.90 },
  { pat: /\bdifferent .*(?:types?|kinds?)\b|\bwhat type\b|\bwhat kind\b|\btypes? of\b|\bkinds? of\b|\bclassification\b/i, val: 'Classification', conf: 0.92 },
  { pat: /\bavailable\b|\boptions?\b|\bchoices?\b|\bwhich (?:woods?|materials?|colours?|species)\b|\bwhat (?:woods?|materials?|colours?|species)\b|\bwhat (?:options|styles) (?:have|in)\b/i, val: 'Options', conf: 0.88 },
  { pat: /\bincluded (?:in|with)\b|\bis (?:the )?.+ included\b|\bscope of (?:work|the price)\b/i, val: 'Function', conf: 0.80 },
  // ★ FIX D · "can I buy/order/get/purchase" → Inquiry · MUST precede Best Practice
  { pat: /\bcan (?:i|we) (?:buy|order|get|purchase)\b/i, val: 'Inquiry', conf: 0.90 },
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
  // ★ FIX C1 domain · Function InfoType with Learn intent → Scope of Work
  if (intent === 'Learn' && infoType === 'Function') return { val: 'Scope of Work', conf: 0.90 };
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

// ★ FIX D · Buy clarify threshold widened from < 4 to <= 4 (so 4-word "Can I buy stairs?" gets Yes)
function baseWordCountClarify(intent, wordCount, conf) {
  if (conf < CONFIDENCE_THRESHOLD) return 'Yes';
  if (intent === 'Buy' && wordCount <= 4) return 'Yes';
  if (intent === 'Buy') return 'Maybe';
  if (intent === 'Quote' && wordCount < 4) return 'Yes';
  if (intent === 'Quote') return 'Maybe';
  if (intent === 'Consult') return 'Yes';
  if (intent === 'Confused') return 'Yes';
  if (intent === 'Reality' && wordCount < 6) return 'Maybe';
  return 'No';
}

function routeCommon(question, subjNormFn, applyV008Rules) {
  const q = question.trim();
  const intentMatch = firstMatch(INTENT_PATTERNS, q);
  const infoMatch = firstMatch(INFO_TYPE_PATTERNS, q);
  const subjNorm = subjNormFn(q);
  const intent = intentMatch ? { val: intentMatch.val, conf: intentMatch.conf } : { val: 'Learn', conf: 0.45 };
  const infoType = infoMatch ? { val: infoMatch.val, conf: infoMatch.conf } : { val: 'Definition', conf: 0.50 };
  let subject = { val: subjNorm.subject, conf: subjNorm.confidence, matchedAlias: subjNorm.matchedAlias, matchedVia: subjNorm.matchedVia, material: subjNorm.material, materials: subjNorm.materials };

  if (applyV008Rules) {
    // ★ FIX A · Subject default when Intent implies staircase context
    if (subject.val === 'Unknown' && ['Buy', 'Quote', 'Browse', 'See'].includes(intent.val)) {
      subject = { val: 'Staircase', conf: 0.80, matchedAlias: null, matchedVia: 'intent-default', material: subject.material, materials: subject.materials };
    }
    // ★ FIX B2 · Compare-collapse String variants to parent 'String'
    if (intent.val === 'Compare' && STRING_VARIANTS.has(subject.val)) {
      const alsoMatched = (subjNorm.allMatches || []).find((m) => STRING_VARIANTS.has(m.subject) && m.subject !== subject.val);
      if (alsoMatched) {
        subject = { val: 'String', conf: 0.88, matchedAlias: null, matchedVia: 'compare-collapse', material: subject.material, materials: subject.materials };
      }
    }
    // ★ FIX B3 (position-aware) · Learn-intent prefers primary Staircase ONLY when Staircase
    // appears EARLIER in the question than the sub-component match. Prevents over-firing on
    // "The side of the staircase" (String's homeowner_term contains "staircase") and
    // "Is the landing balcony included in the staircase price?" (Landing is the topic; staircase is context).
    if (intent.val === 'Learn' && SUB_COMPONENT_SUBJECTS.has(subject.val)) {
      const staircaseMatch = (subjNorm.allMatches || []).find((m) => m.subject === 'Staircase');
      const subComponentMatch = (subjNorm.allMatches || []).find((m) => m.subject === subject.val);
      if (staircaseMatch && subComponentMatch && staircaseMatch.earliestPos < subComponentMatch.earliestPos) {
        subject = { val: 'Staircase', conf: 0.90, matchedAlias: null, matchedVia: 'learn-primary', material: subject.material, materials: subject.materials };
      }
    }
  }

  const brain = classifyBrain(subject.val);
  const domain = classifyDomain(intent.val, infoType.val, brain.val, subject.val);
  const conf = Math.pow(intent.conf * subject.conf * brain.conf * domain.conf * infoType.conf, 0.2);
  const wordCount = q.split(/\s+/).length;
  const clarify = baseWordCountClarify(intent.val, wordCount, conf);
  return { intent, subject, brain, domain, infoType, conf, clarify };
}

const routeV007 = (q) => routeCommon(q, normaliseSubjectV007, false);
const routeV008 = (q) => routeCommon(q, normaliseSubject, true);

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

for (const { src, row } of allRows) {
  const question = row[0];
  const v007 = routeV007(question);
  const v008 = routeV008(question);
  const cmpV007 = compareToExpected(v007, row);
  const cmpV008 = compareToExpected(v008, row);
  const passV007 = cmpV007.failCodes.length === 0;
  const passV008 = cmpV008.failCodes.length === 0;

  if (passV008) passed++; else failed++;
  cmpV008.failCodes.forEach((c) => { if (failureCodeCounts[c] !== undefined) failureCodeCounts[c]++; });
  for (const k of Object.keys(perDim)) if (cmpV008.per[k]) perDim[k]++;

  let regressionState;
  if (passV007 && passV008) { stillPassed++; regressionState = 'still-passed'; }
  else if (!passV007 && passV008) { nowPassed++; regressionState = 'improved'; }
  else if (passV007 && !passV008) { nowFailed++; regressionState = 'regressed'; }
  else { stillFailed++; regressionState = 'still-failed'; }

  results.push({ src, question, v007: { routed: v007, pass: passV007, failCodes: cmpV007.failCodes }, v008: { routed: v008, pass: passV008, failCodes: cmpV008.failCodes }, regressionState });
}

const total = allRows.length;
const passRateV008 = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';
const passRateV007 = total > 0 ? (results.filter((r) => r.v007.pass).length / total * 100).toFixed(1) : '0.0';
const netGain = nowPassed - nowFailed;
const perDimPct = Object.fromEntries(Object.entries(perDim).map(([k, v]) => [k, total > 0 ? (v / total * 100).toFixed(1) : '0.0']));

let topFailure = 'No failures';
if (failed > 0) {
  const topCode = Object.entries(failureCodeCounts).sort((a, b) => b[1] - a[1]).find(([, n]) => n > 0);
  const meanings = { R001: 'Wrong intent', R002: 'Wrong subject', R003: 'Wrong brain', R004: 'Wrong domain', R005: 'Wrong info type', R006: 'Missing clarify', R007: 'Wrong evidence', R008: 'Response contradicted evidence' };
  const exampleFailed = results.filter((r) => !r.v008.pass)[0]?.question || '';
  topFailure = topCode ? `${meanings[topCode[0]]} (${topCode[0]}) — ${topCode[1]} case${topCode[1] > 1 ? 's' : ''}${exampleFailed ? ` · e.g. "${exampleFailed}"` : ''}` : 'No failures';
}

const regressedRows = results.filter((r) => r.regressionState === 'regressed');
const improvedRows = results.filter((r) => r.regressionState === 'improved');

function renderTrace(question, routed, failCodes) {
  const c = (n) => n.toFixed(2);
  const dimFailed = (code) => failCodes.includes(code);
  const materialsLine = routed.subject.materials && routed.subject.materials.length ? `\nMaterial(s) (derived)\n✓ ${routed.subject.materials.join(', ')}\n` : '';
  const viaLine = routed.subject.matchedVia ? ` (via ${routed.subject.matchedVia}${routed.subject.matchedAlias ? ' "' + routed.subject.matchedAlias + '"' : ''})` : '';
  const isLow = routed.conf < CONFIDENCE_THRESHOLD;
  let trace = `\n\`\`\`\nUSER\n${question}\n\n──────────────────────────\n\n`;
  trace += `Intent\n${!dimFailed('R001') ? '✓' : '✗'} ${routed.intent.val} (${c(routed.intent.conf)})\n\n`;
  trace += `Subject\n${!dimFailed('R002') ? '✓' : '✗'} ${routed.subject.val}${viaLine} (${c(routed.subject.conf)})${materialsLine}\n`;
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
generated_by: scripts/nex-router-build-008.mjs
classifier_type: pattern-based + Subject Intelligence + Build-008 targeted defect fixes
changes_from_0_07: |
  Targeted engineering fixes for the 13 failing v0.07 rows · categorised into 4 defect classes:
    Fix A · Subject default when Intent implies staircase (fixes Q11 Q12 Q13)
    Fix B1 · Split Balustrade from Baluster subject (fixes Q23)
    Fix B2 · Compare-collapse String variants to parent (fixes Q24)
    Fix B3 · Learn-intent prefers primary Staircase (fixes Q28)
    Fix B4 · Reclaimed timber "my own timber" homeowner_term (fixes Q42)
    Fix C1 · Scope-of-work pattern before Quote/Pricing (fixes Q22)
    Fix C2 · Advise pattern for "instead of" before Service (fixes Q43)
    Fix D  · Buy Inquiry InfoType + clarify threshold <= 4 (fixes Q9)
regenerate: node scripts/nex-router-build-008.mjs
---

# NEX Router Build ${BUILD_ID} — Report

**Classifier:** pattern-based + Subject Intelligence + Build-008 targeted defect fixes

## Summary

| Metric | Value |
|---|---|
| Total questions tested | ${total} |
| Passed | **${passed}** |
| Failed | **${failed}** |
| Overall Pass Rate | **${passRateV008}%** |
| Build 0.07 baseline (against current Suite) | ${passRateV007}% |
| Delta | **${(parseFloat(passRateV008) - parseFloat(passRateV007)).toFixed(1) >= 0 ? '+' : ''}${(parseFloat(passRateV008) - parseFloat(passRateV007)).toFixed(1)}%** |

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

${regressedRows.length > 0 ? `**Regressed:**\n${regressedRows.map((r) => `- \`${r.question}\` · v007 PASS → v008 FAIL:${r.v008.failCodes.join(',')}`).join('\n')}\n` : '**No regressions.**\n'}

${improvedRows.length > 0 ? `**Improved:**\n${improvedRows.map((r) => `- \`${r.question}\` · v007 FAIL:${r.v007.failCodes.join(',')} → v008 PASS`).join('\n')}\n` : ''}

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

${results.map((r, i) => `### Q${i + 1} · ${r.src} · ${r.v008.pass ? 'PASS' : 'FAIL:' + r.v008.failCodes.join(',')} · ${r.regressionState}\n${renderTrace(r.question, r.v008.routed, r.v008.failCodes)}`).join('\n')}
`;

fs.writeFileSync(OUT, report);
console.log(`\nRouter Build ${BUILD_ID} complete.`);
console.log(`Tested: ${total} · Passed ${passed} · Failed ${failed} · Overall ${passRateV008}%`);
console.log(`Baseline v0.07: ${passRateV007}%`);
console.log(`Per-dim: Subject ${perDimPct.subject}% · Intent ${perDimPct.intent}% · InfoType ${perDimPct.infoType}% · Domain ${perDimPct.domain}% · Brain ${perDimPct.brain}% · Clarify ${perDimPct.clarify}%`);
console.log(`Regression: Improved +${nowPassed} · Regressed -${nowFailed} · Net Gain ${netGain >= 0 ? '+' : ''}${netGain}`);
console.log(`Report: ${OUT}`);
