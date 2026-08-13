// Object Library · Subcomponent helpers (Philip 2026-08-04).
//
// Recognition · querying · generation all become more precise when a complex
// object exposes its internal anatomy. These helpers walk the subcomponents
// tree without callers needing to know the recursion.
//
// Doctrine: docs/brains/nex-object-dna-subcomponent-hierarchy-philip-2026-08-04.md

import type { ObjectDNA, SubcomponentEntry } from "./types";

/** Direct-child lookup by slot name. Returns undefined if not present. */
export function getSubcomponent(obj: ObjectDNA, slot: string): SubcomponentEntry | undefined {
  return (obj.subcomponents ?? []).find((s) => s.slot === slot);
}

/** Depth-first generator over every subcomponent entry (including descendants). */
export function* walkSubcomponents(obj: ObjectDNA): Generator<SubcomponentEntry> {
  const stack: SubcomponentEntry[] = [...(obj.subcomponents ?? [])];
  while (stack.length > 0) {
    const entry = stack.shift()!;
    yield entry;
    if (entry.children && entry.children.length > 0) stack.unshift(...entry.children);
  }
}

/** Flat `Record<slot, value>` map · latest wins on duplicate slot at different depths.
 *  Used for cheap SQL-style filter predicates without walking the tree each time. */
export function flattenSubcomponents(obj: ObjectDNA): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of walkSubcomponents(obj)) {
    out[entry.slot] = entry.value;
  }
  return out;
}

/** Filter predicate for querying by subcomponent match. */
export function hasSubcomponent(obj: ObjectDNA, slot: string, value: string): boolean {
  for (const entry of walkSubcomponents(obj)) {
    if (entry.slot === slot && entry.value === value) return true;
  }
  return false;
}

/** Return every unique slot name declared on an object's subcomponent tree. */
export function subcomponentSlots(obj: ObjectDNA): readonly string[] {
  const slots = new Set<string>();
  for (const entry of walkSubcomponents(obj)) slots.add(entry.slot);
  return Array.from(slots);
}
