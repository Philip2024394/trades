#!/usr/bin/env node
// Derives Router Validation Suite entries automatically from existing Layer 1 evidence frontmatter.
// Every artefact authored with Standard v1 metadata (brain · domain · intent · information_type · topics) becomes a Router test.
// Usage: node scripts/derive-nex-router-validation-entries.mjs
// Output: data/nex-reference-brains/staircase-preparation/nex-router-validation-derived-entries-2026-07-31.md
//
// Philip 2026-07-31 authored directive:
//   "If you already have 7,000 lines, don't manually create another 7,000 validation entries.
//    Instead, write a small converter."
//
// Composes with:
//   - NEX-ROUTER-VALIDATION-SUITE-v1.md (target format)
//   - Standard v1 Part 5 (article metadata frontmatter)
//
// IMPORTER DISCIPLINE (Philip 2026-07-31 · permanent rule · applies to every extender):
//   1. The importer must never alter the source corpus.
//   2. The source corpus is read-only.
//   3. Derived validation entries are written to a separate location.
//   4. If parsing fails, report the failure and continue.
//   5. Never rewrite, reformat, or "improve" the original knowledge.
//   6. Idempotent: same source → same output. Regenerate the derived corpus rather than mutating source.
//   Detail: ~/.claude/projects/C--Users-Victus/memory/feedback_nex_importer_discipline_2026_07_31.md

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '..', '..');
const EVIDENCE_DIR = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'expert-notes-philip-ofarrell', 'staircase-instances');
const OUT = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-router-validation-derived-entries-2026-07-31.md');

