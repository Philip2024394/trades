// NEX Brain Router · consumes completed jobs, writes to per-brain memory stores
//
// DOCTRINE
// Every completed Knowledge Job must land in the correct brain(s) with
// full audit trail. Brains are ISOLATED (Rule 4/6 of the CLAUDE.md quality
// gates + Nex Record Constitution clauses 1 & 7): every memory has one
// canonical owner brain · every routing decision traces back to a job.
//
// STORAGE
// One JSONL file per brain: `data/nex-brains/{brain-slug}/memories.jsonl`
// Append-only · latest-per-memory-id wins · full history preserved.
//
// FLOW
// job.status=completed  →  routeJob(job)  →  for each brain in target_brains:
//    normaliseBrain(name) → append MemoryRecord to that brain's file
//    → emit brain_memory_added event → return summary
//
// BRAIN NAMES → SLUGS
// The Knowledge Dump form + brainsForClassification() produce human names
// ("Marketing Brain" · "Staircase Brain" · "Executive Brain"). This module
// owns the single source of truth for name → slug conversion + the special
// "All HQ Brains (Founder Decision Model)" expansion.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emitEventSafe } from "../events/fs-store";
import { getJob, updateJob, type KnowledgeJob } from "../jobs/fs-store";

// ── Paths ──────────────────────────────────────────────────────────

const ROOT = path.join(process.cwd(), "data", "nex-brains");

async function ensureBrainDir(slug: string): Promise<string> {
  const dir = path.join(ROOT, slug);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// ── HQ brain roster ────────────────────────────────────────────────
// Kept in sync with brainsForClassification() in the dump route.
// Also drives the "All HQ Brains (Founder Decision Model)" expansion.

const HQ_BRAINS = [
  "Executive Brain",
  "Legal Brain",
  "Marketing Brain",
  "Brand Brain",
  "Sales Brain",
  "Customer Service Brain",
  "Finance Brain",
  "Operations Brain",
  "Security Brain",
  "Strategy Room",
  "Audience Intelligence Brain",
  "Internal Audit",
] as const;

/** Turn a display name into a filesystem-safe slug. */
export function normaliseBrain(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[()·]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Expand "All HQ Brains (Founder Decision Model)" · pass everything else through. */
export function expandBrainList(names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    const trimmed = n.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase().startsWith("all hq brains")) {
      for (const b of HQ_BRAINS) out.add(b);
    } else {
      out.add(trimmed);
    }
  }
  return [...out];
}

// ── Memory record type ────────────────────────────────────────────

export type MemoryRecord = {
  memory_id: string;
  brain_name: string;                // display name · e.g. "Staircase Brain"
  brain_slug: string;                // filesystem slug · e.g. "staircase-brain"
  source_job_id: string;
  source_kind: string;               // "Knowledge Dump" · "Upload" · ...
  source_owner: string;
  knowledge_type: string | null;
  title: string | null;
  content_length: number;
  inbox_item_id: string | null;
  added_at: string;                  // ISO
};

// ── Write · append one memory to one brain ────────────────────────

export async function appendMemory(brainName: string, base: Omit<MemoryRecord, "memory_id" | "brain_name" | "brain_slug" | "added_at">): Promise<MemoryRecord> {
  const brain_slug = normaliseBrain(brainName);
  const dir = await ensureBrainDir(brain_slug);
  const memory: MemoryRecord = {
    memory_id: randomUUID(),
    brain_name: brainName,
    brain_slug,
    added_at: new Date().toISOString(),
    ...base,
  };
  await fs.appendFile(path.join(dir, "memories.jsonl"), JSON.stringify(memory) + "\n", "utf8");

  emitEventSafe({
    event_type: "brain_memory_added",
    source: "system",
    actor_id: "brain-router",
    related_job: memory.source_job_id,
    related_department: "operations",
    outcome: "success",
    payload: {
      brain_name: brainName,
      brain_slug,
      memory_id: memory.memory_id,
      knowledge_type: memory.knowledge_type,
      title: memory.title,
      inbox_item_id: memory.inbox_item_id,
    },
  });
  return memory;
}

// ── Read · list memories for one brain ────────────────────────────

export type ListMemoriesOptions = { limit?: number; since_ms?: number };

export async function listMemories(brainSlug: string, options: ListMemoriesOptions = {}): Promise<MemoryRecord[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 50), 500);
  const sinceIso = new Date(Date.now() - (options.since_ms ?? 30 * 24 * 60 * 60 * 1000)).toISOString();
  const file = path.join(ROOT, brainSlug, "memories.jsonl");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const memories: MemoryRecord[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const m = JSON.parse(line) as MemoryRecord;
      if (m.added_at >= sinceIso) memories.push(m);
    } catch { /* skip malformed */ }
  }
  return memories.sort((a, b) => (a.added_at < b.added_at ? 1 : -1)).slice(0, limit);
}

