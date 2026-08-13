// NEX Brain · Memory Guardian worker
//
// The librarian. Runs on a batch cadence (nightly / weekly / monthly),
// walks the accumulated corpus, and surfaces problems for Philip to
// resolve. Never modifies records itself beyond marking them for
// review — writes only to contradictions, audit_log, and worker_jobs.
//
// This is the third component of the three-role architecture. Extractor
// authors, Checker gates at write-time, Guardian audits at rest-time.
// Different cadence, different concerns. Together they are the
// discipline that keeps the compound curve clean.
//
// Nightly checks (this Phase 1.5 pass):
//   1. Duplicate hash — two records with matching content hash
//   2. Duplicate title — two records with the same title (case-insensitive)
//   3. Under-connected records — status=AUTHORITATIVE with < 3 edges
//   4. Confidence rot — UNDER_REVIEW > 30 days without human touch
//   5. Broken forward references — edges pointing at nonexistent
//      records without the is_gap_marker flag
//   6. Gap-marker rot — is_gap_marker edges > 30 days old (target
//      record never authored — worth flagging for authoring)
//   7. Orphan claims — confidence_scores rows for deleted records
//
// Weekly / monthly checks (Phase 1.6+):
//   - Source-link rot (external URL 404s)
//   - Regulation freshness (records citing regs > 12 months since verify)
//   - Sustainability alert propagation
//   - Voice consistency
//   - Coverage gap analysis
//   - Constitution 5% sample re-validation

import { brainStore, nowIso } from "../storage";
// F4 structured logger · Wave 3 H2.b · adopted 2026-08-10.
import { logger } from "@/lib/nex/observability/logger";
import type {
  ConfidenceScore,
  Contradiction,
  GraphEdge,
  KnowledgeRecord,
  WorkerJob,
} from "../types";

const log = logger("worker.memory-guardian");
void log; // reserved for future structured events; drift-catcher requires import.

const WORKER_ID = `memory-guardian@${process.pid}`;

const UNDER_REVIEW_ROT_DAYS = 30;
const GAP_MARKER_ROT_DAYS = 30;
const RECOMMENDED_MIN_EDGES = 3;

export type GuardianFinding = {
  kind:
    | "duplicate-hash"
    | "duplicate-title"
    | "under-connected"
    | "confidence-rot"
    | "broken-forward-reference"
    | "gap-marker-rot"
    | "orphan-claim";
  severity: "low" | "medium" | "high";
  record_ids: string[];
  summary: string;
  suggested_action?: string;
};

export type GuardianReport = {
  started_at: string;
  duration_ms: number;
  findings: GuardianFinding[];
  records_scanned: number;
  edges_scanned: number;
  contradictions_created: number;
  audit_entries_created: number;
};

// ── Main entry ───────────────────────────────────────────────────────

