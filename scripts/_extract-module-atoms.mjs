// Extract runtime atoms from Layer 2 markdown drafts.
// Rule B compliance: pure text extraction from expert-authored drafts.
// No trade content authored here.
//
// Reads:
//   data/nex-reference-brains/staircase-preparation/layer-2-drafts/{module}.md
// Writes:
//   .author-studio-drafts/staircase/{brain}.json  (one per module)

import fs from 'node:fs';
import path from 'node:path';

const DRAFTS_DIR = path.join(process.cwd(), 'data', 'nex-reference-brains', 'staircase-preparation', 'layer-2-drafts');
const OUT_DIR = path.join(process.cwd(), '.author-studio-drafts', 'staircase');

const MODULES = [
  { file: 'staircase-types.md',                 slug: 'types',        title: 'Staircase Types' },
  { file: 'staircase-materials.md',             slug: 'materials',    title: 'Staircase Materials' },
  { file: 'staircase-components-expansion.md',  slug: 'components',   title: 'Staircase Components' },
  { file: 'staircase-installation.md',          slug: 'installation', title: 'Staircase Installation' },
  { file: 'staircase-design-terminology.md',    slug: 'design',       title: 'Staircase Design' },
  { file: 'customer-faq.md',                    slug: 'faq',          title: 'Customer FAQ' },
];

const TYPE_PATTERN = /^\s+-\s+\*\*type:\*\*\s+(.+?)(\s*$|\s*[·(])/m;
const LINE_REF_PATTERN = /\*\(L[\d–—,\s\-–\.]+\)\*/;
const SECTION_PATTERN = /^###\s+(.+)$/;

function stripMarkdown(s) {
  return s
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAtoms(md) {
  const lines = md.split(/\r?\n/);
  const atoms = [];
  let inKnowledge = false;
  let currentSection = null;
  let currentAtom = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^##\s+KNOWLEDGE/.test(line)) { inKnowledge = true; continue; }
    if (/^##\s+TERMS/.test(line) || /^##\s+BOUNDARY/.test(line)) {
      if (currentAtom) atoms.push(currentAtom);
      currentAtom = null;
      inKnowledge = false;
      continue;
    }
    if (!inKnowledge) continue;

    const sectionMatch = line.match(SECTION_PATTERN);
    if (sectionMatch) {
      if (currentAtom) atoms.push(currentAtom);
      currentAtom = null;
      currentSection = stripMarkdown(sectionMatch[1]);
      continue;
    }

    if (/^-\s+/.test(line)) {
      if (currentAtom) atoms.push(currentAtom);
      const text = stripMarkdown(line.replace(/^-\s+/, ''));
      if (text.length < 3) { currentAtom = null; continue; }
      const lineRefMatch = text.match(/\(L([\d–—,\s\-\.]+)\)/);
      const sourceRef = lineRefMatch ? `L${lineRefMatch[1]}` : null;
      const cleaned = text.replace(/\(L[\d–—,\s\-\.]+\)/g, '').trim();
      currentAtom = {
        text: cleaned,
        source_ref: sourceRef,
        section: currentSection,
        type: null,
        verification_note: null,
      };
      continue;
    }

    if (/^\s+-\s+/.test(line) && currentAtom) {
      const typeMatch = line.match(/\*\*type:\*\*\s*(\S+(?:\s+\S+)?)/);
      if (typeMatch) {
        currentAtom.type = typeMatch[1].replace(/[*,.]$/g, '').trim();
        continue;
      }
      const verifMatch = line.match(/verification note[^:]*:\s*\*\*?\s*(.+?)(?:\*\*)?\s*$/);
      if (verifMatch) {
        currentAtom.verification_note = stripMarkdown(verifMatch[1]);
        continue;
      }
    }
  }
  if (currentAtom) atoms.push(currentAtom);

  return atoms.filter(a => a.text && a.text.length > 5);
}

function extractKeywords(md) {
  const termsMatch = md.match(/##\s+TERMS([\s\S]+?)##\s+/);
  if (!termsMatch) return [];
  const raw = termsMatch[1];
  const keywords = new Set();
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!/^-\s+/.test(line)) continue;
    const cleaned = stripMarkdown(line.replace(/^-\s+/, ''));
    // Split on middot / bullet / comma / semicolon
    const parts = cleaned.split(/[·•,;]|\s+·\s+/);
    for (const p of parts) {
      const kw = p.replace(/\(.*?\)/g, '').replace(/named only/gi, '').trim().toLowerCase();
      if (kw.length >= 3 && kw.length <= 40) keywords.add(kw);
    }
  }
  return Array.from(keywords);
}

function moduleToJson(mod) {
  const filePath = path.join(DRAFTS_DIR, mod.file);
  const md = fs.readFileSync(filePath, 'utf8');
  const atoms = extractAtoms(md);
  const keywords = extractKeywords(md);
  return {
    brain_slug: 'staircase',
    module: mod.slug,
    author_id: 'philip-ofarrell',
    version: '0.1.0-activation',
    updated_at: new Date().toISOString(),
    payload: {
      header: {
        title: mod.title,
        version: '0.1.0-activation',
        authored_by: 'philip-ofarrell',
        authored_at: '2026-07-30T00:00:00.000Z',
        regions: ['GB'],
        source_draft: `data/nex-reference-brains/staircase-preparation/layer-2-drafts/${mod.file}`,
        note: 'Path B.1 activation · v2/v3 draft extracted for runtime access. Rule B compliant: pure text extraction, no AI-authored content. Not yet Gate 3 reviewed or Gate 4 published.',
      },
      atoms,
      keywords,
    },
  };
}

let totalAtoms = 0;
for (const mod of MODULES) {
  const json = moduleToJson(mod);
  const outPath = path.join(OUT_DIR, `${mod.slug}.json`);
  fs.writeFileSync(outPath, JSON.stringify(json, null, 2));
  totalAtoms += json.payload.atoms.length;
  console.log(`${mod.slug.padEnd(14)} atoms=${json.payload.atoms.length.toString().padStart(3)} keywords=${json.payload.keywords.length} -> ${outPath}`);
}
console.log(`TOTAL ATOMS EXTRACTED: ${totalAtoms}`);
