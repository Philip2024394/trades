/**
 * NEX Retrieval Engine · v1 · Phase 5 · Workshop Principle Provider
 * ----------------------------------------------------------------------------
 * Spec:   data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase:  5 of 8 (Additional Providers · proving architecture extensibility)
 * Engine: scripts/nex-retrieval-engine-v1.mjs (Phase 1 · frozen · unchanged)
 * Index:  data/knowledge-index.json (Phase 3 · frozen · unchanged)
 *
 * Provider Independence check (Philip 2026-07-31):
 *   Files created: 1 (this file)
 *   Files modified in existing runtime: 0
 *
 * Scope (locked):
 *   - Filters knowledge-index.json for articles where router_metadata.domain
 *     matches the Best Practice / Workshop Principle taxonomy
 *   - Lands results in the 'workshopPrinciples' evidence bucket
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { EvidenceRetrievalEngine } from './nex-retrieval-engine-v1.mjs';

import path from 'node:path';
const DEFAULT_INDEX_PATH = path.resolve(process.cwd(), 'data', 'knowledge-index.json');

function normalise(str) {
  return String(str ?? '').toLowerCase().trim();
}
function tokenise(str) {
  return normalise(str).split(/[\s\-_/,]+/).filter((t) => t.length > 1);
}
function loadIndex(path) {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.articles)) {
    throw new Error(`Knowledge index at ${path} is missing an articles array`);
  }
  return parsed;
}

const PRINCIPLE_DOMAINS = new Set([
  'best practice',
  'best-practice',
  'workshop principle',
  'workshop-principle',
  'trade craft',
  'trade-craft',
]);
const PRINCIPLE_INTENTS = new Set(['learn', 'advise', 'troubleshoot', 'install']);
const PRINCIPLE_INFO_TYPES = new Set(['function', 'installation']);

export function createWorkshopPrincipleProvider(options = {}) {
  const indexPath = options.indexPath ?? DEFAULT_INDEX_PATH;
  const index = options.index ?? loadIndex(indexPath);
  const eligible = index.articles.filter(
    (a) => a.status === 'complete' && PRINCIPLE_DOMAINS.has(normalise(a.router_metadata?.domain))
  );

  return {
    evidenceType: 'workshopPrinciples',
    indexPath,
    articleCount: index.articles.length,
    eligibleCount: eligible.length,

    canHandle(request) {
      if (!request || typeof request !== 'object') return false;
      const intent = normalise(request.intent);
      const infoType = normalise(request.information_type);
      const domain = normalise(request.domain);
      return PRINCIPLE_INTENTS.has(intent) || PRINCIPLE_INFO_TYPES.has(infoType) || PRINCIPLE_DOMAINS.has(domain);
    },

    retrieve(request) {
      if (!request || typeof request !== 'object') return [];
      const reqBrain = normalise(request.brain);
      const reqIntent = normalise(request.intent);
      const reqInfoType = normalise(request.information_type);
      const subjectTokens = new Set(tokenise(request.subject));

      const results = [];
      for (const article of eligible) {
        const m = article.router_metadata;
        if (reqBrain && normalise(m.brain) !== reqBrain) continue;
        if (reqIntent && normalise(m.intent) !== reqIntent) continue;
        if (reqInfoType && normalise(m.information_type) !== reqInfoType) continue;

        let matchScore = 0;
        if (subjectTokens.size > 0) {
          const articleSubjectTokens = tokenise(m.subject);
          for (const t of articleSubjectTokens) if (subjectTokens.has(t)) matchScore += 1;
          if (matchScore === 0) continue;
        }

        results.push({
          path: article.path,
          title: article.title,
          router_metadata: m,
          body_excerpt: article.body_excerpt,
          body_length: article.body_length,
          content_hash: article.content_hash,
          match_score: matchScore,
        });
      }
      results.sort((a, b) => b.match_score - a.match_score);
      return results;
    },
  };
}

// ---------- Phase 5 · Workshop Principle Provider Acceptance ----------

function runAcceptanceTests() {
  const checks = [];
  const engine = new EvidenceRetrievalEngine();
  const provider = createWorkshopPrincipleProvider();
  engine.register(provider);

  checks.push({
    name: `AC1 · Provider loaded ${provider.articleCount} articles · ${provider.eligibleCount} principle-eligible`,
    pass: typeof provider.articleCount === 'number' && typeof provider.eligibleCount === 'number',
  });

  checks.push({
    name: 'AC2a · canHandle=true for Advise intent',
    pass: provider.canHandle({ intent: 'Advise', subject: 'x' }) === true,
  });
  checks.push({
    name: 'AC2b · canHandle=true for Troubleshoot intent',
    pass: provider.canHandle({ intent: 'Troubleshoot', subject: 'x' }) === true,
  });
  checks.push({
    name: 'AC2c · canHandle=true when domain === Best Practice',
    pass: provider.canHandle({ intent: 'Show', subject: 'x', domain: 'Best Practice' }) === true,
  });
  checks.push({
    name: 'AC2d · canHandle=false for Show + Images',
    pass: provider.canHandle({ intent: 'Show', subject: 'x', information_type: 'Images' }) === false,
  });

  for (const [i, input] of [null, {}, { intent: 'Learn', subject: 42 }].entries()) {
    let crashed = false, result = null;
    try { result = provider.retrieve(input); } catch { crashed = true; }
    checks.push({ name: `AC3.${i + 1} · Invalid request tolerated`, pass: !crashed && Array.isArray(result) });
  }

  // AC4 · Synthetic index verifies filter correctness
  const syntheticIndex = {
    articles: [
      { path: 'wedge.md', title: 'Stopped Wedge', status: 'complete',
        router_metadata: { brain: 'Staircase', subject: 'stopped wedge', domain: 'Best Practice', intent: 'Advise', information_type: 'Installation' },
        body_excerpt: '', body_length: 10, content_hash: 'h1' },
      { path: 'faq.md', title: 'FAQ', status: 'complete',
        router_metadata: { brain: 'Staircase', subject: 'oak', domain: 'Customer FAQ', intent: 'Advise', information_type: 'Function' },
        body_excerpt: '', body_length: 10, content_hash: 'h2' },
      { path: 'inc.md', title: 'inc', status: 'incomplete',
        router_metadata: { brain: 'Staircase', subject: 'x', domain: 'Best Practice', intent: null, information_type: null },
        body_excerpt: '', body_length: 10, content_hash: 'h3' },
    ],
  };
  const syntheticProvider = createWorkshopPrincipleProvider({ index: syntheticIndex });
  checks.push({
    name: 'AC4a · Synthetic index: 1 principle-eligible article (excludes non-BP + incomplete)',
    pass: syntheticProvider.eligibleCount === 1,
  });
  const syntheticEngine = new EvidenceRetrievalEngine();
  syntheticEngine.register(syntheticProvider);
  const synPkg = syntheticEngine.retrieve({
    intent: 'Advise', subject: 'stopped wedge', brain: 'Staircase',
    domain: 'Best Practice', information_type: 'Installation',
  });
  checks.push({
    name: 'AC4b · Synthetic principle request returns the matching article in workshopPrinciples bucket',
    pass: synPkg.evidence.workshopPrinciples.length === 1 && synPkg.evidence.workshopPrinciples[0].path === 'wedge.md',
  });
  checks.push({
    name: 'AC4c · Synthetic run reports workshopPrinciples provider_status = success · matches=1',
    pass:
      synPkg.diagnostics.provider_status?.workshopPrinciples?.status === 'success' &&
      synPkg.diagnostics.provider_status?.workshopPrinciples?.matches === 1,
  });

  // AC5 · Provider Independence
  const src = readFileSync('C:/Users/Victus/trades/scripts/nex-retrieval-workshopprinciple-provider-v1.mjs', 'utf8');
  const forbidden = [
    'nex-retrieval-image-provider-v1',
    'nex-retrieval-knowledge-provider-v1',
    'nex-retrieval-faq-provider-v1',
    'nex-retrieval-typeprofile-provider-v1',
    'nex-knowledge-index-builder-v1',
    'nex-router-build-009',
  ];
  const importedForbidden = forbidden.filter((f) =>
    new RegExp(`^\\s*import[^;]*from\\s*['"\`][^'"\`]*${f}`, 'm').test(src)
  );
  checks.push({
    name: 'AC5a · Workshop Principle Provider does not import from any other provider or script',
    pass: importedForbidden.length === 0,
  });
  checks.push({
    name: 'AC5b · Workshop Principle Provider only imports from engine v1 module',
    pass: /import\s+\{[^}]*EvidenceRetrievalEngine[^}]*\}\s+from\s+['"`]\.\/nex-retrieval-engine-v1\.mjs['"`]/.test(src),
  });

  return { name: 'Phase 5 · Workshop Principle Provider Acceptance', checks, provider };
}

function report(suite) {
  const total = suite.checks.length;
  const passed = suite.checks.filter((c) => c.pass).length;
  const line = '-'.repeat(78);
  console.log(line);
  console.log(`${suite.name} · ${passed}/${total}`);
  console.log(line);
  for (const c of suite.checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}`);
  return { passed, total };
}

function main() {
  console.log('NEX Retrieval Engine · v1 · Phase 5 · Workshop Principle Provider');
  console.log('');
  const suite = runAcceptanceTests();
  console.log(`Index loaded from: ${suite.provider.indexPath}`);
  console.log(`Articles in index: ${suite.provider.articleCount}`);
  console.log(`Workshop-Principle eligible (status=complete + domain=Best Practice/Workshop Principle): ${suite.provider.eligibleCount}`);
  console.log('');
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Phase 5 · Workshop Principle Provider Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));
  if (r.passed !== r.total) { console.log('Workshop Principle Provider · FAILED'); process.exit(1); }
  console.log('Workshop Principle Provider · PASSED · zero modifications to frozen code');
}

const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