function readFrontmatter(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = raw.slice(4, end);
  const meta = {};

  // Simple key: value parser. Handles single-line scalars + multi-line arrays with `  - value` items.
  const lines = block.split('\n');
  let currentKey = null;
  let currentArray = null;
  for (const line of lines) {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*:/.test(line)) {
      const idx = line.indexOf(':');
      currentKey = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (value === '' || value === '|' || value === '>') {
        currentArray = null;
      } else if (value === '' || value.startsWith('[')) {
        currentArray = null;
        meta[currentKey] = value;
      } else {
        meta[currentKey] = value.replace(/^["']|["']$/g, '');
        currentArray = null;
      }
    } else if (/^\s+-\s+/.test(line)) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      meta[currentKey].push(line.replace(/^\s+-\s+/, '').replace(/^["']|["']$/g, ''));
      currentArray = meta[currentKey];
    }
  }

  // Extract Customer Question from body if present (Customer FAQ pattern)
  const bodyIdx = raw.indexOf('\n---', 3) + 4;
  const body = raw.slice(bodyIdx);
  const cqMatch = body.match(/^##\s+Customer Question\s*\n+>\s+\*\*\*(.+?)\*\*\*/ms);
  if (cqMatch) {
    meta._customer_question = cqMatch[1].trim();
  }

  return meta;
}

function deriveEntry(filepath, meta) {
  if (!meta || !meta.brain) return null;

  const question = meta._customer_question || meta.title || path.basename(filepath, '.md');
  const intent = Array.isArray(meta.intent) ? meta.intent[0] : (meta.intent || 'Learn');
  const infoType = Array.isArray(meta.information_type) ? meta.information_type[0] : (meta.information_type || 'Definition');
  const topics = Array.isArray(meta.topics) ? meta.topics : [];
  const subject = topics[0] || meta.subtype?.split(' ·')[0] || 'Staircase';
  const brain = meta.brain.split(' ')[0].split('(')[0].trim();
  const domain = meta.domain || 'Knowledge Base';

  // Clarify heuristic: Buy/Enquire intents on short-question ambiguous subjects → Maybe/Yes
  let clarify = 'No';
  if (['Buy', 'Enquire', 'Quote'].includes(intent) && question.split(' ').length < 4) clarify = 'Yes';
  else if (['Buy', 'Quote'].includes(intent)) clarify = 'Maybe';

  return {
    question,
    intent,
    subject,
    brain,
    domain,
    infoType,
    clarify,
    source: path.basename(filepath),
  };
}

const files = fs.readdirSync(EVIDENCE_DIR).filter((f) => f.endsWith('.md'));
const entries = [];
for (const f of files) {
  try {
    const meta = readFrontmatter(path.join(EVIDENCE_DIR, f));
    const entry = deriveEntry(path.join(EVIDENCE_DIR, f), meta);
    if (entry) entries.push(entry);
  } catch (err) {
    console.error(`Skipped ${f}: ${err.message}`);
  }
}

// Sort by brain then domain then question for stable output
entries.sort((a, b) => (a.brain + a.domain + a.question).localeCompare(b.brain + b.domain + b.question));

const esc = (s) => String(s).replaceAll('|', '\\|').replaceAll('\n', ' ');

const table = entries
  .map((e) => `| ${esc(e.question)} | ${esc(e.intent)} | ${esc(e.subject)} | ${esc(e.brain)} | ${esc(e.domain)} | ${esc(e.infoType)} | ${esc(e.clarify)} | *derived* |  | \`${esc(e.source)}\` |`)
  .join('\n');

const md = `---
title: NEX Router Validation Suite · derived entries · 2026-07-31
generated_by: scripts/derive-nex-router-validation-entries.mjs
source_directory: data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-instances/
total_derived_entries: ${entries.length}
regenerate: node scripts/derive-nex-router-validation-entries.mjs
purpose: |
  Automatically derived validation entries from existing Layer 1 evidence frontmatter.
  Every artefact authored with Standard v1 metadata (brain · domain · intent · information_type · topics) becomes a Router test row.
  Composes with NEX-ROUTER-VALIDATION-SUITE-v1.md (starter corpus = 6 · derived corpus = ${entries.length} · combined available).
philip_directive_2026_07_31: |
  "If you already have 7,000 lines, don't manually create another 7,000 validation entries.
   Instead, write a small converter."
regeneration: |
  This file is regenerated on every knowledge update.
  Do NOT hand-edit rows here — modify the source frontmatter and re-run the converter.
---

# NEX Router Validation Suite · Derived Entries (${entries.length} rows)

Every row below was derived automatically from the frontmatter of an existing Layer 1 evidence artefact. The Router expected values come from the metadata fields Philip has been authoring under Standard v1 discipline. **Do not hand-edit this file** — modify the source frontmatter and re-run the converter.

| User Question | Expected Intent | Expected Subject | Expected Brain | Expected Domain | Expected Info Type | Clarify? | Evidence Used | Pass/Fail | Source Artefact |
|---|---|---|---|---|---|---|---|---|---|
${table}

---

## Regeneration

\`\`\`
node scripts/derive-nex-router-validation-entries.mjs
\`\`\`

Every time a new authored artefact is added to \`staircase-instances/\` with proper Standard v1 frontmatter, run this script and the validation corpus grows automatically. Zero manual maintenance.

## Composition with Standard v1

The converter reads these frontmatter fields per Standard v1 Part 5:

- \`title\` → User Question (fallback when Customer Question section not present)
- \`intent[0]\` → Expected Intent (primary of multi-value)
- \`topics[0]\` → Expected Subject (primary of multi-value)
- \`brain\` → Expected Brain
- \`domain\` → Expected Domain
- \`information_type[0]\` → Expected Info Type (primary of multi-value)
- Customer Question section (\`> ***…***\`) → User Question (overrides title for Customer FAQ articles)
- Clarify heuristic: Buy/Enquire/Quote intents on short (<4 word) questions → Yes/Maybe

## Growth ladder position (per Philip's revised 2026-07-31 ladder)

- v1 = 6 diagnostic questions (starter corpus in the main Suite)
- v2 = 100 representative questions
- v3 = 1,000 questions
- v4 = 7,000 existing staircase questions (source: existing Q&A corpus · use this converter pattern to derive)
- v5 = Live production questions (after launch · new questions Nex hasn't seen · measures generalisation)

The derived corpus above bootstraps v4-style growth from whatever authored evidence exists at any point in time.
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT}`);
console.log(`Derived ${entries.length} validation entries from ${files.length} evidence files`);
