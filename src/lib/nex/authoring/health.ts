// Knowledge Health Dashboard (Philip 2026-08-01)
//
// Instant picture of the Brain state · one number per metric · surfaces
// issues (empty sections · unindexed candidates · missing semantic index)
// so Philip can see the state without reading through files.

import "server-only";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { getTruthIndex } from "@/lib/nex/staircase-advisor/truth-index";
import { getSemanticIndexStats } from "@/lib/nex/staircase-advisor/semantic-index";

const CORPUS_ROOT = "data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell";

// Same approved patterns used by Truth Index · keep in sync
const APPROVED_FILE_PATTERNS: RegExp[] = [
  /\/staircase-design-principles\.md$/,
  /\/customer-faq-staircase\.md$/,
  /\/customer-buying-guide-principles\.md$/,
  /\/staircase-market-trends\.md$/,
  /\/staircase-category-taxonomy\.md$/,
  /\/staircase-type-profiles\/[^/]+\.md$/,
  /\/wood-intelligence-principles\.md$/,
  /\/nex-knowledge-base-[^/]+\.md$/,
  /\/nex-customer-faq-[^/]+\.md$/,
  /\/nex-premium-[^/]+\.md$/,
  /\/nex-component-recognition-[^/]+\.md$/,
  /\/material-profile-[^/]+\.md$/,
  /\/staircase-installation-techniques\.md$/,
  /\/staircase-brain-membership-criteria\.md$/,
  /\/business-operations-principles\.md$/,
  /\/purchasing-principles\.md$/,
];

// Families we know are internal-only · used for "correctly excluded" count
const KNOWN_EXCLUDED_PATTERNS: RegExp[] = [
  /\/apprenticeship-lesson-[^/]+\.md$/,
  /\/nex-cko-[^/]+\.md$/,
  /\/nex-dna-[^/]+\.md$/,
  /\/nex-cognitive-[^/]+\.md$/,
  /\/nex-conversation-[^/]+\.md$/,
  /\/nex-creative-process-[^/]+\.md$/,
  /\/image-purpose-taxonomy\.md$/,
];

function normPath(p: string): string {
  return p.split(sep).join("/");
}

function findMdFiles(dir: string, base: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    let stat;
    try { stat = statSync(abs); } catch { continue; }
    if (stat.isDirectory()) {
      out.push(...findMdFiles(abs, base));
    } else if (entry.endsWith(".md")) {
      out.push(normPath(abs.replace(base, "").replace(/^[/\\]/, "")));
    }
  }
  return out;
}

function isApproved(relPath: string): boolean {
  return APPROVED_FILE_PATTERNS.some((p) => p.test(relPath));
}

function isKnownExcluded(relPath: string): boolean {
  return KNOWN_EXCLUDED_PATTERNS.some((p) => p.test(relPath));
}

export type KnowledgeHealth = {
  total_files:              number;
  indexed_files:            number;
  excluded_files:           number;
  candidate_files:          number;   // exists but neither indexed nor explicitly excluded
  total_lines:              number;
  indexed_lines:            number;
  total_sections:           number;
  indexed_sections:         number;
  empty_sections:           number;   // sections < 60 chars body (blocked by parser)
  semantic_ready:           boolean;
  semantic_snippet_count:   number;
  semantic_built_at:        string | null;
  runtime_core_files:       number;   // files in wider nex-reference-brains folder
  candidates: string[];                // filenames waiting for indexing decision
  excluded_by_category: Record<string, number>;
};

export function computeKnowledgeHealth(): KnowledgeHealth {
  const cwd = process.cwd();
  const rootAbs = join(cwd, CORPUS_ROOT);
  const files = findMdFiles(rootAbs, rootAbs);

  let totalLines = 0;
  let indexedLines = 0;
  let totalSections = 0;
  const indexedFiles: string[] = [];
  const excludedFiles: string[] = [];
  const candidateFiles: string[] = [];

  for (const rel of files) {
    let raw = "";
    try { raw = readFileSync(join(rootAbs, rel), "utf8"); } catch { continue; }
    const lines = raw.split("\n").length;
    totalLines += lines;

    if (isApproved(rel)) {
      indexedFiles.push(rel);
      indexedLines += lines;
      const sectionCount = (raw.match(/^##\s+/gm) ?? []).length;
      totalSections += sectionCount;
    } else if (isKnownExcluded(rel)) {
      excludedFiles.push(rel);
    } else {
      candidateFiles.push(rel);
    }
  }

  // Load Truth Index for indexed_sections + empty_sections
  const indexedSnippets = getTruthIndex();
  const indexedSectionCount = indexedSnippets.length;
  const emptySections = indexedSnippets.filter((s) => s.text.length < 100).length;

  // Semantic index status
  const semanticStats = getSemanticIndexStats();
  const semanticReady = semanticStats.snippet_count > 0;

  // Runtime Core folder count (wider corpus)
  const runtimeRoot = join(cwd, "data/nex-reference-brains");
  const runtimeFiles = findMdFiles(runtimeRoot, runtimeRoot).length;

  // Categorise excluded
  const byCategory: Record<string, number> = {};
  for (const rel of excludedFiles) {
    let category = "other";
    if (/apprenticeship-lesson/.test(rel)) category = "apprentice training";
    else if (/nex-cko-/.test(rel)) category = "cognitive knowledge objects";
    else if (/nex-dna-/.test(rel)) category = "image DNA tokens";
    else if (/nex-cognitive-/.test(rel)) category = "voice/tuning guidelines";
    else if (/nex-conversation-/.test(rel)) category = "conversation voice";
    else if (/nex-creative-process-/.test(rel)) category = "image workflow";
    else if (/image-purpose-taxonomy/.test(rel)) category = "internal taxonomy";
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  }

  return {
    total_files:            files.length,
    indexed_files:          indexedFiles.length,
    excluded_files:         excludedFiles.length,
    candidate_files:        candidateFiles.length,
    total_lines:            totalLines,
    indexed_lines:          indexedLines,
    total_sections:         totalSections,
    indexed_sections:       indexedSectionCount,
    empty_sections:         emptySections,
    semantic_ready:         semanticReady,
    semantic_snippet_count: semanticStats.snippet_count,
    semantic_built_at:      semanticStats.built_at,
    runtime_core_files:     runtimeFiles,
    candidates:             candidateFiles,
    excluded_by_category:   byCategory,
  };
}
