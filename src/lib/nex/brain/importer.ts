// NEX Brain · Importer for existing knowledge records
//
// Walks data/knowledge/records/**/*.md and materialises each governed
// record into the brain tables (knowledge_records + graph_edges +
// confidence_scores + sources). Idempotent: re-running upserts on
// record_id, so it's safe to invoke whenever new records are authored
// on disk.
//
// This is what turns the 22 markdown records already sitting in the
// repo into brain-queryable data — the seeding step before the pipeline
// takes over the authoring.

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { brainStore, nowIso } from "./storage";
import type {
  Audience,
  ClaimClassification,
  ConfidenceBand,
  KnowledgeRecord,
  RecordStatus,
} from "./types";

const RECORDS_ROOT = path.join(process.cwd(), "data", "knowledge", "records");

// ── Public API ───────────────────────────────────────────────────────

export type ImportReport = {
  scanned: number;
  imported: number;
  skipped_already_up_to_date: number;
  updated: number;
  errors: Array<{ file: string; error: string }>;
  edges_created: number;
  claims_created: number;
};

export async function importExistingRecords(): Promise<ImportReport> {
  const store = brainStore();
  const files = await findMarkdownFiles(RECORDS_ROOT);

  const report: ImportReport = {
    scanned: files.length,
    imported: 0,
    skipped_already_up_to_date: 0,
    updated: 0,
    errors: [],
    edges_created: 0,
    claims_created: 0,
  };

  // First pass — parse every file so we know which record_ids will
  // exist after import. Any edge whose target isn't in this set is a
  // legitimate gap marker (Constitution Clause 8 — never invent).
  const parsedFiles: Array<{ file: string; parsed: ParsedRecord }> = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = parseRecordFile(raw);
      if (parsed) parsedFiles.push({ file, parsed });
      else report.errors.push({ file: relPath(file), error: "no valid frontmatter" });
    } catch (err) {
      report.errors.push({ file: relPath(file), error: (err as Error).message });
    }
  }
  const knownRecordIds = new Set(parsedFiles.map((p) => p.parsed.record_id));

  // Second pass — insert records + edges (with correct is_gap_marker) + claims.
  for (const { file, parsed } of parsedFiles) {
    try {
      const existing = await store.getRecord(parsed.record_id);
      if (existing && existing.record_version === parsed.record_version) {
        report.skipped_already_up_to_date += 1;
      } else if (existing) {
        // v1 policy: log the update to record_versions and leave existing
        // knowledge_records row intact. Full re-materialisation lands
        // when we build a proper diff-import in Phase 2.
        await store.insertVersion({
          record_id: parsed.record_id,
          version: parsed.record_version,
          body_markdown: parsed.body_markdown,
          change_summary: `Importer re-imported from disk file ${relPath(file)}`,
          changed_by: "importer",
        });
        report.updated += 1;
      } else {
        // Fresh import
        const inserted = await store.insertRecord({
          record_id: parsed.record_id,
          record_version: parsed.record_version,
          status: parsed.status,
          supersedes: null,
          canonical_owner: parsed.canonical_owner,
          authored_by: parsed.authored_by,
          authorised_by: parsed.authorised_by,
          reviewed_by: parsed.reviewed_by,
          title: parsed.title,
          category: parsed.category,
          subcategory: parsed.subcategory,
          summary: parsed.summary,
          body_markdown: parsed.body_markdown,
          industry_concepts: parsed.industry_concepts,
          nex_concepts: parsed.nex_concepts,
          primary_audience: parsed.primary_audience,
          alt_audiences: parsed.alt_audiences,
          sustainability_alert: parsed.sustainability_alert,
          embedding: null,
          last_reviewed_at: parsed.last_reviewed ?? null,
          review_due_at: parsed.review_due ?? null,
          deprecated_at: null,
        });
        report.imported += 1;

        // Version history entry for the fresh import
        await store.insertVersion({
          record_id: inserted.record_id,
          version: parsed.record_version,
          body_markdown: parsed.body_markdown,
          change_summary: `Initial import from disk file ${relPath(file)}`,
          changed_by: "importer",
        });

        // Claims → confidence_scores
        for (const [i, claim] of parsed.claims.entries()) {
          await store.insertConfidence({
            record_id: inserted.record_id,
            claim_key: claim.claim_key ?? `claim_${i + 1}`,
            claim_text: claim.claim_text,
            classification: claim.classification,
            confidence_band: claim.confidence_band,
            confidence_score: claim.confidence_score ?? null,
            source_type: claim.source_type ?? null,
            source_ref: claim.source_ref ?? null,
            verification_date: claim.verification_date ?? null,
            rationale: claim.rationale ?? null,
          });
          report.claims_created += 1;
        }

        // Edges → graph_edges. Mark as gap_marker if the target isn't
        // one of the records we're importing (Constitution Clause 8).
        for (const edge of parsed.edges) {
          const isGap = edge.is_gap_marker || !knownRecordIds.has(edge.to_record_id);
          await store.insertEdge({
            from_record_id: inserted.record_id,
            to_record_id: edge.to_record_id,
            edge_type: edge.edge_type,
            confidence: null,
            provenance: `importer:${relPath(file)}`,
            is_gap_marker: isGap,
          });
          report.edges_created += 1;
        }

        // Source lineage — mark these as claude-generated (they were
        // authored in Claude Code sessions with Philip's approval).
        await store.insertSource({
          record_id: inserted.record_id,
          inbox_item_id: null,
          source_tier: "claude-generated",
          source_url: null,
          source_hash: null,
          excerpt: `Imported from ${relPath(file)}`,
        });

        // Audit
        await store.insertAudit({
          entity_type: "knowledge_records",
          entity_id: inserted.record_id,
          action: "import",
          actor: "importer",
          before_state: null,
          after_state: { status: parsed.status, file: relPath(file) },
          notes: `Imported governed record from ${relPath(file)}`,
        });
      }
    } catch (err) {
      report.errors.push({ file: relPath(file), error: (err as Error).message });
    }
  }

  return report;
}

