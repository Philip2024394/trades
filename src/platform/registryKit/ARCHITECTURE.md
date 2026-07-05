# Registry Architecture

**Owner:** Platform · Milestone 1 shipped 2026-07-05.

---

## What a registry is

A **registry** is the runtime index for a family of content in the
platform — sections, blueprints, apps, packs, design components,
buttons, knowledge domains, knowledge packages, payment processors.
Every registry conforms to the same shape via the
`registryKit/createRegistry` factory.

Registries are **manifest-first**: registrations are pure data +
one renderer reference. Registries are **process-local**: every Node
process holds its own populated instance, populated by side-effect
barrel imports at cold-boot.

---

## Diagram — registries in the platform

```
┌─────────────────────────────────────────────────────────────────┐
│                         Registry Kit                            │
│                (src/platform/registryKit/)                      │
│                                                                 │
│    createRegistry<T>({label, idFormat, validate, indexes, ...}) │
│         │                                                       │
│         ├── validators (SLUG_RE, SEMVER_RE, id shape checks)    │
│         ├── deepFreeze (cycle-tolerant)                         │
│         ├── search (weighted-keyword)                           │
│         ├── describe (AI-consumable one-liner)                  │
│         ├── selfCheck (cross-registration invariants)           │
│         ├── snapshot (DB-ready serialisation)                   │
│         ├── telemetry hooks (per-call observability)            │
│         └── analytics hooks (business events)                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
   ┌─────────────────┼─────────────────┬───────────────┐
   │                 │                 │               │
   ▼                 ▼                 ▼               ▼
┌────────┐    ┌────────────┐   ┌──────────┐    ┌────────────┐
│Section │    │ Blueprint  │   │  App     │    │ Pack       │
│(48)    │    │  (52)      │   │  (3)     │    │ (1)        │
└────────┘    └────────────┘   └──────────┘    └────────────┘
                                     │              │
                                     ▼              ▼
                              ┌───────────────────────────┐
                              │ Manifest-first content    │
                              └───────────────────────────┘

┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ DesignSystem (7) │   │ Button (N)       │   │ Payment (N)      │
└──────────────────┘   └──────────────────┘   └──────────────────┘

┌────────────────────┐   ┌──────────────────────┐
│ KnowledgeDomain    │   │ KnowledgePackage     │
│ (N)                │──▶│ (13)                 │  (references)
└────────────────────┘   └──────────────────────┘
```

**Outside the kit** (deliberately separate):
- `aiGateway` — provider router for LLM calls. Future *AI Provider
  Manager* territory, not content-manifest territory.

---

## Registry API surface

Every registry exposes the same 18-method surface via facade over
`createRegistry`. Domain-specific extensions (like `.rank()`,
`.resolveDependencies()`, `.neighbours()`, `.resolve()`) layer on top.

| Method | Purpose |
|---|---|
| `register(reg)` | Add a registration (validates + freezes + indexes) |
| `get(id)` | Lookup by id or alias |
| `getOrThrow(id)` | Same, throws on miss |
| `has(id)` | Boolean |
| `list()` | Every registration |
| `listByCategory(cat)` | Primary index |
| `listByIndex(name, key)` | Secondary index (byTrade, byOutcome, ...) |
| `listByTag(tag)` | Cross-cutting tag filter |
| `ids()` | Canonical ids only |
| `categories()` | Distinct categories |
| `tags()` | Distinct tags |
| `size()` | Total registrations |
| `counts()` | `{ total, byCategory: {} }` |
| `search(q, limit?)` | Weighted-keyword search |
| `describe(id)` | AI-consumable one-liner |
| `resolveAlias(alias)` | Canonical id an alias resolves to |
| `selfCheck()` | Cross-registration invariants |
| `snapshot()` | JSON-serialisable point-in-time dump |

Each registration must extend `RegistrationBase`:

```ts
type RegistrationBase = {
  id: string;
  version: string;      // semver
  name: string;
  description: string;
  category: string;
  tags?: readonly string[];
  searchKeywords?: readonly string[];
  aliases?: readonly string[];
  deprecation?: Deprecation;
  marketplace?: MarketplaceMetadata;
};
```

---

## Platform Constitution — what every registry satisfies

| Constitution item | Where implemented |
|---|---|
| Schema validation | `createRegistry.validate` config hook |
| Metadata validation | `RegistrationBase` required fields |
| Duplicate detection | Kit built-in (throws on collision) |
| Dependency validation | Domain-specific via `validate` (e.g. Apps check deps) |
| Version validation | Semver regex enforced at register |
| Deprecation support | `RegistrationBase.deprecation` + selfCheck warnings |
| Search | Kit built-in (weighted, tag-aware) |
| Filtering | `listByCategory` + `listByTag` + `listByIndex` |
| Tags | First-class on `RegistrationBase` |
| Categories | Primary index on every registry |
| AI metadata | `describe(id)` — extensible via `extraFacts` |
| Telemetry hooks | `RegistryConfig.telemetry` |
| Analytics hooks | `RegistryConfig.analytics` (business events) |
| Future DB compat | `snapshot()` + `seed` config option |

---

## Migration policy

**Facade over kit.** Each existing registry has been retrofitted
behind a facade that preserves the historic public API 1:1. The
kit powers everything under the hood. Zero call-site changes across
the codebase — the 48 sections, 52 blueprints, 20+ payment processors,
7 design components, etc. all keep working verbatim.

**When to add a new registry:**
1. Create a schema type (`XManifest`) extending `RegistrationBase`.
2. Call `createRegistry<X>({ label, idFormat, validate, indexes })`.
3. Optionally wrap in a facade to add domain-specific methods.

**No hand-rolled registries.** Every new registry uses the kit.
Duplicate implementations are architectural drift.

---

## Files

```
src/platform/registryKit/
├── ARCHITECTURE.md      This document
├── createRegistry.ts    The factory
├── deepFreeze.ts        Cycle-tolerant freezing
├── describe.ts          AI-consumable describe helpers
├── index.ts             Barrel
├── search.ts            Weighted-keyword search
├── selfCheck.ts         Cross-registration invariants
├── telemetry.ts         Safe hook emission
├── types.ts             RegistrationBase, RegistryConfig, Registry<T>
├── validators.ts        SLUG_RE, SEMVER_RE, isSlug, isSemver, ...
└── __tests__/           8 unit tests (validators, deepFreeze, factory,
                           search, describe, telemetry, selfCheck, aliases)
```
