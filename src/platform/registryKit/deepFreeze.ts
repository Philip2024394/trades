// registryKit · deepFreeze.
//
// Recursively freezes an object graph so registered manifests can't be
// mutated after registration. Replaces 5+ hand-rolled copies across
// the codebase. Handles cycles defensively.

/** Recursively freeze a value + everything it transitively references.
 *  Primitives are returned as-is. Cycles are tolerated. */
export function deepFreeze<T>(value: T): T {
  return freeze(value, new WeakSet());
}

function freeze<T>(value: T, seen: WeakSet<object>): T {
  if (value === null || typeof value !== "object") return value;
  const obj = value as unknown as object;
  if (seen.has(obj)) return value;
  seen.add(obj);
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const child = (obj as Record<string, unknown>)[key];
    freeze(child, seen);
  }
  Object.freeze(obj);
  return value;
}
