// NEX Workforce v2 · Slice 1c · Step-Library Registry
// ─────────────────────────────────────────────────────────────────────────────
// Central lookup for step-libraries keyed by (category_slug, source_slug).
//
// A step-library contract:
//   export const seedCursor = () => ({...})
//     Returns the initial cursor_json for a fresh work_item.
//
//   export const plan = ({ cursor, workItem }) => Step[]
//     Returns an ordered array of steps to run from the current cursor.
//     The plan MUST be deterministic from (cursor, workItem) so a re-run
//     produces the same steps.
//
//   Step = {
//     id:            string,                 // stable identifier · used in idempotency keys
//     execute:       async ({ ctx }) => any, // do the work; return arbitrary result
//     retryPolicy?:  RetryPolicy,            // optional · defaults to DEFAULT_POLICY
//     rateOverride?: RatePolicy,             // optional per-source override
//     classifier?:   CustomRule[],           // optional additional classify() rules
//     newCursor?:    async ({ cursor, result }) => cursor  // returns updated cursor to persist
//   }
//
// Registration is explicit: import the module and call register().
// No filesystem magic, no auto-discovery.

const registry = new Map();

function key(category, source) { return `${category}::${source}`; }

export function register(categorySlug, sourceSlug, module) {
  if (!categorySlug || !sourceSlug) throw new Error("register: categorySlug + sourceSlug required");
  if (typeof module?.seedCursor !== "function") throw new Error(`register: ${categorySlug}/${sourceSlug} missing seedCursor()`);
  if (typeof module?.plan !== "function")       throw new Error(`register: ${categorySlug}/${sourceSlug} missing plan()`);
  registry.set(key(categorySlug, sourceSlug), module);
}

export function resolve(categorySlug, sourceSlug) {
  const m = registry.get(key(categorySlug, sourceSlug));
  if (!m) throw new Error(`no step-library registered for ${categorySlug}/${sourceSlug}`);
  return m;
}

export function has(categorySlug, sourceSlug) {
  return registry.has(key(categorySlug, sourceSlug));
}

export function _resetForTests() { registry.clear(); }
