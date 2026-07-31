// TEMP · runtime activation audit script · replicates matchTerminology logic
// from src/lib/nex/brains/_terminology_serve.ts against 200+ questions.
// Delete after audit completes.

import fs from 'node:fs';
import path from 'node:path';

const p = path.join(process.cwd(), '.author-studio-drafts', 'staircase', 'terminology.json');
const raw = fs.readFileSync(p, 'utf8');
const j = JSON.parse(raw);
const module_data = j.payload;

// Reproduce _terminology_serve.ts logic EXACTLY
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordContains(haystack, needle) {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, 'i');
  return re.test(haystack);
}

function matchTerminology(mod, query) {
  const q = query.toLowerCase();
  const sorted = [...mod.terms].sort((a, b) => b.term.length - a.term.length);
  for (const term of sorted) {
    if (wordContains(q, term.term.toLowerCase())) {
      return { kind: 'canonical', term: term.term };
    }
  }
  for (const term of sorted) {
    for (const alias of term.aliases) {
      if (wordContains(q, alias.toLowerCase())) {
        return { kind: 'alias', term: term.term, matched_alias: alias };
      }
    }
  }
  return { kind: 'none' };
}

const questions = [
  // TERMINOLOGY (14)
  ['TERM', 'what is a rise'], ['TERM', 'what is a going'], ['TERM', 'what is a tread'],
  ['TERM', 'what is a riser'], ['TERM', 'what is a nosing'], ['TERM', 'what is a baluster'],
  ['TERM', 'what is a handrail'], ['TERM', 'what is a newel'], ['TERM', 'what is a landing'],
  ['TERM', 'what is a winder'], ['TERM', 'what is a string'], ['TERM', 'tell me about the banister'],
  ['TERM', 'my spindles'], ['TERM', 'the step at the top'],
  // TYPES (15)
  ['TYPES', 'staircase levels'], ['TYPES', 'curved staircase'], ['TYPES', 'sweeping staircase'],
  ['TYPES', 'helical staircase'], ['TYPES', 'what is a straight flight'], ['TYPES', 'level 4'],
  ['TYPES', 'complexity levels'], ['TYPES', 'why are curved stairs expensive'],
  ['TYPES', 'kite winder'], ['TYPES', 'bullnose feature start'], ['TYPES', 'architectural grand'],
  ['TYPES', 'quarter turn stairs'], ['TYPES', 'half turn'], ['TYPES', 'laminated bent handrail'],
  ['TYPES', 'elliptical staircase'],
  // MATERIALS (20)
  ['MAT', 'tell me about oak'], ['MAT', 'what are knots'], ['MAT', 'timber movement'],
  ['MAT', 'kiln drying'], ['MAT', 'moisture content'], ['MAT', 'component sizing'],
  ['MAT', 'tread thickness'], ['MAT', 'solid vs lamwood'], ['MAT', 'wood cupping'],
  ['MAT', 'timber bow'], ['MAT', 'plain sawn'], ['MAT', 'quarter sawn'],
  ['MAT', 'live knot vs dead knot'], ['MAT', 'clear grade'], ['MAT', 'character grade'],
  ['MAT', 'pine vs oak'], ['MAT', 'walnut for handrails'], ['MAT', 'will my staircase move'],
  ['MAT', 'why does timber shrink'], ['MAT', 'specification and value'],
  // COMPONENTS (15)
  ['COMP', 'tell me about handrails'], ['COMP', 'what about newels'], ['COMP', 'balusters'],
  ['COMP', 'glass panel system'], ['COMP', 'metal spindle system'], ['COMP', 'string cladding'],
  ['COMP', 'riser cover'], ['COMP', 'tread cover'], ['COMP', '100mm sphere rule'],
  ['COMP', 'baserail'], ['COMP', 'handrail bracket'], ['COMP', 'grooved handrail'],
  ['COMP', 'fascia apron panel'], ['COMP', 'dowel fixing'], ['COMP', 'concealed brackets'],
  // INSTALLATION (15)
  ['INST', 'installation method'], ['INST', 'site assembly'], ['INST', 'how are stairs removed'],
  ['INST', 'delivery in sections'], ['INST', 'curved staircase installation'],
  ['INST', 'newel installation'], ['INST', 'wedge sequence'], ['INST', 'dry fit before glue'],
  ['INST', 'clamping and cure time'], ['INST', 'walking on glued stairs'],
  ['INST', 'installer tools'], ['INST', 'strap tensioning'], ['INST', 'factory dry assembly'],
  ['INST', 'common installation mistakes'], ['INST', 'one way problem dismantling'],
  // DESIGN (12)
  ['DES', 'design coherence'], ['DES', 'feature staircase'], ['DES', 'architectural family'],
  ['DES', 'door style pairings'], ['DES', 'feature newel'], ['DES', 'curtail'],
  ['DES', 'open tread start'], ['DES', 'spend where the customer touches'],
  ['DES', 'design principles'], ['DES', 'staircase belongs to the house'],
  ['DES', 'landings as design features'], ['DES', 'proportions matter'],
  // FAQ (20)
  ['FAQ', 'biggest buying mistake'], ['FAQ', 'will my stairs squeak'],
  ['FAQ', 'can I paint my staircase'], ['FAQ', 'pet damage'], ['FAQ', 'high heels on stairs'],
  ['FAQ', 'cleaning my staircase'], ['FAQ', 'can I steam clean stairs'],
  ['FAQ', 'oak samples different from finished'], ['FAQ', 'how long should a staircase last'],
  ['FAQ', 'yearly maintenance check'], ['FAQ', 'LED lighting on stairs'],
  ['FAQ', 'carpet or exposed timber'], ['FAQ', 'matte or gloss finish'],
  ['FAQ', 'mix wood species'], ['FAQ', 'flooring before or after'],
  ['FAQ', 'how many installers'], ['FAQ', 'weather affects installation'],
  ['FAQ', 'what to photograph in a dispute'], ['FAQ', 'retention of title'],
  ['FAQ', 'doesnt fit means what'],
  // UNKNOWN (12)
  ['UNK', 'what size staircase do I need'], ['UNK', 'where can I buy stairparts'],
  ['UNK', 'should I buy oak'], ['UNK', 'can you recommend a staircase'],
  ['UNK', 'which company should I use'], ['UNK', 'best manufacturer'],
  ['UNK', 'recommend a good installer'], ['UNK', 'price of a curved staircase'],
  ['UNK', 'how much does it cost'], ['UNK', 'discount codes'],
  ['UNK', 'best staircase for me'], ['UNK', 'who should install my stairs'],
  // REGULATIONS (10)
  ['REG', 'maximum rise in the UK'], ['REG', 'UK compliance'], ['REG', 'building regulations'],
  ['REG', 'Approved Doc K'], ['REG', 'minimum going'], ['REG', 'handrail height regulation'],
  ['REG', 'maximum pitch UK'], ['REG', 'open riser regulations'],
  ['REG', 'commercial vs domestic regs'], ['REG', 'baluster spacing regulation'],
  // IMAGES (8)
  ['IMG', 'show me a staircase image'], ['IMG', 'show me a compliant staircase'],
  ['IMG', 'picture of oak stairs'], ['IMG', 'render a staircase'],
  ['IMG', 'show curved staircase examples'], ['IMG', 'photos of glass balustrade'],
  ['IMG', 'image of a spiral staircase'], ['IMG', 'stair drawings'],
  // MANUFACTURING (8)
  ['MFG', 'can this image be manufactured'], ['MFG', 'is this staircase safe'],
  ['MFG', 'manufacturing feasibility'], ['MFG', 'can you make this'],
  ['MFG', 'structural safety'], ['MFG', 'engineering assessment'],
  ['MFG', 'load calculation'], ['MFG', 'can this staircase carry weight'],
  // CERTAINTY OVERREACH (10)
  ['CERT', 'will timber never move'], ['CERT', 'definitely oak'], ['CERT', 'guaranteed no squeak'],
  ['CERT', 'staircase will last forever'], ['CERT', 'no timber will split'],
  ['CERT', 'always perfectly smooth'], ['CERT', 'will not crack ever'],
  ['CERT', 'never any movement'], ['CERT', 'completely stable'], ['CERT', 'absolutely no defects'],
  // LEGAL / INSURANCE (5)
  ['LEG', 'is my staircase legally compliant'], ['LEG', 'insurance covers stairs'],
  ['LEG', 'can I sue the manufacturer'], ['LEG', 'warranty period UK'],
  ['LEG', 'contract law for stair orders'],
  // CROSS-MODULE (10)
  ['XMOD', 'oak movement and installation'], ['XMOD', 'regulations for handrail height'],
  ['XMOD', 'which timber for feature newel'], ['XMOD', 'curved staircase materials'],
  ['XMOD', 'installation of glass panel'], ['XMOD', 'baluster spacing and design'],
  ['XMOD', 'tread thickness for large staircase'], ['XMOD', 'handrail design'],
  ['XMOD', 'moisture and installation timing'], ['XMOD', 'material for balusters'],
  // LANGUAGE VARIATIONS (12) - typos, informal, incomplete
  ['LANG', 'wat is a stair'], ['LANG', 'my stairs wobble'], ['LANG', 'stairtread'],
  ['LANG', 'the wood has cracks'], ['LANG', 'handrale'], ['LANG', 'ballister'],
  ['LANG', 'my nula'], ['LANG', 'stairs uneven'], ['LANG', 'something wrong with steps'],
  ['LANG', 'stair broke'], ['LANG', 'need help stairs'], ['LANG', 'stairs feel weird'],
  // MULTI-TERM (10)
  ['MULTI', 'handrail and baluster'], ['MULTI', 'newel post and tread'],
  ['MULTI', 'rise and going relationship'], ['MULTI', 'tread nosing profile'],
  ['MULTI', 'string and handrail'], ['MULTI', 'landing and winder'],
  ['MULTI', 'riser and rise difference'], ['MULTI', 'baluster on tread'],
  ['MULTI', 'handrail to newel'], ['MULTI', 'string tread riser'],
  // EMPTY / EDGE (5)
  ['EDGE', 'hi'], ['EDGE', 'hello'], ['EDGE', 'stairs'], ['EDGE', '?'], ['EDGE', 'staircase'],
];

