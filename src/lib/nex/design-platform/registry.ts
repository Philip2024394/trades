// Design Platform · in-memory registry for DesignObjects.
//
// MVP · a minimal registry that lets other platform services register/query
// DesignObjects by id · category · tag. Backing store is in-memory. A future
// phase will persist to `data/nex-design-objects.jsonl` and to Supabase.
//
// Doctrine: docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md

import type { DesignObject, DesignObjectCategory } from "./design-object";

const registry = new Map<string, DesignObject>();

export function register(obj: DesignObject): DesignObject {
  if (registry.has(obj.id)) throw new Error(`DesignObject id already registered: ${obj.id}`);
  registry.set(obj.id, obj);
  return obj;
}

export function upsert(obj: DesignObject): DesignObject {
  registry.set(obj.id, obj);
  return obj;
}

export function get(id: string): DesignObject | undefined {
  return registry.get(id);
}

export function all(): readonly DesignObject[] {
  return Array.from(registry.values());
}

export function byCategory(category: DesignObjectCategory): readonly DesignObject[] {
  return all().filter((o) => o.category === category);
}

export function byTag(tag: string): readonly DesignObject[] {
  return all().filter((o) => (o.tags ?? []).includes(tag));
}

export function byType(type: string): readonly DesignObject[] {
  return all().filter((o) => o.type === type);
}

/** Return every DesignObject that this one is compatible with, resolved to full objects.
 *  Silently drops compatibility references that are not yet registered. */
export function compatibleWith(id: string): readonly DesignObject[] {
  const obj = registry.get(id);
  if (!obj) return [];
  return obj.capabilities.compatible_with
    .map((cid) => registry.get(cid))
    .filter((o): o is DesignObject => o !== undefined);
}

export function clear(): void {
  registry.clear();
}

export function count(): number {
  return registry.size;
}
