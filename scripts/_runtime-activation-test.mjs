// Runtime activation test · mirrors the full composer flow after Path B.1 extension.
// Uses the SAME logic as _terminology_serve.ts + _module_serve.ts.

import fs from 'node:fs';
import path from 'node:path';

const DRAFTS = path.join(process.cwd(), '.author-studio-drafts', 'staircase');

// ─── Terminology ─────────────────────────────────────────────
const termJson = JSON.parse(fs.readFileSync(path.join(DRAFTS, 'terminology.json'), 'utf8'));
const terminology = termJson.payload;

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function wordContains(haystack, needle) {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, 'i');
  return re.test(haystack);
}
function matchTerminology(mod, query) {
  const q = query.toLowerCase();
  const sorted = [...mod.terms].sort((a, b) => b.term.length - a.term.length);
  for (const term of sorted) {
    if (wordContains(q, term.term.toLowerCase())) return { kind: 'canonical', term: term.term };
  }
  for (const term of sorted) {
    for (const alias of term.aliases) {
      if (wordContains(q, alias.toLowerCase())) return { kind: 'alias', term: term.term, matched_alias: alias };
    }
  }
  return { kind: 'none' };
}

// ─── Module serve ────────────────────────────────────────────
const MODULE_SLUGS = ['types', 'materials', 'components', 'installation', 'design', 'faq'];
const modules = {};
for (const slug of MODULE_SLUGS) {
  const p = path.join(DRAFTS, `${slug}.json`);
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  modules[slug] = j.payload;
}

const STOPWORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','must','shall',
  'i','you','he','she','it','we','they','me','him','her','us','them','my','your',
  'his','its','our','their','this','that','these','those','and','or','but','if',
  'then','when','where','what','which','who','whom','how','why','not','no','yes',
  'for','on','in','at','by','with','of','to','from','up','down','out','over','under',
  'some','any','all','each','every','most','many','much','more','less','few',
  'can','cannot','cant','dont','doesnt','isn\'t','isnt','aren\'t','arent',
  'about','tell','show','give','need','want','get','take','make','use','see','know',
  'please','help','just','also','only','really','very','too','so',
  's','t','d','ll','re','ve','m',
]);
function tokenize(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w));
}
function matchModule(mod, query, minScore = 2, limit = 3) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const querySet = new Set(queryTokens);
  const matches = [];
  for (const atom of mod.atoms) {
    const atomTokens = tokenize(atom.text);
    if (atomTokens.length === 0) continue;
    const atomSet = new Set(atomTokens);
    let score = 0;
    const matched = [];
    for (const q of querySet) {
      if (atomSet.has(q)) { score++; matched.push(q); }
    }
    if (atom.section) {
      const st = tokenize(atom.section);
      for (const s of st) {
        if (querySet.has(s) && !matched.includes(s)) { score += 0.5; matched.push(s); }
      }
    }
    if (score >= minScore) matches.push({ atom, score, matched });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}
function findBestModule(query) {
  let best = null;
  for (const slug of MODULE_SLUGS) {
    if (!modules[slug]) continue;
    const matches = matchModule(modules[slug], query, 2, 3);
    if (matches.length === 0) continue;
    const topScore = matches[0].score;
    if (!best || topScore > best.topScore) {
      best = { slug, title: modules[slug].header.title, matches, topScore };
    }
  }
  return best;
}

