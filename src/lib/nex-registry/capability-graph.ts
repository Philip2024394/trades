// src/lib/nex-registry/capability-graph.ts
//
// NEX Capability Graph (Ledger B · Zero LLM)
//
// The Capability Registry stores WHAT NEX can do.
// The Capability Graph stores HOW capabilities connect · and what
// happens when something is missing.
//
// FOUNDER SCENARIO
//   "I need to modify a dashboard"
//        ↓
//   What capabilities do I need?
//        ↓
//   dashboard layout · UI components · chart · responsive · design system · visual QA · code operators · preview
//        ↓
//   Who owns them?
//        ↓
//   What implementations exist?
//        ↓
//   What evidence proves they work?
//        ↓
//   What is missing?
//        ↓
//   What can I safely use?
//
// ANTI-MANUFACTURING INVARIANTS
//   1. Missing capability = explicit MISSING result · never fabrication
//   2. Circular dependencies detected and reported · not silently ignored
//   3. Graph traversal only follows dependencies to VERIFIED/PROMOTED capabilities
//      unless the caller explicitly opts in to PROPOSED nodes

import { listCapabilities, getCapability, getCapabilityByName } from "./capability-registry";
import type { CapabilityCategory, CapabilityRecord, CompositionLevel } from "./capability-types";

export const NEX_CAPABILITY_GRAPH_VERSION = "nex-capability-graph.v1.2026-09-19";

// ── Edge kinds ────────────────────────────────────────────────────────
export type GraphEdgeKind = "requires" | "supports" | "supersedes";

export interface GraphEdge {
  readonly from: string;        // capability_id
  readonly to: string;          // capability_id
  readonly kind: GraphEdgeKind;
}

// ── Traversal outcomes ────────────────────────────────────────────────
export interface DependencySet {
  readonly capability_id: string;
  readonly capability_name: string;
  readonly present: readonly string[];      // dependency ids that exist and are trustable
  readonly missing: readonly string[];      // dependency ids that are not in the registry
  readonly untrustable: readonly string[];  // exist but status is not VERIFIED/PROMOTED
}