// ── Filesystem walk ─────────────────────────────────────────────────

async function findMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return out;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findMarkdownFiles(full);
      out.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      out.push(full);
    }
  }
  return out;
}

function relPath(abs: string): string {
  return path.relative(process.cwd(), abs).replace(/\\/g, "/");
}

// ── Parser ──────────────────────────────────────────────────────────
//
// The record files use YAML frontmatter + a markdown body with
// specific section headings ("## Claims (Structured with Evidence)"
// etc.). We do lightweight extraction rather than a strict YAML parse
// because the records include multi-line YAML that would require a
// dependency. Purpose-built parser is enough for known-shape files.

type ParsedClaim = {
  claim_key?: string;
  claim_text: string;
  classification: ClaimClassification;
  confidence_band: ConfidenceBand;
  confidence_score?: number;
  source_type?: string;
  source_ref?: string;
  verification_date?: string;
  rationale?: string;
};

type ParsedEdge = {
  to_record_id: string;
  edge_type: string;
  is_gap_marker: boolean;
};

type ParsedRecord = {
  record_id: string;
  record_version: string;
  status: RecordStatus;
  canonical_owner: string;
  authored_by: string;
  authorised_by: string | null;
  reviewed_by: string | null;
  title: string;
  category: string;
  subcategory: string | null;
  summary: string;
  body_markdown: string;
  industry_concepts: string[];
  nex_concepts: string[];
  primary_audience: Audience;
  alt_audiences: Audience[];
  sustainability_alert: { active: boolean; severity?: string; notes?: string } | null;
  last_reviewed: string | null;
  review_due: string | null;
  claims: ParsedClaim[];
  edges: ParsedEdge[];
};

function parseRecordFile(raw: string): ParsedRecord | null {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) return null;
  const frontmatter = fmMatch[1];
  const body = fmMatch[2];

  const record_id = extractYamlScalar(frontmatter, "record_id");
  if (!record_id) return null;

  const record_version = extractYamlScalar(frontmatter, "record_version") ?? "1.0.0";
  const rawStatus = extractYamlScalar(frontmatter, "status") ?? "AUTHORITATIVE";
  const status = coerceStatus(rawStatus);
  const title = extractYamlScalar(frontmatter, "title") ?? record_id;
  const category = extractYamlScalar(frontmatter, "category") ?? "NEX Uncategorised";
  const subcategory = extractYamlScalar(frontmatter, "subcategory");
  const primaryAudience = coerceAudience(extractYamlScalar(frontmatter, "primary_audience"));
  const altAudiences = extractYamlListScalars(frontmatter, "alt_audiences")
    .map(coerceAudience);

  const last_reviewed = extractYamlScalar(frontmatter, "last_reviewed") ?? null;
  const review_due = extractYamlScalar(frontmatter, "review_due") ?? null;
  const reviewed_by = extractYamlScalar(frontmatter, "reviewed_by") ?? null;

  // Owner (nested)
  const canonical_owner =
    extractNestedScalar(frontmatter, "owner", "canonical_owner") ??
    `NEX ${category} · Imported record`;
  const authored_by =
    extractNestedScalar(frontmatter, "owner", "authored_by") ?? "unknown";
  const authorised_by = extractNestedScalar(frontmatter, "owner", "authorised_by");

  // Sustainability alert (nested optional)
  const alertActive = extractNestedScalar(frontmatter, "sustainability_alert", "active");
  const sustainability_alert =
    alertActive !== null
      ? {
          active: /^true$/i.test(alertActive),
          severity:
            extractNestedScalar(frontmatter, "sustainability_alert", "severity") ?? undefined,
          notes:
            extractNestedScalar(frontmatter, "sustainability_alert", "notes") ?? undefined,
        }
      : null;

  // Body-derived fields
  const summary = extractBodySection(body, "Summary") ?? title;
  const industry_concepts = extractConceptList(body, "Industry Knowledge");
  const nex_concepts = extractConceptList(body, "NEX Concepts");
  const claims = extractClaims(body);
  const edges = extractEdges(body);

  return {
    record_id,
    record_version,
    status,
    canonical_owner,
    authored_by,
    authorised_by,
    reviewed_by,
    title,
    category,
    subcategory,
    summary: summary.slice(0, 2000),
    body_markdown: body,
    industry_concepts,
    nex_concepts,
    primary_audience: primaryAudience,
    alt_audiences: altAudiences,
    sustainability_alert,
    last_reviewed,
    review_due,
    claims,
    edges,
  };
}

