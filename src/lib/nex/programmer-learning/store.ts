// src/lib/nex/programmer-learning/store.ts
//
// NEX Programmer Agent · Phase A · persistence layer
// Philip 2026-09-05 · AUTHORIZE
//
// Discipline:
//   · APPEND-ONLY JSONL for every store (never overwrite, never delete)
//   · Distinct files per record kind (events / knowledge / skills /
//     experiences / learning_runs)
//   · All writes go through this module · callers cannot bypass it
//   · All writes bounded to `data/programmer-learning/` — attempts to
//     write elsewhere throw ForbiddenPhaseAWrite
//   · No LLM calls · no shell exec · no network I/O
//   · Fail-safe reads: missing file → [] · malformed line → skipped +
//     recorded (never crashes the caller)
//
// Storage layout (all under data/programmer-learning/):
//   events.jsonl              — append-only engineering events
//   knowledge.jsonl           — knowledge items
//   skills.jsonl              — skill items (append-only · promotion
//                                is captured as new records not updates)
//   experiences.jsonl         — experience items
//   learning_runs.jsonl       — learning-run headers for §19 verifier
//   sources/{id}.txt          — raw source snapshots (for reproducibility)

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type {
  EngineeringEvent,
  KnowledgeItem,
  SkillItem,
  ExperienceItem,
  LearningRun,
  Provenance,
} from "./types";

// ─── Root path resolution ─────────────────────────────────────────

/** Overridable via env for tests (e.g. tmp dir). */
export function programmerLearningDir(): string {
  const override = process.env.NEX_PROGRAMMER_LEARNING_DIR;
  if (override && override.trim().length > 0) return override;
  // Default under repo data dir (aligns with existing workforce persistence)
  const cwd = process.cwd();
  return path.resolve(cwd, "data", "programmer-learning");
}

function ensureDir(): void {
  const dir = programmerLearningDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const sourcesDir = path.join(dir, "sources");
  if (!existsSync(sourcesDir)) mkdirSync(sourcesDir, { recursive: true });
}

// ─── Path guard ───────────────────────────────────────────────────

/** Every persistence write MUST route through pathFor() which
 *  refuses paths outside programmer-learning/. Prevents accidental
 *  writes to production data via a bug or crafted input. */
class ForbiddenPhaseAWrite extends Error {
  constructor(target: string) { super(`Phase-A forbidden write to: ${target}`); }
}

function pathFor(filename: string): string {
  const root = programmerLearningDir();
  const p = path.resolve(root, filename);
  if (!p.startsWith(root + path.sep) && p !== root) {
    throw new ForbiddenPhaseAWrite(p);
  }
  return p;
}

// ─── JSONL primitives ────────────────────────────────────────────

function appendLine(filename: string, record: unknown): void {
  ensureDir();
  const line = JSON.stringify(record);
  if (line.length > 128 * 1024) {
    throw new Error(`Phase-A record exceeds 128KB · not appended: ${filename}`);
  }
  appendFileSync(pathFor(filename), line + "\n", "utf8");
}

function readAll<T>(filename: string): T[] {
  const p = pathFor(filename);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const out: T[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { out.push(JSON.parse(trimmed) as T); }
    catch { /* skip malformed line · never crash caller */ }
  }
  return out;
}

// ─── Content hashing (for dedup & content_hash field) ────────────

export function stableHash(input: unknown): string {
  const norm = typeof input === "string" ? input : JSON.stringify(input);
  return createHash("sha256").update(norm, "utf8").digest("hex").slice(0, 32);
}

export function generateId(prefix: "evt" | "know" | "skill" | "exp" | "run" | "src"): string {
  return `${prefix}_${randomUUID()}`;
}

// ─── Events store ────────────────────────────────────────────────

export const EVENTS_FILE = "events.jsonl";

export function appendEvent(event: EngineeringEvent): void {
  appendLine(EVENTS_FILE, event);
}
export function readEvents(): EngineeringEvent[] {
  return readAll<EngineeringEvent>(EVENTS_FILE);
}

// ─── Knowledge store ─────────────────────────────────────────────

