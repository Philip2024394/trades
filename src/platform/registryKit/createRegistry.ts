// registryKit · createRegistry.
//
// Composition-over-inheritance factory. Every domain registry
// (Section, Blueprint, App, Pack, Design, Button, KG, and every future
// Container/Layout/Theme/Asset/Form registry) is a `Registry<T>` built
// from this factory + a domain-specific config.
//
// Design decisions:
//   • Factory returns an object, not a class instance — TypeScript
//     inference on domain-specific extensions like `.rank()` and
//     `.resolveDependencies()` composes cleanly by object-spread
//     rather than class extension.
//   • Every `register()` call deep-freezes AND validates AND updates
//     every secondary index atomically. No half-registered state.
//   • Aliases are transparent — `get("old-slug")` returns the
//     registration at the canonical id if the old slug is declared
//     as an alias. `has("old-slug")` also returns true.
//   • Duplicate id throws. Duplicate alias across two registrations
//     throws.
//   • Zero cost when no telemetry is attached.

import type {
  Frozen,
  RegistrationBase,
  Registry,
  RegistryConfig,
  RegistrySnapshot
} from "./types";
import { deepFreeze } from "./deepFreeze";
import { isSemver, isSlug, isNamespacedId } from "./validators";
import { searchRegistrations } from "./search";
import { describeRegistration } from "./describe";
import { selfCheckRegistry } from "./selfCheck";
import { safeEmit } from "./telemetry";