// ── YAML mini-parser (top-level scalars + one level of nesting) ─────

function extractYamlScalar(fm: string, key: string): string | null {
  const line = fm.match(new RegExp(`^${escapeRegex(key)}\\s*:\\s*(.+)$`, "m"));
  if (!line) return null;
  return unquote(line[1].trim());
}

function extractNestedScalar(fm: string, parent: string, child: string): string | null {
  // Match a two-level structure:
  //   parent:
  //     child: value
  //     child2: value
  const parentIdx = fm.search(new RegExp(`^${escapeRegex(parent)}\\s*:\\s*$`, "m"));
  if (parentIdx < 0) return null;
  const after = fm.slice(parentIdx);
  const line = after.match(new RegExp(`^\\s+${escapeRegex(child)}\\s*:\\s*(.+)$`, "m"));
  if (!line) return null;
  return unquote(line[1].trim());
}

function extractYamlListScalars(fm: string, key: string): string[] {
  // Handles inline form: `key: [a, b, c]`
  const line = fm.match(new RegExp(`^${escapeRegex(key)}\\s*:\\s*\\[(.+?)\\]$`, "m"));
  if (line) {
    return line[1]
      .split(",")
      .map((s) => unquote(s.trim()))
      .filter(Boolean);
  }
  // Block form:
  //   key:
  //     - a
  //     - b
  const start = fm.search(new RegExp(`^${escapeRegex(key)}\\s*:\\s*$`, "m"));
  if (start < 0) return [];
  const remainder = fm.slice(start).split("\n").slice(1);
  const out: string[] = [];
  for (const l of remainder) {
    const m = l.match(/^\s+-\s+(.+)$/);
    if (m) out.push(unquote(m[1].trim()));
    else if (/^\S/.test(l)) break; // hit next top-level key
  }
  return out;
}