// ─── Boundary intent detection (mirrors _boundary_intent.ts) ─
const REFUSAL_PATTERNS = [
  { cat: 1, patterns: [
    /\b(regulations?|regulatory|compliance|compliant|approved\s+doc|approved\s+document)\b/i,
    /\b(building\s+reg|building\s+code|code\s+compliant)\b/i,
    /\b(maximum|minimum)\s+(rise|going|pitch|headroom|handrail\s+height)\b/i,
    /\b(is\s+.*\s+legal|legally\s+compliant)\b/i,
    /\bBS\s*\d+\b/i,
    /\bapproved\s+doc(?:ument)?\s+K\b/i,
  ]},
  { cat: 6, patterns: [
    /\b(which|what)\s+(staircase|manufacturer|installer|company|brand|product)\s+(should|do\s+i|to|is\s+best)\b/i,
    /\brecommend\s+(a|an|me|the|good|best)\b/i,
    /\bwho\s+should\s+i\s+(use|hire|choose|pick)\b/i,
    /\bbest\s+(manufacturer|installer|company|brand|supplier|staircase)\b/i,
    /\b(where|how)\s+(can|do)\s+i\s+buy\b/i,
    /\bdiscount\s+codes?\b/i,
  ]},
  { cat: 7, patterns: [
    /\bshow\s+(me|us)?\s*(a|an|the|some)?\b.*\b(images?|pictures?|photos?|renders?|drawings?|examples?)\b/i,
    /\b(pictures?|photos?|renders?|images?|drawings?)\s+of\b/i,
    /\bcan\s+(this|you)\s+.*\s+(image|photo|picture|render)\b/i,
    /\b(display|render|generate|show)\s+(a|an|the)?\s*(staircase|image)\b/i,
  ]},
  { cat: 2, patterns: [
    /\bcan\s+this\s+.*\s+be\s+manufactured\b/i,
    /\bis\s+this\s+.*\s+safe\s+to\s+(manufacture|install|build)\b/i,
    /\b(manufacturing|structural)\s+(safety|feasibility|assessment)\b/i,
    /\b(load|structural)\s+calculation\b/i,
    /\bengineering\s+assessment\b/i,
    /\bcan\s+this\s+(staircase|structure)\s+carry\b/i,
  ]},
  { cat: 15, patterns: [
    /\bwill\s+.*\s+(never|definitely\s+not)\s+(move|split|crack|squeak|break|fail)\b/i,
    /\b(never|definitely\s+no)\s+(any\s+)?(movement|squeak|split|crack|defect)\b/i,
    /\bguaranteed\s+(no|not)\b/i,
    /\b(will|would)\s+(never|definitely|always)\b/i,
    /\bcompletely\s+(stable|smooth|perfect)\b/i,
    /\babsolutely\s+no\b/i,
    /\bforever\b/i,
    /\bwill\s+not\s+(crack|split|move|break)\s+ever\b/i,
  ]},
  { cat: 4, patterns: [
    /\bcan\s+i\s+sue\b/i,
    /\bcontract\s+law\b/i,
    /\blegal\s+advice\b/i,
    /\b(warranty|guarantee)\s+period\b/i,
    /\b(consumer\s+rights|statutory\s+rights)\b/i,
  ]},
  { cat: 5, patterns: [
    /\binsurance\s+(covers?|policy|claim)\b/i,
    /\bcovered\s+by\s+insurance\b/i,
  ]},
];
function detectRefusalIntent(query) {
  for (const c of REFUSAL_PATTERNS) {
    for (const p of c.patterns) if (p.test(query)) return c.cat;
  }
  return null;
}

// ─── Full composer flow ──────────────────────────────────────
function respond(query) {
  const cat = detectRefusalIntent(query);
  if (cat !== null) return { outcome: 'BOUNDARY_REFUSAL', detail: `Cat${cat}` };
  const t = matchTerminology(terminology, query);
  if (t.kind !== 'none') return { outcome: 'TERMINOLOGY', detail: t.term };
  const m = findBestModule(query);
  if (m) return { outcome: 'MODULE', detail: `${m.slug}:${m.topScore}` };
  return { outcome: 'FALLBACK', detail: 'truthful refusal' };
}

