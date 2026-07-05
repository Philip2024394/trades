# Registry Dependency Graph

Cross-registry references at boot time. Read top-down: registries
lower in the tree depend on those above them being populated first.

```
                              registryKit
                                   │
                                   │ (no runtime deps)
                                   │
     ┌─────────────────────────────┼─────────────────────────────┐
     │                             │                             │
     ▼                             ▼                             ▼
paymentProcessors           sectionRegistry            knowledgeDomainRegistry
     │                             │                             │
     │ (independent —              │                             │
     │  self-contained)            │                             │ referenced by
     ▼                             │                             ▼
    ─                              │                    knowledgePackageRegistry
                                   │                             │
     ┌─────────────────────────────┴──┐                          │ referenced by
     ▼                                ▼                          ▼
appRegistry                    blueprintRegistry           sectionRegistry
     │                                │                    (KG-bound sections)
     │                                │
     │ referenced by                  │
     ▼                                ▼
packRegistry              buttonRegistry
     │                    designSystemRegistry
     │
     │ (packs install
     │  Apps)
     ▼
    ─

separately:
                              aiGateway
                        (NOT part of registryKit —
                         AI Provider Manager
                         territory, deliberately
                         separate)
```

## Cold-boot population order

Side-effect barrel imports pull in registration files. Runtime
requires each dependent registry to be populated before its
consumers reach for it. Ordering enforced by which barrels are
imported first at the module graph roots:

1. **Independent** — populate in any order:
   - `paymentProcessors` (via `platform/buttons/payments/processors/*`)
   - `buttonRegistry` (via `platform/buttons/variants/*`)
   - `designSystemRegistry` (via `platform/design/components/*`)
   - `sectionRegistry` (via `lib/studio/sections/*`)
   - `appRegistry` (via `apps/*/index.ts`)

2. **Dependent chain**:
   - `knowledgeDomainRegistry` (via `lib/knowledge/domains/*`)
   - → `knowledgePackageRegistry` (via `lib/knowledge/packages/*`)
     — validates every referenced Domain exists
   - → sections that bind to KG resolve via `packageForTrade()` at
     render time — no boot-time coupling

3. **Cross-registry consumers**:
   - `packRegistry` (via `packs/*/index.ts`) — Packs reference Apps
     by slug; Pack install validates App existence via `appRegistry`
   - `blueprintRegistry` — references Section ids in layouts;
     validated at install time via `sectionRegistry.has()`, not at
     register time

## Validation crossings

Registries reach across boundaries at **validate time** — the
kit's `validate` hook runs once per registration:

| Registry | Crosses to | Purpose |
|---|---|---|
| `knowledgePackageRegistry` | `knowledgeDomainRegistry` | Every `usesDomains` entry + `extensions[].domainId` must exist; entity + capability references validated |
| `packRegistry` | (deferred to install) | Pack manifest validates apps[] non-empty; App existence checked at install |
| `blueprintRegistry` | (deferred to install) | Layout section id existence checked at install |

## No cyclical dependencies

The graph has no cycles. `knowledgePackage` reads `knowledgeDomain`
(one-way). `blueprintRegistry` reads `sectionRegistry` at install
time only, not at register time. Everything else is independent.
