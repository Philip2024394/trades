// Knowledge graph — relationships between entries.
// The whole point of the graph is that Nex can traverse from an entry
// to its neighbours ("staircase" → "landing" → "handrail" → "UK regs")
// and return a richer answer than pure text search would.
//
// Edges are directional. Weight 0-1 informs traversal ranking.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { KnowledgeEdge, Relationship } from "./types";

/** Propose an edge. Unverified until a staff reviewer approves. */
export async function proposeEdge(input: {
  fromEntry:    string;
  toEntry:      string;
  relationship: Relationship;
  weight?:      number;
  proposedBy:   string;
}): Promise<{ id: string }> {
  if (input.fromEntry === input.toEntry) throw new Error("self-loops not allowed");
  const { data, error } = await supabaseAdmin
    .from("hammerex_nex_knowledge_edges")
    .insert({
      from_entry:   input.fromEntry,
      to_entry:     input.toEntry,
      relationship: input.relationship,
      weight:       input.weight ?? 0.5,
      proposed_by:  input.proposedBy,
      verified:     false
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`propose edge failed: ${error?.message}`);
  return { id: data.id };
}

/** Verify an edge (staff action). Verified edges are visible to
 *  merchants; unverified edges are staff-only. */
export async function verifyEdge(input: { id: string; verifiedBy: string }): Promise<void> {
  await supabaseAdmin
    .from("hammerex_nex_knowledge_edges")
    .update({
      verified:    true,
      verified_by: input.verifiedBy,
      verified_at: new Date().toISOString()
    })
    .eq("id", input.id);
}

/** Neighbours of an entry — all edges out. Filter by relationship if given. */
export async function neighbours(input: {
  entryId:        string;
  relationships?: Relationship[];
  onlyVerified?:  boolean;
}): Promise<KnowledgeEdge[]> {
  let q = supabaseAdmin
    .from("hammerex_nex_knowledge_edges")
    .select("*")
    .eq("from_entry", input.entryId);
  if (input.relationships?.length) q = q.in("relationship", input.relationships);
  if (input.onlyVerified !== false) q = q.eq("verified", true);
  const { data } = await q.order("weight", { ascending: false });
  return (data as unknown as KnowledgeEdge[]) ?? [];
}

/** Traverse up to N hops from a seed entry. Returns unique entry ids
 *  in BFS order with the hop depth. Used by hybrid search to expand
 *  context around top text-search hits.
 *
 *  `neighboursFn` is injectable for testing so tests can supply an
 *  in-memory graph without hitting Supabase. Production callers pass
 *  nothing and the default DB-backed neighbours() is used. */
export async function traverse(input: {
  seedEntryId:  string;
  maxHops?:     number;
  maxNodes?:    number;
  onlyVerified?: boolean;
  neighboursFn?: (entryId: string) => Promise<Array<{ to_entry: string }>>;
}): Promise<Array<{ entryId: string; depth: number }>> {
  const maxHops  = input.maxHops  ?? 2;
  const maxNodes = input.maxNodes ?? 25;
  const getNeighbours = input.neighboursFn ??
    (async (entryId: string) => neighbours({ entryId, onlyVerified: input.onlyVerified }));

  const seen = new Map<string, number>();
  seen.set(input.seedEntryId, 0);
  const frontier: string[] = [input.seedEntryId];

  for (let depth = 0; depth < maxHops && seen.size < maxNodes; depth++) {
    const nextFrontier: string[] = [];
    for (const node of frontier) {
      const edges = await getNeighbours(node);
      for (const e of edges) {
        if (seen.has(e.to_entry)) continue;
        seen.set(e.to_entry, depth + 1);
        nextFrontier.push(e.to_entry);
        if (seen.size >= maxNodes) break;
      }
      if (seen.size >= maxNodes) break;
    }
    if (nextFrontier.length === 0) break;
    frontier.length = 0;
    frontier.push(...nextFrontier);
  }

  return Array.from(seen.entries()).map(([entryId, depth]) => ({ entryId, depth }));
}

/** Delete an edge (admin only — used to remove wrong AI-proposed edges). */
export async function deleteEdge(id: string): Promise<void> {
  await supabaseAdmin.from("hammerex_nex_knowledge_edges").delete().eq("id", id);
}
