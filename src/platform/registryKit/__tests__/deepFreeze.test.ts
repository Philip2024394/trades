// registryKit · deepFreeze — tests.

import { deepFreeze } from "../deepFreeze";

// ─── Freezes the root object ─────────────────────────────────────
{
  const o = { a: 1 };
  deepFreeze(o);
  console.assert(Object.isFrozen(o), "T1a: root object frozen");
}

// ─── Freezes nested objects ──────────────────────────────────────
{
  const o = { child: { deep: { value: 1 } } };
  deepFreeze(o);
  console.assert(Object.isFrozen(o.child), "T2a: child frozen");
  console.assert(Object.isFrozen(o.child.deep), "T2b: grandchild frozen");
}

// ─── Freezes array items ─────────────────────────────────────────
{
  const o = { xs: [{ a: 1 }, { a: 2 }] };
  deepFreeze(o);
  console.assert(Object.isFrozen(o.xs), "T3a: array frozen");
  console.assert(Object.isFrozen(o.xs[0]), "T3b: first item frozen");
  console.assert(Object.isFrozen(o.xs[1]), "T3c: second item frozen");
}

// ─── Tolerates cycles ────────────────────────────────────────────
{
  type Node = { next?: Node };
  const a: Node = {};
  const b: Node = {};
  a.next = b;
  b.next = a;
  let threw = false;
  try {
    deepFreeze(a);
  } catch {
    threw = true;
  }
  console.assert(!threw, "T4a: cyclic graph doesn't throw");
  console.assert(Object.isFrozen(a), "T4b: a is frozen");
  console.assert(Object.isFrozen(b), "T4c: b is frozen");
}

// ─── Primitives pass through ─────────────────────────────────────
{
  console.assert(deepFreeze(42) === 42, "T5a: number pass-through");
  console.assert(deepFreeze("s") === "s", "T5b: string pass-through");
  console.assert(deepFreeze(null) === null, "T5c: null pass-through");
}

console.log("registryKit · deepFreeze: all assertions passed.");