export interface GapAnalysis {
  readonly requested: readonly string[];       // capability_ids or names asked for
  readonly satisfied: readonly string[];       // capability_ids that resolved to VERIFIED/PROMOTED
  readonly missing: readonly string[];         // capability names that could not be found
  readonly untrustable: readonly string[];     // capability_ids present but not yet trusted
  readonly transitive_missing: readonly string[];  // dependencies of satisfied that are themselves missing
  readonly all_satisfied: boolean;
  readonly assessed_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export interface CompositionPathStep {
  readonly capability_id: string;
  readonly capability_name: string;
  readonly depends_on: readonly string[];
  readonly build_order: number;   // topological order (0 = build first)
}

export type CompositionPath =
  | { readonly outcome: "resolved"; readonly steps: readonly CompositionPathStep[]; readonly total_steps: number }
  | { readonly outcome: "blocked"; readonly gap: GapAnalysis; readonly rationale: string }
  | { readonly outcome: "cyclic"; readonly cycle: readonly string[]; readonly rationale: string };

// ── Direct edge queries ───────────────────────────────────────────────
export function getRequires(capability_id: string): readonly CapabilityRecord[] {
  const cap = getCapability(capability_id);
  if (!cap) return Object.freeze([]);
  const out: CapabilityRecord[] = [];
  for (const depId of cap.dependencies) {
    const dep = getCapability(depId);
    if (dep) out.push(dep);
  }
  return Object.freeze(out);
}

export function getRequiredBy(capability_id: string): readonly CapabilityRecord[] {
  const out: CapabilityRecord[] = [];
  for (const c of listCapabilities()) {
    if (c.dependencies.includes(capability_id)) out.push(c);
  }
  return Object.freeze(out);
}

// ── Full dependency introspection for one capability ──────────────────
export function analyseDependencies(capability_id: string): DependencySet | null {
  const cap = getCapability(capability_id);
  if (!cap) return null;
  const present: string[] = [];
  const missing: string[] = [];
  const untrustable: string[] = [];
  for (const depId of cap.dependencies) {
    const dep = getCapability(depId);
    if (!dep) { missing.push(depId); continue; }
    if (dep.status === "VERIFIED" || dep.status === "PROMOTED") present.push(depId);
    else untrustable.push(depId);
  }
  return {
    capability_id,
    capability_name: cap.name,
    present: Object.freeze(present),
    missing: Object.freeze(missing),
    untrustable: Object.freeze(untrustable),
  };
}

// ── Semantic tag search ───────────────────────────────────────────────
// Finds capabilities whose semantic_tags include ANY of the input tokens.
// Anti-fabrication: if no capability matches, returns empty · never invents.
export function findByTag(tokens: readonly string[]): readonly CapabilityRecord[] {
  if (tokens.length === 0) return Object.freeze([]);
  const norm = tokens.map((t) => t.toLowerCase());
  const out: CapabilityRecord[] = [];
  for (const c of listCapabilities()) {
    const tags = c.semantic_tags ?? [];
    for (const tag of tags) {
      if (norm.includes(tag.toLowerCase())) { out.push(c); break; }
    }
  }
  return Object.freeze(out.sort((a, b) => a.name.localeCompare(b.name)));
}

// ── Composition level query ───────────────────────────────────────────
export function findByCompositionLevel(level: CompositionLevel): readonly CapabilityRecord[] {
  const out: CapabilityRecord[] = [];
  for (const c of listCapabilities()) {
    const lvl = c.composition_level ?? "unspecified";
    if (lvl === level) out.push(c);
  }
  return Object.freeze(out);
}

// ── Gap analysis · what is missing to satisfy this request? ───────────
export interface CapabilityReference {
  readonly capability_id?: string;
  readonly by_name?: { readonly category: CapabilityCategory; readonly name: string };
}

function resolveRef(ref: CapabilityReference): CapabilityRecord | null {
  if (ref.capability_id) return getCapability(ref.capability_id);
  if (ref.by_name) return getCapabilityByName(ref.by_name.category, ref.by_name.name);
  return null;
}

export function findMissing(requested: readonly CapabilityReference[], options: { include_proposed_as_satisfied?: boolean } = {}): GapAnalysis {
  const requestedIds: string[] = [];
  const satisfied: string[] = [];
  const missing: string[] = [];
  const untrustable: string[] = [];
  const transitive_missing = new Set<string>();

  for (const ref of requested) {
    const label = ref.capability_id ?? (ref.by_name ? `${ref.by_name.category}::${ref.by_name.name}` : "unknown");
    requestedIds.push(label);
    const cap = resolveRef(ref);
    if (!cap) { missing.push(label); continue; }
    const trustable = cap.status === "VERIFIED" || cap.status === "PROMOTED" || (options.include_proposed_as_satisfied === true && cap.status === "PROPOSED");
    if (!trustable) { untrustable.push(cap.capability_id); continue; }
    satisfied.push(cap.capability_id);
    // Walk direct dependencies · anything not in registry becomes transitive_missing
    for (const depId of cap.dependencies) {
      const dep = getCapability(depId);
      if (!dep) transitive_missing.add(depId);
    }
  }

  return {
    requested: Object.freeze(requestedIds),
    satisfied: Object.freeze(satisfied),
    missing: Object.freeze(missing),
    untrustable: Object.freeze(untrustable),
    transitive_missing: Object.freeze(Array.from(transitive_missing)),
    all_satisfied: missing.length === 0 && untrustable.length === 0 && transitive_missing.size === 0,
    assessed_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ── Topological composition path (dependency-ordered build sequence) ──
// Returns steps in the order they must be built · detects cycles.
export function proposeCompositionPath(goalRef: CapabilityReference): CompositionPath {
  const goal = resolveRef(goalRef);
  if (!goal) {
    return {
      outcome: "blocked",
      gap: findMissing([goalRef]),
      rationale: "goal capability not found in registry",
    };
  }

  // BFS + topological sort with cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycle: string[] = [];
  const order: CapabilityRecord[] = [];
  const missingIds = new Set<string>();

  function visit(id: string, stack: string[]): boolean {
    if (visited.has(id)) return true;
    if (inStack.has(id)) {
      // cycle detected
      const idx = stack.indexOf(id);
      const cyc = stack.slice(idx).concat(id);
      for (const c of cyc) cycle.push(c);
      return false;
    }
    const cap = getCapability(id);
    if (!cap) { missingIds.add(id); return true; }
    inStack.add(id);
    stack.push(id);
    for (const depId of cap.dependencies) {
      const ok = visit(depId, stack);
      if (!ok) return false;
    }
    stack.pop();
    inStack.delete(id);
    visited.add(id);
    order.push(cap);
    return true;
  }

  const ok = visit(goal.capability_id, []);
  if (!ok && cycle.length > 0) {
    return {
      outcome: "cyclic",
      cycle: Object.freeze(cycle),
      rationale: `dependency cycle detected: ${cycle.join(" → ")}`,
    };
  }
  if (missingIds.size > 0) {
    return {
      outcome: "blocked",
      gap: {
        requested: [goal.capability_id],
        satisfied: [],
        missing: Object.freeze(Array.from(missingIds)),
        untrustable: [],
        transitive_missing: [],
        all_satisfied: false,
        assessed_at_iso: new Date().toISOString(),
        zero_llm: true,
        ledger: "B",
      },
      rationale: "one or more dependencies are not registered in the capability graph",
    };
  }

  const steps: CompositionPathStep[] = order.map((cap, idx) => ({
    capability_id: cap.capability_id,
    capability_name: cap.name,
    depends_on: cap.dependencies,
    build_order: idx,
  }));
  return { outcome: "resolved", steps: Object.freeze(steps), total_steps: steps.length };
}

// ── Cycle detection across the whole graph ────────────────────────────
export function detectCycles(): readonly (readonly string[])[] {
  const cycles: string[][] = [];
  const globalVisited = new Set<string>();
  for (const cap of listCapabilities()) {
    if (globalVisited.has(cap.capability_id)) continue;
    const localVisiting = new Set<string>();
    const stack: string[] = [];
    walkForCycle(cap.capability_id, localVisiting, stack, cycles);
    for (const v of localVisiting) globalVisited.add(v);
  }
  return Object.freeze(cycles);
}

function walkForCycle(id: string, visiting: Set<string>, stack: string[], cycles: string[][]): void {
  if (visiting.has(id)) {
    const idx = stack.indexOf(id);
    if (idx >= 0) {
      cycles.push(stack.slice(idx).concat(id));
    }
    return;
  }
  visiting.add(id);
  stack.push(id);
  const cap = getCapability(id);
  if (cap) {
    for (const depId of cap.dependencies) walkForCycle(depId, visiting, stack, cycles);
  }
  stack.pop();
}

// ── Graph summary · edge count + orphan detection ─────────────────────
export interface GraphSummary {
  readonly total_nodes: number;
  readonly total_edges: number;
  readonly orphan_nodes: readonly string[];       // capabilities not required by anything
  readonly leaf_nodes: readonly string[];         // capabilities with no dependencies
  readonly cycles_detected: number;
  readonly generated_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export function summarizeGraph(): GraphSummary {
  const all = listCapabilities();
  const requiredBy = new Set<string>();
  let edges = 0;
  for (const c of all) {
    edges += c.dependencies.length;
    for (const d of c.dependencies) requiredBy.add(d);
  }
  const orphans: string[] = [];
  const leaves: string[] = [];
  for (const c of all) {
    if (!requiredBy.has(c.capability_id)) orphans.push(c.capability_id);
    if (c.dependencies.length === 0) leaves.push(c.capability_id);
  }
  return {
    total_nodes: all.length,
    total_edges: edges,
    orphan_nodes: Object.freeze(orphans),
    leaf_nodes: Object.freeze(leaves),
    cycles_detected: detectCycles().length,
    generated_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}
