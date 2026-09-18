// src/lib/nex-agent/code-engine/capability-chain-relationship-composer.ts
//
// NEX1 · Chain Relationship Composer · deterministic · zero LLM · READ-ONLY.
//
// Fix 11 · 2026-09-16 · authorised after Test O SHARED_ENDPOINT_DETECTED_NO_COMPOSITION
// (docs/doctrine/nex1-test-o-composition-2026-09-16.md).
//
// PURPOSE (founder Fix 11 authorization · verbatim):
//   > "Given independently verified Stage-10 structural relationships, NEX1
//     can traverse connected relationships and construct a provenance-
//     preserved multi-relationship structural argument."
//   > "Stage 11 establishes composition. The next stage determines whether
//     NEX1 can turn composition into behavioural/causal meaning."
//
// EXACT GAP TEST O DEMONSTRATED (§3 · authoritative):
//   R1: producer_consumer(anyTransient @ 99 → if_condition @ 112)
//   R2: condition_gates_return(if_condition @ 112 → return @ 114)
//   R1.endpoint_B == R2.endpoint_A · verifier confirmed
//   BUT · no code path walks the graph · Fix 11 fills exactly this gap.
//
// WHAT THIS MODULE DOES:
//   · Consumes InferredRelationship[] · never source content directly
//   · Builds a deterministic index of relationships keyed by endpoint_A
//     signature (source_file + start_line + end_line + fact_kind)
//   · For each relationship R_i, finds all R_j where R_j.endpoint_A matches
//     R_i.endpoint_B · that pair is a valid 1-hop composition
//   · Recursively extends compositions (BFS by depth) with cycle detection
//     via a visited-relationship_id set
//   · Emits ComposedArgument[] records with full provenance
//   · Every argument evidence_kind = "INFERRED" · type-locked
//
// WHAT THIS MODULE DOES NOT DO (founder §13/§14 · enforced in code):
//   · No natural-language explanation
//   · No causal claims ("therefore", "because", etc.)
//   · No behavioural interpretation
//   · No LLM · no external inference · no writes
//   · No fabricated relationships · every relationship in a composition
//     MUST already exist in the input array
//   · No endpoint weakening · shared endpoint requires exact match on
//     (source_file, start_line, end_line, fact_kind)

import type {
  InferredRelationship,
  RelationshipEndpoint,
} from "./capability-chain-relationship-detector";

// ── Public shape ─────────────────────────────────────────────────────────

/** A step in a composition chain — either a full endpoint or a shared-endpoint
 *  reference. Every step carries provenance. */
export interface CompositionStep {
  readonly source_file: string;
  readonly start_line: number;
  readonly end_line: number;
  readonly symbol: string;
  readonly fact_kind: string;
}

export interface ComposedArgument {
  /** Deterministic id · relationship_ids joined by "->". */
  readonly composition_id: string;
  /** Ordered relationship_ids in traversal order. */
  readonly relationship_ids: readonly string[];
  /** Full relationship records (referentially the same as in the input). */
  readonly relationships: readonly InferredRelationship[];
  /** Ordered endpoint path · length = relationship_ids.length + 1.
   *  For chain R1 → R2 · endpoint_chain = [R1.endpoint_A, R1.endpoint_B/R2.endpoint_A, R2.endpoint_B] */
  readonly endpoint_chain: readonly CompositionStep[];
  readonly direction: "forward";
  readonly evidence_kind: "INFERRED";
  readonly depth: number;                                // relationship_ids.length
  readonly enclosing_function: string | null;
  readonly source_file: string;                          // all relationships share this file
  /** Every relationship's endpoint_A + endpoint_B ranges · flat provenance list. */
  readonly provenance: readonly { source_file: string; start_line: number; end_line: number }[];
}

export interface ComposeRelationshipsInput {
  readonly relationships: readonly InferredRelationship[];
  readonly max_depth?: number;                            // default 4 · hard cap 5
  readonly max_compositions_total?: number;               // default 200 · hard cap 500
}

export interface ComposeRelationshipsResult {
  readonly ok: true;
  readonly compositions: readonly ComposedArgument[];
  readonly stats: {
    readonly relationships_seen: number;
    readonly compositions_emitted: number;
    readonly compositions_by_depth: Record<number, number>;
    readonly compositions_rejected_cycle: number;
    readonly compositions_rejected_direction: number;
    readonly capped_by: string;
  };
}

// ── Bounds ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_DEPTH = 4;
const HARD_MAX_DEPTH = 5;
const DEFAULT_MAX_COMPOSITIONS = 200;
const HARD_MAX_COMPOSITIONS = 500;

