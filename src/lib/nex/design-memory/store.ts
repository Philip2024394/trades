// Design Memory · in-memory store (MVP · JSONL/Supabase phased).
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import type { DesignMemoryEntry, DesignMemoryQuery, DesignMemoryStore } from "./types";

const STORE = new Map<string, DesignMemoryEntry>();

function tagOverlap(a: readonly string[], b: readonly string[]): number {
  const set = new Set(b);
  let hits = 0;
  for (const t of a) if (set.has(t)) hits++;
  return hits;
}

export function save(entry: DesignMemoryEntry): DesignMemoryEntry {
  STORE.set(entry.memory_id, entry);
  return entry;
}

export function get(memory_id: string): DesignMemoryEntry | undefined { return STORE.get(memory_id); }

export function latest(project_id: string): DesignMemoryEntry | undefined {
  const list = Array.from(STORE.values()).filter((e) => e.project_id === project_id);
  if (list.length === 0) return undefined;
  return list.sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
}

export function findSimilar(query: DesignMemoryQuery): readonly DesignMemoryEntry[] {
  const all = Array.from(STORE.values());
  const filtered = all.filter((e) => {
    if (query.project_id && e.project_id !== query.project_id) return false;
    if (query.since && e.captured_at < query.since) return false;
    if (query.min_quality_score !== undefined && (e.quality_score?.overall ?? 0) < query.min_quality_score) return false;
    return true;
  });
  const scored = filtered.map((e) => ({
    entry: e,
    score: query.style_tag_any ? tagOverlap(e.style_tags, query.style_tag_any) : 1,
  }));
  scored.sort((a, b) => (b.score - a.score) || b.entry.captured_at.localeCompare(a.entry.captured_at));
  const limit = query.limit ?? 10;
  return scored.slice(0, limit).map((s) => s.entry);
}

export function count(): number { return STORE.size; }

export function clear(): void { STORE.clear(); }

/** Convenience wrapper matching the DesignMemoryStore contract. */
export const memoryStore: DesignMemoryStore = { save, get, latest, findSimilar, count };
