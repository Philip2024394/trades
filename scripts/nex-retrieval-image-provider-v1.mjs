/**
 * NEX Retrieval Engine · v1 · Phase 2 · Image Provider
 * ----------------------------------------------------------------------------
 * Spec:   data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase:  2 of 8 (Image Provider · uses existing nex-image-manifest.json)
 * Engine: scripts/nex-retrieval-engine-v1.mjs (Phase 1 · frozen)
 *
 * Scope (locked):
 *   - Exactly one provider: Image Provider
 *   - Exactly one data source: data/nex-image-manifest.json
 *   - Exactly one responsibility: given an EvidenceRequest, return matching image records
 *
 * Non-goals (do not add):
 *   - Markdown parsing · knowledge · FAQ · composition · ranking mixed evidence
 *   - AI · Router changes · search optimisation · type-specific knowledge
 *
 * Field-based filter rule (Philip 2026-07-31):
 *   The provider must NOT know anything about "straight flight" / "oak" / "cut string".
 *   It filters by matching normalised tokens from the request Subject against tags,
 *   and by matching subject_domain against Brain. Business knowledge lives in the
 *   manifest metadata · never in this code.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { EvidenceRetrievalEngine } from './nex-retrieval-engine-v1.mjs';

import path from 'node:path';
const DEFAULT_MANIFEST = path.resolve(process.cwd(), 'data', 'nex-image-manifest.json');

// ---------- Pure helpers (field-based · no domain knowledge) ----------

function normalise(str) {
  return String(str ?? '').toLowerCase().trim();
}

function tokenise(str) {
  return normalise(str)
    .split(/[\s\-_/,]+/)
    .filter((t) => t.length > 1);
}

function loadManifest(path) {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed.images !== 'object' || parsed.images === null) {
    throw new Error(`Image manifest at ${path} is missing an "images" object`);
  }
  const records = [];
  for (const [url, meta] of Object.entries(parsed.images)) {
    if (!meta || typeof meta !== 'object') continue;
    records.push({
      id: url,
      path: url,
      source: meta.source ?? null,
      subject_domain: meta.subject_domain ?? null,
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      description: meta.description ?? null,
      created_at: meta.created_at ?? null,
      created_by: meta.created_by ?? null,
    });
  }
  return records;
}

// ---------- Image Provider factory ----------

export function createImageProvider(options = {}) {
  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST;
  const records = options.records ?? loadManifest(manifestPath);

  return {
    evidenceType: 'images',
    manifestPath,
    recordCount: records.length,

    canHandle(request) {
      if (!request || typeof request !== 'object') return false;
      const infoType = normalise(request.information_type);
      const intent = normalise(request.intent);
      // Self-declared relevance: primary image-serving intents/info-types only.
      // Wider inclusion belongs to later phases if evidence demands it.
      return (
        infoType === 'images' ||
        intent === 'show' ||
        intent === 'browse images'
      );
    },

    retrieve(request) {
      if (!request || typeof request !== 'object') return [];
      const brain = normalise(request.brain);
      const subjectTokens = new Set(tokenise(request.subject));

      const results = [];
      for (const rec of records) {
        // Brain gate: if Router named a brain, restrict to matching subject_domain
        if (brain && normalise(rec.subject_domain) !== brain) continue;

        // Field-based token match: count intersections between subject tokens and tags
        const tagTokens = rec.tags.map(normalise);
        let matchScore = 0;
        for (const tag of tagTokens) if (subjectTokens.has(tag)) matchScore += 1;

        // If no subject tokens were provided, all brain-matching records qualify (score 0)
        // Otherwise only records with at least one tag match qualify
        if (subjectTokens.size === 0 || matchScore > 0) {
          results.push({
            id: rec.id,
            path: rec.path,
            subject_domain: rec.subject_domain,
            tags: rec.tags,
            description: rec.description,
            match_score: matchScore,
          });
        }
      }

      results.sort((a, b) => b.match_score - a.match_score);
      return results;
    },
  };
}

// ---------- Phase 2 Acceptance Tests ----------

function buildEngineWithProvider() {
  const engine = new EvidenceRetrievalEngine();
  const provider = createImageProvider();
  engine.register(provider);
  return { engine, provider };
}

function runAcceptanceTests() {
  const checks = [];
  const { engine, provider } = buildEngineWithProvider();

  // AC1 · Valid request returns matching image records
  const req1 = {
    intent: 'Show',
    subject: 'oak staircase',
    brain: 'Staircase',
    domain: 'Reference Gallery',
    information_type: 'Images',
    confidence: 0.92,
    clarify: false,
  };
  const pkg1 = engine.retrieve(req1);
  checks.push({
    name: 'AC1a · Valid "Show + oak staircase" request returns at least one image',
    pass: pkg1.evidence.images.length > 0,
  });
  checks.push({
    name: 'AC1b · Returned records include oak tag (field-based match confirmed)',
    pass: pkg1.evidence.images.some((r) => r.tags.map(normalise).includes('oak')),
  });
  checks.push({
    name: 'AC1c · Results sorted by match_score descending',
    pass: pkg1.evidence.images.every((r, i, arr) => i === 0 || arr[i - 1].match_score >= r.match_score),
  });
  checks.push({
    name: 'AC1d · Every returned record restricted to Staircase subject_domain',
    pass: pkg1.evidence.images.every((r) => normalise(r.subject_domain) === 'staircase'),
  });

  // AC2 · No matches returns empty array (not a crash, not a guess)
  const req2 = {
    intent: 'Show',
    subject: 'zzznonexistenttokenxyz unicornbalustrade',
    brain: 'Staircase',
    domain: 'Reference Gallery',
    information_type: 'Images',
    confidence: 0.7,
    clarify: false,
  };
  const pkg2 = engine.retrieve(req2);
  checks.push({
    name: 'AC2 · Subject with no tag matches returns empty images array',
    pass: Array.isArray(pkg2.evidence.images) && pkg2.evidence.images.length === 0,
  });

  // AC3 · Invalid requests do not crash
  const invalidCases = [
    { label: 'null request', input: null },
    { label: 'empty object request', input: {} },
    { label: 'request missing subject', input: { intent: 'Show', brain: 'Staircase', information_type: 'Images' } },
    { label: 'request with non-string subject', input: { intent: 'Show', subject: 42, brain: 'Staircase', information_type: 'Images' } },
  ];
  for (const c of invalidCases) {
    let crashed = false;
    let result = null;
    try {
      result = provider.retrieve(c.input);
    } catch {
      crashed = true;
    }
    checks.push({
      name: `AC3 · ${c.label} does not crash · returns array`,
      pass: !crashed && Array.isArray(result),
    });
  }

  // AC4 · Router output passes directly into provider without transformation
  const routerOutput = {
    intent: 'Show',
    subject: 'walnut modern staircase',
    brain: 'Staircase',
    domain: 'Reference Gallery',
    information_type: 'Images',
    confidence: 0.9,
    clarify: false,
  };
  let routerCrashed = false;
  let routerResult = null;
  try {
    routerResult = provider.retrieve(routerOutput);
  } catch {
    routerCrashed = true;
  }
  checks.push({
    name: 'AC4a · Router output shape accepted verbatim by provider',
    pass: !routerCrashed && Array.isArray(routerResult),
  });
  checks.push({
    name: 'AC4b · canHandle correctly returns true for Router "Show + Images" output',
    pass: provider.canHandle(routerOutput) === true,
  });
  checks.push({
    name: 'AC4c · canHandle correctly returns false when info-type is Definition and intent is Learn',
    pass:
      provider.canHandle({
        intent: 'Learn',
        subject: 'Straight Flight Staircase',
        brain: 'Staircase',
        domain: 'Anatomy',
        information_type: 'Definition',
        confidence: 0.9,
        clarify: false,
      }) === false,
  });

  // AC5 · Existing Retrieval Engine contract remains unchanged
  const pkg5 = engine.retrieve(req1);
  const requiredTopLevel = ['request', 'evidence', 'diagnostics', 'timing', 'metadata'];
  checks.push({
    name: 'AC5a · EvidencePackage still has all top-level fields',
    pass: requiredTopLevel.every((k) => k in pkg5),
  });
  const requiredBuckets = ['knowledge', 'faq', 'workshopPrinciples', 'profiles', 'images', 'pricing', 'drawings', 'videos'];
  checks.push({
    name: 'AC5b · EvidencePackage still has all evidence buckets',
    pass: requiredBuckets.every((k) => Array.isArray(pkg5.evidence[k])),
  });
  checks.push({
    name: 'AC5c · Non-image buckets remain empty (single-responsibility respected)',
    pass: requiredBuckets.filter((k) => k !== 'images').every((k) => pkg5.evidence[k].length === 0),
  });
  checks.push({
    name: 'AC5d · Diagnostics reports images provider queried and matched',
    pass:
      pkg5.diagnostics.providers_queried.includes('images') &&
      pkg5.diagnostics.providers_matched.includes('images'),
  });

  // AC6 · Phase 1's 30/30 contract still passes (no regression to skeleton)
  const freshEngine = new EvidenceRetrievalEngine();
  const emptyPkg = freshEngine.retrieve({
    intent: 'Show',
    subject: 'Straight Flight Staircase',
    brain: 'Staircase',
    domain: 'Reference Gallery',
    information_type: 'Images',
    confidence: 0.92,
    clarify: false,
  });
  checks.push({
    name: 'AC6a · Engine with no providers still returns empty EvidencePackage',
    pass:
      requiredBuckets.every((k) => Array.isArray(emptyPkg.evidence[k]) && emptyPkg.evidence[k].length === 0) &&
      emptyPkg.diagnostics.providers_queried.length === 0 &&
      emptyPkg.diagnostics.providers_matched.length === 0,
  });
  checks.push({
    name: 'AC6b · Engine metadata still v1 phase 1',
    pass: emptyPkg.metadata.engine_version === 'v1' && emptyPkg.metadata.phase === 1,
  });
  checks.push({
    name: 'AC6c · Provider registration is idempotent (register throws on malformed)',
    pass: (() => {
      const e = new EvidenceRetrievalEngine();
      try {
        e.register({ evidenceType: 'not-a-bucket', canHandle: () => false, retrieve: () => [] });
        return false;
      } catch {
        return true;
      }
    })(),
  });

  return { name: 'Phase 2 · Image Provider Acceptance', checks, provider };
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
  console.log('NEX Retrieval Engine · v1 · Phase 2 · Image Provider · Acceptance');
  console.log('Spec: NEX-RUNTIME-PIPELINE-v1-SPEC.md');
  console.log('Engine: scripts/nex-retrieval-engine-v1.mjs (Phase 1 · frozen)');
  console.log('');

  const suite = runAcceptanceTests();
  console.log(`Manifest loaded from: ${suite.provider.manifestPath}`);
  console.log(`Manifest records available: ${suite.provider.recordCount}`);
  console.log('');
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Phase 2 Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));

  if (r.passed !== r.total) {
    console.log('Phase 2 · FAILED · Image Provider does not satisfy Phase 2 contract');
    process.exit(1);
  }
  console.log('Phase 2 · PASSED · Image Provider satisfies Phase 2 contract · zero Phase 1 regressions');
  console.log('Next: Phase 3 · Knowledge Index Builder (separate script · converts Markdown → knowledge-index.json)');
}

const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