/** Discover every brain that has at least one memory. */
export async function listBrainSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/** Counters per brain · for the Ops dashboard Brain Router panel. */
export async function brainStats(): Promise<Array<{ slug: string; name: string; memories: number; last_added: string | null }>> {
  const slugs = await listBrainSlugs();
  const out: Array<{ slug: string; name: string; memories: number; last_added: string | null }> = [];
  for (const slug of slugs) {
    const file = path.join(ROOT, slug, "memories.jsonl");
    let raw: string;
    try { raw = await fs.readFile(file, "utf8"); } catch { continue; }
    let count = 0;
    let name = slug;
    let last: string | null = null;
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try {
        const m = JSON.parse(line) as MemoryRecord;
        count += 1;
        name = m.brain_name;
        if (!last || m.added_at > last) last = m.added_at;
      } catch { /* skip */ }
    }
    out.push({ slug, name, memories: count, last_added: last });
  }
  return out.sort((a, b) => (a.memories < b.memories ? 1 : -1));
}

// ── Route · read a job, write to every target brain ───────────────

export type RouteResult = {
  job_id: string;
  routed_at: string;
  routed: Array<{ brain: string; brain_slug: string; memory_id: string }>;
  skipped: Array<{ reason: string; detail?: string }>;
};

/**
 * Route ONE job to all its target brains. Idempotent-per-brain via
 * a fingerprint stored on the job's completion_result: subsequent
 * routings for the same (job, brain) pair are skipped with reason
 * "already_routed" so replays don't double-write memories.
 */
export async function routeJob(job_id: string): Promise<RouteResult> {
  const now = new Date().toISOString();
  const job = await getJob(job_id);
  if (!job) {
    return { job_id, routed_at: now, routed: [], skipped: [{ reason: "job_not_found" }] };
  }
  if (job.status !== "completed") {
    return { job_id, routed_at: now, routed: [], skipped: [{ reason: "not_completed", detail: `status=${job.status}` }] };
  }
  const targets = expandBrainList(job.target_brains ?? []);
  if (targets.length === 0) {
    return { job_id, routed_at: now, routed: [], skipped: [{ reason: "no_target_brains" }] };
  }

  const alreadyRouted = new Set(job.completion_result?.brains_linked ?? []);
  const routed: RouteResult["routed"] = [];
  const skipped: RouteResult["skipped"] = [];

  for (const brainName of targets) {
    if (alreadyRouted.has(brainName)) {
      skipped.push({ reason: "already_routed", detail: brainName });
      continue;
    }
    const memory = await appendMemory(brainName, {
      source_job_id: job.job_id,
      source_kind: job.source,
      source_owner: job.owner,
      knowledge_type: job.knowledge_type,
      title: job.title,
      content_length: job.content_length,
      inbox_item_id: job.inbox_item_id,
    });
    routed.push({ brain: brainName, brain_slug: memory.brain_slug, memory_id: memory.memory_id });
  }

  // Record the routing outcome on the job itself so the Ops Centre + Ledger
  // can show "X memories added · Y brains linked" without a second query.
  if (routed.length > 0) {
    const priorLinks = job.completion_result?.brains_linked ?? [];
    const priorMemories = job.completion_result?.memories_added ?? 0;
    await updateJob(job_id, {
      status: "completed",
      progress: 100,
      completion_result: {
        memories_added: priorMemories + routed.length,
        brains_linked: [...priorLinks, ...routed.map((r) => r.brain)],
      },
    });
  }
  return { job_id, routed_at: now, routed, skipped };
}

/**
 * Route every completed job that hasn't been fully routed yet.
 * Used by the API scan endpoint + the auto-route hook in PATCH /jobs.
 */
export async function routeAllCompleted(limit = 100): Promise<{
  scanned: number;
  results: RouteResult[];
}> {
  const { listJobs } = await import("../jobs/fs-store");
  const jobs = await listJobs({ status: "completed", include_all_states: true, limit });
  const results: RouteResult[] = [];
  for (const j of jobs) {
    const targets = expandBrainList(j.target_brains ?? []);
    const alreadyRouted = new Set(j.completion_result?.brains_linked ?? []);
    const unrouted = targets.filter((t) => !alreadyRouted.has(t));
    if (unrouted.length === 0) continue;
    results.push(await routeJob(j.job_id));
  }
  return { scanned: jobs.length, results };
}

/** Fire-and-forget wrapper for use inside hot paths (PATCH /jobs). */
export function routeJobSafe(job_id: string): void {
  routeJob(job_id).catch((err) => {
    console.warn("[brain-router] routeJob failed:", err instanceof Error ? err.message : err);
  });
}

// Re-export for API convenience
export type { KnowledgeJob };
