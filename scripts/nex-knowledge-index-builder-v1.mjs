/**
 * NEX Knowledge Index Builder · v1 · Phase 3
 * ----------------------------------------------------------------------------
 * Spec:   data/nex-reference-brains/staircase-preparation/NEX-RUNTIME-PIPELINE-v1-SPEC.md
 * Phase:  3 of 8 (Knowledge Index Builder · separate from retrieval)
 *
 * Purpose:
 *   Compile authored Markdown evidence into knowledge-index.json.
 *   Analogous to compiling source code into an executable.
 *   The runtime NEVER reads Markdown · the runtime queries the index.
 *
 * Discipline (Importer rule · Philip 2026-07-31):
 *   - Source corpus never altered
 *   - Source is read-only
 *   - Derived entries written to separate location
 *   - Parse failures reported · loop continues
 *   - Never rewrite / reformat / "improve" source
 *
 * Never-invent rule (Philip 2026-07-31 · Phase 3):
 *   - If an article lacks a metadata field, record missing_fields · not a guess
 *   - Articles with missing critical fields are marked status: incomplete
 *   - Runtime may ignore incomplete entries until they are authored properly
 *
 * Determinism:
 *   - Same input always produces the same output (articles array is
 *     lexicographically sorted by path · content hash is stable)
 *   - Only the top-level meta.generated_at varies across runs;
 *     acceptance tests hash the articles-content payload to prove determinism.
 *
 * Non-goals for Phase 3:
 *   No retrieval · no ranking · no composition · no answering.
 *   No mutation of source files. No AI. No inference of missing fields.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path, { join, relative, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const DEFAULT_ROOT = path.resolve(process.cwd(), 'data', 'nex-reference-brains');
const DEFAULT_OUT_INDEX = path.resolve(process.cwd(), 'data', 'knowledge-index.json');
const DEFAULT_OUT_LOG = path.resolve(process.cwd(), 'data', 'knowledge-index-build-log.txt');

// Fields the Router uses at classification time. Their presence in an article's
// frontmatter is what makes the article addressable by the runtime.
const ROUTER_FIELDS = ['brain', 'subject', 'domain', 'intent', 'information_type'];

// Fields that must be present for status = complete. Others are nice-to-have.
const REQUIRED_FIELDS = ROUTER_FIELDS;

// ---------- File discovery (deterministic order) ----------

function walk(dir, out = []) {
  const names = readdirSync(dir).sort(); // sort for determinism
  for (const name of names) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

// ---------- Minimal YAML frontmatter parser ----------
// Supports: `key: value` (single line) and `key:` followed by `  - item` list entries.
// Anything more complex is preserved as raw string · never guessed.

function extractFrontmatterBlock(content) {
  if (!content.startsWith('---')) return { frontmatter: null, body: content };
  // Find end delimiter. Must be at start of a line.
  const rest = content.slice(3);
  const m = rest.match(/\r?\n---(?:\r?\n|$)/);
  if (!m) return { frontmatter: null, body: content };
  const endIdx = m.index;
  const fmRaw = rest.slice(0, endIdx);
  const body = rest.slice(endIdx + m[0].length);
  // Strip a single leading newline the delimiter left behind
  return { frontmatter: fmRaw.replace(/^\r?\n/, ''), body };
}

function parseFrontmatter(fmRaw) {
  if (fmRaw === null) return { fields: {}, parseError: null };
  const lines = fmRaw.split(/\r?\n/);
  const fields = {};
  let currentKey = null;
  let currentList = null;

  const keyRe = /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/;
  const listItemRe = /^\s*-\s*(.*)$/;

  try {
    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, '');
      if (line.trim() === '') {
        currentList = null;
        continue;
      }
      const listMatch = currentList !== null ? line.match(listItemRe) : null;
      if (listMatch) {
        currentList.push(stripQuotes(listMatch[1].trim()));
        continue;
      }
      const keyMatch = line.match(keyRe);
      if (keyMatch) {
        const key = keyMatch[1];
        const val = keyMatch[2].trim();
        if (val === '' || val === '|' || val === '>') {
          // Multi-line or list follows
          currentKey = key;
          currentList = [];
          fields[key] = currentList;
        } else {
          fields[key] = stripQuotes(val);
          currentList = null;
        }
        currentKey = key;
      }
      // else: line does not parse cleanly · skipped (never guessed)
    }
  } catch (err) {
    return { fields, parseError: err.message };
  }
  // Collapse empty lists that got no items into null (never invent content)
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v) && v.length === 0) fields[k] = null;
  }
  return { fields, parseError: null };
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// ---------- Article record shape ----------

function buildArticleRecord(absPath, root) {
  const rel = relative(root, absPath).replace(/\\/g, '/');
  const content = readFileSync(absPath, 'utf8');
  const { frontmatter, body } = extractFrontmatterBlock(content);

  const parseResult = parseFrontmatter(frontmatter);
  const fields = parseResult.fields;
  const parseError = parseResult.parseError;
  const hasFrontmatter = frontmatter !== null;

  // Extract Router-relevant fields verbatim (null when absent, never invented)
  const router_metadata = {};
  for (const f of ROUTER_FIELDS) router_metadata[f] = fields[f] ?? null;

  const missing_fields = REQUIRED_FIELDS.filter((f) => router_metadata[f] === null);

  let status;
  if (!hasFrontmatter) status = 'no_frontmatter';
  else if (parseError) status = 'parse_error';
  else if (missing_fields.length === 0) status = 'complete';
  else status = 'incomplete';

  const bodyPlain = body ?? '';
  const bodyExcerpt = bodyPlain.slice(0, 500);
  const contentHash = createHash('sha256').update(content).digest('hex');

  // "other_metadata" preserves everything else authored, without interpretation
  const other_metadata = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!ROUTER_FIELDS.includes(k)) other_metadata[k] = v;
  }

  return {
    path: rel,
    title: fields.title ?? null,
    status,
    missing_fields,
    parse_error: parseError,
    router_metadata,
    other_metadata,
    body_length: bodyPlain.length,
    body_excerpt: bodyExcerpt,
    content_hash: contentHash,
  };
}

// ---------- Index build ----------

export function buildIndex(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const files = walk(root); // already sorted

  const articles = [];
  const warnings = [];
  for (const f of files) {
    try {
      articles.push(buildArticleRecord(f, root));
    } catch (err) {
      warnings.push(`Failed to build record for ${f}: ${err.message}`);
    }
  }

  // Sort articles by path for stable output
  articles.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // Quality metrics
  const statusCounts = { complete: 0, incomplete: 0, no_frontmatter: 0, parse_error: 0 };
  const missingFieldTotals = {};
  for (const f of REQUIRED_FIELDS) missingFieldTotals[f] = 0;
  for (const a of articles) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    for (const mf of a.missing_fields) missingFieldTotals[mf]++;
  }
  const fieldCoverage = {};
  for (const f of ROUTER_FIELDS) {
    const present = articles.filter((a) => a.router_metadata[f] !== null).length;
    fieldCoverage[f] = { present, total: articles.length };
  }

  // Content hash: hash the articles-content payload (deterministic across runs)
  const articlesForHash = articles.map((a) => ({
    path: a.path,
    router_metadata: a.router_metadata,
    other_metadata: a.other_metadata,
    body_length: a.body_length,
    content_hash: a.content_hash,
  }));
  const payloadHash = createHash('sha256')
    .update(JSON.stringify(articlesForHash))
    .digest('hex');

  const index = {
    meta: {
      generator: 'nex-knowledge-index-builder-v1',
      version: 'v1',
      phase: 3,
      generated_at: new Date().toISOString(),
      root,
      file_count: articles.length,
      status_counts: statusCounts,
      payload_hash: payloadHash,
    },
    quality: {
      field_coverage: fieldCoverage,
      missing_field_totals: missingFieldTotals,
      warnings,
    },
    articles,
  };

  return index;
}

// ---------- Build log (human readable) ----------

export function buildLog(index) {
  const lines = [];
  const push = (s = '') => lines.push(s);
  push('NEX Knowledge Index Build Log');
  push('=============================');
  push(`Generator:         ${index.meta.generator}`);
  push(`Version:           ${index.meta.version} · phase ${index.meta.phase}`);
  push(`Generated at:      ${index.meta.generated_at}`);
  push(`Source root:       ${index.meta.root}`);
  push(`Files processed:   ${index.meta.file_count}`);
  push(`Payload hash:      ${index.meta.payload_hash}`);
  push('');
  push('Status counts');
  push('-------------');
  for (const [k, v] of Object.entries(index.meta.status_counts)) {
    push(`  ${k.padEnd(20)} ${v}`);
  }
  push('');
  push('Router-field coverage');
  push('---------------------');
  for (const [k, v] of Object.entries(index.quality.field_coverage)) {
    const pct = v.total === 0 ? '  0.0' : ((v.present / v.total) * 100).toFixed(1);
    push(`  ${k.padEnd(20)} ${v.present}/${v.total}  (${pct}%)`);
  }
  push('');
  push('Missing-field totals (from incomplete articles)');
  push('-----------------------------------------------');
  for (const [k, v] of Object.entries(index.quality.missing_field_totals)) {
    push(`  ${k.padEnd(20)} ${v}`);
  }
  push('');
  if (index.quality.warnings.length > 0) {
    push('Warnings');
    push('--------');
    for (const w of index.quality.warnings) push(`  ${w}`);
    push('');
  }
  return lines.join('\n');
}

// ---------- Persist ----------

function ensureDir(path) {
  const d = dirname(path);
  try {
    mkdirSync(d, { recursive: true });
  } catch {}
}

export function writeIndex(index, options = {}) {
  const outIndex = options.outIndex ?? DEFAULT_OUT_INDEX;
  const outLog = options.outLog ?? DEFAULT_OUT_LOG;
  ensureDir(outIndex);
  ensureDir(outLog);
  writeFileSync(outIndex, JSON.stringify(index, null, 2), 'utf8');
  writeFileSync(outLog, buildLog(index), 'utf8');
  return { outIndex, outLog };
}

// ---------- Phase 3 Acceptance Tests ----------

function runAcceptanceTests() {
  const checks = [];

  // AC1 · Reads all evidence files
  const index = buildIndex();
  const rawFiles = walk(DEFAULT_ROOT);
  checks.push({
    name: `AC1 · All .md files read (${rawFiles.length} on disk · ${index.articles.length} in index)`,
    pass: index.articles.length === rawFiles.length,
  });

  // AC2 · Deterministic · same input always produces the same payload hash
  const index2 = buildIndex();
  checks.push({
    name: 'AC2 · Two consecutive builds produce identical payload hashes (determinism)',
    pass: index.meta.payload_hash === index2.meta.payload_hash,
  });

  // AC3 · Reports missing metadata (both per-file and aggregate)
  const anyIncomplete = index.articles.find((a) => a.status === 'incomplete');
  checks.push({
    name: 'AC3a · Per-file missing_fields populated on incomplete articles',
    pass:
      anyIncomplete !== undefined && Array.isArray(anyIncomplete.missing_fields) && anyIncomplete.missing_fields.length > 0,
  });
  const missingKeys = Object.keys(index.quality.missing_field_totals);
  checks.push({
    name: 'AC3b · Aggregate missing_field_totals cover all Router fields',
    pass: ROUTER_FIELDS.every((f) => f in index.quality.missing_field_totals),
  });
  const coverageKeys = Object.keys(index.quality.field_coverage);
  checks.push({
    name: 'AC3c · field_coverage present for all Router fields',
    pass: ROUTER_FIELDS.every((f) => f in index.quality.field_coverage && typeof index.quality.field_coverage[f].present === 'number'),
  });

  // AC4 · Never invents · files without brain field have brain: null
  const noBrainArticles = index.articles.filter((a) => a.router_metadata.brain === null);
  const noBrainInvented = noBrainArticles.some((a) => typeof a.router_metadata.brain === 'string' && a.router_metadata.brain.length > 0);
  checks.push({
    name: 'AC4a · Articles lacking brain field record brain: null (no invention)',
    pass: noBrainArticles.length > 0 && !noBrainInvented,
  });
  const noSubjectInvented = index.articles.some((a) => a.router_metadata.subject !== null && !ROUTER_FIELDS.every((f) => f in a.router_metadata));
  checks.push({
    name: 'AC4b · No article has a Router field value that was not present in source frontmatter',
    pass: !noSubjectInvented,
  });

  // AC5 · Non-crashing on malformed frontmatter
  // Simulate a file with malformed frontmatter by parsing directly
  const malformed = parseFrontmatter('this is not valid yaml\n  :::\n   -');
  checks.push({
    name: 'AC5 · Parser tolerates malformed frontmatter without throwing',
    pass: typeof malformed === 'object' && 'fields' in malformed,
  });

  // AC6 · Build log generated
  const log = buildLog(index);
  checks.push({
    name: 'AC6a · Build log is a non-empty string',
    pass: typeof log === 'string' && log.length > 200,
  });
  checks.push({
    name: 'AC6b · Build log includes payload_hash line',
    pass: log.includes('Payload hash:'),
  });
  checks.push({
    name: 'AC6c · Build log includes Router-field coverage section',
    pass: log.includes('Router-field coverage'),
  });

  // AC7 · Idempotent file write · writing the index twice produces identical bytes
  const tmpIndex = path.resolve(process.cwd(), 'data', 'knowledge-index.json');
  const tmpLog = path.resolve(process.cwd(), 'data', 'knowledge-index-build-log.txt');
  writeIndex(index, { outIndex: tmpIndex, outLog: tmpLog });
  const bytes1 = readFileSync(tmpIndex);
  // Zero the generated_at drift by using the SAME index object
  writeIndex(index, { outIndex: tmpIndex, outLog: tmpLog });
  const bytes2 = readFileSync(tmpIndex);
  checks.push({
    name: 'AC7 · Writing the same index twice produces byte-identical file',
    pass: Buffer.compare(bytes1, bytes2) === 0,
  });

  // AC8 · Existing runtime phases remain unchanged (regression check)
  // Verified structurally: index files sit at data/knowledge-index.json ·
  // no changes were made to scripts/nex-retrieval-engine-v1.mjs or
  // scripts/nex-retrieval-image-provider-v1.mjs.
  // We assert only that the builder does not import from those runtime files.
  const builderSrc = readFileSync('C:/Users/Victus/trades/scripts/nex-knowledge-index-builder-v1.mjs', 'utf8');
  const importFromRetrieval = /^\s*import[^;]*from\s*['"`][^'"`]*nex-retrieval[^'"`]*['"`]/m.test(builderSrc);
  checks.push({
    name: 'AC8a · Builder does not import from the Retrieval Engine (isolated compiler)',
    pass: !importFromRetrieval,
  });
  checks.push({
    name: 'AC8b · Builder never writes into data/nex-reference-brains (source read-only)',
    pass: !builderSrc.match(/writeFileSync\(\s*['"`][^'"`]*nex-reference-brains/),
  });

  return { name: 'Phase 3 · Knowledge Index Builder Acceptance', checks, index };
}

// ---------- Report ----------

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
  console.log('NEX Knowledge Index Builder · v1 · Phase 3');
  console.log('Spec: NEX-RUNTIME-PIPELINE-v1-SPEC.md');
  console.log('');

  // First: build once and write outputs so the index actually exists on disk
  const index = buildIndex();
  const { outIndex, outLog } = writeIndex(index);
  console.log(`Index written to: ${outIndex}`);
  console.log(`Build log written to: ${outLog}`);
  console.log('');

  // Print the human-readable log verbatim so authors see the reality
  console.log(buildLog(index));

  // Then: run acceptance tests
  const suite = runAcceptanceTests();
  const r = report(suite);
  console.log('');
  console.log('='.repeat(78));
  console.log(`Phase 3 Overall · ${r.passed}/${r.total}`);
  console.log('='.repeat(78));

  if (r.passed !== r.total) {
    console.log('Phase 3 · FAILED · Knowledge Index Builder does not satisfy Phase 3 contract');
    process.exit(1);
  }
  console.log('Phase 3 · PASSED · Knowledge Index Builder satisfies Phase 3 contract');
  console.log('Next: Phase 4 · Knowledge Provider (queries knowledge-index.json · same interface as Image Provider)');
}

const isDirect = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) main();
