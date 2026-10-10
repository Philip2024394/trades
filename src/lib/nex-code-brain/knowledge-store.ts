// NEX Code Brain · Knowledge store
// Append-only ledger of coding-specific knowledge entries contributed by any
// registered agent lane. Founder can later score/approve entries. Search is
// tag+lane+path-prefix based · fast enough for our scale (< 100k entries).
//
// This is INTENTIONALLY SMALLER than nex-agent-runtime/nex1/memory.ts:
// - No Ed25519 signature (not a governance store; contributions are advisory)
// - No layer / mission / evidence-ref graph
// - Plain JSONL with a status flag
// Purpose: quick coding-domain lookup, not audit-grade memory.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import * as path from "node:path";
import type { KnowledgeEntry } from "./types";
import { getBrainDir, findLane } from "./lane-registry";

function getKnowledgeDir(): string {
  return path.join(getBrainDir(), "knowledge");
}
function getKnowledgePath(): string {
  return path.join(getKnowledgeDir(), "entries.jsonl");
}

const ALLOWED_KINDS: readonly KnowledgeEntry["kind"][] = [
  "pattern",
  "anti-pattern",
  "fix-recipe",
  "convention",
  "framework-note",
  "gotcha",
];

function ensureDir(): void {
  if (!existsSync(getKnowledgeDir())) mkdirSync(getKnowledgeDir(), { recursive: true });
}

export function newEntryId(): string {
  return `k-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
}

export interface AddEntryInput {
  readonly kind: KnowledgeEntry["kind"];
  readonly title: string;
  readonly body: string;
  readonly contributed_by_lane: string;
  readonly contributed_by_agent?: string;
  readonly applicable_paths?: readonly string[];
  readonly tags?: readonly string[];
  readonly evidence?: readonly string[];
}

export interface AddEntryResult {
  readonly ok: boolean;
  readonly entry?: KnowledgeEntry;
  readonly reason?: string;
}

export function addEntry(input: AddEntryInput): AddEntryResult {
  if (!ALLOWED_KINDS.includes(input.kind)) {
    return { ok: false, reason: `unknown kind: ${input.kind}` };
  }
  if (!input.title || input.title.length > 200) {
    return { ok: false, reason: "title must be 1-200 chars" };
  }
  if (!input.body || input.body.length > 8000) {
    return { ok: false, reason: "body must be 1-8000 chars" };
  }
  const lane = findLane(input.contributed_by_lane);
  if (!lane) {
    return { ok: false, reason: `unknown contributing lane: ${input.contributed_by_lane}` };
  }

  const entry: KnowledgeEntry = {
    entry_id: newEntryId(),
    kind: input.kind,
    title: input.title,
    body: input.body,
    contributed_by_lane: input.contributed_by_lane,
    contributed_by_agent: input.contributed_by_agent ?? null,
    applicable_paths: Array.from(input.applicable_paths ?? []),
    tags: Array.from(input.tags ?? []),
    created_at: new Date().toISOString(),
    evidence: Array.from(input.evidence ?? []),
    founder_approved: false,
  };
  ensureDir();
  appendFileSync(getKnowledgePath(), JSON.stringify(entry) + "\n", "utf8");
  return { ok: true, entry };
}

export interface SearchQuery {
  readonly lane?: string;
  readonly kind?: KnowledgeEntry["kind"];
  readonly tag?: string;
  readonly path_prefix?: string;
  readonly limit?: number;
  readonly approved_only?: boolean;
}

export function searchEntries(q: SearchQuery = {}): readonly KnowledgeEntry[] {
  ensureDir();
  if (!existsSync(getKnowledgePath())) return [];
  const lines = readFileSync(getKnowledgePath(), "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  const out: KnowledgeEntry[] = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line) as KnowledgeEntry;
      if (q.lane && e.contributed_by_lane !== q.lane) continue;
      if (q.kind && e.kind !== q.kind) continue;
      if (q.tag && !e.tags.includes(q.tag)) continue;
      if (q.approved_only && !e.founder_approved) continue;
      if (q.path_prefix) {
        const prefix = q.path_prefix.replace(/\\/g, "/");
        if (!e.applicable_paths.some((p) => p.replace(/\\/g, "/").startsWith(prefix))) continue;
      }
      out.push(e);
      if (q.limit && out.length >= q.limit) break;
    } catch {
      /* skip */
    }
  }
  return out.reverse(); // most recent first (append order)
}

export function totalEntries(): number {
  if (!existsSync(getKnowledgePath())) return 0;
  return readFileSync(getKnowledgePath(), "utf8").split("\n").filter((l) => l.trim().length > 0).length;
}

// Test-only reset.
export function __resetKnowledgeForTest(): void {
  if (!existsSync(getKnowledgePath())) return;
  const { unlinkSync } = require("node:fs") as typeof import("node:fs");
  try {
    unlinkSync(getKnowledgePath());
  } catch {
    /* nothing */
  }
}

export { getKnowledgePath, getKnowledgeDir };
