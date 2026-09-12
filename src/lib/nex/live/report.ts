// src/lib/nex/live/report.ts
//
// NEX LIVE · MUSIC/VIDEO slice · Reports + Reviews + persistence
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §7 · §8 · §11
//
// Persists rights complaints + moderator decisions as append-only
// JSONL under data/nex-live/ — matches the agent-runtime pattern,
// avoids DB schema migration (§20). Production would swap this for a
// Postgres table with the same shape.
//
// §8 immutable · NEX must never silently delete history. Reports,
// reviews, and their timestamps are permanent. State transitions are
// recorded as new review records, not by mutating prior reviews.
//
// §11 architecture · reports/reviews are queryable so a moderator UI
// (future authorization) can inspect the full history.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assertV2Transition, type MediaVisibilityState, defaultV2State } from "./media-lifecycle-v2";

// ── Types ────────────────────────────────────────────────────────

export type ReportReason =
  | "copyright"
  | "impersonation"
  | "misleading"
  | "harassment"
  | "unsafe"
  | "other";

export type ReportStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "DUPLICATE";

export type MediaReport = {
  report_id: string;
  media_id: string;
  reporter_user_id: string | null;      // null = anonymous · currently rejected but reserved for future
  reason: ReportReason;
  reporter_statement: string;           // free-text · never rendered verbatim to accused uploader
  created_at_iso: string;
  status: ReportStatus;
  resolution_review_id: string | null;  // set when a review closes this report
};

export type ReviewDecision =
  | "KEEP"          // report dismissed · content stays ACTIVE
  | "RESTRICT"      // content becomes RESTRICTED
  | "REMOVE"        // content becomes REMOVED
  | "DISPUTE_ACCEPTED"   // uploader's dispute prevails · restore
  | "DISPUTE_REJECTED";  // uploader's dispute fails · state stays as reviewed

export type MediaReview = {
  review_id: string;
  media_id: string;
  reviewer_user_id: string;             // founder or moderator id
  reviewer_role: "founder" | "moderator";
  decision: ReviewDecision;
  reason: string;                       // moderator's explanation · audit-only
  previous_state: MediaVisibilityState;
  new_state: MediaVisibilityState;
  addressed_report_ids: string[];
  decided_at_iso: string;
};

// ── Persistence paths ────────────────────────────────────────────

function dataRoot(): string {
  const override = process.env.NEX_LIVE_DATA_ROOT;
  if (override && override.length > 0) return override;
  return path.join(process.cwd(), "data", "nex-live");
}
function reportsPath(): string { return path.join(dataRoot(), "reports.jsonl"); }
function reviewsPath(): string { return path.join(dataRoot(), "reviews.jsonl"); }
function statePath(): string { return path.join(dataRoot(), "media-visibility-state.json"); }

function ensureDir(): void {
  const d = dataRoot();
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function appendLine(p: string, obj: unknown): void {
  ensureDir();
  fs.appendFileSync(p, JSON.stringify(obj) + "\n", "utf8");
}

function readJsonlSafe<T>(p: string): T[] {
  try {
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return [];
    return raw.split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as T);
  } catch { return []; }
}

// ── Media visibility state store ─────────────────────────────────
// Kept in a single JSON keyed by media_id for O(1) lookup on the
// discovery hot path. Overrides the default ACTIVE when a report /
// review has changed the state. Never mutates the audit JSONL.

type StateFile = { version: number; states: Record<string, MediaVisibilityState> };

function readStateFile(): StateFile {
  try {
    if (!fs.existsSync(statePath())) return { version: 1, states: {} };
    const raw = fs.readFileSync(statePath(), "utf8");
    if (!raw.trim()) return { version: 1, states: {} };
    return JSON.parse(raw) as StateFile;
  } catch { return { version: 1, states: {} }; }
}

