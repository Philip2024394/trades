// Authoring writer (Philip 2026-08-01)
// Persists parsed content as a .md file + companion .meta.json for per-section status.
//
// File layout:
//   data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/
//     staircase-instances/
//       nex-knowledge-base-{slug}.md         (content · matches APPROVED_FILE_PATTERNS)
//       nex-knowledge-base-{slug}.meta.json  (section statuses)

import "server-only";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ParsedSection, TopicType } from "./parser";

const AUTHORING_ROOT = "data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-instances";

export type SectionStatus = "unreviewed" | "approved" | "needs_edit" | "blocked" | "rejected";

export type SectionMeta = {
  status:            SectionStatus;
  issues:            { code: string; severity: string; message: string }[];
  reviewed_at?:      string;
  reviewed_by?:      string;
  auto_published_at: string;
};

export type FileMeta = {
  file_slug:      string;
  file_title:     string;
  authored_at:    string;
  authored_via:   "admin_authoring";
  sections:       Record<string, SectionMeta>;
};

function absDir(): string {
  const cwd = process.cwd();
  const dir = join(cwd, AUTHORING_ROOT);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function mdPath(fileSlug: string): string {
  return join(absDir(), `${fileSlug}.md`);
}

function metaPath(fileSlug: string): string {
  return join(absDir(), `${fileSlug}.meta.json`);
}

// Topic type → whether Advisor indexes for customer chat
// customer_facing + business = indexed for customers
// apprentice + internal_notes = stored but NOT indexed for customers
function isCustomerFacing(t: TopicType): boolean {
  return t === "customer_facing" || t === "business";
}

/** Compose the .md file body from parsed sections that are NOT blocked. */
function composeMarkdown(fileTitle: string, sections: ParsedSection[], topicType: TopicType = "customer_facing"): string {
  const now = new Date().toISOString();
  const advisorEvidence = isCustomerFacing(topicType) ? "true" : "false";
  const frontmatter = [
    "---",
    "brain: Staircase",
    `subject: ${fileTitle}`,
    "domain: Customer FAQ",
    "intent: Learn",
    "information_type: Overview",
    "type: nex_knowledge_base_article",
    "status: layer_1_evidence",
    "author: Philip O'Farrell",
    "source_type: authored",
    "extraction_method: admin_authoring_page",
    `extraction_date: ${now.split("T")[0]}`,
    `topic_type: ${topicType}`,
    `advisor_evidence: ${advisorEvidence}`,
    "rule_a_compliance: \"no fabrication · every section reviewed or auto-published via safety-checked pipeline\"",
    "rule_b_compliance: \"authored by Philip O'Farrell via admin authoring page\"",
    "rule_c_compliance: \"each section traces to admin authoring pipeline · metadata in .meta.json\"",
    "---",
    "",
    `# ${fileTitle}`,
    "",
  ];

  const sectionParts: string[] = [];
  for (const s of sections) {
    if (s.status === "blocked") continue; // blocked sections not written to indexable file
    sectionParts.push(`## ${s.heading}`);
    sectionParts.push("");
    sectionParts.push(s.body);
    sectionParts.push("");
  }

  return frontmatter.join("\n") + sectionParts.join("\n");
}

function composeMeta(fileTitle: string, fileSlug: string, sections: ParsedSection[]): FileMeta {
  const now = new Date().toISOString();
  const sectionsMeta: Record<string, SectionMeta> = {};
  for (const s of sections) {
    sectionsMeta[s.id] = {
      status:            s.status,
      issues:            s.issues.map((i) => ({ code: i.code, severity: i.severity, message: i.message })),
      auto_published_at: now,
    };
  }
  return {
    file_slug:    fileSlug,
    file_title:   fileTitle,
    authored_at:  now,
    authored_via: "admin_authoring",
    sections:     sectionsMeta,
  };
}

/** Write parsed content to disk · returns paths + counts. */
export function publishParsed(fileTitle: string, fileSlug: string, sections: ParsedSection[], topicType: TopicType = "customer_facing"): {
  md_path:  string;
  meta_path: string;
  written_sections: number;
  blocked_sections: number;
} {
  const md = composeMarkdown(fileTitle, sections, topicType);
  const meta = composeMeta(fileTitle, fileSlug, sections);

  const mdAbs = mdPath(fileSlug);
  const metaAbs = metaPath(fileSlug);

  writeFileSync(mdAbs, md, "utf8");
  writeFileSync(metaAbs, JSON.stringify(meta, null, 2), "utf8");

  return {
    md_path: mdAbs,
    meta_path: metaAbs,
    written_sections: sections.filter((s) => s.status !== "blocked").length,
    blocked_sections: sections.filter((s) => s.status === "blocked").length,
  };
}

// ─── Read / update helpers ────────────────────────────────────────

export function readMeta(fileSlug: string): FileMeta | null {
  const path = metaPath(fileSlug);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function writeMeta(fileSlug: string, meta: FileMeta): void {
  writeFileSync(metaPath(fileSlug), JSON.stringify(meta, null, 2), "utf8");
}

export function updateSectionStatus(
  fileSlug: string,
  sectionId: string,
  status: SectionStatus,
  reviewedBy = "Philip O'Farrell",
): boolean {
  const meta = readMeta(fileSlug);
  if (!meta) return false;
  const section = meta.sections[sectionId];
  if (!section) return false;
  section.status = status;
  section.reviewed_at = new Date().toISOString();
  section.reviewed_by = reviewedBy;
  writeMeta(fileSlug, meta);

  // On rejection · also strip the section from the indexable .md file so
  // Nex stops retrieving it. Meta keeps the "rejected" record.
  if (status === "rejected") {
    stripSectionFromMarkdown(fileSlug, sectionId);
  }

  return true;
}

/** Remove a section (heading + body) from the .md file. Idempotent. */
function stripSectionFromMarkdown(fileSlug: string, sectionId: string): void {
  const mdAbs = mdPath(fileSlug);
  if (!existsSync(mdAbs)) return;
  const raw = readFileSync(mdAbs, "utf8");
  const lines = raw.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      const slug = h2[1].toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
      if (slug === sectionId) { skipping = true; continue; }
      if (skipping) { skipping = false; }
    }
    if (!skipping) out.push(line);
  }
  writeFileSync(mdAbs, out.join("\n"), "utf8");
}

export function updateSectionBody(fileSlug: string, sectionId: string, newHeading: string, newBody: string): boolean {
  const mdAbs = mdPath(fileSlug);
  if (!existsSync(mdAbs)) return false;
  const raw = readFileSync(mdAbs, "utf8");

  // Simple in-place update: find matching ## Heading and replace body until next ## or EOF
  // For MVP simplicity we operate on the section id (slugified heading). We locate by
  // scanning sections in order and matching slugified heading.
  const lines = raw.split("\n");
  const newLines: string[] = [];
  let inTarget = false;
  let replaced = false;
  const targetSlug = sectionId;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      const currentSlug = h2[1].toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
      if (currentSlug === targetSlug && !replaced) {
        newLines.push(`## ${newHeading}`);
        newLines.push("");
        newLines.push(newBody);
        newLines.push("");
        inTarget = true;
        replaced = true;
        continue;
      }
      if (inTarget) {
        inTarget = false;
      }
    }
    if (!inTarget) newLines.push(line);
  }

  writeFileSync(mdAbs, newLines.join("\n"), "utf8");
  return replaced;
}