// ── Endpoint signature (§7 · exact match on structural fields) ──────────
//
// Endpoint compatibility uses (source_file, start_line, end_line, fact_kind).
// Symbol is NOT part of the match key · fact_kind + line range is the
// structural identity. This aligns with Fix 10's V4/V5 verifier: the same
// source range with same fact_kind IS the same source construct.

function endpointKey(ep: RelationshipEndpoint, sourceFile: string): string {
  return `${sourceFile}::${ep.start_line}:${ep.end_line}:${ep.fact_kind}`;
}

function endpointsMatch(
  a: RelationshipEndpoint,
  aFile: string,
  b: RelationshipEndpoint,
  bFile: string,
): boolean {
  if (aFile !== bFile) return false;
  if (a.start_line !== b.start_line) return false;
  if (a.end_line !== b.end_line) return false;
  if (a.fact_kind !== b.fact_kind) return false;
  return true;
}

function endpointToStep(ep: RelationshipEndpoint, sourceFile: string): CompositionStep {
  return {
    source_file: sourceFile,
    start_line: ep.start_line,
    end_line: ep.end_line,
    symbol: ep.symbol,
    fact_kind: ep.fact_kind,
  };
}

// ── Composer ─────────────────────────────────────────────────────────────

export function composeRelationships(input: ComposeRelationshipsInput): ComposeRelationshipsResult {
  const maxDepth = Math.min(input.max_depth ?? DEFAULT_MAX_DEPTH, HARD_MAX_DEPTH);
  const maxTotal = Math.min(input.max_compositions_total ?? DEFAULT_MAX_COMPOSITIONS, HARD_MAX_COMPOSITIONS);

  const relationships = input.relationships;

  // Build endpoint_A index · deterministic order (preserve input order)
  // Key = endpointKey(R.endpoint_A, R.source_file)
  // Value = list of relationship indices whose endpoint_A matches that key
  const startsFromKey = new Map<string, number[]>();
  for (let i = 0; i < relationships.length; i++) {
    const r = relationships[i];
    const key = endpointKey(r.endpoint_A, r.source_file);
    let bucket = startsFromKey.get(key);
    if (!bucket) {
      bucket = [];
      startsFromKey.set(key, bucket);
    }
    bucket.push(i);
  }

  const compositions: ComposedArgument[] = [];
  const stats = {
    rejectedCycle: 0,
    rejectedDirection: 0,
  };

  // BFS by depth · every depth level up to maxDepth
  // Start each traversal from every relationship (as a seed)
  //
  // For determinism: process seeds in input order; extensions in input order.
  // Each ComposedArgument's composition_id is deterministic from relationship_ids.

  // We'll maintain a set of already-emitted composition_ids to dedupe.
  const emitted = new Set<string>();

  interface Frontier {
    ids: number[];               // ordered relationship indices in this chain
    visited: Set<string>;        // relationship_ids already in chain (cycle prevention)
    lastEndpointB: RelationshipEndpoint;
    lastFile: string;
    enclosingFn: string | null;
  }

  // Seed: single-relationship chains (depth 1 — but we require depth ≥ 2 per §10,
  // so single-relationship chains are used only as starting points).
  const initialFrontiers: Frontier[] = relationships.map((r, i) => ({
    ids: [i],
    visited: new Set([r.relationship_id]),
    lastEndpointB: r.endpoint_B,
    lastFile: r.source_file,
    enclosingFn: r.enclosing_function,
  }));

  const emit = (frontier: Frontier): boolean => {
    if (frontier.ids.length < 2) return false; // require depth ≥ 2
    if (compositions.length >= maxTotal) return false;
    const chainRels = frontier.ids.map((i) => relationships[i]);
    const compositionId = chainRels.map((r) => r.relationship_id).join("->");
    if (emitted.has(compositionId)) return false;

    // Build endpoint_chain: R1.endpoint_A → R1.endpoint_B/R2.endpoint_A → R2.endpoint_B → ...
    // Since R_i.endpoint_B == R_{i+1}.endpoint_A structurally, the middle
    // steps use the shared endpoint's data (we canonicalize on R_i.endpoint_B).
    const steps: CompositionStep[] = [];
    steps.push(endpointToStep(chainRels[0].endpoint_A, chainRels[0].source_file));
    for (const r of chainRels) {
      steps.push(endpointToStep(r.endpoint_B, r.source_file));
    }

    // Direction check: each hop must be forward · verified during extension,
    // but re-check here as defence-in-depth.
    for (let i = 0; i < steps.length - 1; i++) {
      if (steps[i].end_line > steps[i + 1].start_line &&
          !(steps[i].start_line === steps[i + 1].start_line && steps[i].end_line === steps[i + 1].end_line)) {
        stats.rejectedDirection++;
        return false;
      }
    }

    // Flat provenance list: every endpoint's {file, start_line, end_line}
    const provenance = steps.map((s) => ({
      source_file: s.source_file, start_line: s.start_line, end_line: s.end_line,
    }));

    compositions.push({
      composition_id: compositionId,
      relationship_ids: chainRels.map((r) => r.relationship_id),
      relationships: chainRels,
      endpoint_chain: steps,
      direction: "forward",
      evidence_kind: "INFERRED",
      depth: chainRels.length,
      enclosing_function: frontier.enclosingFn,
      source_file: chainRels[0].source_file,
      provenance,
    });
    emitted.add(compositionId);
    return true;
  };

  // Extend each frontier by trying to match its lastEndpointB against
  // relationships' endpoint_A. Each extension deepens the chain by 1.
  const extendFrontier = (frontier: Frontier, currentDepth: number): Frontier[] => {
    if (currentDepth >= maxDepth) return [];
    const key = endpointKey(frontier.lastEndpointB, frontier.lastFile);
    const matches = startsFromKey.get(key);
    if (!matches) return [];
    const extended: Frontier[] = [];
    for (const nextIdx of matches) {
      const nextR = relationships[nextIdx];
      // Cycle prevention · reject if the relationship_id was already visited
      if (frontier.visited.has(nextR.relationship_id)) {
        stats.rejectedCycle++;
        continue;
      }
      // Direction check · nextR.endpoint_A.end_line must be ≤ nextR.endpoint_B.start_line
      // (already enforced by Fix 10 detector · re-check for defence-in-depth)
      // AND the extension itself must be forward: nextR.endpoint_A can equal
      // frontier.lastEndpointB (that's the shared endpoint), but nextR.endpoint_B
      // must be > shared endpoint's end_line for meaningful direction.
      // Exception: selector_literal_mapping shares span internally.
      if (nextR.endpoint_A.end_line > nextR.endpoint_B.start_line &&
          !(nextR.endpoint_A.start_line === nextR.endpoint_B.start_line &&
            nextR.endpoint_A.end_line === nextR.endpoint_B.end_line)) {
        stats.rejectedDirection++;
        continue;
      }
      // Cross-file extension check · both must share source_file (§7 endpoint identity requires it)
      if (nextR.source_file !== frontier.lastFile) {
        continue;
      }
      const newVisited = new Set(frontier.visited);
      newVisited.add(nextR.relationship_id);
      extended.push({
        ids: [...frontier.ids, nextIdx],
        visited: newVisited,
        lastEndpointB: nextR.endpoint_B,
        lastFile: nextR.source_file,
        // Enclosing function inherits from the last relationship (all should be within same fn for structural chains)
        enclosingFn: frontier.enclosingFn === nextR.enclosing_function
          ? frontier.enclosingFn
          : null,
      });
    }
    return extended;
  };

  // BFS layer-by-layer, deterministic
  let currentLayer: Frontier[] = initialFrontiers;
  let currentDepth = 1;
  while (currentLayer.length > 0 && currentDepth < maxDepth) {
    if (compositions.length >= maxTotal) break;
    const nextLayer: Frontier[] = [];
    for (const frontier of currentLayer) {
      if (compositions.length >= maxTotal) break;
      const extended = extendFrontier(frontier, currentDepth);
      for (const ext of extended) {
        if (compositions.length >= maxTotal) break;
        // Emit the extended chain (depth ≥ 2 as soon as we extend once)
        emit(ext);
        nextLayer.push(ext);
      }
    }
    currentLayer = nextLayer;
    currentDepth++;
  }

  // Deterministic sort by composition_id
  compositions.sort((a, b) => a.composition_id.localeCompare(b.composition_id));

  // Stats
  const byDepth: Record<number, number> = {};
  for (const c of compositions) {
    byDepth[c.depth] = (byDepth[c.depth] ?? 0) + 1;
  }

  return {
    ok: true,
    compositions,
    stats: {
      relationships_seen: relationships.length,
      compositions_emitted: compositions.length,
      compositions_by_depth: byDepth,
      compositions_rejected_cycle: stats.rejectedCycle,
      compositions_rejected_direction: stats.rejectedDirection,
      capped_by: compositions.length >= maxTotal ? `hit_hard_cap=${maxTotal}` : `hard_cap=${maxTotal}`,
    },
  };
}
