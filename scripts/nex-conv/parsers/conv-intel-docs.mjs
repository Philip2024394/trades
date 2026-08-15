// Parse the 22 conversational-intelligence markdown docs.
// Extraction strategy:
//   - YAML frontmatter → source metadata
//   - H2/H3 sections → topic anchors
//   - Bulleted "Customer says / NEX responds" pairs → qa_pair rows
//   - Bulleted question-variations lists → each bullet becomes a statement
//     row with kind=statement (they're canonical questions with no answer)
//   - Free-standing paragraphs → statement rows
//   - Blockquotes → statement rows
// Excludes the ADR-0044 architecture doc itself (that's design, not
// conversational content).

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { newId } from '../lib/schema.mjs';
import { extractEntities, extractIntent } from '../lib/extract.mjs';

const DIR = 'C:/Users/Victus/trades/data/nex-reference-brains/staircase-preparation/conversational-intelligence';
const EXCLUDE = new Set([
  'README.md',
  'nex-conversation-learning-pipeline-architecture-2026-08-15.md', // this is design, not conv content
]);

export async function parseConvIntelDocs(store) {
  const items = [];
  const files = (await readdir(DIR)).filter(f => f.endsWith('.md') && !EXCLUDE.has(f));
  for (const file of files) {
    const path = join(DIR, file);
    const raw = await readFile(path, 'utf8');
    const parsed = parseDoc(raw, file, store);
    items.push(...parsed);
  }
  return items;
}

function parseDoc(raw, filename, store) {
  const items = [];
  const source_ref = `conv-intel/${filename}`;
  const source_batch = 'conv-intel-2026-08-14';

  // Split off YAML frontmatter
  const body = raw.replace(/^---[\s\S]*?---\n?/, '');

  // Split into blocks separated by blank lines
  const blocks = body.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);

  // Look for consecutive **Customer:** / **NEX:** pairs
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    // A) Customer / NEX pair pattern
    const customerMatch = b.match(/^\*\*Customer:\*\*\s*(.+)/s);
    if (customerMatch) {
      const custText = stripInlineFormatting(customerMatch[1]);
      // Look ahead for the NEX response
      const nextBlock = blocks[i + 1] ?? '';
      const nexMatch = nextBlock.match(/^\*\*NEX:\*\*\s*(.+)/s);
      if (nexMatch) {
        const nexText = stripInlineFormatting(nexMatch[1]);
        items.push(makeQA({ store, source_batch, source_ref, question_text: custText, answer_text: nexText }));
        continue;
      }
    }

    // Skip NEX-blocks (already consumed by the pair matcher above)
    if (/^\*\*NEX:\*\*/.test(b)) continue;

    // B) Blockquote (canonical example line)
    if (/^>\s+/.test(b)) {
      const text = b.split('\n').map(l => l.replace(/^>\s*/, '')).join(' ').trim();
      if (text.length > 20) items.push(makeStatement({ store, source_batch, source_ref, text }));
      continue;
    }

    // C) Bulleted list — each bullet becomes a statement / question row
    if (/^[-*]\s/.test(b)) {
      for (const line of b.split('\n')) {
        const bullet = line.match(/^\s*[-*]\s+(.+)/);
        if (!bullet) continue;
        let text = stripInlineFormatting(bullet[1]);
        // Strip attribution like "→ leads to..." at end
        text = text.replace(/\s+—\s+.*$/, '').replace(/\s*\(L\d+.*?\)\s*$/, '').trim();
        if (text.length < 8) continue;
        if (/^[-*#]/.test(text)) continue;
        items.push(makeStatement({ store, source_batch, source_ref, text }));
      }
      continue;
    }

    // D) Heading — skip (used as topic anchors only)
    if (/^#{1,6}\s/.test(b)) continue;

    // E) Regular paragraph — keep if it looks like domain content
    // Filter out obvious meta paragraphs (rule statements, YAML-style, etc.)
    if (b.length > 40 && b.length < 1200 && !/^```/.test(b) && !/^\|/.test(b)) {
      const text = stripInlineFormatting(b);
      if (isDomainSubstance(text)) items.push(makeStatement({ store, source_batch, source_ref, text }));
    }
  }
  return items;
}

function makeQA({ store, source_batch, source_ref, question_text, answer_text }) {
  const combined = `${question_text} ${answer_text}`;
  const ents = extractEntities(combined, store);
  const intent = extractIntent(question_text, store);
  const topics = filterTopics(ents, store);
  const cls = intent.confidence;
  const ext = ents.length ? 0.85 : 0.65;
  const base = Math.min(cls, ext);
  return {
    id: newId(),
    brain: 'staircase_brain',
    source_batch, source_ref,
    kind: 'qa_pair',
    question_text, answer_text,
    canonical_intent: intent.slug,
    entities: ents, topics,
    confidence: +base.toFixed(3),
    draft_only: base < 0.70,
    _meta: { classification_confidence: cls, extraction_confidence: ext },
  };
}

function makeStatement({ store, source_batch, source_ref, text }) {
  const ents = extractEntities(text, store);
  const intent = extractIntent(text, store);
  const topics = filterTopics(ents, store);
  const cls = intent.confidence;
  const ext = ents.length ? 0.80 : 0.55;
  const base = Math.min(cls, ext);
  return {
    id: newId(),
    brain: 'staircase_brain',
    source_batch, source_ref,
    kind: text.endsWith('?') ? 'qa_pair' : 'statement',
    question_text: text.endsWith('?') ? text : null,
    answer_text: text.endsWith('?') ? null : text,
    canonical_intent: intent.slug,
    entities: ents, topics,
    confidence: +base.toFixed(3),
    draft_only: base < 0.70,
    _meta: { classification_confidence: cls, extraction_confidence: ext },
  };
}

function stripInlineFormatting(s) {
  return s
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterTopics(ents, store) {
  const store_entities = store.allEntities();
  return ents.filter(slug => {
    const ent = store_entities.find(x => x.slug === slug);
    return ent && (ent.entity_class === 'component' || ent.entity_class === 'style');
  });
}

function isDomainSubstance(text) {
  // Cheap heuristic: has a domain keyword and isn't a rule/meta line
  if (/^(rule|note|locked rule|caveat|principle|framework|purpose|scope):/i.test(text)) return false;
  if (/(staircase|stair|balust|newel|handrail|tread|riser|nosing|string|oak|walnut|glass|carpet|installation|price|cost|regulation|refac|volute|bullnose|curtail)/i.test(text)) return true;
  return false;
}