// ─── 201-question test set (same as previous audit) ──────────
const questions = [
  ['TERM','what is a rise'],['TERM','what is a going'],['TERM','what is a tread'],
  ['TERM','what is a riser'],['TERM','what is a nosing'],['TERM','what is a baluster'],
  ['TERM','what is a handrail'],['TERM','what is a newel'],['TERM','what is a landing'],
  ['TERM','what is a winder'],['TERM','what is a string'],['TERM','tell me about the banister'],
  ['TERM','my spindles'],['TERM','the step at the top'],
  ['TYPES','staircase levels'],['TYPES','curved staircase'],['TYPES','sweeping staircase'],
  ['TYPES','helical staircase'],['TYPES','what is a straight flight'],['TYPES','level 4'],
  ['TYPES','complexity levels'],['TYPES','why are curved stairs expensive'],
  ['TYPES','kite winder'],['TYPES','bullnose feature start'],['TYPES','architectural grand'],
  ['TYPES','quarter turn stairs'],['TYPES','half turn'],['TYPES','laminated bent handrail'],
  ['TYPES','elliptical staircase'],
  ['MAT','tell me about oak'],['MAT','what are knots'],['MAT','timber movement'],
  ['MAT','kiln drying'],['MAT','moisture content'],['MAT','component sizing'],
  ['MAT','tread thickness'],['MAT','solid vs lamwood'],['MAT','wood cupping'],
  ['MAT','timber bow'],['MAT','plain sawn'],['MAT','quarter sawn'],
  ['MAT','live knot vs dead knot'],['MAT','clear grade'],['MAT','character grade'],
  ['MAT','pine vs oak'],['MAT','walnut for handrails'],['MAT','will my staircase move'],
  ['MAT','why does timber shrink'],['MAT','specification and value'],
  ['COMP','tell me about handrails'],['COMP','what about newels'],['COMP','balusters'],
  ['COMP','glass panel system'],['COMP','metal spindle system'],['COMP','string cladding'],
  ['COMP','riser cover'],['COMP','tread cover'],['COMP','100mm sphere rule'],
  ['COMP','baserail'],['COMP','handrail bracket'],['COMP','grooved handrail'],
  ['COMP','fascia apron panel'],['COMP','dowel fixing'],['COMP','concealed brackets'],
  ['INST','installation method'],['INST','site assembly'],['INST','how are stairs removed'],
  ['INST','delivery in sections'],['INST','curved staircase installation'],
  ['INST','newel installation'],['INST','wedge sequence'],['INST','dry fit before glue'],
  ['INST','clamping and cure time'],['INST','walking on glued stairs'],
  ['INST','installer tools'],['INST','strap tensioning'],['INST','factory dry assembly'],
  ['INST','common installation mistakes'],['INST','one way problem dismantling'],
  ['DES','design coherence'],['DES','feature staircase'],['DES','architectural family'],
  ['DES','door style pairings'],['DES','feature newel'],['DES','curtail'],
  ['DES','open tread start'],['DES','spend where the customer touches'],
  ['DES','design principles'],['DES','staircase belongs to the house'],
  ['DES','landings as design features'],['DES','proportions matter'],
  ['FAQ','biggest buying mistake'],['FAQ','will my stairs squeak'],
  ['FAQ','can I paint my staircase'],['FAQ','pet damage'],['FAQ','high heels on stairs'],
  ['FAQ','cleaning my staircase'],['FAQ','can I steam clean stairs'],
  ['FAQ','oak samples different from finished'],['FAQ','how long should a staircase last'],
  ['FAQ','yearly maintenance check'],['FAQ','LED lighting on stairs'],
  ['FAQ','carpet or exposed timber'],['FAQ','matte or gloss finish'],
  ['FAQ','mix wood species'],['FAQ','flooring before or after'],
  ['FAQ','how many installers'],['FAQ','weather affects installation'],
  ['FAQ','what to photograph in a dispute'],['FAQ','retention of title'],
  ['FAQ','doesnt fit means what'],
  ['UNK','what size staircase do I need'],['UNK','where can I buy stairparts'],
  ['UNK','should I buy oak'],['UNK','can you recommend a staircase'],
  ['UNK','which company should I use'],['UNK','best manufacturer'],
  ['UNK','recommend a good installer'],['UNK','price of a curved staircase'],
  ['UNK','how much does it cost'],['UNK','discount codes'],
  ['UNK','best staircase for me'],['UNK','who should install my stairs'],
  ['REG','maximum rise in the UK'],['REG','UK compliance'],['REG','building regulations'],
  ['REG','Approved Doc K'],['REG','minimum going'],['REG','handrail height regulation'],
  ['REG','maximum pitch UK'],['REG','open riser regulations'],
  ['REG','commercial vs domestic regs'],['REG','baluster spacing regulation'],
  ['IMG','show me a staircase image'],['IMG','show me a compliant staircase'],
  ['IMG','picture of oak stairs'],['IMG','render a staircase'],
  ['IMG','show curved staircase examples'],['IMG','photos of glass balustrade'],
  ['IMG','image of a spiral staircase'],['IMG','stair drawings'],
  ['MFG','can this image be manufactured'],['MFG','is this staircase safe'],
  ['MFG','manufacturing feasibility'],['MFG','can you make this'],
  ['MFG','structural safety'],['MFG','engineering assessment'],
  ['MFG','load calculation'],['MFG','can this staircase carry weight'],
  ['CERT','will timber never move'],['CERT','definitely oak'],['CERT','guaranteed no squeak'],
  ['CERT','staircase will last forever'],['CERT','no timber will split'],
  ['CERT','always perfectly smooth'],['CERT','will not crack ever'],
  ['CERT','never any movement'],['CERT','completely stable'],['CERT','absolutely no defects'],
  ['LEG','is my staircase legally compliant'],['LEG','insurance covers stairs'],
  ['LEG','can I sue the manufacturer'],['LEG','warranty period UK'],
  ['LEG','contract law for stair orders'],
  ['XMOD','oak movement and installation'],['XMOD','regulations for handrail height'],
  ['XMOD','which timber for feature newel'],['XMOD','curved staircase materials'],
  ['XMOD','installation of glass panel'],['XMOD','baluster spacing and design'],
  ['XMOD','tread thickness for large staircase'],['XMOD','handrail design'],
  ['XMOD','moisture and installation timing'],['XMOD','material for balusters'],
  ['LANG','wat is a stair'],['LANG','my stairs wobble'],['LANG','stairtread'],
  ['LANG','the wood has cracks'],['LANG','handrale'],['LANG','ballister'],
  ['LANG','my nula'],['LANG','stairs uneven'],['LANG','something wrong with steps'],
  ['LANG','stair broke'],['LANG','need help stairs'],['LANG','stairs feel weird'],
  ['MULTI','handrail and baluster'],['MULTI','newel post and tread'],
  ['MULTI','rise and going relationship'],['MULTI','tread nosing profile'],
  ['MULTI','string and handrail'],['MULTI','landing and winder'],
  ['MULTI','riser and rise difference'],['MULTI','baluster on tread'],
  ['MULTI','handrail to newel'],['MULTI','string tread riser'],
  ['EDGE','hi'],['EDGE','hello'],['EDGE','stairs'],['EDGE','?'],['EDGE','staircase'],
];

