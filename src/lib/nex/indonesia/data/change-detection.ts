// Change detection · diff old→new observation.
//
// When a walker re-observes a known entity, we compare the new
// observation to what we already have and emit ChangeEvents for the
// fields that moved. This is what lets NEX say "this business
// changed its phone number three days ago" — the change history is
// preserved on the entity.
//
// Fields compared today: name, description, geo.province/regency/lat/lng,
// contacts (channel-by-channel), attributes (JSON-diff at top level).

import type { ChangeEvent, EntityRecord } from "./types";

/** Compute ChangeEvents for one field name → value diff. Simple
 *  primitive-equality check; deep objects are compared by JSON
 *  stringification (good enough for the current record shapes). */
function diffField(field: string, before: unknown, after: unknown, sourceKey: string, at: string): ChangeEvent | null {
  const equal = typeof before === "object" && before !== null && typeof after === "object" && after !== null
    ? JSON.stringify(before) === JSON.stringify(after)
    : before === after;
  if (equal) return null;
  return { at, field, from: before, to: after, sourceKey };
}

/** Diff a set of top-level fields. */
function diffFields(
  fields: string[],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  sourceKey: string,
  at: string,
): ChangeEvent[] {
  const out: ChangeEvent[] = [];
  for (const f of fields) {
    const ev = diffField(f, before[f], after[f], sourceKey, at);
    if (ev) out.push(ev);
  }
  return out;
}

/** Compare an existing entity with a new observation and return the
 *  list of changes. Empty list ⇒ no change. */
export function detectChanges(existing: EntityRecord, observed: EntityRecord, sourceKey: string, at: string = new Date().toISOString()): ChangeEvent[] {
  const changes: ChangeEvent[] = [];

  // Top-level primitives.
  changes.push(...diffFields(
    ["name", "description", "category"],
    existing as unknown as Record<string, unknown>,
    observed as unknown as Record<string, unknown>,
    sourceKey, at,
  ));

  // Geo · walk important sub-fields individually.
  const geoFields: Array<keyof NonNullable<EntityRecord["geo"]>> = [
    "province", "regency", "district", "village", "neighborhood", "lat", "lng",
  ];
  for (const f of geoFields) {
    const b = existing.geo?.[f];
    const a = observed.geo?.[f];
    const ev = diffField(`geo.${f}`, b, a, sourceKey, at);
    if (ev) changes.push(ev);
  }

  // Contacts · compare by kind. Adding/removing a channel counts.
  const beforeContactsByKind = new Map<string, string>();
  for (const c of existing.contacts ?? []) beforeContactsByKind.set(c.kind, c.value);
  const afterContactsByKind = new Map<string, string>();
  for (const c of observed.contacts ?? []) afterContactsByKind.set(c.kind, c.value);
  const kinds = new Set<string>([...beforeContactsByKind.keys(), ...afterContactsByKind.keys()]);
  for (const k of kinds) {
    const b = beforeContactsByKind.get(k);
    const a = afterContactsByKind.get(k);
    if (b !== a) changes.push({ at, field: `contact.${k}`, from: b ?? null, to: a ?? null, sourceKey });
  }

  // Attributes · JSON compare at top level.
  const beforeAttr = existing.attributes ?? {};
  const afterAttr = observed.attributes ?? {};
  const attrKeys = new Set<string>([...Object.keys(beforeAttr), ...Object.keys(afterAttr)]);
  for (const k of attrKeys) {
    const ev = diffField(`attributes.${k}`, beforeAttr[k], afterAttr[k], sourceKey, at);
    if (ev) changes.push(ev);
  }

  return changes;
}
