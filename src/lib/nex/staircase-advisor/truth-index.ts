// Staircase Advisor · Truth Retrieval Index (Philip 2026-08-01)
//
// Indexes Philip-authored files into small searchable snippets so that
// Advisor's Truth Retrieval can answer any question the corpus covers,
// not just the hand-coded topics. Built once on first request, cached
// for the process lifetime.
//
// Contract compliance (Section 8):
//   - Only APPROVED files are indexed. Approved = matches one of the
//     hard-coded patterns for the 7 primary + 5 secondary source
//     families listed in Section 8, OR the file frontmatter contains
//     `advisor_evidence: true` (Section 8.4 Q1 governance rule).
//   - Files without either signal are stored on disk but NOT loaded
//     into the Advisor's evidence set (Section 8.3 protection against
//     accidental exposure of notes / drafts / private material).

import "server-only";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

export type IndexedSnippet = {
  id:           string;                    // e.g. "expert-notes.../file.md#Section-Title"
  file:         string;                    // relative path from cwd
  section:      string;                    // heading text (or "top" for pre-heading content)
  text:         string;                    // verbatim snippet body
  tokens:       Set<string>;               // extracted tokens for matching
  is_question:  boolean;                   // section starts with a question word
  section_type: "faq" | "principle" | "description" | "list" | "other";
};

const CORPUS_ROOT = "data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell";

// Section 8 · approved file patterns
// Philip 2026-08-01 · expanded to cover the full authored customer-facing
// corpus. Previously 8 patterns → 32 files. Now 14 patterns → covers all
// Philip-authored customer-facing families. Excluded families (cko · dna ·
// cognitive · conversation · creative-process · apprenticeship) remain
// out per Section 8.3.
const APPROVED_FILE_PATTERNS: RegExp[] = [
  // Original 8 (customer FAQ + design + materials + type profiles)
  /\/staircase-design-principles\.md$/,
  /\/customer-faq-staircase\.md$/,
  /\/customer-buying-guide-principles\.md$/,
  /\/staircase-market-trends\.md$/,
  /\/staircase-category-taxonomy\.md$/,
  /\/staircase-type-profiles\/[^/]+\.md$/,
  /\/wood-intelligence-principles\.md$/,
  /\/nex-knowledge-base-[^/]+\.md$/,
  // Expanded 2026-08-01 · additional Philip-authored customer knowledge
  /\/nex-customer-faq-[^/]+\.md$/,           // Individual customer Q&A files
  /\/nex-premium-[^/]+\.md$/,                // Premium staircase specifications + vision scans
  /\/nex-component-recognition-[^/]+\.md$/,  // Component recognition references
  /\/material-profile-[^/]+\.md$/,           // Material profiles (oak, walnut, lamwood, etc.)
  /\/staircase-installation-techniques\.md$/, // Installation techniques (Philip-authored)
  /\/staircase-brain-membership-criteria\.md$/, // Brain membership criteria
  /\/business-operations-principles\.md$/,   // Business ops principles
  /\/purchasing-principles\.md$/,            // Purchasing principles
  // Second expansion 2026-08-01 · staircase reference examples + vision analyses
  /\/nex-reference-[^/]+\.md$/,              // Staircase reference examples
  /\/nex-recognition-example-[^/]+\.md$/,    // Component recognition examples
  /\/nex-vision-analysis-[^/]+\.md$/,        // Vision analysis exemplars
  /\/nex-response-[^/]+\.md$/,               // Nex response templates (tool + staircase)
  /\/nex-workflow-[^/]+\.md$/,               // Workflow guides (site measurements etc.)
  /\/nex-runtime-clarifier-[^/]+\.md$/,      // Customer clarifier templates
  /\/terminology-principles\.md$/,           // Terminology principles
  /\/timber-lifecycle-principles\.md$/,      // Timber lifecycle
  /\/timber-market-principles\.md$/,         // Timber market
  /\/workshop-consumables-and-tooling\.md$/, // Workshop tooling
  /\/workshop-operations-principles\.md$/,   // Workshop operations
];

function normPath(p: string): string {
  return p.split(sep).join("/");
}

function isApprovedByPath(relPath: string): boolean {
  return APPROVED_FILE_PATTERNS.some((p) => p.test(relPath));
}