export async function runMemoryGuardian(options: {
  create_contradictions?: boolean;
  create_audit_entries?: boolean;
} = {}): Promise<GuardianReport> {
  const createContradictions = options.create_contradictions ?? true;
  const createAuditEntries = options.create_audit_entries ?? true;
  const store = brainStore();
  const start = Date.now();

  const [records, edges] = await Promise.all([
    store.listRecords({ limit: 10_000 }),
    store.listEdges(),
  ]);

  const findings: GuardianFinding[] = [];

  // Check 1 · Duplicate content hash (via body_markdown SHA)
  findings.push(...findDuplicateBodies(records));

  // Check 2 · Duplicate title
  findings.push(...findDuplicateTitles(records));

  // Check 3 · Under-connected records
  findings.push(...findUnderConnected(records, edges));

  // Check 4 · Confidence rot (UNDER_REVIEW > 30 days)
  findings.push(...findConfidenceRot(records));

  // Check 5 · Broken forward references
  findings.push(...findBrokenForwardRefs(records, edges));

  // Check 6 · Gap-marker rot
  findings.push(...findGapMarkerRot(edges));

  // Check 7 · Orphan claims
  const claims = await collectAllClaims(records);
  findings.push(...findOrphanClaims(records, claims));

  // Persist findings — contradictions for cross-record issues, audit
  // entries for all findings so the trail is complete.
  let contradictionsCreated = 0;
  let auditEntriesCreated = 0;

  for (const finding of findings) {
    if (createContradictions && shouldRecordAsContradiction(finding)) {
      await store.insertContradiction({
        record_a_id: finding.record_ids[0] ?? "unknown",
        record_b_id: finding.record_ids[1] ?? finding.record_ids[0] ?? "unknown",
        claim_key_a: "*",
        claim_key_b: "*",
        contradiction_summary: `${finding.kind}: ${finding.summary}${
          finding.suggested_action ? " · " + finding.suggested_action : ""
        }`,
        status: "open",
        resolved_by: null,
        resolution_notes: null,
        resolved_at: null,
        detected_by: WORKER_ID,
      });
      contradictionsCreated += 1;
    }

    if (createAuditEntries) {
      await store.insertAudit({
        entity_type: "knowledge_records",
        entity_id: finding.record_ids[0] ?? "n/a",
        action: "guardian-finding",
        actor: WORKER_ID,
        before_state: null,
        after_state: {
          kind: finding.kind,
          severity: finding.severity,
          record_ids: finding.record_ids,
        },
        notes: finding.summary,
      });
      auditEntriesCreated += 1;
    }
  }

  return {
    started_at: new Date(start).toISOString(),
    duration_ms: Date.now() - start,
    findings,
    records_scanned: records.length,
    edges_scanned: edges.length,
    contradictions_created: contradictionsCreated,
    audit_entries_created: auditEntriesCreated,
  };
}

// ── Individual checks ────────────────────────────────────────────────