function unquote(s: string): string {
  const m = s.match(/^["'](.*)["']$/);
  return m ? m[1] : s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Body-section extractors ─────────────────────────────────────────

function extractBodySection(body: string, heading: string): string | null {
  // Match "## Summary" (or with different levels) up to the next ##
  const rx = new RegExp(`^#{2,3}\\s+${escapeRegex(heading)}\\s*$`, "im");
  const start = body.search(rx);
  if (start < 0) return null;
  const afterStart = body.slice(start).split("\n").slice(1); // drop the heading line
  const collected: string[] = [];
  for (const line of afterStart) {
    if (/^#{2,3}\s+/.test(line)) break;
    collected.push(line);
  }
  return collected.join("\n").trim();
}

function extractConceptList(body: string, subheading: string): string[] {
  const rx = new RegExp(`^#{2,3}\\s+${escapeRegex(subheading)}\\s*$`, "im");
  const start = body.search(rx);
  if (start < 0) return [];
  const afterStart = body.slice(start).split("\n").slice(1);
  const out: string[] = [];
  for (const line of afterStart) {
    if (/^#{2,3}\s+/.test(line)) break;
    const m = line.match(/^-\s+\*\*([^*]+)\*\*/) || line.match(/^-\s+(.+?)(?:\s+—.*)?$/);
    if (m) out.push(m[1].trim());
  }
  return out.slice(0, 40);
}

function extractClaims(body: string): ParsedClaim[] {
  // The claims section uses YAML-like blocks. We look for the "## Claims"
  // section and parse each `- claim:` block. Fault-tolerant — anything
  // that doesn't parse cleanly is skipped rather than crashing the import.
  const heading = body.search(/^##\s+Claims\b/im);
  if (heading < 0) return [];
  // Slice from the heading, then find the NEXT ## after this one to bound
  // the section. Splitting by /^##\s+/m from position 0 gave us [""] because
  // the string starts with "##" — so we walk to the next heading instead.
  const fromHeading = body.slice(heading);
  const nextHeadingRelative = fromHeading.slice(2).search(/^##\s+/m);
  const section = nextHeadingRelative >= 0
    ? fromHeading.slice(0, nextHeadingRelative + 2)
    : fromHeading;
  const blocks = section.split(/^-\s+claim:\s*/m).slice(1);
  const claims: ParsedClaim[] = [];
  for (const block of blocks) {
    // Each block runs from the claim's opening line until the next
    // '- claim:' (already split out) OR the section end. Split at
    // blank line gives us the "first paragraph" which contains the
    // opening claim text + its inline fields.
    const first = block.split(/\n\s*\n/)[0] ?? block;
    const firstLine = first.split("\n")[0]?.trim() ?? "";
    const claim_text = unquote(firstLine).replace(/^"|"$/g, "");
    const classification = coerceClassification(
      pickField(first, "classification") ?? "industry_consensus"
    );
    const confidence_band = coerceConfidenceBand(pickField(first, "confidence") ?? "medium");
    const score = Number(pickField(first, "confidence_score"));
    const source_type = pickField(first, "source_type") ?? undefined;
    const source_ref = pickField(first, "source_ref") ?? undefined;
    const verification_date = pickField(first, "verification_date") ?? undefined;
    const rationale = pickField(first, "rationale") ?? undefined;
    if (!claim_text || claim_text.length < 4) continue;
    claims.push({
      claim_text: claim_text.slice(0, 1200),
      classification,
      confidence_band,
      confidence_score: Number.isFinite(score) ? score : undefined,
      source_type,
      source_ref,
      verification_date,
      rationale,
    });
  }
  return claims;
}

function pickField(block: string, key: string): string | null {
  const m = block.match(new RegExp(`\\b${escapeRegex(key)}\\s*:\\s*(.+)`, "i"));
  return m ? unquote(m[1].trim()) : null;
}

function extractEdges(body: string): ParsedEdge[] {
  // Look for the "Relationships" section which uses a YAML fence like:
  //   ```yaml
  //   composes_material:
  //     - materials_beech_v1
  //   used_for:
  //     - components_stair_handrails_v1
  //   ```
  const rel = body.search(/^##\s+Relationships/im);
  if (rel < 0) return [];
  const section = body.slice(rel);
  const fenceMatch = section.match(/```yaml\s*\n([\s\S]*?)\n```/);
  if (!fenceMatch) return [];
  const yaml = fenceMatch[1];
  const lines = yaml.split("\n");
  const edges: ParsedEdge[] = [];
  let currentType: string | null = null;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    const typeMatch = line.match(/^([a-z_]+)\s*:\s*$/i);
    if (typeMatch) {
      currentType = typeMatch[1];
      continue;
    }
    const listMatch = line.match(/^\s+-\s+([A-Za-z0-9_.-]+)/);
    if (listMatch && currentType) {
      const target = listMatch[1];
      const isGap = target.includes("to_be_authored") || target.endsWith("_TBA");
      edges.push({
        to_record_id: target,
        edge_type: currentType,
        is_gap_marker: isGap,
      });
    }
  }
  return edges;
}

// ── Coercers ────────────────────────────────────────────────────────

function coerceStatus(raw: string): RecordStatus {
  const s = raw.trim().toUpperCase();
  const allowed: RecordStatus[] = ["DRAFT", "UNDER_REVIEW", "AUTHORITATIVE", "DEPRECATED", "SUPERSEDED"];
  return (allowed as string[]).includes(s) ? (s as RecordStatus) : "AUTHORITATIVE";
}

function coerceAudience(raw: string | null | undefined): Audience {
  if (!raw) return "homeowner";
  const s = raw.trim().toLowerCase();
  if (s === "manufacturer" || s === "engineer" || s === "homeowner") return s;
  return "homeowner";
}

function coerceClassification(raw: string): ClaimClassification {
  const s = raw.trim().toLowerCase().replace(/[^a-z_]/g, "_");
  const allowed: ClaimClassification[] = [
    "established_practice",
    "industry_consensus",
    "design_opinion",
    "experimental_concept",
    "NEX_concept",
  ];
  const found = allowed.find((c) => c.toLowerCase() === s);
  return found ?? "industry_consensus";
}

function coerceConfidenceBand(raw: string): ConfidenceBand {
  const s = raw.trim().toLowerCase();
  if (s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}
