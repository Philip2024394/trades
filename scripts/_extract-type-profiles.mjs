// Extract staircase-type profile sections as runtime atoms.
// Rule B: pure text extraction from Philip-authored profiles.
// Each of the 16 template sections becomes ONE atom (per Philip's
// "atom is the serving unit" principle).
//
// Reads: data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-type-profiles/*.md
// Writes: .author-studio-drafts/staircase/type_profiles.json

import fs from 'node:fs';
import path from 'node:path';

const PROFILES_DIR = path.join(
  process.cwd(),
  'data', 'nex-reference-brains', 'staircase-preparation',
  'expert-notes-philip-ofarrell', 'staircase-type-profiles'
);
const OUT_PATH = path.join(process.cwd(), '.author-studio-drafts', 'staircase', 'type_profiles.json');

function extractProfileAtoms(md, filename) {
  // Strip frontmatter
  const body = md.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Get profile name from first # heading
  const nameMatch = body.match(/^#\s+(.+)$/m);
  const profileName = nameMatch ? nameMatch[1].trim() : filename.replace(/\.md$/, '');

  // Split into sections by ## headings (skipping the first # profile-name heading)
  const sections = [];
  const sectionRegex = /^##\s+([^\n]+)\n([\s\S]*?)(?=^##\s+|\Z)/gm;
  let match;
  while ((match = sectionRegex.exec(body)) !== null) {
    const sectionTitle = match[1].trim();
    let sectionText = match[2].trim();
    // Remove horizontal rules
    sectionText = sectionText.replace(/^---\s*$/gm, '').trim();
    // Only include if the section has content
    if (sectionText.length > 5) {
      sections.push({ title: sectionTitle, text: sectionText });
    }
  }

  // Extract keywords: profile name tokens + section titles + alternative names
  const keywords = new Set();
  keywords.add(profileName.toLowerCase());
  for (const w of profileName.toLowerCase().split(/\s+/)) {
    if (w.length >= 3) keywords.add(w);
  }
  // Extract "Also Known As" bullets as keywords
  const aliasSection = sections.find(s => /also\s+known\s+as/i.test(s.title));
  if (aliasSection) {
    const aliases = aliasSection.text.match(/^\*\s+(.+)$/gm);
    if (aliases) {
      for (const a of aliases) {
        const alias = a.replace(/^\*\s+/, '').trim().toLowerCase();
        keywords.add(alias);
        for (const w of alias.split(/\s+/)) {
          if (w.length >= 3) keywords.add(w);
        }
      }
    }
  }

  return { profileName, sections, keywords: Array.from(keywords) };
}

const files = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.md'));

const allAtoms = [];
const allKeywords = new Set();

for (const file of files) {
  const md = fs.readFileSync(path.join(PROFILES_DIR, file), 'utf8');
  const { profileName, sections, keywords } = extractProfileAtoms(md, file);
  for (const kw of keywords) allKeywords.add(kw);

  for (const s of sections) {
    allAtoms.push({
      text:              `${profileName} · ${s.title}: ${s.text}`,
      source_ref:        `${file}#${s.title}`,
      section:           profileName,
      type:              s.title.toLowerCase().replace(/\s+/g, '_'),
      verification_note: null,
    });
  }
  console.log(`${profileName}: ${sections.length} sections → ${sections.length} atoms`);
}

const output = {
  brain_slug: 'staircase',
  module: 'type_profiles',
  author_id: 'philip-ofarrell',
  version: '0.1.0-canonical',
  updated_at: new Date().toISOString(),
  payload: {
    header: {
      title: 'Staircase Type Profiles',
      version: '0.1.0-canonical',
      authored_by: 'philip-ofarrell',
      authored_at: '2026-07-31T00:00:00.000Z',
      regions: ['GB'],
      source_draft: 'data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-type-profiles/',
      note: 'Section-as-atom canonicalisation of Philip-authored gold-standard profiles. Each section serves a distinct user intent. Follows Rules 1-6 and PHASE 2 CONSTITUTIONAL RULE.',
    },
    atoms: allAtoms,
    keywords: Array.from(allKeywords),
  },
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
console.log(`\nTotal atoms: ${allAtoms.length}`);
console.log(`Total keywords: ${allKeywords.size}`);
console.log(`Written to: ${OUT_PATH}`);
