# Registry Kit — API Reference

## `createRegistry<T>(config)`

Factory. Returns a `Registry<T>` object.

```ts
import { createRegistry } from "@/platform/registryKit";

const inner = createRegistry<MyRegistration>({
  label: "myRegistry",
  idFormat: "slug",              // or "namespacedId"
  validate: (reg) => { ... },
  indexes: { byTrade: (r) => r.trades },
  telemetry: { onRegister, onGet, onMiss },
  analytics: { onEvent },
  seed: [ ... ]                  // optional initial registrations
});
```

## `Registry<T>` — full method surface

### Registration

- `register(reg: T): Frozen<T>` — validate, freeze, index, emit.
  Throws on duplicate id or alias collision.

### Lookup

- `get(id): Frozen<T> | undefined` — transparent alias resolution.
- `getOrThrow(id): Frozen<T>` — throws with a clear message.
- `has(id): boolean` — includes aliases.
- `resolveAlias(alias): string | null` — canonical id for an alias.

### Enumeration

- `list(): Frozen<T>[]` — every registration, in insertion order.
- `listByCategory(cat: string): Frozen<T>[]` — primary index.
- `listByIndex(name, key): Frozen<T>[]` — secondary index.
- `listByTag(tag: string): Frozen<T>[]` — cross-cutting tag filter.
- `ids(): string[]` — canonical ids only (excludes aliases).
- `categories(): string[]` — distinct categories.
- `tags(): string[]` — distinct tags.
- `size(): number` — total registrations.
- `counts(): { total, byCategory }` — for UI badges.

### Discovery

- `search(query, limit=20): Frozen<T>[]` — weighted-keyword search.
  Scoring: exact id +10, partial id +8, name +6, exact keyword +5,
  partial keyword +3, exact tag +4, partial tag +2, description +2,
  category +1.

- `describe(id): string` — one-line AI-consumable description.
  Composable via `describeRegistration(reg, extraFacts)`.

### Persistence + safety

- `selfCheck(): { warnings, errors }` — cross-registration invariants
  (alias collisions, deprecation.replacedBy refs).
- `snapshot(): RegistrySnapshot<T>` — JSON-serialisable dump for
  future DB persistence.

## `RegistrationBase`

Every registration extends this shape:

```ts
type RegistrationBase = {
  id: string;                         // validated against idFormat
  version: string;                    // semver
  name: string;
  description: string;
  category: string;                   // primary index
  tags?: readonly string[];           // cross-cutting facets
  searchKeywords?: readonly string[]; // fuzzy search tokens
  aliases?: readonly string[];        // transparent rename support
  deprecation?: Deprecation;
  marketplace?: MarketplaceMetadata;
};

type Deprecation = {
  deprecatedSince: string;            // semver
  removeIn?: string;
  reason?: string;
  replacedBy?: string;                // id or alias
};

type MarketplaceMetadata = {
  displayName?: string;
  tagline?: string;
  previewImageUrl?: string;
  detailImageUrl?: string;
  author?: string;
  license?: string;
  pricing?: "free" | "paid" | "included";
  tags?: readonly string[];
};
```

## Validators

```ts
import {
  SLUG_RE,           // /^[a-z0-9][a-z0-9-]*[a-z0-9]$/
  NAMESPACED_ID_RE,  // /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_-]*$/
  SEMVER_RE,         // /^\d+\.\d+\.\d+(?:-...)?$/
  isSlug, isNamespacedId, isSemver,
  compareSemver
} from "@/platform/registryKit";
```

## Analytics events

```ts
type RegistryAnalyticsEvent =
  | { type: "registration.added"; registry; id; category; version; timestamp }
  | { type: "registration.searched"; registry; query; hitCount; timestamp }
  | { type: "registration.hydrated"; registry; count; timestamp };
```

Fired on `.register()` and `.search()` and (once) at factory-time
when `seed` is present.

## Telemetry hooks

Per-call observability. Fire-and-forget — any thrown error inside a
hook is swallowed:

```ts
telemetry: {
  onRegister?: (reg) => void;
  onGet?: (id, hit: boolean) => void;
  onMiss?: (id) => void;
}
```

## Snapshot / hydration

```ts
type RegistrySnapshot<T> = {
  version: 1;
  label: string;
  takenAt: string;                    // ISO 8601
  registrations: T[];                 // canonical registrations
};
```

Snapshots are JSON-safe (aliases embedded on each registration).
Restore via `seed` config option at factory creation.

## Domain-specific extension pattern

Each existing registry facade layers domain methods on top:

```ts
// Example — blueprintRegistry facade:
export const blueprintRegistry = {
  register: (m) => inner.register(normalise(m)),
  get: inner.get,
  ...
  rank: (input) => { ...weighted formula... },  // domain-specific
  listByTrade: (slug) => inner.listByIndex("byTrade", slug)
};
```

Domain methods have full type inference. Kit surface is inherited
verbatim.