function hasAdvisorEvidenceFlag(raw: string): boolean {
  if (!raw.startsWith("---")) return false;
  const closeIdx = raw.indexOf("\n---", 3);
  if (closeIdx <= 0) return false;
  const frontmatter = raw.slice(3, closeIdx);
  return /^\s*advisor_evidence\s*:\s*true\s*$/mi.test(frontmatter);
}

// Philip 2026-08-01 · explicit `advisor_evidence: false` in the frontmatter
// (added by the authoring page when topic_type = apprentice / internal_notes)
// OVERRIDES the file-pattern eligibility. Even if the file matches an
// approved name pattern, this flag keeps it out of Nex's customer index.
function hasAdvisorEvidenceOptOut(raw: string): boolean {
  if (!raw.startsWith("---")) return false;
  const closeIdx = raw.indexOf("\n---", 3);
  if (closeIdx <= 0) return false;
  const frontmatter = raw.slice(3, closeIdx);
  return /^\s*advisor_evidence\s*:\s*false\s*$/mi.test(frontmatter);
}

// Philip 2026-08-01 · Internal-template / demonstration exclusion.
//
// Some approved-by-pattern files (e.g. nex-premium-enclosed-straight-flight-half-wall.md)
// are internal TEMPLATES that DEMONSTRATE a principle rather than describe a
// customer-facing staircase. Their body contains sentences like "This
// specification demonstrates the 7 Levels of Understanding..." which would
// leak internal engineering language into customer answers.
//
// Excluded when frontmatter has any of:
//   - `type: nex_premium_vision_scan_model` (all 10 vision-scan model templates)
//   - `subtype: seven_levels_of_understanding_applied_to_image` (the seed template)
//   - `intended_use` containing "demonstrating" or "demonstrates" (principle-demo files)
//   - `internal_only: true` (explicit future-proof flag)
//   - `customer_facing: false` (explicit future-proof flag)
//
// Customer-facing premium specs use "reference specification FOR a..." (not "demonstrating").
function isInternalTemplate(raw: string): boolean {
  if (!raw.startsWith("---")) return false;
  const closeIdx = raw.indexOf("\n---", 3);
  if (closeIdx <= 0) return false;
  const frontmatter = raw.slice(3, closeIdx);

  if (/^\s*type\s*:\s*nex_premium_vision_scan_model\s*$/mi.test(frontmatter)) return true;
  if (/^\s*subtype\s*:\s*seven_levels_of_understanding_applied_to_image\s*$/mi.test(frontmatter)) return true;
  if (/^\s*internal_only\s*:\s*true\s*$/mi.test(frontmatter)) return true;
  if (/^\s*customer_facing\s*:\s*false\s*$/mi.test(frontmatter)) return true;
  // intended_use with "demonstrating" or "demonstrates" · principle demos
  const iu = frontmatter.match(/^\s*intended_use\s*:\s*(.+)$/mi);
  if (iu && /\bdemonstrat(ing|es)\b/i.test(iu[1])) return true;

  return false;
}

// Very common tokens · add no ranking signal
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "being",
  "it", "this", "that", "these", "those",
  "i", "you", "we", "they", "he", "she", "him", "her",
  "at", "by", "from", "as", "if", "so", "than", "up", "down", "out",
  "have", "has", "had", "do", "does", "did", "doing", "done",
  "not", "no", "yes",
  "can", "could", "will", "would", "should", "may", "might", "must",
  "just", "only", "very", "really", "quite",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^\w\s'-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
      .map((t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t)),
  );
}

function classifySection(sectionTitle: string, body: string): IndexedSnippet["section_type"] {
  if (sectionTitle.includes("?")) return "faq";
  if (/^(Why|How|What|When|Should|Can|Is|Are|Do|Does|Which)\s/i.test(sectionTitle)) return "faq";
  if (/^Principle\s+[A-Z]/i.test(sectionTitle)) return "principle";
  const bulletCount = body.split("\n").filter((l) => /^\s*[-*]\s/.test(l)).length;
  if (bulletCount >= 3) return "list";
  if (body.length < 400 && body.split("\n").length < 8) return "description";
  return "other";
}

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const closeIdx = raw.indexOf("\n---", 3);
  if (closeIdx <= 0) return raw;
  return raw.slice(closeIdx + 4).replace(/^\r?\n/, "");
}