const outcomes = { TERMINOLOGY: 0, MODULE: 0, FALLBACK: 0, BOUNDARY_REFUSAL: 0 };
const byCategory = {};
const moduleHitCount = {};
const routingRisks = [];

for (const [cat, q] of questions) {
  const r = respond(q);
  outcomes[r.outcome]++;
  byCategory[cat] = byCategory[cat] || { total: 0, term: 0, module: 0, fallback: 0, boundary: 0, samples: [] };
  byCategory[cat].total++;
  if (r.outcome === 'TERMINOLOGY') byCategory[cat].term++;
  else if (r.outcome === 'MODULE') {
    byCategory[cat].module++;
    const slug = r.detail.split(':')[0];
    moduleHitCount[slug] = (moduleHitCount[slug] || 0) + 1;
  }
  else if (r.outcome === 'BOUNDARY_REFUSAL') byCategory[cat].boundary++;
  else byCategory[cat].fallback++;
  if (byCategory[cat].samples.length < 3) {
    byCategory[cat].samples.push({ q, outcome: r.outcome, detail: r.detail });
  }
  // Routing-risk detection: REG/CERT/MFG/IMG/LEG questions NOT refused
  if ((cat === 'REG' || cat === 'CERT' || cat === 'MFG' || cat === 'IMG' || cat === 'LEG') &&
      r.outcome !== 'FALLBACK' && r.outcome !== 'BOUNDARY_REFUSAL') {
    routingRisks.push({ cat, q, outcome: r.outcome, detail: r.detail });
  }
}

console.log('=== FULL RUNTIME FLOW · 201 questions ===');
console.log('BOUNDARY REFUSAL:    ', outcomes.BOUNDARY_REFUSAL);
console.log('TERMINOLOGY answered:', outcomes.TERMINOLOGY);
console.log('MODULE answered:     ', outcomes.MODULE);
console.log('FALLBACK (coverage): ', outcomes.FALLBACK);
console.log('TOTAL:               ', outcomes.BOUNDARY_REFUSAL + outcomes.TERMINOLOGY + outcomes.MODULE + outcomes.FALLBACK);
console.log('');
console.log('MODULE HIT COUNTS:');
for (const [slug, count] of Object.entries(moduleHitCount)) {
  console.log(`  ${slug.padEnd(14)} ${count}`);
}
console.log('');
console.log('BY CATEGORY:');
for (const [cat, s] of Object.entries(byCategory)) {
  console.log(`  ${cat.padEnd(6)} total=${s.total} boundary=${s.boundary} term=${s.term} module=${s.module} fallback=${s.fallback}`);
}
console.log('');
console.log('ROUTING RISKS (refusal-shape questions that got an answer):');
for (const r of routingRisks) {
  console.log(`  [${r.cat}] "${r.q}" -> ${r.outcome} (${r.detail})`);
}