let matchCount = 0, fallbackCount = 0;
const byCategory = {};

for (const [cat, q] of questions) {
  const result = matchTerminology(module_data, q);
  byCategory[cat] = byCategory[cat] || { match: 0, fallback: 0, total: 0, samples: [] };
  byCategory[cat].total++;
  if (result.kind === 'none') {
    fallbackCount++;
    byCategory[cat].fallback++;
  } else {
    matchCount++;
    byCategory[cat].match++;
  }
  if (byCategory[cat].samples.length < 3) {
    byCategory[cat].samples.push({
      q,
      outcome: result.kind === 'none' ? 'FALLBACK' : `MATCH_${result.kind.toUpperCase()}`,
      term: result.term || null
    });
  }
}

console.log('TOTAL QUESTIONS TESTED:', questions.length);
console.log('MATCH (Terminology answers):', matchCount);
console.log('FALLBACK (constitutional refusal):', fallbackCount);
console.log('');
console.log('BY CATEGORY:');
for (const [cat, stats] of Object.entries(byCategory)) {
  console.log(`  ${cat.padEnd(6)} total=${stats.total} match=${stats.match} fallback=${stats.fallback}`);
}
console.log('');
console.log('SAMPLES:');
for (const [cat, stats] of Object.entries(byCategory)) {
  for (const s of stats.samples) {
    console.log(`  [${cat}] "${s.q}" -> ${s.outcome}${s.term ? ' (' + s.term + ')' : ''}`);
  }
}