function splitFileIntoSnippets(fileRelPath: string, absPath: string): IndexedSnippet[] {
  const raw = readFileSync(absPath, "utf8");
  const body = stripFrontmatter(raw);

  // Detect H1 title at top of file · used as effective section title for the
  // pre-H2 snippet (many terminology / material articles only have H1 · Grep
  // showed baserail / handrail / european-oak all follow this shape).
  const lines = body.split("\n");
  let fileH1Title = "";
  for (const line of lines) {
    if (line.trim() === "") continue;
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    if (h1) { fileH1Title = h1[1].trim(); }
    break;
  }

  const snippets: IndexedSnippet[] = [];
  let currentSection = fileH1Title || "top";
  let currentText: string[] = [];

  const commit = () => {
    const text = currentText.join("\n").trim();
    if (text.length < 60) return;      // too short · little signal
    if (text.length > 2500) return;    // too long · Runtime Core handles whole articles

    const cleanSection = currentSection.replace(/^#+\s*/, "").trim();
    snippets.push({
      id:           `${fileRelPath}#${cleanSection.replace(/[^\w-]/g, "-").slice(0, 60)}`,
      file:         fileRelPath,
      section:      cleanSection || "top",
      text,
      tokens:       tokenize(cleanSection + " " + text),
      is_question:  cleanSection.includes("?") || /^(Why|How|What|When|Should|Can|Is|Are|Do|Does|Which)\s/i.test(cleanSection),
      section_type: classifySection(cleanSection, text),
    });
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      commit();
      currentSection = h2[1];
      currentText = [];
      continue;
    }
    // skip the H1 itself (already captured as fileH1Title) · avoids duplicating
    if (/^#\s+/.test(line)) continue;
    // stop at horizontal rules within sections
    if (line.trim() === "---") continue;
    currentText.push(line);
  }
  commit();

  return snippets;
}

function findMarkdownFiles(dir: string, baseDir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    let stat;
    try { stat = statSync(abs); } catch { continue; }
    if (stat.isDirectory()) {
      results.push(...findMarkdownFiles(abs, baseDir));
    } else if (entry.endsWith(".md")) {
      results.push(normPath(relative(baseDir, abs)));
    }
  }
  return results;
}

let cachedIndex: IndexedSnippet[] | null = null;
let cachedApprovedFileList: string[] | null = null;

export type IndexStats = {
  approved_files: number;
  total_snippets: number;
  built_at:       string;
};
let cachedStats: IndexStats | null = null;

export function getTruthIndex(): IndexedSnippet[] {
  if (cachedIndex) return cachedIndex;
  const cwd = process.cwd();
  const rootAbs = join(cwd, CORPUS_ROOT);
  const allFiles = findMarkdownFiles(rootAbs, cwd);

  const approved: string[] = [];
  const snippets: IndexedSnippet[] = [];

  for (const relPath of allFiles) {
    try {
      const abs = join(cwd, relPath);
      const raw = readFileSync(abs, "utf8");
      // Contract check · Section 8.4 governance
      // Explicit opt-out beats pattern match · apprentice/internal never indexed
      if (hasAdvisorEvidenceOptOut(raw)) continue;
      // Philip 2026-08-01 · exclude internal templates / principle-demo files
      // even when they match an approved name pattern · prevents "This
      // specification demonstrates the 7 Levels of Understanding..." from
      // leaking into customer answers.
      if (isInternalTemplate(raw)) continue;
      const eligible = isApprovedByPath(relPath) || hasAdvisorEvidenceFlag(raw);
      if (!eligible) continue;
      approved.push(relPath);
      snippets.push(...splitFileIntoSnippets(relPath, abs));
    } catch {
      // skip unreadable
    }
  }

  cachedIndex = snippets;
  cachedApprovedFileList = approved;
  cachedStats = {
    approved_files: approved.length,
    total_snippets: snippets.length,
    built_at:       new Date().toISOString(),
  };
  return snippets;
}

export function getIndexStats(): IndexStats | null {
  if (!cachedIndex) getTruthIndex();
  return cachedStats;
}

export function getApprovedFiles(): string[] {
  if (!cachedApprovedFileList) getTruthIndex();
  return cachedApprovedFileList ?? [];
}