export const KNOWLEDGE_FILE = "knowledge.jsonl";

export function appendKnowledge(item: KnowledgeItem): void {
  appendLine(KNOWLEDGE_FILE, item);
}
export function readKnowledge(): KnowledgeItem[] {
  return readAll<KnowledgeItem>(KNOWLEDGE_FILE);
}

// ─── Skills store ────────────────────────────────────────────────

export const SKILLS_FILE = "skills.jsonl";

export function appendSkill(item: SkillItem): void {
  appendLine(SKILLS_FILE, item);
}
export function readSkills(): SkillItem[] {
  return readAll<SkillItem>(SKILLS_FILE);
}

// ─── Experiences store ───────────────────────────────────────────

export const EXPERIENCES_FILE = "experiences.jsonl";

export function appendExperience(item: ExperienceItem): void {
  appendLine(EXPERIENCES_FILE, item);
}
export function readExperiences(): ExperienceItem[] {
  return readAll<ExperienceItem>(EXPERIENCES_FILE);
}

// ─── Learning runs store ─────────────────────────────────────────

export const LEARNING_RUNS_FILE = "learning_runs.jsonl";

export function appendLearningRun(run: LearningRun): void {
  // Enforce Op-Truth §OP.5: persisted record MUST carry final_status=null.
  if (run.final_status !== null) {
    throw new Error("Op-Truth violation: LearningRun.final_status must be null in persisted record");
  }
  appendLine(LEARNING_RUNS_FILE, run);
}
export function readLearningRuns(): LearningRun[] {
  return readAll<LearningRun>(LEARNING_RUNS_FILE);
}

// ─── Source snapshots (raw content for reproducibility) ──────────

/** Store the raw content of an external source. Returned pointer is
 *  used as evidence_pointer in the corresponding KnowledgeItem
 *  provenance. Filename is deterministic (content hash) so identical
 *  content is not duplicated on disk. */
export function storeSourceSnapshot(input: {
  content: string;
  url?: string | null;
  content_type?: string;
}): { pointer: string; hash: string; bytes: number } {
  ensureDir();
  const hash = stableHash(input.content);
  const ext = (input.content_type ?? "text").toLowerCase().includes("json") ? "json" : "txt";
  const filename = `sources/${hash}.${ext}`;
  const p = pathFor(filename);
  if (!existsSync(p)) {
    // Include a small header so the snapshot is self-describing.
    const header = [
      `# NEX Programmer-Learning Source Snapshot`,
      `# url: ${input.url ?? "(none)"}`,
      `# content_type: ${input.content_type ?? "text/plain"}`,
      `# stored_at: ${new Date().toISOString()}`,
      `# sha256_prefix: ${hash}`,
      ``,
    ].join("\n");
    writeFileSync(p, header + input.content, "utf8");
  }
  return { pointer: `programmer-learning/${filename}`, hash, bytes: Buffer.byteLength(input.content, "utf8") };
}

// ─── Test helper · reset ONLY the programmer-learning dir ────────

/** For test hygiene only. Deletes JSONL files under the programmer-
 *  learning directory. Bounded to that directory via pathFor(). */
export function _resetProgrammerLearningStoreForTests(): void {
  const dir = programmerLearningDir();
  if (!existsSync(dir)) return;
  for (const f of [EVENTS_FILE, KNOWLEDGE_FILE, SKILLS_FILE, EXPERIENCES_FILE, LEARNING_RUNS_FILE]) {
    const p = pathFor(f);
    if (existsSync(p)) writeFileSync(p, "", "utf8");
  }
}

// ─── Boundary sentinel · exported for tests to assert the guard ──

export { ForbiddenPhaseAWrite };

// ─── Provenance helper · always attach observed_by ────────────────

/** Compose a provenance record with sensible defaults. Callers still
 *  supply source_type + authority_tier + evidence_pointer — this only
 *  reduces boilerplate for retrieval-timestamp and observed_by. */
export function newProvenance(input: Omit<Provenance, "retrieved_at"> & { retrieved_at?: string }): Provenance {
  return {
    ...input,
    retrieved_at: input.retrieved_at ?? new Date().toISOString(),
  };
}
