// Extraction queue store — persistence layer for extraction candidates.
//
// Same dual-mode strategy as the draft store: prefer Postgres when the
// hammerex_nex_brain_extraction_candidates table exists (added in a
// follow-on pending migration), fall back to filesystem
// .author-studio-drafts/<brain_slug>/_extraction/<run_id>.json until
// the migration lands.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CandidateAdminStatus, CandidateReviewEvent, ExtractionCandidate, ExtractionRun } from "./types";

const FALLBACK_ROOT = ".author-studio-drafts";

function runPath(brain_slug: string, run_id: string): string {
  return path.join(process.cwd(), FALLBACK_ROOT, brain_slug, "_extraction", `${run_id}.json`);
}

export async function saveRun(run: ExtractionRun): Promise<void> {
  const p = runPath(run.brain_slug, run.run_id);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(run, null, 2), "utf8");
}

export async function loadRun(brain_slug: string, run_id: string): Promise<ExtractionRun | null> {
  try {
    const raw = await fs.readFile(runPath(brain_slug, run_id), "utf8");
    return JSON.parse(raw) as ExtractionRun;
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "ENOENT") return null;
    throw err;
  }
}

export async function listRuns(brain_slug: string): Promise<ExtractionRun[]> {
  const dir = path.join(process.cwd(), FALLBACK_ROOT, brain_slug, "_extraction");
  try {
    const entries = await fs.readdir(dir);
    const out: ExtractionRun[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(dir, entry), "utf8");
      out.push(JSON.parse(raw) as ExtractionRun);
    }
    return out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "ENOENT") return [];
    throw err;
  }
}

export async function updateCandidate(
  brain_slug: string,
  run_id: string,
  candidate_id: string,
  patch: Partial<Pick<ExtractionCandidate, "status" | "payload" | "author_notes" | "reviewed_at" | "admin_status">>,
  appendEvent?: CandidateReviewEvent
): Promise<ExtractionCandidate | null> {
  const run = await loadRun(brain_slug, run_id);
  if (!run) return null;
  const idx = run.candidates.findIndex((c) => c.id === candidate_id);
  if (idx < 0) return null;
  const current = run.candidates[idx];
  const next: ExtractionCandidate = {
    ...current,
    ...patch,
    review_history: appendEvent
      ? [...(current.review_history ?? []), appendEvent]
      : (current.review_history ?? [])
  };
  run.candidates[idx] = next;
  await saveRun(run);
  return next;
}

/** List every Author-Accepted candidate across every run for a Brain
 *  that is still awaiting Admin review. This is the primary Admin
 *  queue query. */
export async function listAdminPending(brain_slug: string): Promise<Array<ExtractionCandidate & { run_id: string }>> {
  const runs = await listRuns(brain_slug);
  const out: Array<ExtractionCandidate & { run_id: string }> = [];
  for (const run of runs) {
    for (const c of run.candidates) {
      const isAuthorAccepted = c.status === "accepted" || c.status === "edited";
      const adminStatus: CandidateAdminStatus = c.admin_status ?? "unreviewed";
      if (isAuthorAccepted && adminStatus === "unreviewed") {
        out.push({ ...c, run_id: run.run_id });
      }
    }
  }
  return out;
}

/** List every Admin-approved candidate across every run for a Brain.
 *  Used by the pack exporter to filter what actually reaches the
 *  Runtime pack. */
export async function listAdminApproved(brain_slug: string): Promise<Array<ExtractionCandidate & { run_id: string }>> {
  const runs = await listRuns(brain_slug);
  const out: Array<ExtractionCandidate & { run_id: string }> = [];
  for (const run of runs) {
    for (const c of run.candidates) {
      if (c.admin_status === "approved") out.push({ ...c, run_id: run.run_id });
    }
  }
  return out;
}