export function createRegistry<T extends RegistrationBase>(
  config: RegistryConfig<T>
): Registry<T> {
  const { label, idFormat, validate, indexes, telemetry, analytics, seed } =
    config;
  const byId = new Map<string, Frozen<T>>();
  const byCategory = new Map<string, Frozen<T>[]>();
  const byTag = new Map<string, Frozen<T>[]>();
  const secondaryIndexes = new Map<string, Map<string, Frozen<T>[]>>();
  const aliasToId = new Map<string, string>();

  function checkIdFormat(id: unknown): void {
    if (idFormat === "slug" && !isSlug(id)) {
      throw new Error(
        `${label}: invalid id "${String(id)}" — expected kebab-case slug.`
      );
    }
    if (idFormat === "namespacedId" && !isNamespacedId(id)) {
      throw new Error(
        `${label}: invalid id "${String(id)}" — expected "<category>.<name>" namespaced id.`
      );
    }
  }

  function baseValidate(reg: T): void {
    checkIdFormat(reg.id);
    if (!isSemver(reg.version)) {
      throw new Error(
        `${label}: "${reg.id}" version "${reg.version}" is not valid semver.`
      );
    }
    if (!reg.name || typeof reg.name !== "string") {
      throw new Error(`${label}: "${reg.id}" is missing name.`);
    }
    if (!reg.description || typeof reg.description !== "string") {
      throw new Error(`${label}: "${reg.id}" is missing description.`);
    }
    if (!reg.category || typeof reg.category !== "string") {
      throw new Error(`${label}: "${reg.id}" is missing category.`);
    }
    for (const alias of reg.aliases ?? []) {
      checkIdFormat(alias);
      if (alias === reg.id) {
        throw new Error(
          `${label}: "${reg.id}" declares itself as an alias.`
        );
      }
    }
  }

  function register(reg: T): Frozen<T> {
    baseValidate(reg);
    if (validate) validate(reg);

    if (byId.has(reg.id)) {
      throw new Error(
        `${label}: duplicate registration for id "${reg.id}".`
      );
    }
    for (const alias of reg.aliases ?? []) {
      if (byId.has(alias)) {
        throw new Error(
          `${label}: alias "${alias}" on "${reg.id}" collides with a registered id.`
        );
      }
      if (aliasToId.has(alias)) {
        throw new Error(
          `${label}: alias "${alias}" is already claimed by "${aliasToId.get(alias)}".`
        );
      }
    }

    const frozen = deepFreeze(reg) as Frozen<T>;
    byId.set(reg.id, frozen);

    // Primary category index.
    const catBucket = byCategory.get(reg.category) ?? [];
    catBucket.push(frozen);
    byCategory.set(reg.category, catBucket);

    // Tag index — every tag on the registration.
    for (const tag of reg.tags ?? []) {
      const bucket = byTag.get(tag) ?? [];
      bucket.push(frozen);
      byTag.set(tag, bucket);
    }

    // Secondary indexes.
    if (indexes) {
      for (const [name, keyFn] of Object.entries(indexes)) {
        const keys = keyFn(reg);
        let byKey = secondaryIndexes.get(name);
        if (!byKey) {
          byKey = new Map();
          secondaryIndexes.set(name, byKey);
        }
        for (const key of keys) {
          const bucket = byKey.get(key) ?? [];
          bucket.push(frozen);
          byKey.set(key, bucket);
        }
      }
    }

    // Aliases.
    for (const alias of reg.aliases ?? []) {
      aliasToId.set(alias, reg.id);
    }

    safeEmit(telemetry?.onRegister, frozen);
    safeEmit(analytics?.onEvent, {
      type: "registration.added",
      registry: label,
      id: reg.id,
      category: reg.category,
      version: reg.version,
      timestamp: Date.now()
    });
    return frozen;
  }

  function resolveId(id: string): string {
    return aliasToId.get(id) ?? id;
  }

  function get(id: string): Frozen<T> | undefined {
    const canonical = resolveId(id);
    const hit = byId.get(canonical);
    if (hit) {
      safeEmit(telemetry?.onGet, id, true);
    } else {
      safeEmit(telemetry?.onGet, id, false);
      safeEmit(telemetry?.onMiss, id);
    }
    return hit;
  }

  function getOrThrow(id: string): Frozen<T> {
    const hit = get(id);
    if (!hit) {
      throw new Error(
        `${label}: no registration for id "${id}". Ensure the module barrel is imported before use.`
      );
    }
    return hit;
  }

  function has(id: string): boolean {
    return byId.has(resolveId(id));
  }

  function list(): Frozen<T>[] {
    return Array.from(byId.values());
  }

  function listByCategory(category: string): Frozen<T>[] {
    return [...(byCategory.get(category) ?? [])];
  }

  function listByIndex(indexName: string, key: string): Frozen<T>[] {
    const byKey = secondaryIndexes.get(indexName);
    if (!byKey) return [];
    return [...(byKey.get(key) ?? [])];
  }

  function listByTag(tag: string): Frozen<T>[] {
    return [...(byTag.get(tag) ?? [])];
  }

  function ids(): string[] {
    return Array.from(byId.keys());
  }

  function categories(): string[] {
    return Array.from(byCategory.keys());
  }

  function tags(): string[] {
    return Array.from(byTag.keys());
  }

  function size(): number {
    return byId.size;
  }

  function counts(): { total: number; byCategory: Record<string, number> } {
    const buckets = {} as Record<string, number>;
    for (const [cat, arr] of byCategory) buckets[cat] = arr.length;
    return { total: byId.size, byCategory: buckets };
  }

  function search(query: string, limit = 20): Frozen<T>[] {
    const hits = searchRegistrations<T>(byId.values(), query, limit);
    safeEmit(analytics?.onEvent, {
      type: "registration.searched",
      registry: label,
      query,
      hitCount: hits.length,
      timestamp: Date.now()
    });
    return hits;
  }

  function describe(id: string): string {
    return describeRegistration<T>(get(id));
  }

  function resolveAlias(alias: string): string | null {
    return aliasToId.get(alias) ?? null;
  }

  function selfCheck(): { warnings: string[]; errors: string[] } {
    return selfCheckRegistry<T>(label, byId.keys(), (id) => byId.get(id));
  }

  function snapshot(): RegistrySnapshot<T> {
    return {
      version: 1,
      label,
      takenAt: new Date().toISOString(),
      registrations: Array.from(byId.values()).map((r) => ({ ...r }))
    };
  }

  // ─── Optional seed at factory creation ───────────────────────────
  if (seed) {
    for (const r of seed) register(r);
    safeEmit(analytics?.onEvent, {
      type: "registration.hydrated",
      registry: label,
      count: seed.length,
      timestamp: Date.now()
    });
  }

  return {
    register,
    get,
    getOrThrow,
    has,
    list,
    listByCategory,
    listByIndex,
    listByTag,
    ids,
    categories,
    tags,
    size,
    counts,
    search,
    describe,
    resolveAlias,
    selfCheck,
    snapshot
  };
}
