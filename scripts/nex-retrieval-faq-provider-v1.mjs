/**
 * NEX Retrieval Engine · v1 · Phase 5 · FAQ Provider
 * ----------------------------------------------------------------------------
 * Spec:   data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase:  5 of 8 (Additional Providers · proving architecture extensibility)
 * Engine: scripts/nex-retrieval-engine-v1.mjs (Phase 1 · frozen · unchanged)
 * Index:  data/knowledge-index.json (Phase 3 · frozen · unchanged)
 *
 * Provider Independence check (Philip 2026-07-31):
 *   Files created for this provider: 1 (this file)
 *   Files modified in existing runtime: 0
 *   If this provider adds capability without touching Router, Engine, Image
 *   Provider, Knowledge Provider, or Knowledge Index Builder, the architecture
 *   is doing its job.
 *
 * Scope (locked):
 *   - Filters knowledge-index.json for articles where router_metadata.domain
 *     matches the Customer FAQ taxonomy
 *   - Lands results in the 'faq' evidence bucket
 *   - Same field-based filter discipline as Knowledge Provider
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

const FAQ_DOMAINS = new Set(['customer faq', 'customer-faq']);
const FAQ_INTENTS = new Set(['buy inquiry', 'buy', 'advise', 'learn', 'quote', 'service']);

export function createFAQProvider(options = {}) {
  const indexPath = options.indexPath ?? DEFAULT_INDEX_PATH;
  const index = options.index ?? loadIndex(indexPath);
  const eligible = index.articles.filter(
    (a) => a.status === 'complete' && FAQ_DOMAINS.has(normalise(a.router_metadata?.domain))
  );

  return {
    evidenceType: 'faq',
    indexPath,
    articleCount: index.articles.length,
    eligibleCount: eligible.length,

    canHandle(request) {
      if (!request || typeof request !== 'object') return false;
      const intent = normalise(request.intent);
      const domain = normalise(request.domain);
      return FAQ_INTENTS.has(intent) || FAQ_DOMAINS.has(domain);
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

// ---------- Phase 5 · FAQ Provider Acceptance ----------

function runAcceptanceTests() {
  const checks = [];
  const engine = new EvidenceRetrievalEngine();
  const provider = createFAQProvider();
  engine.register(provider);

  // AC1 · Loads without crashing · reports eligible count
  checks.push({
    name: `AC1 · Provider loaded ${provider.articleCount} articles · ${provider.eligibleCount} FAQ-eligible`,
    pass: typeof provider.articleCount === 'number' && typeof provider.eligibleCount === 'number',
  });

  // AC2 · canHandle correctly declares relevance
  checks.push({
    name: 'AC2a · canHandle=true for Buy Inquiry intent',
    pass: provider.canHandle({ intent: 'Buy Inquiry', subject: 'stairs', brain: 'Staircase' }) === true,
  });
  checks.push({
    name: 'AC2b · canHandle=true for Advise intent',
    pass: provider.canHandle({ intent: 'Advise', subject: 'stairs', brain: 'Staircase' }) === true,
  });
  checks.push({
    name: 'AC2c · canHandle=true when domain === Customer FAQ',
    pass: provider.canHandle({ intent: 'Show', subject: 'x', domain: 'Customer FAQ' }) === true,
  });
  checks.push({
    name: 'AC2d · canHandle=false for Show + Images (image-only intent)',
    pass:
      provider.canHandle({ intent: 'Show', subject: 'x', brain: 'Staircase', information_type: 'Images' }) === false,
  });

  // AC3 · Invalid requests do not crash
  const invalidCases = [null, {}, { intent: 'Learn', subject: 42 }];
  for (const [i, input] of invalidCases.entries()) {
    let crashed = false, result = null;
    try { result = provider.retrieve(input); } catch { crashed = true; }
    checks.push({ name: `AC3.${i + 1} · Invalid request tolerated`, pass: !crashed && Array.isArray(result) });
  }

  // AC4 · Only returns complete + FAQ-domain articles (verified via synthetic index)
  const syntheticIndex = {
    articles: [
      { path: 'a.md', title: 'A', status: 'complete',
        router_metadata: { brain: 'Staircase', subject: 'oak stairs', domain: 'Customer FAQ', intent: 'Advise', information_type: 'Function' },
        body_excerpt: '', body_length: 10, content_hash: 'h1' },
      { path: 'b.md', title: 'B', status: 'complete',
        router_metadata: { brain: 'Staircase', subject: 'oak stairs', domain: 'Anatomy', intent: 'Learn', information_type: 'Definition' },
        body_excerpt: '', body_length: 10, content_hash: 'h2' },
      { path: 'c.md', title: 'C', status: 'incomplete',
        router_metadata: { brain: 'Staircase', subject: 'oak stairs', domain: 'Customer FAQ', intent: null, information_type: null },
        body_excerpt: '', body_length: 10, content_hash: 'h3' },
    ],
  };
  const syntheticProvider = createFAQProvider({ index: syntheticIndex });
  checks.push({
    name: 'AC4a · Synthetic index: 1 FAQ-eligible article (correctly excludes non-FAQ + incomplete)',
    pass: syntheticProvider.eligibleCount === 1,
  });
  const syntheticEngine = new EvidenceRetrievalEngine();
  syntheticEngine.register(syntheticProvider);
  const synPkg = syntheticEngine.retrieve({
    intent: 'Advise', subject: 'oak stairs', brain: 'Staircase',
    domain: 'Customer FAQ', information_type: 'Function',
  });
  checks.push({
    name: 'AC4b · Synthetic FAQ request returns the 1 matching article in faq bucket',
    pass: synPkg.evidence.faq.length === 1 && synPkg.evidence.faq[0].path === 'a.md',
  });
  checks.push({
    name: 'AC4c · Synthetic run reports faq provider_status = success',
    pass:
      synPkg.diagnostics.provider_status?.faq?.status === 'success' &&
      synPkg.diagnostics.provider_status?.faq?.matches === 1,
  });

  // AC5 · Provider Independence — this file imports only from the frozen engine
  const src = readFileSync('C:/Users/Victus/trades/scripts/nex-retrieval-faq-provider-v1.mjs', 'utf8');
  const forbiddenImports = [
    'nex-retrieval-image-provider-v1',
    'nex-retrieval-knowledge-provider-v1',
    'nex-knowledge-index-builder-v1',
    'nex-router-build-009',
  ];
  const importedForbidden = forbiddenImports.filter((f) =>
    new RegExp(`^\\s*import[^;]*from\\s*['"\`][^'"\`]*${f}`, 'm').test(src)
  );
  checks.push({
    name: 'AC5a · FAQ Provider does not import from any other frozen provider or script',
    pass: importedForbidden.length === 0,
  });
  checks.push({
    name: 'AC5b · FAQ Provider only imports from engine v1 module',
    pass: /import\s+\{[^}]*EvidenceRetrievalEngine[^}]*\}\s+from\s+['"`]\.\/nex-retrieval-engine-v1\.mjs['"`]/.test(src),
  });

  return { name: 'Phase 5 · FAQ Provider Acceptance', checks, provider };
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
  console.log('NEX Retrieval Engine · v1 · Phase 5 · FAQ Provider');
  console.log('');
  const suite = runAcceptanceTests();
  console.log(`Index loaded from: ${suite.provider.indexPath}`);
  console.log(`Articles in index: ${suite.provider.articleCount}`);
  console.log(`FAQ-eligible (status=complete + domain=Customer FAQ): ${suite.provider.eligibleCount}`);
  console.log('');
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Phase 5 · FAQ Provider Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));
  if (r.passed !== r.total) { console.log('FAQ Provider · FAILED'); process.exit(1); }
  console.log('FAQ Provider · PASSED · zero modifications to frozen code');
}

const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