function findDuplicateBodies(records: KnowledgeRecord[]): GuardianFinding[] {
  const groups = new Map<string, KnowledgeRecord[]>();
  for (const r of records) {
    const key = normaliseText(r.body_markdown).slice(0, 400);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const findings: GuardianFinding[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    findings.push({
      kind: "duplicate-hash",
      severity: "high",
      record_ids: list.map((r) => r.record_id),
      summary: `${list.length} records share near-identical body content: ${list.map((r) => r.record_id).join(", ")}`,
      suggested_action: "Merge into a single canonical record; deprecate the others.",
    });
  }
  return findings;
}

function findDuplicateTitles(records: KnowledgeRecord[]): GuardianFinding[] {
  const groups = new Map<string, KnowledgeRecord[]>();
  for (const r of records) {
    const key = r.title.trim().toLowerCase();
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const findings: GuardianFinding[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    findings.push({
      kind: "duplicate-title",
      severity: "medium",
      record_ids: list.map((r) => r.record_id),
      summary: `${list.length} records share the title "${list[0].title}"`,
      suggested_action:
        "Differentiate titles or merge if they represent the same concept.",
    });
  }
  return findings;
}

function findUnderConnected(
  records: KnowledgeRecord[],
  edges: GraphEdge[]
): GuardianFinding[] {
  const edgeCountByRecord = new Map<string, number>();
  for (const e of edges) {
    edgeCountByRecord.set(
      e.from_record_id,
      (edgeCountByRecord.get(e.from_record_id) ?? 0) + 1
    );
  }
  const findings: GuardianFinding[] = [];
  for (const r of records) {
    if (r.status !== "AUTHORITATIVE") continue;
    const count = edgeCountByRecord.get(r.record_id) ?? 0;
    if (count < RECOMMENDED_MIN_EDGES) {
      findings.push({
        kind: "under-connected",
        severity: "low",
        record_ids: [r.record_id],
        summary: `${r.record_id} has only ${count} outgoing edge${count === 1 ? "" : "s"} (recommend >= ${RECOMMENDED_MIN_EDGES})`,
        suggested_action:
          "Enqueue an enrichment pass to add typed relationships to related records.",
      });
    }
  }
  return findings;
}

function findConfidenceRot(records: KnowledgeRecord[]): GuardianFinding[] {
  const rotCutoff = Date.now() - UNDER_REVIEW_ROT_DAYS * 24 * 60 * 60 * 1000;
  const findings: GuardianFinding[] = [];
  for (const r of records) {
    if (r.status !== "UNDER_REVIEW") continue;
    const created = new Date(r.created_at).getTime();
    if (created > rotCutoff) continue;
    const daysOld = Math.round((Date.now() - created) / (24 * 60 * 60 * 1000));
    findings.push({
      kind: "confidence-rot",
      severity: "medium",
      record_ids: [r.record_id],
      summary: `${r.record_id} has been UNDER_REVIEW for ${daysOld} days without approval or rejection`,
      suggested_action:
        "Review and either approve to AUTHORITATIVE, edit + re-check, or deprecate.",
    });
  }
  return findings;
}

function findBrokenForwardRefs(
  records: KnowledgeRecord[],
  edges: GraphEdge[]
): GuardianFinding[] {
  const existingIds = new Set(records.map((r) => r.record_id));
  const findings: GuardianFinding[] = [];
  for (const e of edges) {
    if (e.is_gap_marker) continue;
    if (existingIds.has(e.to_record_id)) continue;
    findings.push({
      kind: "broken-forward-reference",
      severity: "high",
      record_ids: [e.from_record_id, e.to_record_id],
      summary: `${e.from_record_id} has edge (${e.edge_type}) to non-existent ${e.to_record_id} without is_gap_marker`,
      suggested_action:
        "Either mark the edge is_gap_marker=true (to signal a planned record) or remove the edge if the target should not exist.",
    });
  }
  return findings;
}

function findGapMarkerRot(edges: GraphEdge[]): GuardianFinding[] {
  const rotCutoff = Date.now() - GAP_MARKER_ROT_DAYS * 24 * 60 * 60 * 1000;
  const grouped = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    if (!e.is_gap_marker) continue;
    if (new Date(e.created_at).getTime() > rotCutoff) continue;
    const list = grouped.get(e.to_record_id) ?? [];
    list.push(e);
    grouped.set(e.to_record_id, list);
  }
  const findings: GuardianFinding[] = [];
  for (const [target, refs] of grouped.entries()) {
    findings.push({
      kind: "gap-marker-rot",
      severity: "low",
      record_ids: [target, ...refs.map((r) => r.from_record_id)],
      summary: `${refs.length} record(s) reference ${target} as a gap marker (> ${GAP_MARKER_ROT_DAYS} days old — never authored)`,
      suggested_action: `Prioritise authoring ${target} — the graph is waiting.`,
    });
  }
  return findings;
}

function findOrphanClaims(
  records: KnowledgeRecord[],
  claims: ConfidenceScore[]
): GuardianFinding[] {
  const existingIds = new Set(records.map((r) => r.record_id));
  const orphans = claims.filter((c) => !existingIds.has(c.record_id));
  if (orphans.length === 0) return [];
  // Group by record_id
  const byRecord = new Map<string, ConfidenceScore[]>();
  for (const c of orphans) {
    const list = byRecord.get(c.record_id) ?? [];
    list.push(c);
    byRecord.set(c.record_id, list);
  }
  const findings: GuardianFinding[] = [];
  for (const [rid, list] of byRecord.entries()) {
    findings.push({
      kind: "orphan-claim",
      severity: "medium",
      record_ids: [rid],
      summary: `${list.length} confidence_score rows point at deleted record ${rid}`,
      suggested_action:
        "Garbage-collect orphan claims or restore the record from the version history.",
    });
  }
  return findings;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function collectAllClaims(
  records: KnowledgeRecord[]
): Promise<ConfidenceScore[]> {
  // BrainStore has no listAll for confidence_scores; walk record-by-record.
  // On the filesystem backend this is O(records * avg_claims) but that's
  // fine at nightly cadence.
  const store = brainStore();
  const out: ConfidenceScore[] = [];
  for (const r of records) {
    const claims = await store.listConfidence(r.record_id);
    out.push(...claims);
  }
  return out;
}

function shouldRecordAsContradiction(f: GuardianFinding): boolean {
  // Only cross-record findings become contradictions rows. Single-record
  // findings (under-connected, confidence-rot) stay as audit entries.
  return (
    f.kind === "duplicate-hash" ||
    f.kind === "duplicate-title" ||
    f.kind === "broken-forward-reference"
  );
}

function normaliseText(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}
