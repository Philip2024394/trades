// Authoring reader (Philip 2026-08-01)
// Reads authoring files and their meta.json companions to produce the
// dashboard view · counts per status · sections sorted by traffic.

import "server-only";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { FileMeta, SectionMeta, SectionStatus } from "./writer";

const AUTHORING_ROOT = "data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-instances";

export type SectionListItem = {
  file_slug:    string;
  file_title:   string;
  section_id:   string;
  heading:      string;
  preview:      string;         // first 180 chars of body
  status:       SectionStatus;
  issues:       { code: string; severity: string; message: string }[];
  reviewed_at?: string;
  auto_published_at?: string;
  char_count:   number;
};

export type DashboardStats = {
  approved:    number;
  unreviewed:  number;
  needs_edit:  number;
  blocked:     number;
  rejected:    number;
  total_live:  number;   // approved + unreviewed (indexed by Nex)
  total_files: number;
};

function absDir(): string {
  return join(process.cwd(), AUTHORING_ROOT);
}

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const closeIdx = raw.indexOf("\n---", 3);
  if (closeIdx <= 0) return raw;
  return raw.slice(closeIdx + 4).replace(/^\r?\n/, "");
}

function extractSectionBody(mdContent: string, heading: string): string {
  const body = stripFrontmatter(mdContent);
  const lines = body.split("\n");
  let inTarget = false;
  const collected: string[] = [];
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      if (h2[1].trim() === heading) {
        inTarget = true;
        continue;
      }
      if (inTarget) break;
    }
    if (inTarget) collected.push(line);
  }
  return collected.join("\n").trim();
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

/** Read every authoring-produced file + meta, return flattened section list. */
export function listAllSections(): SectionListItem[] {
  const dir = absDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".meta.json"));
  const items: SectionListItem[] = [];

  for (const metaFile of files) {
    try {
      const metaRaw = readFileSync(join(dir, metaFile), "utf8");
      const meta: FileMeta = JSON.parse(metaRaw);
      const mdPath = join(dir, `${meta.file_slug}.md`);
      const mdRaw = existsSync(mdPath) ? readFileSync(mdPath, "utf8") : "";
      const bodyOnly = stripFrontmatter(mdRaw);

      // Reconstruct sections order from md file (matches meta sections)
      const headings: string[] = [];
      for (const line of bodyOnly.split("\n")) {
        const h2 = line.match(/^##\s+(.+?)\s*$/);
        if (h2) headings.push(h2[1].trim());
      }

      for (const heading of headings) {
        const sectionId = slugify(heading);
        const sectionMeta: SectionMeta | undefined = meta.sections[sectionId];
        const body = extractSectionBody(mdRaw, heading);
        items.push({
          file_slug:  meta.file_slug,
          file_title: meta.file_title,
          section_id: sectionId,
          heading,
          preview:    body.slice(0, 180),
          status:     sectionMeta?.status ?? "unreviewed",
          issues:     sectionMeta?.issues ?? [],
          reviewed_at:       sectionMeta?.reviewed_at,
          auto_published_at: sectionMeta?.auto_published_at,
          char_count: body.length,
        });
      }

      // Blocked sections (in meta but not in md) — still surface for review
      for (const [id, m] of Object.entries(meta.sections)) {
        if (m.status === "blocked" && !headings.some((h) => slugify(h) === id)) {
          items.push({
            file_slug:  meta.file_slug,
            file_title: meta.file_title,
            section_id: id,
            heading:    id.replace(/-/g, " "),
            preview:    "(blocked at parse · not saved to indexable file)",
            status:     "blocked",
            issues:     m.issues,
            char_count: 0,
          });
        }
      }
    } catch {
      // skip corrupt meta
    }
  }

  return items;
}

export function computeDashboardStats(): DashboardStats {
  const items = listAllSections();
  const counts = { approved: 0, unreviewed: 0, needs_edit: 0, blocked: 0, rejected: 0 };
  const files = new Set<string>();
  for (const item of items) {
    counts[item.status] = (counts[item.status] || 0) + 1;
    files.add(item.file_slug);
  }
  return {
    ...counts,
    total_live:  counts.approved + counts.unreviewed,
    total_files: files.size,
  };
}