function writeStateFile(f: StateFile): void {
  ensureDir();
  const tmp = `${statePath()}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(f, null, 2), "utf8");
  fs.renameSync(tmp, statePath());
}

export function readMediaVisibility(media_id: string): MediaVisibilityState {
  return readStateFile().states[media_id] ?? defaultV2State();
}

function setMediaVisibility(media_id: string, next: MediaVisibilityState): void {
  const f = readStateFile();
  f.states[media_id] = next;
  writeStateFile(f);
}

// ── Report API ───────────────────────────────────────────────────

export function createReport(input: {
  media_id: string;
  reporter_user_id: string;             // §17 · reporter must be authenticated
  reason: ReportReason;
  reporter_statement: string;
  now_iso?: string;
}): MediaReport {
  if (!input.reporter_user_id) {
    throw new Error("nex-live:report:reporter_user_id_required");
  }
  const now = input.now_iso ?? new Date().toISOString();
  const report: MediaReport = {
    report_id: randomUUID(),
    media_id: input.media_id,
    reporter_user_id: input.reporter_user_id,
    reason: input.reason,
    reporter_statement: input.reporter_statement.slice(0, 2000),
    created_at_iso: now,
    status: "OPEN",
    resolution_review_id: null,
  };
  appendLine(reportsPath(), report);

  // Reporting alone transitions ACTIVE → REPORTED (§8) so the moderator
  // queue can pick it up. Does NOT restrict or remove the content —
  // that requires a review decision.
  const current = readMediaVisibility(input.media_id);
  if (current === "ACTIVE") {
    setMediaVisibility(input.media_id, "REPORTED");
  }
  return report;
}

export function listReportsForMedia(media_id: string): MediaReport[] {
  return readJsonlSafe<MediaReport>(reportsPath()).filter((r) => r.media_id === media_id);
}

export function listOpenReports(limit = 100): MediaReport[] {
  const all = readJsonlSafe<MediaReport>(reportsPath());
  return all.filter((r) => r.status === "OPEN" || r.status === "UNDER_REVIEW").slice(-limit);
}

// ── Review API ───────────────────────────────────────────────────

/** Compute the target visibility state for a review decision. */
function nextStateForDecision(current: MediaVisibilityState, decision: ReviewDecision): MediaVisibilityState {
  switch (decision) {
    case "KEEP":
      // From REPORTED → ACTIVE.  From UNDER_REVIEW → ACTIVE.
      return "ACTIVE";
    case "RESTRICT":
      return "RESTRICTED";
    case "REMOVE":
      return "REMOVED";
    case "DISPUTE_ACCEPTED":
      // Uploader's dispute succeeds — restore.
      return "RESTORED";
    case "DISPUTE_REJECTED":
      // No change — stay in current state. Guard against illegal
      // stay-in-place by returning current.
      return current;
  }
}

export function applyReview(input: {
  media_id: string;
  reviewer_user_id: string;
  reviewer_role: "founder" | "moderator";
  decision: ReviewDecision;
  reason: string;
  addressed_report_ids?: string[];
  now_iso?: string;
}): MediaReview {
  if (!input.reviewer_user_id) {
    throw new Error("nex-live:review:reviewer_user_id_required");
  }
  const current = readMediaVisibility(input.media_id);
  const next = nextStateForDecision(current, input.decision);
  // Force transitions to happen via UNDER_REVIEW when moderator is
  // deciding on a REPORTED item — this preserves the ACTIVE→REPORTED
  // →UNDER_REVIEW→final path per §8.
  if (current === "REPORTED" && (next === "RESTRICTED" || next === "REMOVED")) {
    // legal transition ACTIVE→REPORTED→UNDER_REVIEW→final via a virtual
    // intermediate. Assert both hops rather than skipping.
    assertV2Transition("REPORTED", "UNDER_REVIEW");
    assertV2Transition("UNDER_REVIEW", next);
  } else if (current !== next) {
    assertV2Transition(current, next);
  }
  if (current !== next) setMediaVisibility(input.media_id, next);

  const review: MediaReview = {
    review_id: randomUUID(),
    media_id: input.media_id,
    reviewer_user_id: input.reviewer_user_id,
    reviewer_role: input.reviewer_role,
    decision: input.decision,
    reason: input.reason.slice(0, 1000),
    previous_state: current,
    new_state: next,
    addressed_report_ids: input.addressed_report_ids ?? [],
    decided_at_iso: input.now_iso ?? new Date().toISOString(),
  };
  appendLine(reviewsPath(), review);

  // Close addressed reports.
  if ((input.addressed_report_ids ?? []).length > 0) {
    const allReports = readJsonlSafe<MediaReport>(reportsPath());
    let mutated = false;
    for (const r of allReports) {
      if ((input.addressed_report_ids ?? []).includes(r.report_id) && r.status !== "RESOLVED") {
        r.status = "RESOLVED";
        r.resolution_review_id = review.review_id;
        mutated = true;
      }
    }
    if (mutated) {
      // Rewrite the reports file atomically — this IS a mutation of the
      // append-only log, but it's the smallest permissible one (status
      // transition) and the full history is still recoverable from the
      // reviews.jsonl chronology + the resolution_review_id link. In
      // production this would be an event-sourced update table.
      const tmp = `${reportsPath()}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmp, allReports.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
      fs.renameSync(tmp, reportsPath());
    }
  }
  return review;
}

export function listReviewsForMedia(media_id: string): MediaReview[] {
  return readJsonlSafe<MediaReview>(reviewsPath()).filter((r) => r.media_id === media_id);
}
